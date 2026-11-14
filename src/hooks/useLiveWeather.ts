"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WeatherLocation } from "@/lib/locations";
import { fetchCurrent, fetchForecast, type CurrentWeather, type ForecastResponse } from "@/lib/openmeteo";

/** How often the important current values are re-checked. */
export const LIVE_INTERVAL_MS = 60_000;
/** How often the full forecast (charts, 7 days, daily min/max) is reloaded. */
const FORECAST_INTERVAL_MS = 15 * 60_000;

export type LiveCurrent = CurrentWeather & { uv_index?: number };
export type ChangeMap = Partial<Record<keyof LiveCurrent, number>>; // key → delta (new − old)

const TRACKED: (keyof LiveCurrent)[] = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "cloud_cover",
  "weather_code",
  "uv_index",
];

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

/**
 * "Slow tracker": keeps the dashboard current without a reload.
 * - every minute: tiny current-conditions request; changed values are reported in `changes`
 * - every 15 min: full forecast reload
 * - paused while the tab is hidden, catches up immediately when it becomes visible again
 * No server, no database – each browser polls the public API itself.
 */
export function useLiveWeather(loc: WeatherLocation) {
  const [forecast, setForecast] = useState<ForecastResponse>();
  const [live, setLive] = useState<LiveCurrent>();
  const [changes, setChanges] = useState<{ map: ChangeMap; at: number }>({ map: {}, at: 0 });
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<number>(0);
  const [checking, setChecking] = useState(false);

  const liveRef = useRef<LiveCurrent | undefined>(undefined);
  const forecastAt = useRef(0);
  const locKey = `${loc.id}:${loc.latitude}:${loc.longitude}`;
  const locRef = useRef(locKey);

  const applyCurrent = useCallback((next: LiveCurrent) => {
    const prev = liveRef.current;
    if (prev) {
      const map: ChangeMap = {};
      for (const k of TRACKED) {
        const a = prev[k] as number | undefined;
        const b = next[k] as number | undefined;
        if (a != null && b != null && a !== b) map[k] = b - a;
      }
      if (Object.keys(map).length) setChanges({ map, at: Date.now() });
    }
    liveRef.current = next;
    setLive(next);
  }, []);

  const refresh = useCallback(
    async (full: boolean) => {
      const key = locKey;
      setChecking(true);
      try {
        if (full) {
          const f = await fetchForecast(loc, forecastAt.current > 0);
          if (locRef.current !== key) return;
          forecastAt.current = Date.now();
          setForecast(f);
          applyCurrent({ ...f.current, uv_index: liveRef.current?.uv_index });
        } else {
          const c = await fetchCurrent(loc);
          if (locRef.current !== key) return;
          applyCurrent(c.current);
        }
        setError(undefined);
        setLastCheck(Date.now());
      } catch (e) {
        if (locRef.current === key) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (locRef.current === key) {
          setChecking(false);
          setLoading(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locKey, applyCurrent],
  );

  // location change → reset and load everything
  useEffect(() => {
    locRef.current = locKey;
    liveRef.current = undefined;
    forecastAt.current = 0;
    setChanges({ map: {}, at: 0 });
    setLoading(true);
    refresh(true);
  }, [locKey, refresh]);

  const lastCheckRef = useRef(0);
  lastCheckRef.current = lastCheck;

  // polling loop
  useEffect(() => {
    const tick = () => {
      if (!visible()) return;
      const fullDue = Date.now() - forecastAt.current >= FORECAST_INTERVAL_MS;
      refresh(fullDue);
    };
    const id = setInterval(tick, LIVE_INTERVAL_MS);
    const onVisible = () => {
      if (visible() && Date.now() - lastCheckRef.current >= LIVE_INTERVAL_MS) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // The forecast's `current` block, overlaid with the newest live values.
  const data: ForecastResponse | undefined =
    forecast && live
      ? { ...forecast, current: { ...forecast.current, ...live } }
      : forecast;

  return {
    data,
    uvNow: live?.uv_index,
    changes,
    error,
    loading,
    checking,
    lastCheck,
    refreshNow: () => refresh(false),
  };
}
