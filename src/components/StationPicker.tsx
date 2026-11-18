"use client";

/** Compact station chip with the same worldwide search as the top location bar. */
import { ChevronDown, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ALL_STATIONS, type WeatherLocation } from "@/lib/locations";
import { searchPlaces } from "@/lib/openmeteo";
import { tr, useLang } from "@/lib/i18n";

export function StationPicker({
  value,
  onSelect,
  mode = "select",
  label,
  exclude = [],
  suggestions = [],
}: {
  value?: WeatherLocation;
  onSelect: (l: WeatherLocation) => void;
  /** "add" renders a + chip for the comparison list; "select" shows the current station. */
  mode?: "select" | "add";
  label?: string;
  exclude?: string[];
  suggestions?: WeatherLocation[];
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      searchPlaces(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const stations = [...suggestions, ...ALL_STATIONS]
    .filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i && !exclude.includes(s.id))
    .filter((s) => !query || s.name.toLowerCase().includes(query.trim().toLowerCase()));
  const pick = (l: WeatherLocation) => {
    onSelect(l);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-w-0 items-center gap-1 rounded-full bg-sky-500/10 py-1 pl-2 pr-1.5 text-sky-200 ring-1 ring-sky-400/30 hover:bg-sky-500/20 sm:gap-1.5 sm:pl-2.5 sm:pr-2"
      >
        <span className="hidden sm:block">
          {mode === "add" ? <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        </span>
        <span className="max-w-[5.5rem] truncate text-xs sm:max-w-[11rem] sm:text-sm">{mode === "add" ? label : value?.name}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition sm:h-3.5 sm:w-3.5 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[min(85vw,20rem)] rounded-2xl bg-slate-900 p-3 shadow-2xl ring-1 ring-white/10">
          <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 focus-within:ring-sky-400">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Station oder Ort weltweit suchen…", "Search a station or place worldwide…")}
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label={t("Suche leeren", "Clear search")}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </label>
          <div className="mt-3 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {stations.length > 0 && (
              <div>
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t("Stationen", "Stations")}</p>
                <ul className="mt-1">
                  {stations.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => pick(s)}
                        className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm ${s.id === value?.id ? "font-semibold text-sky-300" : "text-white hover:bg-white/10"}`}
                      >
                        {s.name}{s.awekasId ? <span className="text-xs text-slate-500"> · AWEKAS</span> : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {query.trim().length >= 2 && (
              <div>
                <p className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {tr("Orte weltweit", "Places worldwide")} {searching && <Loader2 className="h-3 w-3 animate-spin" />}
                </p>
                <ul className="mt-1">
                  {results.filter((l) => !exclude.includes(l.id)).map((l) => (
                    <li key={l.id}>
                      <button onClick={() => pick(l)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-white hover:bg-white/10">
                        {l.name}<span className="text-xs text-slate-500"> · {l.region}</span>
                      </button>
                    </li>
                  ))}
                  {!searching && results.length === 0 && <li className="px-2 py-1 text-xs text-slate-500">{tr("Keine Treffer.", "No results.")}</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
