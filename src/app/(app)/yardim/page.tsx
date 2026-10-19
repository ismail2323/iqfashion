import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { sayfaBaglami } from "@/lib/sayfa";
import { Baslik, Kart } from "@/components/ui";

export const metadata = { title: "Yardım" };

type Adim = { baslik: string; metin: React.ReactNode; link?: [string, string] };
type SSS = { s: string; c: React.ReactNode };

const YONETICI_ADIMLAR: Adim[] = [
  { baslik: "Şubenizi seçin", metin: "Üstteki menü şube müdürlerinde sabittir. Süper adminseniz çalışmak istediğiniz şubeyi menüden seçin." },
  { baslik: "Ürünleri girin", metin: "Etiket fotoğraflarını çekin ya da galeriden birden fazla seçin; yapay zeka marka, renk, beden, fiyat ve barkodu okur. Kontrol edip “Hepsini kaydet” deyin.", link: ["/urunler/yeni", "Ürün Ekle"] },
  { baslik: "Barkod etiketlerini basın", metin: "Üreticinin barkodu olmayan ürünlere sistem barkod üretir. Etiketler sayfasından yazdırıp ürüne yapıştırın.", link: ["/etiketler", "Etiket Yazdır"] },
  { baslik: "Mal geldiğinde stok ekleyin", metin: "Gelen malın barkodunu okutun, adet ve alış fiyatını girin.", link: ["/alis", "Mal Kabul"] },
  { baslik: "Satışı kasadan yapın", metin: "Barkodu okutun, ödeme tipini seçin, “Satışı tamamla”ya basın. Stok otomatik düşer.", link: ["/satis", "Satış"] },
  { baslik: "Ayda bir sayım yapın", metin: "Stok sayfasında “Sayım modu” ile raftaki ürünleri okutun; farklar otomatik düzeltme olarak kaydedilir.", link: ["/stok", "Stok"] },
];

const SUPER_ADIMLAR: Adim[] = [
  { baslik: "Şube açın", metin: "Şube adı ve müdür bilgisini girin; müdür hesabı otomatik oluşur, şifre ekranda bir kez görünür.", link: ["/subeler", "Şubeler"] },
  { baslik: "Giriş bilgisini iletin", metin: "“WhatsApp ile gönder” düğmesi hazır mesajı açar. Kişi ilk girişte kendi şifresini belirler; size tekrar sormasına gerek kalmaz." },
  { baslik: "Kasiyer ekleyin", metin: "Kullanıcılar sayfasından rolü “Kasiyer” seçin. Kasiyer yalnızca satış yapar, alış fiyatı ve kâr görmez.", link: ["/kullanicilar", "Kullanıcılar"] },
  { baslik: "Şubeler arası ürün gönderin", metin: "Transferler sayfasında gönderen şube “Gönder”, alan şube “Teslim al” der. Stok iki tarafta da otomatik güncellenir.", link: ["/transferler", "Transferler"] },
  { baslik: "Her akşam panele bakın", metin: "Günlük satış, kasa, kâr ve kritik stok anasayfada. Haftalık/aylık/yıllık PDF raporu üstteki düğmelerden.", link: ["/", "Panel"] },
  { baslik: "Bir şeyi yanlış mı yaptı biri?", metin: "Denetim Kaydı’nda kimin ne zaman ne yaptığı görünür. Şifre unuttuysa Kullanıcılar > “Şifre sıfırla”.", link: ["/denetim", "Denetim"] },
];

const KASIYER_ADIMLAR: Adim[] = [
  { baslik: "Satış ekranını açın", metin: "Giriş yapınca doğrudan Satış sayfası açılır.", link: ["/satis", "Satış"] },
  { baslik: "Ürünü okutun", metin: "Barkod okuyucuyla okutun (sayfada her yerde çalışır) ya da kamera simgesine basın. Barkod okunmazsa ürün adını yazıp arayın." },
  { baslik: "Adedi kontrol edin", metin: "Sepette + / − ile adedi değiştirin. Stokta olandan fazlası eklenemez." },
  { baslik: "Ödemeyi seçin", metin: "Nakit, Kart veya Havale/EFT seçip “Satışı tamamla”ya basın. Fiş yazdırılabilir." },
  { baslik: "Hata yaptıysanız", metin: "İptal ve iade yetkisi müdürdedir. Müdürünüze satış numarasını söyleyin." },
];

const SSS_LISTESI: SSS[] = [
  { s: "Barkod okunmuyor ne yapmalıyım?", c: "Barkodu çerçevenin ortasına alın, ışığı artırın (kamerada fener simgesi var) ve telefonu 15-20 cm uzaklıkta tutun. Olmazsa barkodun altındaki rakamları yazın veya fotoğraf düğmesiyle çekin; yapay zeka rakamları okur." },
  { s: "Kamera açılmıyor.", c: "Tarayıcı kamera izni sormuştur; “İzin ver”e basın. Daha önce reddettiyseniz adres çubuğundaki kilit simgesinden Kamera iznini açın. Siteyi yalnızca https:// adresiyle kullanın." },
  { s: "Ürün stokta görünmüyor ama elimde var.", c: "Önce doğru şubede olduğunuzu kontrol edin (stok şubeye özeldir). Sonra Stok > ürünü bulup kalem simgesiyle sayıyı düzeltin; fark kayıt altına alınır." },
  { s: "Yanlış fiyatla/yanlış ürün satış yaptım.", c: "Müdür Hareketler > Satışlar’dan satışı açıp “Satışı iptal et” der; stok otomatik geri gelir. Doğru satışı yeniden yapın." },
  { s: "Şifremi unuttum.", c: "Süper admine söyleyin; Kullanıcılar sayfasından “Şifre sıfırla” ile yeni geçici şifre üretir. İlk girişte kendi şifrenizi belirlersiniz." },
  { s: "Telefona uygulama gibi nasıl eklerim?", c: "Telefonda siteyi açın. iPhone: Paylaş > Ana Ekrana Ekle. Android: ⋮ menü > Uygulamayı yükle." },
  { s: "Fişi / etiketi yazdırırken boyut kayıyor.", c: "Yazdır penceresinde “Ölçek: %100” ve “Kenar boşluğu: Yok” seçin. Etiket yazıcıda doğru etiket boyutunu (50×30 mm) seçmeyi unutmayın." },
  { s: "Yapay zeka yanlış okudu.", c: "Okunan alanların hepsi düzenlenebilir; kaydetmeden önce kontrol edin. Etiketin net ve yakın çekilmesi doğruluğu çok artırır." },
];

export default async function YardimSayfasi() {
  const { kullanici } = await sayfaBaglami();
  const rol = kullanici.rol;
  const adimlar = rol === "SUPER_ADMIN" ? SUPER_ADIMLAR : rol === "SUBE_MUDURU" ? YONETICI_ADIMLAR : KASIYER_ADIMLAR;
  const baslik = rol === "SUPER_ADMIN" ? "Süper admin rehberi" : rol === "SUBE_MUDURU" ? "Şube müdürü rehberi" : "Kasiyer rehberi";
  return (
    <>
      <Baslik baslik="Yardım" aciklama="Her şey adım adım; takıldığınızda burayı açın." />
      <Kart className="mb-5 p-5">
        <h2 className="mb-4 font-display text-xl font-semibold">{baslik}</h2>
        <ol className="space-y-4">
          {adimlar.map((a, i) => (
            <li key={a.baslik} className="flex gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background">{i + 1}</span>
              <div className="min-w-0"><p className="font-medium">{a.baslik}</p><p className="mt-0.5 text-sm text-muted">{a.metin}</p>{a.link && <Link href={a.link[0]} className="mt-1 inline-block text-sm font-medium text-accent underline">{a.link[1]} sayfasına git →</Link>}</div>
            </li>
          ))}
        </ol>
      </Kart>

      {rol === "SUPER_ADMIN" && (
        <Kart className="mb-5 p-5">
          <h2 className="mb-3 font-display text-xl font-semibold">Şube müdürüne gönderilecek mesaj örneği</h2>
          <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm leading-relaxed">{`Merhaba, IQ Fashion yönetim paneli hesabınız hazır.
Giriş bilgileriniz ayrı mesajda. İlk girişte kendi şifrenizi belirleyeceksiniz.

Günlük işleyiş:
1) Satışları "Satış" sayfasından barkod okutarak yapın.
2) Mal geldiğinde "Mal Kabul" ile stoğa ekleyin.
3) Yeni ürünlerde "Ürün Ekle" sayfasında etiket fotoğraflarını çekin.
4) Akşam "Panel"den günlük rakamlarınıza bakın.
Bir sorun olursa "Yardım" sayfasına bakın.`}</pre>
        </Kart>
      )}

      <Kart className="overflow-hidden">
        <div className="border-b border-border px-5 py-4"><h2 className="font-display text-xl font-semibold">Sık sorulanlar</h2></div>
        <div className="divide-y divide-border">
          {SSS_LISTESI.map((x) => (
            <details key={x.s} className="group">
              <summary className="flex min-h-14 cursor-pointer select-none items-center gap-3 px-5 py-3 text-sm font-medium"><CheckCircle2 className="size-4 shrink-0 text-accent" />{x.s}</summary>
              <p className="px-5 pb-4 pl-12 text-sm text-muted">{x.c}</p>
            </details>
          ))}
        </div>
      </Kart>
    </>
  );
}
