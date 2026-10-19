import type { Tx } from "./db";

export const KATEGORILER = ["Takım Elbise", "Pantolon", "Gömlek", "Tişört", "Ceket", "Mont", "Kazak", "Sweatshirt", "Hırka", "Eşofman", "Şort", "Elbise", "Etek", "Ayakkabı", "Kemer", "Çanta", "Aksesuar", "İç Giyim"];
export const MARKALAR = ["Prada", "Calvin Klein", "Hermès", "Hugo", "Nike", "Adidas", "Puma", "Lacoste", "Tommy Hilfiger", "Polo Ralph Lauren", "U.S. Polo Assn.", "Levi's", "Jack & Jones", "Gant"];

export async function varsayilanlariYaz(tx: Tx) {
  // Toplu ve tekrar çalıştırılabilir (zaten olanlar atlanır): gecikmesi yüksek bağlantılarda da işlem süresini aşmaz
  await tx.kategori.createMany({ data: KATEGORILER.map((ad) => ({ ad })), skipDuplicates: true });
  await tx.marka.createMany({ data: MARKALAR.map((ad) => ({ ad })), skipDuplicates: true });
  await tx.ayar.upsert({ where: { anahtar: "dukkanAdi" }, update: {}, create: { anahtar: "dukkanAdi", deger: "IQ Fashion" } });
}
