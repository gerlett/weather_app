"use client";

/** A section-local station that follows the top station until the visitor picks
 *  a different one. The override is stored in localStorage only while it really
 *  differs from the top station; selecting the main station again removes it. */
import { useEffect, useRef, useState } from "react";
import type { WeatherLocation } from "@/lib/locations";

const isLocation = (v: unknown): v is WeatherLocation => {
  const l = v as WeatherLocation | null;
  return !!l && typeof l.id === "string" && typeof l.name === "string" && Number.isFinite(l.latitude) && Number.isFinite(l.longitude);
};

export function usePersistedStation(location: WeatherLocation, key: string) {
  const [station, setStationState] = useState<WeatherLocation>(location);
  const [restored, setRestored] = useState(false);
  const override = useRef(false);
  const prevId = useRef(location.id);
  const locationRef = useRef(location);
  const stationRef = useRef(station);
  locationRef.current = location;
  stationRef.current = station;

  // Restore after mount (static export has no localStorage while prerendering).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (isLocation(saved) && saved.id !== locationRef.current.id) {
          setStationState(saved);
          override.current = true;
        } else {
          localStorage.removeItem(key); // stale or equal to the main station
        }
      }
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, [key]);

  // Follow the main station unless the visitor has chosen a different one.
  // Also drop the override if the main station changes to the chosen one.
  useEffect(() => {
    if (prevId.current === location.id) return; // mount: restoration handles it
    prevId.current = location.id;
    if (!override.current || stationRef.current.id === location.id) {
      override.current = false;
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      setStationState(locationRef.current);
    }
  }, [location.id, key]);

  useEffect(() => {
    if (!restored) return;
    try {
      if (override.current && station.id !== locationRef.current.id) localStorage.setItem(key, JSON.stringify(station));
      else localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [station, key, restored]);

  const setStation = (next: WeatherLocation) => {
    override.current = next.id !== locationRef.current.id;
    setStationState(next);
  };

  return { station, setStation };
}
