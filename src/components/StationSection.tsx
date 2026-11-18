"use client";

import { useEffect, useState } from "react";
import { Camera, CloudLightning, ExternalLink, History, Map, Newspaper, PlayCircle, Radio, BarChart3, CloudSun } from "lucide-react";
import { SITE_LINKS, type WeatherLocation } from "@/lib/locations";
import { Card } from "./ui";
import { CollapsibleSection } from "./CollapsibleSection";
import { useLang } from "@/lib/i18n";

const SERVICES = [
  { href: SITE_LINKS.webcams, icon: Camera, title: ["Webcams", "Webcams"], text: ["Live-Bilder aus dem Strudengau", "Live images from the Strudengau"] },
  { href: SITE_LINKS.radar, icon: CloudLightning, title: ["Radar & Blitze", "Radar & lightning"], text: ["Niederschlagsradar und Blitzortung", "Precipitation radar and lightning detection"] },
  { href: SITE_LINKS.livemap, icon: Map, title: ["Livekarte", "Live map"], text: ["Alle Stationen auf einen Blick", "All stations at a glance"] },
  { href: SITE_LINKS.forecast, icon: CloudSun, title: ["Regionalprognose", "Regional forecast"], text: ["Vorhersage der Wetter-Strudengau-Redaktion", "Forecast by the Wetter Strudengau team"] },
  { href: SITE_LINKS.statistics, icon: BarChart3, title: "Statistik", text: "Niederschlag, Temperatur, Sonnenschein" },
  { href: SITE_LINKS.extremes, icon: History, title: ["Extremereignisse", "Extreme events"], text: ["Chronik seit 1940", "Chronicle since 1940"] },
  { href: SITE_LINKS.news, icon: Newspaper, title: ["Wetterberichte", "Weather reports"], text: ["Monats- und Saisonrückblicke", "Monthly and seasonal reviews"] },
  { href: SITE_LINKS.media, icon: PlayCircle, title: ["Bilder & Videos", "Photos & videos"], text: ["Gewitter, Hochwasser, Schnee & mehr", "Storms, floods, snow & more"] },
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
  const { t, lang } = useLang();
  return (
    <CollapsibleSection
      id="station"
      eyebrow={t("Über die Station", "About the station")}
      title={location.kind === "station" ? t(`Wetterstation ${location.name}`, `Weather station ${location.name}`) : location.name}
    >

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          {location.awekasId ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <h3 className="font-medium text-white">{t("Live-Messwerte der Station", "Live station readings")}</h3>
              </div>
              <p className="mb-4 text-sm text-slate-400">
                {t(
                  `Original-Messwerte der Station über das offizielle AWEKAS-Widget (Station ${location.awekasId}). Werte oben auf der Seite stammen aus Wettermodellen für denselben Standort.`,
                  `Original station readings via the official AWEKAS widget (station ${location.awekasId}). Values at the top of the page come from weather models for the same location.`,
                )}
              </p>
              <div className="mx-auto max-w-[400px] overflow-hidden rounded-xl bg-white">
                <iframe
                  key={tick}
                  title={`AWEKAS Wetterstation ${location.name}`}
                  src={`https://widget.awekas.at/widget4.php?id=${location.awekasId}&lng=${lang}&uni=c&wuni=km&rad=0&bg=%23ffffffff&co=%23000000ff&bo=%23ffffff00`}
                  className="mx-auto block h-[190px] w-full max-w-[400px] border-0"
                  loading="lazy"
                />
              </div>
            </>
          ) : (
            <>
              <h3 className="mb-2 flex items-center gap-2 font-medium text-white"><Radio className="h-4 w-4 text-sky-300" /> {t("Datenquelle", "Data source")}</h3>
              <p className="text-sm text-slate-400">
                {t(
                  "Für diesen Standort ist noch kein Live-Widget einer Messstation hinterlegt. Alle Werte stammen aus hochauflösenden Wettermodellen (Open-Meteo) für die Koordinaten des Standorts.",
                  "No live widget of a measuring station is set up for this location yet. All values come from high-resolution weather models (Open-Meteo) for the location's coordinates.",
                )}
              </p>
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-medium text-white">{t("Stationsdaten", "Station details")}</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-400">{t("Standort", "Location")}</dt>
              <dd className="text-white">{location.name}</dd>
              <dt className="text-slate-400">{t("Region", "Region")}</dt>
              <dd className="text-white">{location.region}</dd>
              <dt className="text-slate-400">{t("Koordinaten", "Coordinates")}</dt>
              <dd className="tabular-nums text-white">{location.latitude.toFixed(4)}° N, {location.longitude.toFixed(4)}° {t("O", "E")}</dd>
              {(location.elevation ?? elevation) != null && (
                <>
                  <dt className="text-slate-400">
                    {location.elevation != null ? t("Seehöhe (Station)", "Elevation (station)") : t("Seehöhe (Modell)", "Elevation (model)")}
                  </dt>
                  <dd className="text-white">{Math.round(location.elevation ?? elevation ?? 0)} m</dd>
                </>
              )}
              <dt className="text-slate-400">{t("Messnetz", "Network")}</dt>
              <dd className="text-white">{location.kind === "station" ? "Wetter Strudengau" : "–"}</dd>
            </dl>
            {location.sourceUrl && (
              <a href={location.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-sky-300 hover:text-sky-200">
                {t("Originalseite auf wetter-strudengau.at", "Original page on wetter-strudengau.at")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {SERVICES.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-sky-400/40"
              >
                <s.icon className="h-5 w-5 text-sky-300" />
                <p className="mt-2 text-sm font-medium text-white">{t(s.title[0], s.title[1])}</p>
                <p className="text-xs text-slate-400">{t(s.text[0], s.text[1])}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
