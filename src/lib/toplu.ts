// Toplu ürün girişi (AI analizinden sonra onaylanan satırlar). Her satır bir renk/beden varyantıdır.
// - varyantId verilmişse (barkod zaten kayıtlı)  -> mevcut varyanta stok eklenir (mal kabul)
// - aynı marka + ürün adı varsa                  -> o ürüne yeni varyant eklenir
// - yoksa                                        -> yeni ürün kartı açılır
// Her ürün grubu kendi transaction'ında işlenir; biri hata verirse diğerleri etkilenmez.
import { prisma } from "./db";
import { IsHatasi } from "./hatalar";
import { normalBeden, normalRenk } from "./giyim";
import { malKabul, urunOlustur, type Aktor, type YeniVaryant } from "./stok";

export type TopluSatir = {
  id: string; // istemci satır kimliği (sonuç eşleştirme)
  varyantId?: string | null;
  ad: string;
  markaAd?: string | null;
  kategoriAd?: string | null;
  cinsiyet?: "KADIN" | "ERKEK" | "COCUK" | "UNISEX" | null;
  sezon?: "YAZLIK" | "KISLIK" | "IKI_SEZON" | null;
  gorselUrl?: string | null;
  tedarikciAd?: string | null;
  renk: string;
  beden: string;
  barkod?: string | null;
  adet: number;
  alisFiyati: number;
  satisFiyati: number;
};

export type SatirSonucu = { id: string; durum: "yeni" | "varyant_eklendi" | "stok_eklendi" | "hata"; mesaj?: string };

const anahtar = (s?: string | null) => (s ?? "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

export async function topluUrunGirisi(satirlar: TopluSatir[], subeId: string, aktor: Aktor): Promise<SatirSonucu[]> {
  const sonuc = new Map<string, SatirSonucu>();
  const ok = (id: string, durum: SatirSonucu["durum"], mesaj?: string) => sonuc.set(id, { id, durum, mesaj });
  const hata = (id: string, e: unknown) => {
    let mesaj: string;
    if (e instanceof IsHatasi) mesaj = e.message;
    else {
      // Beklenmeyen hata: nedeni gizleme (kullanıcı ve log görsün), ama iç ayrıntıyı kısa tut
      const kod = (e as { code?: string })?.code;
      console.error("[toplu] beklenmeyen hata:", e);
      mesaj = kod === "P2002" ? "Bu barkod veya renk/beden zaten kayıtlı" : kod === "P2028" ? "Veritabanı meşgul/uyanıyor, birkaç saniye sonra tekrar deneyin" : `Kaydedilemedi (${kod ?? String((e as Error)?.message ?? "bilinmeyen").slice(0, 80)})`;
    }
    sonuc.set(id, { id, durum: "hata", mesaj });
  };

  // Temel doğrulama
  const gecerli: TopluSatir[] = [];
  for (const s of satirlar) {
    if (!s.ad.trim()) hata(s.id, new IsHatasi("Ürün adı boş"));
    else if (!s.varyantId && (!s.renk.trim() || !s.beden.trim())) hata(s.id, new IsHatasi("Renk ve beden gerekli"));
    else if (!Number.isInteger(s.adet) || s.adet < 1) hata(s.id, new IsHatasi("Adet en az 1 olmalı"));
    else if (!(s.alisFiyati >= 0) || !(s.satisFiyati >= 0)) hata(s.id, new IsHatasi("Fiyat geçersiz"));
    else gecerli.push({ ...s, renk: normalRenk(s.renk), beden: normalBeden(s.beden) });
  }

  // 0) BARKOD KURALI (sunucu karar verir, istemcinin işaretine güvenilmez):
  //    - barkod sistemde VAR ve renk/beden de AYNI  -> o varyanta stok eklenir;
  //    - barkod sistemde var ama renk/beden FARKLI   -> farklı bir varyanttır (aynı barkod iki renkte/bedende basılmış olabilir):
  //      veri birleştirilmez; satır yeni varyant olarak açılır ve sistem kendi barkodunu verir (uyarı gösterilir);
  //    - barkod yok -> yeni ürün/varyant.
  const uyarilar = new Map<string, string>();
  const ayniVaryant = (a: { renk: string; beden: string }, b: { renk: string; beden: string }) => anahtar(a.renk) === anahtar(b.renk) && anahtar(a.beden) === anahtar(b.beden);
  const kodlar = [...new Set(gecerli.filter((s) => !s.varyantId && s.barkod?.trim()).map((s) => s.barkod!.trim()))];
  if (kodlar.length) {
    const kayitli = await prisma.varyant.findMany({ where: { barkod: { in: kodlar } }, select: { id: true, barkod: true, renk: true, beden: true } });
    const harita = new Map(kayitli.map((v) => [v.barkod, v]));
    for (const s of gecerli) {
      const kod = s.barkod?.trim();
      if (s.varyantId || !kod) continue;
      const v = harita.get(kod);
      if (!v) continue;
      if (ayniVaryant(v, s)) s.varyantId = v.id;
      else {
        s.barkod = null;
        uyarilar.set(s.id, `Barkod ${kod} başka varyantta kayıtlı (${v.renk}/${v.beden}); bu satır ayrı varyant olarak açıldı, sistem barkodu verildi`);
      }
    }
  }
  //    Aynı YENİ barkod aynı yüklemede birden çok satırda: aynı renk/beden ise tek satır (adetler toplanır);
  //    farklı renk/beden ise barkod yalnız İLK satırda kalır, diğerlerine sistem barkodu verilir.
  const birlesenler = new Map<string, string[]>();
  const gorulen = new Map<string, TopluSatir>();
  const kalan: TopluSatir[] = [];
  for (const s of gecerli) {
    const kod = s.varyantId ? "" : (s.barkod?.trim() ?? "");
    if (kod) {
      const ana = gorulen.get(kod);
      if (ana && ayniVaryant(ana, s)) {
        ana.adet += s.adet;
        birlesenler.set(ana.id, [...(birlesenler.get(ana.id) ?? []), s.id]);
        continue;
      }
      if (ana) {
        s.barkod = null;
        uyarilar.set(s.id, `Aynı barkod (${kod}) birden fazla renk/bedende okundu; ilk satırda bırakıldı, bu satıra sistem barkodu verildi`);
      } else gorulen.set(kod, s);
    }
    kalan.push(s);
  }
  // 1) Zaten kayıtlı barkodlar -> tek mal kabul belgesi
  const mevcutlar = kalan.filter((s) => s.varyantId);
  if (mevcutlar.length) {
    try {
      await malKabul({ subeId, tedarikciAd: mevcutlar[0].tedarikciAd, notlar: "Toplu giriş (AI)", kalemler: mevcutlar.map((s) => ({ varyantId: s.varyantId!, adet: s.adet, birimMaliyet: s.alisFiyati, satisFiyati: s.satisFiyati > 0 ? s.satisFiyati : undefined })) }, aktor);
      for (const s of mevcutlar) ok(s.id, "stok_eklendi", "Mevcut ürüne stok eklendi");
    } catch (e) {
      for (const s of mevcutlar) hata(s.id, e);
    }
  }

  // 2) Yeni varyantlar: marka + ad'a göre grupla
  const gruplar = new Map<string, TopluSatir[]>();
  for (const s of kalan.filter((x) => !x.varyantId)) {
    const k = `${anahtar(s.markaAd)}|${anahtar(s.ad)}`;
    gruplar.set(k, [...(gruplar.get(k) ?? []), s]);
  }

  for (const grup of gruplar.values()) {
    try {
      // Grup içinde aynı renk/beden satırlarını birleştir (adet toplanır)
      const birlesik = new Map<string, TopluSatir>();
      for (const s of grup) {
        const k = `${anahtar(s.renk)}|${anahtar(s.beden)}`;
        const o = birlesik.get(k);
        if (o) o.adet += s.adet;
        else birlesik.set(k, { ...s });
      }
      const ilk = grup[0];
      const mevcutUrun = await prisma.urun.findFirst({
        where: { aktif: true, ad: { equals: ilk.ad.trim(), mode: "insensitive" }, marka: ilk.markaAd?.trim() ? { ad: { equals: ilk.markaAd.trim(), mode: "insensitive" } } : null },
        include: { varyantlar: true },
      });

      const yeniVaryantlar: YeniVaryant[] = [];
      const stokEklenecek: TopluSatir[] = [];
      for (const s of birlesik.values()) {
        const var_ = mevcutUrun?.varyantlar.find((v) => anahtar(v.renk) === anahtar(s.renk) && anahtar(v.beden) === anahtar(s.beden));
        if (var_) stokEklenecek.push({ ...s, varyantId: var_.id });
        else yeniVaryantlar.push({ renk: s.renk, beden: s.beden, barkod: s.barkod || undefined, alisFiyati: s.alisFiyati, satisFiyati: s.satisFiyati, adet: s.adet, minStok: 1 });
      }
      if (yeniVaryantlar.length) {
        await urunOlustur(
          { ad: ilk.ad, markaAd: ilk.markaAd, kategoriAd: ilk.kategoriAd, cinsiyet: ilk.cinsiyet, sezon: ilk.sezon, gorselUrl: grup.find((s) => s.gorselUrl)?.gorselUrl ?? null, tedarikciAd: ilk.tedarikciAd, varyantlar: yeniVaryantlar },
          subeId,
          aktor,
          mevcutUrun?.id,
        );
      }
      if (stokEklenecek.length) {
        await malKabul({ subeId, tedarikciAd: ilk.tedarikciAd, notlar: "Toplu giriş (AI)", kalemler: stokEklenecek.map((s) => ({ varyantId: s.varyantId!, adet: s.adet, birimMaliyet: s.alisFiyati })) }, aktor);
      }
      for (const s of grup) ok(s.id, mevcutUrun ? "varyant_eklendi" : "yeni", mevcutUrun ? `"${mevcutUrun.ad}" ürününe eklendi` : undefined);
    } catch (e) {
      for (const s of grup) hata(s.id, e);
    }
  }
  // Uyarıları (barkod çakışması vb.) başarılı satırların mesajına ekle
  for (const [id, u] of uyarilar) {
    const r = sonuc.get(id);
    if (r && r.durum !== "hata") sonuc.set(id, { ...r, mesaj: [r.mesaj, u].filter(Boolean).join(" · ") });
  }
  // Birleştirilen satırlar, ana satırın sonucunu paylaşır
  for (const [anaId, liste] of birlesenler) {
    const r = sonuc.get(anaId);
    for (const id of liste) sonuc.set(id, r ? { id, durum: r.durum, mesaj: r.durum === "hata" ? r.mesaj : "Aynı barkodlu satırla birleştirildi" } : { id, durum: "hata", mesaj: "İşlenemedi" });
  }
  return satirlar.map((s) => sonuc.get(s.id) ?? { id: s.id, durum: "hata", mesaj: "İşlenemedi" });
}
