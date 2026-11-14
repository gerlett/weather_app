"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { AppShell } from "./AppShell";
import { SpanAnalysis } from "./SpanAnalysis";
import { SectionTitle } from "./ui";

/**
 * Dedicated analysis page: one panel per measurement, each with its own
 * start/end date-time and interval. Panels can be added to compare values side by side.
 */
export function AnalysisPage() {
  const [panels, setPanels] = useState<{ id: number; metric: string }[]>([
    { id: 1, metric: "temperature" },
    { id: 2, metric: "precipitation" },
  ]);

  return (
    <AppShell>
      {(selected) => (
        <>
          <section>
            <SectionTitle eyebrow={`Zeitraum-Auswertung · ${selected.name}`} title="Alle Messwerte, frei wählbarer Zeitraum" />
            <p className="-mt-2 max-w-3xl text-sm text-slate-400">
              Wählen Sie für jeden Messwert Beginn und Ende (auf die Stunde genau, zurück bis 1940) sowie das Intervall. Summenwerte
              (Niederschlag, Neuschnee, Sonnenschein) werden aufsummiert, alle anderen Werte als Minimum, Maximum und Mittelwert je
              Intervall dargestellt. Jede Auswertung lässt sich als CSV herunterladen.
            </p>
          </section>

          {panels.map((p) => (
            <div key={p.id} className="relative">
              {panels.length > 1 && (
                <button
                  onClick={() => setPanels((ps) => ps.filter((x) => x.id !== p.id))}
                  aria-label="Auswertung entfernen"
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
            <Plus className="h-4 w-4" /> Weitere Auswertung hinzufügen
          </button>
        </>
      )}
    </AppShell>
  );
}
