import type { Tx } from "./db";

export const KATEGORILER = ["Takım Elbise", "Pantolon", "Gömlek", "Tişört", "Ceket", "Mont", "Kazak", "Sweatshirt", "Hırka", "Eşofman", "Şort", "Elbise", "Etek", "Ayakkabı", "Kemer", "Çanta", "Aksesuar", "İç Giyim"];
export const MARKALAR = ["Prada", "Calvin Klein", "Hermès", "Hugo", "Nike", "Adidas", "Puma", "Lacoste", "Tommy Hilfiger", "Polo Ralph Lauren", "U.S. Polo Assn.", "Levi's", "Jack & Jones", "Gant"];

export async function varsayilanlariYaz(tx: Tx) {
  for (const ad of KATEGORILER) await tx.kategori.upsert({ where: { ad }, update: {}, create: { ad } });
  for (const ad of MARKALAR) await tx.marka.upsert({ where: { ad }, update: {}, create: { ad } });
  await tx.ayar.upsert({ where: { anahtar: "dukkanAdi" }, update: {}, create: { anahtar: "dukkanAdi", deger: "IQ Fashion" } });
}
