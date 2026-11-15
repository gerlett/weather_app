"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { BUILD_ID } from "@/lib/version";
import { useLang } from "@/lib/i18n";

const CHECK_EVERY_MS = 5 * 60_000;
const RELOAD_GUARD = "wetter-perg:chunk-reload"; // sessionStorage: one automatic reload per broken chunk

/**
 * Keeps open tabs on the current deploy. HTML is always revalidated and the
 * hashed JS/CSS is immutable, so a fresh page load is always current – but a
 * tab left open (the live values keep it useful for hours) still runs the old
 * code. This checks the server's /version.json every 5 minutes and when the tab
 * comes back into view:
 *  - tab in the background → reload silently, nobody is looking at it;
 *  - tab in view → offer "Neu laden", so nobody loses what they are doing.
 * After the reload the "Neu auf der Website" dialog tells what changed.
 *
 * Also: a chunk that fails to load (an old tab asking for files of a build
 * that no longer exists) triggers one reload instead of a broken page.
 * Development builds (no BUILD_ID) do nothing.
 */
export function UpdateWatcher() {
  const { t } = useLang();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!BUILD_ID) return;
    let stopped = false;
    let busy = false;

    const check = async () => {
      if (busy || stopped || !navigator.onLine) return;
      busy = true;
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (!buildId || buildId === BUILD_ID || stopped) return;
        if (document.hidden) location.reload();
        else setAvailable(true);
      } catch {
        /* offline or server busy – next round */
      } finally {
        busy = false;
      }
    };

    const onVisible = () => {
      if (!document.hidden) void check();
    };
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);

  useEffect(() => {
    const isChunkError = (e: unknown) =>
      /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module/i.test(
        e instanceof Error ? `${e.name} ${e.message}` : String(e),
      );
    const recover = (e: unknown) => {
      if (!isChunkError(e)) return;
      try {
        if (sessionStorage.getItem(RELOAD_GUARD)) return; // reloaded once already – don't loop
        sessionStorage.setItem(RELOAD_GUARD, "1");
      } catch {
        return;
      }
      location.reload();
    };
    const onError = (ev: ErrorEvent) => recover(ev.error ?? ev.message);
    const onRejection = (ev: PromiseRejectionEvent) => recover(ev.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    // a page that loaded fine clears the guard for the next deploy
    const clear = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_GUARD);
      } catch {}
    }, 10_000);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      clearTimeout(clear);
    };
  }, []);

  if (!available) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-20 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-sm text-slate-200 shadow-2xl ring-1 ring-sky-400/40 backdrop-blur"
    >
      <span>{t("Eine neue Version der Website ist verfügbar.", "A new version of the website is available.")}</span>
      <button
        onClick={() => location.reload()}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-500/20 px-3 py-1.5 font-medium text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-500/30"
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> {t("Neu laden", "Reload")}
      </button>
    </div>
  );
}
