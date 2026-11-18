"use client";

import { useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Info } from "lucide-react";
import type { WeatherLocation } from "@/lib/locations";
import { fetchHourlySpan, type SpanHour } from "@/lib/openmeteo";
import { SPAN_METRICS, spanMetric, type SpanMetric } from "@/lib/spanMetrics";
import { fmt, fullDate, time } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { locale, useLang } from "@/lib/i18n";
import { bucketLabel, downloadCsv, groupKey, IntervalPicker, RangePicker, useSpan, type Group } from "./RangePicker";
import { Card, chartTheme, ErrorNote, Skeleton, Stat } from "./ui";
import { StationPicker } from "./StationPicker";
import { usePersistedStation } from "@/hooks/usePersistedStation";

/** Default interval: per day (hourly only for spans of a day or less, monthly for very long spans). */
const defaultGroup = (hours: number): Group => (hours <= 24 ? "hour" : hours <= 24 * 400 ? "day" : "month");

type Bucket = {
  key: string;
  sum: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  band: [number, number] | null;
  cum: number;
  hours: number;
  missing: number;
};

function aggregate(rows: SpanHour[], g: Group, m: SpanMetric): Bucket[] {
  const scale = m.scale ?? 1;
  const map = new Map<string, { key: string; vals: number[]; hours: number; missing: number }>();
  for (const r of rows) {
    const key = groupKey(r.t, g, m.agg === "sum");
    const b = map.get(key) ?? { key, vals: [], hours: 0, missing: 0 };
    b.hours++;
    if (r.v == null) b.missing++;
    else b.vals.push(r.v * scale);
    map.set(key, b);
  }
  let cum = 0;
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => {
      const n = b.vals.length;
      const sum = b.vals.reduce((a, v) => a + v, 0);
      const min = n ? Math.min(...b.vals) : null;
      const max = n ? Math.max(...b.vals) : null;
      cum += sum;
      return {
        key: b.key,
        sum: Math.round(sum * 100) / 100,
        min,
        max,
        avg: n ? sum / n : null,
        band: min != null && max != null ? [min, max] : null,
        cum: Math.round(cum * 100) / 100,
        hours: b.hours,
        missing: b.missing,
      };
    });
}

export function SpanAnalysis({ location, initialMetric = "temperature", showMetricPicker = true }: { location: WeatherLocation; initialMetric?: string; showMetricPicker?: boolean }) {
  const { t } = useLang();
  const { station, setStation } = usePersistedStation(location, "wetter-perg:span-station");
  const [metricId, setMetricId] = useState(initialMetric);
  const m = spanMetric(metricId);
  const span = useSpan(defaultGroup);
  const { start, end, valid, spanHours, group } = span;
  const d = m.digits ?? 1;
  const isSum = m.agg === "sum";

  const { data, error, loading } = useAsync(
    () => (valid ? fetchHourlySpan(station, m.variable, start, end, isSum ? "accumulated" : "instant") : Promise.resolve([])),
    `${station.id}:${station.latitude}:${m.variable}:${span.startStr}:${span.endStr}`,
  );

  const buckets = useMemo(() => (data ? aggregate(data, group, m) : []), [data, group, m]);

  const stats = useMemo(() => {
    if (!data?.length) return null;
    const scale = m.scale ?? 1;
    const known = data.filter((h): h is SpanHour & { v: number } => h.v != null).map((h) => ({ ...h, v: h.v * scale }));
    if (!known.length) return null;
    const total = known.reduce((s, h) => s + h.v, 0);
    const maxH = known.reduce((a, h) => (h.v > a.v ? h : a), known[0]);
    const minH = known.reduce((a, h) => (h.v < a.v ? h : a), known[0]);
    const maxB = buckets.reduce<Bucket | null>((a, b) => (b.sum > (a?.sum ?? -Infinity) ? b : a), null);
    return {
      total,
      avg: total / known.length,
      maxH,
      minH,
      maxB,
      counts: (m.thresholds ?? []).map((th) => ({ th, n: known.filter((h) => th.test(h.v)).length })),
      missing: data.length - known.length,
      hours: data.length,
      archive: data.some((h) => h.source === "archive"),
      forecast: data.some((h) => h.source === "forecast"),
    };
  }, [data, buckets, m]);

  const csv = () => {
    const head = isSum
      ? t(`Intervall;Summe_${m.unit};kumuliert_${m.unit};Stunden;fehlende_Stunden`, `interval;total_${m.unit};cumulative_${m.unit};hours;missing_hours`)
      : t(`Intervall;Min_${m.unit};Max_${m.unit};Mittel_${m.unit};Stunden;fehlende_Stunden`, `interval;min_${m.unit};max_${m.unit};mean_${m.unit};hours;missing_hours`);
    const rows = buckets.map((b) =>
      isSum
        ? `${bucketLabel(b.key, group, true)};${fmt(b.sum, d)};${fmt(b.cum, d)};${b.hours};${b.missing}`
        : `${bucketLabel(b.key, group, true)};${fmt(b.min, d)};${fmt(b.max, d)};${fmt(b.avg, d)};${b.hours};${b.missing}`,
    );
    downloadCsv(`${m.id}_${station.id}_${span.startStr.replace(/[:T]/g, "-")}_${span.endStr.replace(/[:T]/g, "-")}.csv`, [head, ...rows]);
  };

  const when = (ts: string) => `${fullDate(ts)} ${time(ts)}`;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">{t("Station", "Station")}</span>
        <StationPicker value={station} onSelect={setStation} />
      </div>
      {showMetricPicker && (
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {SPAN_METRICS.map((x) => {
            const active = x.id === m.id;
            return (
              <button
                key={x.id}
                onClick={() => setMetricId(x.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition ${
                  active ? "bg-white/10 text-white ring-white/30" : "text-slate-400 ring-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                <x.icon className="h-4 w-4" style={{ color: x.color }} />
                {x.label}
              </button>
            );
          })}
        </div>
      )}

      <RangePicker span={span} />
      {error && <div className="mt-4"><ErrorNote message={error} /></div>}

      {valid && !error && (
        <div className={`mt-6 grid gap-6 lg:grid-cols-[18rem_1fr] ${loading ? "opacity-60" : ""} transition-opacity`}>
          {/* KPIs */}
          <div className="space-y-3">
            <div className="rounded-2xl p-5 ring-1 ring-white/15" style={{ background: `linear-gradient(135deg, ${m.color}40, rgba(79,70,229,0.25))` }}>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80">
                <m.icon className="h-4 w-4" /> {m.label} · {isSum ? t("Summe", "Total") : t("Mittelwert", "Mean")}
              </p>
              {data ? (
                <p className="mt-2 text-5xl font-semibold tabular-nums text-white">
                  {fmt(isSum ? (stats?.total ?? 0) : stats?.avg, d)}
                  <span className="ml-1 text-xl font-normal text-white/70">{m.unit}</span>
                </p>
              ) : (
                <Skeleton className="mt-2 h-12 w-40" />
              )}
              <p className="mt-2 text-xs text-white/70">
                {start.toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" })} – {end.toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" })}
                <br />
                {t("Dauer", "Duration")} {spanHours < 48 ? `${fmt(spanHours, 0)} h` : `${fmt(spanHours / 24, 1)} ${t("Tage", "days")}`}
              </p>
            </div>
            {stats && (
              <div className="grid grid-cols-2 gap-3">
                {isSum ? (
                  <>
                    <Stat label={t("Ø pro Tag", "Ø per day")} value={fmt(stats.total / Math.max(1, spanHours / 24), d)} unit={m.unit} />
                    <Stat label={t("Stärkste Stunde", "Peak hour")} value={fmt(stats.maxH.v, d)} unit={m.unit} sub={stats.maxH.v > 0 ? when(stats.maxH.t) : "–"} />
                    <Stat label={t("Höchstes Intervall", "Highest interval")} value={fmt(stats.maxB?.sum, d)} unit={m.unit} sub={stats.maxB && stats.maxB.sum > 0 ? bucketLabel(stats.maxB.key, group, true) : "–"} />
                    <Stat label={t("Intervalle mit Wert > 0", "Intervals with value > 0")} value={String(buckets.filter((b) => b.sum > 0).length)} sub={t(`von ${buckets.length}`, `of ${buckets.length}`)} />
                  </>
                ) : (
                  <>
                    <Stat label="Maximum" value={fmt(stats.maxH.v, d)} unit={m.unit} sub={when(stats.maxH.t)} />
                    <Stat label="Minimum" value={fmt(stats.minH.v, d)} unit={m.unit} sub={when(stats.minH.t)} />
                    <Stat label={t("Mittelwert", "Mean")} value={fmt(stats.avg, d)} unit={m.unit} />
                    <Stat label={t("Spannweite", "Range")} value={fmt(stats.maxH.v - stats.minH.v, d)} unit={m.unit} />
                  </>
                )}
                {stats.counts.map((c) => (
                  <Stat key={c.th.label} label={c.th.label} value={String(c.n)} sub={t(`von ${stats.hours} h`, `of ${stats.hours} h`)} />
                ))}
              </div>
            )}
          </div>

          {/* chart + table */}
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <IntervalPicker span={span} />
              <span className="flex items-center gap-3 text-xs text-slate-400">
                {isSum ? (
                  <>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} /> {t("Summe je Intervall", "Total per interval")}</span>
                    <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-amber-400" /> {t("kumuliert", "cumulative")}</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-rose-400" /> Max</span>
                    <span className="flex items-center gap-1"><span className="h-0.5 w-4" style={{ background: m.color }} /> {t("Mittel", "Mean")}</span>
                    <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-sky-400" /> Min</span>
                  </>
                )}
              </span>
            </div>

            {!data ? <Skeleton className="h-72" /> : (
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={buckets} margin={{ top: 5, right: 0, left: -15, bottom: 0 }}>
                    <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="key" stroke={chartTheme.axis} fontSize={11} tickLine={false} minTickGap={24} tickFormatter={(k: string) => bucketLabel(k, group)} />
                    <YAxis yAxisId="v" stroke={chartTheme.axis} fontSize={11} tickLine={false} domain={isSum ? [0, "auto"] : ["auto", "auto"]} />
                    {isSum && <YAxis yAxisId="cum" orientation="right" stroke="#f59e0b" fontSize={11} tickLine={false} />}
                    <Tooltip
                      {...chartTheme.tooltip}
                      labelFormatter={(k) => bucketLabel(String(k), group, true)}
                      formatter={(v, n) => {
                        const names: Record<string, string> = { sum: t("Summe", "Total"), cum: t("Kumuliert", "Cumulative"), min: "Minimum", max: "Maximum", avg: t("Mittel", "Mean"), band: "Min – Max" };
                        if (Array.isArray(v)) return [`${fmt(Number(v[0]), d)} – ${fmt(Number(v[1]), d)} ${m.unit}`, names.band];
                        return [`${fmt(Number(v), d)} ${m.unit}`, names[String(n)] ?? String(n)];
                      }}
                    />
                    {isSum ? (
                      <>
                        <Bar yAxisId="v" dataKey="sum" fill={m.color} radius={[2, 2, 0, 0]} />
                        <Line yAxisId="cum" dataKey="cum" stroke="#f59e0b" strokeWidth={2} dot={false} type="monotone" />
                      </>
                    ) : (
                      <>
                        <Area yAxisId="v" dataKey="band" stroke="none" fill={m.color} fillOpacity={0.15} isAnimationActive={false} />
                        <Line yAxisId="v" dataKey="max" stroke="#fb7185" strokeWidth={1.5} dot={buckets.length <= 40} connectNulls={false} type="monotone" />
                        <Line yAxisId="v" dataKey="avg" stroke={m.color} strokeWidth={2.5} dot={buckets.length <= 40} connectNulls={false} type="monotone" />
                        <Line yAxisId="v" dataKey="min" stroke="#38bdf8" strokeWidth={1.5} dot={buckets.length <= 40} connectNulls={false} type="monotone" />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {buckets.length > 0 && (
              <details className="mt-4 rounded-xl bg-white/[0.03] ring-1 ring-white/10" open={buckets.length <= 14}>
                <summary className="cursor-pointer px-4 py-2 text-sm text-slate-300">{t(`Tabelle (${buckets.length} Intervalle)`, `Table (${buckets.length} intervals)`)}</summary>
                <div className="max-h-80 overflow-y-auto px-4 pb-3">
                  <table className="w-full text-sm tabular-nums">
                    <thead className="sticky top-0 bg-slate-900 text-left text-xs text-slate-500">
                      <tr>
                        <th className="py-1.5 font-medium">{t("Intervall", "Interval")}</th>
                        {isSum ? (
                          <><th className="text-right font-medium">{t("Summe", "Total")}</th><th className="text-right font-medium">{t("kumuliert", "cumulative")}</th></>
                        ) : (
                          <><th className="text-right font-medium">Min</th><th className="text-right font-medium">Max</th><th className="text-right font-medium">{t("Mittel", "Mean")}</th></>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white">
                      {buckets.map((b) => (
                        <tr key={b.key}>
                          <td className="py-1.5">
                            {bucketLabel(b.key, group, true)}
                            {b.missing > 0 && <span className="ml-2 text-xs text-amber-300">{t(`${b.missing} h ohne Daten`, `${b.missing} h without data`)}</span>}
                          </td>
                          {isSum ? (
                            <><td className="text-right">{fmt(b.sum, d)} {m.unit}</td><td className="text-right text-slate-400">{fmt(b.cum, d)}</td></>
                          ) : (
                            <>
                              <td className="text-right text-sky-300">{fmt(b.min, d)}</td>
                              <td className="text-right text-rose-300">{fmt(b.max, d)}</td>
                              <td className="text-right">{fmt(b.avg, d)} {m.unit}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-xs text-slate-500">
              <p className="flex-1">
                <Info className="mr-1 inline h-3 w-3" />
                {t("Berechnet aus Stundenwerten", "Calculated from hourly values")}
                {isSum
                  ? t(" (Wert einer Stunde = Summe der vorangehenden Stunde)", " (value of an hour = total of the preceding hour)")
                  : t(" (Min/Max = niedrigster/höchster Stundenwert, Mittel = arithmetisches Mittel)", " (min/max = lowest/highest hourly value, mean = arithmetic mean)")}
                .{" "}
                {t("Erstes/letztes Intervall kann angeschnitten sein.", "First/last interval may be partial.")}
                {stats && stats.missing > 0 && <span className="text-amber-300"> {t(`${stats.missing} Stunden ohne Daten (nicht mitgezählt).`, `${stats.missing} hours without data (not counted).`)}</span>}
                {" "}{t("Quelle", "Source")}: Open-Meteo {stats?.archive ? t("Reanalyse-Archiv", "reanalysis archive") : ""}{stats?.archive && stats?.forecast ? " + " : ""}{stats?.forecast ? t("Modellanalyse (letzte Tage)", "model analysis (last days)") : ""} – {t("Modelldaten, keine Stationsmessung.", "model data, not station measurements.")}
              </p>
              <button onClick={csv} disabled={!buckets.length} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-slate-300 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
