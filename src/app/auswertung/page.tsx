import type { Metadata } from "next";
import { AnalysisPage } from "@/components/AnalysisPage";

export const metadata: Metadata = {
  title: "Zeitraum-Auswertung · Wetter Strudengau",
  description: "Alle Messwerte für frei wählbare Zeiträume auswerten: Summen, Minimum, Maximum und Mittelwert pro Stunde, Tag, Woche, Monat oder Jahr – zurück bis 1940.",
};

export default function Page() {
  return <AnalysisPage />;
}
