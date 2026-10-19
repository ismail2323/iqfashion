# IQ Fashion – Stok Takip ve Şube Yönetim Paneli

Çok şubeli giyim mağazası için barkodlu stok, satış (POS), mal kabul, transfer, muhasebe ve rapor paneli.
Next.js 16 · React 19 · Prisma 7 · PostgreSQL · Tailwind 4 · Recharts. Arayüz Türkçe, mobil/tablet uyumlu (PWA).

## Özellikler
- **Roller:** Süper Admin (tüm şubeler, hesap/şube yönetimi, fiyatlar, sıfırlama), Şube Müdürü (kendi şubesi), Kasiyer (satış; maliyet/kâr görmez). Yetkiler sunucuda zorlanır.
- **Hesap açma:** şube + müdür hesabı tek adımda; şifre otomatik üretilir (WhatsApp ile gönder), ilk girişte zorunlu değişir.
- **Ürün girişi:** etiket fotoğrafından yapay zeka (Groq vision, Gemini yedek) ile marka/renk/beden/fiyat/barkod okuma; toplu fotoğraf (kamera art arda çekim / galeriden çoklu seçim); renk × beden tablosu.
- **Barkod:** canlı kamera, fotoğraftan okuma, USB/Bluetooth el terminali; EAN sağlama toplamı doğrulaması; barkodsuz ürüne EAN-13 üretimi ve etiket yazdırma.
- **Satış / stok:** atomik stok düşümü (eşzamanlı satışta eksiye düşmez), iade, iptal, transfer, sayım modu, düşük stok uyarısı.
- **Panel / raporlar:** günlük–haftalık–aylık–yıllık satış, alış, gelir, gider, kasa, kâr; marka/renk/beden kırılımı; yazdırılabilir PDF rapor; CSV.
- **Ayarlar:** istatistik sıfırlama (geri alınabilir) ve fabrika ayarları (3 onay + şifre), JSON yedek.

## Yerel çalıştırma
```bash
npm install
cp .env.example .env          # SESSION_SECRET ve (ister) GROQ_API_KEYS doldurun
npm run db:local              # Docker'sız yerel Postgres (ayrı terminal)
npx prisma migrate dev
npm run db:demo               # isteğe bağlı: demo veri (4 ürün, 4 aylık hareket)
npm run dev
```
Demo girişi: `.env` içindeki `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Boş veritabanında ilk açılışta kurulum ekranı süper admin hesabını oluşturur.

## Test
```bash
npm test                      # birim + veritabanı testleri (Vitest)
npm run build && npm run test:e2e   # tarayıcı uçtan uca (Playwright, 16 senaryo)
```

## Ücretsiz yayın (Vercel + Neon)
1. Neon'da bir Postgres oluşturun; `DATABASE_URL` (havuzlu) ve `DIRECT_URL` (doğrudan) değerlerini alın.
2. Vercel'de depoyu içe aktarın. Build komutu: `npm run build:deploy` (migrasyonları uygular).
3. Ortam değişkenleri: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` (en az 32 karakter), `GROQ_API_KEYS`, `GROQ_VISION_MODEL`, isteğe bağlı `GEMINI_API_KEY`, `GEMINI_MODEL`.
4. İlk açılışta `/giris` kurulum ekranından süper admin hesabını oluşturun.

> Vercel Hobby planı resmî olarak ticari kullanıma izin vermez; mağaza ciddi kullanıma geçtiğinde Pro plana geçilmelidir.

## Ürün görselleri
`public/urunler/` altına koyulan dosyalar (`jagger-takim.jpg`, `esofman-takimi.jpg`, `polo-tisort.jpg`, `kot-pantolon.jpg`) demo ürünlerde görünür. Yeni ürünlerin görselleri uygulama içinden yüklenir ve veritabanında saklanır.
