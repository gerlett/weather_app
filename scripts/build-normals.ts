/**
 * Pre-computes WMO climate normals 1991–2020 (monthly means) for the regional stations
 * and writes them to src/data/normals.json – a static file shipped with the site, no database.
 *
 * Why: 30 years of daily data count as ~780 Open-Meteo calls (1 call = 2 weeks of data),
 * which exceeds the free per-minute limit (600) when requested from the browser.
 * This script splits the work into decade chunks and pauses between them.
 *
 * Usage (Node ≥ 23, runs TypeScript directly):
 *   node scripts/build-normals.ts                 # only stations missing from the file
 *   node scripts/build-normals.ts perg-thurnhof   # specific station(s)
 *   node scripts/build-normals.ts --all           # recompute all
 * Free tier hourly limit is 5000 calls → at most ~6 stations per hour.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { REGIONAL_STATIONS } from "../src/lib/locations.ts";

const OUT = new URL("../src/data/normals.json", import.meta.url);
const CHUNKS = [
  ["1991-01-01", "2000-12-31"],
  ["2001-01-01", "2010-12-31"],
  ["2011-01-01", "2020-12-31"],
];
const PAUSE_MS = 65_000; // each chunk ≈ 260 calls → keep well below 600/min
const VARS = ["temperature_2m_mean", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "sunshine_duration"];

type Normals = { tmean: number[]; tmax: number[]; tmin: number[]; rain: number[]; sun: number[]; elevation: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r1 = (v: number) => Math.round(v * 10) / 10;

async function fetchChunk(lat: number, lon: number, start: string, end: string) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&timezone=auto&start_date=${start}&end_date=${end}&daily=${VARS.join(",")}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    const body = await res.text();
    console.warn(`  HTTP ${res.status} (${body.slice(0, 120)}) – retry in 70 s`);
    await sleep(70_000);
  }
  throw new Error(`failed: ${url}`);
}

async function compute(lat: number, lon: number): Promise<Normals> {
  const days: Record<string, (number | null)[]> = { time: [] as never };
  let elevation = 0;
  for (let i = 0; i < CHUNKS.length; i++) {
    const [s, e] = CHUNKS[i];
    console.log(`  ${s} … ${e}`);
    const j = await fetchChunk(lat, lon, s, e);
    elevation = j.elevation;
    for (const k of ["time", ...VARS]) days[k] = [...(days[k] ?? []), ...j.daily[k]];
    if (i < CHUNKS.length - 1) await sleep(PAUSE_MS);
  }
  const time = days.time as unknown as string[];
  const out: Normals = { tmean: [], tmax: [], tmin: [], rain: [], sun: [], elevation };
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const idx = time.map((t, i) => (t.slice(5, 7) === mm ? i : -1)).filter((i) => i >= 0);
    const mean = (k: string) => {
      const v = idx.map((i) => days[k][i]).filter((x): x is number => x != null);
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    // sums: total over 30 years / 30
    const perYear = (k: string, scale = 1) => (idx.reduce((a, i) => a + (days[k][i] ?? 0), 0) * scale) / 30;
    out.tmean.push(r1(mean("temperature_2m_mean")));
    out.tmax.push(r1(mean("temperature_2m_max")));
    out.tmin.push(r1(mean("temperature_2m_min")));
    out.rain.push(r1(perYear("precipitation_sum")));
    out.sun.push(r1(perYear("sunshine_duration", 1 / 3600)));
  }
  return out;
}

const args = process.argv.slice(2);
const existing: Record<string, Normals> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const targets = args.includes("--all")
  ? REGIONAL_STATIONS
  : args.length
    ? REGIONAL_STATIONS.filter((s) => args.includes(s.id))
    : REGIONAL_STATIONS.filter((s) => !existing[s.id]);

console.log(`Computing normals 1991–2020 for ${targets.length} station(s)…`);
for (const [n, s] of targets.entries()) {
  console.log(`[${n + 1}/${targets.length}] ${s.name}`);
  existing[s.id] = await compute(s.latitude, s.longitude);
  writeFileSync(OUT, JSON.stringify(existing, null, 1) + "\n"); // save after each station
  if (n < targets.length - 1) await sleep(PAUSE_MS);
}
console.log("done →", OUT.pathname);
