// Stok, satis, alis, transfer: tum yazma islemleri tek transaction icinde ve atomik.
// Bu modul "server-only" degildir (testler dogrudan calistirir); istek baglamina (cookie) bagimli degildir.
import { prisma } from "./db";
import type { Tx } from "./db";
import { IsHatasi } from "./hatalar";
import { dahiliBarkod } from "./barkod";
import { kurusa, liraya } from "./para";
import type { OdemeTipi, Rol } from "@/generated/prisma/client";

export type Aktor = { id: string; ad: string; email: string; rol: Rol; subeId: string | null };

const dec = (kurus: number) => liraya(kurus).toFixed(2);
const snap = (a: Aktor) => `${a.ad} <${a.email}>`;

// ---------- Sayaclar ----------

export async function sonrakiSayac(tx: Tx, ad: string): Promise<number> {
  const r = await tx.$queryRaw<{ deger: number }[]>`
    INSERT INTO "Sayac" ("ad", "deger") VALUES (${ad}, 1)
    ON CONFLICT ("ad") DO UPDATE SET "deger" = "Sayac"."deger" + 1
    RETURNING "deger"`;
  return Number(r[0].deger);
}

export async function yeniDahiliBarkod(tx: Tx): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const kod = dahiliBarkod(await sonrakiSayac(tx, "barkod"));
    if (!(await tx.varyant.findUnique({ where: { barkod: kod }, select: { id: true } }))) return kod;
  }
  throw new IsHatasi("Benzersiz barkod üretilemedi", 409);
}

// ---------- Stok yardimcilari ----------

async function stokArtir(tx: Tx, varyantId: string, subeId: string, adet: number) {
  await tx.stok.upsert({
    where: { varyantId_subeId: { varyantId, subeId } },
    create: { varyantId, subeId, miktar: adet },
    update: { miktar: { increment: adet } },
  });
}

async function stokAzalt(tx: Tx, varyantId: string, subeId: string, adet: number, etiket: string) {
  const r = await tx.stok.updateMany({
    where: { varyantId, subeId, miktar: { gte: adet } },
    data: { miktar: { decrement: adet } },
  });
  if (r.count === 0) {
    const mevcut = await tx.stok.findUnique({ where: { varyantId_subeId: { varyantId, subeId } } });
    throw new IsHatasi(`Yetersiz stok: ${etiket} (mevcut: ${mevcut?.miktar ?? 0}, istenen: ${adet})`, 409);
  }
}

const varyantEtiketi = (v: { urun: { ad: string }; renk: string; beden: string }) => `${v.urun.ad} ${v.renk}/${v.beden}`;

// ---------- Urun olusturma (AI sihirbazi / elle) ----------

export type YeniVaryant = { renk: string; beden: string; barkod?: string; alisFiyati: number; satisFiyati: number; adet: number; minStok?: number };
export type YeniUrun = {
  ad: string;
  markaAd?: string | null;
  kategoriAd?: string | null;
  cinsiyet?: "KADIN" | "ERKEK" | "COCUK" | "UNISEX" | null;
  sezon?: "YAZLIK" | "KISLIK" | "IKI_SEZON" | null;
  aciklama?: string | null;
  gorselUrl?: string | null;
  tedarikciAd?: string | null;
  varyantlar: YeniVaryant[];
};

export function skuUret(marka: string | null | undefined, ad: string, renk: string, beden: string, ek = ""): string {
  const k = (s: string, n: number) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/İ/g, "I").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, n) || "X";
  return [k(marka ?? "IQ", 4), k(ad, 6), k(renk, 3), k(beden, 4)].join("-") + ek;
}

export async function urunOlustur(girdi: YeniUrun, subeId: string, aktor: Aktor, mevcutUrunId?: string) {
  if (!girdi.varyantlar.length) throw new IsHatasi("En az bir renk/beden varyantı ekleyin");
  const anahtar = new Set<string>();
  for (const v of girdi.varyantlar) {
    const a = `${v.renk.toLowerCase()}|${v.beden.toLowerCase()}`;
    if (anahtar.has(a)) throw new IsHatasi(`Aynı renk/beden iki kez girilmiş: ${v.renk} / ${v.beden}`);
    anahtar.add(a);
  }
  return prisma.$transaction(async (tx) => {
    const ted = girdi.tedarikciAd?.trim() ? await tx.tedarikci.upsert({ where: { ad: girdi.tedarikciAd.trim() }, update: {}, create: { ad: girdi.tedarikciAd.trim() } }) : null;
    let marka: { id: string; ad: string } | null = null;
    let urun;
    if (mevcutUrunId) {
      urun = await tx.urun.findUnique({ where: { id: mevcutUrunId }, include: { marka: true } });
      if (!urun) throw new IsHatasi("Ürün bulunamadı", 404);
      marka = urun.marka;
    } else {
      marka = girdi.markaAd?.trim() ? await tx.marka.upsert({ where: { ad: girdi.markaAd.trim() }, update: {}, create: { ad: girdi.markaAd.trim() } }) : null;
      const kategori = girdi.kategoriAd?.trim() ? await tx.kategori.upsert({ where: { ad: girdi.kategoriAd.trim() }, update: {}, create: { ad: girdi.kategoriAd.trim() } }) : null;
      urun = await tx.urun.create({
        data: {
          ad: girdi.ad.trim(), markaId: marka?.id, kategoriId: kategori?.id, cinsiyet: girdi.cinsiyet ?? undefined, sezon: girdi.sezon ?? undefined,
          aciklama: girdi.aciklama ?? undefined, gorselUrl: girdi.gorselUrl ?? undefined, tedarikciId: ted?.id,
        },
      });
    }
    const sonuc = [];
    // Acilis stoku de bir alis belgesi olarak kaydedilir; boylece "alis" toplamlari dogru cikar
    const belge = girdi.varyantlar.some((v) => v.adet > 0)
      ? await tx.alisBelgesi.create({ data: { subeId, tedarikciId: ted?.id, kullaniciId: aktor.id, toplam: "0", notlar: `Ürün girişi: ${urun.ad}` } })
      : null;
    let belgeToplam = 0;
    for (const v of girdi.varyantlar) {
      let barkod = v.barkod?.trim();
      if (barkod) {
        const var_ = await tx.varyant.findUnique({ where: { barkod }, include: { urun: true } });
        if (var_) throw new IsHatasi(`Barkod zaten kayıtlı: ${barkod} (${varyantEtiketi(var_)})`, 409);
      } else barkod = await yeniDahiliBarkod(tx);
      const sku = await benzersizSku(tx, skuUret(marka?.ad, urun.ad, v.renk, v.beden));
      const kv = await tx.varyant.create({
        data: { urunId: urun.id, renk: v.renk.trim(), beden: v.beden.trim(), barkod, sku, alisFiyati: dec(kurusa(v.alisFiyati)), satisFiyati: dec(kurusa(v.satisFiyati)), minStok: v.minStok ?? 1 },
      });
      await tx.fiyatGecmisi.create({ data: { varyantId: kv.id, alis: dec(kurusa(v.alisFiyati)), satis: dec(kurusa(v.satisFiyati)), kullaniciId: aktor.id } });
      if (v.adet > 0 && belge) {
        await stokArtir(tx, kv.id, subeId, v.adet);
        await tx.alisKalemi.create({ data: { belgeId: belge.id, varyantId: kv.id, urunAdi: urun.ad, renk: kv.renk, beden: kv.beden, barkod, miktar: v.adet, birimMaliyet: dec(kurusa(v.alisFiyati)) } });
        await tx.stokHareketi.create({
          data: { tip: "ALIS", varyantId: kv.id, subeId, miktar: v.adet, birimMaliyet: dec(kurusa(v.alisFiyati)), belgeTipi: "ALIS", belgeId: belge.id, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: `${urun.ad} ${kv.renk}/${kv.beden}`, barkodSnap: barkod, aciklama: "Ürün kartı açılışı" },
        });
        belgeToplam += kurusa(v.alisFiyati) * v.adet;
      }
      sonuc.push(kv);
    }
    if (belge) await tx.alisBelgesi.update({ where: { id: belge.id }, data: { toplam: dec(belgeToplam) } });
    return { urun, varyantlar: sonuc };
  });
}

async function benzersizSku(tx: Tx, taban: string): Promise<string> {
  let sku = taban;
  for (let i = 2; await tx.varyant.findUnique({ where: { sku }, select: { id: true } }); i++) sku = `${taban}-${i}`;
  return sku;
}

// ---------- Mal kabul (alis) ----------

export type AlisKalem = { varyantId: string; adet: number; birimMaliyet: number; satisFiyati?: number };

/** Stok girisi. Maliyet: tum subelerdeki toplam stok uzerinden agirlikli ortalama. */
export async function malKabul(
  girdi: { subeId: string; tedarikciAd?: string | null; belgeNo?: string | null; notlar?: string | null; kalemler: AlisKalem[] },
  aktor: Aktor,
) {
  if (!girdi.kalemler.length) throw new IsHatasi("En az bir kalem ekleyin");
  return prisma.$transaction(async (tx) => {
    const ted = girdi.tedarikciAd?.trim() ? await tx.tedarikci.upsert({ where: { ad: girdi.tedarikciAd.trim() }, update: {}, create: { ad: girdi.tedarikciAd.trim() } }) : null;
    let toplam = 0;
    const belge = await tx.alisBelgesi.create({
      data: { subeId: girdi.subeId, tedarikciId: ted?.id, no: girdi.belgeNo ?? undefined, notlar: girdi.notlar ?? undefined, kullaniciId: aktor.id, toplam: "0" },
    });
    for (const k of girdi.kalemler) {
      if (!Number.isInteger(k.adet) || k.adet <= 0) throw new IsHatasi("Adet pozitif tam sayı olmalı");
      const v = await tx.varyant.findUnique({ where: { id: k.varyantId }, include: { urun: true } });
      if (!v) throw new IsHatasi("Ürün varyantı bulunamadı", 404);
      const yeniKurus = kurusa(k.birimMaliyet);
      const mevcutToplam = (await tx.stok.aggregate({ where: { varyantId: v.id }, _sum: { miktar: true } }))._sum.miktar ?? 0;
      const eskiKurus = kurusa(v.alisFiyati);
      const ortKurus = mevcutToplam > 0 ? Math.round((mevcutToplam * eskiKurus + k.adet * yeniKurus) / (mevcutToplam + k.adet)) : yeniKurus;
      // Mal kabulde SATIŞ fiyatı da güncellenebilir (yeni sezon/zamlı alış). Verilmezse mevcut satış fiyatı korunur.
      const eskiSatis = kurusa(v.satisFiyati);
      const yeniSatis = k.satisFiyati !== undefined && k.satisFiyati > 0 ? kurusa(k.satisFiyati) : eskiSatis;
      if (ortKurus !== eskiKurus || yeniSatis !== eskiSatis) {
        await tx.varyant.update({ where: { id: v.id }, data: { alisFiyati: dec(ortKurus), satisFiyati: dec(yeniSatis) } });
        await tx.fiyatGecmisi.create({ data: { varyantId: v.id, alis: dec(ortKurus), satis: dec(yeniSatis), kullaniciId: aktor.id } });
      }
      await stokArtir(tx, v.id, girdi.subeId, k.adet);
      await tx.alisKalemi.create({
        data: { belgeId: belge.id, varyantId: v.id, urunAdi: v.urun.ad, renk: v.renk, beden: v.beden, barkod: v.barkod, miktar: k.adet, birimMaliyet: dec(yeniKurus) },
      });
      await tx.stokHareketi.create({
        data: { tip: "ALIS", varyantId: v.id, subeId: girdi.subeId, miktar: k.adet, birimMaliyet: dec(yeniKurus), belgeTipi: "ALIS", belgeId: belge.id, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: varyantEtiketi(v), barkodSnap: v.barkod },
      });
      toplam += yeniKurus * k.adet;
    }
    return tx.alisBelgesi.update({ where: { id: belge.id }, data: { toplam: dec(toplam) } });
  });
}

// ---------- Satis ----------

export type SatisKalem = { varyantId: string; adet: number; birimFiyat?: number };

export async function satisYap(
  girdi: { subeId: string; kalemler: SatisKalem[]; odemeTipi: OdemeTipi; indirim?: number; notlar?: string | null },
  aktor: Aktor,
) {
  if (!girdi.kalemler.length) throw new IsHatasi("Sepet boş");
  const yonetici = aktor.rol !== "KASIYER";
  if (!yonetici && (girdi.indirim || girdi.kalemler.some((k) => k.birimFiyat !== undefined))) {
    throw new IsHatasi("Fiyat/indirim değişikliği için yönetici yetkisi gerekir");
  }
  // Ayni varyanti birlestir
  const birlesik = new Map<string, SatisKalem>();
  for (const k of girdi.kalemler) {
    if (!Number.isInteger(k.adet) || k.adet <= 0) throw new IsHatasi("Adet pozitif tam sayı olmalı");
    const o = birlesik.get(k.varyantId);
    if (o) o.adet += k.adet;
    else birlesik.set(k.varyantId, { ...k });
  }
  return prisma.$transaction(async (tx) => {
    const sube = await tx.sube.update({ where: { id: girdi.subeId }, data: { satisSayac: { increment: 1 } } });
    if (!sube.aktif) throw new IsHatasi("Şube pasif", 409);
    const gun = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
    const no = `${sube.kod}-${gun}-${String(sube.satisSayac).padStart(4, "0")}`;

    const satirlar: { v: Awaited<ReturnType<typeof getir>>[number]; adet: number; fiyatKurus: number; maliyetKurus: number }[] = [];
    const varyantlar = await getir(tx, [...birlesik.keys()]);
    for (const [id, k] of birlesik) {
      const v = varyantlar.find((x) => x.id === id);
      if (!v || !v.aktif) throw new IsHatasi("Ürün bulunamadı veya pasif", 404);
      const fiyat = k.birimFiyat !== undefined ? kurusa(k.birimFiyat) : kurusa(v.satisFiyati);
      if (fiyat < 0) throw new IsHatasi("Fiyat negatif olamaz");
      satirlar.push({ v, adet: k.adet, fiyatKurus: fiyat, maliyetKurus: kurusa(v.alisFiyati) });
    }
    const ara = satirlar.reduce((t, s) => t + s.fiyatKurus * s.adet, 0);
    const indirim = kurusa(girdi.indirim ?? 0);
    if (indirim < 0 || indirim > ara) throw new IsHatasi("İndirim geçersiz");

    const satis = await tx.satis.create({
      data: { no, subeId: girdi.subeId, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), odemeTipi: girdi.odemeTipi, araToplam: dec(ara), indirim: dec(indirim), toplam: dec(ara - indirim), maliyet: "0", notlar: girdi.notlar ?? undefined },
    });
    let kalanIndirim = indirim;
    let maliyet = 0;
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i];
      const satirTutar = s.fiyatKurus * s.adet;
      // indirim satir tutarlarina orantili dagitilir, son satir kalani alir
      const pay = i === satirlar.length - 1 ? kalanIndirim : ara > 0 ? Math.round((indirim * satirTutar) / ara) : 0;
      kalanIndirim -= pay;
      await stokAzalt(tx, s.v.id, girdi.subeId, s.adet, varyantEtiketi(s.v));
      await tx.satisKalemi.create({
        data: {
          satisId: satis.id, varyantId: s.v.id, urunAdi: s.v.urun.ad, marka: s.v.urun.marka?.ad, kategori: s.v.urun.kategori?.ad,
          renk: s.v.renk, beden: s.v.beden, barkod: s.v.barkod, miktar: s.adet, birimFiyat: dec(s.fiyatKurus), birimMaliyet: dec(s.maliyetKurus), indirimPayi: dec(pay),
        },
      });
      await tx.stokHareketi.create({
        data: { tip: "SATIS", varyantId: s.v.id, subeId: girdi.subeId, miktar: s.adet, birimMaliyet: dec(s.maliyetKurus), birimSatis: dec(s.fiyatKurus), belgeTipi: "SATIS", belgeId: satis.id, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: varyantEtiketi(s.v), barkodSnap: s.v.barkod },
      });
      maliyet += s.maliyetKurus * s.adet;
    }
    return tx.satis.update({ where: { id: satis.id }, data: { maliyet: dec(maliyet) }, include: { kalemler: true } });
  });
}

function getir(tx: Tx, ids: string[]) {
  return tx.varyant.findMany({ where: { id: { in: ids } }, include: { urun: { include: { marka: true, kategori: true } } } });
}

/** Satisi iptal et: tum stoklar geri doner. Yalniz yonetici; kalan (iade edilmemis) adetler geri alinir. */
export async function satisIptal(satisId: string, aktor: Aktor) {
  if (aktor.rol === "KASIYER") throw new IsHatasi("İptal için yönetici yetkisi gerekir");
  return prisma.$transaction(async (tx) => {
    const s = await tx.satis.findUnique({ where: { id: satisId }, include: { kalemler: true } });
    if (!s) throw new IsHatasi("Satış bulunamadı", 404);
    if (aktor.rol === "SUBE_MUDURU" && s.subeId !== aktor.subeId) throw new IsHatasi("Bu satış başka şubeye ait", 404);
    const r = await tx.satis.updateMany({ where: { id: satisId, durum: "TAMAMLANDI" }, data: { durum: "IPTAL" } });
    if (r.count === 0) throw new IsHatasi("Satış zaten iptal edilmiş", 409);
    for (const k of s.kalemler) {
      const kalan = k.miktar - k.iadeAdet;
      if (kalan > 0 && k.varyantId) {
        await stokArtir(tx, k.varyantId, s.subeId, kalan);
        await tx.stokHareketi.create({
          data: { tip: "IADE", varyantId: k.varyantId, subeId: s.subeId, miktar: kalan, birimMaliyet: k.birimMaliyet.toString(), birimSatis: k.birimFiyat.toString(), belgeTipi: "SATIS_IPTAL", belgeId: s.id, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: `${k.urunAdi} ${k.renk}/${k.beden}`, barkodSnap: k.barkod, aciklama: `Satış iptali ${s.no}` },
        });
      }
    }
    return tx.satis.findUniqueOrThrow({ where: { id: satisId } });
  });
}

/** Kismi iade: kalem bazinda adet. */
export async function satisIade(satisId: string, kalemler: { kalemId: string; adet: number }[], aktor: Aktor) {
  if (aktor.rol === "KASIYER") throw new IsHatasi("İade için yönetici yetkisi gerekir");
  if (!kalemler.length) throw new IsHatasi("İade edilecek kalem seçin");
  return prisma.$transaction(async (tx) => {
    const s = await tx.satis.findUnique({ where: { id: satisId }, include: { kalemler: true } });
    if (!s || (aktor.rol === "SUBE_MUDURU" && s.subeId !== aktor.subeId)) throw new IsHatasi("Satış bulunamadı", 404);
    if (s.durum !== "TAMAMLANDI") throw new IsHatasi("İptal edilmiş satışta iade yapılamaz", 409);
    let iadeKurus = 0;
    for (const i of kalemler) {
      if (!Number.isInteger(i.adet) || i.adet <= 0) throw new IsHatasi("İade adedi pozitif tam sayı olmalı");
      const k = s.kalemler.find((x) => x.id === i.kalemId);
      if (!k) throw new IsHatasi("Kalem bulunamadı", 404);
      // Es zamanli iade yarisina karsi kosullu guncelleme
      const r = await tx.satisKalemi.updateMany({ where: { id: k.id, iadeAdet: { lte: k.miktar - i.adet } }, data: { iadeAdet: { increment: i.adet } } });
      if (r.count === 0) throw new IsHatasi(`İade adedi satılan adedi aşıyor: ${k.urunAdi} ${k.renk}/${k.beden}`, 409);
      if (k.varyantId) await stokArtir(tx, k.varyantId, s.subeId, i.adet);
      const net = Math.round(((kurusa(k.birimFiyat) * k.miktar - kurusa(k.indirimPayi)) * i.adet) / k.miktar);
      iadeKurus += net;
      await tx.stokHareketi.create({
        data: { tip: "IADE", varyantId: k.varyantId, subeId: s.subeId, miktar: i.adet, birimMaliyet: k.birimMaliyet.toString(), birimSatis: dec(Math.round(net / i.adet)), belgeTipi: "SATIS_IADE", belgeId: s.id, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: `${k.urunAdi} ${k.renk}/${k.beden}`, barkodSnap: k.barkod, aciklama: `İade ${s.no}` },
      });
    }
    return { iadeTutari: liraya(iadeKurus) };
  });
}

// ---------- Duzeltme / sayim ----------

export async function stokDuzelt(girdi: { varyantId: string; subeId: string; yeniMiktar: number; aciklama?: string; sayim?: boolean }, aktor: Aktor) {
  if (!Number.isInteger(girdi.yeniMiktar) || girdi.yeniMiktar < 0) throw new IsHatasi("Miktar 0 veya pozitif tam sayı olmalı");
  return prisma.$transaction(async (tx) => {
    const v = await tx.varyant.findUnique({ where: { id: girdi.varyantId }, include: { urun: true } });
    if (!v) throw new IsHatasi("Ürün bulunamadı", 404);
    await tx.stok.upsert({ where: { varyantId_subeId: { varyantId: v.id, subeId: girdi.subeId } }, create: { varyantId: v.id, subeId: girdi.subeId, miktar: 0 }, update: {} });
    // Satiri kilitle, farki guvenle hesapla
    const satir = await tx.$queryRaw<{ miktar: number }[]>`SELECT "miktar" FROM "Stok" WHERE "varyantId" = ${v.id} AND "subeId" = ${girdi.subeId} FOR UPDATE`;
    const eski = Number(satir[0].miktar);
    const fark = girdi.yeniMiktar - eski;
    if (fark === 0) return { fark: 0, eski, yeni: eski };
    await tx.stok.update({ where: { varyantId_subeId: { varyantId: v.id, subeId: girdi.subeId } }, data: { miktar: girdi.yeniMiktar } });
    await tx.stokHareketi.create({
      data: { tip: girdi.sayim ? "SAYIM" : fark > 0 ? "DUZELTME_ARTIS" : "DUZELTME_AZALIS", varyantId: v.id, subeId: girdi.subeId, miktar: Math.abs(fark), birimMaliyet: v.alisFiyati.toString(), kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: varyantEtiketi(v), barkodSnap: v.barkod, aciklama: girdi.aciklama ?? (girdi.sayim ? `Sayım: ${eski} → ${girdi.yeniMiktar}` : `Düzeltme: ${eski} → ${girdi.yeniMiktar}`) },
    });
    return { fark, eski, yeni: girdi.yeniMiktar };
  });
}

// ---------- Transfer ----------
// BEKLEMEDE -> (gonder) YOLDA [kaynaktan duser] -> (teslim al) TAMAMLANDI [hedefe eklenir]; YOLDA'dan iptal kaynagi geri yukler.

export async function transferOlustur(girdi: { kaynakSubeId: string; hedefSubeId: string; notlar?: string | null; kalemler: { varyantId: string; adet: number }[] }, aktor: Aktor) {
  if (girdi.kaynakSubeId === girdi.hedefSubeId) throw new IsHatasi("Kaynak ve hedef şube aynı olamaz");
  if (!girdi.kalemler.length) throw new IsHatasi("En az bir kalem ekleyin");
  return prisma.$transaction(async (tx) => {
    const hedef = await tx.sube.findUnique({ where: { id: girdi.hedefSubeId } });
    if (!hedef?.aktif) throw new IsHatasi("Hedef şube bulunamadı veya pasif", 404);
    const no = `TR-${String(await sonrakiSayac(tx, "transfer")).padStart(5, "0")}`;
    const birlesik = new Map<string, number>();
    for (const k of girdi.kalemler) {
      if (!Number.isInteger(k.adet) || k.adet <= 0) throw new IsHatasi("Adet pozitif tam sayı olmalı");
      birlesik.set(k.varyantId, (birlesik.get(k.varyantId) ?? 0) + k.adet);
    }
    const vs = await getir(tx, [...birlesik.keys()]);
    if (vs.length !== birlesik.size) throw new IsHatasi("Ürün bulunamadı", 404);
    return tx.transfer.create({
      data: {
        no, kaynakSubeId: girdi.kaynakSubeId, hedefSubeId: girdi.hedefSubeId, kullaniciId: aktor.id, notlar: girdi.notlar ?? undefined,
        kalemler: { create: vs.map((v) => ({ varyantId: v.id, urunAdi: v.urun.ad, renk: v.renk, beden: v.beden, barkod: v.barkod, miktar: birlesik.get(v.id)! })) },
      },
      include: { kalemler: true },
    });
  });
}

export async function transferGonder(transferId: string, aktor: Aktor) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.transfer.findUnique({ where: { id: transferId }, include: { kalemler: true } });
    if (!t) throw new IsHatasi("Transfer bulunamadı", 404);
    if (aktor.rol !== "SUPER_ADMIN" && t.kaynakSubeId !== aktor.subeId) throw new IsHatasi("Sadece kaynak şube gönderebilir", 403);
    const r = await tx.transfer.updateMany({ where: { id: transferId, durum: "BEKLEMEDE" }, data: { durum: "YOLDA" } });
    if (r.count === 0) throw new IsHatasi("Transfer bu durumda gönderilemez", 409);
    for (const k of t.kalemler) {
      await stokAzalt(tx, k.varyantId, t.kaynakSubeId, k.miktar, `${k.urunAdi} ${k.renk}/${k.beden}`);
      await tx.stokHareketi.create({
        data: { tip: "TRANSFER_CIKIS", varyantId: k.varyantId, subeId: t.kaynakSubeId, miktar: k.miktar, belgeTipi: "TRANSFER", belgeId: t.id, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: `${k.urunAdi} ${k.renk}/${k.beden}`, barkodSnap: k.barkod, aciklama: `${t.no} gönderildi` },
      });
    }
    return tx.transfer.findUniqueOrThrow({ where: { id: transferId } });
  });
}

export async function transferTeslimAl(transferId: string, aktor: Aktor) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.transfer.findUnique({ where: { id: transferId }, include: { kalemler: true } });
    if (!t) throw new IsHatasi("Transfer bulunamadı", 404);
    if (aktor.rol !== "SUPER_ADMIN" && t.hedefSubeId !== aktor.subeId) throw new IsHatasi("Sadece hedef şube teslim alabilir", 403);
    const r = await tx.transfer.updateMany({ where: { id: transferId, durum: "YOLDA" }, data: { durum: "TAMAMLANDI" } });
    if (r.count === 0) throw new IsHatasi("Transfer bu durumda teslim alınamaz", 409);
    for (const k of t.kalemler) {
      await stokArtir(tx, k.varyantId, t.hedefSubeId, k.miktar);
      await tx.stokHareketi.create({
        data: { tip: "TRANSFER_GIRIS", varyantId: k.varyantId, subeId: t.hedefSubeId, miktar: k.miktar, belgeTipi: "TRANSFER", belgeId: t.id, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: `${k.urunAdi} ${k.renk}/${k.beden}`, barkodSnap: k.barkod, aciklama: `${t.no} teslim alındı` },
      });
    }
    return tx.transfer.findUniqueOrThrow({ where: { id: transferId } });
  });
}

export async function transferIptal(transferId: string, aktor: Aktor) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.transfer.findUnique({ where: { id: transferId }, include: { kalemler: true } });
    if (!t) throw new IsHatasi("Transfer bulunamadı", 404);
    if (aktor.rol !== "SUPER_ADMIN" && t.kaynakSubeId !== aktor.subeId && t.hedefSubeId !== aktor.subeId) throw new IsHatasi("Transfer bulunamadı", 404);
    const eski = t.durum;
    const r = await tx.transfer.updateMany({ where: { id: transferId, durum: { in: ["BEKLEMEDE", "YOLDA"] } }, data: { durum: "IPTAL" } });
    if (r.count === 0) throw new IsHatasi("Transfer bu durumda iptal edilemez", 409);
    if (eski === "YOLDA") {
      for (const k of t.kalemler) {
        await stokArtir(tx, k.varyantId, t.kaynakSubeId, k.miktar);
        await tx.stokHareketi.create({
          data: { tip: "TRANSFER_GIRIS", varyantId: k.varyantId, subeId: t.kaynakSubeId, miktar: k.miktar, belgeTipi: "TRANSFER", belgeId: t.id, kullaniciId: aktor.id, kullaniciSnap: snap(aktor), urunAdiSnap: `${k.urunAdi} ${k.renk}/${k.beden}`, barkodSnap: k.barkod, aciklama: `${t.no} iptal, stok iade` },
        });
      }
    }
    return tx.transfer.findUniqueOrThrow({ where: { id: transferId } });
  });
}


/** Ürün silinmeden önce gösterilecek kapsam */
export async function urunOzeti(urunId: string) {
  const varyantlar = await prisma.varyant.findMany({ where: { urunId }, select: { id: true } });
  const ids = varyantlar.map((v) => v.id);
  const [stok, satisKalemi, alisKalemi, transfer] = await Promise.all([
    prisma.stok.aggregate({ where: { varyantId: { in: ids } }, _sum: { miktar: true } }),
    prisma.satisKalemi.count({ where: { varyantId: { in: ids } } }),
    prisma.alisKalemi.count({ where: { varyantId: { in: ids } } }),
    prisma.transferKalemi.count({ where: { varyantId: { in: ids } } }),
  ]);
  return { varyant: ids.length, stokAdedi: stok._sum.miktar ?? 0, satisKalemi, alisKalemi, transfer };
}

/**
 * Ürünü KALICI siler: ürün kartı, tüm varyantları, şube stokları, fiyat geçmişi ve transfer kalemleri gider.
 * Muhasebe bozulmasın diye geçmiş satış/alış belgeleri ve stok hareketleri (ürün adı yazılı kalarak) korunur.
 */
export async function urunSil(urunId: string) {
  const u = await prisma.urun.findUnique({ where: { id: urunId }, select: { id: true, ad: true, gorselUrl: true } });
  if (!u) throw new IsHatasi("Ürün bulunamadı", 404);
  const ozet = await urunOzeti(urunId);
  await prisma.$transaction(async (tx) => {
    const ids = (await tx.varyant.findMany({ where: { urunId }, select: { id: true } })).map((v) => v.id);
    const etkilenen = await tx.transferKalemi.findMany({ where: { varyantId: { in: ids } }, select: { transferId: true } });
    await tx.transferKalemi.deleteMany({ where: { varyantId: { in: ids } } });
    // Kalemi kalmayan transfer belgeleri de kaldırılır
    for (const transferId of new Set(etkilenen.map((k) => k.transferId))) {
      if ((await tx.transferKalemi.count({ where: { transferId } })) === 0) await tx.transfer.delete({ where: { id: transferId } });
    }
    await tx.urun.delete({ where: { id: urunId } }); // varyant, stok, fiyat geçmişi cascade
    // Ürün fotoğrafı veritabanında durur: başka ürün kullanmıyorsa silinir (boş yer kaplamasın)
    const gid = /^\/api\/gorsel\/([\w-]+)$/.exec(u.gorselUrl ?? "")?.[1];
    if (gid && (await tx.urun.count({ where: { gorselUrl: u.gorselUrl } })) === 0) await tx.gorsel.deleteMany({ where: { id: gid } });
  });
  return { ad: u.ad, ...ozet };
}
