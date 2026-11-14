import { APP_VERSION, compareVersions, parseVersion } from "./version";

/**
 * The changelog is NOT part of the build: nginx serves `deploy/changelog/changelog.json`
 * from a directory beside html/ (see deploy/changelog/README.md), so a correction
 * goes out with `deploy-changelog.sh` and no rebuild.
 *
 * For `npm run dev`, point it at the live file (the location allows any origin):
 *   NEXT_PUBLIC_CHANGELOG_URL=https://wetter.softwarekstatt.at/changelog/changelog.json
 */
export const CHANGELOG_URL = process.env.NEXT_PUBLIC_CHANGELOG_URL || "/changelog/changelog.json";

export type ChangelogEntry = { version: string; date?: string; items: string[] };

/** Text of one item: German, then English, then whatever is there. */
function itemText(item: unknown): string | null {
  if (typeof item === "string") return item.trim() || null;
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  for (const v of [o.de, o.en, ...Object.values(o)]) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/** Readable entries, newest first. An unreadable entry is skipped, the rest still count. */
export function parseChangelog(json: unknown): ChangelogEntry[] {
  const raw = json && typeof json === "object" ? (json as { entries?: unknown }).entries : null;
  if (!Array.isArray(raw)) return [];
  const out: ChangelogEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const { version, date, items } = e as Record<string, unknown>;
    if (typeof version !== "string" || !parseVersion(version)) continue;
    const texts = Array.isArray(items) ? items.map(itemText).filter((t): t is string => !!t) : [];
    if (!texts.length) continue;
    out.push({ version, date: typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined, items: texts });
  }
  return out.sort((a, b) => compareVersions(b.version, a.version));
}

/** Throws when the file cannot be read – callers show nothing in that case. */
export async function fetchChangelog(signal?: AbortSignal): Promise<ChangelogEntry[]> {
  const res = await fetch(CHANGELOG_URL, { cache: "no-cache", signal });
  if (!res.ok) throw new Error(`changelog: HTTP ${res.status}`);
  return parseChangelog(await res.json());
}

/** Entries this build actually has – never newer than the running version (a development build has no bound). */
export function shippedEntries(entries: ChangelogEntry[], build = APP_VERSION): ChangelogEntry[] {
  return build ? entries.filter((e) => compareVersions(e.version, build) <= 0) : entries;
}

/** Entries newer than the last one this browser showed. */
export function unseenEntries(entries: ChangelogEntry[], lastSeen: string | null, build = APP_VERSION): ChangelogEntry[] {
  const shipped = shippedEntries(entries, build);
  if (!lastSeen) return shipped.slice(0, 1);
  return shipped.filter((e) => compareVersions(e.version, lastSeen) > 0);
}

/**
 * Search: case-insensitive on the text – an entry keeps only its matching lines –
 * or on the version (prefix, e.g. `0.1` or `0.1.4`), which keeps the whole entry.
 */
export function searchChangelog(entries: ChangelogEntry[], query: string): ChangelogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  // `0.1` → every 0.1.x, `0.1.1` → exactly 0.1.1 (not 0.1.10)
  const versionPrefix = /^\d+(\.\d+)*\.?$/.test(q) ? q.replace(/\.?$/, ".") : null;
  const out: ChangelogEntry[] = [];
  for (const e of entries) {
    if (versionPrefix && `${e.version}.`.startsWith(versionPrefix)) {
      out.push(e);
      continue;
    }
    const items = e.items.filter((t) => t.toLowerCase().includes(q));
    if (items.length) out.push({ ...e, items });
  }
  return out;
}

/** German date, e.g. `14. November 2026`. */
export function formatChangelogDate(date?: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" });
}
