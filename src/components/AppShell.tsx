"use client";

import type { ReactNode } from "react";
import { useLocations } from "@/hooks/useLocations";
import type { WeatherLocation } from "@/lib/locations";
import { displayVersion } from "@/lib/version";
import { LangProvider, useLang } from "@/lib/i18n";
import { Imprint } from "./Imprint";
import { LocationBar } from "./LocationBar";
import { PullToRefresh } from "./PullToRefresh";
import { RateLimitBanner } from "./RateLimitBanner";
import { UpdateWatcher } from "./UpdateWatcher";
import { WhatsNew } from "./WhatsNew";

type Loc = ReturnType<typeof useLocations>;

type ShellProps = {
  children: (selected: WeatherLocation, loc: Loc) => ReactNode;
  /** the "Neu auf der Website" dialog – off on the Änderungen page itself */
  whatsNew?: boolean;
};

/** Header (location selection) + footer shared by all pages, in the visitor's language. */
export function AppShell(props: ShellProps) {
  return (
    <LangProvider>
      <Shell {...props} />
    </LangProvider>
  );
}

function Shell({ children, whatsNew = true }: ShellProps) {
  const loc = useLocations();
  const { t } = useLang();
  const version = displayVersion();
  return (
    <div id="top" className="min-h-screen">
      <PullToRefresh />
      <LocationBar
        selected={loc.selected}
        favorites={loc.favorites}
        recent={loc.recent}
        onSelect={loc.select}
        isFavorite={loc.isFavorite}
        toggleFavorite={loc.toggleFavorite}
        onRemove={loc.remove}
        geo={loc.geo}
        onLocate={loc.locate}
      />
      <main className="mx-auto max-w-7xl space-y-14 px-4 py-6 sm:px-6 sm:py-10">{children(loc.selected, loc)}</main>
      <RateLimitBanner />
      <UpdateWatcher />
      {whatsNew && <WhatsNew />}
      <footer className="mt-10 border-t border-white/10 bg-slate-950/60">
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-8 text-xs text-slate-400 sm:px-6">
          <p className="font-semibold text-white">{t("Datenquellen", "Data sources")}</p>
          <p>{t("Stationsmesswerte", "Station readings")}: <a className="underline hover:text-white" href="https://www.awekas.at" target="_blank" rel="noopener noreferrer">AWEKAS</a> ({t("offizielles Widget", "official widget")})</p>
          <p>{t("Modell-, Prognose- und Archivdaten", "Model, forecast and archive data")}: <a className="underline hover:text-white" href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> (CC BY 4.0)</p>
          <p>{t("Standort & Favoriten werden nur lokal in Ihrem Browser gespeichert.", "Location & favourites are stored only locally in your browser.")}</p>
          <p className="pt-3 text-slate-500">
            {version ? (
              <>
                Version <span className="font-mono">{version}</span>
              </>
            ) : (
              t("Entwicklungsversion", "Development build")
            )}
            <span className="text-slate-600"> · </span>
            <a className="underline hover:text-white" href="/aenderungen">
              {t("Änderungen", "Changes")}
            </a>
            <span className="text-slate-600"> · </span>
            <a className="underline hover:text-white" href="#impressum">
              {t("Impressum", "Legal notice")}
            </a>
          </p>
        </div>
        <Imprint />
      </footer>
    </div>
  );
}
