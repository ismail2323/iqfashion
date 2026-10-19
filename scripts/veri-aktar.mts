// Bir veritabanından diğerine TOPLU veri aktarımı (örnek veriyi canlıya yükleme, bölge/sağlayıcı taşıma).
//   SRC_URL=... DEST_URL=... npx tsx scripts/veri-aktar.mts [--admin-koru]
// --admin-koru: hedefteki süper admin hesabı korunur, kaynaktaki süper adminler aktarılmaz (örnek veri yükleme).
// Bayraksız: hedef tamamen kaynağın kopyası olur (taşıma).
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const kaynakUrl = process.env.SRC_URL;
const hedefUrl = process.env.DEST_URL;
if (!kaynakUrl || !hedefUrl) throw new Error("SRC_URL ve DEST_URL gerekli");
const adminKoru = process.argv.includes("--admin-koru");

const istemci = (u: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString: u, connectionTimeoutMillis: 60_000, max: 4 }) });
const S = istemci(kaynakUrl);
const D = istemci(hedefUrl);

// bağımlılık sırası (üst tablolar önce)
const TABLOLAR = ["sube", "kullanici", "marka", "kategori", "tedarikci", "urun", "varyant", "stok", "fiyatGecmisi", "alisBelgesi", "alisKalemi", "satis", "satisKalemi", "transfer", "transferKalemi", "stokHareketi", "kasaKaydi", "ayar", "sayac", "gorsel", "denetimKaydi"] as const;
const VERI_TABLOLARI = `"SatisKalemi","Satis","AlisKalemi","AlisBelgesi","TransferKalemi","Transfer","StokHareketi","Stok","FiyatGecmisi","Varyant","Urun","Marka","Kategori","Tedarikci","KasaKaydi","DenetimKaydi","AiKullanim","Gorsel","GirisDenemesi","Ayar","Sayac"`;

type Genel = { findMany: (a?: unknown) => Promise<Record<string, unknown>[]>; createMany: (a: unknown) => Promise<unknown> };
const model = (c: PrismaClient, ad: string) => (c as unknown as Record<string, Genel>)[ad];

async function hedefiTemizle() {
  if (adminKoru) {
    const admin = await D.kullanici.findFirst({ where: { rol: "SUPER_ADMIN" } });
    if (!admin) throw new Error("Hedefte süper admin yok (--admin-koru için gerekli)");
    await D.$executeRawUnsafe(`TRUNCATE ${VERI_TABLOLARI} RESTART IDENTITY`);
    await D.kullanici.deleteMany({ where: { id: { not: admin.id } } });
    await D.kullanici.update({ where: { id: admin.id }, data: { subeId: null } });
    await D.sube.deleteMany({});
    return admin.id;
  }
  await D.$executeRawUnsafe(`TRUNCATE "Kullanici","Oturum","Sube",${VERI_TABLOLARI} RESTART IDENTITY CASCADE`);
  return null;
}

async function main() {
  const korunanAdmin = await hedefiTemizle();
  for (const ad of TABLOLAR) {
    let satirlar = await model(S, ad).findMany(ad === "kullanici" && adminKoru ? { where: { rol: { not: "SUPER_ADMIN" } } } : undefined);
    if (ad === "denetimKaydi") satirlar = satirlar.map((r) => ({ ...r, detay: r.detay === null ? Prisma.JsonNull : r.detay }));
    if (ad === "ayar") satirlar = satirlar.filter((r) => r.anahtar !== "istatistikSifirlamaNoktasi");
    for (let i = 0; i < satirlar.length; i += 1000) await model(D, ad).createMany({ data: satirlar.slice(i, i + 1000) });
    console.log(`${ad.padEnd(14)} ${satirlar.length}`);
  }
  console.log(korunanAdmin ? "Tamam (hedefteki süper admin korundu)" : "Tamam (tam kopya)");
}

main().finally(async () => {
  await S.$disconnect();
  await D.$disconnect();
});
