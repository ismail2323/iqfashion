import pg from "pg";
import { execSync } from "node:child_process";

const ADMIN = "postgresql://postgres:postgres@localhost:54329/postgres";
const TEST_DB = "postgresql://postgres:postgres@localhost:54329/iqfashion_test";

export default async function setup() {
  const c = new pg.Client({ connectionString: ADMIN });
  await c.connect().catch(() => {
    throw new Error("Yerel Postgres kapalı. Önce `npm run db:local` çalıştırın.");
  });
  // Temiz test veritabani her calistirmada
  await c.query("DROP DATABASE IF EXISTS iqfashion_test WITH (FORCE)");
  await c.query("CREATE DATABASE iqfashion_test");
  await c.end();
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: TEST_DB, DIRECT_URL: TEST_DB } });
}