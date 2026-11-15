"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LOCATION, REGIONAL_STATIONS, type WeatherLocation } from "@/lib/locations";
import { tr } from "@/lib/i18n";

const KEY_SELECTED = "wetter-perg:selected"; // only written for a *manual* choice
const KEY_FAVORITES = "wetter-perg:favorites";
const KEY_RECENT = "wetter-perg:recent"; // places picked from the search, newest first
const MAX_RECENT = 8;
const KEY_AUTO = "wetter-perg:auto"; // sessionStorage: last geolocated choice

function rememberAuto(loc: WeatherLocation) {
  try {
    sessionStorage.setItem(KEY_AUTO, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

/** If the nearest regional station is further away than this, the visitor's own position is used instead. */
const MAX_STATION_DISTANCE_KM = 25;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage blocked – app keeps working without persistence */
  }
}

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestStation(pos: { latitude: number; longitude: number }) {
  let best = REGIONAL_STATIONS[0];
  let bestKm = Infinity;
  for (const s of REGIONAL_STATIONS) {
    const d = distanceKm(pos, s);
    if (d < bestKm) {
      best = s;
      bestKm = d;
    }
  }
  return { station: best, km: bestKm };
}

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unsupported";

/**
 * Selected location + favourites, persisted only in this browser (no account, no server, no DB).
 * On start the browser's geolocation is requested and the nearest station is chosen,
 * unless the visitor has made a manual choice before.
 */
export function useLocations() {
  const [selected, setSelected] = useState<WeatherLocation>(DEFAULT_LOCATION);
  const [favorites, setFavorites] = useState<WeatherLocation[]>([DEFAULT_LOCATION]);
  const [recent, setRecent] = useState<WeatherLocation[]>([]);
  const [ready, setReady] = useState(false);
  const [geo, setGeo] = useState<{ status: GeoStatus; km?: number; message?: string }>({ status: "idle" });

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ status: "unsupported", message: tr("Standortbestimmung wird von diesem Browser nicht unterstützt.", "This browser does not support location detection.") });
      return;
    }
    setGeo({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = { latitude: coords.latitude, longitude: coords.longitude };
        const { station, km } = nearestStation(pos);
        if (km <= MAX_STATION_DISTANCE_KM) {
          setSelected(station);
          rememberAuto(station);
          setGeo({ status: "granted", km, message: tr(`Nächste Station: ${station.name} (${km.toFixed(1)} km entfernt)`, `Nearest station: ${station.name} (${km.toFixed(1)} km away)`) });
        } else {
          const mine: WeatherLocation = {
            id: "my-location",
            name: tr("Mein Standort", "My location"),
            region: `${pos.latitude.toFixed(2)}° N, ${pos.longitude.toFixed(2)}° ${tr("O", "E")}`,
            latitude: pos.latitude,
            longitude: pos.longitude,
            kind: "place",
          };
          setSelected(mine);
          rememberAuto(mine);
          setGeo({
            status: "granted",
            km,
            message: tr(
              `Keine Station in der Nähe (nächste: ${station.name}, ${Math.round(km)} km) – Modelldaten für Ihren Standort.`,
              `No station nearby (nearest: ${station.name}, ${Math.round(km)} km) – model data for your location.`,
            ),
          });
        }
        write(KEY_SELECTED, null); // automatic choice → keep locating on next start
      },
      (err) =>
        setGeo({
          status: "denied",
          message:
            err.code === err.PERMISSION_DENIED
              ? tr("Standortzugriff abgelehnt – Standardstation Perg/Thurnhof wird angezeigt.", "Location access denied – showing the default station Perg/Thurnhof.")
              : tr("Standort konnte nicht bestimmt werden – Standardstation wird angezeigt.", "Location could not be determined – showing the default station."),
        }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    // Refresh regional station definitions from code (e.g. a newly added awekasId).
    const sync = (l: WeatherLocation) => REGIONAL_STATIONS.find((s) => s.id === l.id) ?? l;
    setFavorites(read<WeatherLocation[]>(KEY_FAVORITES, [DEFAULT_LOCATION]).map(sync));
    setRecent(read<WeatherLocation[]>(KEY_RECENT, []));
    const manual = read<WeatherLocation | null>(KEY_SELECTED, null);
    let auto: WeatherLocation | null = null;
    try {
      auto = JSON.parse(sessionStorage.getItem(KEY_AUTO) ?? "null");
    } catch {
      /* ignore */
    }
    if (manual) setSelected(sync(manual));
    else if (auto) setSelected(sync(auto)); // already located in this browser session (e.g. page switch)
    else locate();
    setReady(true);
  }, [locate]);

  useEffect(() => {
    if (ready) write(KEY_FAVORITES, favorites);
  }, [favorites, ready]);

  useEffect(() => {
    if (ready) write(KEY_RECENT, recent);
  }, [recent, ready]);

  /** Manual selection – remembered and preferred over geolocation on the next visit. */
  const select = useCallback((loc: WeatherLocation) => {
    setSelected(loc);
    write(KEY_SELECTED, loc);
    setGeo((g) => ({ ...g, message: undefined }));
    // places from the search (not the fixed stations) stay in the dropdown
    if (!REGIONAL_STATIONS.some((s) => s.id === loc.id) && loc.id !== "my-location") {
      setRecent((r) => [loc, ...r.filter((x) => x.id !== loc.id)].slice(0, MAX_RECENT));
    }
  }, []);

  const isFavorite = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites]);

  const toggleFavorite = useCallback((loc: WeatherLocation) => {
    setFavorites((f) => (f.some((x) => x.id === loc.id) ? f.filter((x) => x.id !== loc.id) : [...f, loc]));
  }, []);

  /** Removes a place from the dropdown entirely (favourite and search history). */
  const remove = useCallback((id: string) => {
    setFavorites((f) => f.filter((x) => x.id !== id));
    setRecent((r) => r.filter((x) => x.id !== id));
  }, []);

  return { selected, select, favorites, recent, isFavorite, toggleFavorite, remove, ready, geo, locate };
}
