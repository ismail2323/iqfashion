// Yerel gelistirme/test icin Docker'siz gercek Postgres (embedded-postgres)
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";

const port = Number(process.env.PG_PORT || 54329);
const dir = process.env.PG_DIR || "./.pgdata";
const dbAdi = process.env.PG_DB || "iqfashion";

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
});

if (!fs.existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase(dbAdi);
} catch (e) {
  if (!/already exists/i.test(String(e?.message))) throw e;
}
console.log(`HAZIR postgresql://postgres:postgres@localhost:${port}/${dbAdi}`);

const kapat = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", kapat);
process.on("SIGTERM", kapat);
setInterval(() => {}, 1 << 30);

