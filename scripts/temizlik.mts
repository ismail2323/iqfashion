// Güvenli çöp temizliği. Varsayılan KURU ÇALIŞTIRMA (hiçbir şey silmez, yalnızca ne silineceğini yazar).
//   DATABASE_URL="<adres>" npm run temizlik            -> sadece rapor
//   DATABASE_URL="<adres>" npm run temizlik -- --uygula -> siler
// ASLA dokunulmayanlar: ürün, varyant, stok, satış, alış, transfer, kasa, kullanıcı, şube, denetim kaydı.
// Silinenler yalnızca "yeniden üretilebilir/çöp" veriler:
//   1) hiçbir ürünün kullanmadığı fotoğraflar (yüklenip kullanılmayan; 3 günden eski olanlar — yeni yüklenen henüz kaydedilmemiş olabilir)
//   2) süresi 7+ gün önce dolmuş oturumlar   3) 30 günden eski giriş denemesi sayaçları   4) 30 günden eski AI önbellek/kullanım kayıtları
import "dotenv/config";
import { prisma } from "../src/lib/db";

const uygula = process.argv.includes("--uygula");
const gun = (n: number) => new Date(Date.now() - n * 86_400_000);

// 1) Kullanılmayan fotoğraflar: ürünlerin gorselUrl alanındaki /api/gorsel/<id> adreslerinden KULLANILAN kimlikler toplanır
const urunler = await prisma.urun.findMany({ where: { gorselUrl: { not: null } }, select: { gorselUrl: true } });
const kullanilan = new Set(urunler.map((u) => /\/api\/gorsel\/([\w-]+)/.exec(u.gorselUrl ?? "")?.[1]).filter((x): x is string => !!x));
const gorseller = await prisma.gorsel.findMany({ select: { id: true, boyut: true, createdAt: true } });
const yetim = gorseller.filter((g) => !kullanilan.has(g.id) && g.createdAt < gun(3));
const yetimBayt = yetim.reduce((t, g) => t + g.boyut, 0);

// Güvenlik freni: çok fazla fotoğraf "kullanılmıyor" görünüyorsa (ör. adres biçimi değişmiş olabilir) HİÇBİRİNİ silme
const fren = gorseller.length > 20 && yetim.length > gorseller.length * 0.5;

const [oturum, deneme, ai] = await Promise.all([
  prisma.oturum.count({ where: { expiresAt: { lt: gun(7) } } }),
  prisma.girisDenemesi.count({ where: { createdAt: { lt: gun(30) } } }),
  prisma.aiKullanim.count({ where: { createdAt: { lt: gun(30) } } }),
]);

console.log(uygula ? "TEMİZLİK (uygulanıyor)" : "TEMİZLİK (kuru çalıştırma: hiçbir şey silinmedi)");
console.log(`- Fotoğraf toplam: ${gorseller.length}, kullanılan: ${kullanilan.size}, kullanılmayan (3+ gün): ${yetim.length} (${(yetimBayt / 1024 / 1024).toFixed(2)} MB)${fren ? "  !! ÇOK FAZLA, güvenlik freni: silinmeyecek" : ""}`);
console.log(`- Süresi dolmuş oturum (7+ gün): ${oturum}`);
console.log(`- Eski giriş denemesi (30+ gün): ${deneme}`);
console.log(`- Eski AI kaydı (30+ gün): ${ai}`);
const bos = await prisma.urun.count({ where: { varyantlar: { none: {} } } });
if (bos) console.log(`- BİLGİ: varyantı olmayan ürün kartı: ${bos} (otomatik SİLİNMEZ; Ürünler sayfasından elle kontrol edin)`);

if (uygula) {
  if (!fren && yetim.length) await prisma.gorsel.deleteMany({ where: { id: { in: yetim.map((g) => g.id) } } });
  await prisma.oturum.deleteMany({ where: { expiresAt: { lt: gun(7) } } });
  await prisma.girisDenemesi.deleteMany({ where: { createdAt: { lt: gun(30) } } });
  await prisma.aiKullanim.deleteMany({ where: { createdAt: { lt: gun(30) } } });
  console.log("Tamam.");
}
await prisma.$disconnect();
