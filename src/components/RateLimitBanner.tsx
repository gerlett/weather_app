"use client";

import { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";
import { onRateLimit } from "@/lib/openmeteo";

/** Shown while the weather API's free request limit is exhausted; requests resume automatically. */
export function RateLimitBanner() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => onRateLimit(setUntil), []);
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);

  const secs = Math.ceil((until - now) / 1000);
  if (!until || secs <= 0) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 text-sm text-amber-100 shadow-xl ring-1 ring-amber-400/40 backdrop-blur">
      <Hourglass className="h-4 w-4 animate-pulse" />
      Viele Anfragen – die Daten werden in {secs >= 60 ? `${Math.ceil(secs / 60)} min` : `${secs} s`} automatisch nachgeladen.
    </div>
  );
}
