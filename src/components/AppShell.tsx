"use client";

import type { ReactNode } from "react";
import { useLocations } from "@/hooks/useLocations";
import type { WeatherLocation } from "@/lib/locations";
import { Imprint } from "./Imprint";
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
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-8 text-xs text-slate-400 sm:px-6">
          <p className="font-semibold text-white">Datenquellen</p>
          <p>Stationsmesswerte: <a className="underline hover:text-white" href="https://www.awekas.at" target="_blank" rel="noopener noreferrer">AWEKAS</a> (offizielles Widget)</p>
          <p>Modell-, Prognose- und Archivdaten: <a className="underline hover:text-white" href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> (CC BY 4.0)</p>
          <p>Standort & Favoriten werden nur lokal in Ihrem Browser gespeichert.</p>
        </div>
        <Imprint />
      </footer>
    </div>
  );
}
