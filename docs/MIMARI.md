# Mimari ve Tasarım Kararları

## 1. Klasör yapısı
```
src/
  app/
    (auth)/giris, sifre-degistir     Giriş ve zorunlu şifre değiştirme (oturum gerekmez / yalnız şifre için)
    (app)/                            Panel (oturum + rol zorunlu). layout.tsx = kabuk, loading.tsx = iskelet
      page.tsx                        Panel (anasayfa)
      satis, urunler, urunler/[id], urunler/yeni, stok, alis, transferler,
      etiketler, hareketler, raporlar, raporlar/yazdir, muhasebe,
      subeler, kullanicilar, denetim, ayarlar, yardim
    api/                              Tüm yazma/okuma uçları (handler() ile)
  components/                         ui.tsx (tasarım parçaları), AppShell, Tarayici (barkod), KameraCekici, Grafikler…
  lib/                                İş mantığı (aşağıya bakın)
  proxy.ts                            Hızlı ön kontrol: oturum çerezi yoksa girişe yönlendirir (Next 16 "middleware")
  generated/prisma/                   Üretilir (git'te yok)
prisma/  schema.prisma, migrations/, seed.ts, demo.ts
scripts/ db-local.mjs, demo-yenile.mts, veri-aktar.mts, admin-sifre.mts, e2e-sunucu.mjs
tests/   unit/ (Vitest), e2e/ (Playwright)
docs/    Bu belgeler, kullanıcı kılavuzu (PDF + ekran görüntüleri)
public/  logo.png, logo-beyaz.png, ikonlar, manifest, urunler/ (demo ürün görselleri)
```

## 2. Roller ve şube kapsamı
- **SUPER_ADMIN**: tüm şubeler; şube/kullanıcı yönetimi, fiyat listesi, sıfırlamalar, denetim kaydı, yedek.
- **SUBE_MUDURU**: yalnızca kendi şubesi; satış, iptal/iade, indirim/fiyat, mal kabul, ürün ekleme, sayım, transfer, gider, rapor.
- **KASIYER**: yalnız satış (liste fiyatı) ve stok/ürün görüntüleme; **maliyet ve kârı hiçbir yerde görmez** (API de `alisFiyati: null` döner).
- **Kapsam kuralı (en kritik güvenlik kuralı):** şube kullanıcıları için kapsam **sunucuda** kullanıcının kendi `subeId`'sinden gelir; istemciden (çerez/URL) gelen şube değeri yok sayılır. Süper admin için `iq_sube` çerezi: `hepsi` = tüm şubeler, bir şube id'si = o şube, yoksa/geçersizse **ana şube**. (`src/lib/rbac.ts`, `subeSecimi.ts`, `api.ts`, `sayfa.ts`)
- **Ana (Merkez) şube:** en eski şube. Silinemez/pasife alınamaz; fabrika ayarlarında korunur ve sayacı sıfırlanır; ilk kurulumda otomatik oluşur.
- Yeni şube kodu ad'dan türetilir ve fiş numaralarında kullanılır (`MERKEZ-20261019-0001`), sonradan değiştirilemez.

## 3. Veri modeli (özet) – `prisma/schema.prisma`
- **Sube**, **Kullanici** (rol, subeId, aktif, `sifreDegistirmeli`), **Oturum** (DB'de, iptal edilebilir; token'ın sha256'sı saklanır), **GirisDenemesi** (hız sınırı).
- Katalog (**ortak**, şubeler arası): **Marka**, **Kategori**, **Tedarikci**, **Urun**, **Varyant** (renk+beden+barkod+SKU+alış/satış fiyatı+minStok). Ürün görselleri **Gorsel** tablosunda (bytes), `Urun.gorselUrl = /api/gorsel/<id>`.
- **Stok(varyantId, subeId, miktar)**: stok **şubeye özeldir**; `CHECK miktar >= 0`.
- Belgeler: **Satis/SatisKalemi** (satış anındaki ad/marka/renk/beden/maliyet **anlık kopya** + indirim payı + iade adedi), **AlisBelgesi/AlisKalemi**, **Transfer/TransferKalemi** (BEKLEMEDE→YOLDA→TAMAMLANDI|IPTAL), **StokHareketi** (her stok değişiminin defteri), **KasaKaydi** (işletme gelir/gideri), **FiyatGecmisi**, **DenetimKaydi**, **AiKullanim** (görsel hash önbelleği + hız sınırı), **Ayar**, **Sayac** (barkod/transfer numaraları).
- Para: `Decimal(12,2)`; hesaplar kuruş (tam sayı) üzerinden (`src/lib/para.ts`). Zaman: veritabanında UTC, gün/hafta/ay sınırları İstanbul (`src/lib/tarih.ts`).

## 4. Çekirdek iş kuralları (`src/lib/stok.ts`, `toplu.ts`, `hesaplar.ts`, `sifirlama.ts`)
- **Atomiklik:** her stok işlemi `prisma.$transaction` içinde; düşüm `updateMany WHERE miktar >= n` ile (yarış koşulunda 2. işlem başarısız olur). Birden çok eşzamanlı satışta stok eksiye düşmez (testli).
- **Maliyet:** mal kabulde tüm şubelerin toplam stoğu üzerinden **ağırlıklı ortalama**; her satış anındaki maliyeti kalemde saklar → gerçek kâr.
- **Kâr/kasa tanımları** (`src/lib/rapor.ts` başlığında): Satış = iptal edilmemiş satışlar − iadeler (indirimler düşülmüş). Gelir = Satış + diğer gelir. Gider = Alış + işletme gideri. Kasa = Gelir − Gider. Net kâr = Satış − satılan mal maliyeti − işletme gideri.
- **İade/iptal:** iptal kalan adetleri stoğa döndürür ve satışı raporlardan düşürür; kısmi iade kalem bazlıdır (koşullu güncellemeyle çifte iade engellenir).
- **Transfer:** gönderimde kaynaktan düşer, teslimde hedefe eklenir; yoldayken iptal kaynağa iade eder. Gönder yalnız kaynak, teslim yalnız hedef şube.
- **Toplu ürün girişi (`toplu.ts`):** satır = varyant. Kayıtlı barkod → o varyanta stok; aynı marka+ad → mevcut ürüne yeni varyant; yoksa yeni ürün. Her ürün grubu kendi işleminde (biri hata verirse diğerleri etkilenmez).
- **Sıfırlamalar:** *İstatistik sıfırlama* = `Ayar.istatistikSifirlamaNoktasi` (hiçbir kayıt silinmez, geri alınır; raporlar bu andan öncesini saymaz). *Fabrika ayarları* = TRUNCATE + yalnız süper admin ve ana şube kalır. İkisi de sunucuda **onay metni + şifre** ister (yanlış şifrede hız sınırı).

## 5. Barkod ve yapay zeka
- Barkod: önce tarayıcıda çözülür (`BarcodeDetector`, yoksa ZXing), EAN-8/13/UPC **sağlama toplamı** doğrulanır (`src/lib/barkod.ts`). USB/Bluetooth okuyucu klavye gibi hızlı yazıp Enter basar (`useBarkodDinleyici`). Barkodsuz ürüne dahili EAN-13 (`20…`) üretilir.
- AI (`src/lib/ai.ts`): etiket/ürün fotoğrafı → marka, ad, tür, renk, beden, barkod, fiyat. Zincir: Groq (anahtarlar arasında döner; 429/5xx'te diğer anahtar) → Gemini (model zinciri). 40 sn zaman aşımı, zod doğrulaması + bir yeniden deneme, görsel hash önbelleği (7 gün), kullanıcı başına dakikada 25 istek. **Uydurma yok:** okunamayan alan `null`. AI'nın okuduğu barkod da sağlama toplamından geçer.
- Renk/beden sözlüğü `src/lib/giyim.ts` (siyah/black/SİYAH → "Siyah"; "W32 L34" → "32/34"). Tuzak: `toLocaleLowerCase("tr-TR")` "LIGHT" → "lıght" yapar; sözlük iki biçimi de dener.

## 6. Güvenlik
- Şifre: scrypt + tuz. Oturum: rastgele token, çerezde ham, DB'de sha256; `httpOnly`, `sameSite=lax`, üretimde `secure`. Şifre/rol/şube/pasif değişince ilgili oturumlar silinir.
- Giriş hız sınırı (DB'de): hesap başına 15 dk'da 5 hata; IP başına 30 (mağazadaki herkes aynı IP'yi paylaşabilir). Yıkıcı işlemlerde de ayrı sınır.
- CSRF: değiştiren isteklerde `Origin` = `Host` zorunlu (üretimde başlık yoksa reddedilir).
- Yönetici hesapları panelden açılır; şifre otomatik üretilir, **bir kez** gösterilir, ilk girişte değiştirilmesi **zorunlu** (`sifreDegistirmeli`; API de bunu zorlar). Açık kayıt (signup) yoktur; "ilk kurulum" yalnız kullanıcı yokken ve tek seferlik çalışır.
- Girdiler zod ile doğrulanır; yüklenen görsel içerik türü bayt imzasından doğrulanır; CSV dışa aktarımda formül enjeksiyonu önlenir; HTTP güvenlik başlıkları `next.config.ts`'de.
- Denetim kaydı: giriş, hesap/şube, fiyat, iptal/iade, sıfırlama, yedek vb.

## 7. Arayüz
Tek tasarım dili (`globals.css` token'ları + `components/ui.tsx`): siyah/şampanya palet, koyu/açık tema (flaş yok), Playfair Display başlık + Inter gövde. **Para tutarları Inter'de** (Playfair'de ₺ simgesi bozuk). Mobilde alt gezinme + "Menü" sayfası; dokunma hedefleri ≥44 px. PWA manifest var (Ana ekrana ekle); çevrimdışı mod yok.

## 8. Demo/veri araçları
`npm run db:demo` yereli fabrika durumuna alıp deterministik örnek veri (4 ürün: Jagger Takım/Prada, Eşofman/Calvin Klein, Polo Tişört/Hermès, Kot Pantolon/Hugo; ~4 ay satış, alış, gider, iade, transfer) üretir. Görseller `public/urunler/*.jpg` dosya adlarına bağlıdır (dosyalar eklenmemişse marka baş harfi görünür).
