"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LIVE_INTERVAL_MS } from "@/hooks/useLiveWeather";
import { time } from "@/lib/format";

/** "● Live · geprüft vor 12 s · Messwert 09:15" with a manual refresh button. */
export function LiveStatus({ lastCheck, checking, valueTime, onRefresh }: { lastCheck: number; checking: boolean; valueTime: string; onRefresh: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ago = lastCheck ? Math.max(0, Math.round((now - lastCheck) / 1000)) : null;
  const stale = ago != null && ago * 1000 > LIVE_INTERVAL_MS * 3; // e.g. tab was hidden / offline

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
      <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-white">
        <span className="relative flex h-2 w-2">
          {!stale && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${stale ? "bg-amber-300" : "bg-emerald-300"}`} />
        </span>
        Live
      </span>
      <span>
        {ago == null ? "verbinde…" : ago < 5 ? "gerade geprüft" : ago < 120 ? `geprüft vor ${ago} s` : `geprüft vor ${Math.round(ago / 60)} min`}
      </span>
      <span>· Wert von {time(valueTime)} Uhr</span>
      <button
        onClick={onRefresh}
        disabled={checking}
        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-white/80 ring-1 ring-white/20 hover:bg-white/20 disabled:opacity-60"
        title="Jetzt aktualisieren"
      >
        <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} /> Aktualisieren
      </button>
    </div>
  );
}
