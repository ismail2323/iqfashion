# Hesap devir listesi (şifre YAZILMAZ)

Sistem ayakta kalsın diye aşağıdaki hesaplara **güvendiğiniz en az iki kişinin** erişimi olmalı. Şifreleri bir şifre yöneticisinde (Bitwarden, 1Password vb.) saklayın; bu dosyaya, sohbete veya e-postaya yazmayın.

| Hesap | Ne için | Kayıtlı e-posta / kullanıcı | Erişimi olanlar | Kurtarma yolu |
|---|---|---|---|---|
| **GitHub** (`ismail2323/iqfashion`) | Kod, günlük yedek, izleme uyarıları | ismail2323 | (doldurun) | 2 adımlı doğrulama kodlarını güvenli saklayın |
| **Vercel** | Siteyi yayınlar (iqfashion.vercel.app) | (doldurun) | (doldurun) | GitHub ile giriş |
| **Neon** | Veritabanı | (doldurun) | (doldurun) | E-posta ile kurtarma |
| **Groq / Google AI Studio** | Etiketten yapay zeka okuma | (doldurun) | (doldurun) | Anahtarlar Vercel'de; sızarsa yenilenir |
| **Uygulama süper admini** | Ürün/şube/kullanıcı yönetimi | (doldurun) | Yavuz abi | `npm run admin:sifre` (docs/DEVAM-ET.md) |

Kontrol listesi (3 ayda bir):
- [ ] Yedek e-postası/uyarısı gelen adres hâlâ okunuyor mu?
- [ ] Actions → "Gunluk yedek" son çalışmaları yeşil mi? Bir yedeği indirip açılabiliyor mu?
- [ ] Neon depolama kullanımı (Billing/Usage) %70'in altında mı?
- [ ] Depo Private mı? Paylaşılmış anahtarlar yenilendi mi?
- [ ] Hesaplara erişimi olan 2. kişi güncel mi?
