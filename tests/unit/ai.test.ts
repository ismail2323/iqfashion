import { beforeEach, describe, expect, it, vi } from "vitest";
import { barkodOkuAI, etiketNormalle, etiketOku, gorselCoz, jsonCikar } from "@/lib/ai";
import { bedenSirasi, normalBeden, normalRenk } from "@/lib/giyim";
import { prisma } from "@/lib/db";
import { temizle } from "./yardimci";

const G = { mime: "image/jpeg", base64: "QUJD" };
const groqYanit = (obj: unknown) => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(obj) } }] }), { status: 200 });
const geminiYanit = (obj: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
const hata = (status: number) => new Response(JSON.stringify({ error: { message: "x" } }), { status });
const ETIKET = { marka: "HUGO BLUE", urunAdi: "Slim Fit Jeans", renk: "LIGHT BLUE", beden: "W32 L34", fiyat: "1.790,00 TL", barkod: "4006381333931", kategori: "Pantolon", cinsiyet: "Erkek", sezon: "kışlık", guven: 0.9 };

beforeEach(async () => {
  await temizle();
  vi.stubEnv("GROQ_API_KEYS", "k1,k2");
  vi.stubEnv("GROQ_VISION_MODEL", "qwen/test");
  vi.stubEnv("GEMINI_API_KEY", "gk");
  vi.stubEnv("GEMINI_MODEL", "m1,m2");
  vi.stubEnv("AI_SIRA", "groq,gemini");
});

describe("etiket normalizasyonu", () => {
  it("renk, beden, fiyat, enum alanlarını tek biçime getirir", () => {
    const s = etiketNormalle(ETIKET);
    expect(s).toMatchObject({ marka: "HUGO BLUE", renk: "Açık Mavi", beden: "32/34", fiyat: 1790, barkod: "4006381333931", barkodGecerli: true, cinsiyet: "ERKEK", sezon: "KISLIK", guven: 0.9 });
  });
  it("sağlama toplamı geçersiz barkodu kabul etmez ve uyarır", () => {
    const s = etiketNormalle({ ...ETIKET, barkod: "4006381333932" });
    expect(s.barkod).toBeNull();
    expect(s.barkodGecerli).toBe(false);
    expect(s.uyarilar.join()).toMatch(/sağlama toplamı/);
  });
  it("null / 'bilinmiyor' alanlar null kalır, uydurma yok", () => {
    const s = etiketNormalle({ marka: "null", urunAdi: "Bilinmiyor", renk: "", beden: null, barkod: null, fiyat: "yok" });
    expect(s).toMatchObject({ marka: null, urunAdi: null, renk: null, beden: null, barkod: null, fiyat: null });
  });
  it("markdown çitli yanıttan JSON çıkarır", () => {
    expect(jsonCikar('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => jsonCikar("sadece metin")).toThrow();
  });
  it("görsel data URL'sini doğrular", () => {
    expect(gorselCoz("data:image/png;base64,QUJD")).toEqual({ mime: "image/png", base64: "QUJD" });
    expect(() => gorselCoz("data:text/html;base64,QUJD")).toThrow();
    expect(() => gorselCoz("javascript:alert(1)")).toThrow();
  });
});

describe("sağlayıcı zinciri", () => {
  it("ilk Groq anahtarı 429 verirse ikinci anahtarı dener", async () => {
    const f = vi.fn().mockResolvedValueOnce(hata(429)).mockResolvedValueOnce(groqYanit(ETIKET));
    const s = await etiketOku(G, { fetch: f as never, onbellek: false });
    expect(s.marka).toBe("HUGO BLUE");
    expect(f).toHaveBeenCalledTimes(2);
    const anahtarlar = f.mock.calls.map((c) => (c[1] as RequestInit).headers as Record<string, string>).map((h) => h.Authorization);
    expect(new Set(anahtarlar).size).toBe(2);
  });
  it("iki Groq anahtarı da başarısızsa Gemini'ye geçer; ilk Gemini modeli 404 ise sıradakini dener", async () => {
    const f = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("groq.com")) return hata(503);
      if (url.includes("/m1:")) return hata(404);
      return geminiYanit(ETIKET);
    });
    const s = await etiketOku(G, { fetch: f as never, onbellek: false });
    expect(s.renk).toBe("Açık Mavi");
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("gemini") || u.includes("googleapis")).length).toBe(2);
  });
  it("hepsi başarısızsa kullanıcıya anlaşılır Türkçe hata verir", async () => {
    const f = vi.fn().mockImplementation(async () => hata(500));
    await expect(etiketOku(G, { fetch: f as never, onbellek: false })).rejects.toThrow(/şu an yanıt vermiyor/);
  });
  it("geçersiz JSON'da bir kez yeniden dener", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "bozuk" } }] }), { status: 200 }))
      .mockResolvedValueOnce(groqYanit(ETIKET));
    const s = await etiketOku(G, { fetch: f as never, onbellek: false });
    expect(s.beden).toBe("32/34");
  });
  it("kesilen yanıtı (finish_reason=length) başarı saymaz", async () => {
    const f = vi.fn().mockImplementation(async (url: string) =>
      url.includes("groq.com") ? new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{" } }] }), { status: 200 }) : geminiYanit(ETIKET));
    const s = await etiketOku(G, { fetch: f as never, onbellek: false });
    expect(s.marka).toBe("HUGO BLUE");
  });
});

describe("önbellek ve hız sınırı", () => {
  it("aynı görsel ikinci kez ağa gitmeden önbellekten gelir", async () => {
    const f = vi.fn().mockImplementation(async () => groqYanit(ETIKET));
    const g = { mime: "image/jpeg", base64: "UVJTVA==" };
    const a = await etiketOku(g, { fetch: f as never });
    const b = await etiketOku(g, { fetch: f as never });
    expect(f).toHaveBeenCalledTimes(1);
    expect(a.onbellek).toBeUndefined();
    expect(b.onbellek).toBe(true);
    expect(b.marka).toBe("HUGO BLUE");
  });
  it("kullanıcı dakikada 25 AI isteğini aşamaz", async () => {
    const u = await prisma.kullanici.create({ data: { email: "x@x.com", ad: "X", sifreHash: "h", rol: "SUPER_ADMIN" } });
    const f = vi.fn().mockImplementation(async () => groqYanit(ETIKET));
    for (let i = 0; i < 25; i++) await etiketOku({ mime: "image/jpeg", base64: `QQ${i}A` }, { fetch: f as never, kullaniciId: u.id });
    await expect(etiketOku({ mime: "image/jpeg", base64: "ZZZZ" }, { fetch: f as never, kullaniciId: u.id })).rejects.toThrow(/Çok hızlı/);
  });
  it("barkod okuma geçerliliği sağlama toplamıyla belirler", async () => {
    const f = vi.fn().mockResolvedValueOnce(groqYanit({ barkod: "4006381333931" })).mockResolvedValueOnce(groqYanit({ barkod: "4006381333930" }));
    expect(await barkodOkuAI({ mime: "image/jpeg", base64: "B1AA" }, { fetch: f as never })).toMatchObject({ barkod: "4006381333931", gecerli: true });
    expect(await barkodOkuAI({ mime: "image/jpeg", base64: "B2AA" }, { fetch: f as never })).toMatchObject({ gecerli: false });
  });
  it("anahtar yoksa yapılandırma hatası verir", async () => {
    vi.stubEnv("GROQ_API_KEYS", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(etiketOku(G, { onbellek: false })).rejects.toThrow(/yapılandırılmamış/);
  });
});

describe("giyim sözlüğü", () => {
  it("renk eş anlamlıları", () => {
    expect(normalRenk("black")).toBe("Siyah");
    expect(normalRenk("SİYAH")).toBe("Siyah");
    expect(normalRenk("Navy")).toBe("Lacivert");
    expect(normalRenk("light blue")).toBe("Açık Mavi");
    expect(normalRenk("Light Blue / Mavi")).toBe("Açık Mavi");
    expect(normalRenk("fuşya")).toBe("Fuşya");
    expect(normalRenk(null)).toBe("");
  });
  it("beden biçimleri", () => {
    expect(normalBeden("xl")).toBe("XL");
    expect(normalBeden("Large")).toBe("L");
    expect(normalBeden("2XL")).toBe("XXL");
    expect(normalBeden("W32 L34")).toBe("32/34");
    expect(normalBeden("32x34")).toBe("32/34");
    expect(normalBeden("W30")).toBe("30");
    expect(normalBeden("42")).toBe("42");
    expect(normalBeden("One Size")).toBe("STD");
  });
  it("beden sıralaması: harfliler küçükten büyüğe, sonra sayılar", () => {
    const sirali = ["XL", "32", "S", "M", "30", "XXL", "L"].sort((a, b) => bedenSirasi(a) - bedenSirasi(b));
    expect(sirali).toEqual(["S", "M", "L", "XL", "XXL", "30", "32"]);
  });
});
