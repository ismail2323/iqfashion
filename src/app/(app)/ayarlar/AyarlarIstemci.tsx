"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, Download, KeyRound, RotateCcw, Sparkles, Store, Trash2 } from "lucide-react";
import { Alan, Buton, Girdi, Kart, Rozet } from "@/components/ui";
import { CokAdimliOnay } from "@/components/CokAdimliOnay";
import { OnayModal } from "@/components/OnayModal";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/istemci";
import { sifreKurali } from "@/lib/sifreKurali";
import { tarihFormat } from "@/lib/tarih";
import { ONAY_FABRIKA, ONAY_ISTATISTIK } from "@/lib/onayMetinleri";

type Ai = { hazir: boolean; groqAnahtar: number; gemini: boolean; model: string };

export function AyarlarIstemci({ superAdmin, dukkanAdi, sifirlamaNoktasi, ai }: { superAdmin: boolean; dukkanAdi: string; sifirlamaNoktasi: string | null; ai: Ai }) {
  const router = useRouter();
  const bildir = useToast();
  const [ad, setAd] = useState(dukkanAdi);
  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [sifreHata, setSifreHata] = useState<string | null>(null);
  const [sifreYuk, setSifreYuk] = useState(false);
  const [istatistik, setIstatistik] = useState(false);
  const [fabrika, setFabrika] = useState(false);
  const [geriAl, setGeriAl] = useState(false);

  async function sifreDegistir(e: React.FormEvent) {
    e.preventDefault();
    setSifreHata(null);
    const k = sifreKurali(yeni);
    if (k) return setSifreHata(k);
    if (yeni !== tekrar) return setSifreHata("Yeni şifreler eşleşmiyor");
    setSifreYuk(true);
    try {
      await api("/api/auth/sifre", { govde: { mevcut, yeni } });
      bildir("Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.");
      setMevcut(""); setYeni(""); setTekrar("");
    } catch (er) { setSifreHata((er as Error).message); } finally { setSifreYuk(false); }
  }

  return (
    <div className="space-y-5">
      <Kart className="p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><KeyRound className="size-5 text-accent" /> Şifre değiştir</h2>
        <form onSubmit={sifreDegistir} className="grid max-w-xl gap-4">
          <Alan etiket="Mevcut şifre"><Girdi type="password" value={mevcut} onChange={(e) => setMevcut(e.target.value)} autoComplete="current-password" required /></Alan>
          <div className="grid gap-4 sm:grid-cols-2">
            <Alan etiket="Yeni şifre" ipucu="En az 8 karakter, harf ve rakam"><Girdi type="password" value={yeni} onChange={(e) => setYeni(e.target.value)} autoComplete="new-password" required /></Alan>
            <Alan etiket="Yeni şifre (tekrar)"><Girdi type="password" value={tekrar} onChange={(e) => setTekrar(e.target.value)} autoComplete="new-password" required /></Alan>
          </div>
          {sifreHata && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{sifreHata}</div>}
          <div><Buton type="submit" yukleniyor={sifreYuk}>Şifreyi güncelle</Buton></div>
        </form>
      </Kart>

      {superAdmin && (
        <>
          <Kart className="p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Store className="size-5 text-accent" /> Mağaza</h2>
            <form className="flex max-w-xl flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); try { await api("/api/ayarlar", { method: "PATCH", govde: { dukkanAdi: ad } }); bildir("Mağaza adı kaydedildi"); router.refresh(); } catch (er) { bildir((er as Error).message, "hata"); } }}>
              <div className="min-w-56 flex-1"><Alan etiket="Mağaza adı (raporlarda görünür)"><Girdi value={ad} onChange={(e) => setAd(e.target.value)} required /></Alan></div>
              <Buton type="submit" varyant="ikincil">Kaydet</Buton>
            </form>
          </Kart>

          <Kart className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Sparkles className="size-5 text-accent" /> Yapay zeka</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Rozet ton={ai.hazir ? "ok" : "tehlike"}>{ai.hazir ? "Hazır" : "Anahtar tanımlı değil"}</Rozet>
              <Rozet>Groq anahtarı: {ai.groqAnahtar}</Rozet>
              <Rozet ton={ai.gemini ? "ok" : "nötr"}>Gemini yedek: {ai.gemini ? "açık" : "kapalı"}</Rozet>
              <span className="text-muted">Model: {ai.model}</span>
            </div>
            <p className="mt-2 text-xs text-muted">Anahtarlar sunucu ortam değişkenlerinde tutulur ve ekranda gösterilmez. Değiştirmek için barındırma panelinden güncelleyin.</p>
          </Kart>

          <Kart className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Database className="size-5 text-accent" /> Yedek</h2>
            <p className="mb-3 text-sm text-muted">Tüm verinin (ürün, stok, satış, alış, transfer, gider, hareket, kullanıcılar) bir kopyasını bilgisayarınıza indirin. Şifreler dahil edilmez. Sıfırlama yapmadan önce indirmeniz önerilir.</p>
            <a href="/api/ayarlar/yedek" download className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"><Download className="size-4" /> Yedeği indir (.json)</a>
          </Kart>

          <Kart className="border-danger/30 p-5" id="sifirlama">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-danger"><AlertTriangle className="size-5" /> Tehlikeli bölge</h2>
            <p className="mb-5 text-sm text-muted">Bu işlemler birkaç onay ister ve en sonda şifrenizi doğrular.</p>

            <div className="space-y-5 divide-y divide-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-xl">
                  <h3 className="font-medium">İstatistikleri sıfırla</h3>
                  <p className="mt-1 text-sm text-muted">Panel ve raporlar bu andan itibaren <b>sıfırdan</b> saymaya başlar (satış, alış, gider, kasa). Hiçbir kayıt, ürün veya stok silinmez; istediğiniz zaman geri alabilirsiniz.</p>
                  {sifirlamaNoktasi && <p className="mt-2 text-sm text-warn">Şu an aktif: {tarihFormat(sifirlamaNoktasi, true)} tarihinden itibaren sayılıyor.</p>}
                </div>
                <div className="flex gap-2">
                  {sifirlamaNoktasi && <Buton varyant="ikincil" onClick={() => setGeriAl(true)}><RotateCcw className="size-4" /> Geri al</Buton>}
                  <Buton varyant="ikincil" className="border-danger/40 text-danger" onClick={() => setIstatistik(true)}>İstatistikleri sıfırla</Buton>
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3 pt-5">
                <div className="max-w-xl">
                  <h3 className="font-medium">Tüm verileri sil — fabrika ayarlarına dön</h3>
                  <p className="mt-1 text-sm text-muted">Ürünler, stoklar, satışlar, alışlar, transferler, giderler, şubeler ve <b>diğer tüm kullanıcılar</b> kalıcı olarak silinir. Yalnızca sizin hesabınız kalır. <b>Geri alınamaz.</b></p>
                </div>
                <Buton varyant="tehlike" onClick={() => setFabrika(true)}><Trash2 className="size-4" /> Fabrika ayarlarına dön</Buton>
              </div>
            </div>
          </Kart>

          <CokAdimliOnay acik={istatistik} kapat={() => setIstatistik(false)} baslik="İstatistikleri sıfırla" uc="/api/ayarlar/istatistik-sifirla" onayMetni={ONAY_ISTATISTIK}
            anladimMetni="Panel ve raporların bu andan itibaren sıfırdan sayacağını anlıyorum."
            bilgi={<><p><b>Ne olacak?</b> Dashboard, raporlar ve muhasebe rakamları 0’dan başlar.</p><p><b>Ne olmayacak?</b> Ürün, stok, satış ve alış kayıtları silinmez; “Geri al” ile eski rakamlara dönebilirsiniz.</p></>}
            butonMetni="İstatistikleri sıfırla" bitti={() => { bildir("İstatistikler sıfırlandı"); router.refresh(); }} />
          <CokAdimliOnay acik={fabrika} kapat={() => setFabrika(false)} baslik="Fabrika ayarlarına dön" uc="/api/ayarlar/fabrika-sifirla" onayMetni={ONAY_FABRIKA}
            anladimMetni="Tüm verilerin KALICI olarak silineceğini, bunun geri alınamayacağını ve yedeği indirmediysem verilerimi kaybedeceğimi anlıyorum."
            bilgi={<><p><b>Silinecekler:</b> tüm ürünler ve görselleri, stoklar, satışlar, alışlar, transferler, gelir/giderler, hareket ve denetim geçmişi, tüm şubeler ve diğer tüm kullanıcılar.</p><p><b>Kalacaklar:</b> yalnızca sizin süper admin hesabınız ve varsayılan marka/tür listeleri.</p><p>Devam etmeden önce Ayarlar’daki <b>Yedeği indir</b> ile verilerinizin kopyasını alın.</p></>}
            butonMetni="Her şeyi kalıcı olarak sil" bitti={() => { bildir("Sistem fabrika ayarlarına döndürüldü"); window.location.href = "/"; }} />
          <OnayModal acik={geriAl} kapat={() => setGeriAl(false)} baslik="Sıfırlamayı geri al" onayMetni="Geri al" mesaj="İstatistikler yeniden tüm geçmiş kayıtları sayacak."
            calistir={async () => { try { await api("/api/ayarlar/geri-al", { method: "POST", govde: {} }); bildir("Sıfırlama geri alındı"); router.refresh(); } catch (e) { bildir((e as Error).message, "hata"); throw e; } }} />
        </>
      )}
    </div>
  );
}
