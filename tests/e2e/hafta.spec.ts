import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { kontrolBasamagi } from "../../src/lib/barkod";

// "Yavuz abinin bir haftası": gerçek bir mağaza gününün tüm adımları, web + telefon + tablet, çoklu oturum.
// Her metin alanına TUŞ TUŞ yazılır ve odağın kaybolmadığı doğrulanır (telefon klavyesi hatasının sürekli regresyon testi).
test.describe.configure({ mode: "serial" });

const ORIGIN = "http://localhost:3200";
const YAVUZ = { ad: "Yavuz Yılmaz", email: "yavuz@iqfashion.test", sifre: "Yavuz12345" };
const ean = (g: string) => g + kontrolBasamagi(g);
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVQYV2P8z8Dwn4EIwDiqkL4KAQDhPAn+CE7vNQAAAABJRU5ErkJggg==", "base64");

const BARKOD_MONT = "86914253"; // geçerli EAN-8: aynı barkod birden çok renge basılmış (gerçek hayatta görülen durum)
const BARKOD_KOT = ean("869000000001");
const BARKOD_GOMLEK = ean("869000000002");
const BARKOD_GOMLEK_L = ean("869000000003");

type Cihaz = { ctx: BrowserContext; page: Page };
let browser: Browser;
const cihazlar: Record<string, Cihaz> = {};
const gecici: Record<string, string> = {};
let beklenenSatis = 0; // test boyunca yapılan satışların bağımsız toplamı (panel rakamıyla karşılaştırılır)

const alarm = (p: Page) => p.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Tuş tuş yazar; her tuşta odağın korunduğunu ve değerin tam girildiğini doğrular. */
async function yaz(alan: ReturnType<Page["locator"]>, metin: string) {
  await alan.click();
  await alan.fill(""); // alan önceden doluysa temizle
  await alan.pressSequentially(metin, { delay: 12 });
  await expect(alan).toHaveValue(metin);
  await expect(alan).toBeFocused();
}

async function cihazAc(tur: "pc" | "telefon" | "tablet"): Promise<Cihaz> {
  const ayar = {
    pc: { viewport: { width: 1366, height: 820 } },
    telefon: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    tablet: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
  }[tur];
  const ctx = await browser.newContext({ baseURL: ORIGIN, locale: "tr-TR", timezoneId: "Europe/Istanbul", ...ayar });
  return { ctx, page: await ctx.newPage() };
}

async function girisYap(c: Cihaz, email: string, sifre: string) {
  await c.page.goto("/giris");
  await yaz(c.page.getByLabel("E-posta"), email);
  await yaz(c.page.getByLabel("Şifre", { exact: true }), sifre);
  await c.page.getByRole("button", { name: "Giriş yap" }).click();
  await c.page.waitForURL((u) => !u.pathname.startsWith("/giris"));
}

async function ilkGiris(c: Cihaz, email: string, tempSifre: string, yeniSifre: string) {
  await c.page.goto("/giris");
  await yaz(c.page.getByLabel("E-posta"), email);
  await yaz(c.page.getByLabel("Şifre", { exact: true }), tempSifre);
  await c.page.getByRole("button", { name: "Giriş yap" }).click();
  await c.page.waitForURL("**/sifre-degistir");
  await expect(c.page.getByRole("button", { name: /Çıkış yap/ })).toBeVisible(); // zorunlu şifre ekranında kilitli kalınmaz
  await yaz(c.page.getByLabel("Geçici şifre (size iletilen)"), tempSifre);
  await yaz(c.page.getByLabel("Yeni şifre", { exact: true }), yeniSifre);
  await yaz(c.page.getByLabel("Yeni şifre (tekrar)"), yeniSifre);
  await c.page.getByRole("button", { name: "Şifremi kaydet ve devam et" }).click();
  await c.page.waitForURL((u) => !u.pathname.startsWith("/sifre-degistir"));
}

/** Sahte yapay zeka: etiket fotoğrafları sırayla bu yanıtlarla okunur (ağ düzeyinde yakalanır). */
async function aiSirasi(page: Page, liste: Record<string, unknown>[]) {
  let i = 0;
  await page.route("**/api/ai/etiket", (route) => {
    const o = liste[i++] ?? {};
    return route.fulfill({
      json: { sonuc: { marka: null, urunAdi: null, kategori: null, renk: null, beden: null, barkod: null, barkodGecerli: false, fiyat: null, cinsiyet: null, sezon: null, guven: 0.9, uyarilar: [], ...o } },
    });
  });
}

test.beforeAll(async ({ browser: b, request }) => {
  browser = b;
  // Bağımsız çalışabilmek için: sistem boşsa yöneticiyi kur
  const d = await (await request.get(`${ORIGIN}/api/auth/kurulum`)).json();
  if (d.kurulumGerekli) await request.post(`${ORIGIN}/api/auth/kurulum`, { data: { ad: YAVUZ.ad, email: YAVUZ.email, sifre: YAVUZ.sifre }, headers: { origin: ORIGIN } });
});
test.afterAll(async () => {
  for (const c of Object.values(cihazlar)) await c.ctx.close();
});

test("Pazartesi sabahı: Yavuz abi aynı hesapla bilgisayar, telefon ve tabletten girer; üçü de açık kalır", async () => {
  for (const tur of ["pc", "telefon", "tablet"] as const) {
    cihazlar[tur] = await cihazAc(tur);
    await girisYap(cihazlar[`${tur}`], YAVUZ.email, YAVUZ.sifre);
    await expect(cihazlar[tur].page.getByRole("heading", { name: /Merhaba, Yavuz/ })).toBeVisible();
  }
  // Sonradan giren cihazlar öncekileri ATMAMALI: hepsi hâlâ oturumlu
  for (const tur of ["pc", "telefon", "tablet"] as const) {
    const p = cihazlar[tur].page;
    await p.goto("/stok");
    await expect(p.getByRole("heading", { name: "Stok" })).toBeVisible();
    expect((await p.request.get("/api/auth/ben")).status()).toBe(200);
  }
  // Kalıcı oturum çerezi 30 gün
  const cerez = (await cihazlar.pc.ctx.cookies()).find((c) => c.name === "iq_oturum")!;
  expect(cerez.expires - Date.now() / 1000).toBeGreaterThan(29 * 86400);
});

test("Müdür ve kasiyer hesapları açılır (tüm alanlara tuş tuş yazılır), ilk girişte şifre belirlenir", async () => {
  const p = cihazlar.pc.page;
  for (const [ad, email, rol, anahtar] of [["Ahmet Kaya", "ahmet@iqfashion.test", "SUBE_MUDURU", "ahmet"], ["Elif Demir", "elif@iqfashion.test", "KASIYER", "elif"]] as const) {
    await p.goto("/kullanicilar");
    await p.getByRole("button", { name: "Yeni kullanıcı" }).click();
    const d = p.getByRole("dialog");
    await yaz(d.getByLabel("Ad soyad"), ad);
    await yaz(d.getByLabel("E-posta (giriş adı)"), email);
    await d.getByRole("combobox", { name: "Rol", exact: true }).selectOption(rol);
    await d.getByRole("combobox", { name: "Şube", exact: true }).selectOption({ label: "Merkez" });
    await d.getByRole("button", { name: "Hesabı oluştur" }).click();
    gecici[anahtar] = (await p.getByRole("dialog").locator("code").first().innerText()).trim();
    await p.getByRole("button", { name: "Tamam" }).click();
  }
  cihazlar.mudur = await cihazAc("pc");
  await ilkGiris(cihazlar.mudur, "ahmet@iqfashion.test", gecici.ahmet, "Ahmet12345");
  cihazlar.kasiyer = await cihazAc("telefon");
  await ilkGiris(cihazlar.kasiyer, "elif@iqfashion.test", gecici.elif, "Elif12345");
  await expect(cihazlar.mudur.page.getByRole("heading", { name: /Merhaba, Ahmet/ })).toBeVisible();
  await expect(cihazlar.kasiyer.page).toHaveURL(/\/satis/);
});

test("Telefondan toplu ürün girişi: etiketler tek tek çekilir; aynı barkod farklı renklerde, tekrarlanan fotoğraf, geçersiz barkod", async () => {
  const p = cihazlar.telefon.page;
  await aiSirasi(p, [
    { marka: "Prada", urunAdi: "ERKEK SIŞME MONT", kategori: "Mont", renk: "Siyah", beden: "L", barkod: BARKOD_MONT, barkodGecerli: true, fiyat: 4000 },
    { marka: "Prada", urunAdi: "ERKEK SIŞME MONT", kategori: "Mont", renk: "Lacivert", beden: "L", barkod: BARKOD_MONT, barkodGecerli: true, fiyat: 4000 },
    { marka: "Prada", urunAdi: "ERKEK SIŞME MONT", kategori: "Mont", renk: "Lacivert", beden: "M", barkod: BARKOD_MONT, barkodGecerli: true, fiyat: 4000 },
    { marka: "Prada", urunAdi: "ERKEK SIŞME MONT", kategori: "Mont", renk: "Siyah", beden: "L", barkod: BARKOD_MONT, barkodGecerli: true, fiyat: 4000 }, // aynı etiket iki kez çekildi
    { marka: "Hugo", urunAdi: "Slim Fit Kot Pantolon", kategori: "Pantolon", renk: "Açık Mavi", beden: "32", barkod: BARKOD_KOT, barkodGecerli: true, fiyat: 1790 },
    { marka: "Lacoste", urunAdi: "Polo Tişört", kategori: "Tişört", renk: "Beyaz", beden: "M", barkod: null, fiyat: 1290, uyarilar: ["Barkod rakamları sağlama toplamından geçmedi; yanlış okunmuş olabilir. Lütfen kontrol edin."] },
  ]);
  await p.goto("/urunler/yeni");
  const dosya = p.locator('input[type="file"][multiple]');
  for (let i = 1; i <= 6; i++) {
    await dosya.setInputFiles({ name: `etiket${i}.png`, mimeType: "image/png", buffer: PNG });
    await expect(p.getByText(/AI okudu/)).toHaveCount(i, { timeout: 30000 });
  }
  await expect(p.getByText(/Elle tamamlayın/)).toHaveCount(0);
  // Uyarılar görünür: barkod sağlama toplamı, ve (sunucu kararı) çakışma kaydetme sonrası mesajda
  await expect(p.getByText(/sağlama toplamından geçmedi/)).toBeVisible();
  await p.getByText("Ortak değerler").click();
  await yaz(p.getByLabel("Alış fiyatı (₺)"), "1000");
  await yaz(p.getByLabel("Adet", { exact: true }).first(), "3");
  await p.getByRole("button", { name: "Tümüne uygula" }).click();
  await expect(p.getByText(/6 satır kayda hazır/)).toBeVisible();
  await p.getByRole("button", { name: /Hepsini kaydet \(6\)/ }).click();
  await expect(p.getByText(/satır kaydedildi/).first()).toBeVisible({ timeout: 30000 });
  await expect(p.getByText(/0 satır kaydedildi|satırda hata var/)).toHaveCount(0);
  await expect(p.getByText(/sistem barkodu verildi/).first()).toBeVisible(); // renk/beden farklı + aynı barkod: veri birleşmedi

  // Gerçek durum (API): lacivert mont ayrı varyant olarak VAR, siyah montun stoğuna karışmadı
  const a = cihazlar.pc.page;
  const ara = async (q: string) => (await (await a.request.get(`/api/pos/ara?q=${encodeURIComponent(q)}`)).json()).sonuclar as { id: string; renk: string; beden: string; barkod: string; stok: number; urunAdi: string; satisFiyati: number }[];
  const montlar = await ara("SIŞME MONT");
  expect(montlar.map((m) => `${m.renk}/${m.beden}`).sort()).toEqual(["Lacivert/L", "Lacivert/M", "Siyah/L"]);
  const siyah = montlar.find((m) => m.renk === "Siyah")!;
  expect(siyah.barkod).toBe(BARKOD_MONT);
  expect(siyah.stok).toBe(6); // iki fotoğraf birleşti: 3 + 3
  for (const m of montlar.filter((x) => x.renk === "Lacivert")) {
    expect(m.barkod).not.toBe(BARKOD_MONT);
    expect(m.barkod).toMatch(/^20\d{11}$/);
    expect(m.stok).toBe(3);
  }
  expect((await ara("Polo Tişört")).length).toBe(1);
  expect((await ara("Polo Tişört"))[0].barkod).toMatch(/^20\d{11}$/); // geçersiz barkodun yerine sistem barkodu
  // Ürünler sayfasında montun kartı iki rengiyle görünür
  await a.goto("/urunler?q=mont");
  await expect(a.getByText("ERKEK SIŞME MONT")).toHaveCount(1);
  await expect(a.getByText(/2 renk · 3 varyant/)).toBeVisible();
  await a.goto("/urunler?q=lacivert");
  await expect(a.getByText("ERKEK SIŞME MONT")).toBeVisible(); // "lacivert" arayınca bulunur
});

test("Bilgisayardan tek ürün: tüm alanlara tuş tuş yazılır, barkod elle girilir; kayıtlı barkod+renk+beden ise stok eklenir", async () => {
  const p = cihazlar.pc.page;
  await p.goto("/urunler/yeni");
  await p.getByRole("button", { name: /Tek ürün/ }).click();
  await p.getByRole("button", { name: "Gömlek", exact: true }).click();
  await yaz(p.getByLabel("Ürün adı *"), "Oxford Slim Gömlek");
  await yaz(p.getByLabel("Marka", { exact: true }), "Lacoste");
  await p.getByRole("button", { name: "Beyaz", exact: true }).click();
  await p.getByPlaceholder("Beden ekle").fill("M");
  await p.getByRole("button", { name: "Bedeni ekle" }).click();
  await p.getByPlaceholder("Beden ekle").fill("L");
  await p.getByRole("button", { name: "Bedeni ekle" }).click();
  await p.getByLabel("Beyaz M adet").fill("1"); // yarış testi için tek adet
  await p.getByLabel("Beyaz L adet").fill("4");
  await p.getByText("Varyant barkodları").click();
  const kutular = p.getByPlaceholder("otomatik");
  await yaz(kutular.nth(0), BARKOD_GOMLEK);
  await yaz(kutular.nth(1), BARKOD_GOMLEK_L);
  await yaz(p.getByLabel("Alış fiyatı (₺) *"), "700");
  await yaz(p.getByLabel("Satış fiyatı (₺) *"), "1490");
  await p.getByRole("button", { name: "Ürünü kaydet" }).click();
  await expect(p.getByRole("heading", { name: "Ürün kaydedildi" })).toBeVisible();
  const stok = async (kod: string) => (await (await p.request.get(`/api/barkod/${kod}`)).json()).varyant.stok;
  expect(await stok(BARKOD_GOMLEK)).toBe(1);
  expect(await stok(BARKOD_GOMLEK_L)).toBe(4);
  // Aynı ürünü, aynı barkod + aynı renk/beden ile tekrar gir: yeni ürün AÇILMAZ, stok artar
  await p.goto("/urunler/yeni");
  await p.getByRole("button", { name: /Tek ürün/ }).click();
  await yaz(p.getByLabel("Ürün adı *"), "Başka Yazılmış Ad");
  await p.getByRole("button", { name: "Beyaz", exact: true }).click();
  await p.getByPlaceholder("Beden ekle").fill("L");
  await p.getByRole("button", { name: "Bedeni ekle" }).click();
  await p.getByLabel("Beyaz L adet").fill("6");
  await p.getByText("Varyant barkodları").click();
  await yaz(p.getByPlaceholder("otomatik").first(), BARKOD_GOMLEK_L);
  await yaz(p.getByLabel("Alış fiyatı (₺) *"), "700");
  await yaz(p.getByLabel("Satış fiyatı (₺) *"), "1490");
  await p.getByRole("button", { name: "Ürünü kaydet" }).click();
  await expect(p.getByText(/zaten kayıtlıydı/)).toBeVisible();
  expect(await stok(BARKOD_GOMLEK_L)).toBe(10);
  await p.goto("/urunler?q=Başka");
  await expect(p.getByText("Ürün bulunamadı")).toBeVisible();
});

test("Tabletten mal kabul: gelen malın ALIŞ ve SATIŞ fiyatı girilir; yeni fiyat satışa yansır", async () => {
  const t = cihazlar.tablet.page;
  await t.goto("/alis");
  await yaz(t.getByLabel("Tedarikçi"), "Demo Toptan");
  await yaz(t.getByLabel("Ürün ara"), "Kot");
  await t.getByRole("button", { name: /Slim Fit Kot/ }).first().click();
  const satir = t.getByRole("listitem").filter({ hasText: "Slim Fit Kot" });
  await yaz(satir.getByLabel("Adet"), "10");
  await expect(satir.getByLabel("Satış fiyatı ₺")).toHaveValue("1790"); // mevcut satış fiyatı hazır gelir
  await satir.getByLabel("Birim maliyet ₺").fill("950");
  await satir.getByLabel("Satış fiyatı ₺").fill("1990");
  await t.getByRole("button", { name: "Mal kabulü kaydet" }).click();
  await expect(t.getByText(/Mal kabul kaydedildi: 10 adet/)).toBeVisible();
  const kot = (await (await cihazlar.pc.page.request.get(`/api/barkod/${BARKOD_KOT}`)).json()).varyant;
  expect(kot.satisFiyati).toBe(1990); // kasadaki fiyat güncellendi
  expect(kot.stok).toBe(13); // 3 + 10
});

test("Satış günü: kasiyer telefonda barkodu tek tek yazar (ürün tek kez eklenir), bilgisayardaki stok kendiliğinden güncellenir", async () => {
  const k = cihazlar.kasiyer.page;
  const pc = cihazlar.pc.page;
  // Yavuz bilgisayarında Stok sayfasında Kot'a bakıyor (yenilemeden, canlı güncellenecek)
  await pc.goto("/stok?q=Slim Fit Kot");
  const hucre = pc.getByRole("row").filter({ hasText: "Slim Fit Kot" }).first();
  await expect(hucre).toContainText("13");

  await k.goto("/satis");
  const barkod = k.getByLabel("Barkod");
  await yaz(barkod, BARKOD_KOT); // klavye kapanmadan 12 rakam
  await barkod.press("Enter");
  const sepet = k.getByRole("complementary", { name: "Sepet" });
  await expect(sepet.getByText("(1 ürün)")).toBeVisible(); // 2 değil 1: çift ekleme olmamalı
  await expect(sepet.getByLabel("Adet")).toHaveText("1");
  await k.getByRole("button", { name: /Ödemeye geç/ }).tap();
  await k.getByRole("dialog").getByRole("radio", { name: "Nakit" }).tap();
  await k.getByRole("dialog").getByRole("button", { name: "Satışı tamamla" }).tap();
  await expect(k.getByText("Satış kaydedildi")).toBeVisible();
  await expect(k.getByText(/Fiş no: MERKEZ-\d{8}-0001/)).toBeVisible();
  beklenenSatis += 1990;

  // Bilgisayar yenilenmeden stok 13 -> 12 olur (en geç ~20 sn)
  await expect(hucre).toContainText("12", { timeout: 40000 });
});

test("Aynı anda iki cihazdan SON ürün satılır: biri başarır, diğeri anlaşılır uyarı alır; stok asla eksiye düşmez", async () => {
  const m = cihazlar.mudur.page;
  const k = cihazlar.kasiyer.page;
  for (const p of [m, k]) {
    await p.goto("/satis");
    await yaz(p.getByLabel("Barkod"), BARKOD_GOMLEK); // stoğu 1 olan gömlek
    await p.getByLabel("Barkod").press("Enter");
    await expect(p.getByRole("complementary", { name: "Sepet" }).getByText("(1 ürün)")).toBeVisible();
  }
  const bas = async (p: Page, masaustu: boolean) => {
    if (masaustu) await p.getByRole("complementary", { name: "Sepet" }).getByRole("button", { name: "Satışı tamamla" }).click();
    else {
      await p.getByRole("button", { name: /Ödemeye geç/ }).click();
      await p.getByRole("dialog").getByRole("button", { name: "Satışı tamamla" }).click();
    }
  };
  await Promise.all([bas(m, true), bas(k, false)]);
  await expect.poll(async () => (await m.getByText("Satış kaydedildi").count()) + (await k.getByText("Satış kaydedildi").count()), { timeout: 20000 }).toBe(1);
  await expect.poll(async () => (await alarm(m).count()) + (await alarm(k).count()) + (await m.getByText(/Yetersiz stok/).count()) + (await k.getByText(/Yetersiz stok/).count()), { timeout: 20000 }).toBeGreaterThan(0);
  beklenenSatis += 1490;
  expect((await (await cihazlar.pc.page.request.get(`/api/barkod/${BARKOD_GOMLEK}`)).json()).varyant.stok).toBe(0);
});

test("Müdür: indirimli ve fiyat değiştirilmiş satış, kısmi iade ve iptal; rakamlar doğru kalır", async () => {
  const m = cihazlar.mudur.page;
  await m.goto("/satis");
  await yaz(m.getByLabel("Ürün ara"), "SIŞME MONT");
  await m.getByRole("button", { name: /SIŞME MONT.*Siyah/ }).first().click();
  const sepet = m.getByRole("complementary", { name: "Sepet" });
  await sepet.getByRole("button", { name: "Artır" }).click(); // 2 adet siyah mont
  await sepet.getByLabel("Birim fiyat").fill("3900"); // müdür fiyatı düşürdü
  await yaz(sepet.getByPlaceholder("0"), "100"); // 100 TL indirim
  await sepet.getByRole("radio", { name: "Kart" }).click();
  await sepet.getByRole("button", { name: "Satışı tamamla" }).click();
  await expect(m.getByText("Satış kaydedildi")).toBeVisible();
  await expect(m.getByText(tl(7700)).first()).toBeVisible(); // 2 × 3900 − 100
  beklenenSatis += 7700;
  await m.getByRole("button", { name: "Yeni satış" }).click();

  // İade: 1 adet geri geliyor → net 3850 iade (3900 − indirim payı 50)
  await m.goto("/hareketler");
  await m.locator("summary").first().click();
  await m.getByRole("button", { name: "İade al" }).click();
  await m.getByLabel(/iade adedi/).fill("1");
  await m.getByRole("button", { name: "İadeyi onayla" }).click();
  await expect(m.getByText(/İade alındı/)).toBeVisible();
  beklenenSatis -= 3850;
  // Kasiyer iptal/iade göremez
  await cihazlar.kasiyer.page.goto("/hareketler");
  await expect(cihazlar.kasiyer.page).toHaveURL(/\/satis/);
});

test("Giderler ve gelir girilir; panel rakamları (satış, kasa) elle hesapla birebir tutar", async () => {
  const p = cihazlar.pc.page;
  await p.goto("/muhasebe?donem=bugun");
  for (const [kategori, tutar, aciklama] of [["Kira", "38000", "Ekim kirası"], ["Maaş", "21000", "Personel"]] as const) {
    await p.getByRole("button", { name: "Kayıt ekle" }).click();
    const d = p.getByRole("dialog");
    await d.getByRole("combobox", { name: "Kategori" }).selectOption(kategori);
    await yaz(d.getByLabel("Tutar (₺)"), tutar);
    await yaz(d.getByLabel("Açıklama (isteğe bağlı)"), aciklama);
    await d.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(p.getByText("Gider kaydedildi")).toBeVisible();
  }
  await p.goto("/");
  const gunluk = p.locator("section").first().locator("> div").first();
  await expect(gunluk).toContainText(tl(beklenenSatis)); // Günlük satış = yaptığımız satışlar
  const o = await (await p.request.get("/api/subeler")).json();
  expect(o.subeler.length).toBeGreaterThan(0);
  await p.goto("/muhasebe?donem=bugun");
  await expect(p.getByText(tl(59000)).first()).toBeVisible(); // işletme gideri 38.000 + 21.000
});

test("Sayım (telefon): barkodlar tek tek yazılıp okutulur; stok sayılan adede eşitlenir ve hareket kaydı düşer", async () => {
  const t = cihazlar.telefon.page;
  await t.goto("/stok");
  await t.getByRole("button", { name: "Sayım modu" }).click();
  const d = t.getByRole("dialog");
  for (const kod of [BARKOD_GOMLEK_L, BARKOD_GOMLEK_L, BARKOD_GOMLEK_L, BARKOD_MONT]) {
    const alan = d.getByLabel("Barkod");
    await yaz(alan, kod);
    await alan.press("Enter");
  }
  await expect(d.getByText(/Oxford Slim Gömlek/)).toBeVisible();
  await d.getByRole("button", { name: /Sayımı uygula/ }).click();
  await expect(t.getByText(/ürünün sayımı uygulandı/)).toBeVisible();
  const gomlek = (await (await t.request.get(`/api/barkod/${BARKOD_GOMLEK_L}`)).json()).varyant;
  expect(gomlek.stok).toBe(3); // 10 → sayılan 3
  await t.goto("/hareketler?sekme=hareket&tip=SAYIM");
  await expect(t.getByRole("cell", { name: "Sayım", exact: true }).first()).toBeVisible();
});

test("Haftalık rapor ve PDF; marka/renk kırılımları; etiket yazdırma", async () => {
  const p = cihazlar.pc.page;
  await p.goto("/raporlar?donem=hafta");
  await expect(p.getByText("Prada").first()).toBeVisible();
  await expect(p.getByText("Lacoste").first()).toBeVisible();
  await p.goto("/raporlar/yazdir?donem=hafta");
  await expect(p.getByRole("heading", { name: "Haftalık Rapor" })).toBeVisible();
  await p.emulateMedia({ media: "print" });
  const pdf = await p.pdf({ format: "A4", printBackground: true });
  await p.emulateMedia({ media: "screen" });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await p.goto("/etiketler");
  await yaz(p.getByLabel("Ürün ara"), "SIŞME");
  await p.getByRole("button", { name: /SIŞME MONT.*Lacivert/ }).first().click();
  await expect(p.locator("svg[aria-label^='Barkod']").first()).toBeVisible();
});

test("Mobil ve tablet: tüm ana sayfalar yatay taşmaz; alt gezinme ve menü çalışır", async () => {
  for (const tur of ["telefon", "tablet"] as const) {
    const p = cihazlar[tur].page;
    for (const yol of ["/", "/satis", "/urunler", "/stok", "/urunler/yeni", "/alis", "/transferler", "/hareketler", "/raporlar", "/muhasebe", "/kullanicilar", "/ayarlar", "/yardim"]) {
      await p.goto(yol);
      await p.waitForLoadState("networkidle");
      const tasma = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(tasma, `${tur} ${yol} yatay taşma`).toBeLessThanOrEqual(2);
    }
  }
  const t = cihazlar.telefon.page;
  await t.goto("/");
  await t.getByRole("navigation", { name: "Hızlı gezinme" }).getByRole("link", { name: "Satış" }).tap();
  await expect(t).toHaveURL(/\/satis/);
  await t.getByRole("button", { name: "Menü" }).tap();
  await expect(t.getByRole("dialog").getByRole("link", { name: "Raporlar" })).toBeVisible();
});

test("Hafta sonu: üç cihaz da hâlâ açık; bir cihazdan çıkış diğerlerini atmaz; denetim kaydı hepsini gösterir", async () => {
  for (const tur of ["pc", "telefon", "tablet"] as const) expect((await cihazlar[tur].page.request.get("/api/auth/ben")).status(), `${tur} oturumu`).toBe(200);
  // Tabletten çıkış
  await cihazlar.tablet.page.goto("/");
  await cihazlar.tablet.page.getByRole("button", { name: "Menü" }).tap();
  await cihazlar.tablet.page.getByRole("dialog").getByRole("button", { name: "Çıkış yap" }).tap();
  await expect(cihazlar.tablet.page).toHaveURL(/\/giris/);
  expect((await cihazlar.pc.page.request.get("/api/auth/ben")).status()).toBe(200);
  expect((await cihazlar.telefon.page.request.get("/api/auth/ben")).status()).toBe(200);
  await cihazlar.pc.page.goto("/denetim");
  for (const olay of ["Toplu ürün girişi", "Ürün ekledi", "Gelir/gider kaydetti", "Kullanıcı oluşturdu"]) await expect(cihazlar.pc.page.getByText(olay).first()).toBeVisible();
  // Müdür/kasiyer oturumları da bozulmadı
  expect((await cihazlar.mudur.page.request.get("/api/auth/ben")).status()).toBe(200);
  expect((await cihazlar.kasiyer.page.request.get("/api/auth/ben")).status()).toBe(200);
});

test("Beden grupları (toplu AI): üst grup S–3XL ve alt grup 30–42 kutularına adet yazılır; etikette olmayan barkod AI ikinci okumayla tamamlanır", async () => {
  const p = cihazlar.telefon.page;
  const B_KAZAK = ean("869000000010");
  const B_PANTOLON = ean("869000000011");
  const B_TISORT = ean("869000000012");
  await aiSirasi(p, [
    { marka: "Zara", urunAdi: "Kapüşonlu Kazak", kategori: "Kazak", renk: "Gri", beden: "XL", barkod: B_KAZAK, barkodGecerli: true, fiyat: 1200 },
    { marka: "Zara", urunAdi: "Chino Pantolon", kategori: "Pantolon", renk: "Bej", beden: "32", barkod: B_PANTOLON, barkodGecerli: true, fiyat: 900 },
    { marka: "Zara", urunAdi: "Basic Tişört", kategori: "Tişört", renk: "Beyaz", beden: "M", barkod: null, fiyat: 800 }, // ilk okumada barkod çıkmadı
  ]);
  let barkodCagrisi = 0;
  await p.route("**/api/ai/barkod", (route) => { barkodCagrisi++; return route.fulfill({ json: { sonuc: { barkod: B_TISORT, gecerli: true } } }); });
  await p.goto("/urunler/yeni");
  const dosya = p.locator('input[type="file"][multiple]');
  for (let i = 1; i <= 3; i++) {
    await dosya.setInputFiles({ name: `grup${i}.png`, mimeType: "image/png", buffer: PNG });
    await expect(p.getByText(/AI okudu/)).toHaveCount(i, { timeout: 30000 });
  }
  expect(barkodCagrisi).toBe(1); // yalnızca barkodu eksik kalan fotoğraf için odaklı ikinci okuma
  await expect(p.getByLabel("Barkod", { exact: true }).nth(2)).toHaveValue(B_TISORT);
  await yaz(p.getByLabel("Alış fiyatı (₺)"), "500"); // 3 satırda "Ortak değerler" kendiliğinden açık
  await p.getByRole("button", { name: "Boş alanlara uygula" }).click();
  // Satır 1: üst grup; satır 2: alt grup; satır 3: tek beden (varsayılan)
  const gruplar = p.getByRole("group", { name: "Beden girişi" }); // 0: ortak, 1-3: satırlar
  await gruplar.nth(1).getByRole("button", { name: /Üst grup/ }).click();
  await expect(p.getByLabel("S adet", { exact: true })).toBeVisible();
  await yaz(p.getByLabel("XL adet", { exact: true }), "5");
  await p.getByLabel("3XL adet", { exact: true }).fill("3");
  await p.getByLabel("M adet", { exact: true }).first().fill("3");
  await gruplar.nth(2).getByRole("button", { name: /Alt grup/ }).click();
  await expect(p.getByLabel(/^(30|31|32|33|34|36|38|40|42) adet$/)).toHaveCount(9);
  await p.getByLabel("32 adet", { exact: true }).fill("4");
  await p.getByLabel("34 adet", { exact: true }).fill("2");
  await p.getByLabel("36 adet", { exact: true }).fill("1");
  await expect(p.getByText(/Toplam 11 adet/)).toBeVisible();
  await expect(p.getByText(/3 satır kayda hazır/)).toBeVisible();
  await p.getByRole("button", { name: /Hepsini kaydet \(3\)/ }).click();
  await expect(p.getByText(/3 beden, 11 adet kaydedildi/)).toBeVisible({ timeout: 30000 });
  await expect(p.getByText(/3 beden, 7 adet kaydedildi/)).toBeVisible();
  await expect(p.getByText(/satırda hata var/)).toHaveCount(0);

  const a = cihazlar.pc.page;
  const ara = async (q: string) => (await (await a.request.get(`/api/pos/ara?q=${encodeURIComponent(q)}`)).json()).sonuclar as { renk: string; beden: string; barkod: string; stok: number }[];
  const kazak = await ara("Kapüşonlu Kazak");
  expect(kazak.map((v) => `${v.beden}:${v.stok}`).sort()).toEqual(["3XL:3", "M:3", "XL:5"]);
  expect(kazak.find((v) => v.beden === "XL")!.barkod).toBe(B_KAZAK); // etiketteki barkod okunan bedende
  for (const v of kazak.filter((x) => x.beden !== "XL")) expect(v.barkod).toMatch(/^20\d{11}$/);
  const pantolon = await ara("Chino Pantolon");
  expect(pantolon.map((v) => `${v.beden}:${v.stok}`).sort()).toEqual(["32:4", "34:2", "36:1"]);
  expect(pantolon.find((v) => v.beden === "32")!.barkod).toBe(B_PANTOLON);
  const tisort = await ara("Basic Tişört");
  expect(tisort).toHaveLength(1);
  expect(tisort[0].barkod).toBe(B_TISORT);
  expect(tisort[0].stok).toBe(1);
});

test("Beden grupları (tek ürün, adım adım): üst/alt grup düğmeleri kutuları açar; adetler doğru varyantlara yazılır", async () => {
  const p = cihazlar.pc.page;
  await p.goto("/urunler/yeni");
  await p.getByRole("button", { name: /Tek ürün/ }).click();
  await yaz(p.getByLabel("Ürün adı *"), "Deri Ceket Grup");
  await yaz(p.getByLabel("Marka", { exact: true }), "Mango");
  await p.getByRole("button", { name: "Siyah", exact: true }).click();
  await p.getByRole("button", { name: /Alt grup \(30–42\)/ }).click();
  await expect(p.getByLabel(/^Siyah \d+ adet$/)).toHaveCount(9);
  await p.getByRole("button", { name: /Üst grup \(S–3XL\)/ }).click();
  await expect(p.getByLabel(/^Siyah \S+ adet$/)).toHaveCount(6);
  await yaz(p.getByLabel("Siyah S adet", { exact: true }), "3");
  await p.getByLabel("Siyah M adet", { exact: true }).fill("2");
  await p.getByLabel("Siyah XL adet", { exact: true }).fill("10");
  await p.getByLabel("Siyah 3XL adet", { exact: true }).fill("1");
  await yaz(p.getByLabel("Alış fiyatı (₺) *"), "900");
  await yaz(p.getByLabel("Satış fiyatı (₺) *"), "2500");
  await expect(p.getByText(/6 varyant · 16 adet/)).toBeVisible();
  await p.getByRole("button", { name: "Ürünü kaydet" }).click();
  await expect(p.getByRole("heading", { name: "Ürün kaydedildi" })).toBeVisible();
  const liste = (await (await p.request.get(`/api/pos/ara?q=${encodeURIComponent("Deri Ceket Grup")}`)).json()).sonuclar as { beden: string; stok: number }[];
  expect(liste.filter((v) => v.stok > 0).map((v) => `${v.beden}:${v.stok}`).sort()).toEqual(["3XL:1", "M:2", "S:3", "XL:10"]);
});
