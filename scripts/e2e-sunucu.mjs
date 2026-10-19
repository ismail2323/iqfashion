// E2E için: boş veritabanı hazırla (drop/create + migrate), sonra üretim sunucusunu aynı süreçte başlat.
import pg from "pg";
import { execSync } from "node:child_process";

const ADMIN = "postgresql://postgres:postgres@localhost:54329/postgres";
const E2E_DB = "postgresql://postgres:postgres@localhost:54329/iqfashion_e2e";

const c = new pg.Client({ connectionString: ADMIN });
await c.connect().catch(() => {
  console.error("Yerel Postgres kapalı. Önce `npm run db:local` çalıştırın.");
  process.exit(1);
});
await c.query("DROP DATABASE IF EXISTS iqfashion_e2e WITH (FORCE)");
await c.query("CREATE DATABASE iqfashion_e2e");
await c.end();
execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: E2E_DB, DIRECT_URL: E2E_DB } });

// önceki çalıştırmadan kalan veri önbelleğini temizle (e2e hep taze başlasın)
import { rmSync } from "node:fs"; // e2e-onbellek
rmSync(".next/cache", { recursive: true, force: true });

process.env.DATABASE_URL = E2E_DB;
process.env.DIRECT_URL = E2E_DB;
process.argv = [process.argv[0], "next", "start", "-p", "3200"];
await import("next/dist/bin/next");