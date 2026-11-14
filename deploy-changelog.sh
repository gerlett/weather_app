#!/usr/bin/env bash
# Deploy the website changelog to the Docker host – no build, no restart.
#
#   deploy/changelog/changelog.json -> /docker/apps/wetter-strudengau/changelog/changelog.json
#
# nginx serves /changelog/ from that directory (bind mount beside html/, see
# deploy/changelog/README.md) and reads the file per request, so the next page
# load sees the edit. The mount itself comes with the stack: once per host,
#   ./deploy-web.sh --update-stack
#
# Usage:
#   ./deploy-changelog.sh
#   REMOTE_HOST=10.0.0.5 ./deploy-changelog.sh
set -euo pipefail

cd "$(dirname "$0")"

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-192.168.178.95}"
CONTAINER="${CONTAINER:-wetter-strudengau}"
APP_DIR="/docker/apps/$CONTAINER"
CHANGELOG="deploy/changelog/changelog.json"

[ -f "$CHANGELOG" ] || { echo "'$CHANGELOG' not found." >&2; exit 1; }
node --no-warnings -e '
  const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (!Array.isArray(j.entries)) throw new Error("no \"entries\" array");
  for (const e of j.entries) if (!/^\d+\.\d+\.\d+$/.test(e.version ?? "")) throw new Error("bad version: " + JSON.stringify(e.version));
' "$CHANGELOG" || { echo "'$CHANGELOG' is not a valid changelog." >&2; exit 1; }

echo "Pushing $CHANGELOG to $REMOTE_USER@$REMOTE_HOST:$APP_DIR/changelog/ ..."
# Written to a temp file and renamed: a reader never sees a half-written file.
ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p '$APP_DIR/changelog' \
  && cat > '$APP_DIR/changelog/.changelog.json.tmp' \
  && chmod 644 '$APP_DIR/changelog/.changelog.json.tmp' \
  && mv '$APP_DIR/changelog/.changelog.json.tmp' '$APP_DIR/changelog/changelog.json'" < "$CHANGELOG"

echo "Done. Verify:  https://wetter.softwarekstatt.at/changelog/changelog.json"
