"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain, Snowflake, Sun, Thermometer, Wind } from "lucide-react";
import type { WeatherLocation } from "@/lib/locations";
import { fetchClimate, type ClimateDaily } from "@/lib/openmeteo";
import { fmt, fullDate, MONTHS } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import NORMALS from "@/data/normals.json";
import { Card, chartTheme, ErrorNote, SectionTitle, Segmented, Skeleton, Stat } from "./ui";

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: thisYear - 1944 + 1 }, (_, i) => thisYear - i);
const YEAR_COLORS = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#f472b6"];

type Mode = "temp" | "rain";

/** Diverging temperature scale (cold blue → neutral → hot red) */
function tempColor(t: number) {
  const stops: [number, [number, number, number]][] = [
    [-15, [30, 64, 175]],
    [-5, [59, 130, 246]],
    [0, [147, 197, 253]],
    [8, [226, 232, 240]],
    [15, [253, 224, 71]],
    [22, [249, 115, 22]],
    [30, [185, 28, 28]],
  ];
  if (t <= stops[0][0]) return `rgb(${stops[0][1]})`;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (t - t0) / (t1 - t0);
      return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * f)).join(",")})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1]})`;
}

function rainColor(mm: number) {
  if (mm < 0.1) return "rgba(255,255,255,0.05)";
  const f = Math.min(1, Math.log1p(mm) / Math.log1p(40));
  return `rgba(56,189,248,${0.2 + f * 0.8})`;
}

type Monthly = { tmean: number | null; rain: number | null; sun: number | null };

function monthly(d: ClimateDaily, year: number): Monthly[] {
  return MONTHS.map((_, m) => {
    const prefix = `${year}-${String(m + 1).padStart(2, "0")}`;
    const idx = d.time.map((t, i) => (t.startsWith(prefix) ? i : -1)).filter((i) => i >= 0);
    const t = idx.map((i) => d.tmean[i]).filter((v): v is number => v != null);
    const r = idx.map((i) => d.rain[i]).filter((v): v is number => v != null);
    const s = idx.map((i) => d.sun[i]).filter((v): v is number => v != null);
    return {
      tmean: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null,
      rain: r.length ? r.reduce((a, b) => a + b, 0) : null,
      sun: s.length ? s.reduce((a, b) => a + b, 0) / 3600 : null,
    };
  });
}

type Normals = { tmean: number[]; tmax: number[]; tmin: number[]; rain: number[]; sun: number[]; elevation: number };

/**
 * WMO climate normals 1991–2020, pre-computed by `node scripts/build-normals.ts` and shipped as static JSON.
 * (Fetching 30 years from the browser would exceed the free API's per-minute limit.)
 */
function normalsFor(id: string) {
  const n = (NORMALS as Record<string, Normals>)[id];
  return n ? MONTHS.map((_, m) => ({ tmean: n.tmean[m], rain: n.rain[m] })) : null;
}

export function ClimateSection({ location }: { location: WeatherLocation }) {
  const [year, setYear] = useState(thisYear);
  const [mode, setMode] = useState<Mode>("temp");
  const startYear = year - 4;

  // one request per year: completed years are immutable and get cached in the browser permanently
  const recent = useAsync(
    () =>
      Promise.all(Array.from({ length: 5 }, (_, i) => fetchClimate(location, startYear + i, startYear + i))).then((parts) => {
        const keys = ["time", "tmean", "tmax", "tmin", "rain", "sun", "gust"] as const;
        return Object.fromEntries(keys.map((k) => [k, parts.flatMap((p) => p[k] as unknown[])])) as unknown as ClimateDaily;
      }),
    `${location.id}:${location.latitude}-${startYear}-${year}`,
  );
  const norm = useMemo(() => normalsFor(location.id), [location.id]);

  const comparison = useMemo(() => {
    if (!recent.data) return [];
    const years = Array.from({ length: 5 }, (_, i) => year - i);
    const per = years.map((y) => monthly(recent.data!, y));
    return MONTHS.map((label, m) => {
      const row: Record<string, number | string | null> = { label };
      years.forEach((y, k) => (row[String(y)] = mode === "temp" ? per[k][m].tmean : per[k][m].rain));
      row.normal = norm ? (mode === "temp" ? norm[m].tmean : norm[m].rain) : null;
      return row;
    });
  }, [recent.data, year, mode, norm]);

  const records = useMemo(() => {
    if (!recent.data) return null;
    const d = recent.data;
    const idx = d.time.map((t, i) => (t.startsWith(String(year)) ? i : -1)).filter((i) => i >= 0);
    const pick = (arr: (number | null)[], cmp: (a: number, b: number) => boolean) =>
      idx.reduce<number | null>((best, i) => (arr[i] != null && (best == null || cmp(arr[i]!, arr[best]!)) ? i : best), null);
    const hot = pick(d.tmax, (a, b) => a > b);
    const cold = pick(d.tmin, (a, b) => a < b);
    const wet = pick(d.rain, (a, b) => a > b);
    const gust = pick(d.gust, (a, b) => a > b);
    const rainSum = idx.reduce((s, i) => s + (d.rain[i] ?? 0), 0);
    const sunSum = idx.reduce((s, i) => s + (d.sun[i] ?? 0), 0) / 3600;
    const frost = idx.filter((i) => (d.tmin[i] ?? 1) < 0).length;
    const summer = idx.filter((i) => (d.tmax[i] ?? 0) >= 25).length;
    const hotDays = idx.filter((i) => (d.tmax[i] ?? 0) >= 30).length;
    const at = (i: number | null) => (i == null ? "" : fullDate(d.time[i]));
    return {
      hot: { v: hot == null ? null : d.tmax[hot], at: at(hot) },
      cold: { v: cold == null ? null : d.tmin[cold], at: at(cold) },
      wet: { v: wet == null ? null : d.rain[wet], at: at(wet) },
      gust: { v: gust == null ? null : d.gust[gust], at: at(gust) },
      rainSum,
      sunSum,
      frost,
      summer,
      hotDays,
      days: idx.length,
      last: idx.length ? fullDate(d.time[idx[idx.length - 1]]) : "",
    };
  }, [recent.data, year]);

  const calendar = useMemo(() => {
    if (!recent.data) return null;
    const d = recent.data;
    const lookup = new Map(d.time.map((t, i) => [t, i]));
    return MONTHS.map((_, m) =>
      Array.from({ length: 31 }, (_, day) => {
        const date = new Date(year, m, day + 1);
        if (date.getMonth() !== m) return { kind: "none" as const };
        const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`;
        const i = lookup.get(iso);
        const v = i == null ? null : mode === "temp" ? d.tmean[i] : d.rain[i];
        return { kind: "day" as const, iso, v };
      }),
    );
  }, [recent.data, year, mode]);

  return (
    <section id="klima" className="scroll-mt-24">
      <SectionTitle eyebrow="Klimaanalyse" title={`Klimakalender ${year}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={mode}
            onChange={setMode}
            size="sm"
            options={[
              { value: "temp", label: "Temperatur", icon: Thermometer },
              { value: "rain", label: "Niederschlag", icon: CloudRain },
            ]}
          />
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Jahr" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white ring-1 ring-white/10">
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
      </SectionTitle>

      {recent.error && <ErrorNote message={recent.error} />}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <h3 className="mb-3 font-medium text-white">
            {mode === "temp" ? "Tagesmitteltemperatur" : "Tagesniederschlag"} · jeder Tag des Jahres
          </h3>
          {!calendar ? <Skeleton className="h-72" /> : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[560px] grid-cols-[2.5rem_repeat(31,minmax(0,1fr))] gap-[3px] text-[10px] text-slate-500">
                <span />
                {Array.from({ length: 31 }, (_, i) => (
                  <span key={i} className="text-center">{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}</span>
                ))}
                {calendar.map((row, m) => (
                  <div key={m} className="contents">
                    <span className="self-center text-xs text-slate-400">{MONTHS[m]}</span>
                    {row.map((c, d) =>
                      c.kind === "none" ? <span key={d} /> : (
                        <span
                          key={d}
                          title={`${fullDate(c.iso)}: ${c.v == null ? "keine Daten" : `${fmt(c.v)} ${mode === "temp" ? "°C" : "mm"}`}`}
                          className={`aspect-square rounded-[3px] ${c.v == null ? "bg-white/[0.03] ring-1 ring-inset ring-white/5" : ""}`}
                          style={c.v == null ? undefined : { background: mode === "temp" ? tempColor(c.v) : rainColor(c.v) }}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                {mode === "temp" ? (
                  <>
                    <span>−15 °C</span>
                    <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${[-15, -5, 0, 8, 15, 22, 30].map(tempColor).join(",")})` }} />
                    <span>30 °C</span>
                  </>
                ) : (
                  <>
                    <span>0 mm</span>
                    <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${[0.1, 1, 5, 15, 40].map(rainColor).join(",")})` }} />
                    <span>40+ mm</span>
                  </>
                )}
                <span className="ml-auto">Leere Felder = keine Daten</span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-medium text-white">Jahresbilanz {year}{records && year === thisYear ? ` (bis ${records.last})` : ""}</h3>
          {!records ? <Skeleton className="h-72" /> : (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Heißester Tag" value={fmt(records.hot.v)} unit="°C" sub={records.hot.at} />
              <Stat label="Kältester Tag" value={fmt(records.cold.v)} unit="°C" sub={records.cold.at} />
              <Stat label="Nassester Tag" value={fmt(records.wet.v)} unit="mm" sub={records.wet.at} />
              <Stat label="Stärkste Böe" value={fmt(records.gust.v, 0)} unit="km/h" sub={records.gust.at} />
              <Stat label="Niederschlag gesamt" value={fmt(records.rainSum, 0)} unit="mm" />
              <Stat label="Sonnenscheindauer" value={fmt(records.sunSum, 0)} unit="h" />
              <Stat label="Frosttage (Min < 0 °C)" value={String(records.frost)} sub={<span className="inline-flex items-center gap-1"><Snowflake className="h-3 w-3" /> Tage</span>} />
              <Stat label="Sommer- / Hitzetage" value={`${records.summer} / ${records.hotDays}`} sub={<span className="inline-flex items-center gap-1"><Sun className="h-3 w-3" /> ≥ 25 °C / ≥ 30 °C</span>} />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-white">
            Jahresvergleich {year - 4}–{year} · {mode === "temp" ? "Monatsmittel Temperatur" : "Monatssumme Niederschlag"}
          </h3>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            {norm ? (
              <>
                <span className="h-0.5 w-5 border-t-2 border-dashed border-white/60" /> Klimamittel 1991–2020
              </>
            ) : (
              "Klimamittel 1991–2020 nur für Stationen des Messnetzes verfügbar"
            )}
          </span>
        </div>
        {!recent.data ? <Skeleton className="h-72" /> : (
          <div className="h-72">
            <ResponsiveContainer>
              {mode === "temp" ? (
                <LineChart data={comparison} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
                  <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} unit="°" />
                  <Tooltip {...chartTheme.tooltip} formatter={(v, n) => [`${fmt(Number(v))} °C`, n === "normal" ? "Mittel 1991–2020" : n]} />
                  <Legend formatter={(v: string) => (v === "normal" ? "1991–2020" : v)} />
                  <Line dataKey="normal" stroke="rgba(255,255,255,0.6)" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                  {Array.from({ length: 5 }, (_, k) => (
                    <Line key={k} dataKey={String(year - k)} stroke={YEAR_COLORS[k]} strokeWidth={k === 0 ? 3 : 1.5} strokeOpacity={k === 0 ? 1 : 0.7} dot={k === 0} connectNulls={false} />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={comparison} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
                  <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} />
                  <Tooltip {...chartTheme.tooltip} formatter={(v, n) => [`${fmt(Number(v), 0)} mm`, n === "normal" ? "Mittel 1991–2020" : n]} />
                  <Legend formatter={(v: string) => (v === "normal" ? "1991–2020" : v)} />
                  {Array.from({ length: 5 }, (_, k) => k).reverse().map((k) => (
                    <Bar key={k} dataKey={String(year - k)} fill={YEAR_COLORS[k]} fillOpacity={k === 0 ? 1 : 0.55} radius={[2, 2, 0, 0]} />
                  ))}
                  <Bar dataKey="normal" fill="rgba(255,255,255,0.35)" radius={[2, 2, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <Wind className="h-3 w-3" /> Quelle: Open-Meteo Reanalyse-Archiv (ERA5/ERA5-Land, Daten ab 1940, ca. 5 Tage Verzögerung). Rasterdaten für die Koordinate der Station – keine Stationsmesswerte.
        </p>
      </Card>
    </section>
  );
}
