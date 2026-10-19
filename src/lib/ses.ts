// Barkod okununca kısa bip (kasada sesli geri bildirim). Ses desteklenmiyorsa sessizce geçer.
let ctx: AudioContext | null = null;

export function bip(basarili = true) {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = basarili ? 1100 : 220;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (basarili ? 0.08 : 0.25));
  } catch {
    /* ses yok */
  }
}