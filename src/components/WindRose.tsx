"use client";

import { COMPASS, fmt } from "@/lib/format";
import type { HistoryPoint } from "@/lib/openmeteo";

const SPEED_BINS = [
  { max: 10, label: "< 10", color: "#bae6fd" },
  { max: 20, label: "10–20", color: "#38bdf8" },
  { max: 35, label: "20–35", color: "#0284c7" },
  { max: Infinity, label: "> 35", color: "#f59e0b" },
];

/** 16-sector wind rose; stacked by speed class. Pure SVG, no extra dependency. */
export function WindRose({ points }: { points: HistoryPoint[] }) {
  const valid = points.filter((p) => p.dir != null && p.value != null);
  const counts = Array.from({ length: 16 }, () => SPEED_BINS.map(() => 0));
  valid.forEach((p) => {
    const s = Math.round(p.dir! / 22.5) % 16;
    const b = SPEED_BINS.findIndex((bin) => p.value! < bin.max);
    counts[s][b]++;
  });
  const totals = counts.map((c) => c.reduce((a, b) => a + b, 0));
  const maxTotal = Math.max(1, ...totals);
  const dominant = totals.indexOf(Math.max(...totals));
  const calm = valid.filter((p) => p.value! < 2).length;
  const avg = valid.reduce((s, p) => s + p.value!, 0) / (valid.length || 1);

  const R = 110;
  const C = 130;
  const wedge = (sector: number, r0: number, r1: number) => {
    const a0 = ((sector * 22.5 - 9) * Math.PI) / 180;
    const a1 = ((sector * 22.5 + 9) * Math.PI) / 180;
    const pt = (a: number, r: number) => `${C + r * Math.sin(a)},${C - r * Math.cos(a)}`;
    return `M${pt(a0, r0)} L${pt(a0, r1)} A${r1},${r1} 0 0 1 ${pt(a1, r1)} L${pt(a1, r0)} A${r0},${r0} 0 0 0 ${pt(a0, r0)} Z`;
  };

  if (!valid.length) return <p className="py-10 text-center text-sm text-slate-400">Keine Winddaten im gewählten Zeitraum.</p>;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 260 260" className="w-full max-w-[260px]" role="img" aria-label="Windrose">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle key={f} cx={C} cy={C} r={R * f} fill="none" stroke="rgba(255,255,255,0.1)" />
        ))}
        {counts.map((bins, s) => {
          let r = 0;
          return bins.map((n, b) => {
            if (!n) return null;
            const r0 = (r / maxTotal) * R;
            r += n;
            const r1 = (r / maxTotal) * R;
            return (
              <path key={`${s}-${b}`} d={wedge(s, r0, r1)} fill={SPEED_BINS[b].color} stroke="#0f172a" strokeWidth={0.5}>
                <title>{`${COMPASS[s]} · ${SPEED_BINS[b].label} km/h: ${n}`}</title>
              </path>
            );
          });
        })}
        {["N", "O", "S", "W"].map((l, i) => {
          const a = (i * 90 * Math.PI) / 180;
          return (
            <text key={l} x={C + (R + 12) * Math.sin(a)} y={C - (R + 12) * Math.cos(a) + 4} textAnchor="middle" fontSize={12} fill="#94a3b8">
              {l}
            </text>
          );
        })}
      </svg>
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-slate-400">Hauptwindrichtung</p>
          <p className="text-lg font-semibold text-white">{COMPASS[dominant]}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Mittlere Geschwindigkeit</p>
          <p className="text-lg font-semibold text-white">{fmt(avg)} km/h</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Windstille (&lt; 2 km/h)</p>
          <p className="text-lg font-semibold text-white">{fmt((calm / valid.length) * 100, 0)} %</p>
        </div>
        <ul className="space-y-1">
          {SPEED_BINS.map((b) => (
            <li key={b.label} className="flex items-center gap-2 text-xs text-slate-300">
              <span className="h-3 w-3 rounded-sm" style={{ background: b.color }} /> {b.label} km/h
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
