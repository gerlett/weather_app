#!/usr/bin/env bash
# Runs ON THE DOCKER HOST, invoked by deploy-web.sh after the payload was
# unpacked to <app_dir>/.incoming/ (html/ + .stack/). Not meant to be run by hand.
#
#   remote-install.sh <app_dir> <container> <port> <no_provision 0|1> <update_stack 0|1>
set -euo pipefail

APP_DIR="$1" CONTAINER="$2" PORT="$3" NO_PROVISION="$4" UPDATE_STACK="$5"
IN="$APP_DIR/.incoming"
STACK_FILES="docker-compose.yaml nginx.conf om-proxy.inc"
ENV_FILES=".env .env.bridge"
cd "$APP_DIR"

has_service() { grep -qE "^  $1:" docker-compose.yaml 2>/dev/null; }

# Compose with the tunnel only when .env carries a token.
compose_up() {
  local profile=()
  if [ -f .env ] && grep -qE '^CLOUDFLARED_TUNNEL_TOKEN=.+' .env; then profile=(--profile tunnel); fi
  docker compose "${profile[@]}" up -d "$@"
  if [ "${#profile[@]}" -gt 0 ]; then echo "Stack up (incl. Cloudflare tunnel)."; else echo "Stack up (no tunnel token in $APP_DIR/.env)."; fi
}

validate_nginx() {
  docker compose run --rm --no-deps -T "$CONTAINER" nginx -t
}

# Env files hold the only copies of their secrets: installed when missing, never overwritten.
install_missing_env() {
  local installed=1 f
  for f in $ENV_FILES; do
    if [ -f "$IN/.stack/$f" ] && [ ! -f "$f" ]; then
      mv "$IN/.stack/$f" "$f"
      chmod 600 "$f"
      echo "Installed missing $f."
      installed=0
    fi
  done
  return $installed
}

# Bridge code is generated/committed code, never hand-edited on the host → always synced.
BRIDGE_CHANGED=0
sync_bridge() {
  [ -d "$IN/.stack/bridge" ] || return 0
  if [ -d bridge ] && diff -rq "$IN/.stack/bridge" bridge >/dev/null 2>&1; then return 0; fi
  rm -rf bridge
  cp -a "$IN/.stack/bridge" bridge
  BRIDGE_CHANGED=1
  echo "Bridge code updated."
}

# --- 1. replace the site in place ---------------------------------------------
# Contents are swapped, not the directory: the container bind-mounts html/ by
# inode, so a renamed/new directory would keep serving the old build.
#
# Everything is replaced except the content-hashed files in _next/static/: a tab
# still running the previous build may load one of its chunks later (e.g. when
# navigating), so old ones are kept for 14 days. Same name = same content, so
# keeping them never serves anything stale.
mkdir -p html changelog   # changelog/: shipped with every deploy, or alone by deploy-changelog.sh
find html -mindepth 1 -maxdepth 1 ! -name _next -exec rm -rf {} +
if [ -d html/_next ]; then
  find html/_next -mindepth 1 -maxdepth 1 ! -name static -exec rm -rf {} +
  find html/_next/static -type f -mtime +14 -delete 2>/dev/null || true
  find html/_next/static -mindepth 1 -type d -empty -delete 2>/dev/null || true
fi
cp -a "$IN/html/." html/
echo "Site updated ($(cat html/version.json 2>/dev/null || echo 'no version.json'))."

# The changelog travels with every deploy; written via temp file + rename so
# nginx never serves a half-written file.
if [ -f "$IN/.stack/changelog.json" ]; then
  cp "$IN/.stack/changelog.json" changelog/.changelog.json.tmp
  chmod 644 changelog/.changelog.json.tmp
  mv changelog/.changelog.json.tmp changelog/changelog.json
  echo "Changelog updated."
fi

# --- 2. the stack ----------------------------------------------------------------
if [ "$NO_PROVISION" = 1 ]; then
  echo "--no-provision: stack left untouched."
elif [ ! -f docker-compose.yaml ]; then
  echo "No stack on this host yet – provisioning $CONTAINER ..."
  if command -v ss >/dev/null && ss -ltnH "sport = :$PORT" | grep -q .; then
    echo "Port $PORT is already in use on this host – refusing to provision." >&2
    exit 1
  fi
  for f in $STACK_FILES; do
    if [ -f "$f" ]; then echo "Kept existing $f."; else mv "$IN/.stack/$f" "$f"; fi
  done
  install_missing_env || true
  sync_bridge
  validate_nginx
  compose_up --build
  echo "Container $CONTAINER is up on port $PORT."
elif [ "$UPDATE_STACK" = 1 ]; then
  STAMP="$(date +%Y%m%d-%H%M%S)"
  for f in $STACK_FILES; do
    if [ -f "$f" ] && ! cmp -s "$IN/.stack/$f" "$f"; then
      cp -p "$f" "$f.$STAMP"
      echo "Backed up $f as $f.$STAMP"
    fi
    cp "$IN/.stack/$f" "$f"
  done
  install_missing_env || true
  sync_bridge
  validate_nginx
  # single-file bind mounts are pinned by inode → recreate nginx to pick up the new config
  compose_up --build --force-recreate
else
  echo "Existing stack found – stack files left untouched (use --update-stack to replace)."
  sync_bridge
  if install_missing_env; then
    compose_up --build
  elif [ "$BRIDGE_CHANGED" = 1 ]; then
    if has_service wetter-bridge; then
      docker compose up -d --build wetter-bridge
    else
      echo "Note: the host's docker-compose.yaml has no wetter-bridge service yet – run with --update-stack once."
    fi
  fi
fi

rm -rf "$IN"
docker compose ps
