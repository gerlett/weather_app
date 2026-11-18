"use client";

import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Cloud, Droplets, Navigation, Wind } from "lucide-react";
import type { WeatherLocation } from "@/lib/locations";
import { FORECAST_MODELS, modelLabel, type ForecastModel } from "@/lib/forecastModels";
import { useLiveWeather } from "@/hooks/useLiveWeather";
import { usePersistedStation } from "@/hooks/usePersistedStation";
import { weatherInfo } from "@/lib/weatherCodes";
import { compass, dayMonth, fmt, time, weekday } from "@/lib/format";
import { Card, chartTheme, Skeleton } from "./ui";
import { CollapsibleSection } from "./CollapsibleSection";
import { StationPicker } from "./StationPicker";
import { tr, useLang } from "@/lib/i18n";

export function ForecastSection({ location, model, onModelChange }: { location: WeatherLocation; model: ForecastModel; onModelChange: (m: ForecastModel) => void }) {
  const { t } = useLang();
  const { station, setStation } = usePersistedStation(location, "wetter-perg:forecast-station");
  const data = useLiveWeather(station, model).data;
  const eyebrow = t("Prognose", "Forecast");
  const title = t("Wettervorhersage", "Weather forecast");
  const sourceChip = (
    <label className="inline-flex min-w-0 items-center gap-1 rounded-full bg-sky-500/10 py-1 pl-2 pr-1.5 text-sky-200 ring-1 ring-sky-400/30 sm:gap-1.5 sm:pl-2.5 sm:pr-2">
      <Cloud className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden />
      <select
        value={model}
        onChange={(e) => onModelChange(e.target.value as ForecastModel)}
        className="max-w-[5.5rem] bg-transparent text-xs focus:outline-none sm:max-w-[11rem] sm:text-sm"
        aria-label={t("Prognosemodell wählen", "Select forecast model")}
      >
        {FORECAST_MODELS.map((m) => (
          <option key={m.value} value={m.value} className="bg-slate-900">{tr(m.de, m.en)}</option>
        ))}
      </select>
    </label>
  );
  const actions = (
    <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
      <div className="flex w-full justify-start sm:w-auto"><StationPicker value={station} onSelect={setStation} /></div>
      <div className="flex w-full justify-end sm:w-auto">{sourceChip}</div>
    </div>
  );
  if (!data) {
    return (
      <CollapsibleSection id="vorhersage" eyebrow={eyebrow} title={title} defaultOpen actions={actions}>
        <Skeleton className="h-72" />
      </CollapsibleSection>
    );
  }
  const { hourly, daily, current } = data;
  const nowTs = new Date(current.time).getTime() - 3600_000;
  const start = hourly.time.findIndex((t) => new Date(t).getTime() >= nowTs);
  const next24 = hourly.time.slice(start, start + 24).map((t, k) => {
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
    <CollapsibleSection id="vorhersage" eyebrow={eyebrow} title={title} defaultOpen actions={actions}>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-white">{t("Nächste 24 Stunden", "Next 24 hours")}</h3>
            <div className="flex gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-amber-400" /> {t("Temperatur", "Temperature")}</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 border-t border-dashed border-slate-400" /> {t("Gefühlt", "Feels like")}</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400/70" /> {t("Niederschlag", "Precipitation")}</span>
            </div>
          </div>
          {/* hourly icon strip */}
          <div className="-mx-1 mb-2 flex overflow-x-auto pb-2">
            {next24.filter((_, k) => k % 3 === 0).map((h) => {
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
          <div className="h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={next24} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
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
                  formatter={(v, n) => [n === "rain" ? `${fmt(Number(v))} mm` : `${fmt(Number(v))} °C`, n === "rain" ? t("Niederschlag", "Precipitation") : n === "temp" ? t("Temperatur", "Temperature") : t("Gefühlt", "Feels like")]}
                />
                <Bar yAxisId="r" dataKey="rain" fill="#38bdf8" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                <Area yAxisId="t" type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={2} fill="url(#tempFill)" />
                <Line yAxisId="t" type="monotone" dataKey="feels" stroke="#94a3b8" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <h3 className="mb-2 px-1 font-medium text-white">{t("7 Tage", "7 days")}</h3>
          <ul className="divide-y divide-white/5">
            {days.slice(0, 8).map(({ t: d, i }) => {
              const w = weatherInfo(daily.weather_code[i]);
              const lo = daily.temperature_2m_min[i] ?? 0;
              const hi = daily.temperature_2m_max[i] ?? 0;
              const span = tMax - tMin || 1;
              return (
                <li key={d} className="grid grid-cols-[4.5rem_1.75rem_1fr] items-center gap-2 px-1 py-2 text-sm sm:grid-cols-[4.5rem_1.75rem_3rem_1fr_4.5rem]">
                  <span className="text-slate-300">
                    {d === todayStr ? t("Heute", "Today") : weekday(d)} <span className="text-xs text-slate-500">{dayMonth(d)}</span>
                  </span>
                  <w.Icon className="h-5 w-5 text-sky-200" aria-label={w.label} />
                  <span className="hidden items-center gap-0.5 text-xs text-sky-300 sm:flex">
                    <Droplets className="h-3 w-3" />
                    {fmt(daily.precipitation_sum[i])}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-8 text-right tabular-nums text-slate-400">{fmt(lo, 0)}°</span>
                    <span className="relative h-1.5 flex-1 rounded-full bg-white/10">
                      <span
                        className="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-amber-400"
                        style={{ left: `${((lo - tMin) / span) * 100}%`, right: `${100 - ((hi - tMin) / span) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 tabular-nums text-white">{fmt(hi, 0)}°</span>
                  </span>
                  <span className="hidden items-center justify-end gap-1 text-xs text-slate-400 sm:flex" title={t("Max. Böen", "Max. gusts")}>
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
      <p className="mt-3 text-xs text-slate-500">
        {t("Quelle", "Source")}: Open-Meteo · {modelLabel(model)} · {station.name} · {t("Modellwerte für die Koordinaten des Ortes", "model values for the location's coordinates")}
      </p>
    </CollapsibleSection>
  );
}
