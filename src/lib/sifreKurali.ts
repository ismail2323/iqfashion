export function sifreKurali(sifre: string): string | null {
  if (sifre.length < 8) return "Şifre en az 8 karakter olmalı";
  if (sifre.length > 128) return "Şifre çok uzun";
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(sifre) || !/\d/.test(sifre)) return "Şifre en az bir harf ve bir rakam içermeli";
  return null;
}