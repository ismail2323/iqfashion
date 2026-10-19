// Tum rapor/dashboard hesaplari SQL'de yapilir. Tutarlar TL (number) olarak doner.
// Tanimlar:
//   Satis (net ciro) = iptal edilmemis satislar - iadeler (indirimler dusulmus)
//   Alis             = mal kabul / urun girisi belgelerinin toplami
//   Gelir            = Satis + diger gelir kayitlari
//   Gider            = Alis + isletme giderleri (kira, maas, fatura...)
//   Kasa (net)       = Gelir - Gider
//   Kar              = Satis - satilan malin maliyeti - isletme giderleri
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { ayBasi, donemAraligi, gunBasi, gunEkle, haftaBasi, yilBasi, type Donem } from "./tarih";

export type Ozet = {
  satis: number;
  satisAdet: number;
  satisSayisi: number;
  maliyet: number; // satilan malin maliyeti
  brutKar: number;
  alis: number;
  alisAdet: number;
  digerGelir: number;
  isletmeGideri: number;
  gelir: number;
  gider: number;
  kasa: number;
  netKar: number;
  odeme: { NAKIT: number; KART: number; HAVALE: number; KARISIK: number };
};

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const yuvarla = (x: number) => Math.round(x * 100) / 100;

const subeSatis = (subeId?: string) => (subeId ? Prisma.sql`AND s."subeId" = ${subeId}` : Prisma.empty);
const subeAlis = (subeId?: string) => (subeId ? Prisma.sql`AND a."subeId" = ${subeId}` : Prisma.empty);
const subeKasa = (subeId?: string) => (subeId ? Prisma.sql`AND "subeId" = ${subeId}` : Prisma.empty);

export async function ozet(bas: Date, bit: Date, subeId?: string, baslangicSiniri?: Date | null): Promise<Ozet> {
  // "Sifirlama noktasi" varsa ondan onceki kayitlar sayilmaz
  const b = baslangicSiniri && baslangicSiniri > bas ? baslangicSiniri : bas;
  const [satis, odeme, alis, kasa] = await Promise.all([
    prisma.$queryRaw<{ ciro: unknown; maliyet: unknown; adet: unknown; sayi: unknown }[]>`
      SELECT COALESCE(SUM((k."birimFiyat" * k."miktar" - k."indirimPayi") * (k."miktar" - k."iadeAdet") / NULLIF(k."miktar", 0)), 0) AS ciro,
             COALESCE(SUM(k."birimMaliyet" * (k."miktar" - k."iadeAdet")), 0) AS maliyet,
             COALESCE(SUM(k."miktar" - k."iadeAdet"), 0) AS adet,
             COUNT(DISTINCT s."id") AS sayi
      FROM "SatisKalemi" k JOIN "Satis" s ON s."id" = k."satisId"
      WHERE s."durum" = 'TAMAMLANDI' AND s."createdAt" >= ${b} AND s."createdAt" < ${bit} ${subeSatis(subeId)}`,
    prisma.$queryRaw<{ odemeTipi: string; toplam: unknown }[]>`
      SELECT s."odemeTipi"::text AS "odemeTipi", COALESCE(SUM(s."toplam"), 0) AS toplam
      FROM "Satis" s
      WHERE s."durum" = 'TAMAMLANDI' AND s."createdAt" >= ${b} AND s."createdAt" < ${bit} ${subeSatis(subeId)}
      GROUP BY s."odemeTipi"`,
    prisma.$queryRaw<{ toplam: unknown; adet: unknown }[]>`
      SELECT COALESCE(SUM(a."toplam"), 0) AS toplam,
             COALESCE((SELECT SUM(ak."miktar") FROM "AlisKalemi" ak JOIN "AlisBelgesi" a2 ON a2."id" = ak."belgeId"
                       WHERE a2."tarih" >= ${b} AND a2."tarih" < ${bit} ${subeId ? Prisma.sql`AND a2."subeId" = ${subeId}` : Prisma.empty}), 0) AS adet
      FROM "AlisBelgesi" a WHERE a."tarih" >= ${b} AND a."tarih" < ${bit} ${subeAlis(subeId)}`,
    prisma.$queryRaw<{ tip: string; toplam: unknown }[]>`
      SELECT "tip"::text AS tip, COALESCE(SUM("tutar"), 0) AS toplam FROM "KasaKaydi"
      WHERE "tarih" >= ${b} AND "tarih" < ${bit} ${subeKasa(subeId)} GROUP BY "tip"`,
  ]);
  const ciro = yuvarla(n(satis[0]?.ciro));
  const maliyet = yuvarla(n(satis[0]?.maliyet));
  const alisT = yuvarla(n(alis[0]?.toplam));
  const digerGelir = yuvarla(n(kasa.find((x) => x.tip === "GELIR")?.toplam));
  const isletme = yuvarla(n(kasa.find((x) => x.tip === "GIDER")?.toplam));
  const gelir = yuvarla(ciro + digerGelir);
  const gider = yuvarla(alisT + isletme);
  const od = { NAKIT: 0, KART: 0, HAVALE: 0, KARISIK: 0 };
  for (const o of odeme) od[o.odemeTipi as keyof typeof od] = yuvarla(n(o.toplam));
  return {
    satis: ciro, satisAdet: n(satis[0]?.adet), satisSayisi: n(satis[0]?.sayi), maliyet, brutKar: yuvarla(ciro - maliyet),
    alis: alisT, alisAdet: n(alis[0]?.adet), digerGelir, isletmeGideri: isletme, gelir, gider, kasa: yuvarla(gelir - gider),
    netKar: yuvarla(ciro - maliyet - isletme), odeme: od,
  };
}

/**
 * Anasayfadaki 4 dönemi (bugün/hafta/ay/yıl) TEK geçişte hesaplar: 16+ ayrı sorgu yerine 5 sorgu, veri bir kez taranır.
 * Sonuç `donemOzetleri` ile birebir aynıdır (birim testle doğrulanır).
 */
export async function donemOzetleriHizli(subeId?: string, baslangicSiniri?: Date | null, simdi = new Date()) {
  const donemler: Donem[] = ["bugun", "hafta", "ay", "yil"];
  const ar = donemler.map((d) => donemAraligi(d, undefined, undefined, simdi));
  const bas = ar.map((a) => (baslangicSiniri && baslangicSiniri > a.bas ? baslangicSiniri : a.bas));
  const bit = ar.map((a) => a.bit);
  const enBas = new Date(Math.min(...bas.map(Number)));
  const enBit = new Date(Math.max(...bit.map(Number)));
  const sut = (on: string, i: number) => Prisma.raw(`${on}${i}`);
  const filtre = (kolon: Prisma.Sql, i: number) => Prisma.sql`FILTER (WHERE ${kolon} >= ${bas[i]} AND ${kolon} < ${bit[i]})`;
  const hepsi = (f: (i: number) => Prisma.Sql) => Prisma.join([0, 1, 2, 3].map(f));

  const satisKolon = Prisma.sql`s."createdAt"`;
  const ciroIfade = Prisma.sql`(k."birimFiyat" * k."miktar" - k."indirimPayi") * (k."miktar" - k."iadeAdet") / NULLIF(k."miktar", 0)`;
  const [satis, odeme, alis, alisAdet, kasa] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT ${hepsi((i) => Prisma.sql`COALESCE(SUM(${ciroIfade}) ${filtre(satisKolon, i)}, 0) AS ${sut("ciro", i)},
             COALESCE(SUM(k."birimMaliyet" * (k."miktar" - k."iadeAdet")) ${filtre(satisKolon, i)}, 0) AS ${sut("maliyet", i)},
             COALESCE(SUM(k."miktar" - k."iadeAdet") ${filtre(satisKolon, i)}, 0) AS ${sut("adet", i)},
             COUNT(DISTINCT s."id") ${filtre(satisKolon, i)} AS ${sut("sayi", i)}`)}
      FROM "SatisKalemi" k JOIN "Satis" s ON s."id" = k."satisId"
      WHERE s."durum" = 'TAMAMLANDI' AND s."createdAt" >= ${enBas} AND s."createdAt" < ${enBit} ${subeSatis(subeId)}`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT s."odemeTipi"::text AS tip, ${hepsi((i) => Prisma.sql`COALESCE(SUM(s."toplam") ${filtre(satisKolon, i)}, 0) AS ${sut("t", i)}`)}
      FROM "Satis" s WHERE s."durum" = 'TAMAMLANDI' AND s."createdAt" >= ${enBas} AND s."createdAt" < ${enBit} ${subeSatis(subeId)}
      GROUP BY s."odemeTipi"`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT ${hepsi((i) => Prisma.sql`COALESCE(SUM(a."toplam") ${filtre(Prisma.sql`a."tarih"`, i)}, 0) AS ${sut("t", i)}`)}
      FROM "AlisBelgesi" a WHERE a."tarih" >= ${enBas} AND a."tarih" < ${enBit} ${subeAlis(subeId)}`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT ${hepsi((i) => Prisma.sql`COALESCE(SUM(ak."miktar") ${filtre(Prisma.sql`a."tarih"`, i)}, 0) AS ${sut("t", i)}`)}
      FROM "AlisKalemi" ak JOIN "AlisBelgesi" a ON a."id" = ak."belgeId" WHERE a."tarih" >= ${enBas} AND a."tarih" < ${enBit} ${subeAlis(subeId)}`,
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT "tip"::text AS tip, ${hepsi((i) => Prisma.sql`COALESCE(SUM("tutar") ${filtre(Prisma.sql`"tarih"`, i)}, 0) AS ${sut("t", i)}`)}
      FROM "KasaKaydi" WHERE "tarih" >= ${enBas} AND "tarih" < ${enBit} ${subeKasa(subeId)} GROUP BY "tip"`,
  ]);

  const sonuc = {} as Record<Donem, Ozet & { bas: Date; bit: Date }>;
  donemler.forEach((d, i) => {
    const ciro = yuvarla(n(satis[0]?.[`ciro${i}`]));
    const maliyet = yuvarla(n(satis[0]?.[`maliyet${i}`]));
    const alisT = yuvarla(n(alis[0]?.[`t${i}`]));
    const digerGelir = yuvarla(n(kasa.find((x) => x.tip === "GELIR")?.[`t${i}`]));
    const isletme = yuvarla(n(kasa.find((x) => x.tip === "GIDER")?.[`t${i}`]));
    const gelir = yuvarla(ciro + digerGelir);
    const gider = yuvarla(alisT + isletme);
    const od = { NAKIT: 0, KART: 0, HAVALE: 0, KARISIK: 0 };
    for (const o of odeme) od[o.tip as keyof typeof od] = yuvarla(n(o[`t${i}`]));
    sonuc[d] = {
      bas: ar[i].bas, bit: ar[i].bit,
      satis: ciro, satisAdet: n(satis[0]?.[`adet${i}`]), satisSayisi: n(satis[0]?.[`sayi${i}`]), maliyet, brutKar: yuvarla(ciro - maliyet),
      alis: alisT, alisAdet: n(alisAdet[0]?.[`t${i}`]), digerGelir, isletmeGideri: isletme, gelir, gider, kasa: yuvarla(gelir - gider),
      netKar: yuvarla(ciro - maliyet - isletme), odeme: od,
    };
  });
  return sonuc;
}
/** Anasayfa: bugun / bu hafta / bu ay / bu yil */
export async function donemOzetleri(subeId?: string, baslangicSiniri?: Date | null, simdi = new Date()) {
  const donemler: Donem[] = ["bugun", "hafta", "ay", "yil"];
  const sonuc = await Promise.all(
    donemler.map(async (d) => {
      const { bas, bit } = donemAraligi(d, undefined, undefined, simdi);
      return [d, { bas, bit, ...(await ozet(bas, bit, subeId, baslangicSiniri)) }] as const;
    }),
  );
  return Object.fromEntries(sonuc) as Record<Donem, Awaited<ReturnType<typeof ozet>> & { bas: Date; bit: Date }>;
}

export type GunSatiri = { gun: string; satis: number; alis: number; gider: number };

/** Gun gun satis / alis / gider (Istanbul gunleri) */
export async function gunlukSeri(bas: Date, bit: Date, subeId?: string, baslangicSiniri?: Date | null): Promise<GunSatiri[]> {
  const b = baslangicSiniri && baslangicSiniri > bas ? baslangicSiniri : bas;
  const [s, a, g] = await Promise.all([
    prisma.$queryRaw<{ gun: string; v: unknown }[]>`
      SELECT to_char(s."createdAt" + interval '3 hours', 'YYYY-MM-DD') AS gun,
             SUM((k."birimFiyat" * k."miktar" - k."indirimPayi") * (k."miktar" - k."iadeAdet") / NULLIF(k."miktar", 0)) AS v
      FROM "SatisKalemi" k JOIN "Satis" s ON s."id" = k."satisId"
      WHERE s."durum" = 'TAMAMLANDI' AND s."createdAt" >= ${b} AND s."createdAt" < ${bit} ${subeSatis(subeId)} GROUP BY 1`,
    prisma.$queryRaw<{ gun: string; v: unknown }[]>`
      SELECT to_char(a."tarih" + interval '3 hours', 'YYYY-MM-DD') AS gun, SUM(a."toplam") AS v
      FROM "AlisBelgesi" a WHERE a."tarih" >= ${b} AND a."tarih" < ${bit} ${subeAlis(subeId)} GROUP BY 1`,
    prisma.$queryRaw<{ gun: string; v: unknown }[]>`
      SELECT to_char("tarih" + interval '3 hours', 'YYYY-MM-DD') AS gun, SUM("tutar") AS v
      FROM "KasaKaydi" WHERE "tip" = 'GIDER' AND "tarih" >= ${b} AND "tarih" < ${bit} ${subeKasa(subeId)} GROUP BY 1`,
  ]);
  const harita = new Map<string, GunSatiri>();
  const al = (gun: string) => harita.get(gun) ?? harita.set(gun, { gun, satis: 0, alis: 0, gider: 0 }).get(gun)!;
  for (const r of s) al(r.gun).satis = yuvarla(n(r.v));
  for (const r of a) al(r.gun).alis = yuvarla(n(r.v));
  for (const r of g) al(r.gun).gider = yuvarla(n(r.v));
  // bos gunleri sifirla doldur
  const cikti: GunSatiri[] = [];
  for (let d = gunBasi(b); d < bit; d = gunEkle(d, 1)) {
    const k = new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
    cikti.push(harita.get(k) ?? { gun: k, satis: 0, alis: 0, gider: 0 });
  }
  return cikti;
}

export type KirilimAlani = "marka" | "renk" | "beden" | "kategori" | "urun";
export type KirilimSatiri = { ad: string; adet: number; ciro: number; maliyet: number; kar: number };

const KIRILIM_SUTUN: Record<KirilimAlani, Prisma.Sql> = {
  marka: Prisma.sql`COALESCE(k."marka", 'Markasız')`,
  renk: Prisma.sql`k."renk"`,
  beden: Prisma.sql`k."beden"`,
  kategori: Prisma.sql`COALESCE(k."kategori", 'Kategorisiz')`,
  urun: Prisma.sql`k."urunAdi"`,
};

export async function kirilim(alan: KirilimAlani, bas: Date, bit: Date, subeId?: string, limit = 20, baslangicSiniri?: Date | null): Promise<KirilimSatiri[]> {
  const b = baslangicSiniri && baslangicSiniri > bas ? baslangicSiniri : bas;
  const sutun = KIRILIM_SUTUN[alan];
  const r = await prisma.$queryRaw<{ ad: string; adet: unknown; ciro: unknown; maliyet: unknown }[]>`
    SELECT ${sutun} AS ad,
           SUM(k."miktar" - k."iadeAdet") AS adet,
           SUM((k."birimFiyat" * k."miktar" - k."indirimPayi") * (k."miktar" - k."iadeAdet") / NULLIF(k."miktar", 0)) AS ciro,
           SUM(k."birimMaliyet" * (k."miktar" - k."iadeAdet")) AS maliyet
    FROM "SatisKalemi" k JOIN "Satis" s ON s."id" = k."satisId"
    WHERE s."durum" = 'TAMAMLANDI' AND s."createdAt" >= ${b} AND s."createdAt" < ${bit} ${subeSatis(subeId)}
    GROUP BY 1 HAVING SUM(k."miktar" - k."iadeAdet") > 0
    ORDER BY ciro DESC LIMIT ${limit}`;
  return r.map((x) => ({ ad: x.ad, adet: n(x.adet), ciro: yuvarla(n(x.ciro)), maliyet: yuvarla(n(x.maliyet)), kar: yuvarla(n(x.ciro) - n(x.maliyet)) }));
}

export type SubeSatiri = { subeId: string; ad: string; satis: number; kar: number; adet: number };

export async function subeKarsilastirma(bas: Date, bit: Date, baslangicSiniri?: Date | null): Promise<SubeSatiri[]> {
  const b = baslangicSiniri && baslangicSiniri > bas ? baslangicSiniri : bas;
  const r = await prisma.$queryRaw<{ subeId: string; ad: string; ciro: unknown; maliyet: unknown; adet: unknown }[]>`
    SELECT sb."id" AS "subeId", sb."ad" AS ad,
           COALESCE(SUM((k."birimFiyat" * k."miktar" - k."indirimPayi") * (k."miktar" - k."iadeAdet") / NULLIF(k."miktar", 0)), 0) AS ciro,
           COALESCE(SUM(k."birimMaliyet" * (k."miktar" - k."iadeAdet")), 0) AS maliyet,
           COALESCE(SUM(k."miktar" - k."iadeAdet"), 0) AS adet
    FROM "Sube" sb
    LEFT JOIN "Satis" s ON s."subeId" = sb."id" AND s."durum" = 'TAMAMLANDI' AND s."createdAt" >= ${b} AND s."createdAt" < ${bit}
    LEFT JOIN "SatisKalemi" k ON k."satisId" = s."id"
    WHERE sb."aktif" = true GROUP BY sb."id", sb."ad" ORDER BY ciro DESC`;
  return r.map((x) => ({ subeId: x.subeId, ad: x.ad, satis: yuvarla(n(x.ciro)), kar: yuvarla(n(x.ciro) - n(x.maliyet)), adet: n(x.adet) }));
}

export type KasiyerSatiri = { ad: string; satisSayisi: number; toplam: number };

/** Satış yapan kullanıcıya göre performans (iptal edilmemiş satışlar, iade öncesi tutar) */
export async function kasiyerPerformansi(bas: Date, bit: Date, subeId?: string, baslangicSiniri?: Date | null, limit = 15): Promise<KasiyerSatiri[]> {
  const b = baslangicSiniri && baslangicSiniri > bas ? baslangicSiniri : bas;
  const r = await prisma.$queryRaw<{ ad: string | null; sayi: unknown; toplam: unknown }[]>`
    SELECT split_part(COALESCE(s."kullaniciSnap", 'Bilinmiyor'), ' <', 1) AS ad, COUNT(*) AS sayi, COALESCE(SUM(s."toplam"), 0) AS toplam
    FROM "Satis" s WHERE s."durum" = 'TAMAMLANDI' AND s."createdAt" >= ${b} AND s."createdAt" < ${bit} ${subeSatis(subeId)}
    GROUP BY 1 ORDER BY toplam DESC LIMIT ${limit}`;
  return r.map((x) => ({ ad: x.ad ?? "Bilinmiyor", satisSayisi: n(x.sayi), toplam: yuvarla(n(x.toplam)) }));
}

export type StokDegeri = { adet: number; maliyetDegeri: number; satisDegeri: number; cesit: number };

export async function stokDegeri(subeId?: string): Promise<StokDegeri> {
  const r = await prisma.$queryRaw<{ adet: unknown; maliyet: unknown; satis: unknown; cesit: unknown }[]>`
    SELECT COALESCE(SUM(st."miktar"), 0) AS adet,
           COALESCE(SUM(st."miktar" * v."alisFiyati"), 0) AS maliyet,
           COALESCE(SUM(st."miktar" * v."satisFiyati"), 0) AS satis,
           COUNT(*) FILTER (WHERE st."miktar" > 0) AS cesit
    FROM "Stok" st JOIN "Varyant" v ON v."id" = st."varyantId"
    WHERE v."aktif" = true ${subeId ? Prisma.sql`AND st."subeId" = ${subeId}` : Prisma.empty}`;
  return { adet: n(r[0].adet), maliyetDegeri: yuvarla(n(r[0].maliyet)), satisDegeri: yuvarla(n(r[0].satis)), cesit: n(r[0].cesit) };
}

export type KritikStok = { varyantId: string; ad: string; renk: string; beden: string; barkod: string; subeAd: string; miktar: number; minStok: number };

export async function kritikStoklar(subeId?: string, limit = 10): Promise<KritikStok[]> {
  const r = await prisma.$queryRaw<{ varyantId: string; ad: string; renk: string; beden: string; barkod: string; subeAd: string; miktar: number; minStok: number }[]>`
    SELECT v."id" AS "varyantId", u."ad", v."renk", v."beden", v."barkod", sb."ad" AS "subeAd", st."miktar", v."minStok"
    FROM "Stok" st JOIN "Varyant" v ON v."id" = st."varyantId" JOIN "Urun" u ON u."id" = v."urunId" JOIN "Sube" sb ON sb."id" = st."subeId"
    WHERE v."aktif" = true AND u."aktif" = true AND sb."aktif" = true AND st."miktar" <= v."minStok" ${subeId ? Prisma.sql`AND st."subeId" = ${subeId}` : Prisma.empty}
    ORDER BY st."miktar" ASC, u."ad" LIMIT ${limit}`;
  return r.map((x) => ({ ...x, miktar: Number(x.miktar), minStok: Number(x.minStok) }));
}

/** Son gun gundur hic satilmamis ama stokta olan urunler (olu stok) */
export async function oluStok(gun: number, subeId?: string, limit = 10) {
  const sinir = new Date(Date.now() - gun * 86_400_000);
  const r = await prisma.$queryRaw<{ ad: string; renk: string; beden: string; miktar: unknown; deger: unknown }[]>`
    SELECT u."ad", v."renk", v."beden", SUM(st."miktar") AS miktar, SUM(st."miktar" * v."alisFiyati") AS deger
    FROM "Stok" st JOIN "Varyant" v ON v."id" = st."varyantId" JOIN "Urun" u ON u."id" = v."urunId"
    WHERE st."miktar" > 0 ${subeId ? Prisma.sql`AND st."subeId" = ${subeId}` : Prisma.empty}
      AND NOT EXISTS (SELECT 1 FROM "SatisKalemi" k JOIN "Satis" s ON s."id" = k."satisId"
                      WHERE k."varyantId" = v."id" AND s."createdAt" >= ${sinir} AND s."durum" = 'TAMAMLANDI' ${subeSatis(subeId)})
      AND v."createdAt" < ${sinir}
    GROUP BY u."ad", v."renk", v."beden", v."id" ORDER BY deger DESC LIMIT ${limit}`;
  return r.map((x) => ({ ad: x.ad, renk: x.renk, beden: x.beden, miktar: n(x.miktar), deger: yuvarla(n(x.deger)) }));
}

export { ayBasi, haftaBasi, yilBasi };

/** Menü rozeti için: stoğu minimum seviyede/altında olan (şube, varyant) sayısı */
export async function kritikSayisi(subeId?: string): Promise<number> {
  const r = await prisma.$queryRaw<{ n: unknown }[]>`
    SELECT COUNT(*) AS n FROM "Stok" st JOIN "Varyant" v ON v."id" = st."varyantId" JOIN "Urun" u ON u."id" = v."urunId" JOIN "Sube" sb ON sb."id" = st."subeId"
    WHERE v."aktif" = true AND u."aktif" = true AND sb."aktif" = true AND st."miktar" <= v."minStok" ${subeId ? Prisma.sql`AND st."subeId" = ${subeId}` : Prisma.empty}`;
  return n(r[0]?.n);
}