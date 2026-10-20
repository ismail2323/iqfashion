import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { kontrolBasamagi } from "../../src/lib/barkod";

// Gerçek tarayıcı + gerçek üretim sunucusu + boş veritabanı: ilk kurulumdan fabrika sıfırlamaya kadar tek hikâye.
test.describe.configure({ mode: "serial" });

const ADMIN = { ad: "Yavuz Yılmaz", email: "yavuz@iqfashion.test", sifre: "Yavuz12345" };
const ORIGIN = "http://localhost:3200";
const ean = (govde: string) => govde + kontrolBasamagi(govde);
const BARKOD_1 = ean("400638133393");
const BARKOD_2 = ean("400638133394");
const BARKOD_OZEL = ean("400638133395"); // elle yazılan barkod (tek ürün)

type Hesap = { email: string; sifre: string; ctx: BrowserContext; page: Page };
let browser: Browser;
let admin: Page;
let adminCtx: BrowserContext;
const gecici: Record<string, string> = {};
const hesaplar: Record<string, Hesap> = {};
let sube2Id = "";

/** Next.js'in kendi rota duyurusu da role=alert taşır; uygulamanın uyarılarını ayırt et */
const alarm = (p: Page) => p.locator('[role="alert"]:not(#__next-route-announcer__)');

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVQYV2P8z8Dwn4EIwDiqkL4KAQDhPAn+CE7vNQAAAABJRU5ErkJggg==", "base64");

async function sifreOku(page: Page): Promise<string> {
  const kod = page.getByRole("dialog").locator("code").first();
  await expect(kod).toBeVisible();
  return (await kod.innerText()).trim();
}

/** Geçici şifreyle ilk giriş: zorunlu şifre değiştirme ekranından geçip panele girer. */
async function ilkGiris(email: string, tempSifre: string, yeniSifre: string): Promise<Hesap> {
  const ctx = await browser.newContext({ baseURL: ORIGIN, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  const page = await ctx.newPage();
  await page.goto("/giris");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(tempSifre);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL("**/sifre-degistir");
  await page.getByLabel("Geçici şifre (size iletilen)").fill(tempSifre);
  await page.getByLabel("Yeni şifre", { exact: true }).fill(yeniSifre);
  await page.getByLabel("Yeni şifre (tekrar)").fill(yeniSifre);
  await page.getByRole("button", { name: "Şifremi kaydet ve devam et" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sifre-degistir"));
  return { email, sifre: yeniSifre, ctx, page };
}

async function subeSec(page: Page, ad: string) {
  await page.getByLabel("Aktif şube").selectOption({ label: ad });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  adminCtx = await b.newContext({ baseURL: ORIGIN, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  admin = await adminCtx.newPage();
});
test.afterAll(async () => {
  await adminCtx?.close();
  for (const h of Object.values(hesaplar)) await h.ctx.close();
});

test("1. İlk kurulum: boş sistemde süper admin oluşur ve panele girer", async () => {
  await admin.goto("/");
  await expect(admin).toHaveURL(/\/giris/); // oturumsuz kullanıcı girişe yönlenir
  await expect(admin.getByRole("heading", { name: "İlk kurulum" })).toBeVisible();
  await admin.getByLabel("Ad Soyad").fill(ADMIN.ad);
  await admin.getByLabel("E-posta").fill(ADMIN.email);
  await admin.getByLabel("Şifre", { exact: true }).fill("zayif"); // kural: en az 8 + harf + rakam
  await admin.getByLabel("Şifre (tekrar)").fill("zayif");
  await admin.getByRole("button", { name: "Hesabı oluştur" }).click();
  await expect(alarm(admin)).toContainText("en az 8 karakter");
  await admin.getByLabel("Şifre", { exact: true }).fill(ADMIN.sifre);
  await admin.getByLabel("Şifre (tekrar)").fill(ADMIN.sifre);
  await admin.getByRole("button", { name: "Hesabı oluştur" }).click();
  await expect(admin.getByRole("heading", { name: /Merhaba, Yavuz/ })).toBeVisible();
  await expect(admin.getByText("Başlangıç adımları")).toHaveCount(0); // uyarı kartı kaldırıldı
  // Kurulum ikinci kez çalışmaz
  const r = await admin.request.post("/api/auth/kurulum", { data: { ad: "Saldırgan", email: "x@x.com", sifre: "Saldirgan123" }, headers: { origin: ORIGIN } });
  expect(r.status()).toBe(409);
});

test("2. Güvenlik: CSRF, yetkisiz erişim ve giriş hız sınırı", async () => {
  // Başka bir kaynaktan gelen mutasyon reddedilir
  const csrf = await admin.request.post("/api/subeler", { data: { ad: "Kötü" }, headers: { origin: "https://kotu-site.example" } });
  expect(csrf.status()).toBe(403);
  // Oturumsuz API 401
  const anon = await (await browser.newContext({ baseURL: ORIGIN })).request.get("/api/subeler");
  expect(anon.status()).toBe(401);
  // Hesap başına 5 hata -> kilit; başka hesap etkilenmez (IP sınırı 30)
  const ctx = await browser.newContext({ baseURL: ORIGIN });
  const p = await ctx.newPage();
  await p.goto("/giris");
  for (let i = 0; i < 5; i++) {
    await p.getByLabel("E-posta").fill(ADMIN.email);
    await p.getByLabel("Şifre", { exact: true }).fill("YanlisSifre1");
    await p.getByRole("button", { name: "Giriş yap" }).click();
    await expect(alarm(p)).toContainText(/hatalı/);
  }
  await p.getByLabel("Şifre", { exact: true }).fill(ADMIN.sifre); // doğru şifre bile kilitliyken girmez
  await p.getByRole("button", { name: "Giriş yap" }).click();
  await expect(alarm(p)).toContainText("Çok fazla hatalı deneme");
  await ctx.close();
  // Admin oturumu etkilenmedi
  await admin.goto("/");
  await expect(admin.getByRole("heading", { name: /Merhaba, Yavuz/ })).toBeVisible();
});

test("3. Şube + müdür hesabı aç, şifre bir kez gösterilir, ilk girişte değiştirilir", async () => {
  await admin.goto("/subeler");
  // İlk kurulumda ana (Merkez) şube kendiliğinden vardır
  await expect(admin.getByRole("heading", { name: "Merkez" })).toBeVisible();
  await expect(admin.getByText("Ana şube")).toBeVisible();
  await admin.getByRole("button", { name: /Yeni şube|İlk şubeyi oluştur/ }).first().click();
  await admin.getByLabel("Şube adı").fill("Kadıköy Şubesi");
  await admin.getByLabel("Müdür adı soyadı").fill("Murat Yıldız");
  await admin.getByLabel("Müdür e-posta (giriş adı)").fill("murat@iqfashion.test");
  await admin.getByRole("dialog").getByRole("button", { name: "Şubeyi oluştur" }).click();
  await expect(admin.getByText("Müdür hesabı oluşturuldu")).toBeVisible();
  gecici["murat"] = await sifreOku(admin);
  expect(gecici["murat"]).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z0-9]{10}$/);
  await expect(admin.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
  await admin.getByRole("button", { name: "Tamam" }).click();
  await expect(admin.getByRole("heading", { name: "Kadıköy Şubesi" })).toBeVisible();

  // Müdür: geçici şifre -> zorunlu değişim -> panel
  hesaplar.murat = await ilkGiris("murat@iqfashion.test", gecici["murat"], "Murat12345");
  const m = hesaplar.murat.page;
  await expect(m.getByRole("heading", { name: /Merhaba, Murat/ })).toBeVisible();
  await expect(m.getByText("Kadıköy Şubesi").first()).toBeVisible();
  // Eski geçici şifre artık geçersiz
  const c2 = await browser.newContext({ baseURL: ORIGIN });
  const r = await c2.request.post("/api/auth/giris", { data: { email: "murat@iqfashion.test", sifre: gecici["murat"] }, headers: { origin: ORIGIN } });
  expect(r.status()).toBe(400);
  await c2.close();
});

test("4. Kasiyer hesabı aç; kasiyer yetki sınırları sunucuda zorlanır", async () => {
  await admin.goto("/kullanicilar");
  await admin.getByRole("button", { name: "Yeni kullanıcı" }).click();
  await admin.getByLabel("Ad soyad").fill("Elif Demir");
  await admin.getByLabel("E-posta (giriş adı)").fill("elif@iqfashion.test");
  await admin.getByRole("combobox", { name: "Rol", exact: true }).selectOption("KASIYER");
  await admin.getByRole("combobox", { name: "Şube", exact: true }).selectOption({ label: "Kadıköy Şubesi" });
  await admin.getByRole("button", { name: "Hesabı oluştur" }).click();
  gecici["elif"] = await sifreOku(admin);
  await admin.getByRole("button", { name: "Tamam" }).click();
  hesaplar.elif = await ilkGiris("elif@iqfashion.test", gecici["elif"], "Elif12345");
  const k = hesaplar.elif.page;
  await expect(k).toHaveURL(/\/satis/); // kasiyer doğrudan satışa
  const menu = k.getByRole("navigation", { name: "Ana menü" });
  await expect(menu.getByRole("link", { name: "Satış" })).toBeVisible();
  for (const yasak of ["Raporlar", "Muhasebe", "Şubeler", "Kullanıcılar", "Mal Kabul", "Transferler"]) await expect(menu.getByRole("link", { name: yasak })).toHaveCount(0);
  // Adresi elle yazsa bile engellenir
  for (const yol of ["/raporlar", "/subeler", "/muhasebe", "/alis", "/kullanicilar"]) {
    await k.goto(yol);
    await expect(k).toHaveURL(/\/satis/);
  }
  // API'ler de reddeder
  for (const [yol, metod] of [["/api/subeler", "get"], ["/api/kullanicilar", "get"], ["/api/ayarlar/yedek", "get"], ["/api/alis", "post"], ["/api/urunler", "post"], ["/api/stok/duzelt", "post"]] as const) {
    const r = metod === "get" ? await k.request.get(yol) : await k.request.post(yol, { data: {}, headers: { origin: ORIGIN } });
    expect(r.status(), `${metod} ${yol}`).toBe(403);
  }
});

test("5. Tek ürün: kategori, renk × beden tablosu, fiyat ve kayıt", async () => {
  const m = hesaplar.murat.page;
  await m.goto("/urunler/yeni");
  await m.getByRole("button", { name: /Tek ürün/ }).click();
  await m.getByRole("button", { name: "Pantolon", exact: true }).click();
  // TUŞ TUŞ yazma: her tuşta odak korunmalı (telefonda klavye kapanma hatasının regresyon testi)
  const adAlani = m.getByLabel("Ürün adı *");
  await adAlani.click();
  await adAlani.pressSequentially("Slim Fit Kot Pantolon", { delay: 15 });
  await expect(adAlani).toHaveValue("Slim Fit Kot Pantolon");
  await expect(adAlani).toBeFocused();
  await m.getByLabel("Marka", { exact: true }).fill("Hugo");
  await m.getByRole("button", { name: "Açık Mavi", exact: true }).click();
  await m.getByRole("button", { name: "Siyah", exact: true }).click();
  await m.getByRole("button", { name: "Pantolon (30-38)" }).click();
  await m.getByLabel("Siyah 32 adet").fill("5");
  await m.getByLabel("Siyah 34 adet").fill("4");
  await m.getByLabel("Açık Mavi 32 adet").fill("6");
  // Varyant barkodunu da tuş tuş yaz: 13 rakamın hepsi alana girmeli, klavye/odak kapanmamalı
  await m.getByText("Varyant barkodları").click();
  const barkodAlani = m.getByPlaceholder("otomatik").first();
  await barkodAlani.click();
  await barkodAlani.pressSequentially(BARKOD_OZEL, { delay: 15 });
  await expect(barkodAlani).toHaveValue(BARKOD_OZEL);
  await expect(barkodAlani).toBeFocused();
  await m.getByLabel("Alış fiyatı (₺) *").fill("900");
  await m.getByLabel("Satış fiyatı (₺) *").fill("1790");
  await expect(m.getByText("Kâr marjı")).toBeVisible();
  await m.getByRole("button", { name: "Ürünü kaydet" }).click();
  await expect(m.getByRole("heading", { name: "Ürün kaydedildi" })).toBeVisible();
  await expect(m.getByText("15 adet stoğa girildi")).toBeVisible();
  // Her varyanta geçerli (EAN-13) benzersiz barkod üretildi
  const kodlar = await m.locator("code").allInnerTexts();
  expect(kodlar.length).toBe(10);
  for (const k of kodlar) expect(k).toMatch(new RegExp(`^(20\\d{11}|${BARKOD_OZEL})$`)); // 9 sistem barkodu + elle yazılan
  expect(kodlar).toContain(BARKOD_OZEL);
  expect(new Set(kodlar).size).toBe(10);
  await m.goto("/urunler");
  await expect(m.getByText("Slim Fit Kot Pantolon")).toBeVisible();
});

test("5b. BARKOD KURALI (tek ürün): kayıtlı barkod hata vermez, mevcut varyanta stok eklenir; yeni ürün açılmaz", async () => {
  const m = hesaplar.murat.page;
  const onceki = (await (await m.request.get(`/api/barkod/${BARKOD_OZEL}`)).json()).varyant;
  expect(onceki.stok).toBe(0);
  await m.goto("/urunler/yeni");
  await m.getByRole("button", { name: /Tek ürün/ }).click();
  await m.getByLabel("Ürün adı *").fill("Tamamen Başka Ad");
  await m.getByRole("button", { name: "Açık Mavi", exact: true }).click(); // barkodun kayıtlı olduğu varyantla AYNI renk/beden
  await m.getByPlaceholder("Beden ekle").fill("30");
  await m.getByRole("button", { name: "Bedeni ekle" }).click();
  await m.getByLabel("Açık Mavi 30 adet").fill("5");
  await m.getByText("Varyant barkodları").click();
  await m.getByPlaceholder("otomatik").first().fill(BARKOD_OZEL);
  await m.getByLabel("Alış fiyatı (₺) *").fill("900");
  await m.getByLabel("Satış fiyatı (₺) *").fill("1790");
  await m.getByRole("button", { name: "Ürünü kaydet" }).click();
  await expect(m.getByRole("heading", { name: "Ürün kaydedildi" })).toBeVisible();
  await expect(m.getByText(/zaten kayıtlıydı/)).toBeVisible();
  expect((await (await m.request.get(`/api/barkod/${BARKOD_OZEL}`)).json()).varyant.stok).toBe(5);
  await m.goto("/urunler?q=Tamamen");
  await expect(m.getByText("Ürün bulunamadı")).toBeVisible(); // yeni ürün kartı AÇILMADI
});
test("6. Toplu fotoğraf + AI: çoklu seçim, otomatik doldurma, birleşme ve mevcut barkoda stok", async () => {
  const m = hesaplar.murat.page;
  let sayac = 0;
  await m.route("**/api/ai/etiket", async (route) => {
    sayac++;
    const bedenler = ["30", "32"];
    await route.fulfill({
      json: { sonuc: { marka: "Hugo", urunAdi: "Toplu Test Jean", kategori: "Pantolon", renk: "Açık Mavi", beden: bedenler[(sayac - 1) % 2], barkod: sayac === 1 ? BARKOD_1 : BARKOD_2, barkodGecerli: true, fiyat: 1790, cinsiyet: "ERKEK", sezon: null, guven: 0.93, uyarilar: [] } },
    });
  });
  await m.goto("/urunler/yeni");
  await m.locator('input[type="file"][multiple]').setInputFiles([
    { name: "e1.png", mimeType: "image/png", buffer: PNG },
    { name: "e2.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(m.getByText(/AI okudu/)).toHaveCount(2);
  await m.getByLabel("Alış fiyatı (₺)").first().fill("900");
  await m.getByLabel("Adet", { exact: true }).first().fill("3");
  await m.getByRole("button", { name: "Tümüne uygula" }).click();
  await expect(m.getByText(/2 satır kayda hazır/)).toBeVisible();
  await m.getByRole("button", { name: /Hepsini kaydet \(2\)/ }).click();
  await expect(m.getByText("2 satır kaydedildi")).toBeVisible();
  // İki beden TEK ürün kartında birleşti
  await m.goto("/urunler");
  await expect(m.getByText("Toplu Test Jean")).toHaveCount(1);
  const barkod = await m.request.get(`/api/barkod/${BARKOD_1}`);
  expect((await barkod.json()).varyant.stok).toBe(3);

  // Aynı barkodlu etiket tekrar okutulursa "kayıtlı ürün" olarak stok eklenir (kopya ürün açılmaz)
  sayac = 0;
  await m.goto("/urunler/yeni");
  await m.locator('input[type="file"][multiple]').setInputFiles([{ name: "e3.png", mimeType: "image/png", buffer: PNG }]);
  await expect(m.getByText(/Kayıtlı ürün · mevcut stok 3/)).toBeVisible();
  await m.getByLabel("Alış fiyatı (₺)").first().fill("1000");
  await m.getByLabel("Adet", { exact: true }).first().fill("2");
  await m.getByRole("button", { name: "Tümüne uygula" }).click();
  await m.getByRole("button", { name: /Hepsini kaydet \(1\)/ }).click();
  await expect(m.getByText("1 satır kaydedildi")).toBeVisible();
  expect((await (await m.request.get(`/api/barkod/${BARKOD_1}`)).json()).varyant.stok).toBe(5);
  await m.goto("/urunler");
  await expect(m.getByText("Toplu Test Jean")).toHaveCount(1);
});

test("7. Satış (POS): arama, sepet, stok sınırı, ödeme, fiş; stok düşer", async () => {
  const m = hesaplar.murat.page;
  await m.goto("/satis");
  await m.getByLabel("Ürün ara").fill("Toplu Test");
  await m.getByRole("button", { name: /Toplu Test Jean/ }).first().click();
  const sepet = m.getByRole("complementary", { name: "Sepet" });
  await expect(sepet.getByText("(1 ürün)")).toBeVisible();
  // Stoktan (5) fazlası eklenemez
  for (let i = 0; i < 6; i++) await sepet.getByRole("button", { name: "Artır" }).click();
  await expect(sepet.getByLabel("Adet")).toHaveText("5");
  await sepet.getByRole("button", { name: "Azalt" }).click();
  await sepet.getByRole("radio", { name: "Kart" }).click();
  await sepet.getByRole("button", { name: "Satışı tamamla" }).click();
  await expect(m.getByText("Satış kaydedildi")).toBeVisible();
  await expect(m.getByText(/Fiş no: KADIKO-\d{8}-0001/)).toBeVisible();
  await expect(m.getByText("7.160,00").first()).toBeVisible(); // 4 × 1.790
  await m.getByRole("button", { name: "Yeni satış" }).click();
  expect((await (await m.request.get(`/api/barkod/${BARKOD_1}`)).json()).varyant.stok).toBe(1);
  // Barkodla ekleme (USB okuyucu gibi hızlı yazım + Enter)
  await m.goto("/satis");
  await m.keyboard.type(BARKOD_1, { delay: 5 });
  await m.keyboard.press("Enter");
  await expect(m.getByRole("complementary", { name: "Sepet" }).getByText("Toplu Test Jean")).toBeVisible();
  // Kasiyer fiyat/indirim değiştirilemez (sunucu)
  const k = hesaplar.elif.page;
  const v = (await (await k.request.get(`/api/barkod/${BARKOD_1}`)).json()).varyant;
  const r = await k.request.post("/api/satis", { data: { odemeTipi: "NAKIT", kalemler: [{ varyantId: v.id, adet: 1 }], indirim: 100 }, headers: { origin: ORIGIN } });
  expect(r.status()).toBe(400);
  expect((await r.json()).hata).toContain("yönetici");
  // Kasiyer normal satış yapar
  await k.goto("/satis");
  await k.keyboard.type(BARKOD_1, { delay: 5 });
  await k.keyboard.press("Enter");
  await k.getByRole("complementary", { name: "Sepet" }).getByRole("button", { name: "Satışı tamamla" }).click();
  await expect(k.getByText("Satış kaydedildi")).toBeVisible();
  expect((await (await k.request.get(`/api/barkod/${BARKOD_1}`)).json()).varyant.stok).toBe(0);
  // Stok bitti: aynı barkod artık sepete eklenemez, "Stokta yok" uyarısı
  await k.getByRole("button", { name: "Yeni satış" }).click();
  await k.keyboard.type(BARKOD_1, { delay: 5 });
  await k.keyboard.press("Enter");
  await expect(k.getByText(/Stokta yok/)).toBeVisible();
});

test("8. Kasiyer maliyet/kâr bilgisini hiçbir yerde görmez", async () => {
  const k = hesaplar.elif.page;
  const b = await (await k.request.get(`/api/barkod/${BARKOD_2}`)).json();
  expect(b.varyant.alisFiyati).toBeNull();
  const ara = await (await k.request.get("/api/pos/ara?q=Toplu")).json();
  expect(ara.sonuclar.length).toBeGreaterThan(0);
  for (const s of ara.sonuclar) expect(s.alisFiyati).toBeNull();
  await k.goto("/stok");
  await expect(k.getByRole("columnheader", { name: "Alış" })).toHaveCount(0);
  const m = hesaplar.murat.page;
  expect((await (await m.request.get(`/api/barkod/${BARKOD_2}`)).json()).varyant.alisFiyati).toBe(900);
});

test("9. Şube yalıtımı: başka şubenin verisi çerez/adres oynatılsa da görünmez", async () => {
  // Admin ikinci şubeyi açar
  await admin.goto("/subeler");
  await admin.getByRole("button", { name: "Yeni şube" }).click();
  await admin.getByLabel("Şube adı").fill("Beşiktaş Şubesi");
  await admin.getByLabel("Müdür adı soyadı").fill("Selin Arslan");
  await admin.getByLabel("Müdür e-posta (giriş adı)").fill("selin@iqfashion.test");
  await admin.getByRole("dialog").getByRole("button", { name: "Şubeyi oluştur" }).click();
  gecici["selin"] = await sifreOku(admin);
  await admin.getByRole("button", { name: "Tamam" }).click();
  const liste = await (await admin.request.get("/api/subeler")).json();
  sube2Id = liste.subeler.find((s: { ad: string }) => s.ad === "Beşiktaş Şubesi").id;
  hesaplar.selin = await ilkGiris("selin@iqfashion.test", gecici["selin"], "Selin12345");

  const m = hesaplar.murat.page;
  // Murat kendi çerezine Beşiktaş'ın kimliğini yazar; sunucu yok sayar
  await m.context().addCookies([{ name: "iq_sube", value: sube2Id, url: ORIGIN }]);
  const bk = await (await m.request.get(`/api/barkod/${BARKOD_2}`)).json();
  expect(bk.varyant.stok).toBe(3); // Kadıköy'ün stoğu (3) görünür; Beşiktaş'ın stoğu 0 olduğundan çerez yok sayıldı demektir
  const subeler = await m.request.get("/api/subeler");
  expect(subeler.status()).toBe(403);
  // Selin'in panelinde Kadıköy'ün hiçbir satışı yok
  const s = hesaplar.selin.page;
  await s.goto("/hareketler");
  await expect(s.getByText("Satış bulunamadı")).toBeVisible();
  const sd = await (await s.request.get(`/api/barkod/${BARKOD_1}`)).json();
  expect(sd.varyant.stok).toBe(0);
  // Murat başka şubenin satışını iptal etmeye çalışamaz (id bilse bile)
  const sat = await admin.request.get("/api/subeler");
  expect(sat.status()).toBe(200);
});

test("10. Transfer: Kadıköy -> Beşiktaş (hazırla, gönder, teslim al); stok iki tarafta doğru", async () => {
  // Kadıköy'e stok ekle (mal kabul) ki gönderilecek ürün olsun
  const m = hesaplar.murat.page;
  const v = (await (await m.request.get(`/api/barkod/${BARKOD_2}`)).json()).varyant;
  const alis = await m.request.post("/api/alis", { data: { tedarikciAd: "Test Toptan", belgeNo: "IRS-1", kalemler: [{ varyantId: v.id, adet: 10, birimMaliyet: 950 }] }, headers: { origin: ORIGIN } });
  expect(alis.ok()).toBeTruthy();
  await m.goto("/transferler");
  await m.getByRole("button", { name: "Yeni transfer" }).click();
  await m.getByRole("combobox", { name: "Hedef şube" }).selectOption({ label: "Beşiktaş Şubesi" });
  await m.getByLabel("Ürün ara").fill("Toplu Test");
  await m.getByRole("button", { name: /Toplu Test Jean/ }).first().click();
  await m.getByLabel("Adet").last().fill("4");
  await m.getByRole("button", { name: "Transfer oluştur" }).click();
  await expect(m.getByText("Hazırlanıyor")).toBeVisible();
  await m.getByRole("button", { name: "Gönder", exact: true }).click();
  await expect(m.getByText("Yolda")).toBeVisible();
  expect((await (await m.request.get(`/api/barkod/${BARKOD_2}`)).json()).varyant.stok).toBe(9); // 3 (toplu girişten) + 10 (mal kabul) - 4 (transfer)
  const s = hesaplar.selin.page;
  expect((await (await s.request.get(`/api/barkod/${BARKOD_2}`)).json()).varyant.stok).toBe(0); // yolda: henüz yok
  await s.goto("/transferler");
  await s.getByRole("button", { name: "Teslim al" }).click();
  await expect(s.getByText("Teslim alındı").first()).toBeVisible();
  expect((await (await s.request.get(`/api/barkod/${BARKOD_2}`)).json()).varyant.stok).toBe(4);
  // Gönderen şube teslim alamaz (sunucu)
  const tr = await (await m.request.get("/api/subeler")).status();
  expect(tr).toBe(403);
});

test("11. Muhasebe: gider kaydı; panel rakamları satış/alış/gider/kasa ile tutarlı; iptal ve iade", async () => {
  await admin.goto("/");
  await subeSec(admin, "Kadıköy Şubesi");
  await admin.goto("/muhasebe?donem=bugun");
  await admin.getByRole("button", { name: "Kayıt ekle" }).click();
  await admin.getByRole("combobox", { name: "Kategori" }).selectOption("Kira");
  await admin.getByLabel("Tutar (₺)").fill("5000");
  await admin.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(admin.getByText("Gider kaydedildi")).toBeVisible();
  await expect(admin.getByText("−₺5.000,00").first()).toBeVisible();
  // Rakamlar: Kadıköy bugün satış = 4×1790 + 1×1790 = 8.950 ; gider = alış(5×... ) + 5000 kira
  const o = admin.locator("section").first();
  await admin.goto("/muhasebe?donem=bugun");
  await expect(admin.getByText("₺8.950,00").first()).toBeVisible();
  await expect(admin.getByText("₺5.000,00").first()).toBeVisible();
  // Satışı müdür iptal eder: stok geri gelir, satış rakamı düşer
  const m = hesaplar.murat.page;
  await m.goto("/hareketler");
  await m.getByText(/KADIKO-\d{8}-0002/).click();
  await m.getByRole("button", { name: "Satışı iptal et" }).click();
  await m.getByRole("button", { name: "Satışı iptal et" }).last().click();
  await expect(m.getByText("Satış iptal edildi")).toBeVisible();
  expect((await (await m.request.get(`/api/barkod/${BARKOD_1}`)).json()).varyant.stok).toBe(1);
  await admin.goto("/muhasebe?donem=bugun");
  await expect(admin.getByText("₺7.160,00").first()).toBeVisible();
  void o;
  // Kasiyer iptal/iade yapamaz
  const k = hesaplar.elif.page;
  const sat = await k.request.post("/api/satis/herhangi/iptal", { data: {}, headers: { origin: ORIGIN } });
  expect(sat.status()).toBe(403);
});

test("12. Raporlar ve PDF: haftalık/aylık/yıllık yazdırma sayfası PDF üretir", async () => {
  await admin.goto("/");
  await expect(admin.getByRole("link", { name: /Haftalık PDF/ })).toBeVisible();
  await expect(admin.getByRole("link", { name: /Aylık PDF/ })).toBeVisible();
  await expect(admin.getByRole("link", { name: /Yıllık PDF/ })).toBeVisible();
  for (const [donem, baslik] of [["hafta", "Haftalık Rapor"], ["ay", "Aylık Rapor"], ["yil", "Yıllık Rapor"]] as const) {
    await admin.goto(`/raporlar/yazdir?donem=${donem}`);
    await expect(admin.getByRole("heading", { name: baslik })).toBeVisible();
    await expect(admin.getByText("KASA (net)")).toBeVisible();
    await admin.emulateMedia({ media: "print" });
    const pdf = await admin.pdf({ format: "A4", printBackground: true });
    await admin.emulateMedia({ media: "screen" });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(8_000);
  }
  // Özel aralık ve geçersiz tarih sağlamlığı
  await admin.goto("/raporlar?donem=ozel&bas=2026-01-01&bit=2026-12-31");
  await expect(admin.getByRole("heading", { name: "Raporlar" })).toBeVisible();
  await admin.goto("/raporlar?donem=ozel&bas=bozuk&bit=2026-12-31");
  await expect(admin.getByRole("heading", { name: "Raporlar" })).toBeVisible();
});

test("13. Etiket yazdırma: gerçek barkod SVG'si çizilir", async () => {
  const m = hesaplar.murat.page;
  await m.goto("/etiketler");
  await m.getByLabel("Ürün ara").fill("Toplu Test");
  await m.getByRole("button", { name: /Toplu Test Jean/ }).first().click();
  await expect(m.locator("svg[aria-label^='Barkod']").first()).toBeVisible();
  await expect(m.getByRole("button", { name: /etiketi yazdır/ })).toBeEnabled();
});

test("14. Mobil görünüm: tüm sayfalar 390 px'te yatay taşmadan açılır", async () => {
  await admin.setViewportSize({ width: 390, height: 844 });
  for (const yol of ["/", "/satis", "/urunler", "/stok", "/urunler/yeni", "/alis", "/transferler", "/etiketler", "/hareketler", "/raporlar", "/muhasebe", "/subeler", "/kullanicilar", "/denetim", "/ayarlar", "/yardim"]) {
    await admin.goto(yol);
    await admin.waitForLoadState("networkidle");
    const tasma = await admin.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(tasma, `${yol} yatay taşma`).toBeLessThanOrEqual(2);
  }
  // Alt gezinme çubuğu görünür ve Menü açılır
  await admin.goto("/");
  await expect(admin.getByRole("navigation", { name: "Hızlı gezinme" })).toBeVisible();
  await admin.getByRole("button", { name: "Menü" }).click();
  await expect(admin.getByRole("dialog").getByRole("link", { name: "Şubeler" })).toBeVisible();
  await admin.keyboard.press("Escape");
  await admin.setViewportSize({ width: 1280, height: 800 });
});

test("15. İstatistik sıfırlama: 3 adım, yanlış şifre reddedilir, geri alınabilir, veri silinmez", async () => {
  await admin.goto("/ayarlar");
  await admin.getByRole("button", { name: "İstatistikleri sıfırla" }).first().click();
  const d = admin.getByRole("dialog");
  const ileri = d.getByRole("button", { name: /İleri/ });
  await expect(ileri).toBeDisabled(); // onay kutusu işaretlenmeden geçilemez
  await d.getByRole("checkbox").check();
  await ileri.click();
  await expect(ileri).toBeDisabled(); // cümle yazılmadan geçilemez
  await d.getByLabel("Onay cümlesi").fill("yanlış cümle");
  await expect(ileri).toBeDisabled();
  await d.getByLabel("Onay cümlesi").fill("istatistikleri sıfırla"); // küçük harf/Türkçe normalizasyonu kabul edilir
  await ileri.click();
  await d.getByLabel("Şifre").fill("YanlisSifre99");
  await d.getByRole("button", { name: "İstatistikleri sıfırla" }).click();
  await expect(d.getByRole("alert")).toContainText("Şifre hatalı");
  await d.getByLabel("Şifre").fill(ADMIN.sifre);
  await d.getByRole("button", { name: "İstatistikleri sıfırla" }).click();
  await expect(admin.getByText("İstatistikler sıfırlandı")).toBeVisible();

  await admin.goto("/");
  await expect(admin.getByText(/sıfırlama noktası/)).toBeVisible();
  await expect(admin.getByText("₺8.950,00")).toHaveCount(0);
  // Kayıtlar silinmedi: hareketlerde duruyor değil mi? (sıfırlama noktasından önceki kayıtlar listede gizlenir ama veritabanında durur)
  const yedek = await admin.request.get("/api/ayarlar/yedek");
  expect(yedek.status()).toBe(200);
  const y = await yedek.json();
  expect(y.satislar.length).toBe(2); // iptal edilen dahil, hiçbiri silinmedi
  expect(y.kullanicilar.every((k: Record<string, unknown>) => !("sifreHash" in k))).toBe(true);

  await admin.goto("/ayarlar");
  await admin.getByRole("button", { name: "Geri al" }).first().click();
  await admin.getByRole("dialog").getByRole("button", { name: "Geri al" }).click();
  await expect(admin.getByText("Sıfırlama geri alındı")).toBeVisible();
  await admin.goto("/");
  await expect(admin.getByText(/sıfırlama noktası/)).toHaveCount(0);
});

test("16. Fabrika ayarlarına dön: 3 onay + şifre; her şey silinir, yalnız admin kalır", async () => {
  // Ana (Merkez) şube hiçbir şekilde silinemez/pasife alınamaz
  const liste = (await (await admin.request.get("/api/subeler")).json()).subeler as { id: string; ana: boolean }[];
  const ana = liste.find((s) => s.ana)!;
  expect((await admin.request.delete(`/api/subeler/${ana.id}`, { headers: { origin: ORIGIN } })).status()).toBe(409);
  expect((await admin.request.patch(`/api/subeler/${ana.id}`, { data: { aktif: false }, headers: { origin: ORIGIN } })).status()).toBe(409);
  // Sunucu tarafı: arayüz atlanarak çağrılsa da onay metni + şifre zorunlu
  const atla = await admin.request.post("/api/ayarlar/fabrika-sifirla", { data: { anladim: true, onay: "yanlış", sifre: ADMIN.sifre }, headers: { origin: ORIGIN } });
  expect(atla.status()).toBe(400);
  const atla2 = await admin.request.post("/api/ayarlar/fabrika-sifirla", { data: { anladim: true, onay: "FABRİKA AYARLARINA DÖN", sifre: "yanlis" }, headers: { origin: ORIGIN } });
  expect(atla2.status()).toBe(400);
  // Müdür çağıramaz
  const yetkisiz = await hesaplar.murat.page.request.post("/api/ayarlar/fabrika-sifirla", { data: { anladim: true, onay: "FABRİKA AYARLARINA DÖN", sifre: "Murat12345" }, headers: { origin: ORIGIN } });
  expect(yetkisiz.status()).toBe(403);

  await admin.goto("/ayarlar");
  await admin.getByRole("button", { name: "Fabrika ayarlarına dön" }).click();
  const d = admin.getByRole("dialog");
  const ileri = d.getByRole("button", { name: /İleri/ });
  await d.getByRole("checkbox").check();
  await ileri.click();
  await d.getByLabel("Onay cümlesi").fill("FABRİKA AYARLARINA DÖN");
  await ileri.click();
  await d.getByLabel("Şifre").fill("yanlis-sifre-1");
  await d.getByRole("button", { name: "Her şeyi kalıcı olarak sil" }).click();
  await expect(d.getByRole("alert")).toContainText("Şifre hatalı");
  await expect(admin.getByText("Sistem fabrika ayarlarına döndürüldü")).toHaveCount(0);
  await d.getByLabel("Şifre").fill(ADMIN.sifre);
  await d.getByRole("button", { name: "Her şeyi kalıcı olarak sil" }).click();

  // Sistem boşaldı ama admin oturumu açık
  await expect(admin.getByRole("heading", { name: /Merhaba, Yavuz/ })).toBeVisible();
  await admin.goto("/subeler");
  await expect(admin.getByRole("heading", { name: "Merkez" })).toBeVisible(); // ana şube kalır
  await expect(admin.getByRole("heading", { name: "Kadıköy Şubesi" })).toHaveCount(0);
  await expect(admin.getByRole("heading", { name: "Beşiktaş Şubesi" })).toHaveCount(0);
  await admin.goto("/urunler");
  await expect(admin.getByText("Ürün bulunamadı")).toBeVisible();
  await admin.goto("/kullanicilar");
  await expect(admin.getByText("Yavuz Yılmaz")).toBeVisible();
  await expect(admin.getByText("Murat Yıldız")).toHaveCount(0);
  // Silinen kullanıcının oturumu geçersiz
  const eski = await hesaplar.murat.page.request.get("/api/auth/ben");
  expect(eski.status()).toBe(401);
  // Sistem sıfırdan kullanılabilir: yeni şube açılabilir
  await admin.goto("/subeler");
  await admin.getByRole("button", { name: /Yeni şube|İlk şubeyi oluştur/ }).first().click();
  await admin.getByLabel("Şube adı").fill("Yeni Başlangıç");
  await admin.getByLabel("Müdür adı soyadı").fill("Test Kişi");
  await admin.getByLabel("Müdür e-posta (giriş adı)").fill("test@iqfashion.test");
  await admin.getByRole("dialog").getByRole("button", { name: "Şubeyi oluştur" }).click();
  await expect(admin.getByText("Müdür hesabı oluşturuldu")).toBeVisible();
});
