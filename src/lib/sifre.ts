import { randomBytes, randomInt, scrypt as _scrypt, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

function scrypt(sifre: string, salt: Buffer): Promise<Buffer> {
  return new Promise((res, rej) =>
    _scrypt(sifre, salt, KEYLEN, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))),
  );
}

export async function sifreHashle(sifre: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(sifre, salt);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function sifreDogrula(sifre: string, kayit: string): Promise<boolean> {
  const [saltHex, hashHex] = kayit.split(":");
  if (!saltHex || !hashHex) return false;
  const beklenen = Buffer.from(hashHex, "hex");
  const hesap = await scrypt(sifre, Buffer.from(saltHex, "hex"));
  return beklenen.length === hesap.length && timingSafeEqual(beklenen, hesap);
}

export { sifreKurali } from "./sifreKurali";

const BUYUK = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const KUCUK = "abcdefghijkmnpqrstuvwxyz";
const RAKAM = "23456789";

/** Okunması kolay (0/O, 1/l/I yok), en az bir büyük, küçük harf ve rakam içeren kriptografik rastgele şifre. */
export function rastgeleSifre(uzunluk = 10): string {
  const hepsi = BUYUK + KUCUK + RAKAM;
  const sec = (k: string) => k[randomInt(k.length)];
  const harfler = [sec(BUYUK), sec(KUCUK), sec(RAKAM)];
  while (harfler.length < uzunluk) harfler.push(sec(hepsi));
  for (let i = harfler.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [harfler[i], harfler[j]] = [harfler[j], harfler[i]];
  }
  return harfler.join("");
}