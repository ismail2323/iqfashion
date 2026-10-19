// Yerel/test veritabanini fabrika ayarlarina dondurur ve demo veriyi yeniden yukler.
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { fabrikaSifirla } from "../src/lib/sifirlama";
import { demoVeriOlustur } from "../prisma/demo";
import { sifreHashle } from "../src/lib/sifre";

const email = (process.env.SEED_ADMIN_EMAIL || "admin@iqfashion.local").toLowerCase();
const sifre = process.env.SEED_ADMIN_PASSWORD;
if (!sifre) throw new Error("SEED_ADMIN_PASSWORD tanımlı olmalı");
let admin = await prisma.kullanici.findUnique({ where: { email } });
if (!admin) admin = await prisma.kullanici.create({ data: { email, ad: process.env.SEED_ADMIN_NAME || "Yavuz", sifreHash: await sifreHashle(sifre), rol: "SUPER_ADMIN" } });
await fabrikaSifirla(admin.id);
await demoVeriOlustur();
await prisma.$disconnect();