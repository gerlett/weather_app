"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, Mail } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Impressum & Datenschutz – collapsed panel at the very bottom of every page; #impressum links open it. */
export function Imprint() {
  const { t } = useLang();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // Always starts collapsed – also on a reload of /#impressum. Only a click on an
    // Impressum link opens it; the hash is dropped again so a later reload stays collapsed.
    const clearHash = () => history.replaceState(history.state, "", window.location.pathname + window.location.search);
    if (window.location.hash === "#impressum") clearHash();
    const onHash = () => {
      if (window.location.hash !== "#impressum" || !ref.current) return;
      ref.current.open = true;
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      clearHash();
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return (
    <details ref={ref} id="impressum" className="group border-t border-white/10 bg-slate-950/80">
      <summary className="mx-auto flex max-w-7xl cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm text-slate-400 hover:text-white sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          {t("Impressum & Datenschutz", "Legal notice & privacy")} <span className="text-slate-600">·</span> © 2027{" "}
          <span className="text-slate-500">softwarekstatt.at</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-2 text-sm leading-relaxed text-slate-400 sm:px-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold text-white">{t("Impressum", "Legal notice")}</h2>
          <p className="text-xs uppercase tracking-wider text-slate-500">{t("Medieninhaber und Herausgeber (§ 25 MedienG)", "Owner and publisher (§ 25 Austrian Media Act)")}</p>
          <p className="mt-1 text-slate-300">
            Gerhard Lettner
            <br />
            Thurnhof 67
            <br />
            4320 Perg, {t("Österreich", "Austria")}
          </p>
          <p className="mt-2">
            <a href="mailto:gerlett@gmail.com" className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200">
              <Mail className="h-4 w-4" aria-hidden /> gerlett@gmail.com
            </a>
          </p>

          <h3 className="mt-5 font-semibold text-white">{t("Zweck der Website", "Purpose of the website")}</h3>
          <p className="mt-1">
            {t(
              "Private, nicht-kommerzielle Website mit aktuellen Wetterwerten, Vorhersagen, Wetterhistorie und Klimaauswertungen für Perg/Thurnhof und Umgebung. Alle Inhalte sind frei nutzbar. Wetterdaten: Modell-, Prognose- und Archivdaten von Open-Meteo.com (CC BY 4.0), Stationsmesswerte über das offizielle AWEKAS-Widget.",
              "Private, non-commercial website with current weather values, forecasts, weather history and climate analyses for Perg/Thurnhof and the surrounding area. All content is free to use. Weather data: model, forecast and archive data from Open-Meteo.com (CC BY 4.0), station readings via the official AWEKAS widget.",
            )}
          </p>

          <h3 className="mt-5 font-semibold text-white">{t("Haftungsausschluss", "Disclaimer")}</h3>
          <p className="mt-1">
            {t(
              "Alle Angaben ohne Gewähr – insbesondere Wetterwerte und Vorhersagen sind Modelldaten und können von den tatsächlichen Verhältnissen abweichen. Für die Inhalte verlinkter Seiten wird keine Haftung übernommen.",
              "All information without guarantee – weather values and forecasts in particular are model data and may differ from actual conditions. No liability is accepted for the content of linked pages.",
            )}
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-white">{t("Datenschutz", "Privacy")}</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>{t("Keine Cookies, kein Tracking, keine Analyse- oder Werbedienste.", "No cookies, no tracking, no analytics or advertising services.")}</li>
            <li>
              {t(
                "Der Webserver und Cloudflare verarbeiten die IP-Adressen der Besucher, weil das für die Auslieferung der Website technisch notwendig ist.",
                "The web server and Cloudflare process visitors' IP addresses because this is technically necessary to deliver the website.",
              )}
            </li>
            <li>
              {t(
                "Gewählter Standort, Favoriten, Spracheinstellung und zwischengespeicherte Wetterdaten werden nur lokal in Ihrem Browser (localStorage) gespeichert und nicht an uns übertragen.",
                "Selected location, favourites, language setting and cached weather data are stored only locally in your browser (localStorage) and are not sent to us.",
              )}
            </li>
            <li>
              {t(
                "Die Standortfreigabe ist freiwillig. Ihre Position wird im Browser nur verwendet, um die nächstgelegene Station zu wählen; liegt keine Station in der Nähe, werden die Koordinaten für die Wetterabfrage an diesen Server und an Open-Meteo übermittelt.",
                "Sharing your location is optional. Your position is used in the browser only to pick the nearest station; if there is no station nearby, the coordinates are sent to this server and to Open-Meteo for the weather query.",
              )}
            </li>
            <li>
              {t(
                "Das eingebettete AWEKAS-Widget wird direkt von awekas.at geladen; dabei erhält AWEKAS Ihre IP-Adresse.",
                "The embedded AWEKAS widget is loaded directly from awekas.at; AWEKAS receives your IP address in the process.",
              )}
            </li>
          </ul>
          <p className="mt-5 text-slate-500">
            © 2027{" "}
            <a href="https://www.softwarekstatt.at" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
              www.softwarekstatt.at
            </a>
          </p>
        </section>
      </div>
    </details>
  );
}
