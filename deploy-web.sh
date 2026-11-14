#!/usr/bin/env bash
# Build the weather website (static Next.js export) and deploy it to the
# Docker host, following the same pattern as ../fotografie_crm/tool/deploy-web.sh:
#
#   /docker/apps/wetter-strudengau/            on 192.168.178.95
#     ├─ docker-compose.yaml   nginx (port 8883) + cloudflared tunnel
#     ├─ nginx.conf
#     ├─ .env                  CLOUDFLARED_TUNNEL_TOKEN (git-ignored, never committed)
#     └─ html/                 the build – replaced on every deploy, bind-mounted read-only
#
# Run from git-bash / WSL. Everything travels as ONE tar stream over ONE ssh
# connection (one password prompt at most; `ssh-copy-id root@192.168.178.95`
# removes it entirely).
#
# Usage:
#   ./deploy-web.sh                   # build + deploy (+ provision on first deploy)
#   ./deploy-web.sh --skip-build      # deploy the existing out/
#   ./deploy-web.sh --no-provision    # only replace html/, never touch the stack
#   ./deploy-web.sh --update-stack    # also replace docker-compose.yaml/nginx.conf/om-proxy.inc on the
#                                     # host (old copies are backed up) and restart the stack
#
# First deploy: docker-compose.yaml, nginx.conf and (if present) deploy/.env ride
# along and the stack is brought up – but ONLY if the host has no
# docker-compose.yaml yet. Afterwards the host's stack files are left alone,
# since a host copy may carry hand-edits. An .env the host is missing is still
# installed (it has no edits to lose), and the tunnel is started then.
#
# The cloudflared container only starts when .env holds a token (compose profile
# `tunnel`); without one the site is still served on http://<host>:8883.
#
# Overridable via env: REMOTE_USER, REMOTE_HOST, CONTAINER, PORT
#   REMOTE_HOST=10.0.0.5 ./deploy-web.sh
set -euo pipefail

cd "$(dirname "$0")"

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-192.168.178.95}"
CONTAINER="${CONTAINER:-wetter-strudengau}"
PORT="${PORT:-8883}"
APP_DIR="/docker/apps/$CONTAINER"
STACK="deploy"

SKIP_BUILD=0
NO_PROVISION=0
UPDATE_STACK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift ;;
    --no-provision) NO_PROVISION=1; shift ;;
    --update-stack) UPDATE_STACK=1; shift ;;
    -h | --help) sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done
if [ "$NO_PROVISION" -eq 1 ] && [ "$UPDATE_STACK" -eq 1 ]; then
  echo "--no-provision and --update-stack contradict each other." >&2
  exit 1
fi

# <major>.<minor>.<patch>: version.json + git commit count (scripts/app-version.ts).
VERSION="$(node --no-warnings scripts/app-version.ts)"
GIT_HASH="$(git rev-parse --short HEAD)"
DIRTY=""
git diff --quiet HEAD 2>/dev/null || DIRTY="-dirty"
BUILD_ID="$VERSION-$GIT_HASH$DIRTY-$(date -u +%Y%m%d%H%M%S)"

for f in docker-compose.yaml nginx.conf om-proxy.inc remote-install.sh bridge/server.mjs bridge/Dockerfile bridge/package-lock.json; do
  [ -f "$STACK/$f" ] || { echo "'$STACK/$f' not found." >&2; exit 1; }
done

# Home Assistant bridge credentials – optional, without them the bridge serves JSON only.
if [ ! -f "$STACK/.env.bridge" ]; then
  echo "Note: no $STACK/.env.bridge – the Home Assistant bridge runs without MQTT." >&2
  echo "      Copy $STACK/.env.bridge.example to $STACK/.env.bridge and fill it in." >&2
fi

# The tunnel token is optional, but say clearly what happens without it.
HAS_ENV=0
if [ -f "$STACK/.env" ]; then
  HAS_ENV=1
  if ! grep -qE '^CLOUDFLARED_TUNNEL_TOKEN=.+' "$STACK/.env"; then
    echo "Note: $STACK/.env has no CLOUDFLARED_TUNNEL_TOKEN – the tunnel will not start." >&2
  fi
else
  echo "Note: no $STACK/.env – deploying without Cloudflare tunnel." >&2
  echo "      Copy $STACK/.env.example to $STACK/.env, add the token and deploy again." >&2
fi

# --- ssh: ask for the password now, not after the build -----------------------
# Same approach as the CRM: a ControlMaster connection where it works. Not under
# Git for Windows – its ssh mux breaks (`mux_client_request_session: read from
# master failed`); there the single upload connection prompts instead.
STAGE=""
SSH_CONTROL=""
SSH_OPTS=()
cleanup() {
  [ -z "$STAGE" ] || rm -rf "$STAGE"
  [ -z "$SSH_CONTROL" ] \
    || ssh -o ControlPath="$SSH_CONTROL" -O exit "$REMOTE_USER@$REMOTE_HOST" 2>/dev/null \
    || true
}
trap cleanup EXIT

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) ;;
  *)
    SSH_CONTROL="$(mktemp -u "${TMPDIR:-/tmp}/deploy-ssh-XXXXXX")"
    echo "Connecting to $REMOTE_USER@$REMOTE_HOST ..."
    if ssh -fN -o ControlMaster=yes -o ControlPersist=yes \
        -o ControlPath="$SSH_CONTROL" -o ServerAliveInterval=30 \
        "$REMOTE_USER@$REMOTE_HOST"; then
      SSH_OPTS=(-o ControlPath="$SSH_CONTROL")
    else
      SSH_CONTROL=""
      echo "Could not keep the ssh connection open; the password will be asked at the upload." >&2
    fi
    ;;
esac

# --- build ---------------------------------------------------------------------
if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "Building $BUILD_ID ..."
  [ -d node_modules ] || npm ci
  npm run lint
  rm -rf out
  # Same-origin caching proxy on the server (deploy/nginx.conf). The MSYS guards keep
  # Git Bash from rewriting the leading-slash value into a Windows path.
  # Version + commit are built in and shown in the footer (src/lib/version.ts).
  MSYS_NO_PATHCONV=1 MSYS2_ENV_CONV_EXCL="NEXT_PUBLIC_OM_PROXY" NEXT_PUBLIC_OM_PROXY=/api/om \
    NEXT_PUBLIC_APP_VERSION="$VERSION" NEXT_PUBLIC_GIT_HASH="$GIT_HASH$DIRTY" npm run build
fi
[ -f out/index.html ] || { echo "out/index.html not found – build first (without --skip-build)." >&2; exit 1; }
[ -f out/auswertung.html ] || { echo "out/auswertung.html missing – incomplete build?" >&2; exit 1; }
# The build must talk to the server's proxy, not to Open-Meteo directly (and the
# value must not have been mangled into a Windows path by Git Bash).
grep -rqs '"/api/om"' out/_next/static || grep -rqs '/api/om/forecast' out/_next/static || {
  echo "Build does not use the /api/om proxy – rebuild without --skip-build." >&2
  exit 1
}
grep -rqsF "\"$VERSION\"" out/_next/static || {
  echo "Build does not carry version $VERSION – rebuild without --skip-build." >&2
  exit 1
}

# --- stage: html/ + stack files -----------------------------------------------
STAGE="$(mktemp -d)"
mkdir -p "$STAGE/html" "$STAGE/.stack"
cp -a out/. "$STAGE/html/"
printf '{"version":"%s","commit":"%s%s","buildId":"%s"}\n' "$VERSION" "$GIT_HASH" "$DIRTY" "$BUILD_ID" > "$STAGE/html/version.json"
cp "$STACK/docker-compose.yaml" "$STACK/nginx.conf" "$STACK/om-proxy.inc" "$STACK/remote-install.sh" "$STAGE/.stack/"
if [ "$HAS_ENV" -eq 1 ]; then cp "$STACK/.env" "$STAGE/.stack/.env"; fi
if [ -f "$STACK/.env.bridge" ]; then cp "$STACK/.env.bridge" "$STAGE/.stack/.env.bridge"; fi

# Bridge build context; its station list is exported from the site's own definitions
# (src/lib/locations.ts – Node runs the TypeScript file directly), so both never drift apart.
mkdir -p "$STAGE/.stack/bridge"
cp "$STACK/bridge/server.mjs" "$STACK/bridge/package.json" "$STACK/bridge/package-lock.json" \
   "$STACK/bridge/Dockerfile" "$STACK/bridge/.dockerignore" "$STAGE/.stack/bridge/"
node --no-warnings -e 'import("./src/lib/locations.ts").then(m => process.stdout.write(JSON.stringify(m.REGIONAL_STATIONS, null, 1)))' \
  > "$STAGE/.stack/bridge/stations.json"
cp "$STAGE/.stack/bridge/stations.json" "$STACK/bridge/stations.json"   # keep the local copy current

echo "Deploying $BUILD_ID to $REMOTE_HOST:$APP_DIR (container '$CONTAINER', port $PORT) ..."

# One ssh stream: unpack to .incoming/, then remote-install.sh (shipped inside
# the payload) swaps html/ and handles the stack. See deploy/remote-install.sh.
REMOTE_CMD="rm -rf '$APP_DIR/.incoming' && mkdir -p '$APP_DIR/.incoming'"
REMOTE_CMD="$REMOTE_CMD && tar xzf - -C '$APP_DIR/.incoming'"
REMOTE_CMD="$REMOTE_CMD && bash '$APP_DIR/.incoming/.stack/remote-install.sh' '$APP_DIR' '$CONTAINER' '$PORT' $NO_PROVISION $UPDATE_STACK"
tar czf - -C "$STAGE" . | ssh ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} "$REMOTE_USER@$REMOTE_HOST" "$REMOTE_CMD"

echo
echo "Deploy complete: $BUILD_ID"
echo "  LAN:    http://$REMOTE_HOST:$PORT"
echo "  Public: https://wetter.softwarekstatt.at (Cloudflare tunnel)"
