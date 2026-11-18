/**
 * AWEKAS station history via the site's server-side proxy (deploy/bridge/server.mjs).
 * The AWEKAS instrument page has no CORS headers, so the browser cannot call it
 * directly; nginx exposes the bridge endpoint at /api/aw/history (same origin).
 * Without that proxy (e.g. local `npm run dev`) callers fall back to Open-Meteo.
 */
import type { WeatherLocation } from "./locations";
import type { HistorySeries } from "./openmeteo";

const PROXY = process.env.NEXT_PUBLIC_AW_PROXY;
const memory = new Map<string, Promise<HistorySeries>>();

export const hasAwekasProxy = () => !!PROXY;

/** Only stations with an AWEKAS id have real station history (others use model data). */
export const hasAwekasHistory = (loc: WeatherLocation) => !!PROXY && loc.awekasId != null;

export function fetchAwekasHistory(
  loc: WeatherLocation,
  metric: string,
  range: string,
  opts: { year?: number | string; start?: string; end?: string } = {},
): Promise<HistorySeries> | undefined {
  if (!PROXY || loc.awekasId == null) return undefined;
  const q = new URLSearchParams({ id: String(loc.awekasId), metric, range });
  if (opts.year != null) q.set("year", String(opts.year));
  if (opts.start) q.set("start", opts.start);
  if (opts.end) q.set("end", opts.end);
  const url = `${PROXY}/history?${q}`;
  let p = memory.get(url);
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      return (await r.json()) as HistorySeries;
    });
    memory.set(url, p);
    p.catch(() => memory.delete(url));
  }
  return p;
}
