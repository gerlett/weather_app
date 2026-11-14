"use client";

import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, Navigation, Wind } from "lucide-react";
import type { ForecastResponse } from "@/lib/openmeteo";
import { weatherInfo } from "@/lib/weatherCodes";
import { compass, dayMonth, fmt, time, weekday } from "@/lib/format";
import { Card, chartTheme, SectionTitle, Skeleton } from "./ui";

export function ForecastSection({ data }: { data?: ForecastResponse }) {
  if (!data) {
    return (
      <section id="vorhersage" className="scroll-mt-24">
        <SectionTitle eyebrow="Prognose" title="Wettervorhersage" />
        <Skeleton className="h-72" />
      </section>
    );
  }
  const { hourly, daily, current } = data;
  const nowTs = new Date(current.time).getTime() - 3600_000;
  const start = hourly.time.findIndex((t) => new Date(t).getTime() >= nowTs);
  const next48 = hourly.time.slice(start, start + 48).map((t, k) => {
    const i = start + k;
    return {
      t,
      label: time(t),
      temp: hourly.temperature_2m[i],
      feels: hourly.apparent_temperature[i],
      rain: hourly.precipitation[i],
      prob: hourly.precipitation_probability[i],
      code: hourly.weather_code[i],
      day: hourly.is_day[i] === 1,
    };
  });

  const todayStr = current.time.slice(0, 10);
  const days = daily.time.map((t, i) => ({ t, i })).filter(({ t }) => t >= todayStr);
  const tMin = Math.min(...days.map(({ i }) => daily.temperature_2m_min[i] ?? 99));
  const tMax = Math.max(...days.map(({ i }) => daily.temperature_2m_max[i] ?? -99));

  return (
    <section id="vorhersage" className="scroll-mt-24">
      <SectionTitle eyebrow="Prognose" title="Wettervorhersage" />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-white">Nächste 48 Stunden</h3>
            <div className="flex gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-amber-400" /> Temperatur</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 border-t border-dashed border-slate-400" /> Gefühlt</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400/70" /> Niederschlag</span>
            </div>
          </div>
          {/* hourly icon strip */}
          <div className="-mx-1 mb-2 flex overflow-x-auto pb-2">
            {next48.filter((_, k) => k % 3 === 0).map((h) => {
              const w = weatherInfo(h.code, h.day);
              return (
                <div key={h.t} className="flex min-w-14 flex-col items-center gap-1 px-1 text-xs">
                  <span className="text-slate-400">{h.label}</span>
                  <w.Icon className="h-5 w-5 text-sky-200" aria-label={w.label} />
                  <span className="font-medium tabular-nums text-white">{fmt(h.temp, 0)}°</span>
                  <span className="text-[10px] text-sky-300">{h.prob ? `${h.prob}%` : ""}</span>
                </div>
              );
            })}
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <ComposedChart data={next48} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} interval={5} tickLine={false} />
                <YAxis yAxisId="t" stroke={chartTheme.axis} fontSize={11} tickLine={false} unit="°" />
                <YAxis yAxisId="r" orientation="right" stroke={chartTheme.axis} fontSize={11} tickLine={false} hide />
                <Tooltip
                  {...chartTheme.tooltip}
                  labelFormatter={(_, p) => (p?.[0] ? `${weekday(p[0].payload.t)} ${time(p[0].payload.t)}` : "")}
                  formatter={(v, n) => [n === "rain" ? `${fmt(Number(v))} mm` : `${fmt(Number(v))} °C`, n === "rain" ? "Niederschlag" : n === "temp" ? "Temperatur" : "Gefühlt"]}
                />
                <Bar yAxisId="r" dataKey="rain" fill="#38bdf8" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                <Area yAxisId="t" type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={2} fill="url(#tempFill)" />
                <Line yAxisId="t" type="monotone" dataKey="feels" stroke="#94a3b8" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <h3 className="mb-2 px-1 font-medium text-white">7 Tage</h3>
          <ul className="divide-y divide-white/5">
            {days.slice(0, 8).map(({ t, i }) => {
              const w = weatherInfo(daily.weather_code[i]);
              const lo = daily.temperature_2m_min[i] ?? 0;
              const hi = daily.temperature_2m_max[i] ?? 0;
              const span = tMax - tMin || 1;
              return (
                <li key={t} className="grid grid-cols-[4.5rem_1.75rem_1fr] items-center gap-2 px-1 py-2 text-sm sm:grid-cols-[4.5rem_1.75rem_3rem_1fr_4.5rem]">
                  <span className="text-slate-300">
                    {t === todayStr ? "Heute" : weekday(t)} <span className="text-xs text-slate-500">{dayMonth(t)}</span>
                  </span>
                  <w.Icon className="h-5 w-5 text-sky-200" aria-label={w.label} />
                  <span className="hidden items-center gap-0.5 text-xs text-sky-300 sm:flex">
                    <Droplets className="h-3 w-3" />
                    {fmt(daily.precipitation_sum[i])}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-8 text-right tabular-nums text-slate-400">{fmt(lo, 0)}°</span>
                    <span className="relative h-1.5 flex-1 rounded-full bg-white/10">
                      <span
                        className="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-amber-400"
                        style={{ left: `${((lo - tMin) / span) * 100}%`, right: `${100 - ((hi - tMin) / span) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 tabular-nums text-white">{fmt(hi, 0)}°</span>
                  </span>
                  <span className="hidden items-center justify-end gap-1 text-xs text-slate-400 sm:flex" title="Max. Böen">
                    <Wind className="h-3 w-3" />
                    {fmt(daily.wind_gusts_10m_max[i], 0)}
                    <Navigation className="h-3 w-3" style={{ transform: `rotate(${(daily.wind_direction_10m_dominant[i] ?? 0) + 180}deg)` }} />
                    <span className="sr-only">{compass(daily.wind_direction_10m_dominant[i])}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </section>
  );
}
