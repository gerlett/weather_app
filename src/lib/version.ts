/**
 * The site version and the commit it was built from, both built in.
 *
 * There is no stored version number: `<major>.<minor>.<patch>` comes from the
 * repo-root `version.json` (major, minor, offset) and the git commit count –
 * computed by `scripts/app-version.ts` and passed by `deploy-web.sh` as
 * NEXT_PUBLIC_APP_VERSION, beside NEXT_PUBLIC_GIT_HASH. It rises with every
 * commit on its own.
 *
 * A build that passes neither (`npm run dev`, a bare `npm run build`) has no
 * number and is labelled a development build instead.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

/** Short commit hash, e.g. `a1b2c3d` (`-dirty` for uncommitted changes); may be empty. */
export const GIT_HASH = process.env.NEXT_PUBLIC_GIT_HASH ?? "";

/**
 * Unique id of this deploy (version, commit, build time) – the same value as
 * `buildId` in the server's /version.json, which is how an open tab notices a
 * newer deploy (UpdateWatcher). Empty for development builds.
 */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/** `0.1.4 (a1b2c3d)`, or `null` for a development build. */
export function displayVersion(version = APP_VERSION, hash = GIT_HASH): string | null {
  if (!version) return null;
  return hash ? `${version} (${hash})` : version;
}

/** Parses `1.2.3` into numbers; `null` if it is not of that form. */
export function parseVersion(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Numeric comparison of two `x.y.z` versions (negative: a < b). Unparsable sorts first. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return (pa ? 1 : 0) - (pb ? 1 : 0);
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}
