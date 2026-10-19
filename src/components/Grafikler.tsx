"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { paraFormat } from "@/lib/para";

// Palet: koyu/açık temada okunur, birbirinden ayırt edilebilir (renk körlüğü dostu sıralama)
export const RENKLER = ["#a98249", "#2b5fa8", "#1f7a4d", "#b3261e", "#7a5aa6", "#4b8f9c", "#8a8a8a", "#c26a1b"];

const eksen = { fontSize: 11, fill: "var(--muted)" };
const kisa = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} bin` : String(n));

function IpUcu({ active, payload, label, para = true }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; para?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="tabular text-foreground">{para ? paraFormat(p.value) : p.value}</b>
        </p>
      ))}
    </div>
  );
}

export function TrendGrafik({ veri }: { veri: { gun: string; satis: number; alis: number; gider: number }[] }) {
  const d = veri.map((x) => ({ ...x, etiket: x.gun.slice(8) + "." + x.gun.slice(5, 7) }));
  return (
    <div className="h-72 w-full" role="img" aria-label="Günlük satış, alış ve gider grafiği">
      <ResponsiveContainer>
        <AreaChart data={d} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gSatis" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a98249" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a98249" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="etiket" tick={eksen} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={eksen} tickLine={false} axisLine={false} tickFormatter={kisa} width={64} />
          <Tooltip content={<IpUcu />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="satis" name="Satış" stroke="#a98249" strokeWidth={2.5} fill="url(#gSatis)" />
          <Area type="monotone" dataKey="alis" name="Alış" stroke="#2b5fa8" strokeWidth={2} fill="none" />
          <Area type="monotone" dataKey="gider" name="Gider" stroke="#b3261e" strokeWidth={2} fill="none" strokeDasharray="4 3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PastaGrafik({ veri, birim = "para" }: { veri: { ad: string; deger: number }[]; birim?: "para" | "adet" }) {
  if (!veri.length) return <p className="py-10 text-center text-sm text-muted">Veri yok</p>;
  const toplam = veri.reduce((t, x) => t + x.deger, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0" role="img" aria-label="Dağılım grafiği">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={veri} dataKey="deger" nameKey="ad" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
              {veri.map((_, i) => <Cell key={i} fill={RENKLER[i % RENKLER.length]} />)}
            </Pie>
            <Tooltip content={<IpUcu para={birim === "para"} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {veri.map((x, i) => (
          <li key={x.ad} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: RENKLER[i % RENKLER.length] }} />
            <span className="truncate">{x.ad}</span>
            <span className="tabular ml-auto text-muted">{toplam ? Math.round((x.deger / toplam) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CubukGrafik({ veri, anahtar = "ciro", ad = "Ciro", para = true }: { veri: { ad: string; [k: string]: string | number }[]; anahtar?: string; ad?: string; para?: boolean }) {
  if (!veri.length) return <p className="py-10 text-center text-sm text-muted">Veri yok</p>;
  return (
    <div className="w-full" style={{ height: Math.max(180, veri.length * 38 + 30) }} role="img" aria-label={`${ad} çubuk grafiği`}>
      <ResponsiveContainer>
        <BarChart data={veri} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={eksen} tickLine={false} axisLine={false} tickFormatter={para ? kisa : undefined} />
          <YAxis type="category" dataKey="ad" tick={{ ...eksen, fill: "var(--foreground)" }} tickLine={false} axisLine={false} width={110} />
          <Tooltip content={<IpUcu para={para} />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey={anahtar} name={ad} fill="#a98249" radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
