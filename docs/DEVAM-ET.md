# IQ Fashion – Devam Etme Kılavuzu

> **Bu dosyayı önce okuyun.** Projeyi bilgisayardan silip GitHub'dan yeniden indiren biri (ya da bir yapay zeka ajanı) için yazıldı.
> Gizli değerler (şifre, API anahtarı, veritabanı parolası) **bu depoda tutulmaz**; nerede durduklarını aşağıda bulursunuz.

## 0. Proje nedir?
Yavuz'un giyim mağazası **IQ Fashion** için çok şubeli stok takip ve yönetim paneli: barkodlu satış (POS), yapay zeka ile ürün girişi, stok/sayım, mal kabul, transfer, muhasebe, raporlar (PDF), şube ve kullanıcı yönetimi. Arayüz Türkçe, telefon/tablet/bilgisayarda çalışır.
Stack: **Next.js 16 (App Router) · React 19 · Prisma 7 · PostgreSQL · Tailwind 4 · Recharts**. Teknik ayrıntı: `docs/MIMARI.md`. Yayın/veritabanı işlemleri: `docs/YAYIN-VE-VERITABANI.md`. Eksikler ve fikirler: `docs/YAPILACAKLAR.md`.

## 1. Her şey nerede?

| Ne | Nerede | Not |
|---|---|---|
| **Kod** | GitHub: `https://github.com/ismail2323/iqfashion` (dal: `main`) | Hesap: `ismail2323`. **Depo şu an herkese açık (Public)** → bkz. §8 |
| **Canlı site** | `https://iqfashion.vercel.app` (giriş: `/giris`) | Vercel projesi `iqfashion`, takım `23ismail023-7226's projects`, plan Hobby |
| **Yayın (hosting)** | **Vercel** – GitHub'a her `git push origin main` otomatik yayınlar | Bölge `iad1` (Washington). Ayarlar `vercel.json`'da |
| **Veritabanı (canlı)** | **Neon** Postgres, proje `yaz-birliği-20316634`, AWS **us-east-2 (Ohio)**, dal `production`, veritabanı `neondb`, rol `neondb_owner` | Bedava plan. Sunucu: `ep-autumn-wildflower-b54uvyf1[-pooler].c-7.us-east-2.aws.neon.tech` |
| **Yapay zeka** | **Groq** (2 anahtar, model `qwen/qwen3.8-27b`) + yedek **Gemini** (`gemini-3-flash-preview` …) | Anahtarlar Vercel ortam değişkenlerinde ve yerel `.env`'de |
| **Gizli değerler** | Vercel → proje → Settings → **Environment Variables** · yerelde `.env` (git'e girmez) | Listesi: `docs/YAYIN-VE-VERITABANI.md` §2 |
| **Müşteri kullanım kılavuzu (PDF)** | `docs/IQ-Fashion-Kullanim-Kilavuzu.pdf` (+ ekran görüntüleri `docs/kilavuz/`) | Müşteriye gönderilecek 45 sayfalık kılavuz |
| **Canlı süper admin** | e-posta `yavuz2323@iqfashion.com` | Şifre depoda **yoktur**; unutulursa §4'teki betikle sıfırlanır |

## 2. Bilgisayarı sıfırlayıp projeyi yeniden kurma (adım adım)
Gerekenler: **Node.js 22**, **Git**, Windows/Mac/Linux. (Docker gerekmez.)

```bash
git clone https://github.com/ismail2323/iqfashion.git
cd iqfashion
npm install                      # postinstall otomatik "prisma generate" çalıştırır
cp .env.example .env             # Windows: copy .env.example .env
```
`.env` içini doldurun (yerel geliştirme için):
- `DATABASE_URL` / `DIRECT_URL`: yerel veritabanı için `.env.example`'daki varsayılan yeterli (`postgresql://postgres:postgres@localhost:54329/iqfashion`).
- `SESSION_SECRET`: en az 32 karakter rastgele (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).
- `GROQ_API_KEYS`, `GEMINI_API_KEY`: canlıdaki değerler Vercel'den kopyalanır (yoksa AI kapalı çalışır, elle giriş yine olur).
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`: yerel demo yönetici hesabı.

Sonra:
```bash
npm run db:local                 # AYRI terminalde: Docker'sız gerçek Postgres (port 54329), açık kalmalı
npx prisma migrate dev           # tabloları kurar
npm run db:demo                  # (isteğe bağlı) örnek veri: 4 ürün, ~4 aylık satış/alış/gider/transfer
npm run dev                      # http://localhost:3000
```
Doğrulama: `npm test` (66+ birim testi) ve `npm run build && npm run test:e2e` (16 tarayıcı senaryosu; ilk seferde `npx playwright install chromium`).

Yerel demo giriş bilgileri: yönetici = `.env`'deki SEED_ADMIN_*; müdür `merkez@iqfashion.local`, kasiyer `kasiyer@iqfashion.local`, ikinci şube müdürü `sube2@iqfashion.local` (şifre `prisma/demo.ts` içindeki demo şifresi). **Bunlar yalnızca örnek hesaplardır.**

## 3. Günlük çalışma akışı (nereye nasıl güncelleme atılır)
1. Değişikliği yerelde yapın (`npm run dev`).
2. Kontrol: `npx tsc --noEmit` · `npm test` · gerekirse `npm run build && npm run test:e2e`.
3. `git add -A && git commit -m "…" && git push origin main`
4. **Vercel otomatik yayınlar** (≈2–3 dk). `vercel.json`'daki build komutu `npm run build:deploy`: önce `prisma generate`, sonra **`prisma migrate deploy` (canlı Neon veritabanına yeni migrasyonları uygular)**, sonra `next build`.
5. Canlıda doğrula: `https://iqfashion.vercel.app/api/saglik` → `{"ok":true}`, sonra giriş yapıp ilgili ekranı dene.

**Şema (tablo) değişikliği:** `prisma/schema.prisma`'yı düzenle → `npx prisma migrate dev --name aciklayici_ad` (yerel DB'ye uygular ve `prisma/migrations/` altına dosya üretir) → o klasörü **mutlaka commit'le** → push. Canlıya Vercel build'i uygular. Hiçbir zaman canlı veritabanında elle tablo değiştirmeyin.

**Geri alma:** Vercel → Deployments → eski yayının `⋯` menüsü → *Promote to Production* (anında). Kalıcı çözüm için `git revert <commit>` + push.

## 4. Hesaplar, erişim ve kurtarma
- **GitHub:** `ismail2323`. Push için hesap şifresi değil **Personal Access Token** gerekir (Settings → Developer settings → Tokens; `repo` yetkisi). Token'ı sohbete/repoya yazmayın. Tek seferlik push: `git -c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:TOKEN' | base64)" push origin main`.
- **Vercel / Neon:** her ikisine de **GitHub ile giriş** yapılıyor (`ismail2323`'in bağlı e-postasıyla).
- **Canlı süper admin şifresi unutulursa** (yerel makineden, canlı DIRECT_URL'i ortama koyarak):
  ```bash
  DATABASE_URL="<neon-pooled-url>" EMAIL="yavuz2323@iqfashion.com" YENI_SIFRE="YeniSifre123" npm run admin:sifre
  ```
  Neon bağlantı adresi: Neon paneli → projeyi aç → **Connect** → *Connection pooling* açık = `DATABASE_URL`, kapalı = `DIRECT_URL`. Adrese `?sslmode=verify-full` ekleyin.
- **Başka kullanıcının şifresi:** süper admin panelden → Kullanıcılar → *Şifre sıfırla* (yeni geçici şifre üretir, ilk girişte değiştirilir).
- **Canlıdaki örnek (demo) hesaplar:** `merkez@iqfashion.local`, `kasiyer@iqfashion.local`, `sube2@iqfashion.local`. Şifreleri repoda görünür olduğundan **gerçek kullanıma geçmeden silin**: Ayarlar → *Fabrika ayarlarına dön* (Merkez şube ve süper admin kalır).

## 5. Önemli komutlar
| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi / çalıştırma |
| `npm run db:local` | Yerel Postgres'i başlatır (embedded-postgres, port 54329) |
| `npx prisma migrate dev` | Yerelde migrasyon üret/uygula |
| `npx prisma migrate deploy` | Hazır migrasyonları uygula (canlı/CI) |
| `npm run db:demo` | Yerel DB'yi fabrika durumuna alıp örnek veri yükler |
| `npm run db:seed` | Varsayılan marka/tür + (SEED_DEMO=1 ile) demo |
| `npm run admin:sifre` | Bir kullanıcının şifresini ayarlar (bkz. §4) |
| `npm run veri:aktar` | Bir veritabanından diğerine toplu kopya (`SRC_URL`, `DEST_URL`; `--admin-koru`) |
| `npm test` | Vitest (gerçek Postgres'e karşı; önce `npm run db:local`) |
| `npm run test:e2e` | Playwright (üretim build'i üzerinde, kendi boş DB'sini kurar) |
| `npm run typecheck` | TypeScript denetimi |

## 6. Test stratejisi (özet)
- **Birim/entegrasyon (Vitest, `tests/unit`)**: barkod sağlama toplamı, tarih (İstanbul), para, şifre, RBAC kapsamı, AI zinciri (sahte ağ), renk/beden sözlüğü, stok/satış/iade/iptal/transfer/sayım, **20 eşzamanlı satış yarışı**, ağırlıklı ortalama maliyet, rapor tanımları, hızlı dönem özeti = yavaş özet (eşitlik testi), sıfırlamalar, ana şube koruması.
- **Uçtan uca (Playwright, `tests/e2e/akis.spec.ts`)**: 16 adımlık tek hikâye – ilk kurulum, güvenlik (CSRF, hız sınırı), şube+hesap, kasiyer sınırları, tek ürün, toplu AI (yakalanmış sahte AI yanıtıyla), POS, şube yalıtımı, transfer, muhasebe, PDF üretimi, mobil taşma, istatistik sıfırlama, fabrika sıfırlama.
- Test veritabanları ayrıdır (`iqfashion_test`, `iqfashion_e2e`); canlı veriye **asla** dokunmaz.

## 7. Bilinmesi gereken tuzaklar
**Next.js 16:** `middleware.ts` yerine `src/proxy.ts`; `params`/`searchParams`/`cookies()` asenkron; `revalidateTag(tag, { expire: 0 })` (ikinci argüman zorunlu); route dosyalarından yalnızca HTTP metodları ve izinli ayarlar dışa aktarılabilir (sabitleri `src/lib/`e koyun); `server-only` modülleri istemci bileşenlerinden import edilemez (`src/lib/cn.ts`, `sifreKurali.ts`, `onayMetinleri.ts`, `kasa.ts` bu yüzden saf modüllerdir). Ayrıntı için `node_modules/next/dist/docs/` ve `AGENTS.md`.
**Windows/PowerShell 5.1:** `Set-Content/Out-File -Encoding utf8` dosyaya **BOM** ekler; `tsconfig.json`/JSON bozulur → BOM'suz yazın (`[IO.File]::WriteAllText(..., (New-Object Text.UTF8Encoding $false))`). Büyük çok satırlı string'leri PowerShell'e vermek yerine dosya araçlarıyla yazın.
**Prisma 7:** istemci `src/generated/prisma` altında üretilir (git'te **yok**, `postinstall` üretir). `prisma.config.ts` `DIRECT_URL || DATABASE_URL` kullanır.
**Para:** `Decimal(12,2)` + kuruş (tam sayı) hesabı. **Tarih:** tüm gün/hafta/ay sınırları `Europe/Istanbul` (UTC+3 sabit; `src/lib/tarih.ts`). **Stok:** yalnızca `src/lib/stok.ts` fonksiyonlarıyla (atomik, işlem içinde); veritabanında `CHECK miktar >= 0` var.

## 8. Hemen yapılması gerekenler (güvenlik)
1. **GitHub deposunu Private yapın:** repo → Settings → Danger Zone → *Change visibility*. (Şu an Public; kaynak kod ve demo şifreleri herkese açık. Gizli anahtar/parola depoda **yoktur** – taramayla doğrulandı.) Vercel, private depolarla da çalışır.
2. **Sohbette paylaşılan değerleri yenileyin:** GitHub token, Neon veritabanı parolası (Neon → Settings → Roles → Reset password → Vercel'deki `DATABASE_URL`/`DIRECT_URL`'i güncelle → Redeploy), Groq ve Gemini anahtarları (kendi konsollarından yenile → Vercel env güncelle → Redeploy).
3. **Canlı admin şifresini** güçlü bir şifreyle değiştirin (Ayarlar → Şifre değiştir).
4. Gerçek kullanıma geçmeden **örnek veriyi ve demo hesapları silin** (Ayarlar → Fabrika ayarlarına dön).

## 9. Yapay zeka ajanı için çalışma kuralları
- Önce bu dosyayı, sonra `docs/MIMARI.md`'yi okuyun; kodda varsayım yapmadan ilgili modülü (`src/lib/*.ts`) okuyun.
- Her değişiklikten sonra `npx tsc --noEmit` ve `npm test` çalıştırın; kullanıcı arayüzü/akış değiştiyse `npm run build && npm run test:e2e`.
- Veri değiştiren her API `handler()` (`src/lib/api.ts`) ile yazılır: kimlik, rol, şube kapsamı, zod doğrulaması ve önbellek tazeleme orada. **Şube kapsamını istemciden gelen değere bırakmayın.**
- Canlı veritabanında yıkıcı komut çalıştırmayın; önce kullanıcıdan açık onay alın. Gizli değerleri repoya/sohbete yazmayın.
- Kullanıcı Türkçe konuşur ve teknik olmayan, müşteriye anlatılabilir açıklamalar tercih eder; işleri hızlı ve eksiksiz bitirmeyi bekler.
