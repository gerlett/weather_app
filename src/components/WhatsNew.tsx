"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { type ChangelogEntry, fetchChangelog, shippedEntries, unseenEntries } from "@/lib/changelog";
import { ChangelogEntries } from "./ChangelogEntries";

const KEY_SEEN = "wetter-perg:changelog-seen"; // newest version this browser has shown

function readSeen(): string | null {
  try {
    return localStorage.getItem(KEY_SEEN);
  } catch {
    return null;
  }
}

export function markChangelogSeen(version: string) {
  try {
    localStorage.setItem(KEY_SEEN, version);
  } catch {
    /* private mode – the card simply shows again next time */
  }
}

/**
 * "Neu auf der Website": after an update, shows once what changed since this
 * browser last looked – never more than the running build has. A first-time
 * visitor gets nothing (the newest release is just marked as seen): on a public
 * site, release notes are news only to returning visitors.
 * A changelog that cannot be read shows nothing and marks nothing.
 */
export function WhatsNew() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchChangelog(ctrl.signal)
      .then((all) => {
        const seen = readSeen();
        if (!seen) {
          const newest = shippedEntries(all)[0];
          if (newest) markChangelogSeen(newest.version);
          return;
        }
        setEntries(unseenEntries(all, seen));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  if (!entries.length) return null;
  const close = () => {
    markChangelogSeen(entries[0].version);
    setEntries([]);
  };

  return (
    <aside
      role="dialog"
      aria-labelledby="whats-new-title"
      className="fixed inset-x-4 bottom-4 z-40 flex max-h-[70vh] flex-col rounded-2xl bg-slate-900/95 shadow-2xl ring-1 ring-white/15 backdrop-blur sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <h2 id="whats-new-title" className="flex items-center gap-2 font-semibold text-white">
          <Sparkles className="h-4 w-4 text-amber-300" aria-hidden /> Neu auf der Website
        </h2>
        <button onClick={close} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Schließen">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto px-5 py-4">
        <ChangelogEntries entries={entries} compact />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-sm">
        <a href="/aenderungen" onClick={close} className="text-sky-300 hover:text-sky-200">
          Alle Änderungen
        </a>
        <button onClick={close} className="rounded-lg bg-sky-500/20 px-3 py-1.5 font-medium text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-500/30">
          Verstanden
        </button>
      </div>
    </aside>
  );
}
