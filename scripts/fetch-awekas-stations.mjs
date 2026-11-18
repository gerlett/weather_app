/**
 * One-off generator for the "Wetterstationen in Ihrer Nähe" list.
 *
 * Reads the "nahe Stationen" panel of the current station's AWEKAS instrument
 * page, then reads each station's info page for coordinates / elevation and
 * keeps only stations within 25 km. Result: src/data/nearby-stations.json.
 *
 * Run manually with:  node scripts/fetch-awekas-stations.mjs
 * (Not part of `npm run build` – AWEKAS is an external site and the list changes
 * slowly; a committed snapshot avoids depending on it at build/deploy time.)
 */
import { writeFile } from "node:fs/promises";

// Keep in sync with DEFAULT_LOCATION in src/lib/locations.ts (kept here so the
// generator can run before its own output exists).
const BASE = { awekasId: 12182, latitude: 48.2505, longitude: 14.6336, region: "Oberösterreich", country: "AT" };
const MAX_KM = 25;
const PAGE = "https://www.awekas.at/de";
const OUT = new URL("../src/data/nearby-stations.json", import.meta.url);

const decode = (s = "") =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|ouml|Ouml|auml|Auml|uuml|Uuml|szlig|ndash|mdash);/g, (_, e) =>
      ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ouml: "ö", Ouml: "Ö", auml: "ä", Auml: "Ä", uuml: "ü", Uuml: "Ü", szlig: "ß", ndash: "–", mdash: "—" })[e],
    )
    .trim();

const html = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": "wetter-app/1 (station list)" }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.text();
};

const distanceKm = (a, b) => {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const COUNTRY = { Österreich: "AT", Deutschland: "DE", Schweiz: "CH", "Vereinigtes Königreich": "GB", Italien: "IT", Frankreich: "FR" };

async function station(id) {
  const page = await html(`${PAGE}/station.php4?id=${id}`);
  const pos = /map\/de\/\?lat=([\d.]+)&(?:amp;)?lon=([\d.]+)&(?:amp;)?id=/.exec(page);
  if (!pos) return null; // some stations have no published position
  const name = decode(/Informationen der Station\s*([^<]+)/.exec(page)?.[1]);
  const region = decode(/Land<\/div>\s*<div class="ce2">([^<]+)/.exec(page)?.[1]);
  const elevation = Number((/Seeh&ouml;he<\/div>\s*<div class="ce2">([\d,]+)\s*m/.exec(page)?.[1] ?? "").replace(",", "")) || undefined;
  const latitude = Number(pos[1]);
  const longitude = Number(pos[2]);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const km = distanceKm(BASE, { latitude, longitude });
  return {
    id: `aw-${id}`,
    name,
    region: region || BASE.region,
    country: COUNTRY[region] ?? BASE.country,
    latitude,
    longitude,
    ...(elevation ? { elevation } : {}),
    awekasId: id,
    kind: "station",
    km: Math.round(km * 10) / 10,
  };
}

// ---------------------------------------------------------------- run

const instrument = await html(`${PAGE}/instrument.php4?id=${BASE.awekasId}`);
const seen = new Set();
for (const m of instrument.matchAll(/instrument\.php4\?id=(\d+)">([^<]+)<\/a>/g)) {
  const id = Number(m[1]);
  if (id !== BASE.awekasId) seen.add(id);
}

const nearby = [];
const queue = [...seen];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const s = await station(id);
        if (s && s.km <= MAX_KM) nearby.push(s);
      } catch (e) {
        console.error(`station ${id}: ${e.message}`);
      }
    }
  }),
);

nearby.sort((a, b) => a.km - b.km || a.name.localeCompare(b.name, "de"));
const clean = nearby.map((s) => {
  const copy = { ...s };
  delete copy.km;
  return copy;
});
await writeFile(OUT, JSON.stringify(clean, null, 2) + "\n");
console.log(`Wrote ${clean.length} AWEKAS stations within ${MAX_KM} km to ${OUT.pathname}`);
console.log(nearby.slice(0, 10).map((s) => `${s.km} km  ${s.name} (${s.awekasId})`).join("\n"));
