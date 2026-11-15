"use client";

import { ChevronDown, LocateFixed, Loader2, MapPin, Radio, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { REGIONAL_STATIONS, type WeatherLocation } from "@/lib/locations";
import { searchPlaces } from "@/lib/openmeteo";
import type { GeoStatus } from "@/hooks/useLocations";

type Props = {
  selected: WeatherLocation;
  favorites: WeatherLocation[];
  recent: WeatherLocation[];
  onSelect: (l: WeatherLocation) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (l: WeatherLocation) => void;
  onRemove: (id: string) => void;
  geo: { status: GeoStatus; message?: string };
  onLocate: () => void;
};

const NAV = [
  { href: "/#aktuell", label: "Aktuell" },
  { href: "/#vorhersage", label: "Vorhersage" },
  { href: "/#verlauf", label: "Verlauf" },
  { href: "/auswertung", label: "Auswertung" },
  { href: "/#klima", label: "Klima" },
  { href: "/#station", label: "Station" },
];

export function LocationBar({ selected, favorites, recent, onSelect, isFavorite, toggleFavorite, onRemove, geo, onLocate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => panel.current && !panel.current.contains(e.target as Node) && setOpen(false);
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
    const t = setTimeout(() => {
      searchPlaces(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (l: WeatherLocation) => {
    onSelect(l);
    setOpen(false);
    setQuery("");
  };

  const q = query.trim().toLowerCase();
  const stations = REGIONAL_STATIONS.filter((s) => !q || s.name.toLowerCase().includes(q));
  const searched = recent.filter((l) => !isFavorite(l.id));

  const Row = ({ l, removable = false }: { l: WeatherLocation; removable?: boolean }) => (
    <li className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10">
      <button onClick={() => pick(l)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {l.kind === "station" ? <Radio className="h-4 w-4 shrink-0 text-sky-300" /> : <MapPin className="h-4 w-4 shrink-0 text-slate-400" />}
        <span className="min-w-0">
          <span className={`block truncate text-sm ${l.id === selected.id ? "font-semibold text-sky-300" : "text-white"}`}>{l.name}</span>
          <span className="block truncate text-xs text-slate-400">
            {l.region}
            {l.awekasId ? " · Live-Station" : ""}
          </span>
        </span>
      </button>
      <button
        onClick={() => toggleFavorite(l)}
        aria-label={isFavorite(l.id) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
        className="rounded p-1 text-slate-500 hover:text-amber-300"
      >
        <Star className={`h-4 w-4 ${isFavorite(l.id) ? "fill-amber-300 text-amber-300" : ""}`} />
      </button>
      {removable && (
        <button onClick={() => onRemove(l.id)} aria-label={`${l.name} aus der Liste entfernen`} title="Aus der Liste entfernen" className="rounded p-1 text-slate-500 hover:text-rose-300">
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 font-bold text-white">W</span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold text-white">Wetter Strudengau</span>
            <span className="block text-[11px] uppercase tracking-widest text-slate-400">Live · Prognose · Archiv</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.filter((n) => n.href !== "/#station" || selected.awekasId != null).map((n) => (
            <a key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onLocate}
            title="Nächste Station über meinen Standort wählen"
            className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
          >
            {geo.status === "locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            <span className="sr-only">Mein Standort</span>
          </button>

          <div className="relative" ref={panel}>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex max-w-[60vw] items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-left ring-1 ring-white/10 hover:bg-white/10 sm:max-w-xs"
            >
              <MapPin className="h-4 w-4 shrink-0 text-sky-300" />
              <span className="truncate text-sm font-medium text-white">{selected.name}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-[min(92vw,22rem)] rounded-2xl bg-slate-900 p-3 shadow-2xl ring-1 ring-white/10">
                <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 focus-within:ring-sky-400">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Station oder Ort weltweit suchen…"
                    className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} aria-label="Suche leeren">
                      <X className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </label>

                <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                  {!q && favorites.length > 0 && (
                    <div>
                      <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Favoriten · im Browser gespeichert</p>
                      <ul className="mt-1">{favorites.map((l) => <Row key={l.id} l={l} removable />)}</ul>
                    </div>
                  )}
                  {stations.length > 0 && (
                    <div>
                      <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Wetterstationen Strudengau</p>
                      <ul className="mt-1">{stations.map((l) => <Row key={l.id} l={l} />)}</ul>
                    </div>
                  )}
                  {q.length >= 2 && (
                    <div>
                      <p className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Orte weltweit {searching && <Loader2 className="h-3 w-3 animate-spin" />}
                      </p>
                      <ul className="mt-1">{results.map((l) => <Row key={l.id} l={l} />)}</ul>
                      {!searching && results.length === 0 && <p className="px-2 py-1 text-xs text-slate-500">Keine Treffer.</p>}
                    </div>
                  )}
                  {!q && searched.length > 0 && (
                    <div>
                      <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Zuletzt gesucht</p>
                      <ul className="mt-1">{searched.map((l) => <Row key={l.id} l={l} removable />)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {geo.message && (
        <div className="border-t border-white/5 bg-sky-500/10 px-4 py-1.5 text-center text-xs text-sky-100">{geo.message}</div>
      )}
    </header>
  );
}
