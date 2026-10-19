import { describe, expect, it } from "vitest";
import { barkodKabulEdilir, barkodTuru, dahiliBarkod, eanGecerli, kontrolBasamagi } from "@/lib/barkod";
import { ayBasi, donemAraligi, gunAnahtari, gunBasi, haftaBasi } from "@/lib/tarih";
import { kurusa, liraya } from "@/lib/para";
import { sifreDogrula, sifreHashle, sifreKurali } from "@/lib/sifre";
import { islemSubesi, subeKapsami, YetkiHatasi, type Oturumlu } from "@/lib/rbac";
import { skuUret } from "@/lib/stok";

describe("barkod", () => {
  it("gerçek EAN-13 sağlama toplamlarını doğrular", () => {
    expect(eanGecerli("4006381333931")).toBe(true);
    expect(eanGecerli("5901234123457")).toBe(true);
    expect(eanGecerli("4006381333932")).toBe(false);
  });
  it("EAN-8 ve UPC-A", () => {
    expect(eanGecerli("96385074")).toBe(true);
    expect(eanGecerli("036000291452")).toBe(true);
    expect(eanGecerli("96385075")).toBe(false);
  });
  it("tür tespiti", () => {
    expect(barkodTuru("4006381333931")).toBe("EAN13");
    expect(barkodTuru("96385074")).toBe("EAN8");
    expect(barkodTuru("ABC-1234")).toBe("CODE128");
    expect(barkodTuru("4006381333932")).toBe("BILINMIYOR");
    expect(barkodKabulEdilir("")).toBe(false);
  });
  it("dahili barkodlar geçerli EAN-13 ve benzersiz", () => {
    const set = new Set<string>();
    for (let i = 1; i <= 500; i++) {
      const b = dahiliBarkod(i);
      expect(b).toHaveLength(13);
      expect(b.startsWith("20")).toBe(true);
      expect(eanGecerli(b)).toBe(true);
      set.add(b);
    }
    expect(set.size).toBe(500);
    expect(() => dahiliBarkod(0)).toThrow();
    expect(kontrolBasamagi("400638133393")).toBe(1);
  });
});

describe("tarih (Europe/Istanbul)", () => {
  it("gün sınırı UTC+3'e göre: 21:30 UTC ertesi güne geçmiştir", () => {
    const an = new Date("2026-03-10T21:30:00Z"); // Istanbul 11 Mart 00:30
    expect(gunAnahtari(an)).toBe("2026-03-11");
    expect(gunBasi(an).toISOString()).toBe("2026-03-10T21:00:00.000Z");
  });
  it("hafta Pazartesi başlar", () => {
    const carsamba = new Date("2026-03-11T09:00:00Z");
    expect(haftaBasi(carsamba).toISOString()).toBe("2026-03-08T21:00:00.000Z"); // 9 Mart Pzt 00:00 TR
  });
  it("ay ve yıl aralıkları", () => {
    const r = donemAraligi("ay", undefined, undefined, new Date("2026-02-15T10:00:00Z"));
    expect(r.bas.toISOString()).toBe("2026-01-31T21:00:00.000Z");
    expect(r.bit.toISOString()).toBe("2026-02-28T21:00:00.000Z");
    const y = donemAraligi("yil", undefined, undefined, new Date("2026-12-31T22:00:00Z")); // TR: 1 Ocak 2027
    expect(y.bas.toISOString()).toBe("2026-12-31T21:00:00.000Z");
    expect(ayBasi(new Date("2026-12-31T22:00:00Z")).toISOString()).toBe("2026-12-31T21:00:00.000Z");
  });
  it("özel aralık bitiş gününü dahil eder ve ters aralığı reddeder", () => {
    const r = donemAraligi("ozel", "2026-05-01", "2026-05-03");
    expect(r.bit.getTime() - r.bas.getTime()).toBe(3 * 86_400_000);
    expect(() => donemAraligi("ozel", "2026-05-03", "2026-05-01")).toThrow();
  });
});

describe("para", () => {
  it("kuruş yuvarlama float hatasına düşmez", () => {
    expect(kurusa(0.1 + 0.2)).toBe(30);
    expect(kurusa("19,99")).toBe(1999);
    expect(liraya(1999)).toBe(19.99);
    expect(() => kurusa("abc")).toThrow();
  });
});

describe("şifre", () => {
  it("hash doğrulanır, yanlış şifre reddedilir, hashler farklıdır (salt)", async () => {
    const h1 = await sifreHashle("Gizli1234");
    const h2 = await sifreHashle("Gizli1234");
    expect(h1).not.toBe(h2);
    expect(await sifreDogrula("Gizli1234", h1)).toBe(true);
    expect(await sifreDogrula("gizli1234", h1)).toBe(false);
    expect(await sifreDogrula("x", "bozuk")).toBe(false);
  });
  it("kurallar", () => {
    expect(sifreKurali("kisa1")).not.toBeNull();
    expect(sifreKurali("sadeceharfler")).not.toBeNull();
    expect(sifreKurali("12345678")).not.toBeNull();
    expect(sifreKurali("Guvenli123")).toBeNull();
  });
});

describe("rbac kapsamı", () => {
  const admin: Oturumlu = { id: "1", email: "a", ad: "a", rol: "SUPER_ADMIN", subeId: null };
  const mudur: Oturumlu = { id: "2", email: "b", ad: "b", rol: "SUBE_MUDURU", subeId: "S1" };
  const yetimMudur: Oturumlu = { ...mudur, subeId: null };
  it("süper admin istediği şubeyi seçer, boşsa hepsi", () => {
    expect(subeKapsami(admin, "S9")).toBe("S9");
    expect(subeKapsami(admin, "")).toBeUndefined();
    expect(() => islemSubesi(admin, "")).toThrow(YetkiHatasi);
  });
  it("şube kullanıcısı istemciden gelen şubeyi yok sayar", () => {
    expect(subeKapsami(mudur, "S9")).toBe("S1");
    expect(islemSubesi(mudur, "S9")).toBe("S1");
    expect(() => subeKapsami(yetimMudur)).toThrow(YetkiHatasi);
  });
});

describe("sku", () => {
  it("Türkçe karakterleri sadeleştirir", () => {
    expect(skuUret("Tommy Hilfiger", "Çizgili Gömlek", "Şeftali", "XL")).toBe("TOMM-CIZGIL-SEF-XL");
  });
});
