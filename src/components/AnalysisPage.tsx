"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { WeatherLocation } from "@/lib/locations";
import { AppShell } from "./AppShell";
import { SpanAnalysis } from "./SpanAnalysis";
import { SectionTitle } from "./ui";
import { useLang } from "@/lib/i18n";

/**
 * Dedicated analysis page: one panel per measurement, each with its own
 * start/end date-time and interval. Panels can be added to compare values side by side.
 */
export function AnalysisPage() {
  const [panels, setPanels] = useState<{ id: number; metric: string }[]>([
    { id: 1, metric: "temperature" },
    { id: 2, metric: "precipitation" },
  ]);

  return <AppShell>{(selected) => <Body selected={selected} panels={panels} setPanels={setPanels} />}</AppShell>;
}

type Panel = { id: number; metric: string };
function Body({ selected, panels, setPanels }: { selected: WeatherLocation; panels: Panel[]; setPanels: React.Dispatch<React.SetStateAction<Panel[]>> }) {
  const { t } = useLang();
  return (
        <>
          <section>
            <SectionTitle eyebrow={`${t("Zeitraum-Auswertung", "Period analysis")} · ${selected.name}`} title={t("Alle Messwerte, frei wählbarer Zeitraum", "All measurements, any period")} />
            <p className="-mt-2 max-w-3xl text-sm text-slate-400">
              {t(
                "Wählen Sie für jeden Messwert Beginn und Ende (auf die Stunde genau, zurück bis 1940) sowie das Intervall. Summenwerte (Niederschlag, Neuschnee, Sonnenschein) werden aufsummiert, alle anderen Werte als Minimum, Maximum und Mittelwert je Intervall dargestellt. Jede Auswertung lässt sich als CSV herunterladen.",
                "Choose start and end for each measurement (to the hour, back to 1940) and the interval. Totals (precipitation, new snow, sunshine) are summed up, all other values are shown as minimum, maximum and mean per interval. Every analysis can be downloaded as CSV.",
              )}
            </p>
          </section>

          {panels.map((p) => (
            <div key={p.id} className="relative">
              {panels.length > 1 && (
                <button
                  onClick={() => setPanels((ps) => ps.filter((x) => x.id !== p.id))}
                  aria-label={t("Auswertung entfernen", "Remove analysis")}
                  className="absolute -top-3 right-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-slate-300 ring-1 ring-white/15 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <SpanAnalysis location={selected} initialMetric={p.metric} />
            </div>
          ))}

          <button
            onClick={() => setPanels((ps) => [...ps, { id: Math.max(0, ...ps.map((x) => x.id)) + 1, metric: "wind" }])}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-6 text-sm text-slate-400 hover:border-sky-400/50 hover:text-white"
          >
            <Plus className="h-4 w-4" /> {t("Weitere Auswertung hinzufügen", "Add another analysis")}
          </button>
        </>
  );
}
