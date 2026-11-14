/**
 * Thin client for the free, key-less Open-Meteo APIs.
 * - forecast-api: current conditions, hourly/daily forecast, up to 92 past days
 * - archive-api:  reanalysis history back to 1940 (≈ 5 days delay)
 * - geocoding-api: worldwide place search
 * No database: everything is fetched on demand and cached in memory for the session.
 */
import type { WeatherLocation } from "./locations";
import { BUILD_ID } from "./version";

/**
 * API base. Deployed builds go through the server's caching proxy (same origin,
 * shared cache, see deploy/nginx.conf): deploy-web.sh builds with
 * NEXT_PUBLIC_OM_PROXY=/api/om. Without it (local `npm run dev`) Open-Meteo is called directly.
 */
const PROXY = process.env.NEXT_PUBLIC_OM_PROXY;
const FORECAST = PROXY ? `${PROXY}/forecast` : "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = PROXY ? `${PROXY}/archive` : "https://archive-api.open-meteo.com/v1/archive";
const GEOCODING = PROXY ? `${PROXY}/geocoding` : "https://geocoding-api.open-meteo.com/v1/search";

// ---------------------------------------------------------------- fetching, caching, rate limits
//
// Open-Meteo free tier: 600 calls/min, 5000/h, 10000/day per IP; one request covering more than
// two weeks counts as several calls. Therefore:
//  1. in-memory de-duplication of identical requests,
//  2. persistent browser cache (localStorage) for archive data that can no longer change,
//  3. on HTTP 429 every request pauses until the limit window has passed and is retried automatically.

const memory = new Map<string, Promise<unknown>>();
const LS_PREFIX = "om1:";
const IMMUTABLE_AFTER_DAYS = 7;

/** Global "rate-limited until" timestamp + subscribers (for the banner). */
let limitedUntil = 0;
const listeners = new Set<(until: number) => void>();
export function onRateLimit(fn: (until: number) => void) {
  listeners.add(fn);
  fn(limitedUntil);
  return () => void listeners.delete(fn);
}
function setLimited(until: number) {
  limitedUntil = until;
  listeners.forEach((l) => l(until));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Archive responses whose end date is older than a week never change → cache them in the browser. */
function isImmutable(url: string) {
  if (!url.startsWith(ARCHIVE)) return false;
  const end = /end_date=(\d{4}-\d{2}-\d{2})/.exec(url)?.[1];
  return !!end && end < isoDate(addDays(new Date(), -IMMUTABLE_AFTER_DAYS));
}

/**
 * A new deploy may change how data is requested or processed: the first time a
 * browser runs a new build, the weather data it cached under an older build is
 * dropped (settings – location, favorites, changelog – stay). The archive data
 * comes back from the server's proxy cache, so this costs no API calls.
 */
const LS_BUILD = "wetter-perg:build";
function dropCacheOfOldBuild() {
  if (!BUILD_ID) return;
  try {
    if (localStorage.getItem(LS_BUILD) === BUILD_ID) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(LS_BUILD, BUILD_ID);
  } catch {
    /* storage unavailable – nothing cached either */
  }
}
// in the browser: right when the code of a (new) build first loads
if (typeof window !== "undefined") dropCacheOfOldBuild();

function lsGet<T>(url: string): T | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + url);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function lsSet(url: string, data: unknown) {
  const value = JSON.stringify(data);
  if (value.length > 1_500_000) return; // don't fill the quota with a single huge response
  try {
    localStorage.setItem(LS_PREFIX + url, value);
  } catch {
    // quota exceeded → drop our cache entries and try once more
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(LS_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(LS_PREFIX + url, value);
    } catch {
      /* give up silently – caching is only an optimisation */
    }
  }
}

async function fetchWithRetry<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const wait = limitedUntil - Date.now();
    if (wait > 0) await sleep(wait);
    const r = await fetch(url);
    if (r.ok) {
      if (limitedUntil && Date.now() > limitedUntil) setLimited(0);
      return (await r.json()) as T;
    }
    const body = await r.json().catch(() => ({}));
    if (r.status === 429 && attempt < 4) {
      const hourly = /hourly/i.test(body?.reason ?? "");
      const daily = /daily/i.test(body?.reason ?? "");
      if (daily) throw new Error("Tageslimit der Wetterdaten-Schnittstelle erreicht – bitte morgen erneut versuchen.");
      setLimited(Date.now() + (hourly ? 10 * 60_000 : 61_000));
      continue;
    }
    throw new Error(body?.reason ?? `HTTP ${r.status}`);
  }
}

async function getJson<T>(url: string, opts: { fresh?: boolean } = {}): Promise<T> {
  if (opts.fresh) return fetchWithRetry<T>(url); // live polling: never served from cache
  const hit = memory.get(url);
  if (hit) return hit as Promise<T>;
  const immutable = isImmutable(url);
  if (immutable) {
    const stored = lsGet<T>(url);
    if (stored) {
      const p = Promise.resolve(stored);
      memory.set(url, p);
      return p;
    }
  }
  const p = fetchWithRetry<T>(url).then((d) => {
    if (immutable) lsSet(url, d);
    return d;
  });
  memory.set(url, p);
  p.catch(() => memory.delete(url));
  return p;
}

const qs = (o: Record<string, string | number>) =>
  Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");

type Nullable<T> = { [K in keyof T]: T[K] extends number[] ? (number | null)[] : T[K] };

// ---------------------------------------------------------------- current + forecast

export type CurrentWeather = {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  dew_point_2m: number;
  precipitation: number;
  weather_code: number;
  cloud_cover: number;
  pressure_msl: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
  is_day: number;
};

export type HourlyForecast = Nullable<{
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation: number[];
  precipitation_probability: number[];
  weather_code: number[];
  pressure_msl: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  relative_humidity_2m: number[];
  uv_index: number[];
  is_day: number[];
}>;

export type DailyForecast = Nullable<{
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  sunrise: string[];
  sunset: string[];
  sunshine_duration: number[];
  uv_index_max: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  wind_direction_10m_dominant: number[];
}>;

export type ForecastResponse = {
  elevation: number;
  timezone: string;
  current: CurrentWeather;
  hourly: HourlyForecast;
  daily: DailyForecast;
};

const CURRENT_VARS =
  "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day";

/**
 * Current conditions only (+ the current hour's UV) – a tiny request (~1 API call)
 * for the live tracker that polls every minute. Never cached.
 */
export function fetchCurrent(loc: WeatherLocation) {
  return getJson<{ current: CurrentWeather & { uv_index: number } }>(
    `${FORECAST}?` +
      qs({ latitude: loc.latitude, longitude: loc.longitude, timezone: "auto", current: `${CURRENT_VARS},uv_index` }),
    { fresh: true },
  );
}

export function fetchForecast(loc: WeatherLocation, fresh = false) {
  return getJson<ForecastResponse>(
    `${FORECAST}?` +
      qs({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timezone: "auto",
        past_days: 1,
        forecast_days: 8,
        current: CURRENT_VARS,
        hourly:
          "temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,pressure_msl,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index,is_day",
        daily:
          "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,sunshine_duration,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
      }),
    { fresh },
  );
}

// ---------------------------------------------------------------- history

export type Metric = "temperature" | "precipitation" | "wind" | "pressure" | "humidity";

/** Normalised history point. `null` = no measurement available (shown as a gap, never interpolated). */
export type HistoryPoint = {
  t: string; // ISO date or date-time
  value: number | null; // mean / main value
  min?: number | null;
  max?: number | null;
  dir?: number | null; // wind direction
};

export type HistorySeries = {
  resolution: "hourly" | "daily";
  points: HistoryPoint[];
  source: "forecast" | "archive";
};

export type RangeKey = "24h" | "7d" | "30d" | "12m" | "year" | "custom";

const HOURLY_VAR: Record<Metric, string> = {
  temperature: "temperature_2m",
  precipitation: "precipitation",
  wind: "wind_speed_10m",
  pressure: "pressure_msl",
  humidity: "relative_humidity_2m",
};

const DAILY_VARS: Record<Metric, { value: string; min?: string; max?: string }> = {
  temperature: { value: "temperature_2m_mean", min: "temperature_2m_min", max: "temperature_2m_max" },
  precipitation: { value: "precipitation_sum" },
  wind: { value: "wind_speed_10m_max", max: "wind_gusts_10m_max" },
  pressure: { value: "pressure_msl_mean", min: "pressure_msl_min", max: "pressure_msl_max" },
  humidity: { value: "relative_humidity_2m_mean", min: "relative_humidity_2m_min", max: "relative_humidity_2m_max" },
};

export const isoDate = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

/** Archive (reanalysis) data starts 1940-01-01 and lags a few days behind. */
export const ARCHIVE_START = "1940-01-01";
export const archiveEnd = () => isoDate(addDays(new Date(), -5));

type RawHourly = { hourly: Record<string, (number | null)[]> & { time: string[] } };
type RawDaily = { daily: Record<string, (number | null)[]> & { time: string[] } };

async function hourlyHistory(loc: WeatherLocation, metric: Metric, hours: number): Promise<HistorySeries> {
  const v = HOURLY_VAR[metric];
  const extra = metric === "wind" ? ",wind_gusts_10m,wind_direction_10m" : "";
  const pastDays = Math.ceil(hours / 24) + 1;
  const res = await getJson<RawHourly>(
    `${FORECAST}?` +
      qs({ latitude: loc.latitude, longitude: loc.longitude, timezone: "auto", past_days: pastDays, forecast_days: 1, hourly: v + extra }),
  );
  const now = Date.now();
  const from = now - hours * 3600_000;
  const points: HistoryPoint[] = [];
  res.hourly.time.forEach((t, i) => {
    const ts = new Date(t).getTime();
    if (ts < from || ts > now) return;
    points.push({
      t,
      value: res.hourly[v][i],
      max: metric === "wind" ? res.hourly.wind_gusts_10m[i] : undefined,
      dir: metric === "wind" ? res.hourly.wind_direction_10m[i] : undefined,
    });
  });
  return { resolution: "hourly", points, source: "forecast" };
}

async function dailyHistory(
  loc: WeatherLocation,
  metric: Metric,
  start: string,
  end: string,
  api: "forecast" | "archive",
): Promise<HistorySeries> {
  const d = DAILY_VARS[metric];
  const vars = [d.value, d.min, d.max, metric === "wind" ? "wind_direction_10m_dominant" : undefined].filter(Boolean).join(",");
  const base = api === "archive" ? ARCHIVE : FORECAST;
  const res = await getJson<RawDaily>(
    `${base}?` + qs({ latitude: loc.latitude, longitude: loc.longitude, timezone: "auto", start_date: start, end_date: end, daily: vars }),
  );
  const points = res.daily.time.map((t, i) => ({
    t,
    value: res.daily[d.value][i],
    min: d.min ? res.daily[d.min][i] : undefined,
    max: d.max ? res.daily[d.max][i] : undefined,
    dir: metric === "wind" ? res.daily.wind_direction_10m_dominant[i] : undefined,
  }));
  return { resolution: "daily", points, source: api };
}

export function fetchHistory(
  loc: WeatherLocation,
  metric: Metric,
  range: RangeKey,
  opts: { year?: number; start?: string; end?: string } = {},
): Promise<HistorySeries> {
  const today = new Date();
  switch (range) {
    case "24h":
      return hourlyHistory(loc, metric, 24);
    case "7d":
      return hourlyHistory(loc, metric, 24 * 7);
    case "30d":
      return dailyHistory(loc, metric, isoDate(addDays(today, -30)), isoDate(today), "forecast");
    case "12m":
      return dailyHistory(loc, metric, isoDate(addDays(today, -365)), archiveEnd(), "archive");
    case "year": {
      const y = opts.year ?? today.getFullYear();
      const end = `${y}-12-31` > archiveEnd() ? archiveEnd() : `${y}-12-31`;
      return dailyHistory(loc, metric, `${y}-01-01`, end, "archive");
    }
    case "custom": {
      const start = opts.start ?? isoDate(addDays(today, -60));
      let end = opts.end ?? archiveEnd();
      if (end > archiveEnd()) end = archiveEnd();
      return dailyHistory(loc, metric, start < ARCHIVE_START ? ARCHIVE_START : start, end, "archive");
    }
  }
}

// ---------------------------------------------------------------- climate (multi-year daily)

export type ClimateDaily = {
  time: string[];
  tmean: (number | null)[];
  tmax: (number | null)[];
  tmin: (number | null)[];
  rain: (number | null)[];
  sun: (number | null)[];
  gust: (number | null)[];
};

export async function fetchClimate(loc: WeatherLocation, startYear: number, endYear: number): Promise<ClimateDaily> {
  const end = `${endYear}-12-31` > archiveEnd() ? archiveEnd() : `${endYear}-12-31`;
  const res = await getJson<RawDaily>(
    `${ARCHIVE}?` +
      qs({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timezone: "auto",
        start_date: `${startYear}-01-01`,
        end_date: end,
        daily: "temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,wind_gusts_10m_max",
      }),
  );
  return {
    time: res.daily.time,
    tmean: res.daily.temperature_2m_mean,
    tmax: res.daily.temperature_2m_max,
    tmin: res.daily.temperature_2m_min,
    rain: res.daily.precipitation_sum,
    sun: res.daily.sunshine_duration,
    gust: res.daily.wind_gusts_10m_max,
  };
}

// ---------------------------------------------------------------- rainfall totals (hourly, any span)

export type SpanHour = { t: string; v: number | null; source: "forecast" | "archive" };

/**
 * The forecast API nominally serves ~92 past days, but its oldest weeks are often empty (null).
 * It is only used for the most recent days; everything else comes from the archive.
 */
const FORECAST_PAST_DAYS = 10;

/**
 * Hourly values of one variable between two local date-times, any span back to 1940.
 * Merges archive (older) and forecast-model analysis (last 90 days).
 *
 * - `accumulated` (e.g. precipitation): the value at stamp `t` is the sum of the *preceding* hour,
 *   so a stamp belongs to the span if start < t ≤ end.
 * - `instant` (e.g. temperature): value at `t` is a snapshot → start ≤ t ≤ end.
 */
export async function fetchHourlySpan(
  loc: WeatherLocation,
  variable: string,
  start: Date,
  end: Date,
  kind: "accumulated" | "instant",
): Promise<SpanHour[]> {
  const now = new Date();
  if (end > now) end = now;
  if (end <= start) return [];
  const split = addDays(now, -FORECAST_PAST_DAYS);
  const base = { latitude: loc.latitude, longitude: loc.longitude, timezone: "auto", hourly: variable };

  // Archive for everything it has (it can lag a few days); forecast models for the most recent days.
  // Both overlap; per hour the forecast value wins when present, otherwise the archive fills the gap.
  const parts: Promise<SpanHour[]>[] = [];
  if (start < split) {
    const aEnd = end;
    parts.push(
      getJson<RawHourly>(`${ARCHIVE}?` + qs({ ...base, start_date: isoDate(start), end_date: isoDate(aEnd) })).then((r) =>
        r.hourly.time.map((t, i) => ({ t, v: r.hourly[variable][i], source: "archive" as const })),
      ),
    );
  }
  if (end >= split) {
    const fStart = start > split ? start : split;
    parts.push(
      getJson<RawHourly>(`${FORECAST}?` + qs({ ...base, start_date: isoDate(fStart), end_date: isoDate(end) })).then((r) =>
        r.hourly.time.map((t, i) => ({ t, v: r.hourly[variable][i], source: "forecast" as const })),
      ),
    );
  }

  const merged = new Map<string, SpanHour>();
  for (const list of await Promise.all(parts)) {
    for (const h of list) {
      const prev = merged.get(h.t);
      // prefer the high-resolution forecast models where both exist
      if (!prev || prev.v == null || (h.source === "forecast" && h.v != null)) merged.set(h.t, h);
    }
  }
  const s = start.getTime();
  const e = end.getTime();
  return [...merged.values()]
    .filter((h) => {
      const ts = new Date(h.t).getTime();
      return (kind === "accumulated" ? ts > s : ts >= s) && ts <= e;
    })
    .sort((a, b) => a.t.localeCompare(b.t));
}

// ---------------------------------------------------------------- geocoding

type GeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  admin1?: string;
};

export async function searchPlaces(query: string): Promise<WeatherLocation[]> {
  if (query.trim().length < 2) return [];
  const res = await getJson<{ results?: GeoResult[] }>(
    `${GEOCODING}?` + qs({ name: query.trim(), count: 8, language: "de", format: "json" }),
  );
  return (res.results ?? []).map((r) => ({
    id: `geo-${r.id}`,
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    country: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    kind: "place" as const,
  }));
}
