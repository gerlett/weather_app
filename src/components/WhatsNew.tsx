"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { type ChangelogEntry, fetchChangelog, unseenEntries } from "@/lib/changelog";
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
    /* private mode – the dialog simply shows again next time */
  }
}

/**
 * "Neu auf der Website" – the same first-load dialog as in fotografie_crm:
 * when the page opens, it shows once what changed since this browser last
 * looked, never newer than the running build. A browser that has never seen
 * the changelog gets only the newest release, not the whole history.
 * What it shows counts as seen as soon as it opens, so a reload never brings it back.
 * A changelog that cannot be read shows nothing and marks nothing.
 */
export function WhatsNew() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchChangelog(ctrl.signal)
      .then((all) => setEntries(unseenEntries(all, readSeen())))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (entries.length && d && !d.open) {
      d.showModal();
      // Counted as seen once shown: a reload while it is open must not bring it back.
      markChangelogSeen(entries[0].version);
    }
  }, [entries]);

  if (!entries.length) return null;

  // Every way of closing ends in the dialog's `close` event.
  const onClose = () => {
    markChangelogSeen(entries[0].version);
    setEntries([]);
  };
  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && close()} // click on the backdrop
      aria-labelledby="whats-new-title"
      className="m-auto max-h-[80vh] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-slate-900 p-0 text-slate-200 shadow-2xl ring-1 ring-white/15 backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm open:flex open:flex-col"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <h2 id="whats-new-title" className="flex items-center gap-2 text-lg font-semibold text-white">
          <Sparkles className="h-5 w-5 text-amber-300" aria-hidden /> Neu auf der Website
        </h2>
        <button onClick={close} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Schließen">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto px-5 py-5">
        <ChangelogEntries entries={entries} compact />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-sm">
        <a href="/aenderungen" onClick={() => markChangelogSeen(entries[0].version)} className="text-sky-300 hover:text-sky-200">
          Alle Änderungen
        </a>
        <button
          onClick={close}
          autoFocus
          className="rounded-lg bg-sky-500/20 px-4 py-1.5 font-medium text-sky-100 ring-1 ring-sky-400/40 hover:bg-sky-500/30"
        >
          Verstanden
        </button>
      </div>
    </dialog>
  );
}
