"use client";

import { useEffect, useState } from "react";
import { Camera, CloudLightning, ExternalLink, History, Map, Newspaper, PlayCircle, Radio, BarChart3, CloudSun } from "lucide-react";
import { SITE_LINKS, type WeatherLocation } from "@/lib/locations";
import { Card, SectionTitle } from "./ui";

const SERVICES = [
  { href: SITE_LINKS.webcams, icon: Camera, title: "Webcams", text: "Live-Bilder aus dem Strudengau" },
  { href: SITE_LINKS.radar, icon: CloudLightning, title: "Radar & Blitze", text: "Niederschlagsradar und Blitzortung" },
  { href: SITE_LINKS.livemap, icon: Map, title: "Livekarte", text: "Alle Stationen auf einen Blick" },
  { href: SITE_LINKS.forecast, icon: CloudSun, title: "Regionalprognose", text: "Vorhersage der Wetter-Strudengau-Redaktion" },
  { href: SITE_LINKS.statistics, icon: BarChart3, title: "Statistik", text: "Niederschlag, Temperatur, Sonnenschein" },
  { href: SITE_LINKS.extremes, icon: History, title: "Extremereignisse", text: "Chronik seit 1940" },
  { href: SITE_LINKS.news, icon: Newspaper, title: "Wetterberichte", text: "Monats- und Saisonrückblicke" },
  { href: SITE_LINKS.media, icon: PlayCircle, title: "Bilder & Videos", text: "Gewitter, Hochwasser, Schnee & mehr" },
];

/** AWEKAS stations upload about every 5 minutes – reload the widget at that pace while the tab is visible. */
const WIDGET_REFRESH_MS = 5 * 60_000;

function useWidgetTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && setTick((t) => t + 1), WIDGET_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return tick;
}

export function StationSection({ location, elevation }: { location: WeatherLocation; elevation?: number }) {
  const tick = useWidgetTick();
  return (
    <section id="station" className="scroll-mt-24">
      <SectionTitle eyebrow="Über die Station" title={location.kind === "station" ? `Wetterstation ${location.name}` : location.name} />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          {location.awekasId ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <h3 className="font-medium text-white">Live-Messwerte der Station</h3>
              </div>
              <p className="mb-4 text-sm text-slate-400">
                Original-Messwerte der Station über das offizielle AWEKAS-Widget (Station {location.awekasId}).
                Werte oben auf der Seite stammen aus Wettermodellen für denselben Standort.
              </p>
              <div className="mx-auto max-w-[400px] overflow-hidden rounded-xl bg-white">
                <iframe
                  key={tick}
                  title={`AWEKAS Wetterstation ${location.name}`}
                  src={`https://widget.awekas.at/widget4.php?id=${location.awekasId}&lng=de&uni=c&wuni=km&rad=0&bg=%23ffffffff&co=%23000000ff&bo=%23ffffff00`}
                  className="mx-auto block h-[190px] w-full max-w-[400px] border-0"
                  loading="lazy"
                />
              </div>
            </>
          ) : (
            <>
              <h3 className="mb-2 flex items-center gap-2 font-medium text-white"><Radio className="h-4 w-4 text-sky-300" /> Datenquelle</h3>
              <p className="text-sm text-slate-400">
                Für diesen Standort ist noch kein Live-Widget einer Messstation hinterlegt. Alle Werte stammen aus hochauflösenden
                Wettermodellen (Open-Meteo) für die Koordinaten des Standorts. Sobald die AWEKAS-Stations-ID bekannt ist, kann sie in
                <code className="mx-1 rounded bg-white/10 px-1 text-xs">src/lib/locations.ts</code> ergänzt werden.
              </p>
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-medium text-white">Stationsdaten</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-400">Standort</dt>
              <dd className="text-white">{location.name}</dd>
              <dt className="text-slate-400">Region</dt>
              <dd className="text-white">{location.region}</dd>
              <dt className="text-slate-400">Koordinaten</dt>
              <dd className="tabular-nums text-white">{location.latitude.toFixed(4)}° N, {location.longitude.toFixed(4)}° O</dd>
              {elevation != null && (
                <>
                  <dt className="text-slate-400">Seehöhe (Modell)</dt>
                  <dd className="text-white">{Math.round(elevation)} m</dd>
                </>
              )}
              <dt className="text-slate-400">Messnetz</dt>
              <dd className="text-white">{location.kind === "station" ? "Wetter Strudengau" : "–"}</dd>
            </dl>
            {location.sourceUrl && (
              <a href={location.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-sky-300 hover:text-sky-200">
                Originalseite auf wetter-strudengau.at <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {SERVICES.map((s) => (
              <a
                key={s.title}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-sky-400/40"
              >
                <s.icon className="h-5 w-5 text-sky-300" />
                <p className="mt-2 text-sm font-medium text-white">{s.title}</p>
                <p className="text-xs text-slate-400">{s.text}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
