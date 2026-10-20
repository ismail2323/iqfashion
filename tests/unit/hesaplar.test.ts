import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { anaSubeId, kullaniciGuncelle, kullaniciOlustur, kullaniciSil, subeGuncelle, subeOlustur, subeSil, subeOzeti, subeTamSil } from "@/lib/hesaplar";
import { kur, temizle } from "./yardimci";

let t: Awaited<ReturnType<typeof kur>>;
beforeEach(async () => {
  await temizle();
  t = await kur();
});

describe("ana (Merkez) şube koruması", () => {
  it("en eski şube ana şubedir; silinemez ve pasife alınamaz", async () => {
    expect(await anaSubeId()).toBe(t.a.id);
    await expect(subeSil(t.a.id)).rejects.toThrow(/Ana \(Merkez\) şube silinemez/);
    await expect(subeGuncelle(t.a.id, { aktif: false })).rejects.toThrow(/pasife alınamaz/);
    expect((await prisma.sube.findUniqueOrThrow({ where: { id: t.a.id } })).aktif).toBe(true);
  });
  it("diğer şubeler silinebilir ve pasife alınabilir", async () => {
    await subeGuncelle(t.b.id, { aktif: false });
    expect((await prisma.sube.findUniqueOrThrow({ where: { id: t.b.id } })).aktif).toBe(false);
    await subeSil(t.b.id);
    expect(await prisma.sube.count()).toBe(1);
  });
});

describe("şubeyi geçmişiyle silme", () => {
  it("özet kapsamı gösterir; tam silme şubeyi ve hesaplarını siler, ana şubeyi silmez", async () => {
    const { sube, hesap } = await subeOlustur({ ad: "Geçici Şube", mudur: { ad: "Geçici Müdür", email: "gecici@test.com" } });
    expect((await subeOzeti(sube.id)).kullanici).toBe(1);
    await expect(subeTamSil(t.a.id)).rejects.toThrow(/Ana \(Merkez\) şube silinemez/);
    await subeTamSil(sube.id);
    expect(await prisma.sube.findUnique({ where: { id: sube.id } })).toBeNull();
    expect(await prisma.kullanici.findUnique({ where: { id: hesap!.id } })).toBeNull();
  });
});

describe("hesap yönetimi", () => {
  it("şube + müdür tek adımda; şifre üretilir, ilk girişte değiştirilmesi zorunlu", async () => {
    const { sube, hesap } = await subeOlustur({ ad: "Kadıköy Şubesi", mudur: { ad: "Murat Yıldız", email: "Murat@Test.com" } });
    expect(sube.kod).toBe("KADIKO");
    expect(hesap?.email).toBe("murat@test.com");
    expect(hesap?.sifre).toMatch(/^[A-Za-z0-9]{10}$/);
    const k = await prisma.kullanici.findUniqueOrThrow({ where: { email: "murat@test.com" } });
    expect(k).toMatchObject({ rol: "SUBE_MUDURU", subeId: sube.id, sifreDegistirmeli: true });
  });
  it("müdür e-postası çakışırsa yarım kalan şube bırakılmaz", async () => {
    const onceki = await prisma.sube.count();
    await expect(subeOlustur({ ad: "Yeni", mudur: { ad: "X", email: "mudur@t.com" } })).rejects.toThrow(/zaten bir hesap/);
    expect(await prisma.sube.count()).toBe(onceki);
  });
  it("son süper admin pasife alınamaz, kendini düşüremez; rol/şube kuralları", async () => {
    await expect(kullaniciGuncelle(t.admin.id, t.admin.id, { aktif: false })).rejects.toThrow(/Kendi hesabınızı/);
    await expect(kullaniciOlustur({ ad: "Kasiyer", email: "k@t.com", rol: "KASIYER" })).rejects.toThrow(/şube/);
    await expect(kullaniciOlustur({ ad: "Admin2", email: "a2@t.com", rol: "SUPER_ADMIN", subeId: t.a.id })).rejects.toThrow(/şubeye bağlı olamaz/);
  });
});

describe("kullanıcı silme", () => {
  it("başka kullanıcı kalıcı silinir (oturumları ile birlikte); kendini silemez", async () => {
    await prisma.oturum.create({ data: { kullaniciId: t.mudur.id, tokenHash: "x".repeat(64), expiresAt: new Date(Date.now() + 1e9) } });
    await kullaniciSil(t.mudur.id, t.admin.id);
    expect(await prisma.kullanici.findUnique({ where: { id: t.mudur.id } })).toBeNull();
    expect(await prisma.oturum.count({ where: { kullaniciId: t.mudur.id } })).toBe(0);
    await expect(kullaniciSil(t.admin.id, t.admin.id)).rejects.toThrow(/Kendi hesabınızı silemezsiniz/);
    await expect(kullaniciSil("yok-boyle-biri", t.admin.id)).rejects.toThrow(/bulunamadı/);
  });
  it("sistemdeki son aktif süper admin silinemez; ikinci süper admin varsa silinebilir", async () => {
    const admin2 = await kullaniciOlustur({ ad: "Admin Iki", email: "admin2@t.com", rol: "SUPER_ADMIN" });
    await kullaniciSil(admin2.id, t.admin.id); // iki süper admin vardı: tamam
    // son süper admini başka bir (pasif) yöneticiyle silmeye çalışmak: korunur
    const pasif = await kullaniciOlustur({ ad: "Pasif Admin", email: "pasif@t.com", rol: "SUPER_ADMIN" });
    await prisma.kullanici.update({ where: { id: pasif.id }, data: { aktif: false } });
    await expect(kullaniciSil(t.admin.id, pasif.id)).rejects.toThrow(/en az bir aktif süper admin/);
  });
});