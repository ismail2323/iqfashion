# IQ Fashion – Claude Code için

Önce `docs/DEVAM-ET.md` dosyasını okuyun (proje nedir, her şey nerede, yerel kurulum, yayın akışı, hesaplar, güvenlik uyarıları, ajan kuralları). Ardından `docs/MIMARI.md`.

Kısa özet:
- Canlı: https://iqfashion.vercel.app · Kod: github.com/ismail2323/iqfashion (`main` → Vercel otomatik yayın) · Veritabanı: Neon (us-east-2).
- Değişiklikten sonra: `npx tsc --noEmit` ve `npm test`; akış/arayüz değiştiyse `npm run build && npm run test:e2e`.
- Gizli değerleri repoya/sohbete yazmayın; canlı veritabanında yıkıcı komutu açık onay olmadan çalıştırmayın.
- Next.js 16 farklıdır: bkz. `AGENTS.md` ve `docs/DEVAM-ET.md` §7.