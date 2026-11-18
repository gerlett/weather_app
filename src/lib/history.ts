/** One history source for both the value-card graphs and "Verlauf & Statistik". */
import type { WeatherLocation } from "./locations";
import { fetchHistory, type HistorySeries, type Metric, type RangeKey } from "./openmeteo";
import { fetchAwekasHistory } from "./awekas";

type Opts = { year?: number; start?: string; end?: string };

/**
 * Real station readings for stations with an AWEKAS id, otherwise Open-Meteo
 * model/archive data. Any AWEKAS error silently falls back to Open-Meteo.
 */
export function fetchStationHistory(loc: WeatherLocation, metric: Metric, range: RangeKey, opts: Opts = {}): Promise<HistorySeries> {
  return fetchAwekasHistory(loc, metric, range, opts)?.catch(() => fetchHistory(loc, metric, range, opts)) ?? fetchHistory(loc, metric, range, opts);
}
