# Yapılacaklar, Bilinen Sınırlar ve Fikirler

Öncelik: 🔴 hemen · 🟠 yakın · 🟢 sonra

## 🔴 Gerçek kullanımdan önce
- [ ] GitHub deposunu **Private** yap; sohbette paylaşılan token/parola/anahtarları yenile (`docs/DEVAM-ET.md` §8).
- [ ] **Gerçek ürün fotoğraflarını ekle:** `public/urunler/` altına `jagger-takim.jpg`, `esofman-takimi.jpg`, `polo-tisort.jpg`, `kot-pantolon.jpg` (demo ürünler için). Gerçek ürünlerde fotoğraf uygulamadan yüklenir.
- [ ] Canlıdaki **demo veriyi ve demo hesapları sil** (Ayarlar → Fabrika ayarlarına dön; Merkez şube + süper admin kalır), sonra gerçek hesapları aç.
- [ ] Canlı süper admin şifresini güçlü bir şifreyle değiştir.
- [ ] **Gerçek cihazlarda dene:** telefonda kamera/barkod okuma (HTTPS gerekir), gerçek etiket yazıcısı (50×30 mm), gerçek etiketlerle AI doğruluğu (gerekirse `ETIKET_ISTEMI` metnini `src/lib/ai.ts`'de ayarla).
- [ ] Vercel **Hobby → Pro** (ticari kullanım) kararı.

## 🟠 Yakın
- [ ] Neon'u **Frankfurt**'a taşı + `vercel.json` bölgesi `fra1` (Türkiye'den gecikme; `docs/YAYIN-VE-VERITABANI.md` §5).
- [ ] Uyku gecikmesi için mesai saatlerinde ısıtma (cron-job.org → `/api/saglik`) ya da ücretli Neon planı.
- [ ] Kendi alan adı (ör. `iqfashion.com`) bağla.
- [ ] Haftalık otomatik yedek (Neon branch/pg_dump veya zamanlanmış iş) – şu an yedek elle indirilir.
- [ ] Kapsam dışı kalanlar: toplu içe aktarma için **Excel/CSV** (tedarikçi listeleri) – güvenli bir kütüphane seçilmeli (eski `xlsx` paketi açıklı olduğundan çıkarıldı).
- [ ] Ödeme dağılımı grafiği iade öncesi tutarları gösterir (muhasebede not var); iadeleri ödeme tipine yaymak istenirse `Satis`'a iade kaydı tablosu eklenmeli.

## 🟢 Fikirler
- Müşteri kartı / sadakat, taksit, e-fatura/e-arşiv entegrasyonu, kargo entegrasyonu (yurtiçi/yurtdışı satış var), WhatsApp sipariş bildirimi.
- E-posta ile şifre sıfırlama (şu an yalnızca süper admin sıfırlar; e-posta servisi yok).
- Ürün görsellerini harici depolamaya (Vercel Blob/Cloudinary) taşıma (Neon 0,5 GB sınırı dolarsa).
- HEIC (iPhone) fotoğraflarını sunucuda dönüştürme (tarayıcı çoğu zaman JPEG verir, ama garanti değil).
- Çevrimdışı satış (PWA + yerel kuyruk).
- Satış hedefleri, personel primi raporu, mevsimsel stok önerisi (AI).
- Denetim kaydı için arama/filtre ve dışa aktarma.

## Bilinen sınırlar (bilinçli)
- Stok şubeye özeldir; "tüm şubeler" görünümü yalnız okumadır, yazma işlemleri (satış, alış, sayım, ürün girişi) bir şube seçili olmasını ister.
- Fiyat listesi tüm şubeler için ortaktır ve yalnız süper admin değiştirir; şube müdürü satış anında fiyat/indirim girebilir.
- Aynı barkodlu iki farklı ürün tanımlanamaz (barkod benzersizdir).
- AI okuma doğruluğu fotoğraf kalitesine bağlıdır; alanlar kaydetmeden önce kullanıcı tarafından kontrol edilir.
- Bedava planlar: Neon uyku, 0,5 GB; Groq/Gemini ücretsiz kota (anahtar döngüsü + yedek sağlayıcı ile yönetilir).
