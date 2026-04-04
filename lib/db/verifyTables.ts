import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const expected = ["claims", "fraud_alerts", "insurance_policies", "risk_data", "wallets", "workers"];

const run = async () => {
  const result = await pool.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name;
    `,
    [expected],
  );

  console.log(result.rows.map((r) => r.table_name).join(", "));
  await pool.end();
};

void run();
