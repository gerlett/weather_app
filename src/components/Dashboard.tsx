"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
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
import { ErrorNote } from "./ui";
import { SortablePanel, usePanelOrder, type PanelKey } from "./SortablePanels";
import { CollapsibleSection } from "./CollapsibleSection";
import { Lazy } from "./Lazy";
import { useLang } from "@/lib/i18n";
import { isForecastModel, type ForecastModel } from "@/lib/forecastModels";

const MODEL_KEY = "wetter-perg:forecast-model";

export function Dashboard() {
  return <AppShell>{(selected, loc) => <Content selected={selected} favorites={loc.favorites} />}</AppShell>;
}

function Content({ selected, favorites }: { selected: WeatherLocation; favorites: ReturnType<typeof useLocations>["favorites"] }) {
  // Forecast model chosen in the forecast section (kept in this browser only).
  const [model, setModel] = useState<ForecastModel>("best_match");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_KEY);
      if (isForecastModel(saved)) setModel(saved);
    } catch {
      /* storage unavailable – keep the default */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(MODEL_KEY, model);
    } catch {
      /* ignore */
    }
  }, [model]);

  // slow tracker: current values every minute, full forecast every 15 min
  const forecast = useLiveWeather(selected, model);
  const { order, move } = usePanelOrder();
  const { t } = useLang();

  const panels: Record<PanelKey, ReactNode> = {
    aktuell: (
      <CurrentSection
        location={selected}
        data={forecast.data}
        loading={forecast.loading}
        live={{ changes: forecast.changes, lastCheck: forecast.lastCheck, checking: forecast.checking, uvNow: forecast.uvNow, onRefresh: forecast.refreshNow }}
      />
    ),
    vorhersage: <ForecastSection location={selected} model={model} onModelChange={setModel} />,
    verlauf: (
      <Lazy id="verlauf">
        <HistorySection location={selected} favorites={favorites} />
      </Lazy>
    ),
    auswertung: (
      <Lazy id="auswertung">
        <CollapsibleSection
          id="auswertung"
          eyebrow={t("Zeitraum-Auswertung", "Period analysis")}
          title={t("Werte für beliebige Zeiträume", "Values for any period")}
          actions={
            <Link href="/auswertung" className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400">
              {t("Alle Messwerte auswerten", "Analyse all measurements")} <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          <SpanAnalysis location={selected} initialMetric="precipitation" />
        </CollapsibleSection>
      </Lazy>
    ),
    klima: (
      <Lazy id="klima">
        <ClimateSection location={selected} />
      </Lazy>
    ),
    station:
      selected.awekasId != null ? (
        <Lazy id="station" minHeight={400}>
          <StationSection location={selected} elevation={forecast.data?.elevation} />
        </Lazy>
      ) : null,
  };

  return (
    <>
      {forecast.error && !forecast.data && <ErrorNote message={forecast.error} />}
      {order.map((key) =>
        panels[key] ? (
          <SortablePanel key={key} id={key} onMove={move}>
            {panels[key]}
          </SortablePanel>
        ) : null,
      )}
    </>
  );
}
