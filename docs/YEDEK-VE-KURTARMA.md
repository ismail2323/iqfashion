# Yedekleme, izleme ve veri kurtarma

> Amaç: Yavuz abinin verisi (ürünler, stok, satışlar) hiçbir şekilde tek bir yerde kalmasın; sorun olursa dakikalar içinde geri getirilsin.

## Neler otomatik çalışır (GitHub Actions, depo PRIVATE olmalı)
| Ne | Ne zaman | Dosya | Sorun olursa |
|---|---|---|---|
| **Günlük yedek** (`pg_dump`, tam veritabanı) | Her gece 03:30 (TR) | `.github/workflows/yedek.yml` | Çalışma başarısız olur → GitHub e-posta gönderir |
| **Geri yükleme denemesi** (yedek boş bir veritabanına yüklenip kayıt sayıları canlıyla karşılaştırılır) | Yedeğin hemen ardından, her gece | aynı dosya | Sayılar tutmazsa çalışma başarısız olur |
| **Güvenli çöp temizliği** | Yedek başarılıysa | `scripts/temizlik.mts` | Aşağıya bakın |
| **Sistem izleme** (uygulama ayakta mı?) | 30 dakikada bir; günde 1 kez veritabanı da denenir | `.github/workflows/izleme.yml` | Başarısız olursa GitHub e-posta gönderir |

Yedekler: GitHub → **Actions → "Gunluk yedek" → ilgili çalışma → en altta Artifacts → `iqfashion-yedek`** (30 gün saklanır).
Tek seferlik kurulum: GitHub → Settings → Secrets and variables → Actions → **`DIRECT_URL`** (Neon "direct" bağlantı adresi). Depoyu Private yapın (yedekte tüm veri ve şifre özetleri vardır).
Elle yedek almak: Actions → "Gunluk yedek" → **Run workflow**.

## Veri kaybolursa: geri yükleme (3 adım)
1. **Son yedeği indirin** (Artifacts → zip içindeki `iqfashion_….dump`). Çok yeni bir sorunsa önce Neon'daki 6 saatlik geri sarmayı deneyin: Neon paneli → Branches → **Restore**.
2. **Boş veritabanına yükleyin** (Neon'da yeni proje/dal açın, "direct" adresini alın; PostgreSQL 18 istemcisi gerekir):
   ```
   pg_restore -d "<YENI_DIRECT_ADRES>" --no-owner --clean --if-exists iqfashion_YYYY-MM-DD_HHMM.dump
   ```
3. **Siteyi yeni veritabanına bağlayın:** Vercel → Project → Settings → Environment Variables → `DATABASE_URL` ve `DIRECT_URL` değerlerini yeni adreslerle değiştirin → Deployments → **Redeploy**. Sonra `https://iqfashion.vercel.app/api/saglik` → `{"ok":true}` ve giriş yapıp Ürünler/Stok sayfasını kontrol edin.

Yönetici şifresi unutulduysa: `docs/DEVAM-ET.md` → `npm run admin:sifre`.

## Çöp temizliği: ne silinir, ne ASLA silinmez
`npm run temizlik` önce **yalnızca rapor verir** (kuru çalıştırma); `-- --uygula` ile siler. Gece işi `--uygula` ile çalışır, ama yalnızca yedek başarılı olduktan sonra.
- **Silinenler:** hiçbir ürünün kullanmadığı ve 3 günden eski fotoğraflar; 7+ gün önce süresi dolan oturumlar; 30+ günlük giriş-denemesi sayaçları; 30+ günlük AI önbellek/kullanım kayıtları.
- **ASLA dokunulmaz:** ürün, varyant, stok, satış, alış, transfer, kasa, kullanıcı, şube, denetim kaydı.
- **Güvenlik freni:** fotoğrafların yarısından fazlası "kullanılmıyor" görünürse (adres biçimi değişmiş olabilir) hiçbir fotoğraf silinmez.
- Ürün silince fotoğrafı da uygulama tarafından silinir (başka ürün kullanmıyorsa).

## Bilinen sınırlar
- Yedek **gece** alınır: gün içindeki bir kayıp için Neon'un 6 saatlik geri sarması + son gecelik yedek birlikte kullanılır.
- Bedava planlar zamanla değişebilir; dükkân yoğun kullanıma geçince Neon'u ücretli plana almak en sağlamıdır (daha uzun geri sarma, daha fazla alan).
- GitHub zamanlanmış işleri nadiren birkaç dakika gecikebilir.
