"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Droplets,
  Gauge,
  Navigation,
  Sunrise,
  Sunset,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ForecastResponse } from "@/lib/openmeteo";
import type { WeatherLocation } from "@/lib/locations";
import { TONE_BG, weatherInfo } from "@/lib/weatherCodes";
import { beaufort, compass, fmt, fullDate, time, uvLabel } from "@/lib/format";
import { Skeleton } from "./ui";
import { LiveStatus } from "./LiveStatus";
import type { ChangeMap } from "@/hooks/useLiveWeather";

function todayIndex(times: string[], ref: string) {
  const d = ref.slice(0, 10);
  return Math.max(0, times.findIndex((t) => t.startsWith(d)));
}

export function derive(data: ForecastResponse) {
  const { current, hourly, daily } = data;
  const di = todayIndex(daily.time, current.time);
  const nowTs = new Date(current.time).getTime();
  const hi = hourly.time.findIndex((t) => new Date(t).getTime() > nowTs) - 1;
  const today = current.time.slice(0, 10);
  const rainToday = hourly.time.reduce(
    (s, t, i) => (t.startsWith(today) && new Date(t).getTime() <= nowTs ? s + (hourly.precipitation[i] ?? 0) : s),
    0,
  );
  const p3 = hourly.pressure_msl[hi - 3];
  const trend = p3 == null ? 0 : current.pressure_msl - p3;
  return { di, hi, rainToday, trend };
}

/** Small "▲ +0,3" badge shown for a few seconds after a value changed. */
function Delta({ delta, digits = 1, at }: { delta?: number; digits?: number; at: number }) {
  if (delta == null || Math.abs(delta) < 10 ** -digits / 2) return null;
  const up = delta > 0;
  return (
    <span
      key={at}
      className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 align-middle text-xs font-medium animate-[fadeout_8s_ease-out_forwards] ${
        up ? "bg-rose-400/15 text-rose-200" : "bg-sky-400/15 text-sky-200"
      }`}
    >
      {up ? "▲ +" : "▼ "}
      {fmt(delta, digits)}
    </span>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  digits,
  changedAt,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  delta?: number;
  digits?: number;
  changedAt: number;
  children?: React.ReactNode;
}) {
  const changed = delta != null;
  return (
    <div
      key={changed ? changedAt : "static"}
      className={`rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.07] ${changed ? "animate-[flash_2.5s_ease-out]" : ""}`}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        <Icon className="h-4 w-4 text-sky-300" />
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
        {value}
        <span className="ml-1 text-base font-normal text-slate-400">{unit}</span>
        <Delta delta={delta} digits={digits} at={changedAt} />
      </p>
      <div className="mt-1 space-y-0.5 text-xs text-slate-400">{children}</div>
    </div>
  );
}

export type LiveProps = {
  changes: { map: ChangeMap; at: number };
  lastCheck: number;
  checking: boolean;
  uvNow?: number;
  onRefresh: () => void;
};

export function CurrentSection({ location, data, loading, live }: { location: WeatherLocation; data?: ForecastResponse; loading: boolean; live: LiveProps }) {
  if (!data) {
    return (
      <section id="aktuell" className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <Skeleton className="h-80" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </section>
    );
  }

  const { current: c, daily, hourly } = data;
  const { di, hi, rainToday, trend } = derive(data);
  const isDay = c.is_day === 1;
  const info = weatherInfo(c.weather_code, isDay);
  const bg = TONE_BG[isDay ? info.tone : "night"];
  const bft = beaufort(c.wind_speed_10m);
  const TrendIcon = trend > 0.5 ? ArrowUp : trend < -0.5 ? ArrowDown : ArrowRight;
  const trendLabel = trend > 0.5 ? "steigend" : trend < -0.5 ? "fallend" : "gleichbleibend";
  const sunH = (daily.sunshine_duration[di] ?? 0) / 3600;
  const uv = live.uvNow ?? hourly.uv_index[hi] ?? 0;
  const ch = live.changes.map;
  const at = live.changes.at;

  return (
    <section id="aktuell" className={`grid scroll-mt-24 gap-4 lg:grid-cols-[1.1fr_1.9fr] ${loading ? "opacity-70" : ""} transition-opacity`}>
      {/* Hero */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bg} p-6 shadow-2xl ring-1 ring-white/10 sm:p-8`}>
        <div className="pointer-events-none absolute -right-10 -top-10 opacity-20">
          <info.Icon className="h-64 w-64 text-white" strokeWidth={1} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Aktuelles Wetter</p>
        <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{location.name}</h1>
        <p className="text-sm text-white/70">
          {location.region} · {Math.round(data.elevation)} m ü. A.
        </p>

        <div className="mt-8 flex items-end gap-4">
          <info.Icon className="h-16 w-16 text-white drop-shadow animate-[float_6s_ease-in-out_infinite]" strokeWidth={1.5} />
          <p
            key={ch.temperature_2m != null ? at : "static"}
            className={`text-7xl font-light leading-none tabular-nums text-white sm:text-8xl ${ch.temperature_2m != null ? "animate-[pop_1.2s_ease-out]" : ""}`}
          >
            {fmt(c.temperature_2m)}
            <span className="align-top text-3xl">°C</span>
          </p>
        </div>
        <p className="mt-3 text-lg font-medium text-white">{info.label}</p>
        <p className="text-sm text-white/80">
          Gefühlt {fmt(c.apparent_temperature)} °C · Max {fmt(daily.temperature_2m_max[di])}° / Min {fmt(daily.temperature_2m_min[di])}°
        </p>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
          {daily.sunrise[di] && (
            <span className="inline-flex items-center gap-1.5"><Sunrise className="h-4 w-4" /> {time(daily.sunrise[di]!)}</span>
          )}
          {daily.sunset[di] && (
            <span className="inline-flex items-center gap-1.5"><Sunset className="h-4 w-4" /> {time(daily.sunset[di]!)}</span>
          )}
        </div>
        <LiveStatus lastCheck={live.lastCheck} checking={live.checking} valueTime={c.time} onRefresh={live.onRefresh} />
        <p className="mt-1 text-xs text-white/60">
          {fullDate(c.time)} · Modelldaten Open-Meteo (Aktualisierung alle 15 min)
          {location.awekasId ? " · Stationsmesswerte siehe unten" : ""}
        </p>
      </div>

      {/* Measurements */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Metric icon={Thermometer} label="Temperatur" value={fmt(c.temperature_2m)} unit="°C" delta={ch.temperature_2m} changedAt={at}>
          <p>Taupunkt {fmt(c.dew_point_2m)} °C</p>
          <p>Gefühlt {fmt(c.apparent_temperature)} °C</p>
        </Metric>
        <Metric icon={Wind} label="Wind" value={fmt(c.wind_speed_10m)} unit="km/h" delta={ch.wind_speed_10m ?? ch.wind_gusts_10m} changedAt={at}>
          <p className="flex items-center gap-1">
            <Navigation className="h-3 w-3" style={{ transform: `rotate(${c.wind_direction_10m + 180}deg)` }} />
            {compass(c.wind_direction_10m)} ({Math.round(c.wind_direction_10m)}°) · {bft.bft} Bft
          </p>
          <p>Böen {fmt(c.wind_gusts_10m)} km/h</p>
        </Metric>
        <Metric icon={Umbrella} label="Niederschlag" value={fmt(rainToday)} unit="mm heute" delta={ch.precipitation} changedAt={at}>
          <p>Aktuell {fmt(c.precipitation)} mm/h</p>
          <p>Prognose Tag {fmt(daily.precipitation_sum[di])} mm · {fmt(daily.precipitation_probability_max[di], 0)} %</p>
        </Metric>
        <Metric icon={Gauge} label="Luftdruck" value={fmt(c.pressure_msl)} unit="hPa" delta={ch.pressure_msl} changedAt={at}>
          <p className="flex items-center gap-1">
            <TrendIcon className="h-3 w-3" /> {trendLabel} ({trend > 0 ? "+" : ""}{fmt(trend)} hPa / 3 h)
          </p>
          <p>reduziert auf Meeresniveau</p>
        </Metric>
        <Metric icon={Droplets} label="Luftfeuchte" value={fmt(c.relative_humidity_2m, 0)} unit="%" delta={ch.relative_humidity_2m} digits={0} changedAt={at}>
          <p>Bewölkung {fmt(c.cloud_cover, 0)} %</p>
          <p>Taupunkt {fmt(c.dew_point_2m)} °C</p>
        </Metric>
        <Metric icon={Sun} label="Sonne & UV" value={fmt(uv)} unit="UV" delta={ch.uv_index} changedAt={at}>
          <p>{uvLabel(uv)} · Tagesmax {fmt(daily.uv_index_max[di])}</p>
          <p>Sonnenschein heute {fmt(sunH)} h</p>
        </Metric>
      </div>
    </section>
  );
}
