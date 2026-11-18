/**
 * AWEKAS station history for the website's "Verlauf ..." graphs.
 *
 * AWEKAS has no public, key-less history API. The instrument page renders its
 * graphs from an internal JSON endpoint, so this module replays what the page
 * does: read the page's per-load `secid` token, then ask for the metric data.
 * It runs on the server (AWEKAS sends no CORS headers) and normalises the
 * result to the same HistorySeries shape the app uses for Open-Meteo.
 *
 * This is a best-effort integration with an external, unofficial endpoint:
 * if anything changes or fails, the client falls back to Open-Meteo.
 */
const AW = "https://www.awekas.at";
const UA = "wetter-bridge/1 (+AWEKAS station history)";
const MOD = { temperature: 0, pressure: 1, wind: 2, precipitation: 4, humidity: 6 };
const GUST_MOD = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = new Map();

async function cached(key, ttl, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const get = async (url, referer) => {
  const r = await fetch(url, {
    headers: { "user-agent": UA, ...(referer ? { referer } : {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`AWEKAS HTTP ${r.status}`);
  return r;
};

/** The token changes on every page load and is not bound to cookies. */
async function token(id) {
  const page = await (await get(`${AW}/de/instrument.php4?id=${id}`)).text();
  const m = /var secid\s*=\s*"([^"]+)"/.exec(page);
  if (!m) throw new Error("AWEKAS secid not found (page layout changed?)");
  return decodeURIComponent(m[1]);
}

function yearFor(et, month) {
  const [y, em] = et.split("-").map(Number);
  if (month >= 10 && em <= 2) return y - 1;
  if (month <= 2 && em >= 11) return y + 1;
  return y;
}

const pad = (n) => String(n).padStart(2, "0");

/** Tooltips carry the timestamp: "17.11.<br> 13:00 - 13:59", "01.11." or "01.01.". */
function stamp(tool, et, hourly) {
  const s = String(tool ?? "").replace(/<br\s*\/?>/gi, " ");
  const hm = hourly ? /(\d{1,2})\.(\d{1,2})\.\s+(\d{1,2}):(\d{2})/.exec(s) : /(\d{1,2})\.(\d{1,2})\./.exec(s);
  if (!hm) return null;
  const day = Number(hm[1]);
  const month = Number(hm[2]);
  const year = yearFor(et, month);
  const time = hourly ? `T${pad(Number(hm[3]))}:${hm[4]}:00` : "T00:00:00";
  return `${year}-${pad(month)}-${pad(day)}${time}`;
}

/** zr=1: last 24 hours (hourly). zr=2: one month of daily values. */
async function series(id, secid, mod, zr, et) {
  const url =
    `${AW}/common/ajax_instrument.php4?` +
    new URLSearchParams({ secid, et, zr: String(zr), eh: "c", mod: String(mod), lng: "de", tz: "0" });
  const json = await (await get(url, `${AW}/de/instrument.php4?id=${id}`)).json();
  if (!Array.isArray(json?.data) || !Array.isArray(json?.tool)) throw new Error("AWEKAS data format changed");
  return json.data.map((v, i) => ({ t: stamp(json.tool[i], et, zr === 1), value: v == null ? null : Number(v) }));
}

const monthKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}`;
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** All month keys (YYYY-M) covering [from, to] inclusive, capped to avoid abuse. */
function monthRange(from, to) {
  const out = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  while (d <= last && out.length < 48) {
    out.push(monthKey(d));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/**
 * @returns {{resolution: "hourly"|"daily", points: object[], source: "awekas"}}
 */
export async function awekasHistory(id, metric, range, opts = {}) {
  const mod = MOD[metric];
  if (mod == null) throw new Error(`unknown metric: ${metric}`);
  const supported = ["24h", "7d", "30d", "12m", "year", "custom"];
  if (!supported.includes(range)) throw new Error(`unsupported range: ${range}`);
  const ttl = range === "24h" ? 60_000 : ["12m", "year", "custom"].includes(range) ? 6 * 60 * 60_000 : 30 * 60_000;
  const key = `${id}:${metric}:${range}:${opts.year ?? ""}:${opts.start ?? ""}:${opts.end ?? ""}`;
  return cached(key, ttl, async () => {
    const secid = await token(id);
    const now = new Date();

    if (range === "24h") {
      const [main, gust] = await Promise.all([
        series(id, secid, mod, 1, monthKey(now)),
        ...(metric === "wind" ? [series(id, secid, GUST_MOD, 1, monthKey(now))] : []),
      ]);
      const points = main
        .filter((p) => p.t)
        .map((p, i) => ({ ...p, ...(metric === "wind" ? { max: gust[i]?.value ?? null } : {}) }));
      return { resolution: "hourly", points, source: "awekas" };
    }

    // Daily ranges: AWEKAS serves one month per request; fetch the months the
    // requested window spans, a few at a time, and merge by timestamp.
    let from;
    let to = now;
    if (range === "7d" || range === "30d") {
      const days = range === "7d" ? 7 : 30;
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
    } else if (range === "12m") {
      from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    } else if (range === "year") {
      const y = Number(opts.year) || now.getFullYear();
      from = new Date(y, 0, 1);
      to = new Date(y, 11, 31);
      if (to > now) to = now;
    } else {
      from = parseDate(opts.start) ?? new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = parseDate(opts.end) ?? now;
      if (to > now) to = now;
      if (to < from) [from, to] = [to, from];
    }

    const months = monthRange(from, to);
    const main = [];
    const gust = [];
    for (let i = 0; i < months.length; i += 3) {
      const batch = months.slice(i, i + 3);
      const [bMain, bGust] = await Promise.all([
        Promise.all(batch.map((et) => series(id, secid, mod, 2, et).catch(() => []))),
        metric === "wind" ? Promise.all(batch.map((et) => series(id, secid, GUST_MOD, 2, et).catch(() => []))) : Promise.resolve([]),
      ]);
      main.push(...bMain.flat());
      gust.push(...bGust.flat());
      if (i + 3 < months.length) await sleep(150);
    }

    const gustByT = new Map(gust.filter((p) => p.t).map((p) => [p.t, p.value]));
    const byT = new Map();
    main.forEach((p) => {
      if (p.t) byT.set(p.t, { ...p, ...(metric === "wind" ? { max: gustByT.get(p.t) ?? null } : {}) });
    });
    const first = dateKey(from);
    const last = dateKey(to);
    const points = [...byT.values()]
      .filter((p) => p.t.slice(0, 10) >= first && p.t.slice(0, 10) <= last)
      .sort((a, b) => a.t.localeCompare(b.t));
    return { resolution: "daily", points, source: "awekas" };
  });
}
