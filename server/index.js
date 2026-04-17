import crypto from "crypto";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";
import pg from "pg";
import Razorpay from "razorpay";
import mlRoutes from "./routes/mlRoutes.js";
import { startTriggerChecker } from "./triggerChecker.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8080);
const { Pool } = pg;

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const jwtSecret = process.env.JWT_SECRET || "smartshift-dev-insecure-secret";
const mapboxAccessToken = process.env.MAPBOX_ACCESS_TOKEN || "";

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not set. Using an insecure fallback secret for development only.");
}

if (!keyId || !keySecret) {
  throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in .env");
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

const databaseUrl = process.env.DATABASE_URL;
const dbPool = databaseUrl
  ? new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  })
  : null;

const ensureSupplementalSchema = async () => {
  if (!dbPool) return;

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id SERIAL PRIMARY KEY,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'worker',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbPool.query("CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_lower_uq ON auth_users (LOWER(email));");

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      id SERIAL PRIMARY KEY,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE UNIQUE,
      balance REAL NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbPool.query("ALTER TABLE claims ADD COLUMN IF NOT EXISTS triggers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];");
  await dbPool.query("ALTER TABLE wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();");
  await dbPool.query("ALTER TABLE workers ADD COLUMN IF NOT EXISTS active_plan TEXT;");
  await dbPool.query("ALTER TABLE workers ADD COLUMN IF NOT EXISTS plan_start_time TIMESTAMPTZ;");
  await dbPool.query("ALTER TABLE workers ADD COLUMN IF NOT EXISTS plan_end_time TIMESTAMPTZ;");
  await dbPool.query("ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS latitude REAL;");
  await dbPool.query("ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS longitude REAL;");
  await dbPool.query("ALTER TABLE risk_data ADD COLUMN IF NOT EXISTS traffic_delay_ratio REAL;");

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS worker_location_risk_logs (
      id SERIAL PRIMARY KEY,
      worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
      city TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      destination_latitude REAL,
      destination_longitude REAL,
      rain_probability REAL NOT NULL,
      rain_mm REAL NOT NULL,
      aqi REAL NOT NULL,
      temperature REAL NOT NULL,
      traffic_delay_ratio REAL NOT NULL,
      rule_score REAL NOT NULL,
      ai_score REAL NOT NULL,
      hybrid_score REAL NOT NULL,
      risk_level TEXT NOT NULL,
      confidence TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbPool.query("CREATE INDEX IF NOT EXISTS worker_location_risk_logs_worker_created_idx ON worker_location_risk_logs(worker_id, created_at DESC);");
  await dbPool.query("CREATE INDEX IF NOT EXISTS worker_location_risk_logs_city_created_idx ON worker_location_risk_logs(city, created_at DESC);");
};

app.use(cors({ origin: true }));
app.use(express.json());

const requireDb = (res) => {
  if (!dbPool) {
    res.status(500).json({ error: "DATABASE_URL is not configured" });
    return false;
  }
  return true;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

const riskSignalCache = new Map();
const RISK_CACHE_TTL_MS = 5 * 60 * 1000;

const kmBetween = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const normalizeCoordinates = ({ latitude, longitude }) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    latitude: Number(lat.toFixed(5)),
    longitude: Number(lon.toFixed(5)),
  };
};

const buildRiskCacheKey = ({ latitude, longitude, destinationLatitude, destinationLongitude }) => {
  const srcLat = Number(latitude).toFixed(3);
  const srcLon = Number(longitude).toFixed(3);
  const destLat = Number(destinationLatitude ?? latitude).toFixed(3);
  const destLon = Number(destinationLongitude ?? longitude).toFixed(3);
  return `${srcLat},${srcLon}:${destLat},${destLon}`;
};

const getFromRiskCache = (key) => {
  const hit = riskSignalCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > RISK_CACHE_TTL_MS) {
    riskSignalCache.delete(key);
    return null;
  }
  return hit.payload;
};

const saveToRiskCache = (key, payload) => {
  riskSignalCache.set(key, {
    createdAt: Date.now(),
    payload,
  });
};

const toNum = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const resolveCityCoordinates = async (city) => {
  const trimmed = String(city || "").trim();
  if (!trimmed) return null;

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`,
  );

  if (!response.ok) return null;

  const data = await response.json();
  const first = data?.results?.[0];
  if (!first) return null;

  return {
    latitude: Number(first.latitude),
    longitude: Number(first.longitude),
    city: String(first.name || trimmed),
  };
};

const resolveCoordinatesToCity = async ({ latitude, longitude }) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const pickCityFromAddress = (address) => {
    if (!address || typeof address !== "object") return null;
    const candidates = [
      address.city,
      address.town,
      address.village,
      address.municipality,
      address.suburb,
      address.county,
      address.district,
      address.state_district,
      address.state,
    ];

    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (value) return value;
    }

    return null;
  };

  const nominatimResponse = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&zoom=18&addressdetails=1`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (nominatimResponse.ok) {
    const nominatimData = await nominatimResponse.json();
    const city = pickCityFromAddress(nominatimData?.address);
    if (city) {
      return {
        city,
        country: String(nominatimData?.address?.country || "").trim() || null,
      };
    }

    const displayName = String(nominatimData?.display_name || "").trim();
    if (displayName) {
      const firstPart = displayName.split(",")[0].trim();
      if (firstPart) {
        return {
          city: firstPart,
          country: String(nominatimData?.address?.country || "").trim() || null,
        };
      }
    }
  }

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&language=en&format=json`,
  );
  if (!response.ok) return null;

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  for (const first of results) {
    const city = String(first?.name || first?.admin1 || first?.country || "").trim();
    if (city) {
      return {
        city,
        country: String(first?.country || "").trim() || null,
      };
    }
  }

  return null;
};

const calculateAiRisk = ({ rainProbability, aqi, temperature, rainMm, trafficDelayRatio = 1, hourOfDay, priorRisk = 0 }) => {
  const rainProbNorm = clamp(toNum(rainProbability) / 100, 0, 1);
  const aqiNorm = clamp(toNum(aqi) / 500, 0, 1);
  const tempNorm = clamp(toNum(temperature) / 50, 0, 1);
  const rainMmNorm = clamp(toNum(rainMm) / 100, 0, 1);
  const trafficNorm = clamp((toNum(trafficDelayRatio, 1) - 1) / 2, 0, 1);
  const peakHour = hourOfDay >= 11 && hourOfDay <= 15 ? 1 : 0;

  // Lightweight logistic model coefficients tuned for delivery disruption likelihood.
  const linear = (
    -1.25
    + 1.45 * rainProbNorm
    + 1.1 * aqiNorm
    + 0.55 * tempNorm
    + 0.85 * rainMmNorm
    + 0.95 * trafficNorm
    + 0.3 * peakHour
    + 0.45 * clamp(toNum(priorRisk), 0, 1)
  );

  const probability = clamp(sigmoid(linear), 0, 1);
  const riskScore = Number(probability.toFixed(2));
  const riskLevel = riskScore > 0.7 ? "HIGH" : riskScore > 0.4 ? "MEDIUM" : "LOW";

  const rainImpact = Number((1.45 * rainProbNorm + 0.85 * rainMmNorm).toFixed(3));
  const airImpact = Number((1.1 * aqiNorm).toFixed(3));
  const heatImpact = Number((0.55 * tempNorm).toFixed(3));
  const trafficImpact = Number((0.95 * trafficNorm).toFixed(3));

  const primaryDriver = rainImpact >= airImpact && rainImpact >= heatImpact && rainImpact >= trafficImpact
    ? "rain"
    : airImpact >= heatImpact && airImpact >= trafficImpact
      ? "air-quality"
      : heatImpact >= trafficImpact
        ? "temperature"
        : "traffic";

  return {
    modelVersion: "risk-lr-v1",
    riskScore,
    riskLevel,
    confidence: riskScore >= 0.75 || riskScore <= 0.25 ? "high" : "medium",
    explanation: {
      primaryDriver,
      rainImpact,
      airImpact,
      heatImpact,
      trafficImpact,
      features: {
        rainProbability: Number(toNum(rainProbability).toFixed(1)),
        rainMm: Number(toNum(rainMm).toFixed(1)),
        aqi: Math.round(toNum(aqi)),
        temperature: Number(toNum(temperature).toFixed(1)),
        trafficDelayRatio: Number(toNum(trafficDelayRatio, 1).toFixed(2)),
        hourOfDay,
      },
    },
  };
};

const getTrafficSignals = async ({ latitude, longitude, destinationLatitude, destinationLongitude }) => {
  const destLat = Number.isFinite(Number(destinationLatitude)) ? Number(destinationLatitude) : latitude + 0.03;
  const destLon = Number.isFinite(Number(destinationLongitude)) ? Number(destinationLongitude) : longitude + 0.03;

  if (!mapboxAccessToken) {
    return {
      provider: "heuristic",
      trafficDelayRatio: 1.15,
      durationMinutes: null,
      baseDurationMinutes: null,
      destination: { latitude: destLat, longitude: destLon },
    };
  }

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${longitude},${latitude};${destLon},${destLat}?alternatives=false&overview=false&annotations=duration,speed&access_token=${encodeURIComponent(mapboxAccessToken)}`;
  const response = await fetch(url);
  if (!response.ok) {
    return {
      provider: "mapbox-fallback",
      trafficDelayRatio: 1.2,
      durationMinutes: null,
      baseDurationMinutes: null,
      destination: { latitude: destLat, longitude: destLon },
    };
  }

  const data = await response.json();
  const route = data?.routes?.[0];
  const durationSec = Number(route?.duration || 0);
  const baseDurationSec = Number(route?.duration_typical || route?.duration || 0);
  const delayRatio = baseDurationSec > 0
    ? clamp(durationSec / baseDurationSec, 1, 3)
    : 1.1;

  return {
    provider: "mapbox",
    trafficDelayRatio: Number(delayRatio.toFixed(2)),
    durationMinutes: Number((durationSec / 60).toFixed(1)),
    baseDurationMinutes: Number((baseDurationSec / 60).toFixed(1)),
    destination: { latitude: destLat, longitude: destLon },
  };
};

const calculateRisk = ({ rainProbability, aqi, temperature }) => {
  const rainFactor = clamp(Number(rainProbability || 0) / 100, 0, 1);
  const aqiFactor = clamp(Number(aqi || 0) / 500, 0, 1);
  const tempFactor = clamp(Number(temperature || 0) / 50, 0, 1);

  const rainContribution = 0.6 * rainFactor;
  const aqiContribution = 0.25 * aqiFactor;
  const tempContribution = 0.15 * tempFactor;

  const riskScore = Number(clamp(rainContribution + aqiContribution + tempContribution, 0, 1).toFixed(2));
  let riskLevel = "LOW";
  if (riskScore > 0.7) riskLevel = "HIGH";
  else if (riskScore > 0.4) riskLevel = "MEDIUM";

  return {
    riskScore,
    riskLevel,
    breakdown: {
      rain: Number(rainContribution.toFixed(3)),
      aqi: Number(aqiContribution.toFixed(3)),
      temp: Number(tempContribution.toFixed(3)),
      rainWeight: 0.6,
      aqiWeight: 0.25,
      tempWeight: 0.15,
    },
  };
};

const generateRiskForecast = (currentData) => {
  const forecast = [];
  let rainProbability = Number(currentData?.rainProbability || 0);
  let aqi = Number(currentData?.aqi || 0);
  const temperature = Number(currentData?.temperature || 0);

  for (let i = 1; i <= 6; i += 1) {
    rainProbability = clamp(rainProbability + (Math.random() * 10 - 5), 0, 100);
    aqi = clamp(aqi + (Math.random() * 20 - 10), 0, 500);

    const result = calculateRisk({ rainProbability, aqi, temperature });
    forecast.push({
      hour: `+${i}h`,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
    });
  }

  return forecast;
};

const calculatePremium = (riskScore) => {
  const score = Number(riskScore || 0);
  if (score > 0.7) return 109;
  if (score > 0.4) return 79;
  return 49;
};

const checkForClaim = ({ rain, activity, aqi, temperature, coverageLimit = 800 }) => {
  const rainValue = Number(rain || 0);
  const aqiValue = Number(aqi || 0);
  const temperatureValue = Number(temperature || 0);
  const activityValue = Number(activity || 0);

  const disruptionDetected = rainValue > 20 || temperatureValue > 40 || aqiValue > 300 || rainValue > 100;

  if (disruptionDetected && activityValue < 30) {
    let reason = "Income disruption detected";
    if (rainValue > 100) reason = "Flood risk disruption";
    else if (rainValue > 20) reason = "Heavy rain disruption";
    else if (temperatureValue > 40) reason = "Heatwave disruption";
    else if (aqiValue > 300) reason = "Pollution disruption";

    return { triggered: true, payout: Number(coverageLimit || 800), reason };
  }

  return { triggered: false };
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizeUserRole = (role) => String(role || "").trim().toLowerCase() === "admin" ? "admin" : "worker";

const createAuthToken = ({ workerId, email, role }) => jwt.sign(
  { workerId, email, role: normalizeUserRole(role) },
  jwtSecret,
  { expiresIn: "7d" },
);

const verifyAuthToken = (token) => {
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
};

const getBearerToken = (authorizationHeader) => {
  const raw = String(authorizationHeader || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  return raw.slice(7).trim() || null;
};

const buildSessionFromWorker = (worker, role = "worker") => {
  const planEndMs = worker?.plan_end_time ? new Date(worker.plan_end_time).getTime() : 0;
  const planActive = Boolean(worker?.active_plan && planEndMs > Date.now());
  const normalizedRole = normalizeUserRole(role);

  return {
    name: worker?.name || "",
    email: normalizeEmail(worker?.email),
    city: worker?.city || "",
    salary: worker?.salary ? Number(worker.salary) : undefined,
    persona_type: worker?.persona_type || "rain",
    deliveryPartner: worker?.delivery_partner || "Zomato",
    phone: "",
    vehicleType: "",
    emergencyContact: "",
    role: normalizedRole,
    policyActive: planActive,
    purchasedPlans: planActive ? [String(worker.active_plan).trim().toLowerCase()] : [],
    preferences: {
      weatherAlerts: true,
      payoutAlerts: true,
      shiftReminders: true,
      marketingEmails: false,
      aiRecommendationMode: "balanced",
      language: "English",
      theme: "dark",
    },
  };
};

const normalizeClaimStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
  return "pending";
};

const serializeClaim = (claimRow) => {
  if (!claimRow) return null;

  return {
    id: claimRow.id,
    userId: claimRow.worker_id,
    triggers: Array.isArray(claimRow.triggers) ? claimRow.triggers : [],
    status: normalizeClaimStatus(claimRow.status),
    amount: Number(claimRow.payout_amount || 0),
    createdAt: claimRow.created_at,
  };
};

const getWorkerIdByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const result = await dbPool.query("SELECT id FROM workers WHERE LOWER(email) = $1 LIMIT 1", [normalizedEmail]);
  return result.rows[0]?.id || null;
};

app.post("/api/auth/register", async (req, res) => {
  if (!requireDb(res)) return;

  const {
    name,
    email,
    password,
    city,
    salary,
    persona_type,
    delivery_partner,
    role,
  } = req.body || {};

  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeUserRole(role);

  if (!name || !normalizedEmail || !password || !city || salary === undefined) {
    return res.status(400).json({ error: "name, email, password, city, and salary are required" });
  }

  if (String(password).trim().length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  if (isNaN(Number(salary)) || Number(salary) <= 0) {
    return res.status(400).json({ error: "Salary must be a positive number" });
  }

  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    const existingAuth = await client.query(
      "SELECT id FROM auth_users WHERE LOWER(email) = $1 LIMIT 1",
      [normalizedEmail],
    );

    if (existingAuth.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This email is already registered. Please log in." });
    }

    const workerResult = await client.query(
      `
      WITH updated AS (
        UPDATE workers
        SET name = $1,
            email = $2,
            city = $3,
            salary = $4,
            persona_type = COALESCE($5, 'rain'),
            delivery_partner = COALESCE($6, 'Zomato')
        WHERE LOWER(email) = $2
        RETURNING id, name, email, city, salary, persona_type, delivery_partner, active_plan, plan_start_time, plan_end_time
      ), inserted AS (
        INSERT INTO workers (name, email, city, salary, persona_type, delivery_partner)
        SELECT $1, $2, $3, $4, COALESCE($5, 'rain'), COALESCE($6, 'Zomato')
        WHERE NOT EXISTS (SELECT 1 FROM updated)
        RETURNING id, name, email, city, salary, persona_type, delivery_partner, active_plan, plan_start_time, plan_end_time
      )
      SELECT * FROM updated
      UNION ALL
      SELECT * FROM inserted
      `,
      [name, normalizedEmail, city, Number(salary), persona_type || "rain", delivery_partner || "Zomato"],
    );

    const worker = workerResult.rows[0];

    const passwordHash = await bcrypt.hash(String(password), 12);
    await client.query(
      `
      INSERT INTO auth_users (worker_id, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      `,
      [worker.id, normalizedEmail, passwordHash, normalizedRole],
    );

    await client.query("COMMIT");

    const session = buildSessionFromWorker(worker, normalizedRole);
    const token = createAuthToken({ workerId: worker.id, email: normalizedEmail, role: normalizedRole });

    return res.json({ session, token });
  } catch {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Unable to register right now." });
  } finally {
    client.release();
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  // FALLBACK TEST USER (for demo/testing when DB is down)
  if (normalizedEmail === "test@smartshift.local" && password === "test123") {
    const session = {
      name: "Test User",
      email: "test@smartshift.local",
      city: "Mumbai",
      persona_type: "normal",
      deliveryPartner: "Zomato",
      phone: "9876543210",
      vehicleType: "2-Wheeler",
      emergencyContact: "9876543211",
      role: "worker",
      policyActive: true,
      purchasedPlans: ["day-shield"],
      preferences: {
        weatherAlerts: true,
        payoutAlerts: true,
        shiftReminders: true,
        marketingEmails: false,
        aiRecommendationMode: "balanced",
        language: "English",
        theme: "dark",
      },
      salary: 25000,
    };
    const token = jwt.sign({ workerId: 1, email: normalizedEmail, role: "worker" }, jwtSecret, { expiresIn: "24h" });
    return res.json({ session, token });
  }

  if (!requireDb(res)) return;

  try {
    const result = await dbPool.query(
      `
      SELECT
        w.id,
        w.name,
        w.email,
        w.city,
        w.salary,
        w.persona_type,
        w.delivery_partner,
        w.active_plan,
        w.plan_start_time,
        w.plan_end_time,
        a.password_hash,
        a.role
      FROM auth_users a
      JOIN workers w ON w.id = a.worker_id
      WHERE LOWER(a.email) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    const row = result.rows[0];
    if (!row) {
      const legacyWorker = await dbPool.query(
        "SELECT id FROM workers WHERE LOWER(email) = $1 LIMIT 1",
        [normalizedEmail],
      );

      if (legacyWorker.rows[0]) {
        return res.status(404).json({
          error: "Your account exists but needs a one-time password setup. Please sign up once with the same email.",
        });
      }

      return res.status(404).json({ error: "Account not found. Please sign up first." });
    }

    const passwordValid = await bcrypt.compare(String(password), String(row.password_hash || ""));
    if (!passwordValid) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    const role = normalizeUserRole(row.role);
    const session = buildSessionFromWorker(row, role);
    const token = createAuthToken({ workerId: row.id, email: normalizedEmail, role });

    return res.json({ session, token });
  } catch {
    return res.status(500).json({ error: "Unable to login." });
  }
});

app.get("/api/auth/me", async (req, res) => {
  if (!requireDb(res)) return;

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Authorization token missing" });
  }

  const decoded = verifyAuthToken(token);
  if (!decoded || typeof decoded !== "object") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const workerId = Number(decoded.workerId);
  const role = normalizeUserRole(decoded.role);

  if (!workerId) {
    return res.status(401).json({ error: "Invalid token payload" });
  }

  try {
    const workerResult = await dbPool.query(
      `SELECT id, name, email, city, salary, persona_type, delivery_partner, active_plan, plan_start_time, plan_end_time
       FROM workers
       WHERE id = $1
       LIMIT 1`,
      [workerId],
    );

    const worker = workerResult.rows[0];
    if (!worker) {
      return res.status(404).json({ error: "User not found" });
    }

    const session = buildSessionFromWorker(worker, role);
    return res.json({ session });
  } catch {
    return res.status(500).json({ error: "Failed to validate session" });
  }
});

const getWorkerPortalState = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const workerResult = await dbPool.query(
    `SELECT id, name, email, city, persona_type, delivery_partner, active_plan, plan_start_time, plan_end_time, created_at
     FROM workers
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail],
  );

  const worker = workerResult.rows[0] || null;
  if (!worker) {
    return { worker: null, activePolicy: null, recentClaims: [] };
  }

  const policyResult = await dbPool.query(
    `SELECT *
     FROM insurance_policies
     WHERE worker_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [worker.id],
  );

  const claimsResult = await dbPool.query(
    `SELECT *
     FROM claims
     WHERE worker_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [worker.id],
  );

  return {
    worker,
    activePolicy: policyResult.rows[0] || null,
    wallet: null,
    walletBalance: 0,
    latestClaim: null,
    recentClaims: claimsResult.rows,
  };
};

const getWalletForWorker = async (workerId) => {
  const result = await dbPool.query(
    `
    INSERT INTO wallets (worker_id, balance)
    VALUES ($1, 0)
    ON CONFLICT (worker_id) DO UPDATE SET updated_at = NOW()
    RETURNING *
    `,
    [workerId],
  );

  return result.rows[0] || null;
};

const getLatestClaimForWorker = async (workerId) => {
  const result = await dbPool.query(
    `SELECT *
     FROM claims
     WHERE worker_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [workerId],
  );

  return result.rows[0] || null;
};

const getUserPolicyBundle = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const workerResult = await dbPool.query(
    `SELECT id, name, email, city, persona_type, delivery_partner, active_plan, plan_start_time, plan_end_time, created_at
     FROM workers
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail],
  );

  const worker = workerResult.rows[0] || null;
  if (!worker) {
    return { worker: null, activePolicy: null, wallet: null, walletBalance: 0, latestClaim: null, recentClaims: [] };
  }

  const [activePolicy, wallet, latestClaim, recentClaims] = await Promise.all([
    dbPool.query(
      `SELECT *
       FROM insurance_policies
       WHERE worker_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [worker.id],
    ).then((result) => result.rows[0] || null),
    getWalletForWorker(worker.id),
    getLatestClaimForWorker(worker.id),
    dbPool.query(
      `SELECT *
       FROM claims
       WHERE worker_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [worker.id],
    ).then((result) => result.rows),
  ]);

  return {
    worker,
    activePolicy,
    wallet,
    walletBalance: Number(wallet?.balance || 0),
    latestClaim,
    recentClaims,
  };
};

const getUserProfile = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const workerResult = await dbPool.query(
    `SELECT id, name, email, city, persona_type, delivery_partner, active_plan, plan_start_time, plan_end_time, created_at
     FROM workers
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail],
  );

  const worker = workerResult.rows[0] || null;
  if (!worker) return null;

  const now = Date.now();
  const planEndTimeMs = worker.plan_end_time ? new Date(worker.plan_end_time).getTime() : 0;
  const planActive = Boolean(worker.active_plan && planEndTimeMs > now);

  return {
    id: worker.id,
    email: worker.email,
    active_plan: planActive ? worker.active_plan : null,
    plan_start_time: planActive ? worker.plan_start_time : null,
    plan_end_time: planActive ? worker.plan_end_time : null,
  };
};

const createClaimRecord = async ({ workerEmail, workerId, triggers, amount, status, triggerType, autoGenerated, reviewer, reviewReason }) => {
  const resolvedWorkerId = workerId || await getWorkerIdByEmail(workerEmail);
  if (!resolvedWorkerId) return { error: "Worker not found", status: 404 };
  const normalizedStatus = normalizeClaimStatus(status);

  const result = await dbPool.query(
    `
    INSERT INTO claims (worker_id, trigger_type, triggers, payout_amount, status, auto_generated, reviewer, review_reason, reviewed_at)
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE), $7, $8, CASE WHEN $5 IN ('approved', 'Approved', 'rejected', 'Rejected') THEN NOW() ELSE NULL END)
    RETURNING *
    `,
    [
      resolvedWorkerId,
      triggerType || (Array.isArray(triggers) && triggers[0] ? String(triggers[0]) : "manual"),
      Array.isArray(triggers) ? triggers : [],
      amount,
      normalizedStatus,
      autoGenerated,
      reviewer || null,
      reviewReason || null,
    ],
  );

  return { claim: result.rows[0] };
};

const creditWallet = async ({ workerEmail, amount, claimId }) => {
  const workerId = await getWorkerIdByEmail(workerEmail);
  if (!workerId) return { error: "Worker not found for given email", status: 404 };

  const result = await dbPool.query(
    `
    INSERT INTO wallets (worker_id, balance)
    VALUES ($1, $2)
    ON CONFLICT (worker_id) DO UPDATE SET
      balance = wallets.balance + EXCLUDED.balance,
      updated_at = NOW()
    RETURNING *
    `,
    [workerId, amount],
  );

  if (claimId) {
    await dbPool.query(
      `UPDATE claims
       SET status = 'approved', reviewed_at = NOW()
       WHERE id = $1 AND worker_id = $2`,
      [claimId, workerId],
    );
  }

  return { wallet: result.rows[0] };
};

app.get("/api/db/workers/portal", async (req, res) => {
  if (!requireDb(res)) return;

  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const portalState = await getUserPolicyBundle(email);
    return res.json(portalState);
  } catch {
    return res.status(500).json({ error: "Failed to fetch worker portal state" });
  }
});

app.get("/api/user/policy", async (req, res) => {
  if (!requireDb(res)) return;

  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const bundle = await getUserPolicyBundle(email);
    return res.json(bundle);
  } catch {
    return res.status(500).json({ error: "Failed to fetch user policy" });
  }
});

app.get("/api/user/profile", async (req, res) => {
  if (!requireDb(res)) return;

  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const profile = await getUserProfile(email);
    if (!profile) {
      return res.status(404).json({ error: "Worker not found" });
    }

    return res.json(profile);
  } catch {
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

app.get("/api/claim/latest", async (req, res) => {
  if (!requireDb(res)) return;

  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const workerId = await getWorkerIdByEmail(email);
    if (!workerId) return res.status(404).json({ error: "Worker not found for given email" });

    const claim = await getLatestClaimForWorker(workerId);
    return res.json({ claim: serializeClaim(claim) });
  } catch {
    return res.status(500).json({ error: "Failed to fetch latest claim" });
  }
});

app.get("/api/claims/latest", async (req, res) => {
  if (!requireDb(res)) return;

  const userId = Number(req.query.userId);
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const claim = await getLatestClaimForWorker(userId);
    return res.json({ claim: serializeClaim(claim) });
  } catch {
    return res.status(500).json({ error: "Failed to fetch latest claim" });
  }
});

app.post("/api/risk/insights", (req, res) => {
  const { rainProbability, aqi, temperature, rain, activity, coverageLimit } = req.body || {};
  const risk = calculateRisk({ rainProbability, aqi, temperature });
  const forecast = generateRiskForecast({ rainProbability, aqi, temperature });
  const premium = calculatePremium(risk.riskScore);
  const claim = checkForClaim({ rain, activity, aqi, temperature, coverageLimit });

  return res.json({
    risk,
    premium,
    forecast,
    claim,
  });
});

app.post("/api/ai/risk/assess", async (req, res) => {
  const city = String(req.body?.city || "").trim();
  const normalizedSourceCoords = normalizeCoordinates({
    latitude: req.body?.lat,
    longitude: req.body?.lon,
  });
  const normalizedDestCoords = normalizeCoordinates({
    latitude: req.body?.destinationLat,
    longitude: req.body?.destinationLon,
  });
  const workerEmail = normalizeEmail(req.body?.workerEmail || "");

  if (!city && !normalizedSourceCoords) {
    return res.status(400).json({ error: "Either city or lat/lon is required" });
  }

  try {
    const cityResolved = city ? await resolveCityCoordinates(city) : null;
    const reverseResolved = normalizedSourceCoords
      ? await resolveCoordinatesToCity({
        latitude: normalizedSourceCoords.latitude,
        longitude: normalizedSourceCoords.longitude,
      }).catch(() => null)
      : null;
    const coordinates = normalizedSourceCoords || cityResolved;

    if (!coordinates) {
      return res.status(404).json({ error: "Unable to resolve location" });
    }

    const destination = normalizedDestCoords
      || cityResolved
      || { latitude: Number(coordinates.latitude) + 0.03, longitude: Number(coordinates.longitude) + 0.03 };

    const cacheKey = buildRiskCacheKey({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      destinationLatitude: destination.latitude,
      destinationLongitude: destination.longitude,
    });

    const cached = getFromRiskCache(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        cache: { hit: true, ttlSeconds: Math.floor(RISK_CACHE_TTL_MS / 1000) },
      });
    }

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=temperature_2m,precipitation,rain,precipitation_probability&hourly=temperature_2m,precipitation_probability,rain&timezone=auto&forecast_days=1`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=us_aqi&hourly=us_aqi&timezone=auto&forecast_days=1`;

    const [weatherRes, airRes, trafficSignals] = await Promise.all([
      fetch(weatherUrl),
      fetch(airUrl),
      getTrafficSignals({
        latitude: Number(coordinates.latitude),
        longitude: Number(coordinates.longitude),
        destinationLatitude: Number(destination.latitude),
        destinationLongitude: Number(destination.longitude),
      }),
    ]);

    if (!weatherRes.ok || !airRes.ok) {
      return res.status(502).json({ error: "Failed to fetch external weather sources" });
    }

    const weatherData = await weatherRes.json();
    const airData = await airRes.json();

    const currentTemp = toNum(weatherData?.current?.temperature_2m, 0);
    const currentRainMm = toNum(weatherData?.current?.rain ?? weatherData?.current?.precipitation, 0);
    const currentRainProbability = toNum(
      weatherData?.current?.precipitation_probability
      ?? weatherData?.hourly?.precipitation_probability?.[0],
      0,
    );
    const currentAqi = toNum(airData?.current?.us_aqi, 100);
    const currentTrafficDelay = toNum(trafficSignals?.trafficDelayRatio, 1.1);
    const nowHour = new Date().getHours();

    const ruleRisk = calculateRisk({
      rainProbability: currentRainProbability,
      aqi: currentAqi,
      temperature: currentTemp,
    });

    const aiRisk = calculateAiRisk({
      rainProbability: currentRainProbability,
      aqi: currentAqi,
      temperature: currentTemp,
      rainMm: currentRainMm,
      trafficDelayRatio: currentTrafficDelay,
      hourOfDay: nowHour,
      priorRisk: 0,
    });

    const hybridRiskScore = Number(clamp(0.6 * aiRisk.riskScore + 0.4 * ruleRisk.riskScore, 0, 1).toFixed(2));
    const hybridRiskLevel = hybridRiskScore > 0.7 ? "HIGH" : hybridRiskScore > 0.4 ? "MEDIUM" : "LOW";
    const scoreSpread = Math.abs(aiRisk.riskScore - ruleRisk.riskScore);
    const dataCompleteness = [currentRainProbability, currentAqi, currentTemp, currentTrafficDelay]
      .filter((value) => Number.isFinite(value)).length / 4;
    const hybridConfidence = scoreSpread < 0.15 && dataCompleteness >= 0.75 ? "high" : "medium";

    const hourlyTimes = Array.isArray(weatherData?.hourly?.time) ? weatherData.hourly.time : [];
    const hourlyTemps = Array.isArray(weatherData?.hourly?.temperature_2m) ? weatherData.hourly.temperature_2m : [];
    const hourlyProb = Array.isArray(weatherData?.hourly?.precipitation_probability) ? weatherData.hourly.precipitation_probability : [];
    const hourlyRain = Array.isArray(weatherData?.hourly?.rain) ? weatherData.hourly.rain : [];
    const hourlyAqi = Array.isArray(airData?.hourly?.us_aqi) ? airData.hourly.us_aqi : [];

    const trend = [];
    let priorRisk = hybridRiskScore;
    for (let i = 0; i < hourlyTimes.length; i += 1) {
      const dt = new Date(hourlyTimes[i]);
      const hour = dt.getHours();
      if (hour < 6 || hour > 20 || hour % 2 !== 0) continue;

      const aiPoint = calculateAiRisk({
        rainProbability: toNum(hourlyProb[i], currentRainProbability),
        aqi: toNum(hourlyAqi[i], currentAqi),
        temperature: toNum(hourlyTemps[i], currentTemp),
        rainMm: toNum(hourlyRain[i], 0),
        trafficDelayRatio: currentTrafficDelay,
        hourOfDay: hour,
        priorRisk,
      });
      const rulePoint = calculateRisk({
        rainProbability: toNum(hourlyProb[i], currentRainProbability),
        aqi: toNum(hourlyAqi[i], currentAqi),
        temperature: toNum(hourlyTemps[i], currentTemp),
      });

      const pointScore = Number(clamp(0.6 * aiPoint.riskScore + 0.4 * rulePoint.riskScore, 0, 1).toFixed(2));
      priorRisk = pointScore;

      trend.push({
        hour,
        label: `${((hour + 11) % 12) + 1}${hour >= 12 ? "PM" : "AM"}`,
        riskScore: pointScore,
        riskLevel: pointScore > 0.7 ? "HIGH" : pointScore > 0.4 ? "MEDIUM" : "LOW",
      });
    }

    const responsePayload = {
      source: "hybrid-external",
      city: reverseResolved?.city || cityResolved?.city || city || "Unknown Area",
      locationContext: {
        country: reverseResolved?.country || null,
      },
      coordinates: {
        latitude: Number(Number(coordinates.latitude).toFixed(4)),
        longitude: Number(Number(coordinates.longitude).toFixed(4)),
      },
      destination: {
        latitude: Number(Number(destination.latitude).toFixed(4)),
        longitude: Number(Number(destination.longitude).toFixed(4)),
      },
      signals: {
        weatherProvider: "open-meteo",
        airProvider: "open-meteo-air",
        trafficProvider: trafficSignals.provider,
        trafficDelayRatio: Number(currentTrafficDelay.toFixed(2)),
        routeDurationMinutes: trafficSignals.durationMinutes,
      },
      current: {
        temperature: Number(currentTemp.toFixed(1)),
        rainMm: Number(currentRainMm.toFixed(1)),
        rainProbability: Number(currentRainProbability.toFixed(1)),
        aqi: Math.round(currentAqi),
        ruleRisk,
        aiRisk,
        risk: {
          modelVersion: "risk-hybrid-v2",
          riskScore: hybridRiskScore,
          riskLevel: hybridRiskLevel,
          confidence: hybridConfidence,
          explanation: {
            primaryDriver: aiRisk.explanation.primaryDriver,
            rainImpact: aiRisk.explanation.rainImpact,
            airImpact: aiRisk.explanation.airImpact,
            heatImpact: aiRisk.explanation.heatImpact,
            trafficImpact: aiRisk.explanation.trafficImpact,
            features: aiRisk.explanation.features,
            blend: {
              aiWeight: 0.6,
              ruleWeight: 0.4,
              aiScore: aiRisk.riskScore,
              ruleScore: ruleRisk.riskScore,
            },
          },
        },
      },
      trend,
      generatedAt: new Date().toISOString(),
    };

    saveToRiskCache(cacheKey, responsePayload);

    if (dbPool && workerEmail) {
      const workerId = await getWorkerIdByEmail(workerEmail);
      await dbPool.query(
        `
        INSERT INTO worker_location_risk_logs (
          worker_id,
          city,
          latitude,
          longitude,
          destination_latitude,
          destination_longitude,
          rain_probability,
          rain_mm,
          aqi,
          temperature,
          traffic_delay_ratio,
          rule_score,
          ai_score,
          hybrid_score,
          risk_level,
          confidence,
          source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `,
        [
          workerId,
          responsePayload.city,
          responsePayload.coordinates.latitude,
          responsePayload.coordinates.longitude,
          responsePayload.destination.latitude,
          responsePayload.destination.longitude,
          responsePayload.current.rainProbability,
          responsePayload.current.rainMm,
          responsePayload.current.aqi,
          responsePayload.current.temperature,
          responsePayload.signals.trafficDelayRatio,
          responsePayload.current.ruleRisk.riskScore,
          responsePayload.current.aiRisk.riskScore,
          responsePayload.current.risk.riskScore,
          responsePayload.current.risk.riskLevel,
          responsePayload.current.risk.confidence,
          responsePayload.source,
        ],
      ).catch(() => {
        // Keep inference non-blocking if logging fails.
      });
    }

    return res.json({
      ...responsePayload,
      cache: { hit: false, ttlSeconds: Math.floor(RISK_CACHE_TTL_MS / 1000) },
    });
  } catch {
    return res.status(500).json({ error: "Failed to run AI risk assessment" });
  }
});

// AI Risk Narrative — handles Claude API calls securely on backend
app.post("/api/ai/risk/narrative", async (req, res) => {
  try {
    const { factors, riskResult, workerCity, deliveryPlatform } = req.body || {};
    const claudeKey = process.env.CLAUDE_API_KEY;

    if (!claudeKey) {
      return res.json({ narrative: riskResult?.recommendation || "Unable to generate narrative" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `You are a risk advisor for gig delivery workers in India. 
Analyze this worker's situation and give a 2-sentence plain-English explanation of their risk today.
Be specific and actionable. Use simple language.

Worker: ${deliveryPlatform} rider in ${workerCity}
Current conditions:
- Rain: ${factors?.rainMm || 0}mm/hr
- AQI: ${factors?.aqiIndex || 100}
- Temperature: ${factors?.tempCelsius || 25}°C  
- Traffic delay: ${factors?.trafficDelayPercent || 0}%
- Time: ${factors?.hour || 12}:00

Risk score: ${riskResult?.score || 0.5} (${riskResult?.level || "MEDIUM"})
Top risk factor: ${riskResult?.explanation?.[0]?.factor || "Weather"}

Give only the 2-sentence explanation, nothing else.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return res.json({ narrative: riskResult?.recommendation || "Unable to generate narrative" });
    }

    const data = await response.json();
    const narrative = data.content?.[0]?.text || riskResult?.recommendation || "Risk assessment generated";

    return res.json({ narrative });
  } catch (error) {
    console.error("Claude narrative error:", error);
    return res.json({ narrative: "Unable to generate narrative at this time" });
  }
});

// Risk Forecast — returns hourly forecast for the next 8 hours
app.post("/api/ai/risk/forecast", async (req, res) => {
  try {
    const { city } = req.body || {};

    if (!city) {
      return res.status(400).json({ error: "City required" });
    }

    const owmKey = process.env.OPENWEATHER_KEY;

    if (!owmKey) {
      // Return default forecast if no API key
      return res.json({
        forecast: Array.from({ length: 8 }, (_, i) => ({
          hour: (new Date().getHours() + i * 3) % 24,
          rainMm: 0,
          tempCelsius: 28,
          aqiIndex: 75,
        })),
      });
    }

    // Fetch forecast from OpenWeatherMap
    const res2 = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},IN&units=metric&cnt=8&appid=${owmKey}`
    );

    if (!res2.ok) {
      return res.json({
        forecast: Array.from({ length: 8 }, (_, i) => ({
          hour: (new Date().getHours() + i * 3) % 24,
          rainMm: 0,
          tempCelsius: 28,
          aqiIndex: 75,
        })),
      });
    }

    const data = await res2.json();
    const forecast = data.list.map((item) => ({
      hour: new Date(item.dt * 1000).getHours(),
      rainMm: item.rain?.["3h"] ? item.rain["3h"] / 3 : 0,
      tempCelsius: Math.round(item.main.temp),
      aqiIndex: 75, // AQI forecast needs premium API
    }));

    return res.json({ forecast });
  } catch (error) {
    console.error("Forecast error:", error);
    return res.json({
      forecast: Array.from({ length: 8 }, (_, i) => ({
        hour: (new Date().getHours() + i * 3) % 24,
        rainMm: 0,
        tempCelsius: 28,
        aqiIndex: 75,
      })),
    });
  }
});

app.post("/api/db/workers/upsert", async (req, res) => {
  if (!requireDb(res)) return;

  const { name, email, city, persona_type, delivery_partner } = req.body || {};
  const normalizedEmail = normalizeEmail(email);

  if (!name || !normalizedEmail || !city) {
    return res.status(400).json({ error: "name, email, and city are required" });
  }

  try {
    const result = await dbPool.query(
      `
      WITH updated AS (
        UPDATE workers
        SET name = $1,
            email = $2,
            city = $3,
            persona_type = COALESCE($4, 'rain'),
            delivery_partner = COALESCE($5, 'Zomato')
        WHERE LOWER(email) = $2
        RETURNING id, name, email, city, persona_type, delivery_partner, created_at
      ), inserted AS (
        INSERT INTO workers (name, email, city, persona_type, delivery_partner)
        SELECT $1, $2, $3, COALESCE($4, 'rain'), COALESCE($5, 'Zomato')
        WHERE NOT EXISTS (SELECT 1 FROM updated)
        RETURNING id, name, email, city, persona_type, delivery_partner, created_at
      )
      SELECT * FROM updated
      UNION ALL
      SELECT * FROM inserted
      `,
      [name, normalizedEmail, city, persona_type || "rain", delivery_partner || "Zomato"],
    );

    return res.json({ worker: result.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to upsert worker" });
  }
});

app.post("/api/db/risk-data", async (req, res) => {
  if (!requireDb(res)) return;

  const { city, rain_probability, aqi, temperature, risk_score, risk_level } = req.body || {};
  if ([city, rain_probability, aqi, temperature, risk_score, risk_level].some((item) => item === undefined || item === null || item === "")) {
    return res.status(400).json({ error: "city, rain_probability, aqi, temperature, risk_score, and risk_level are required" });
  }

  try {
    const result = await dbPool.query(
      `
      INSERT INTO risk_data (city, rain_probability, aqi, temperature, risk_score, risk_level)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [city, rain_probability, aqi, temperature, risk_score, risk_level],
    );
    return res.json({ riskData: result.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to store risk data" });
  }
});

app.post("/api/db/location-risk", async (req, res) => {
  if (!requireDb(res)) return;

  const {
    worker_email,
    city,
    latitude,
    longitude,
    destination_latitude,
    destination_longitude,
    rain_probability,
    rain_mm,
    aqi,
    temperature,
    traffic_delay_ratio,
    rule_score,
    ai_score,
    hybrid_score,
    risk_level,
    confidence,
    source,
  } = req.body || {};

  if (
    latitude === undefined || longitude === undefined
    || rain_probability === undefined || rain_mm === undefined
    || aqi === undefined || temperature === undefined
    || traffic_delay_ratio === undefined
    || rule_score === undefined || ai_score === undefined || hybrid_score === undefined
    || !risk_level || !confidence
  ) {
    return res.status(400).json({ error: "Missing required location risk fields" });
  }

  try {
    const workerId = worker_email ? await getWorkerIdByEmail(worker_email) : null;

    const result = await dbPool.query(
      `
      INSERT INTO worker_location_risk_logs (
        worker_id,
        city,
        latitude,
        longitude,
        destination_latitude,
        destination_longitude,
        rain_probability,
        rain_mm,
        aqi,
        temperature,
        traffic_delay_ratio,
        rule_score,
        ai_score,
        hybrid_score,
        risk_level,
        confidence,
        source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
      `,
      [
        workerId,
        city || null,
        latitude,
        longitude,
        destination_latitude || null,
        destination_longitude || null,
        rain_probability,
        rain_mm,
        aqi,
        temperature,
        traffic_delay_ratio,
        rule_score,
        ai_score,
        hybrid_score,
        risk_level,
        confidence,
        source || "frontend-live",
      ],
    );

    return res.json({ locationRisk: result.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to store location risk data" });
  }
});

app.post("/api/db/policies", async (req, res) => {
  if (!requireDb(res)) return;

  const { worker_email, plan_id, weekly_premium, risk_level, coverage_amount, status } = req.body || {};
  if (!worker_email || !plan_id || weekly_premium === undefined || !risk_level || coverage_amount === undefined || !status) {
    return res.status(400).json({ error: "worker_email, plan_id, weekly_premium, risk_level, coverage_amount, and status are required" });
  }

  try {
    const workerId = await getWorkerIdByEmail(worker_email);
    if (!workerId) return res.status(404).json({ error: "Worker not found for given email" });

    if (String(status).toLowerCase() === "active") {
      await dbPool.query("UPDATE insurance_policies SET status = 'inactive' WHERE worker_id = $1 AND status = 'active'", [workerId]);
      await dbPool.query(
        `
        UPDATE workers
        SET active_plan = $1,
            plan_start_time = NOW(),
            plan_end_time = NOW() + interval '12 hours'
        WHERE id = $2
        `,
        [plan_id, workerId],
      );
    } else {
      await dbPool.query(
        `
        UPDATE workers
        SET active_plan = NULL,
            plan_start_time = NULL,
            plan_end_time = NULL
        WHERE id = $1
        `,
        [workerId],
      );
    }

    const result = await dbPool.query(
      `
      INSERT INTO insurance_policies (worker_id, plan_id, weekly_premium, risk_level, coverage_amount, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [workerId, plan_id, weekly_premium, risk_level, coverage_amount, status],
    );
    return res.json({ policy: result.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to create insurance policy" });
  }
});

app.post("/api/claim", async (req, res) => {
  if (!requireDb(res)) return;

  const { worker_email, triggers, amount, status, trigger_type, auto_generated, reviewer, review_reason } = req.body || {};
  if (!worker_email || amount === undefined || !status) {
    return res.status(400).json({ error: "worker_email, amount, and status are required" });
  }

  try {
    const result = await createClaimRecord({
      workerEmail: worker_email,
      triggers: Array.isArray(triggers) ? triggers : trigger_type ? [trigger_type] : [],
      amount,
      status,
      triggerType: trigger_type,
      autoGenerated,
      reviewer,
      reviewReason: review_reason,
    });

    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Failed to create claim" });
  }
});

app.post("/api/claims/create", async (req, res) => {
  if (!requireDb(res)) return;

  const { userId, triggers, amount } = req.body || {};
  if (!userId || amount === undefined) {
    return res.status(400).json({ error: "userId and amount are required" });
  }

  try {
    const result = await createClaimRecord({
      workerId: Number(userId),
      triggers: Array.isArray(triggers) ? triggers : [],
      amount: Number(amount),
      status: "pending",
      triggerType: Array.isArray(triggers) && triggers[0] ? String(triggers[0]) : "manual",
      autoGenerated: true,
      reviewer: null,
      reviewReason: null,
    });

    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    return res.json({ claim: serializeClaim(result.claim) });
  } catch {
    return res.status(500).json({ error: "Failed to create claim" });
  }
});

app.post("/api/claims/:id/approve", async (req, res) => {
  if (!requireDb(res)) return;

  const claimId = Number(req.params.id);
  if (!claimId) {
    return res.status(400).json({ error: "valid claim id is required" });
  }

  try {
    const claimResult = await dbPool.query("SELECT * FROM claims WHERE id = $1 LIMIT 1", [claimId]);
    const claim = claimResult.rows[0];
    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    const currentStatus = normalizeClaimStatus(claim.status);
    if (currentStatus === "approved") {
      const wallet = await getWalletForWorker(claim.worker_id);
      return res.json({ claim: serializeClaim(claim), walletBalance: Number(wallet?.balance || 0) });
    }

    if (currentStatus === "rejected") {
      return res.status(409).json({ error: "Cannot approve a rejected claim" });
    }

    const walletResult = await dbPool.query(
      `
      INSERT INTO wallets (worker_id, balance)
      VALUES ($1, $2)
      ON CONFLICT (worker_id) DO UPDATE SET
        balance = wallets.balance + EXCLUDED.balance,
        updated_at = NOW()
      RETURNING *
      `,
      [claim.worker_id, Number(claim.payout_amount || 0)],
    );

    const updatedClaimResult = await dbPool.query(
      `
      UPDATE claims
      SET status = 'approved', reviewed_at = NOW(), reviewer = COALESCE(reviewer, 'system')
      WHERE id = $1
      RETURNING *
      `,
      [claimId],
    );

    return res.json({
      claim: serializeClaim(updatedClaimResult.rows[0]),
      walletBalance: Number(walletResult.rows[0]?.balance || 0),
    });
  } catch {
    return res.status(500).json({ error: "Failed to approve claim" });
  }
});

app.post("/api/claims/:id/reject", async (req, res) => {
  if (!requireDb(res)) return;

  const claimId = Number(req.params.id);
  if (!claimId) {
    return res.status(400).json({ error: "valid claim id is required" });
  }

  try {
    const claimResult = await dbPool.query("SELECT * FROM claims WHERE id = $1 LIMIT 1", [claimId]);
    const claim = claimResult.rows[0];
    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    const currentStatus = normalizeClaimStatus(claim.status);
    if (currentStatus === "approved") {
      return res.status(409).json({ error: "Cannot reject an approved claim" });
    }

    const updatedClaimResult = await dbPool.query(
      `
      UPDATE claims
      SET status = 'rejected', reviewed_at = NOW(), reviewer = COALESCE(reviewer, 'system')
      WHERE id = $1
      RETURNING *
      `,
      [claimId],
    );

    return res.json({ claim: serializeClaim(updatedClaimResult.rows[0]) });
  } catch {
    return res.status(500).json({ error: "Failed to reject claim" });
  }
});

app.post("/api/wallet/credit", async (req, res) => {
  if (!requireDb(res)) return;

  const { worker_email, amount, claim_id } = req.body || {};
  if (!worker_email || amount === undefined) {
    return res.status(400).json({ error: "worker_email and amount are required" });
  }

  try {
    const result = await creditWallet({
      workerEmail: worker_email,
      amount: Number(amount),
      claimId: claim_id ? Number(claim_id) : null,
    });

    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Failed to credit wallet" });
  }
});

app.post("/api/db/claims", async (req, res) => {
  if (!requireDb(res)) return;

  const { worker_email, trigger_type, payout_amount, status, auto_generated, reviewer, review_reason, triggers } = req.body || {};
  if (!worker_email || payout_amount === undefined || !status) {
    return res.status(400).json({ error: "worker_email, payout_amount, and status are required" });
  }

  try {
    const result = await createClaimRecord({
      workerEmail: worker_email,
      triggers: Array.isArray(triggers) ? triggers : trigger_type ? [trigger_type] : [],
      amount: payout_amount,
      status,
      triggerType: trigger_type,
      autoGenerated: auto_generated,
      reviewer,
      reviewReason: review_reason,
    });

    if (result.error) {
      return res.status(result.status || 500).json({ error: result.error });
    }

    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Failed to create claim" });
  }
});

app.patch("/api/db/claims/:claimId/review", async (req, res) => {
  if (!requireDb(res)) return;

  const claimId = Number(req.params.claimId);
  const { status, reviewer, review_reason } = req.body || {};
  if (!claimId || !status) {
    return res.status(400).json({ error: "claimId and status are required" });
  }

  try {
    const result = await dbPool.query(
      `
      UPDATE claims
      SET status = $2,
          reviewer = $3,
          review_reason = $4,
          reviewed_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [claimId, status, reviewer || null, review_reason || null],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Claim not found" });
    }

    return res.json({ claim: result.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to update claim review" });
  }
});

app.post("/api/db/fraud-alerts", async (req, res) => {
  if (!requireDb(res)) return;

  const { worker_email, reason, flag_level, resolved } = req.body || {};
  if (!worker_email || !reason || !flag_level) {
    return res.status(400).json({ error: "worker_email, reason, and flag_level are required" });
  }

  try {
    const workerId = await getWorkerIdByEmail(worker_email);
    if (!workerId) return res.status(404).json({ error: "Worker not found for given email" });

    const result = await dbPool.query(
      `
      INSERT INTO fraud_alerts (worker_id, reason, flag_level, resolved)
      VALUES ($1, $2, $3, COALESCE($4, FALSE))
      RETURNING *
      `,
      [workerId, reason, flag_level, resolved],
    );
    return res.json({ fraudAlert: result.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to create fraud alert" });
  }
});

app.post("/api/payment/create-order", async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const amountInPaise = Math.round(amount * 100);
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `smartshift_${Date.now()}`,
    });

    return res.json(order);
  } catch {
    return res.status(500).json({ error: "Failed to create payment order" });
  }
});

app.post("/api/payment/verify", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: "Missing payment verification fields" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const verified = expectedSignature === razorpay_signature;

  if (!verified) {
    return res.status(400).json({ verified: false, error: "Signature mismatch" });
  }

  return res.json({ verified: true });
});

app.get("/api/payment/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/admin/stats", async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const [workers, policies, claims, fraud] = await Promise.all([
      dbPool.query("SELECT COUNT(*) FROM workers"),
      dbPool.query("SELECT COUNT(*) FROM insurance_policies WHERE status='active'"),
      dbPool.query("SELECT status, SUM(payout_amount) as total, COUNT(*) as count FROM claims GROUP BY status"),
      dbPool.query("SELECT COUNT(*) FROM fraud_alerts WHERE resolved=false"),
    ]);

    const claimRows = claims.rows;
    const approved = claimRows.find((r) => r.status === "approved");
    const pending = claimRows.find((r) => r.status === "pending");
    const rejected = claimRows.find((r) => r.status === "rejected");
    const totalPayouts = Number(approved?.total || 0);
    const activePoliciesCount = Number(policies.rows[0]?.count || 0);
    const totalPremiums = activePoliciesCount * 22 * 4;
    const lossRatio = totalPremiums > 0 ? Math.round((totalPayouts / totalPremiums) * 100) : 0;

    return res.json({
      totalWorkers: Number(workers.rows[0]?.count || 0),
      activePolicies: activePoliciesCount,
      totalClaims: claimRows.reduce((s, r) => s + Number(r.count), 0),
      pendingClaims: Number(pending?.count || 0),
      approvedClaims: Number(approved?.count || 0),
      rejectedClaims: Number(rejected?.count || 0),
      fraudCases: Number(fraud.rows[0]?.count || 0),
      totalPayouts,
      lossRatio,
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.get("/api/admin/claims", async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const result = await dbPool.query("SELECT * FROM claims ORDER BY created_at DESC LIMIT 20");
    return res.json({ claims: result.rows });
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

app.get("/api/admin/fraud-alerts", async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const result = await dbPool.query("SELECT * FROM fraud_alerts ORDER BY created_at DESC LIMIT 10");
    return res.json({ alerts: result.rows });
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

app.get("/api/admin/high-risk-zones", async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const result = await dbPool.query(`
      SELECT w.city, COUNT(c.id) as count,
        CASE WHEN COUNT(c.id) > 10 THEN 'HIGH'
             WHEN COUNT(c.id) > 5 THEN 'MEDIUM'
             ELSE 'LOW' END as risk
      FROM claims c
      JOIN workers w ON w.id = c.worker_id
      GROUP BY w.city
      ORDER BY count DESC
      LIMIT 6
    `);
    return res.json({ zones: result.rows });
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

app.post("/api/fraud/check", async (req, res) => {
  if (!requireDb(res)) return;

  const { worker_email, city, rain_mm, aqi, triggers } = req.body || {};
  if (!worker_email) {
    return res.status(400).json({ error: "worker_email is required" });
  }

  try {
    const normalizedEmail = normalizeEmail(worker_email);
    const flags = [];

    const workerResult = await dbPool.query(
      `SELECT id, city FROM workers WHERE LOWER(email) = $1 LIMIT 1`,
      [normalizedEmail],
    );
    const worker = workerResult.rows[0];
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const recentClaim = await dbPool.query(
      `SELECT id, created_at FROM claims
       WHERE worker_id = $1
       AND created_at > NOW() - INTERVAL '1 hour'
       AND status != 'rejected'
       ORDER BY created_at DESC LIMIT 1`,
      [worker.id],
    );
    if (recentClaim.rows.length > 0) {
      flags.push({
        type: "DUPLICATE_CLAIM",
        severity: "HIGH",
        message: `Claim already filed ${Math.round((Date.now() - new Date(recentClaim.rows[0].created_at).getTime()) / 60000)} minutes ago`,
      });
    }

    const registeredCity = String(worker.city || "").trim().toLowerCase();
    const claimCity = String(city || "").trim().toLowerCase();
    if (registeredCity && claimCity && registeredCity !== claimCity) {
      flags.push({
        type: "CITY_MISMATCH",
        severity: "MEDIUM",
        message: `Claim filed from ${city} but worker registered in ${worker.city}`,
      });
    }

    const rainMm = Number(rain_mm || 0);
    const aqiValue = Number(aqi || 0);
    const hasWeatherTrigger = Array.isArray(triggers) && triggers.length > 0;
    const weatherActuallyBad = rainMm > 10 || aqiValue > 150;

    if (hasWeatherTrigger && !weatherActuallyBad) {
      flags.push({
        type: "FAKE_INACTIVITY",
        severity: "HIGH",
        message: `Claim triggered but live weather shows Rain=${rainMm}mm, AQI=${aqiValue} — conditions are normal`,
      });
    }

    const isFraudulent = flags.some((f) => f.severity === "HIGH");
    const isSuspicious = flags.length > 0;

    if (isSuspicious) {
      await dbPool.query(
        `INSERT INTO fraud_alerts (worker_id, reason, flag_level, resolved)
         VALUES ($1, $2, $3, FALSE)`,
        [
          worker.id,
          flags.map((f) => f.message).join(" | "),
          isFraudulent ? "HIGH" : "MEDIUM",
        ],
      ).catch(() => {
        // non-blocking — fraud_alerts table may not exist yet
      });
    }

    return res.json({
      isFraudulent,
      isSuspicious,
      flags,
      recommendation: isFraudulent
        ? "BLOCK"
        : isSuspicious
          ? "REVIEW"
          : "APPROVE",
    });
  } catch (err) {
    console.error("Fraud check error:", err);
    return res.status(500).json({ error: "Fraud check failed" });
  }
});

const distPath = path.resolve("dist");
const distIndexPath = path.resolve(distPath, "index.html");
const hasBuiltFrontend = fs.existsSync(distIndexPath);

if (hasBuiltFrontend) {
  app.use(express.static(distPath));

  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.sendFile(distIndexPath);
  });
} else {
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.status(503).send("Frontend build not found. Use http://localhost:8080 for dev, or run npm run build and then npm run start.");
  });
}

const pingRenderUrl = () => {
  const targetUrl = "https://smartshift-insurance.onrender.com/";
  const intervalMs = 10 * 60 * 1000;

  const ping = async () => {
    try {
      const response = await fetch(targetUrl, { method: "GET" });
      console.log(`[ping] ${response.status} -> ${targetUrl}`);
    } catch (error) {
      console.error("[ping] failed", error instanceof Error ? error.message : String(error));
    }
  };

  void ping();

  const timer = setInterval(() => {
    void ping();
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
};

// Register ML routes (pass dbPool for database access)
const mlRouter = mlRoutes(dbPool);
app.use("/api/ml", mlRouter);

// ML Prediction Endpoint - Proxies to Python serverless function
app.post("/api/ml/predict", async (req, res) => {
  try {
    const { rain, rain_prob, wind, temperature, aqi, traffic_delay, hour } = req.body || {};

    // For local development, calculate directly
    // For Vercel, this will call the Python function at /api/ml
    const isDevelopment = process.env.NODE_ENV === "development" || !process.env.VERCEL;

    if (isDevelopment) {
      // Local prediction (direct calculation)
      const riskProb = calculateLocalRiskProbability({
        rain: rain || 0,
        rain_prob: rain_prob || 0,
        wind: wind || 0,
        temperature: temperature || 25,
        aqi: aqi || 100,
        traffic_delay: traffic_delay || 0,
        hour: hour || 12,
      });

      return res.json({
        risk_probability: Math.round(riskProb * 1000) / 1000,
        risk_level: riskProb < 0.3 ? "LOW" : riskProb < 0.6 ? "MEDIUM" : "HIGH",
        confidence: "HIGH",
        explanation: [{ factor: "Local Mode", value: "Active", status: "SAFE" }],
        model: "Local Rule-Based Engine",
      });
    }

    // Production: Call Vercel Python function
    const mlResponse = await fetch(
      `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/ml`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rain: rain || 0,
          rain_prob: rain_prob || 0,
          wind: wind || 0,
          temperature: temperature || 25,
          aqi: aqi || 100,
          traffic_delay: traffic_delay || 0,
          hour: hour || 12,
        }),
      },
    );

    const prediction = await mlResponse.json();
    return res.json(prediction);
  } catch (error) {
    console.error("ML prediction error:", error);
    return res.status(500).json({ error: "ML prediction failed", message: error.message });
  }
});

// Helper function for local risk calculation
const calculateLocalRiskProbability = (features) => {
  const rain = features.rain || 0;
  const rainProb = features.rain_prob || 0;
  const wind = features.wind || 0;
  const temp = features.temperature || 25;
  const aqi = features.aqi || 100;
  const traffic = features.traffic_delay || 0;
  const hour = features.hour || 12;

  const rainNorm = Math.min(rain / 50, 1.0);
  const rainProbNorm = rainProb / 100;
  const windNorm = Math.min(wind / 30, 1.0);
  const tempNorm = Math.max(0, Math.min((temp - 25) / 15, 1.0));
  const aqiNorm = Math.min(aqi / 500, 1.0);
  const trafficNorm = Math.min(traffic / 3, 1.0);

  const hourMultiplier = [9, 10, 17, 18].includes(hour) ? 1.5 : 1.0;

  const riskScore =
    (0.35 * rainNorm +
      0.15 * rainProbNorm +
      0.1 * windNorm +
      0.15 * tempNorm +
      0.15 * aqiNorm +
      0.1 * trafficNorm) *
    hourMultiplier;

  return 1 / (1 + Math.exp(-((riskScore - 0.5) * 5)));
};

// Start automated trigger checker (fires every 5 minutes)
if (dbPool) {
  startTriggerChecker(dbPool, 5 * 60 * 1000);
  console.log("✓ Trigger checker initialized");
}

app.listen(process.env.PORT || 8080, () => {
  console.log(`SmartShift app running on http://localhost:${PORT}`);
  pingRenderUrl();
});

void ensureSupplementalSchema().catch((error) => {
  console.error("Failed to ensure supplemental schema", error instanceof Error ? error.message : String(error));
});
