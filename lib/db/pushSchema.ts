import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const pool: any = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

const statements = [
  `
  CREATE TABLE IF NOT EXISTS workers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    persona_type TEXT NOT NULL DEFAULT 'rain',
    delivery_partner TEXT NOT NULL DEFAULT 'Zomato',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `ALTER TABLE workers ADD COLUMN IF NOT EXISTS delivery_partner TEXT NOT NULL DEFAULT 'Zomato';`,
  `CREATE INDEX IF NOT EXISTS workers_city_idx ON workers (city);`,

  `
  CREATE TABLE IF NOT EXISTS risk_data (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL,
    rain_probability REAL NOT NULL,
    aqi REAL NOT NULL,
    temperature REAL NOT NULL,
    risk_score REAL NOT NULL,
    risk_level TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS risk_data_city_created_idx ON risk_data (city, created_at);`,

  `
  CREATE TABLE IF NOT EXISTS insurance_policies (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'unknown',
    weekly_premium REAL NOT NULL,
    risk_level TEXT NOT NULL,
    coverage_amount REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS plan_id TEXT NOT NULL DEFAULT 'unknown';`,
  `CREATE INDEX IF NOT EXISTS insurance_policies_worker_status_idx ON insurance_policies (worker_id, status);`,

  `
  CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    payout_amount REAL NOT NULL,
    status TEXT NOT NULL,
    auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    reviewer TEXT,
    review_reason TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `ALTER TABLE claims ADD COLUMN IF NOT EXISTS reviewer TEXT;`,
  `ALTER TABLE claims ADD COLUMN IF NOT EXISTS review_reason TEXT;`,
  `ALTER TABLE claims ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;`,
  `CREATE INDEX IF NOT EXISTS claims_worker_created_idx ON claims (worker_id, created_at);`,

  `
  CREATE TABLE IF NOT EXISTS fraud_alerts (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    flag_level TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS fraud_alerts_worker_resolved_idx ON fraud_alerts (worker_id, resolved);`,
];

const run = async () => {
  try {
    for (const sql of statements) {
      await pool.query(sql);
    }
    console.log("Schema applied successfully.");
  } finally {
    await pool.end();
  }
};

void run();
