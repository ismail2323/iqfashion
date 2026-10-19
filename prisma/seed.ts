import "dotenv/config";
import { prisma } from "../src/lib/db";
import { sifreHashle } from "../src/lib/sifre";
import { varsayilanlariYaz } from "../src/lib/varsayilanlar";
import { demoVeriOlustur } from "./demo";

async function varsayilanlar() {
  await prisma.$transaction((tx) => varsayilanlariYaz(tx));
}

async function main() {
  await varsayilanlar();
  const email = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase();
  const sifre = process.env.SEED_ADMIN_PASSWORD || "";
  if (email && sifre && !(await prisma.kullanici.findUnique({ where: { email } }))) {
    await prisma.kullanici.create({ data: { email, ad: process.env.SEED_ADMIN_NAME || "Yavuz", sifreHash: await sifreHashle(sifre), rol: "SUPER_ADMIN" } });
    console.log("Süper admin oluşturuldu:", email);
  }
  if (process.env.SEED_DEMO === "1") await demoVeriOlustur();
  console.log("Seed tamam");
}

if (process.argv[1]?.includes("seed")) main().finally(() => prisma.$disconnect());
