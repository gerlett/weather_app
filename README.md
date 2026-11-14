# Wetter Strudengau – Wetterstation Perg/Thurnhof

Modern, mobile-first weather dashboard replacing
<https://www.wetter-strudengau.at/wetter-news/wetterstation-pergturnhof/>.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Recharts · lucide-react
**No database / no backend** in v1 – everything is fetched client-side, preferences live in `localStorage`.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

The build is fully static (`○ /`), so it can be hosted on Vercel, Netlify or any static web space.

## Features

| Section | Content |
| --- | --- |
| **Aktuell** | Temperature, feels-like, dew point, wind (speed, gusts, direction, Beaufort), precipitation today, pressure + 3 h trend, humidity, cloud cover, UV, sunshine, sunrise/sunset |
| **Vorhersage** | 48 h chart (temperature, feels-like, precipitation) with icon strip, 7-day forecast |
| **Verlauf** | 24 h / 7 d / 30 d / 12 months / any year since 1940 / custom date range · temperature, rain, wind, pressure, humidity · overlay up to 4 locations · statistics · wind rose |
| **Auswertung** (`/auswertung` + compact on home) | Any measurement (temperature, feels-like, dew point, rain, snow, humidity, pressure, wind, gusts, clouds, sunshine, radiation) for a free start/end date-time back to 1940 · interval 1 h / 3 h / 6 h / 12 h / day / week / month / year · sums + cumulative for rain/snow/sun, min/max/average for all others · KPIs, table, CSV export · multiple panels side by side |
| **Klima** | Climate calendar (each day of a year, temperature or rain), annual records (hottest/coldest/wettest day, strongest gust, frost/summer/hot days), 5-year comparison against the 1991–2020 normal |
| **Station** | Official AWEKAS live widget (station 12182), station data, links to all services of wetter-strudengau.at (webcams, radar, live map, statistics, extremes, reports, media) |

### Location handling
- On first start the browser asks for **location access**; the **nearest Strudengau station** is selected.
  If the nearest station is > 25 km away, the visitor's own coordinates are used (model data).
- If access is denied, **Perg/Thurnhof** is the default.
- A location picked manually is remembered and preferred on the next visit; the 📍 button re-locates at any time.
- Favourites (★) and worldwide place search (Open-Meteo geocoding), stored only in the browser.

## Data sources

- **AWEKAS** – real station measurements, shown only via the official widget (the widget terms forbid scraping its values).
  For native charts of the *station's own* readings, AWEKAS API access by the station operator is required.
- **Open-Meteo** (CC BY 4.0, no API key) – current conditions & forecast (`api.open-meteo.com`),
  history since 1940 from ERA5 reanalysis (`archive-api.open-meteo.com`, ~5 days delay), geocoding.
  These are **model / grid data for the station coordinates, not station measurements** – the UI labels them as such.
  Missing values are shown as gaps, never interpolated.

### API limits (Open-Meteo free tier)

600 calls/min · 5 000/h · 10 000/day **per visitor IP**; a request covering more than 2 weeks counts as
several calls (≈ 1 call per 14 days). To stay within that:

- **Climate normals 1991–2020** (≈ 780 calls per station) are pre-computed and shipped as static
  [`src/data/normals.json`](src/data/normals.json):
  ```bash
  node scripts/build-normals.ts               # stations missing from the file
  node scripts/build-normals.ts --all         # recompute all (max ~6 stations per hour)
  ```
- Archive data older than 7 days is cached in the visitor's browser (`localStorage`, prefix `om1:`).
- Sections below the fold load only when scrolled into view.
- On HTTP 429 all requests pause and retry automatically; a banner shows the countdown.
- For heavy commercial traffic, an Open-Meteo API subscription removes these limits.

## Deployment

Same pattern as `../fotografie_crm/tool/deploy-web.sh`: nginx serves the static export from a
bind-mounted `html/`, cloudflared publishes it, stack lives in `/docker/apps/wetter-strudengau/`
on `192.168.178.95`, LAN port **8883**.

```bash
./deploy-web.sh                 # lint + build + deploy (provisions the stack on the first run)
./deploy-web.sh --skip-build    # deploy the existing out/
./deploy-web.sh --update-stack  # also push deploy/docker-compose.yaml + nginx.conf (backs up host copies)
```

**Cloudflare tunnel:** create a tunnel in Zero Trust → Networks → Tunnels, copy its token into
`deploy/.env` (from `deploy/.env.example`), run `./deploy-web.sh` again – the missing `.env` is
installed on the host and the tunnel container starts. In the dashboard point the public hostname
at `http://wetter-strudengau:80`. Without a token only the LAN site runs.

Note: browsers allow location access only on HTTPS (or localhost) – the nearest-station detection
works via the public hostname https://wetter.softwarekstatt.at, not on `http://192.168.178.95:8883`.

### Version & changelog

Same scheme as the CRM. The version is `<major>.<minor>.<patch>`: major, minor and an
**offset** come from `version.json`, the patch is `git rev-list --count HEAD − offset` – it rises
with every commit, nothing is bumped by hand. `deploy-web.sh` builds it in together with the
commit hash (`-dirty` for uncommitted changes); the footer shows e.g. `Version 0.1.3 (a1b2c3d)`,
`/version.json` carries it too. A bare `npm run dev`/`build` is labelled "Entwicklungsversion".

```bash
node scripts/app-version.ts               # version of the checked-out commit
node scripts/app-version.ts --start 0.2   # next commit becomes 0.2.0 (commit version.json)
```

The changelog lives in `deploy/changelog/changelog.json`, **outside the build**: nginx serves it at
`/changelog/` from a directory beside `html/`. Write an entry after a deploy, using the version the
footer shows, then `./deploy-changelog.sh` (no rebuild). The site lists all releases with a search
on `/aenderungen`, and returning visitors see a "Neu auf der Website" card once per new release
(never for releases newer than the running build). Details: `deploy/changelog/README.md`.

## Server-side API proxy & Home Assistant

```
browser ──/api/om/*──► nginx (cache) ──► Open-Meteo        one shared cache for all visitors
wetter-bridge ─────────► nginx (cache)                       + stale answers on 429/outages
wetter-bridge ──MQTT discovery──► Mosquitto ──► Home Assistant
```

- **`/api/om/forecast|archive|geocoding`** – same-origin caching proxy (forecast 60 s, archive 12 h,
  geocoding 7 d, `X-Cache-Status` header). Deployed builds use it automatically
  (`NEXT_PUBLIC_OM_PROXY=/api/om`); `npm run dev` still calls Open-Meteo directly.
- **`wetter-bridge`** ([deploy/bridge/](deploy/bridge/)) – stateless Node service, no database:
  - publishes one **Home Assistant device per station** via MQTT device discovery with ~25 sensors
    (temperature, feels-like, dew point, humidity, pressure + tendency, wind/gusts/direction/Beaufort,
    rain now/today/forecast, rain probability, clouds, UV, condition, today's min/max, sunshine,
    sunrise/sunset) and `sensor.wetter_<station>_forecast` with `daily`/`hourly` attributes,
  - `GET /api/ha/` status · `/api/ha/<station>.json` full state · `/api/ha/homeassistant.yaml`
    ready-made HA package with one `weather.*` entity per station (works with the standard weather card).

**Enable MQTT:** create a broker user (password stays with you), then fill `deploy/.env.bridge`
(from `.env.bridge.example`) and run `./deploy-web.sh --skip-build`:

```bash
docker exec -it mosquitto mosquitto_passwd /mosquitto/config/mosquitto.passwd wetter-bridge
docker kill -s HUP mosquitto
```

**Weather entities:** save `/api/ha/homeassistant.yaml` as `<ha-config>/packages/wetter_strudengau.yaml`,
add `homeassistant: packages: !include_dir_named packages` to `configuration.yaml`, restart HA.

## Configuration

Stations are defined in [`src/lib/locations.ts`](src/lib/locations.ts). Add the `awekasId` of further
stations to show their live widget too.
