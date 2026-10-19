// Tarayıcı tarafı: tek tip API çağrısı. Hata mesajı sunucunun Türkçe mesajıdır.
export class ApiHatasi extends Error {
  constructor(mesaj: string, public durum: number, public veri?: unknown) {
    super(mesaj);
  }
}

export async function api<T = unknown>(url: string, secenek: { method?: string; govde?: unknown } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: secenek.method ?? (secenek.govde !== undefined ? "POST" : "GET"),
      headers: secenek.govde !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: secenek.govde !== undefined ? JSON.stringify(secenek.govde) : undefined,
    });
  } catch {
    throw new ApiHatasi("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.", 0);
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) window.location.href = "/giris";
    if (d?.sifreDegistir) window.location.href = "/sifre-degistir";
    throw new ApiHatasi(d?.hata ?? `İşlem başarısız (${r.status})`, r.status, d);
  }
  return d as T;
}