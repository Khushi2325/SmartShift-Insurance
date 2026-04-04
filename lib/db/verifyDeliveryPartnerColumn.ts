import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const run = async () => {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'workers'
        AND column_name = 'delivery_partner'
      LIMIT 1;
    `,
  );

  console.log(result.rowCount === 1 ? "delivery_partner_present" : "delivery_partner_missing");
  await pool.end();
};

void run();
