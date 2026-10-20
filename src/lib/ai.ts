// Ürün etiketi / fotoğrafı okuma. Sağlayıcı zinciri: Groq (anahtar döngüsü) -> Gemini (model zinciri).
// Barkod rakamları AI'dan gelse bile EAN sağlama toplamından geçer; geçmezse güvenilmez sayılır.
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "./db";
import { IsHatasi } from "./hatalar";
import { barkodTemizle, eanGecerli } from "./barkod";
import { normalBeden, normalRenk } from "./giyim";

export type Gorsel = { mime: string; base64: string };

// Groq normalde ~1 sn'de yanıt verir; takılan bir isteği 15 sn'de bırakıp diğer anahtara/sağlayıcıya geç (eskiden 40 sn x 2 anahtar = 80 sn bekleyen satırlar vardı)
const ZAMAN_ASIMI_MS = 15_000;
const GEMINI_ZAMAN_ASIMI_MS = 30_000;
const YENIDEN_DENENIR = new Set([401, 403, 404, 408, 413, 429, 500, 502, 503, 504]);

type FetchFn = typeof fetch;
export type AiSecenek = { fetch?: FetchFn; kullaniciId?: string; onbellek?: boolean };

// ---------- Ayarlar ----------
const liste = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const groqAnahtarlari = () => liste(process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY);
const groqModeli = () => process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
const geminiModelleri = () => {
  const m = liste(process.env.GEMINI_MODEL);
  return m.length ? m : ["gemini-3-flash-preview", "gemini-flash-latest"];
};
const sira = () => liste(process.env.AI_SIRA || "groq,gemini").filter((s) => s === "groq" || s === "gemini");

export function aiHazirMi(): boolean {
  return (sira().includes("groq") && groqAnahtarlari().length > 0) || (sira().includes("gemini") && !!process.env.GEMINI_API_KEY);
}

// ---------- Ham çağrılar ----------
async function zamanAsimliFetch(f: FetchFn, url: string, init: RequestInit, sure = ZAMAN_ASIMI_MS): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), sure);
  try {
    return await f(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

let groqSayac = 0;

async function groqIste(f: FetchFn, g: Gorsel, istem: string): Promise<string> {
  const anahtarlar = groqAnahtarlari();
  if (!anahtarlar.length) throw new Error("groq anahtari yok");
  const baslangic = groqSayac++ % anahtarlar.length; // yükü iki anahtara dağıt
  let sonHata = "";
  for (let i = 0; i < anahtarlar.length; i++) {
    const anahtar = anahtarlar[(baslangic + i) % anahtarlar.length];
    try {
      const r = await zamanAsimliFetch(f, "https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${anahtar}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: groqModeli(),
          temperature: 0.1,
          max_completion_tokens: 1500,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: [{ type: "text", text: istem }, { type: "image_url", image_url: { url: `data:${g.mime};base64,${g.base64}` } }] }],
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const secim = d.choices?.[0];
        if (secim?.finish_reason === "length") { sonHata = "yanıt kesildi"; continue; }
        const metin = secim?.message?.content;
        if (typeof metin === "string" && metin.trim()) return metin;
        sonHata = "boş yanıt";
        continue;
      }
      sonHata = `groq ${r.status}: ${d?.error?.message ?? ""}`.slice(0, 160);
      if (!YENIDEN_DENENIR.has(r.status)) throw new Error(sonHata);
    } catch (e) {
      sonHata = (e as Error).name === "AbortError" ? "groq zaman aşımı" : (e as Error).message;
    }
  }
  throw new Error(sonHata || "groq başarısız");
}

async function geminiIste(f: FetchFn, g: Gorsel, istem: string): Promise<string> {
  const anahtar = process.env.GEMINI_API_KEY;
  if (!anahtar) throw new Error("gemini anahtari yok");
  let sonHata = "";
  for (const model of geminiModelleri()) {
    try {
      const r = await zamanAsimliFetch(f, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": anahtar, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: istem }, { inline_data: { mime_type: g.mime, data: g.base64 } }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const metin = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof metin === "string" && metin.trim()) return metin;
        sonHata = "gemini boş yanıt";
        continue;
      }
      sonHata = `gemini(${model}) ${r.status}`;
      if (!YENIDEN_DENENIR.has(r.status)) throw new Error(sonHata);
    } catch (e) {
      sonHata = (e as Error).name === "AbortError" ? `gemini(${model}) zaman aşımı` : (e as Error).message;
    }
  }
  throw new Error(sonHata || "gemini başarısız");
}

export async function metinUret(g: Gorsel, istem: string, f: FetchFn = fetch): Promise<{ metin: string; saglayici: string }> {
  const hatalar: string[] = [];
  for (const s of sira()) {
    try {
      if (s === "groq" && groqAnahtarlari().length) return { metin: await groqIste(f, g, istem), saglayici: "groq" };
      if (s === "gemini" && process.env.GEMINI_API_KEY) return { metin: await geminiIste(f, g, istem), saglayici: "gemini" };
    } catch (e) {
      hatalar.push((e as Error).message);
    }
  }
  console.error("[ai] tüm sağlayıcılar başarısız:", hatalar.join(" | "));
  if (!aiHazirMi()) throw new IsHatasi("Yapay zeka henüz yapılandırılmamış (API anahtarı yok). Bilgileri elle girebilirsiniz.", 502);
  throw new IsHatasi("Yapay zeka şu an yanıt vermiyor. Biraz sonra tekrar deneyin ya da bilgileri elle girin.", 502);
}

// ---------- JSON çıkarma ----------
export function jsonCikar(metin: string): unknown {
  const t = metin.replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("json yok");
  return JSON.parse(t.slice(a, b + 1));
}

// ---------- Etiket okuma ----------
const sayiTR = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const t = v.replace(/[^\d.,]/g, "");
  if (!t) return null;
  // "1.790,50" -> 1790.50 ; "1790.5" -> 1790.5
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
}, z.number().nonnegative().nullable());

const yazi = z.preprocess((v) => (typeof v === "string" && v.trim() && !/^(null|yok|bilinmiyor|n\/a|-)$/i.test(v.trim()) ? v.trim() : null), z.string().max(120).nullable());

const HamSema = z.object({
  marka: yazi.optional(), urunAdi: yazi.optional(), kategori: yazi.optional(), renk: yazi.optional(), beden: yazi.optional(),
  barkod: z.preprocess((v) => (v === null || v === undefined ? null : String(v)), z.string().nullable()).optional(),
  fiyat: sayiTR.optional(), cinsiyet: yazi.optional(), sezon: yazi.optional(),
  guven: z.preprocess((v) => (typeof v === "number" ? Math.min(1, Math.max(0, v)) : null), z.number().nullable()).optional(),
});

export type EtiketSonucu = {
  marka: string | null; urunAdi: string | null; kategori: string | null; renk: string | null; beden: string | null;
  barkod: string | null; barkodGecerli: boolean; fiyat: number | null;
  cinsiyet: "KADIN" | "ERKEK" | "COCUK" | "UNISEX" | null; sezon: "YAZLIK" | "KISLIK" | "IKI_SEZON" | null;
  guven: number | null; uyarilar: string[];
};

const ETIKET_ISTEMI = `Bu bir giyim ürününün etiketi veya fotoğrafı. Görüntüde AÇIKÇA okunan/görülen bilgileri çıkar.
Kurallar:
- Görmediğin veya emin olmadığın alanı null yaz. ASLA tahmin edip uydurma.
- "marka": etiket/logo üzerinde yazan marka. "urunAdi": ürünün kısa adı (örn: "Slim Fit Kot Pantolon", "Polo Yaka Tişört").
- "kategori": Takım Elbise, Pantolon, Gömlek, Tişört, Ceket, Mont, Kazak, Sweatshirt, Hırka, Eşofman, Şort, Elbise, Etek, Ayakkabı, Kemer, Çanta, Aksesuar, İç Giyim değerlerinden biri.
- "renk": ürünün rengi (Türkçe tek/iki kelime: Siyah, Lacivert, Açık Mavi...). "beden": etikette yazan beden (S, M, L, XL, 32, 32/34, 42...).
- "barkod": etiketteki barkodun ALTINDA yazan rakamlar (sadece rakam). Okuyamıyorsan null.
- "fiyat": etikette yazan fiyat (sayı, para birimi olmadan). "cinsiyet": KADIN, ERKEK, COCUK veya UNISEX. "sezon": YAZLIK, KISLIK veya IKI_SEZON.
- "guven": 0 ile 1 arası genel güvenin.
Yalnızca şu JSON'u döndür: {"marka":null,"urunAdi":null,"kategori":null,"renk":null,"beden":null,"barkod":null,"fiyat":null,"cinsiyet":null,"sezon":null,"guven":0}`;

const BARKOD_ISTEMI = `Görüntüdeki barkodun altında yazan rakamları oku. Yalnızca rakamları ve harfleri döndür, başka hiçbir şey ekleme.
Okuyamıyorsan null yaz. Yalnızca şu JSON'u döndür: {"barkod":null}`;

const ENUM = {
  cinsiyet: { KADIN: "KADIN", ERKEK: "ERKEK", COCUK: "COCUK", "ÇOCUK": "COCUK", UNISEX: "UNISEX" } as const,
  sezon: { YAZLIK: "YAZLIK", KISLIK: "KISLIK", "KIŞLIK": "KISLIK", IKI_SEZON: "IKI_SEZON", "İKİ_SEZON": "IKI_SEZON", "4 MEVSIM": "IKI_SEZON" } as const,
};

export function etiketNormalle(ham: unknown): EtiketSonucu {
  const p = HamSema.parse(ham);
  const uyarilar: string[] = [];
  const kod = p.barkod ? barkodTemizle(p.barkod) : "";
  const rakam = /^\d+$/.test(kod);
  const gecerli = rakam && eanGecerli(kod);
  let barkod: string | null = null;
  if (kod && gecerli) barkod = kod;
  else if (kod && rakam) uyarilar.push("Barkod rakamları sağlama toplamından geçmedi; yanlış okunmuş olabilir. Lütfen kontrol edin.");
  else if (kod) barkod = kod.length >= 4 ? kod : null;
  const cins = p.cinsiyet ? ENUM.cinsiyet[p.cinsiyet.toLocaleUpperCase("tr-TR") as keyof typeof ENUM.cinsiyet] ?? null : null;
  const sezon = p.sezon ? ENUM.sezon[p.sezon.toLocaleUpperCase("tr-TR").replace(" ", "_") as keyof typeof ENUM.sezon] ?? null : null;
  return {
    marka: p.marka ?? null, urunAdi: p.urunAdi ?? null, kategori: p.kategori ?? null,
    renk: p.renk ? normalRenk(p.renk) : null, beden: p.beden ? normalBeden(p.beden) : null,
    barkod, barkodGecerli: gecerli, fiyat: p.fiyat ?? null, cinsiyet: cins, sezon, guven: p.guven ?? null, uyarilar,
  };
}

export function gorselCoz(dataUrl: string): Gorsel {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new IsHatasi("Geçersiz görsel biçimi (JPEG, PNG veya WebP olmalı)");
  if (m[2].length > 5_500_000) throw new IsHatasi("Görsel çok büyük", 400);
  return { mime: m[1], base64: m[2] };
}

const gorselHash = (g: Gorsel) => createHash("sha256").update(g.base64).digest("hex");

async function hizSiniri(kullaniciId?: string) {
  if (!kullaniciId) return;
  const sayi = await prisma.aiKullanim.count({ where: { kullaniciId, createdAt: { gt: new Date(Date.now() - 60_000) } } });
  if (sayi >= 45) throw new IsHatasi("Çok hızlı istek gönderiyorsunuz. Bir dakika bekleyip tekrar deneyin.", 429);
}

async function calistir<T>(gorev: string, g: Gorsel, istem: string, donustur: (ham: unknown) => T, o: AiSecenek): Promise<T & { onbellek?: boolean }> {
  const hash = gorselHash(g);
  if (o.onbellek !== false) {
    const var_ = await prisma.aiKullanim.findFirst({ where: { hash, gorev, basarili: true, createdAt: { gt: new Date(Date.now() - 7 * 86_400_000) } }, orderBy: { createdAt: "desc" } });
    if (var_?.sonuc) return { ...(var_.sonuc as T), onbellek: true };
  }
  await hizSiniri(o.kullaniciId);
  let hata = "";
  for (let deneme = 0; deneme < 2; deneme++) {
    const { metin, saglayici } = await metinUret(g, deneme ? `${istem}\n\nÖnceki yanıtın geçerli JSON değildi. Sadece JSON döndür.` : istem, o.fetch);
    try {
      const sonuc = donustur(jsonCikar(metin));
      await prisma.aiKullanim.create({ data: { hash, saglayici, gorev, basarili: true, sonuc: sonuc as never, kullaniciId: o.kullaniciId } });
      return sonuc as T & { onbellek?: boolean };
    } catch (e) {
      hata = (e as Error).message;
    }
  }
  await prisma.aiKullanim.create({ data: { hash, saglayici: "-", gorev, basarili: false, kullaniciId: o.kullaniciId } });
  throw new IsHatasi(`Yapay zeka yanıtı anlaşılamadı (${hata.slice(0, 60)}). Daha net bir fotoğrafla tekrar deneyin.`, 502);
}

export const etiketOku = (g: Gorsel, o: AiSecenek = {}) => calistir("etiket", g, ETIKET_ISTEMI, etiketNormalle, o);

export type BarkodSonucu = { barkod: string | null; gecerli: boolean };
export const barkodOkuAI = (g: Gorsel, o: AiSecenek = {}) =>
  calistir<BarkodSonucu>("barkod", g, BARKOD_ISTEMI, (ham) => {
    const v = z.object({ barkod: z.preprocess((x) => (x === null || x === undefined ? null : String(x)), z.string().nullable()) }).parse(ham).barkod;
    const kod = v ? barkodTemizle(v) : "";
    return { barkod: kod || null, gecerli: /^\d+$/.test(kod) && eanGecerli(kod) };
  }, o);
