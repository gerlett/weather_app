"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Pull distance (px, after damping) that triggers the reload. */
const THRESHOLD = 70;
const MAX_PULL = 110;

/** Inside something that is itself scrolled (dropdown list, dialog, …) the gesture belongs to that element. */
function insideScrolled(el: EventTarget | null) {
  for (let n = el instanceof Element ? el : null; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0 || n.tagName === "DIALOG") return true;
  }
  return false;
}

/**
 * Swipe down while at the very top of the page → reload the whole page.
 * Same behaviour in the browser and as an installed app (where the browser's
 * own pull-to-refresh is missing); that native one is switched off in
 * globals.css so a pull never reloads twice.
 */
export function PullToRefresh() {
  const { t } = useLang();
  const [pull, setPull] = useState(0);
  const [reloading, setReloading] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && e.touches.length === 1 && !insideScrolled(e.target) ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(dy * 0.5, MAX_PULL);
      setPull(pullRef.current);
    };
    const onEnd = () => {
      if (start.current != null && pullRef.current >= THRESHOLD) {
        setReloading(true);
        window.location.reload();
      } else {
        setPull(0);
      }
      start.current = null;
      pullRef.current = 0;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const shown = reloading ? THRESHOLD : pull;
  if (!shown) return null;
  const ready = shown >= THRESHOLD;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{ transform: `translateY(${shown - 40}px)`, transition: pull && !reloading ? "none" : "transform 0.2s" }}
      role="status"
      aria-live="polite"
    >
      <span className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium shadow-xl ring-1 ${ready ? "bg-sky-500 text-white ring-sky-300" : "bg-slate-800 text-slate-200 ring-white/15"}`}>
        <RefreshCw
          className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`}
          style={reloading ? undefined : { transform: `rotate(${(shown / THRESHOLD) * 270}deg)` }}
          aria-hidden
        />
        {reloading ? t("Wird neu geladen…", "Reloading…") : ready ? t("Loslassen zum Neuladen", "Release to reload") : t("Zum Neuladen ziehen", "Pull to reload")}
      </span>
    </div>
  );
}
