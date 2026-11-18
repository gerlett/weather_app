"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain, Droplets, Gauge, Thermometer, Wind, X } from "lucide-react";
import type { WeatherLocation } from "@/lib/locations";
import { archiveEnd, ARCHIVE_START, fetchHistory, type HistorySeries, type Metric, type RangeKey } from "@/lib/openmeteo";
import { fetchStationHistory } from "@/lib/history";
import { dayMonth, fmt, fullDate, time } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedStation } from "@/hooks/usePersistedStation";
import { Card, chartTheme, ErrorNote, Segmented, SERIES_COLORS, Skeleton, Stat } from "./ui";
import { CollapsibleSection } from "./CollapsibleSection";
import { tr, useLang } from "@/lib/i18n";
import { WindRose } from "./WindRose";
import { StationPicker } from "./StationPicker";

const METRICS: { value: Metric; label: string; icon: typeof Thermometer; unit: string }[] = [
  { value: "temperature", get label() { return tr("Temperatur", "Temperature"); }, icon: Thermometer, unit: "°C" },
  { value: "precipitation", get label() { return tr("Niederschlag", "Precipitation"); }, icon: CloudRain, unit: "mm" },
  { value: "wind", label: "Wind", icon: Wind, unit: "km/h" },
  { value: "pressure", get label() { return tr("Luftdruck", "Pressure"); }, icon: Gauge, unit: "hPa" },
  { value: "humidity", get label() { return tr("Luftfeuchte", "Humidity"); }, icon: Droplets, unit: "%" },
];

const RANGES: { value: RangeKey; label: string }[] = [
  { value: "24h", label: "24 h" },
  { value: "7d", get label() { return tr("7 Tage", "7 days"); } },
  { value: "30d", get label() { return tr("30 Tage", "30 days"); } },
  { value: "12m", get label() { return tr("12 Monate", "12 months"); } },
  { value: "year", get label() { return tr("Jahr", "Year"); } },
  { value: "custom", get label() { return tr("Zeitraum", "Period"); } },
];

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: thisYear - 1940 + 1 }, (_, i) => thisYear - i);
const COMPARE_KEY = "wetter-perg:history-compare";
const isLocation = (v: unknown): v is WeatherLocation => {
  const l = v as WeatherLocation | null;
  return !!l && typeof l.id === "string" && typeof l.name === "string" && Number.isFinite(l.latitude) && Number.isFinite(l.longitude);
};

export function HistorySection({ location, favorites }: { location: WeatherLocation; favorites: WeatherLocation[] }) {
  const { t } = useLang();
  const [metric, setMetric] = useState<Metric>("temperature");
  const [range, setRange] = useState<RangeKey>("7d");
  const [year, setYear] = useState(thisYear - 1);
  const [start, setStart] = useState(`${thisYear - 1}-01-01`);
  const [end, setEnd] = useState(archiveEnd());
  const [compare, setCompare] = useState<WeatherLocation[]>([]);
  // This section has its own station chip (independent of the top dashboard station).
  const { station, setStation } = usePersistedStation(location, "wetter-perg:history-station");
  const [restoredCompare, setRestoredCompare] = useState(false);

  // Restore this browser's comparison places after mount (no localStorage during prerender).
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "null");
      if (Array.isArray(saved)) setCompare(saved.filter(isLocation).slice(0, 5));
    } catch {
      /* ignore */
    }
    setRestoredCompare(true);
  }, []);

  useEffect(() => {
    if (!restoredCompare) return;
    try { localStorage.setItem(COMPARE_KEY, JSON.stringify(compare)); } catch { /* ignore */ }
  }, [compare, restoredCompare]);

  const locs = useMemo(() => [station, ...compare.filter((c) => c.id !== station.id)].slice(0, 6), [station, compare]);
  const opts = { year, start, end };
  const key = JSON.stringify([locs.map((l) => l.id), metric, range, range === "year" ? year : 0, range === "custom" ? [start, end] : 0]);

  const { data, error, loading } = useAsync(() => Promise.all(locs.map((l) => fetchStationHistory(l, metric, range, opts))), key);
  // Wind rose keeps Open-Meteo: AWEKAS history has no wind direction.
  const windKey = JSON.stringify([station.id, range, range === "year" ? year : 0, range === "custom" ? [start, end] : 0]);
  const wind = useAsync(() => fetchHistory(station, "wind", range, opts), windKey);

  const m = METRICS.find((x) => x.value === metric)!;
  const comparing = locs.length > 1;
  return (
    <CollapsibleSection
      id="verlauf"
      eyebrow={t("Wetterhistorie", "Weather history")}
      title={t("Verlauf & Statistik", "History & statistics")}
      actions={
        <div className="flex min-w-0 flex-nowrap items-center gap-1 sm:gap-2">
          <StationPicker value={station} onSelect={setStation} />
          <div className="min-w-0 flex-1">
            <Segmented value={range} options={RANGES} onChange={setRange} size="sm" />
          </div>
        </div>
      }
    >

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented value={metric} options={METRICS} onChange={setMetric} size="sm" />
          {range === "year" && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white ring-1 ring-white/10"
              aria-label={t("Jahr", "Year")}
            >
              {YEARS.map((y) => <option key={y}>{y}</option>)}
            </select>
          )}
          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <input type="date" min={ARCHIVE_START} max={end} value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg bg-slate-900 px-2 py-1 text-white ring-1 ring-white/10 [color-scheme:dark]" />
              {t("bis", "to")}
              <input type="date" min={start} max={archiveEnd()} value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg bg-slate-900 px-2 py-1 text-white ring-1 ring-white/10 [color-scheme:dark]" />
            </div>
          )}
        </div>

        {/* comparison chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm sm:gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">{t("Vergleich", "Compare")}</span>
          {locs.map((l, i) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-2.5 pr-1.5 ring-1 ring-white/10">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
              <span className="text-white">{l.name}</span>
              {i > 0 && (
                <button onClick={() => setCompare((c) => c.filter((x) => x.id !== l.id))} aria-label={t(`${l.name} entfernen`, `Remove ${l.name}`)} className="text-slate-400 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
          {locs.length < 6 && (
            <StationPicker
              mode="add"
              label={t("Ort hinzufügen", "Add place")}
              exclude={locs.map((l) => l.id)}
              suggestions={favorites}
              onSelect={(l) => setCompare((c) => [...c.filter((x) => x.id !== l.id), l])}
            />
          )}
        </div>

        <div className="mt-4">
          {error ? <ErrorNote message={error} /> : !data || data.length !== locs.length ? <Skeleton className="h-80" /> : (
            <HistoryChart series={data} locs={locs} metric={metric} unit={m.unit} comparing={comparing} loading={loading} />
          )}
        </div>
      </Card>

      <div className="mt-3 grid gap-2 sm:gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <h3 className="mb-3 font-medium text-white">Windrose · {station.name}</h3>
          {wind.data ? <WindRose points={wind.data.points} /> : wind.error ? <ErrorNote message={wind.error} /> : <Skeleton className="h-64" />}
        </Card>
        <Card>
          <h3 className="mb-3 font-medium text-white">{t("Kennzahlen", "Key figures")} · {RANGES.find((r) => r.value === range)?.label}{range === "year" ? ` ${year}` : ""}</h3>
          {data && data.length === locs.length ? <StatsTable series={data} locs={locs} metric={metric} unit={m.unit} /> : <Skeleton className="h-48" />}
        </Card>
      </div>
    </CollapsibleSection>
  );
}

function sourceLabel(series: HistorySeries[]) {
  const sources = [...new Set(series.map((s) => s.source))];
  const awekas = tr("AWEKAS Stationsmesswerte", "AWEKAS station readings");
  const om = tr("Open-Meteo Modelldaten", "Open-Meteo model data");
  if (sources.length === 1 && sources[0] === "awekas") return awekas;
  if (sources.includes("awekas")) return `${awekas} + ${om}`;
  if (sources[0] === "archive") return `Open-Meteo ${tr("Reanalyse-Archiv (ERA5, ab 1940)", "reanalysis archive (ERA5, from 1940)")}`;
  return om;
}

/**
 * AWEKAS serves daily values for 7/30 days while Open-Meteo serves hourly ones.
 * Put every series on the same resolution so all lines share the same x positions
 * (otherwise the main station's line is drawn on sparse, misaligned points).
 */
function alignSeries(series: HistorySeries[], metric: Metric) {
  const daily = series.some((s) => s.resolution === "daily");
  if (!daily) {
    // AWEKAS uses "…T14:00:00", Open-Meteo "…T14:00". Without the same key,
    // every row holds only one series value and connectNulls=false erases the lines.
    return {
      series: series.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p, t: p.t.slice(0, 16) })) })),
      hourly: true,
    };
  }
  const aligned = series.map((s) => {
    if (s.resolution === "daily") {
      return { ...s, points: s.points.map((p) => ({ ...p, t: `${p.t.slice(0, 10)}T00:00:00` })) };
    }
    const groups = new Map<string, { sum: number; n: number; max: number | null; min: number | null }>();
    s.points.forEach((p) => {
      if (p.value == null) return;
      const t = `${p.t.slice(0, 10)}T00:00:00`;
      const g = groups.get(t) ?? { sum: 0, n: 0, max: null, min: null };
      g.sum += p.value;
      g.n += 1;
      if (p.max != null) g.max = Math.max(g.max ?? -Infinity, p.max);
      if (p.min != null) g.min = Math.min(g.min ?? Infinity, p.min);
      groups.set(t, g);
    });
    return {
      ...s,
      resolution: "daily" as const,
      points: [...groups.entries()].map(([t, g]) => ({
        t,
        value: metric === "precipitation" ? g.sum : g.sum / g.n,
        ...(g.max != null ? { max: g.max } : {}),
        ...(g.min != null ? { min: g.min } : {}),
      })),
    };
  });
  return { series: aligned, hourly: false };
}

function HistoryChart({
  series,
  locs,
  metric,
  unit,
  comparing,
  loading,
}: {
  series: HistorySeries[];
  locs: WeatherLocation[];
  metric: Metric;
  unit: string;
  comparing: boolean;
  loading: boolean;
}) {
  const { series: aligned, hourly } = useMemo(() => alignSeries(series, metric), [series, metric]);
  const rows = useMemo(() => {
    const map = new Map<string, Record<string, number | string | null | [number, number] | undefined>>();
    aligned.forEach((s, si) =>
      s.points.forEach((p) => {
        const r = map.get(p.t) ?? { t: p.t };
        r[`v${si}`] = p.value;
        if (si === 0 && p.min != null && p.max != null) r.band = [p.min, p.max];
        if (si === 0 && metric === "wind") r.gust = p.max ?? null;
        map.set(p.t, r);
      }),
    );
    return [...map.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }, [aligned, metric]);

  const gaps = aligned[0]?.points.filter((p) => p.value == null).length ?? 0;
  const isBar = metric === "precipitation";
  const label = (t: string) => (hourly ? `${dayMonth(t)} ${time(t)}` : fullDate(t));

  return (
    <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="h-80">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis
              dataKey="t"
              stroke={chartTheme.axis}
              fontSize={11}
              tickLine={false}
              minTickGap={40}
              tickFormatter={(t: string) => (hourly && rows.length <= 25 ? time(t) : dayMonth(t))}
            />
            <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} domain={["auto", "auto"]} unit={metric === "temperature" ? "°" : ""} />
            <Tooltip
              {...chartTheme.tooltip}
              labelFormatter={(t) => label(String(t))}
              formatter={(v, n) => {
                const name = String(n);
                if (Array.isArray(v)) return [`${fmt(v[0])} – ${fmt(v[1])} ${unit}`, tr("Min – Max", "Min – max")];
                if (name === "gust") return [`${fmt(Number(v))} ${unit}`, tr("Böen", "Gusts")];
                const i = Number(name.slice(1));
                return [`${fmt(Number(v))} ${unit}`, locs[i]?.name ?? name];
              }}
            />
            {comparing && <Legend formatter={(v: string) => (v.startsWith("v") ? locs[Number(v.slice(1))]?.name : v === "gust" ? tr("Böen", "Gusts") : "Min–Max")} />}
            {!comparing && rows.some((r) => r.band) && (
              <Area dataKey="band" stroke="none" fill={SERIES_COLORS[0]} fillOpacity={0.15} connectNulls={false} isAnimationActive={false} />
            )}
            {!comparing && metric === "wind" && <Line dataKey="gust" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="3 3" connectNulls={false} />}
            {locs.map((_, i) =>
              isBar ? (
                <Bar key={i} dataKey={`v${i}`} fill={SERIES_COLORS[i]} radius={[2, 2, 0, 0]} />
              ) : (
                <Line key={i} dataKey={`v${i}`} stroke={SERIES_COLORS[i]} strokeWidth={i === 0 ? 3 : 2} dot={false} connectNulls={false} type="monotone" />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {hourly ? tr("Stundenwerte", "Hourly values") : tr("Tageswerte", "Daily values")} · {tr("Quelle", "Source")}: {sourceLabel(series)}
        {gaps > 0 && <span className="text-amber-300"> · {tr(`${gaps} fehlende Werte als Lücke dargestellt (nicht interpoliert)`, `${gaps} missing values shown as gaps (not interpolated)`)}</span>}
      </p>
    </div>
  );
}

function StatsTable({ series, locs, metric, unit }: { series: HistorySeries[]; locs: WeatherLocation[]; metric: Metric; unit: string }) {
  const stats = series.map((s) => {
    const vals = s.points.filter((p) => p.value != null);
    const maxP = vals.reduce((a, p) => ((p.max ?? p.value!) > (a?.max ?? a?.value ?? -Infinity) ? p : a), vals[0]);
    const minP = vals.reduce((a, p) => ((p.min ?? p.value!) < (a?.min ?? a?.value ?? Infinity) ? p : a), vals[0]);
    const sum = vals.reduce((a, p) => a + p.value!, 0);
    return {
      max: maxP ? (maxP.max ?? maxP.value) : null,
      maxAt: maxP?.t,
      min: minP ? (minP.min ?? minP.value) : null,
      minAt: minP?.t,
      avg: vals.length ? sum / vals.length : null,
      sum,
      wetDays: s.resolution === "daily" ? vals.filter((p) => p.value! >= 1).length : vals.filter((p) => p.value! > 0).length,
      resolution: s.resolution,
    };
  });
  const when = (t?: string, r?: string) => (t ? (r === "hourly" ? `${dayMonth(t)} ${time(t)}` : fullDate(t)) : "");

  if (locs.length === 1) {
    const s = stats[0];
    if (!s) return null;
    return (
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {metric === "precipitation" ? (
          <>
            <Stat compact label={tr("Summe", "Total")} value={fmt(s.sum)} unit={unit} />
            <Stat compact label={tr("Max. Einzelwert", "Max. single value")} value={fmt(s.max)} unit={unit} sub={when(s.maxAt, s.resolution)} />
            <Stat compact label={s.resolution === "daily" ? tr("Regentage (≥ 1 mm)", "Rain days (≥ 1 mm)") : tr("Stunden mit Regen", "Hours with rain")} value={String(s.wetDays)} />
          </>
        ) : (
          <>
            <Stat compact label="Maximum" value={fmt(s.max)} unit={unit} sub={when(s.maxAt, s.resolution)} />
            <Stat compact label="Minimum" value={fmt(s.min)} unit={unit} sub={when(s.minAt, s.resolution)} />
            <Stat compact label={tr("Mittelwert", "Mean")} value={fmt(s.avg)} unit={unit} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-2 font-medium">{tr("Ort", "Place")}</th>
            {metric === "precipitation" ? <><th className="font-medium">{tr("Summe", "Total")}</th><th className="font-medium">Max</th></> : <><th className="font-medium">Max</th><th className="font-medium">Min</th><th className="font-medium">{tr("Mittel", "Mean")}</th></>}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 tabular-nums text-white">
          {stats.map((s, i) => {
            const loc = locs[i];
            if (!loc) return null; // stale data from a previous station set
            return (
              <tr key={loc.id}>
                <td className="py-2">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                  {loc.name}
                </td>
                {metric === "precipitation" ? (
                  <><td>{fmt(s.sum)} {unit}</td><td>{fmt(s.max)} {unit}</td></>
                ) : (
                  <><td>{fmt(s.max)} {unit}</td><td>{fmt(s.min)} {unit}</td><td>{fmt(s.avg)} {unit}</td></>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
