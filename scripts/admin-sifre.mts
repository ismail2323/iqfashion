// Bir kullanıcının şifresini belirler (unutulan yönetici şifresi için kurtarma yolu).
//   DATABASE_URL="<havuzlu-veya-doğrudan-adres>" EMAIL="yavuz2323@iqfashion.com" YENI_SIFRE="YeniSifre123" npm run admin:sifre
// Şifre kuralı: en az 8 karakter, en az bir harf ve bir rakam. Kullanıcı bir sonraki girişte şifre değiştirmeye ZORLANMAZ.
// Kullanıcının açık oturumları kapatılır ve giriş kilidi (yanlış deneme sayacı) temizlenir.
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { sifreHashle } from "../src/lib/sifre";
import { sifreKurali } from "../src/lib/sifreKurali";

const email = (process.env.EMAIL ?? "").trim().toLowerCase();
const yeni = process.env.YENI_SIFRE ?? "";
if (!email || !yeni) throw new Error("EMAIL ve YENI_SIFRE ortam değişkenleri gerekli");
const hata = sifreKurali(yeni);
if (hata) throw new Error(hata);

const k = await prisma.kullanici.findUnique({ where: { email } });
if (!k) throw new Error(`Kullanıcı bulunamadı: ${email}`);
await prisma.kullanici.update({ where: { id: k.id }, data: { sifreHash: await sifreHashle(yeni), sifreDegistirmeli: false, aktif: true } });
await prisma.oturum.deleteMany({ where: { kullaniciId: k.id } });
await prisma.girisDenemesi.deleteMany({ where: { anahtar: `e:${email}` } });
console.log(`Şifre güncellendi: ${k.ad} <${email}> (${k.rol})`);
await prisma.$disconnect();
