import Link from "next/link";
import { prisma } from "@/lib/db";
import { sayfaBaglami } from "@/lib/sayfa";
import { tarihFormat } from "@/lib/tarih";
import { Baslik, BosDurum, Kart, Rozet } from "@/components/ui";

export const metadata = { title: "Denetim Kaydı" };
const SAYFA = 50;

const AD: Record<string, string> = {
  giris: "Giriş yaptı", "ilk-kurulum": "İlk kurulum", "sube-olustur": "Şube oluşturdu", "sube-guncelle": "Şube güncelledi", "sube-aktif": "Şubeyi aktif etti", "sube-pasif": "Şubeyi pasife aldı", "sube-sil": "Şube sildi", "sube-tam-sil": "Şubeyi geçmişiyle birlikte sildi",
  "kullanici-olustur": "Kullanıcı oluşturdu", "kullanici-sil": "Kullanıcı sildi", "kullanici-guncelle": "Kullanıcı güncelledi", "sifre-sifirla": "Şifre sıfırladı", "sifre-degistir": "Şifre değiştirdi", "oturumlari-kapat": "Oturumları kapattı",
  "urun-olustur": "Ürün ekledi", "urun-guncelle": "Ürün güncelledi", "varyant-guncelle": "Fiyat/varyant güncelledi", "toplu-urun-girisi": "Toplu ürün girişi", "satis-iptal": "Satış iptal etti", "satis-iade": "İade aldı",
  "kasa-kaydi": "Gelir/gider kaydetti", "kasa-sil": "Gelir/gider sildi", "transfer-gonder": "Transfer gönderdi", "transfer-teslim": "Transfer teslim aldı", "transfer-iptal": "Transfer iptal etti",
  "istatistik-sifirla": "İstatistikleri sıfırladı", "istatistik-geri-al": "Sıfırlamayı geri aldı", "fabrika-sifirla": "FABRİKA AYARLARINA DÖNDÜ", "yedek-indir": "Yedek indirdi", "ayar-guncelle": "Ayar değiştirdi",
};
const TEHLIKELI = new Set(["fabrika-sifirla", "istatistik-sifirla", "sube-sil", "sube-tam-sil", "kullanici-sil", "satis-iptal", "kasa-sil", "sube-pasif"]);

export default async function DenetimSayfasi({ searchParams }: { searchParams: Promise<{ q?: string; sayfa?: string }> }) {
  await sayfaBaglami("SUPER_ADMIN");
  const sp = await searchParams;
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);
  const q = (sp.q ?? "").trim();
  const where = q ? { OR: [{ kullaniciSnap: { contains: q, mode: "insensitive" as const } }, { eylem: { contains: q, mode: "insensitive" as const } }] } : {};
  const [liste, n] = await Promise.all([prisma.denetimKaydi.findMany({ where, orderBy: { createdAt: "desc" }, skip: (sayfa - 1) * SAYFA, take: SAYFA }), prisma.denetimKaydi.count({ where })]);
  const toplamSayfa = Math.max(1, Math.ceil(n / SAYFA));
  const link = (s: number) => `/denetim?${new URLSearchParams({ ...(q ? { q } : {}), sayfa: String(s) })}`;
  return (
    <>
      <Baslik baslik="Denetim Kaydı" aciklama="Kim, ne zaman, ne yaptı: hesap, şube, fiyat, iptal ve sıfırlama işlemleri." />
      <form action="/denetim" className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Kullanıcı veya işlem ara…" aria-label="Ara" className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3.5 text-base focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)] md:text-sm" /><button className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background">Ara</button></form>
      <Kart className="overflow-hidden">
        {liste.length === 0 ? <BosDurum baslik="Kayıt yok" /> : (
          <ul className="divide-y divide-border">
            {liste.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="w-36 shrink-0 text-xs text-muted">{tarihFormat(k.createdAt, true)}</span>
                <span className="min-w-0 flex-1"><b>{k.kullaniciSnap?.split(" <")[0] ?? "Sistem"}</b> <span className="text-muted">·</span> {AD[k.eylem] ?? k.eylem}</span>
                {TEHLIKELI.has(k.eylem) && <Rozet ton="uyari">Kritik</Rozet>}
                {k.detay != null && <code className="max-w-full basis-full truncate rounded bg-surface-2 px-2 py-0.5 text-[11px] text-muted sm:basis-auto sm:max-w-sm">{JSON.stringify(k.detay)}</code>}
              </li>
            ))}
          </ul>
        )}
      </Kart>
      {toplamSayfa > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Sayfalar">
          {sayfa > 1 && <Link href={link(sayfa - 1)} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Önceki</Link>}
          <span className="text-sm text-muted">{sayfa} / {toplamSayfa}</span>
          {sayfa < toplamSayfa && <Link href={link(sayfa + 1)} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Sonraki</Link>}
        </nav>
      )}
    </>
  );
}
