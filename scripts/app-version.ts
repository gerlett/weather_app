// Prints the site version for the commit that is checked out:
// `<major>.<minor>.<patch>`, with major, minor and an offset from the repo-root
// `version.json` and the patch counted by git (same scheme as ../fotografie_crm).
//
//   node scripts/app-version.ts              # e.g. 0.1.3
//   node scripts/app-version.ts --start 0.2  # rewrite version.json so the
//                                            # next commit is 0.2.0
//
// patch = (number of commits reachable from HEAD) - offset. The offset is the
// commit count of the commit that started this minor, so that commit is
// `<major>.<minor>.0` and every later one counts up by itself – nothing has to be
// bumped or committed after a deploy. The patch is deliberately not stored.
//
// deploy-web.sh runs this and builds the result in as NEXT_PUBLIC_APP_VERSION,
// beside NEXT_PUBLIC_GIT_HASH; the footer shows both (src/lib/version.ts). Two
// branches can reach the same count, which is why the hash is shown beside it.
//
// Refused rather than trusted: a shallow clone (counts only what it fetched) and
// a checkout older than the offset (negative patch).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "version.json";

type Base = { major: number; minor: number; offset: number };

function fail(msg: string): never {
  process.stderr.write(`app-version: ${msg}\n`);
  process.exit(1);
}

function git(...args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    fail(`git ${args.join(" ")} failed: ${(e as Error).message}`);
  }
}

function parse(source: string): Base {
  let v: unknown;
  try {
    v = (JSON.parse(source) as { version?: unknown }).version;
  } catch {
    fail(`${FILE} is not valid JSON`);
  }
  if (!v || typeof v !== "object") fail(`${FILE}: no "version" object`);
  const field = (k: keyof Base) => {
    const x = (v as Record<string, unknown>)[k];
    if (Number.isInteger(x) && (x as number) >= 0) return x as number;
    fail(`${FILE}: "version.${k}" must be a non-negative integer, not ${JSON.stringify(x)}`);
  };
  return { major: field("major"), minor: field("minor"), offset: field("offset") };
}

function commitCount(): number {
  if (git("rev-parse", "--is-shallow-repository") === "true") {
    fail("shallow clone: the commit count would be wrong. Fetch the full history (git fetch --unshallow).");
  }
  return Number.parseInt(git("rev-list", "--count", "HEAD"), 10);
}

const args = process.argv.slice(2);
const start = args.length === 2 && args[0] === "--start" ? args[1] : null;
if (args.length && start == null) {
  process.stderr.write("usage: node scripts/app-version.ts [--start <major>.<minor>]\n");
  process.exit(64);
}

const count = commitCount();
if (start != null) {
  const m = /^(\d+)\.(\d+)$/.exec(start);
  if (!m) fail("--start takes <major>.<minor>, e.g. 0.2");
  // The edit is committed next, and that commit is the new minor's .0.
  const base: Base = { major: Number(m[1]), minor: Number(m[2]), offset: count + 1 };
  writeFileSync(FILE, JSON.stringify({ version: base }, null, 2) + "\n");
  process.stdout.write(`Wrote ${FILE}: the commit that includes it is ${base.major}.${base.minor}.0.\n`);
} else {
  let source: string;
  try {
    source = readFileSync(FILE, "utf8");
  } catch {
    fail(`cannot read ${FILE}`);
  }
  const base = parse(source);
  const patch = count - base.offset;
  if (patch < 0) {
    fail(`HEAD has ${count} commits, fewer than the offset ${base.offset} in ${FILE}: this checkout is older than ${base.major}.${base.minor}.0.`);
  }
  process.stdout.write(`${base.major}.${base.minor}.${patch}\n`);
}
