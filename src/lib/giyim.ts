// Giyim sözlüğü: AI/elle girilen renk ve bedenleri tek biçime getirir (raporlar bölünmesin: "siyah", "Black", "SİYAH" -> "Siyah").

const RENKLER: Record<string, { ad: string; hex: string }> = {
  siyah: { ad: "Siyah", hex: "#111111" }, black: { ad: "Siyah", hex: "#111111" }, noir: { ad: "Siyah", hex: "#111111" },
  beyaz: { ad: "Beyaz", hex: "#f5f5f5" }, white: { ad: "Beyaz", hex: "#f5f5f5" }, ekru: { ad: "Ekru", hex: "#efe6d2" }, krem: { ad: "Krem", hex: "#efe3c8" }, cream: { ad: "Krem", hex: "#efe3c8" },
  gri: { ad: "Gri", hex: "#8a8a8a" }, grey: { ad: "Gri", hex: "#8a8a8a" }, gray: { ad: "Gri", hex: "#8a8a8a" }, antrasit: { ad: "Antrasit", hex: "#383b3e" }, anthracite: { ad: "Antrasit", hex: "#383b3e" },
  lacivert: { ad: "Lacivert", hex: "#16213e" }, navy: { ad: "Lacivert", hex: "#16213e" }, "koyu mavi": { ad: "Koyu Mavi", hex: "#1f3a63" }, "dark blue": { ad: "Koyu Mavi", hex: "#1f3a63" },
  mavi: { ad: "Mavi", hex: "#2f6fcb" }, blue: { ad: "Mavi", hex: "#2f6fcb" }, "açık mavi": { ad: "Açık Mavi", hex: "#8db6e3" }, "acik mavi": { ad: "Açık Mavi", hex: "#8db6e3" }, "light blue": { ad: "Açık Mavi", hex: "#8db6e3" }, indigo: { ad: "İndigo", hex: "#3d4f8a" }, "i̇ndigo": { ad: "İndigo", hex: "#3d4f8a" },
  kirmizi: { ad: "Kırmızı", hex: "#c0272d" }, "kırmızı": { ad: "Kırmızı", hex: "#c0272d" }, red: { ad: "Kırmızı", hex: "#c0272d" }, bordo: { ad: "Bordo", hex: "#6d1a2b" }, burgundy: { ad: "Bordo", hex: "#6d1a2b" },
  yesil: { ad: "Yeşil", hex: "#2e7d4f" }, "yeşil": { ad: "Yeşil", hex: "#2e7d4f" }, green: { ad: "Yeşil", hex: "#2e7d4f" }, haki: { ad: "Haki", hex: "#6b6b3a" }, khaki: { ad: "Haki", hex: "#6b6b3a" }, "zümrüt": { ad: "Zümrüt", hex: "#0f6b4d" },
  sari: { ad: "Sarı", hex: "#e8c21a" }, "sarı": { ad: "Sarı", hex: "#e8c21a" }, yellow: { ad: "Sarı", hex: "#e8c21a" }, hardal: { ad: "Hardal", hex: "#c79a1d" }, mustard: { ad: "Hardal", hex: "#c79a1d" },
  turuncu: { ad: "Turuncu", hex: "#e2711d" }, orange: { ad: "Turuncu", hex: "#e2711d" },
  pembe: { ad: "Pembe", hex: "#e58fb0" }, pink: { ad: "Pembe", hex: "#e58fb0" }, pudra: { ad: "Pudra", hex: "#e9c9c1" },
  mor: { ad: "Mor", hex: "#6c3f9d" }, purple: { ad: "Mor", hex: "#6c3f9d" }, lila: { ad: "Lila", hex: "#b9a1d6" },
  kahverengi: { ad: "Kahverengi", hex: "#6b4426" }, brown: { ad: "Kahverengi", hex: "#6b4426" }, camel: { ad: "Camel", hex: "#b98b57" }, bej: { ad: "Bej", hex: "#d6c4a1" }, beige: { ad: "Bej", hex: "#d6c4a1" }, taş: { ad: "Taş", hex: "#b8b0a2" }, tas: { ad: "Taş", hex: "#b8b0a2" },
  gold: { ad: "Altın", hex: "#c9a24a" }, "altın": { ad: "Altın", hex: "#c9a24a" }, altin: { ad: "Altın", hex: "#c9a24a" }, "gümüş": { ad: "Gümüş", hex: "#c0c0c0" }, silver: { ad: "Gümüş", hex: "#c0c0c0" },
};

const trKucuk = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
/** "LIGHT BLUE" tr-TR'de "lıght blue" olur; İngilizce/Türkçe iki küçük harf biçimini de dener. */
const anahtarlar = (s: string) => [...new Set([trKucuk(s), s.toLowerCase().replace(/\u0307/g, "").replace(/\s+/g, " ").trim()])];
const baslikYap = (s: string) => s.split(" ").map((k) => k.charAt(0).toLocaleUpperCase("tr-TR") + k.slice(1).toLocaleLowerCase("tr-TR")).join(" ");

export function normalRenk(ham: string | null | undefined): string {
  if (!ham) return "";
  const adaylar = anahtarlar(ham);
  for (const k of adaylar) if (RENKLER[k]) return RENKLER[k].ad;
  // "Light Blue / Mavi" gibi çoklu ifadelerde ilk bilinen kelime
  for (const k of adaylar) for (const parca of k.split(/[\/,&-]/).map((p) => p.trim())) if (RENKLER[parca]) return RENKLER[parca].ad;
  return baslikYap(adaylar[0]);
}

export function renkHex(renk: string): string {
  for (const k of anahtarlar(renk)) if (RENKLER[k]) return RENKLER[k].hex;
  return "#b8b0a2";
}

export const HARF_BEDENLER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];

const BEDEN_ESLEME: Record<string, string> = {
  "extra small": "XS", "x-small": "XS", "small": "S", "medium": "M", "large": "L", "extra large": "XL", "x-large": "XL",
  "2xl": "XXL", "xxl": "XXL", "xxxl": "3XL", "xxxxl": "4XL", "2x": "XXL", "3x": "3XL", "std": "STD", "standart": "STD", "tek ebat": "STD", "one size": "STD", "os": "STD",
};

export function normalBeden(ham: string | null | undefined): string {
  if (!ham) return "";
  const k = ham.trim().toLowerCase().replace(/\s+/g, " ");
  if (BEDEN_ESLEME[k]) return BEDEN_ESLEME[k];
  const u = k.toUpperCase();
  if (HARF_BEDENLER.includes(u)) return u;
  // Pantolon: "W32 L34", "32/34", "32x34" -> "32/34" ; yalnızca "W32" -> "32"
  const w = /^w?\s*(\d{2})\s*[\/x\s-]?\s*l?\s*(\d{2})?$/i.exec(k);
  if (w) return w[2] ? `${w[1]}/${w[2]}` : w[1];
  return u;
}

/** Sıralama için: XS<S<M<L<XL..., sonra sayılar artan */
export function bedenSirasi(b: string): number {
  const i = HARF_BEDENLER.indexOf(b);
  if (i >= 0) return i;
  const n = parseFloat(b);
  return Number.isNaN(n) ? 999 : 100 + n;
}

export const BEDEN_SETLERI = {
  "Harf (S-XXL)": ["S", "M", "L", "XL", "XXL"],
  "Pantolon (30-38)": ["30", "32", "34", "36", "38"],
  "Takım (46-58)": ["46", "48", "50", "52", "54", "56"],
  "Ayakkabı (39-45)": ["39", "40", "41", "42", "43", "44", "45"],
} as const;

export const HIZLI_RENKLER = ["Siyah", "Beyaz", "Lacivert", "Gri", "Antrasit", "Mavi", "Açık Mavi", "Koyu Mavi", "Kırmızı", "Bordo", "Yeşil", "Haki", "Bej", "Kahverengi", "Ekru"];

/** Hızlı beden grupları: üst giyim (S–3XL) ve alt giyim (30–42). Kutular tek tek açılır, adet yazılır. */
export const BEDEN_GRUPLARI = {
  ust: { ad: "Üst grup (S–3XL)", bedenler: ["S", "M", "L", "XL", "XXL", "3XL"] },
  alt: { ad: "Alt grup (30–42)", bedenler: ["30", "31", "32", "33", "34", "36", "38", "40", "42"] },
} as const;
export type BedenGrubu = keyof typeof BEDEN_GRUPLARI;
