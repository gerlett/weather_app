/**
 * wetter-bridge – Home Assistant integration for the Wetter Strudengau website.
 *
 * - Polls Open-Meteo through the site's caching nginx proxy (shared cache with all visitors).
 * - Publishes every station to MQTT with Home Assistant *device discovery*:
 *   one HA device per station, ~25 sensors, plus a forecast sensor whose attributes carry
 *   hourly + daily forecasts in HA's weather-forecast format.
 * - Serves the latest state as JSON (/api/ha/<station>.json via nginx) and a ready-made
 *   HA package with weather entities (/api/ha/homeassistant.yaml).
 *
 * Stateless: no database, everything lives in memory and is rebuilt on start.
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import mqtt from "mqtt";

const env = process.env;
const VERSION = env.BRIDGE_VERSION || "1.0.0";
const OM_BASE = (env.OM_BASE || "http://wetter-strudengau/api/om").replace(/\/$/, "");
const PUBLIC_URL = env.PUBLIC_URL || "https://wetter.softwarekstatt.at";
const PREFIX = env.DISCOVERY_PREFIX || "homeassistant";
const BASE = env.MQTT_BASE_TOPIC || "wetter_strudengau";
const CURRENT_MS = (Number(env.CURRENT_INTERVAL_S) || 300) * 1000;
const FORECAST_MS = (Number(env.FORECAST_INTERVAL_S) || 900) * 1000;
const PORT = Number(env.PORT) || 3000;

const ALL = JSON.parse(readFileSync(new URL("./stations.json", import.meta.url), "utf8"));
const wanted = (env.STATIONS || "").split(",").map((s) => s.trim()).filter(Boolean);
const STATIONS = wanted.length ? ALL.filter((s) => wanted.includes(s.id)) : ALL;
if (!STATIONS.length) throw new Error(`STATIONS=${env.STATIONS} matches none of: ${ALL.map((s) => s.id).join(", ")}`);

const log = (...a) => console.log(new Date().toISOString(), ...a);
const slug = (id) => id.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// ------------------------------------------------------------------ weather helpers

const COMPASS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg) => (deg == null ? null : COMPASS[Math.round(deg / 22.5) % 16]);
const beaufort = (kmh) => {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const i = limits.findIndex((l) => kmh < l);
  return i === -1 ? 12 : i;
};

/** WMO weather code → Home Assistant weather condition */
function haCondition(code, isDay = true) {
  if (code == null) return null;
  if (code <= 1) return isDay ? "sunny" : "clear-night";
  if (code === 2) return "partlycloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([56, 57, 66, 67].includes(code)) return "snowy-rainy";
  if (code === 65 || code === 82) return "pouring";
  if (code >= 51 && code <= 82 && !(code >= 71 && code <= 77)) return "rainy";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snowy";
  if (code === 95) return "lightning-rainy";
  if (code === 96 || code === 99) return "hail";
  return "exceptional";
}
const HA_CONDITIONS = ["clear-night", "cloudy", "exceptional", "fog", "hail", "lightning", "lightning-rainy", "partlycloudy", "pouring", "rainy", "snowy", "snowy-rainy", "sunny", "windy", "windy-variant"];

const WMO_DE = {
  0: "Klar", 1: "Überwiegend klar", 2: "Teilweise bewölkt", 3: "Bedeckt", 45: "Nebel", 48: "Raureifnebel",
  51: "Leichter Nieselregen", 53: "Nieselregen", 55: "Starker Nieselregen", 56: "Gefrierender Niesel", 57: "Gefrierender Niesel",
  61: "Leichter Regen", 63: "Regen", 65: "Starker Regen", 66: "Gefrierender Regen", 67: "Gefrierender Regen",
  71: "Leichter Schneefall", 73: "Schneefall", 75: "Starker Schneefall", 77: "Schneegriesel",
  80: "Regenschauer", 81: "Regenschauer", 82: "Heftige Schauer", 85: "Schneeschauer", 86: "Starke Schneeschauer",
  95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Schweres Gewitter mit Hagel",
};

/** Open-Meteo local time ("2026-11-14T09:00") + utc offset → ISO with offset (HA needs tz-aware times) */
function isoLocal(t, offsetSec) {
  if (!t) return null;
  const sign = offsetSec >= 0 ? "+" : "-";
  const a = Math.abs(offsetSec);
  const off = `${sign}${String(Math.floor(a / 3600)).padStart(2, "0")}:${String(Math.floor((a % 3600) / 60)).padStart(2, "0")}`;
  return `${t.length === 10 ? `${t}T00:00` : t}:00${off}`;
}

// ------------------------------------------------------------------ data

const CURRENT_VARS =
  "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,uv_index";

/** One retry on network errors and 5xx (e.g. a transient upstream TLS timeout behind nginx). */
async function getJson(path, attempt = 1) {
  try {
    const res = await fetch(`${OM_BASE}${path}`, { headers: { "user-agent": `wetter-bridge/${VERSION}` }, signal: AbortSignal.timeout(60_000) });
    if (res.ok) return res.json();
    const body = (await res.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    const err = new Error(`HTTP ${res.status}: ${body}`);
    err.retry = res.status >= 500;
    throw err;
  } catch (e) {
    if (attempt < 2 && e.retry !== false) {
      await sleep(5_000);
      return getJson(path, attempt + 1);
    }
    throw e;
  }
}

const qs = (o) => new URLSearchParams(o).toString();

function fetchForecast(s) {
  return getJson(
    "/forecast?" +
      qs({
        latitude: s.latitude,
        longitude: s.longitude,
        timezone: "auto",
        past_days: 1,
        forecast_days: 8,
        current: CURRENT_VARS,
        hourly: "temperature_2m,precipitation,precipitation_probability,weather_code,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,cloud_cover,uv_index,is_day,apparent_temperature,dew_point_2m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,sunshine_duration,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
      }),
  );
}

function fetchCurrent(s) {
  return getJson("/forecast?" + qs({ latitude: s.latitude, longitude: s.longitude, timezone: "auto", current: CURRENT_VARS }));
}

/** Everything HA needs for one station, derived from a full forecast + the newest current block. */
function buildState(s, f, current) {
  const c = current ?? f.current;
  const off = f.utc_offset_seconds ?? 0;
  const { hourly: h, daily: d } = f;
  const today = c.time.slice(0, 10);
  const di = Math.max(0, d.time.indexOf(today));
  const nowTs = Date.parse(isoLocal(c.time, off));
  const hTs = h.time.map((t) => Date.parse(isoLocal(t, off)));

  let rainToday = 0;
  h.time.forEach((t, i) => {
    if (t.startsWith(today) && hTs[i] <= nowTs) rainToday += h.precipitation[i] ?? 0;
  });
  const hi = hTs.findIndex((ts) => ts > nowTs) - 1;
  const p3 = h.pressure_msl[hi - 3];
  const trend = p3 == null ? null : c.pressure_msl - p3;

  const state = {
    station: s.id,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    elevation: f.elevation,
    value_time: isoLocal(c.time, off),
    updated: new Date().toISOString(),
    temperature: c.temperature_2m,
    apparent_temperature: c.apparent_temperature,
    dew_point: c.dew_point_2m,
    humidity: c.relative_humidity_2m,
    pressure: c.pressure_msl,
    pressure_trend: r1(trend),
    pressure_tendency: trend == null ? null : trend > 0.5 ? "steigend" : trend < -0.5 ? "fallend" : "gleichbleibend",
    wind_speed: c.wind_speed_10m,
    wind_gusts: c.wind_gusts_10m,
    wind_bearing: c.wind_direction_10m,
    wind_direction: compass(c.wind_direction_10m),
    beaufort: beaufort(c.wind_speed_10m),
    precipitation: c.precipitation,
    rain_today: r1(rainToday),
    cloud_cover: c.cloud_cover,
    uv_index: c.uv_index ?? h.uv_index[hi] ?? null,
    weather_code: c.weather_code,
    condition: haCondition(c.weather_code, c.is_day === 1),
    condition_text: WMO_DE[c.weather_code] ?? "Unbekannt",
    is_day: c.is_day === 1,
    temp_max_today: d.temperature_2m_max[di],
    temp_min_today: d.temperature_2m_min[di],
    precipitation_forecast_today: d.precipitation_sum[di],
    precipitation_probability_today: d.precipitation_probability_max[di],
    sunshine_today: r1((d.sunshine_duration[di] ?? 0) / 3600),
    uv_index_max_today: d.uv_index_max[di],
    sunrise: isoLocal(d.sunrise[di], off),
    sunset: isoLocal(d.sunset[di], off),
    source: "Open-Meteo (Modelldaten, CC BY 4.0)",
    url: PUBLIC_URL,
  };

  const daily = d.time
    .map((t, i) => ({
      datetime: isoLocal(t, off),
      condition: haCondition(d.weather_code[i], true),
      temperature: d.temperature_2m_max[i],
      templow: d.temperature_2m_min[i],
      precipitation: d.precipitation_sum[i],
      precipitation_probability: d.precipitation_probability_max[i],
      wind_speed: d.wind_speed_10m_max[i],
      wind_gust_speed: d.wind_gusts_10m_max[i],
      wind_bearing: d.wind_direction_10m_dominant[i],
      uv_index: d.uv_index_max[i],
    }))
    .filter((x) => x.datetime.slice(0, 10) >= today);

  const start = Math.max(0, hi);
  const hourly = h.time.slice(start, start + 48).map((t, k) => {
    const i = start + k;
    return {
      datetime: isoLocal(t, off),
      condition: haCondition(h.weather_code[i], h.is_day[i] === 1),
      temperature: h.temperature_2m[i],
      apparent_temperature: h.apparent_temperature[i],
      dew_point: h.dew_point_2m[i],
      humidity: h.relative_humidity_2m[i],
      pressure: h.pressure_msl[i],
      precipitation: h.precipitation[i],
      precipitation_probability: h.precipitation_probability[i],
      wind_speed: h.wind_speed_10m[i],
      wind_gust_speed: h.wind_gusts_10m[i],
      wind_bearing: h.wind_direction_10m[i],
      cloud_coverage: h.cloud_cover[i],
      uv_index: h.uv_index[i],
    };
  });

  return { state, forecast: { daily, hourly, tomorrow: daily[1]?.condition ?? null, updated: state.updated } };
}

// ------------------------------------------------------------------ HA discovery

const devId = (s) => `${BASE}_${slug(s.id)}`;
const entityBase = (s) => `wetter_${slug(s.id)}`;
const topic = (s, kind) => `${BASE}/${slug(s.id)}/${kind}`;
const AVAIL = `${BASE}/bridge/status`;

/** [key, German name, extra discovery options] – key is the JSON field in the state payload */
const SENSORS = [
  ["temperature", "Temperatur", { device_class: "temperature", unit_of_measurement: "°C", state_class: "measurement", suggested_display_precision: 1 }],
  ["apparent_temperature", "Gefühlte Temperatur", { device_class: "temperature", unit_of_measurement: "°C", state_class: "measurement", suggested_display_precision: 1 }],
  ["dew_point", "Taupunkt", { device_class: "temperature", unit_of_measurement: "°C", state_class: "measurement", suggested_display_precision: 1 }],
  ["humidity", "Luftfeuchte", { device_class: "humidity", unit_of_measurement: "%", state_class: "measurement" }],
  ["pressure", "Luftdruck", { device_class: "atmospheric_pressure", unit_of_measurement: "hPa", state_class: "measurement", suggested_display_precision: 1 }],
  ["pressure_trend", "Luftdrucktendenz 3 h", { unit_of_measurement: "hPa", state_class: "measurement", icon: "mdi:trending-up", suggested_display_precision: 1 }],
  ["pressure_tendency", "Luftdrucktendenz", { icon: "mdi:gauge" }],
  ["wind_speed", "Windgeschwindigkeit", { device_class: "wind_speed", unit_of_measurement: "km/h", state_class: "measurement", suggested_display_precision: 1 }],
  ["wind_gusts", "Windböen", { device_class: "wind_speed", unit_of_measurement: "km/h", state_class: "measurement", suggested_display_precision: 1 }],
  ["wind_bearing", "Windrichtung Grad", { unit_of_measurement: "°", state_class: "measurement", icon: "mdi:compass-outline" }],
  ["wind_direction", "Windrichtung", { icon: "mdi:compass" }],
  ["beaufort", "Windstärke", { unit_of_measurement: "Bft", state_class: "measurement", icon: "mdi:weather-windy" }],
  ["precipitation", "Niederschlag aktuell", { device_class: "precipitation_intensity", unit_of_measurement: "mm/h", state_class: "measurement", suggested_display_precision: 1 }],
  ["rain_today", "Niederschlag heute", { device_class: "precipitation", unit_of_measurement: "mm", state_class: "total_increasing", suggested_display_precision: 1 }],
  ["precipitation_forecast_today", "Niederschlag Prognose heute", { device_class: "precipitation", unit_of_measurement: "mm", suggested_display_precision: 1 }],
  ["precipitation_probability_today", "Regenwahrscheinlichkeit heute", { unit_of_measurement: "%", state_class: "measurement", icon: "mdi:umbrella-outline" }],
  ["cloud_cover", "Bewölkung", { unit_of_measurement: "%", state_class: "measurement", icon: "mdi:cloud-percent" }],
  ["uv_index", "UV-Index", { unit_of_measurement: "UV index", state_class: "measurement", icon: "mdi:sun-wireless", suggested_display_precision: 1 }],
  ["condition", "Zustand", { device_class: "enum", options: HA_CONDITIONS, icon: "mdi:weather-partly-cloudy" }],
  ["condition_text", "Wetterlage", { icon: "mdi:weather-cloudy-clock" }],
  ["temp_max_today", "Höchsttemperatur heute", { device_class: "temperature", unit_of_measurement: "°C", suggested_display_precision: 1 }],
  ["temp_min_today", "Tiefsttemperatur heute", { device_class: "temperature", unit_of_measurement: "°C", suggested_display_precision: 1 }],
  ["sunshine_today", "Sonnenscheindauer heute", { device_class: "duration", unit_of_measurement: "h", suggested_display_precision: 1 }],
  ["sunrise", "Sonnenaufgang", { device_class: "timestamp" }],
  ["sunset", "Sonnenuntergang", { device_class: "timestamp" }],
  ["value_time", "Messzeitpunkt", { device_class: "timestamp", entity_category: "diagnostic" }],
];

function discoveryPayload(s) {
  const cmps = {};
  for (const [key, name, extra] of SENSORS) {
    cmps[key] = {
      p: "sensor",
      name,
      unique_id: `${devId(s)}_${key}`,
      default_entity_id: `sensor.${entityBase(s)}_${key}`,
      state_topic: topic(s, "state"),
      value_template: `{{ value_json.${key} if value_json.${key} is not none else None }}`,
      ...extra,
    };
  }
  cmps.forecast = {
    p: "sensor",
    name: "Vorhersage",
    unique_id: `${devId(s)}_forecast`,
    default_entity_id: `sensor.${entityBase(s)}_forecast`,
    state_topic: topic(s, "forecast"),
    value_template: "{{ value_json.tomorrow }}",
    json_attributes_topic: topic(s, "forecast"),
    json_attributes_template: "{{ {'daily': value_json.daily, 'hourly': value_json.hourly} | tojson }}",
    icon: "mdi:calendar-weather",
  };
  return {
    dev: {
      ids: [devId(s)],
      name: `Wetter ${s.name}`,
      mf: "Wetter Strudengau",
      mdl: s.kind === "station" ? "Messnetz-Standort (Modelldaten)" : "Standort (Modelldaten)",
      sw: VERSION,
      cu: s.sourceUrl || PUBLIC_URL,
      sa: s.region,
    },
    o: { name: "wetter-bridge", sw: VERSION, url: PUBLIC_URL },
    availability_topic: AVAIL,
    qos: 1,
    cmps,
  };
}

/** Ready-to-use HA package: one template weather entity per station, built on the MQTT sensors. */
function haPackageYaml() {
  const lines = [
    "# Home Assistant package for Wetter Strudengau (generated by wetter-bridge).",
    "# Save as <config>/packages/wetter_strudengau.yaml and enable packages in configuration.yaml:",
    "#   homeassistant:",
    "#     packages: !include_dir_named packages",
    "# The sensors themselves arrive automatically via MQTT discovery.",
    "template:",
    "  - weather:",
  ];
  for (const s of STATIONS) {
    const e = (k) => `sensor.${entityBase(s)}_${k}`;
    const num = (k) => `"{{ states('${e(k)}') | float(none) }}"`;
    lines.push(
      `      - name: "Wetter ${s.name}"`,
      `        unique_id: ${devId(s)}_weather`,
      `        condition_template: "{{ states('${e("condition")}') }}"`,
      `        temperature_template: ${num("temperature")}`,
      `        apparent_temperature_template: ${num("apparent_temperature")}`,
      `        dew_point_template: ${num("dew_point")}`,
      `        humidity_template: ${num("humidity")}`,
      `        pressure_template: ${num("pressure")}`,
      `        wind_speed_template: ${num("wind_speed")}`,
      `        wind_gust_speed_template: ${num("wind_gusts")}`,
      `        wind_bearing_template: ${num("wind_bearing")}`,
      `        cloud_coverage_template: ${num("cloud_cover")}`,
      `        uv_index_template: ${num("uv_index")}`,
      `        forecast_daily_template: "{{ state_attr('${e("forecast")}', 'daily') or [] }}"`,
      `        forecast_hourly_template: "{{ state_attr('${e("forecast")}', 'hourly') or [] }}"`,
      `        temperature_unit: "°C"`,
      `        pressure_unit: "hPa"`,
      `        wind_speed_unit: "km/h"`,
      `        precipitation_unit: "mm"`,
      `        attribution_template: "Open-Meteo · Wetter Strudengau"`,
    );
  }
  return lines.join("\n") + "\n";
}

// ------------------------------------------------------------------ MQTT

let client = null;
const mqttConfigured = !!env.MQTT_URL;

function publish(t, payload) {
  if (client?.connected) client.publish(t, typeof payload === "string" ? payload : JSON.stringify(payload), { qos: 1, retain: true });
}

function publishDiscovery() {
  for (const s of STATIONS) publish(`${PREFIX}/device/${devId(s)}/config`, discoveryPayload(s));
  publish(AVAIL, "online");
  for (const s of STATIONS) {
    const d = latest.get(s.id);
    if (d) {
      publish(topic(s, "state"), d.state);
      publish(topic(s, "forecast"), d.forecast);
    }
  }
  log(`discovery published for ${STATIONS.length} station(s)`);
}

if (mqttConfigured) {
  client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USERNAME || undefined,
    password: env.MQTT_PASSWORD || undefined,
    clientId: `wetter-bridge-${Math.random().toString(16).slice(2, 8)}`,
    will: { topic: AVAIL, payload: "offline", qos: 1, retain: true },
    reconnectPeriod: 10_000,
  });
  client.on("connect", () => {
    log(`MQTT connected to ${env.MQTT_URL}`);
    client.subscribe(`${PREFIX}/status`); // HA birth message → re-announce after an HA restart
    publishDiscovery();
  });
  client.on("message", (t, m) => {
    if (t === `${PREFIX}/status` && m.toString() === "online") setTimeout(publishDiscovery, 2000 + Math.random() * 3000);
  });
  client.on("error", (e) => log("MQTT error:", e.message));
} else {
  log("MQTT_URL not set – running without MQTT (JSON endpoints only).");
}

// ------------------------------------------------------------------ polling

const latest = new Map(); // station id → { state, forecast, forecastRaw, forecastAt, error }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function updateStation(s) {
  const prev = latest.get(s.id);
  try {
    let raw = prev?.forecastRaw;
    let current = null;
    if (!raw || Date.now() - prev.forecastAt >= FORECAST_MS) {
      raw = await fetchForecast(s);
    } else {
      current = (await fetchCurrent(s)).current;
    }
    const { state, forecast } = buildState(s, raw, current);
    latest.set(s.id, { state, forecast, forecastRaw: raw, forecastAt: current ? prev.forecastAt : Date.now(), error: null });
    publish(topic(s, "state"), state);
    if (!current) publish(topic(s, "forecast"), forecast);
  } catch (e) {
    log(`${s.id}: ${e.message}`);
    if (prev) prev.error = e.message;
  }
}

async function loop() {
  for (;;) {
    const started = Date.now();
    for (const s of STATIONS) {
      await updateStation(s);
      await sleep(1500); // spread the requests
    }
    await sleep(Math.max(5_000, CURRENT_MS - (Date.now() - started)));
  }
}

// ------------------------------------------------------------------ HTTP (behind nginx at /api/ha/)

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (code, body, type = "application/json; charset=utf-8") => {
      res.writeHead(code, { "content-type": type, "access-control-allow-origin": "*" });
      res.end(typeof body === "string" ? body : JSON.stringify(body, null, 1));
    };
    const p = url.pathname.replace(/^\/+/, "");
    if (p === "" || p === "index.json") {
      return send(200, {
        version: VERSION,
        mqtt: mqttConfigured ? (client?.connected ? "connected" : "disconnected") : "not configured",
        stations: STATIONS.map((s) => ({ id: s.id, name: s.name, json: `${s.id}.json`, updated: latest.get(s.id)?.state.updated ?? null, error: latest.get(s.id)?.error ?? null })),
        homeassistant_package: "homeassistant.yaml",
      });
    }
    if (p === "health") return send(latest.size ? 200 : 503, { ok: latest.size > 0 });
    if (p === "homeassistant.yaml") return send(200, haPackageYaml(), "text/yaml; charset=utf-8");
    const m = /^([a-z0-9-]+)(?:\.json)?$/.exec(p);
    const d = m && latest.get(m[1]);
    if (d) return send(200, { ...d.state, forecast: { daily: d.forecast.daily, hourly: d.forecast.hourly } });
    send(404, { error: "unknown station", stations: STATIONS.map((s) => s.id) });
  })
  .listen(PORT, () => log(`wetter-bridge ${VERSION} on :${PORT} – ${STATIONS.length} station(s), current every ${CURRENT_MS / 1000}s, forecast every ${FORECAST_MS / 1000}s`));

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    publish(AVAIL, "offline");
    client?.end(false, {}, () => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  });
}

loop();
