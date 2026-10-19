// Demo veri: mağazadan gelen 4 ürün (Jagger Takım, Eşofman, Tişört, Kot Pantolon) ile ~4 aylık gerçekçi hareket.
// Tüm kayıtlar gerçek servis fonksiyonlarıyla (stok.ts) üretilir, sonra tarihler geriye alınır.
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { sifreHashle } from "../src/lib/sifre";
import { malKabul, satisIade, satisIptal, satisYap, transferGonder, transferOlustur, transferTeslimAl, urunOlustur, type Aktor } from "../src/lib/stok";
import type { OdemeTipi } from "../src/generated/prisma/client";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(20261019);
const rint = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const sec = <T,>(d: T[]): T => d[Math.floor(r() * d.length)];

const GUN = 86_400_000;
const GERI = 120; // kaç gün geriye

type UrunTanim = {
  ad: string; marka: string; kategori: string; cinsiyet: "ERKEK"; sezon: "YAZLIK" | "KISLIK" | "IKI_SEZON"; gorsel: string; aciklama: string;
  renkler: string[]; bedenler: string[]; alis: number; satis: number; agirlik: number; adetAralik: [number, number];
};

const URUNLER: UrunTanim[] = [
  { ad: "Jagger Takım (Gömlek + Pantolon)", marka: "Prada", kategori: "Takım Elbise", cinsiyet: "ERKEK", sezon: "IKI_SEZON", gorsel: "/urunler/jagger-takim.jpg", aciklama: "Lacivert gömlek ve beli lastikli pantolon takım", renkler: ["Lacivert", "Siyah"], bedenler: ["M", "L", "XL", "XXL"], alis: 1850, satis: 3290, agirlik: 3, adetAralik: [8, 14] },
  { ad: "Eşofman Takımı (Ceket + Alt)", marka: "Calvin Klein", kategori: "Eşofman", cinsiyet: "ERKEK", sezon: "IKI_SEZON", gorsel: "/urunler/esofman-takimi.jpg", aciklama: "Fermuarlı ceket ve paça lastikli eşofman altı", renkler: ["Siyah", "Antrasit"], bedenler: ["S", "M", "L", "XL", "XXL"], alis: 1500, satis: 2790, agirlik: 4, adetAralik: [10, 18] },
  { ad: "Polo Yaka Tişört", marka: "Hermès", kategori: "Tişört", cinsiyet: "ERKEK", sezon: "YAZLIK", gorsel: "/urunler/polo-tisort.jpg", aciklama: "Nakış logolu polo yaka kısa kollu tişört", renkler: ["Siyah", "Beyaz", "Lacivert"], bedenler: ["S", "M", "L", "XL"], alis: 640, satis: 1290, agirlik: 6, adetAralik: [12, 22] },
  { ad: "Slim Fit Kot Pantolon", marka: "Hugo", kategori: "Pantolon", cinsiyet: "ERKEK", sezon: "IKI_SEZON", gorsel: "/urunler/kot-pantolon.jpg", aciklama: "Açık yıkama dar kesim kot pantolon", renkler: ["Açık Mavi", "Koyu Mavi"], bedenler: ["30", "32", "34", "36", "38"], alis: 920, satis: 1790, agirlik: 5, adetAralik: [9, 16] },
];

const gunSonu = (n: number) => {
  const d = new Date(Date.now() - n * GUN);
  d.setUTCHours(rint(7, 17), rint(0, 59), rint(0, 59), 0); // 10:00-20:59 TR
  return d;
};
const yyyymmdd = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");

async function tarihAyarla(belgeId: string, tarih: Date) {
  await prisma.stokHareketi.updateMany({ where: { belgeId }, data: { createdAt: tarih } });
  await prisma.satis.updateMany({ where: { id: belgeId }, data: { createdAt: tarih } });
  await prisma.alisBelgesi.updateMany({ where: { id: belgeId }, data: { tarih, createdAt: tarih } });
  await prisma.transfer.updateMany({ where: { id: belgeId }, data: { createdAt: tarih } });
}

export async function demoVeriOlustur() {
  console.log("Demo veri oluşturuluyor…");
  const merkez = await prisma.sube.upsert({ where: { kod: "MERKEZ" }, update: {}, create: { ad: "Merkez Mağaza", kod: "MERKEZ", adres: "Merkez, İstanbul", telefon: "0212 000 00 01" } });
  const sube2 = await prisma.sube.upsert({ where: { kod: "SUBE2" }, update: {}, create: { ad: "Şube 2", kod: "SUBE2", adres: "AVM, İstanbul", telefon: "0212 000 00 02" } });
  const hash = await sifreHashle("Sube12345");
  const kul = async (email: string, ad: string, rol: "SUBE_MUDURU" | "KASIYER", subeId: string) =>
    prisma.kullanici.upsert({ where: { email }, update: {}, create: { email, ad, rol, subeId, sifreHash: hash } });
  const [mMudur, mKasiyer, s2Mudur] = await Promise.all([
    kul("merkez@iqfashion.local", "Ahmet Kaya", "SUBE_MUDURU", merkez.id),
    kul("kasiyer@iqfashion.local", "Elif Demir", "KASIYER", merkez.id),
    kul("sube2@iqfashion.local", "Mehmet Çelik", "SUBE_MUDURU", sube2.id),
  ]);
  const aktor = (k: typeof mMudur): Aktor => ({ id: k.id, ad: k.ad, email: k.email, rol: k.rol, subeId: k.subeId });
  const A = { m: aktor(mMudur), k: aktor(mKasiyer), s2: aktor(s2Mudur) };

  if ((await prisma.urun.count()) > 0) {
    console.log("Ürünler zaten var, demo ürün/hareket üretimi atlandı.");
    return;
  }

  // 1) Ürün kartları + Merkez açılış stoğu (GERI-2 gün önce)
  const hedefStok = new Map<string, { id: string; ad: string; renk: string; beden: string; agirlik: number; satis: number }>();
  for (const u of URUNLER) {
    const varyantlar = u.renkler.flatMap((renk) =>
      u.bedenler.map((beden) => ({ renk, beden, alisFiyati: u.alis, satisFiyati: u.satis, adet: rint(...u.adetAralik), minStok: 2 })),
    );
    const sonuc = await urunOlustur(
      { ad: u.ad, markaAd: u.marka, kategoriAd: u.kategori, cinsiyet: u.cinsiyet, sezon: u.sezon, gorselUrl: u.gorsel, aciklama: u.aciklama, tedarikciAd: "Demo Toptan Tekstil", varyantlar },
      merkez.id,
      A.m,
    );
    const belge = await prisma.alisBelgesi.findFirstOrThrow({ where: { notlar: { contains: u.ad } }, orderBy: { createdAt: "desc" } });
    await tarihAyarla(belge.id, gunSonu(GERI));
    for (const v of sonuc.varyantlar) hedefStok.set(v.id, { id: v.id, ad: u.ad, renk: v.renk, beden: v.beden, agirlik: u.agirlik, satis: u.satis });
  }
  await prisma.urun.updateMany({ data: { createdAt: gunSonu(GERI) } });
  await prisma.varyant.updateMany({ data: { createdAt: gunSonu(GERI) } });
  const tumVaryant = [...hedefStok.values()];
  const ozelHic = tumVaryant.find((v) => v.ad.startsWith("Jagger") && v.renk === "Siyah" && v.beden === "XXL")!; // olu stok ornegi
  ozelHic.agirlik = 0;

  // 2) Şube 2 için mal kabul (alış) — doğrudan tedarikçiden
  const s2Kalemler = tumVaryant.filter(() => r() < 0.7).map((v) => ({ varyantId: v.id, adet: rint(2, 6), birimMaliyet: 0 }));
  for (const k of s2Kalemler) k.birimMaliyet = Number((await prisma.varyant.findUniqueOrThrow({ where: { id: k.varyantId } })).alisFiyati);
  const s2Belge = await malKabul({ subeId: sube2.id, tedarikciAd: "Demo Toptan Tekstil", belgeNo: "IRS-1001", kalemler: s2Kalemler }, A.s2);
  await tarihAyarla(s2Belge.id, gunSonu(GERI - 1));

  // 3) Gün gün satışlar + dönemsel mal kabuller
  const sayac = new Map<string, number>();
  const odemeler: OdemeTipi[] = ["NAKIT", "KART", "KART", "KART", "HAVALE", "NAKIT"];
  const stokOku = async (subeId: string) => {
    const s = await prisma.stok.findMany({ where: { subeId, miktar: { gt: 0 } } });
    return new Map(s.map((x) => [x.varyantId, x.miktar]));
  };
  const iadeler: string[] = [];
  let iptalEdildi = false;

  for (let g = GERI - 2; g >= 0; g--) {
    const tarih = gunSonu(g);
    const haftaSonu = [0, 6].includes(new Date(tarih.getTime() + 3 * 3600_000).getUTCDay());
    // Mal kabul: ~her 25 günde bir
    if (g === 80 || g === 52 || g === 27 || g === 9) {
      const secilen = tumVaryant.filter((v) => v.agirlik > 0 && r() < 0.55);
      for (const [sube, kisi] of [[merkez.id, A.m], [sube2.id, A.s2]] as const) {
        const kalemler = [];
        for (const v of secilen) {
          const mevcut = await prisma.varyant.findUniqueOrThrow({ where: { id: v.id } });
          const zam = 1 + (r() * 0.08 - 0.02); // maliyet dalgalanması
          kalemler.push({ varyantId: v.id, adet: rint(3, 8), birimMaliyet: Math.round(Number(mevcut.alisFiyati) * zam) });
        }
        if (kalemler.length) {
          const b = await malKabul({ subeId: sube, tedarikciAd: "Demo Toptan Tekstil", belgeNo: `IRS-${rint(2000, 9999)}`, kalemler }, kisi);
          await tarihAyarla(b.id, tarih);
        }
      }
    }
    for (const [sube, kisi, kasiyer] of [[merkez.id, A.m, A.k], [sube2.id, A.s2, A.s2]] as const) {
      const adet = rint(haftaSonu ? 3 : 1, haftaSonu ? 7 : 5) + (sube === sube2.id ? -1 : 0);
      for (let i = 0; i < Math.max(adet, 0); i++) {
        const stok = await stokOku(sube);
        const havuz = tumVaryant.filter((v) => stok.has(v.id) && v.agirlik > 0);
        if (!havuz.length) break;
        const toplamAgirlik = havuz.reduce((t, v) => t + v.agirlik, 0);
        let x = r() * toplamAgirlik;
        const secili = havuz.find((v) => (x -= v.agirlik) < 0) ?? havuz[0];
        const sepet = [{ varyantId: secili.id, adet: 1 }];
        if (r() < 0.25) {
          const ek = sec(havuz.filter((v) => v.id !== secili.id));
          if (ek) sepet.push({ varyantId: ek.id, adet: 1 });
        }
        const yonetici = r() < 0.3;
        const kisi2 = yonetici ? kisi : kasiyer;
        const indirim = yonetici && r() < 0.4 ? sec([50, 100, 150, 200, 250]) : 0;
        try {
          const s = await satisYap({ subeId: sube, odemeTipi: sec(odemeler), kalemler: sepet, indirim }, kisi2);
          const seq = (sayac.get(`${sube}${yyyymmdd(tarih)}`) ?? 0) + 1;
          sayac.set(`${sube}${yyyymmdd(tarih)}`, seq);
          const kod = sube === merkez.id ? "MERKEZ" : "SUBE2";
          await prisma.satis.update({ where: { id: s.id }, data: { no: `${kod}-${yyyymmdd(tarih)}-${String(seq).padStart(4, "0")}` } });
          await tarihAyarla(s.id, new Date(tarih.getTime() + i * 47 * 60_000));
          if (r() < 0.03) iadeler.push(s.id);
          else if (!iptalEdildi && g < 20 && g > 5 && r() < 0.05) {
            await satisIptal(s.id, kisi);
            iptalEdildi = true;
          }
        } catch (e) {
          if (!/Yetersiz stok/.test(String((e as Error).message))) throw e;
        }
      }
    }
  }
  for (const id of iadeler) {
    const s = await prisma.satis.findUniqueOrThrow({ where: { id }, include: { kalemler: true } });
    if (s.durum === "TAMAMLANDI") await satisIade(id, [{ kalemId: s.kalemler[0].id, adet: 1 }], s.subeId === merkez.id ? A.m : A.s2);
  }

  // 4) Transferler: tamamlanmış, yolda, beklemede
  const merkezStok = await stokOku(merkez.id);
  const trVaryant = tumVaryant.filter((v) => (merkezStok.get(v.id) ?? 0) >= 2 && v.agirlik > 0).sort((a, b) => (merkezStok.get(b.id) ?? 0) - (merkezStok.get(a.id) ?? 0));
  if (trVaryant.length >= 3) {
    const t1 = await transferOlustur({ kaynakSubeId: merkez.id, hedefSubeId: sube2.id, notlar: "Haftalık dağıtım", kalemler: [{ varyantId: trVaryant[0].id, adet: 1 }] }, A.m);
    await transferGonder(t1.id, A.m);
    await transferTeslimAl(t1.id, A.s2);
    await tarihAyarla(t1.id, gunSonu(12));
    await prisma.stokHareketi.updateMany({ where: { belgeId: t1.id }, data: { createdAt: gunSonu(12) } });
    const t2 = await transferOlustur({ kaynakSubeId: merkez.id, hedefSubeId: sube2.id, notlar: "Yeni sezon ürünleri", kalemler: [{ varyantId: trVaryant[1].id, adet: 1 }] }, A.m);
    await transferGonder(t2.id, A.m);
    const t3 = await transferOlustur({ kaynakSubeId: merkez.id, hedefSubeId: sube2.id, notlar: "Vitrin için talep", kalemler: [{ varyantId: trVaryant[2].id, adet: 1 }] }, A.m);
    void t3;
  }

  // 5) İşletme giderleri ve diğer gelirler (aylık)
  const giderler: { kategori: string; tutar: number; aciklama: string; gun: number; sube?: string }[] = [];
  for (const ay of [0, 1, 2, 3]) {
    const gun = ay * 30 + 2;
    giderler.push({ kategori: "Kira", tutar: 38000, aciklama: "Merkez mağaza kirası", gun, sube: merkez.id });
    giderler.push({ kategori: "Kira", tutar: 27000, aciklama: "Şube 2 kirası", gun, sube: sube2.id });
    giderler.push({ kategori: "Maaş", tutar: 42000, aciklama: "Merkez personel maaşları", gun: gun + 3, sube: merkez.id });
    giderler.push({ kategori: "Maaş", tutar: 21000, aciklama: "Şube 2 personel maaşı", gun: gun + 3, sube: sube2.id });
    giderler.push({ kategori: "Elektrik / Su / Doğalgaz", tutar: rint(3200, 5200), aciklama: "Aylık faturalar", gun: gun + 6, sube: merkez.id });
    giderler.push({ kategori: "Kargo", tutar: rint(1800, 4200), aciklama: "Yurtiçi / yurtdışı kargo", gun: gun + 10 });
    giderler.push({ kategori: "Reklam", tutar: rint(2500, 6000), aciklama: "Instagram reklam", gun: gun + 12 });
  }
  for (const g of giderler) {
    if (g.gun > GERI) continue;
    await prisma.kasaKaydi.create({ data: { tip: "GIDER", kategori: g.kategori, tutar: g.tutar.toFixed(2), aciklama: g.aciklama, subeId: g.sube, kullaniciId: mMudur.id, kullaniciSnap: `${mMudur.ad} <${mMudur.email}>`, tarih: gunSonu(g.gun) } });
  }
  await prisma.kasaKaydi.create({ data: { tip: "GELIR", kategori: "Kargo geliri", tutar: "1850.00", aciklama: "Müşteriden tahsil edilen kargo bedeli", subeId: merkez.id, kullaniciId: mMudur.id, tarih: gunSonu(6) } });
  await prisma.kasaKaydi.create({ data: { tip: "GELIR", kategori: "Diğer", tutar: "4200.00", aciklama: "Vitrin ürünü toptan satış", subeId: merkez.id, kullaniciId: mMudur.id, tarih: gunSonu(20) } });

  await prisma.ayar.upsert({ where: { anahtar: "dukkanAdi" }, update: {}, create: { anahtar: "dukkanAdi", deger: "IQ Fashion" } });
  const ozet = {
    urun: await prisma.urun.count(), varyant: await prisma.varyant.count(), satis: await prisma.satis.count(),
    hareket: await prisma.stokHareketi.count(), alis: await prisma.alisBelgesi.count(), transfer: await prisma.transfer.count(), gider: await prisma.kasaKaydi.count(),
  };
  console.log("Demo veri hazır:", ozet);
}
