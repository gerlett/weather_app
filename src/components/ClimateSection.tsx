"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain, Droplets, Gauge, Snowflake, Sun, Thermometer, Wind } from "lucide-react";
import type { WeatherLocation } from "@/lib/locations";
import { fetchClimate, type ClimateDaily } from "@/lib/openmeteo";
import { fmt, fullDate, months } from "@/lib/format";
import { tr, useLang } from "@/lib/i18n";
import { useAsync } from "@/hooks/useAsync";
import NORMALS from "@/data/normals.json";
import { Card, chartTheme, ErrorNote, Segmented, Skeleton, Stat } from "./ui";
import { CollapsibleSection } from "./CollapsibleSection";
import { StationPicker } from "./StationPicker";
import { usePersistedStation } from "@/hooks/usePersistedStation";

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: thisYear - 1944 + 1 }, (_, i) => thisYear - i);
const YEAR_COLORS = ["#f59e0b", "#38bdf8", "#a78bfa", "#34d399", "#f472b6"];

type Mode = "temp" | "rain" | "wind" | "pressure" | "humidity";

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

type Monthly = { tmean: number | null; rain: number | null; sun: number | null; wind: number | null; pressure: number | null; humidity: number | null };

function monthly(d: ClimateDaily, year: number): Monthly[] {
  return Array.from({ length: 12 }, (_, m) => {
    const prefix = `${year}-${String(m + 1).padStart(2, "0")}`;
    const idx = d.time.map((t, i) => (t.startsWith(prefix) ? i : -1)).filter((i) => i >= 0);
    const mean = (arr: (number | null)[]) => {
      const v = idx.map((i) => arr[i]).filter((x): x is number => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const r = idx.map((i) => d.rain[i]).filter((v): v is number => v != null);
    return {
      tmean: mean(d.tmean),
      rain: r.length ? r.reduce((a, b) => a + b, 0) : null,
      sun: mean(d.sun) === null ? null : mean(d.sun)! / 3600,
      wind: mean(d.gust),
      pressure: mean(d.pressure),
      humidity: mean(d.humidity),
    };
  });
}

const RAIN_STOPS = [0.1, 1, 5, 15, 40];
const WIND_STOPS = [0, 10, 20, 35, 60];
const PRESSURE_STOPS = [980, 995, 1010, 1025, 1040];
const HUMIDITY_STOPS = [0, 25, 50, 75, 100];
const SEQ_COLORS = [[30, 58, 138], [2, 132, 199], [52, 211, 153], [250, 204, 21], [249, 115, 22]];
// Humidity runs the other way: very dry (0 %) is red, saturated (100 %) is dark blue.
const HUMIDITY_COLORS = [[239, 68, 68], [250, 204, 21], [132, 204, 22], [34, 211, 238], [30, 58, 138]];

function sequential(v: number, stops: number[], colors = SEQ_COLORS) {
  let i = 0;
  while (i < stops.length - 2 && v > stops[i + 1]) i++;
  const f = Math.max(0, Math.min(1, (v - stops[i]) / (stops[i + 1] - stops[i])));
  const c0 = colors[i];
  const c1 = colors[i + 1];
  return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * f)).join(",")})`;
}

type ModeMeta = {
  de: string; en: string; titleDe: string; titleEn: string; compareDe: string; compareEn: string;
  icon: typeof Thermometer; unit: string; chart: "line" | "bar";
  daily: (d: ClimateDaily, i: number) => number | null;
  monthly: (v: Monthly) => number | null;
  stops: number[] | null;
  color: (v: number) => string;
};

const MODES: Record<Mode, ModeMeta> = {
  temp: {
    de: "Temperatur", en: "Temperature", titleDe: "Tagesmitteltemperatur", titleEn: "Daily mean temperature",
    compareDe: "Monatsmittel Temperatur", compareEn: "Monthly mean temperature",
    icon: Thermometer, unit: "°C", chart: "line", daily: (d, i) => d.tmean[i], monthly: (v) => v.tmean,
    stops: null, color: tempColor,
  },
  rain: {
    de: "Niederschlag", en: "Precipitation", titleDe: "Tagesniederschlag", titleEn: "Daily precipitation",
    compareDe: "Monatssumme Niederschlag", compareEn: "Monthly precipitation total",
    icon: CloudRain, unit: "mm", chart: "bar", daily: (d, i) => d.rain[i], monthly: (v) => v.rain,
    stops: RAIN_STOPS, color: rainColor,
  },
  wind: {
    de: "Wind", en: "Wind", titleDe: "Tägliche Windböe", titleEn: "Daily wind gust",
    compareDe: "Monatsmittel Windböe", compareEn: "Monthly mean wind gust",
    icon: Wind, unit: "km/h", chart: "line", daily: (d, i) => d.gust[i], monthly: (v) => v.wind,
    stops: WIND_STOPS, color: (v) => sequential(v, WIND_STOPS),
  },
  pressure: {
    de: "Luftdruck", en: "Pressure", titleDe: "Tagesmittel Luftdruck", titleEn: "Daily mean pressure",
    compareDe: "Monatsmittel Luftdruck", compareEn: "Monthly mean pressure",
    icon: Gauge, unit: "hPa", chart: "line", daily: (d, i) => d.pressure[i], monthly: (v) => v.pressure,
    stops: PRESSURE_STOPS, color: (v) => sequential(v, PRESSURE_STOPS),
  },
  humidity: {
    de: "Luftfeuchte", en: "Humidity", titleDe: "Tagesmittel Luftfeuchte", titleEn: "Daily mean humidity",
    compareDe: "Monatsmittel Luftfeuchte", compareEn: "Monthly mean humidity",
    icon: Droplets, unit: "%", chart: "line", daily: (d, i) => d.humidity[i], monthly: (v) => v.humidity,
    stops: HUMIDITY_STOPS, color: (v) => sequential(v, HUMIDITY_STOPS, HUMIDITY_COLORS),
  },
};

type Normals = { tmean: number[]; tmax: number[]; tmin: number[]; rain: number[]; sun: number[]; elevation: number };

/**
 * WMO climate normals 1991–2020, pre-computed by `node scripts/build-normals.ts` and shipped as static JSON.
 * (Fetching 30 years from the browser would exceed the free API's per-minute limit.)
 */
function normalsFor(id: string) {
  const n = (NORMALS as Record<string, Normals>)[id];
  return n ? Array.from({ length: 12 }, (_, m) => ({ tmean: n.tmean[m], rain: n.rain[m] })) : null;
}

export function ClimateSection({ location }: { location: WeatherLocation }) {
  const { t, lang } = useLang();
  const { station, setStation } = usePersistedStation(location, "wetter-perg:climate-station");
  const [year, setYear] = useState(thisYear);
  const [mode, setMode] = useState<Mode>("temp");
  const meta = MODES[mode];
  const startYear = year - 4;

  // one request per year: completed years are immutable and get cached in the browser permanently
  const recent = useAsync(
    () =>
      Promise.all(Array.from({ length: 5 }, (_, i) => fetchClimate(station, startYear + i, startYear + i))).then((parts) => {
        const keys = ["time", "tmean", "tmax", "tmin", "rain", "sun", "gust", "pressure", "humidity"] as const;
        return Object.fromEntries(keys.map((k) => [k, parts.flatMap((p) => p[k] as unknown[])])) as unknown as ClimateDaily;
      }),
    `${station.id}:${station.latitude}-${startYear}-${year}`,
  );
  const norm = useMemo(() => normalsFor(station.id), [station.id]);
  const hasNormal = !!norm && (mode === "temp" || mode === "rain");

  const comparison = useMemo(() => {
    if (!recent.data) return [];
    const years = Array.from({ length: 5 }, (_, i) => year - i);
    const per = years.map((y) => monthly(recent.data!, y));
    return months().map((label, m) => {
      const row: Record<string, number | string | null> = { label };
      years.forEach((y, k) => (row[String(y)] = meta.monthly(per[k][m])));
      row.normal = norm && (mode === "temp" || mode === "rain") ? (mode === "temp" ? norm[m].tmean : norm[m].rain) : null;
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- month labels follow the language
  }, [recent.data, year, norm, lang, meta]);

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
    return Array.from({ length: 12 }, (_, m) =>
      Array.from({ length: 31 }, (_, day) => {
        const date = new Date(year, m, day + 1);
        if (date.getMonth() !== m) return { kind: "none" as const };
        const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`;
        const i = lookup.get(iso);
        const v = i == null ? null : meta.daily(d, i);
        return { kind: "day" as const, iso, v };
      }),
    );
  }, [recent.data, year, meta]);

  return (
    <CollapsibleSection
      id="klima"
      eyebrow={t("Klimaanalyse", "Climate analysis")}
      title={t(`Klimakalender ${year}`, `Climate calendar ${year}`)}
      actions={
        <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
          <div className="flex w-full min-w-0 items-center justify-between gap-1 sm:w-auto sm:justify-start sm:gap-2">
            <StationPicker value={station} onSelect={setStation} />
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t("Jahr", "Year")} className="shrink-0 rounded-lg bg-slate-900 px-2 py-1 text-xs text-white ring-1 ring-white/10 sm:px-3 sm:py-1.5 sm:text-sm">
              {YEARS.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="w-full min-w-0 sm:w-auto">
            <Segmented
              value={mode}
              onChange={setMode}
              size="sm"
              options={(Object.keys(MODES) as Mode[]).map((key) => ({
                value: key,
                label: tr(MODES[key].de, MODES[key].en),
                icon: MODES[key].icon,
              }))}
            />
          </div>
        </div>
      }
    >

      {recent.error && <ErrorNote message={recent.error} />}

      <div className="grid gap-2 sm:gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <h3 className="mb-3 font-medium text-white">
            {tr(meta.titleDe, meta.titleEn)} · {t("jeder Tag des Jahres", "every day of the year")}
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
                    <span className="self-center text-xs text-slate-400">{months()[m]}</span>
                    {row.map((c, d) =>
                      c.kind === "none" ? <span key={d} /> : (
                        <span
                          key={d}
                          title={`${fullDate(c.iso)}: ${c.v == null ? t("keine Daten", "no data") : `${fmt(c.v)} ${meta.unit}`}`}
                          className={`aspect-square rounded-[3px] ${c.v == null ? "bg-white/[0.03] ring-1 ring-inset ring-white/5" : ""}`}
                          style={c.v == null ? undefined : { background: meta.color(c.v) }}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                {meta.stops ? (
                  <>
                    <span>{fmt(meta.stops[0])} {meta.unit}</span>
                    <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${meta.stops.map(meta.color).join(",")})` }} />
                    <span>{fmt(meta.stops[meta.stops.length - 1])}+ {meta.unit}</span>
                  </>
                ) : (
                  <>
                    <span>−15 °C</span>
                    <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${[-15, -5, 0, 8, 15, 22, 30].map(tempColor).join(",")})` }} />
                    <span>30 °C</span>
                  </>
                )}
                <span className="ml-auto">{t("Leere Felder = keine Daten", "Empty cells = no data")}</span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-medium text-white">{t("Jahresbilanz", "Year summary")} {year}{records && year === thisYear ? t(` (bis ${records.last})`, ` (to ${records.last})`) : ""}</h3>
          {!records ? <Skeleton className="h-72" /> : (
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t("Heißester Tag", "Hottest day")} value={fmt(records.hot.v)} unit="°C" sub={records.hot.at} />
              <Stat label={t("Kältester Tag", "Coldest day")} value={fmt(records.cold.v)} unit="°C" sub={records.cold.at} />
              <Stat label={t("Nassester Tag", "Wettest day")} value={fmt(records.wet.v)} unit="mm" sub={records.wet.at} />
              <Stat label={t("Stärkste Böe", "Strongest gust")} value={fmt(records.gust.v, 0)} unit="km/h" sub={records.gust.at} />
              <Stat label={t("Niederschlag gesamt", "Total precipitation")} value={fmt(records.rainSum, 0)} unit="mm" />
              <Stat label={t("Sonnenscheindauer", "Sunshine duration")} value={fmt(records.sunSum, 0)} unit="h" />
              <Stat label={t("Frosttage (Min < 0 °C)", "Frost days (min < 0 °C)")} value={String(records.frost)} sub={<span className="inline-flex items-center gap-1"><Snowflake className="h-3 w-3" /> {t("Tage", "days")}</span>} />
              <Stat label={t("Sommer- / Hitzetage", "Summer / hot days")} value={`${records.summer} / ${records.hotDays}`} sub={<span className="inline-flex items-center gap-1"><Sun className="h-3 w-3" /> ≥ 25 °C / ≥ 30 °C</span>} />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-white">
            {t("Jahresvergleich", "Year comparison")} {year - 4}–{year} · {tr(meta.compareDe, meta.compareEn)}
          </h3>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            {hasNormal ? (
              <>
                <span className="h-0.5 w-5 border-t-2 border-dashed border-white/60" /> {t("Klimamittel 1991–2020", "Climate normal 1991–2020")}
              </>
            ) : (
              t("Klimamittel 1991–2020 nur für Temperatur und Niederschlag verfügbar", "Climate normal 1991–2020 only available for temperature and precipitation")
            )}
          </span>
        </div>
        {!recent.data ? <Skeleton className="h-72" /> : (
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              {meta.chart === "line" ? (
                <LineChart data={comparison} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
                  <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} unit={meta.unit === "°C" ? "°" : ""} />
                  <Tooltip {...chartTheme.tooltip} formatter={(v, n) => [`${fmt(Number(v), meta.unit === "hPa" ? 0 : 1)} ${meta.unit}`, n === "normal" ? t("Mittel 1991–2020", "Normal 1991–2020") : n]} />
                  <Legend formatter={(v: string) => (v === "normal" ? "1991–2020" : v)} />
                  {hasNormal && <Line dataKey="normal" stroke="rgba(255,255,255,0.6)" strokeDasharray="5 5" dot={false} strokeWidth={2} />}
                  {Array.from({ length: 5 }, (_, k) => (
                    <Line key={k} dataKey={String(year - k)} stroke={YEAR_COLORS[k]} strokeWidth={k === 0 ? 3 : 1.5} strokeOpacity={k === 0 ? 1 : 0.7} dot={k === 0} connectNulls={false} />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={comparison} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
                  <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} />
                  <Tooltip {...chartTheme.tooltip} formatter={(v, n) => [`${fmt(Number(v), 0)} mm`, n === "normal" ? t("Mittel 1991–2020", "Normal 1991–2020") : n]} />
                  <Legend formatter={(v: string) => (v === "normal" ? "1991–2020" : v)} />
                  {Array.from({ length: 5 }, (_, k) => k).reverse().map((k) => (
                    <Bar key={k} dataKey={String(year - k)} fill={YEAR_COLORS[k]} fillOpacity={k === 0 ? 1 : 0.55} radius={[2, 2, 0, 0]} />
                  ))}
                  {hasNormal && <Bar dataKey="normal" fill="rgba(255,255,255,0.35)" radius={[2, 2, 0, 0]} />}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <Wind className="h-3 w-3" />{" "}
          {t(
            "Quelle: Open-Meteo Reanalyse-Archiv (ERA5/ERA5-Land, Daten ab 1940, ca. 5 Tage Verzögerung). Rasterdaten für die Koordinate der Station – keine Stationsmesswerte.",
            "Source: Open-Meteo reanalysis archive (ERA5/ERA5-Land, data from 1940, about 5 days delay). Grid data for the station's coordinate – not station readings.",
          )}
        </p>
      </Card>
    </CollapsibleSection>
  );
}
