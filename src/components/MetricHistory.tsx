"use client";

import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { X } from "lucide-react";
import { useState } from "react";
import type { WeatherLocation } from "@/lib/locations";
import type { Metric, RangeKey } from "@/lib/openmeteo";
import { fetchStationHistory } from "@/lib/history";
import { dayMonth, fmt, time, weekday } from "@/lib/format";
import { useAsync } from "@/hooks/useAsync";
import { chartTheme, ErrorNote, Segmented, Skeleton } from "./ui";
import { tr, useLang } from "@/lib/i18n";

export const METRIC_META: Record<Metric, { label: string; unit: string; color: string }> = {
  temperature: { get label() { return tr("Temperatur", "Temperature"); }, unit: "°C", color: "#f59e0b" },
  wind: { get label() { return tr("Wind", "Wind"); }, unit: "km/h", color: "#34d399" },
  precipitation: { get label() { return tr("Niederschlag", "Precipitation"); }, unit: "mm", color: "#38bdf8" },
  pressure: { get label() { return tr("Luftdruck", "Pressure"); }, unit: "hPa", color: "#a78bfa" },
  humidity: { get label() { return tr("Luftfeuchte", "Humidity"); }, unit: "%", color: "#22d3ee" },
};

const RANGES: { value: RangeKey; label: string }[] = [
  { value: "24h", label: "24 h" },
  { value: "7d", get label() { return tr("7 Tage", "7 days"); } },
  { value: "30d", get label() { return tr("30 Tage", "30 days"); } },
];

/** Value history for one of the current-value cards, shown below the main card. */
export function MetricHistory({ location, metric, onClose }: { location: WeatherLocation; metric: Metric; onClose: () => void }) {
  const { t } = useLang();
  const [range, setRange] = useState<RangeKey>("24h");
  const m = METRIC_META[metric];
  const { data, error } = useAsync(() => fetchStationHistory(location, metric, range), JSON.stringify([location.id, metric, range]));

  const hourly = data?.resolution === "hourly";
  const points = (data?.points ?? []).map((p) => ({ ...p, label: hourly ? (range === "24h" ? time(p.t) : `${weekday(p.t)} ${time(p.t)}`) : dayMonth(p.t) }));
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const lo = values.length ? Math.min(...values) : undefined;
  const hi = values.length ? Math.max(...values) : undefined;
  const sum = values.reduce((s, v) => s + v, 0);

  return (
    <div className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:p-5" id="aktuell-verlauf">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-white">
          {t(`Verlauf ${m.label}`, `${m.label} history`)} <span className="text-sm font-normal text-slate-400">· {location.name}</span>
        </h3>
        <div className="flex items-center gap-2">
          <Segmented value={range} options={RANGES} onChange={setRange} size="sm" />
          <button onClick={onClose} aria-label={t("Verlauf schließen", "Close history")} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <ErrorNote message={error} />
      ) : !data ? (
        <Skeleton className="h-56" />
      ) : (
        <>
          <div className="h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`mh-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={m.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={11} tickLine={false} minTickGap={24} />
                <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  {...chartTheme.tooltip}
                  labelFormatter={(_, p) => {
                    const ts = p?.[0]?.payload?.t as string | undefined;
                    return ts ? (hourly ? `${weekday(ts)} ${dayMonth(ts)} ${time(ts)}` : `${weekday(ts)} ${dayMonth(ts)}`) : "";
                  }}
                  formatter={(v, n) => [`${fmt(Number(v))} ${m.unit}`, n === "max" ? (metric === "wind" ? t("Böen", "Gusts") : "Max") : n === "min" ? "Min" : m.label]}
                />
                {metric === "precipitation" ? (
                  <Bar dataKey="value" fill={m.color} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                ) : (
                  <Area type="monotone" dataKey="value" stroke={m.color} strokeWidth={2} fill={`url(#mh-${metric})`} connectNulls={false} />
                )}
                {points.some((p) => p.max != null) && (
                  <Line type="monotone" dataKey="max" stroke={m.color} strokeOpacity={0.6} strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                )}
                {points.some((p) => p.min != null) && (
                  <Line type="monotone" dataKey="min" stroke={m.color} strokeOpacity={0.6} strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {metric === "precipitation"
              ? `${t("Summe", "Total")} ${fmt(sum)} mm`
              : `Min ${fmt(lo)} ${m.unit} · Max ${fmt(hi)} ${m.unit} · ${t("Mittel", "Mean")} ${fmt(values.length ? sum / values.length : undefined)} ${m.unit}`}
            {" · "}{data?.source === "awekas" ? t("Stationsmesswerte AWEKAS", "AWEKAS station readings") : t("Modelldaten Open-Meteo", "Open-Meteo model data")}
          </p>
        </>
      )}
    </div>
  );
}
