# Changelog

`changelog.json` here is the website's changelog. The site shows it on
`/aenderungen` (every release, with a search) and, once after an update, in a
"Neu auf der Website" dialog when the site opens – see `src/lib/changelog.ts`. Same scheme as
`../fotografie_crm/deploy/changelog/`.

It is **never part of the build**: nginx serves it from a directory beside
`html/`, so a correction goes out without a rebuild:

```bash
./deploy-changelog.sh
```

| Where | What |
|---|---|
| Repo | `deploy/changelog/changelog.json` (this file) |
| Host | `/docker/apps/wetter-strudengau/changelog/changelog.json` – beside `html/`, so a site deploy neither ships nor removes it |
| nginx | `location /changelog/` in `deploy/nginx.conf`, read-only bind mount (`deploy/docker-compose.yaml`) |
| Site | `/changelog/changelog.json`; `NEXT_PUBLIC_CHANGELOG_URL` overrides it (e.g. for `npm run dev`) |

The location sends `Access-Control-Allow-Origin: *` (public release notes), so
a dev server on `localhost` can read the live file, and `Cache-Control: no-cache`,
so an edit is seen on the next page load.

## Format

```json
{
  "entries": [
    { "version": "0.1.4", "date": "2026-11-20", "items": [{ "de": "Deutscher Text" }] }
  ]
}
```

- **`version`** is the site version that ships the change – the number the
  footer shows for that build (`<major>.<minor>.<patch>`, see
  `scripts/app-version.ts`). The patch rises with every commit, so write the
  entry **after** the build is deployed, with its version. A build never
  announces an entry newer than itself, so an entry written too high stays
  hidden until a build reaches it.
- **`date`** is optional (`YYYY-MM-DD`).
- **`items`**: one object per line, text per language code (`de`, falls back
  to `en`, then whatever is there); a plain string works too.
- Order does not matter; the site sorts newest first. An unreadable entry is
  skipped, the rest still show.
