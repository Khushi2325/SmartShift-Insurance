import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import pg from "pg";
import Razorpay from "razorpay";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8080);
const { Pool } = pg;

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

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

const calculatePremium = (riskScore) => Math.round(20 + clamp(Number(riskScore || 0), 0, 1) * 50);

const checkForClaim = ({ rain, activity }) => {
  if (Number(rain || 0) > 50 && Number(activity || 0) < 30) {
    return { triggered: true, payout: 300, reason: "Heavy rain disruption" };
  }

  return { triggered: false };
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const getWorkerIdByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const result = await dbPool.query("SELECT id FROM workers WHERE LOWER(email) = $1 LIMIT 1", [normalizedEmail]);
  return result.rows[0]?.id || null;
};

const getWorkerPortalState = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const workerResult = await dbPool.query(
    `SELECT id, name, email, city, persona_type, delivery_partner, created_at
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
    recentClaims: claimsResult.rows,
  };
};

app.get("/api/db/workers/portal", async (req, res) => {
  if (!requireDb(res)) return;

  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const portalState = await getWorkerPortalState(email);
    return res.json(portalState);
  } catch {
    return res.status(500).json({ error: "Failed to fetch worker portal state" });
  }
});

app.post("/api/risk/insights", (req, res) => {
  const { rainProbability, aqi, temperature, rain, activity } = req.body || {};
  const risk = calculateRisk({ rainProbability, aqi, temperature });
  const forecast = generateRiskForecast({ rainProbability, aqi, temperature });
  const premium = calculatePremium(risk.riskScore);
  const claim = checkForClaim({ rain, activity });

  return res.json({
    risk,
    premium,
    forecast,
    claim,
  });
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

app.post("/api/db/claims", async (req, res) => {
  if (!requireDb(res)) return;

  const { worker_email, trigger_type, payout_amount, status, auto_generated, reviewer, review_reason } = req.body || {};
  if (!worker_email || !trigger_type || payout_amount === undefined || !status) {
    return res.status(400).json({ error: "worker_email, trigger_type, payout_amount, and status are required" });
  }

  try {
    const workerId = await getWorkerIdByEmail(worker_email);
    if (!workerId) return res.status(404).json({ error: "Worker not found for given email" });

    const result = await dbPool.query(
      `
      INSERT INTO claims (worker_id, trigger_type, payout_amount, status, auto_generated, reviewer, review_reason, reviewed_at)
      VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6, $7, CASE WHEN $4 IN ('Approved', 'Rejected') THEN NOW() ELSE NULL END)
      RETURNING *
      `,
      [workerId, trigger_type, payout_amount, status, auto_generated, reviewer || null, review_reason || null],
    );
    return res.json({ claim: result.rows[0] });
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

app.use(express.static(path.resolve("dist")));

app.get("/{*path}", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }

  return res.sendFile(path.resolve("dist", "index.html"));
});

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

app.listen(PORT, () => {
  console.log(`SmartShift app running on http://localhost:${PORT}`);
  pingRenderUrl();
});
