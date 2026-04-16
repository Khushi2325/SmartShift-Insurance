import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
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

const ensureSupplementalSchema = async () => {
  if (!dbPool) return;

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

app.listen(process.env.PORT || 8080, () => {
  console.log(`SmartShift app running on http://localhost:${PORT}`);
  pingRenderUrl();
});

void ensureSupplementalSchema().catch((error) => {
  console.error("Failed to ensure supplemental schema", error instanceof Error ? error.message : String(error));
});
