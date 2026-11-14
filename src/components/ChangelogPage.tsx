"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { type ChangelogEntry, fetchChangelog, searchChangelog, shippedEntries } from "@/lib/changelog";
import { displayVersion } from "@/lib/version";
import { AppShell } from "./AppShell";
import { ChangelogEntries } from "./ChangelogEntries";
import { SectionTitle } from "./ui";
import { markChangelogSeen } from "./WhatsNew";

/** Every release, newest first, with a search over text and version. */
export function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    fetchChangelog(ctrl.signal)
      .then((all) => {
        const shipped = shippedEntries(all);
        if (shipped[0]) markChangelogSeen(shipped[0].version); // read here → no "Neu" dialog for it
        setEntries(shipped);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setFailed(true);
      });
    return () => ctrl.abort();
  }, []);

  const shown = useMemo(() => (entries ? searchChangelog(entries, query) : []), [entries, query]);
  const version = displayVersion();

  return (
    <AppShell whatsNew={false}>
      {() => (
        <section className="max-w-3xl">
          <SectionTitle eyebrow={version ? `Version ${version}` : "Entwicklungsversion"} title="Änderungen" />
          <label className="relative mb-8 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen – Text oder Version, z. B. 0.1"
              className="w-full rounded-xl bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-sky-400/60"
            />
          </label>
          {failed ? (
            <p className="text-sm text-slate-400">Die Änderungsliste ist gerade nicht erreichbar.</p>
          ) : entries == null ? (
            <p className="text-sm text-slate-500">Wird geladen …</p>
          ) : shown.length ? (
            <ChangelogEntries entries={shown} />
          ) : (
            <p className="text-sm text-slate-400">{query ? `Nichts gefunden für „${query}“.` : "Noch keine Einträge."}</p>
          )}
        </section>
      )}
    </AppShell>
  );
}
