"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLiveWeather } from "@/hooks/useLiveWeather";
import type { WeatherLocation } from "@/lib/locations";
import type { useLocations } from "@/hooks/useLocations";
import { AppShell } from "./AppShell";
import { CurrentSection } from "./CurrentSection";
import { ForecastSection } from "./ForecastSection";
import { HistorySection } from "./HistorySection";
import { ClimateSection } from "./ClimateSection";
import { StationSection } from "./StationSection";
import { SpanAnalysis } from "./SpanAnalysis";
import { ErrorNote, SectionTitle } from "./ui";
import { Lazy } from "./Lazy";

export function Dashboard() {
  return <AppShell>{(selected, loc) => <Content selected={selected} favorites={loc.favorites} />}</AppShell>;
}

function Content({ selected, favorites }: { selected: WeatherLocation; favorites: ReturnType<typeof useLocations>["favorites"] }) {
  // slow tracker: current values every minute, full forecast every 15 min
  const forecast = useLiveWeather(selected);
  return (
    <>
      {forecast.error && !forecast.data && <ErrorNote message={forecast.error} />}
      <CurrentSection
        location={selected}
        data={forecast.data}
        loading={forecast.loading}
        live={{ changes: forecast.changes, lastCheck: forecast.lastCheck, checking: forecast.checking, uvNow: forecast.uvNow, onRefresh: forecast.refreshNow }}
      />
      <ForecastSection data={forecast.data} />
      <Lazy id="verlauf">
        <HistorySection location={selected} favorites={favorites} />
      </Lazy>
      <Lazy id="auswertung">
      <section id="auswertung" className="scroll-mt-24">
        <SectionTitle eyebrow="Zeitraum-Auswertung" title="Werte für beliebige Zeiträume">
          <Link href="/auswertung" className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400">
            Alle Messwerte auswerten <ArrowRight className="h-4 w-4" />
          </Link>
        </SectionTitle>
        <SpanAnalysis location={selected} initialMetric="precipitation" />
      </section>
      </Lazy>
      <Lazy id="klima">
        <ClimateSection location={selected} />
      </Lazy>
      <Lazy id="station" minHeight={400}>
        <StationSection location={selected} elevation={forecast.data?.elevation} />
      </Lazy>
    </>
  );
}
