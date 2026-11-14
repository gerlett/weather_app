"use client";

import type { ReactNode } from "react";
import { Mail, Phone } from "lucide-react";
import { useLocations } from "@/hooks/useLocations";
import { SITE_LINKS, type WeatherLocation } from "@/lib/locations";
import { LocationBar } from "./LocationBar";
import { RateLimitBanner } from "./RateLimitBanner";

type Loc = ReturnType<typeof useLocations>;

/** Header (location selection) + footer shared by all pages. */
export function AppShell({ children }: { children: (selected: WeatherLocation, loc: Loc) => ReactNode }) {
  const loc = useLocations();
  return (
    <div id="top" className="min-h-screen">
      <LocationBar
        selected={loc.selected}
        favorites={loc.favorites}
        onSelect={loc.select}
        isFavorite={loc.isFavorite}
        toggleFavorite={loc.toggleFavorite}
        geo={loc.geo}
        onLocate={loc.locate}
      />
      <main className="mx-auto max-w-7xl space-y-14 px-4 py-6 sm:px-6 sm:py-10">{children(loc.selected, loc)}</main>
      <RateLimitBanner />
      <footer className="mt-10 border-t border-white/10 bg-slate-950/60">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-slate-400 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-semibold text-white">Wetter Strudengau</p>
            <p className="mt-1">Information bei jedem Wetter!</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-white">Kontakt</p>
            <a href="tel:+436641673157" className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4" /> +43 (0)664 / 16 73 157</a>
            <a href="mailto:office@wetter-strudengau.at" className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4" /> office@wetter-strudengau.at</a>
            <a href={SITE_LINKS.imprint} target="_blank" rel="noopener noreferrer" className="block hover:text-white">Impressum</a>
          </div>
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-white">Datenquellen</p>
            <p>Stationsmesswerte: <a className="underline hover:text-white" href="https://www.awekas.at" target="_blank" rel="noopener noreferrer">AWEKAS</a> (offizielles Widget)</p>
            <p>Modell-, Prognose- und Archivdaten: <a className="underline hover:text-white" href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> (CC BY 4.0)</p>
            <p>Standort & Favoriten werden nur lokal in Ihrem Browser gespeichert.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
