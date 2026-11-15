import type { ChangelogEntry } from "@/lib/changelog";
import { formatChangelogDate, itemIn } from "@/lib/changelog";
import { useLang } from "@/lib/i18n";

/** One release per block: version, date, its lines. Shared by the "Neu" dialog and the Änderungen page. */
export function ChangelogEntries({ entries, compact = false }: { entries: ChangelogEntry[]; compact?: boolean }) {
  useLang(); // re-render on a language switch
  return (
    <ol className={compact ? "space-y-4" : "space-y-8"}>
      {entries.map((e) => (
        <li key={e.version}>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-sky-200 ring-1 ring-sky-400/30">
              {e.version}
            </span>
            {e.date && <span className="text-xs text-slate-500">{formatChangelogDate(e.date)}</span>}
          </p>
          <ul className={`mt-2 list-disc space-y-1.5 pl-5 text-slate-300 ${compact ? "text-sm" : "text-sm sm:text-base"}`}>
            {e.items.map((t, i) => (
              <li key={i}>{itemIn(t)}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
