# Yayın, Veritabanı ve İşletme Kılavuzu

Canlı sistem üç parçadan oluşur: **GitHub (kod) → Vercel (uygulama) → Neon (veritabanı)**. Üçü de ücretsiz planda.

```
Geliştirici ── git push ──► GitHub (main)
                              │  (webhook)
                              ▼
                     Vercel: build = npm run build:deploy
                       1) prisma generate
                       2) prisma migrate deploy ──► Neon (tabloları günceller)
                       3) next build  →  yayın  → https://iqfashion.vercel.app
Tarayıcı ──► Vercel (iad1) ──► Neon pooled bağlantı (us-east-2)
                       └────► Groq / Gemini (yapay zeka)
```

## 1. Vercel
- **Proje:** `iqfashion` (takım `23ismail023-7226's projects`, Hobby). Panel: vercel.com/dashboard.
- **Kaynak:** GitHub `ismail2323/iqfashion`, dal `main`. Her push → otomatik yayın. Pull request/diğer dallar *Preview* yayını alır.
- **Ayarlar (`vercel.json`):** `regions: ["iad1"]` (Neon Ohio'ya yakın), `buildCommand: "npm run build:deploy"`.
- **Kısa adres:** `iqfashion.vercel.app` projeye otomatik atanır. Geçici/uzun adresler (`iqfashion-xxxx-23ismail023-7226.vercel.app`) her yayına özeldir, kullanmayın.
- **Kendi alan adı** (ör. `iqfashion.com`): ücretli (yıllık ~10–15 $). Vercel → proje → **Domains** (yeni arayüzde proje üst sekmelerinde ya da Settings altında) → *Add Domain* → DNS kayıtlarını alan adı sağlayıcısında girin.
- **Loglar:** Vercel → proje → **Logs** (çalışma zamanı hataları) ve Deployments → yayın → *Build Logs*.
- **Hobby plan sınırı:** resmî olarak **ticari olmayan** kullanım içindir. Mağaza gerçek işletme olarak kullanacaksa **Pro**'ya geçin (kullanıcı başına aylık ücret; güncel fiyatı vercel.com/pricing'den kontrol edin).

## 2. Ortam değişkenleri (Vercel → Settings → Environment Variables)
Aynı adlar yerel `.env`'de de kullanılır. **Değerler bu depoda yoktur.**

| Değişken | Ne için | Nereden alınır |
|---|---|---|
| `DATABASE_URL` | Uygulamanın kullandığı **havuzlu** (pooler) bağlantı | Neon → Connect → *Connection pooling* **açık** |
| `DIRECT_URL` | Migrasyon için **doğrudan** bağlantı (`-pooler` yok) | Neon → Connect → pooling **kapalı** |
| `SESSION_SECRET` | Oturum/CSRF gizli anahtarı (≥32 karakter). Yoksa üretimde uygulama açılmaz | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `GROQ_API_KEYS` | Yapay zeka (birincil). Virgülle birden fazla anahtar: sırayla/yük dağıtımlı denenir | console.groq.com → API Keys |
| `GROQ_VISION_MODEL` | Görsel okuyan model (şu an `qwen/qwen3.8-27b`) | Groq modeller listesi (aşağıya bakın) |
| `GEMINI_API_KEY` | Yedek yapay zeka (isteğe bağlı) | aistudio.google.com |
| `GEMINI_MODEL` | Virgülle model zinciri (şu an `gemini-3-flash-preview,gemini-flash-latest,gemini-3.1-flash-lite`) | Google AI modeller listesi |
| `AI_SIRA` | Sağlayıcı sırası, varsayılan `groq,gemini` | – |

Bağlantı adreslerine `?sslmode=verify-full&channel_binding=require` ekleyin (Neon'un verdiği adreste zaten `sslmode=require` olabilir; `verify-full` uyarıyı giderir).
Değişkeni değiştirince **yeniden yayın gerekir** (Deployments → son yayın → Redeploy).

**Yapay zeka modelleri zamanla kalkar** (Groq/Gemini model adlarını sık değiştirir; referans uygulamadaki `qwen3.6` bu yüzden bozulmuştu). Kontrol:
```bash
curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_KEY" | jq -r '.data[].id'
curl -s "https://generativelanguage.googleapis.com/v1beta/models" -H "x-goog-api-key: $GEMINI_KEY" | jq -r '.models[].name'
```
Görsel okuyabilen yeni bir model seçip ilgili değişkeni güncelleyin. Panel → Ayarlar → *Yapay zeka* kartı anahtar sayısını ve modeli gösterir; Ürün Ekle'de hata veriyorsa önce bu iki listeye bakın.

## 3. Neon (veritabanı)
- **Proje:** `yaz-birliği-20316634`, bölge **AWS us-east-2 (Ohio)**, dal `production`, veritabanı `neondb`, rol `neondb_owner`, Postgres 18. Panel: console.neon.tech.
- **Bedava plan sınırları** (güncel değerleri Neon fiyat sayfasından doğrulayın): ~0,5 GB depolama, ayda ~100 işlem-saati, **5 dk boşta kalınca uyku (scale-to-zero)**, 6 saatlik geçmiş (point-in-time restore).
  - Uyku sonrası ilk istek **3–10 sn** sürer (uyanma). Sistem bunu bekleyecek şekilde ayarlıdır (`connectionTimeoutMillis: 25 sn`).
  - Ürün görselleri veritabanında (`Gorsel` tablosu, ürün başına ~60–150 KB) saklanır; depolama dolarsa ücretli plana geçin ya da görselleri harici depolamaya (Vercel Blob/Cloudinary) taşıyın.
- **Isıtma (isteğe bağlı):** uyanma gecikmesini azaltmak için ücretsiz bir zamanlayıcı (cron-job.org) `https://iqfashion.vercel.app/api/saglik` adresini **mesai saatlerinde** (ör. 09:00–21:00, 4–5 dk'da bir) çağırabilir. Dikkat: sürekli açık kalan hesaplama ayda ~100 işlem-saatini zorlayabilir (0,25 CU × 13 sa × 30 gün ≈ 97 sa); gece bırakın.
- **Yedekleme (üç katman):**
  1. Uygulama içi: Ayarlar → **Yedeği indir** (tüm veri JSON, şifreler hariç). Sıfırlama öncesi şart.
  2. Neon: *Branches → Create branch* (anlık kopya) veya *Restore* (6 saate kadar geri sarma).
  3. Elle: `pg_dump "<DIRECT_URL>" -Fc -f yedek.dump` / `pg_restore -d "<YENI_URL>" yedek.dump`.
- **Veritabanları arası toplu kopya:** `scripts/veri-aktar.mts` (örnek veri yükleme, taşıma).
  - Örnek veri yükleme (hedefteki süper admin korunur): `SRC_URL=<yerel> DEST_URL=<hedef> npm run veri:aktar -- --admin-koru`
  - Tam taşıma (kullanıcılar dahil): bayraksız.
  - **Neden toplu betik?** Yerel makineden uzak veritabanına satır satır yazmak, her sorgudaki ağ gecikmesi yüzünden çok yavaş ve zaman aşımına açıktır; betik `createMany` ile gruplar.

## 4. Migrasyon (şema) süreci
`prisma/migrations/` altındaki her klasör sıralı bir şema adımıdır. Canlıya **yalnızca build sırasında** (`prisma migrate deploy`) uygulanır. Yerelde geliştirme: `npx prisma migrate dev --name ad`. Migrasyon klasörlerini **asla elle silmeyin/değiştirmeyin**. Acil durumda canlıya elle uygulamak için (DIRECT_URL ile): `DATABASE_URL=<direct> DIRECT_URL=<direct> npx prisma migrate deploy`.
Özel SQL içerenler: `20261019174107_init` sonunda `Stok.miktar >= 0` ve fiyat `>= 0` CHECK kısıtları vardır.

## 5. Neon'u Frankfurt'a taşıma (Türkiye'den hız için önerilir)
Neon projenin bölgesi sonradan değişmez; yeni proje kurulur. Türkiye ↔ Ohio gecikmesi her istekte yüzlerce ms ekler; Frankfurt + Vercel `fra1` bunu belirgin düşürür.
1. Neon → *New Project* → bölge **AWS Europe (Frankfurt) eu-central-1**, Postgres 18. Yeni pooled/direct adreslerini alın.
2. Tabloları kurun: `DATABASE_URL=<yeni-direct> DIRECT_URL=<yeni-direct> npx prisma migrate deploy`
3. Veriyi kopyalayın (tam kopya, bayraksız): `SRC_URL=<eski-direct> DEST_URL=<yeni-direct> npm run veri:aktar`
4. Vercel env'de `DATABASE_URL` ve `DIRECT_URL`'i yenileriyle değiştirin. `vercel.json` → `"regions": ["fra1"]`. Commit + push (veya Redeploy).
5. Canlıda giriş yapın, panel/satış/ürün ekranlarını ve `/api/saglik`'i doğrulayın.
6. Her şey doğruysa eski Neon projesini silin.

## 6. Performans notları (neden hızlı, neyi bozmamalı)
- Panel/rapor/muhasebe toplamları **önbellekli** (`src/lib/panelVerisi.ts`, `raporSayfa.ts`; 30–60 sn). Veri değiştiren **her** API çağrısı `handler()` içinde önbelleği otomatik düşürür → yeni bir yazma ucu da `handler()` ile yazılmalıdır.
- Anasayfadaki 4 dönem **tek geçişli SQL** (`donemOzetleriHizli`); `donemOzetleri` ile eşitliği birim testle korunur. Birini değiştirirseniz diğerini de değiştirin.
- Listeler (Stok, Ürünler, Hareketler, Denetim) **veritabanı düzeyinde sayfalanır**; tüm tabloyu belleğe çeken kod eklemeyin.
- `src/app/(app)/loading.tsx` her geçişte anında iskelet gösterir. Grafikler tembel yüklenir. Logolar küçültülmüştür.
- İndeksler `schema.prisma`'dadır (satış/alış/hareket tarih+şube+durum birleşikleri). Yeni ağır sorgu eklerken `EXPLAIN` ile indeks kullanımını kontrol edin.
- Ölçüm (canlı, ABD sunucusu, Türkiye'den): ekran tepkisi 30–65 ms, veri 0,35–0,9 sn; Neon uyanma ilk istekte 3–10 sn.

## 7. Gizli değer döndürme (rotation) cetveli
| Ne | Ne zaman | Nasıl | Etkisi |
|---|---|---|---|
| GitHub token | Sızdıysa / süresi dolunca | GitHub → Settings → Developer settings → Tokens | Yalnızca push yapan kişi etkilenir |
| Neon parola | Sızdıysa | Neon → Settings → Roles → Reset password; Vercel'deki 2 adresi güncelle; Redeploy | Kısa kesinti yok (yeni yayına kadar eski bağlantı çalışmaz) |
| `SESSION_SECRET` | Sızdıysa | Yeni değer üret, Vercel'e yaz, Redeploy | **Herkes oturumdan düşer** (tekrar giriş) |
| Groq/Gemini anahtarı | Sızdıysa / kota | İlgili konsolda yeni anahtar → Vercel `GROQ_API_KEYS`/`GEMINI_API_KEY` → Redeploy | AI geçici kapalı kalabilir |
