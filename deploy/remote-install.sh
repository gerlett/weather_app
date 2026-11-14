#!/usr/bin/env bash
# Runs ON THE DOCKER HOST, invoked by deploy-web.sh after the payload was
# unpacked to <app_dir>/.incoming/ (html/ + .stack/). Not meant to be run by hand.
#
#   remote-install.sh <app_dir> <container> <port> <no_provision 0|1> <update_stack 0|1>
set -euo pipefail

APP_DIR="$1" CONTAINER="$2" PORT="$3" NO_PROVISION="$4" UPDATE_STACK="$5"
IN="$APP_DIR/.incoming"
cd "$APP_DIR"

# Compose with the tunnel only when .env carries a token.
compose_up() {
  local extra=("$@")
  if [ -f .env ] && grep -qE '^CLOUDFLARED_TUNNEL_TOKEN=.+' .env; then
    docker compose --profile tunnel up -d "${extra[@]}"
    echo "Stack up (web + Cloudflare tunnel)."
  else
    docker compose up -d "${extra[@]}"
    echo "Stack up (web only – no tunnel token in $APP_DIR/.env)."
  fi
}

validate_nginx() {
  docker compose run --rm --no-deps -T "$CONTAINER" nginx -t
}

install_env_if_missing() {
  if [ -f "$IN/.stack/.env" ] && [ ! -f .env ]; then
    mv "$IN/.stack/.env" .env
    chmod 600 .env
    echo "Installed missing .env."
    return 0
  fi
  return 1
}

# --- 1. replace the site in place ---------------------------------------------
# Contents are swapped, not the directory: the container bind-mounts html/ by
# inode, so a renamed/new directory would keep serving the old build.
mkdir -p html
find html -mindepth 1 -delete
cp -a "$IN/html/." html/
echo "Site updated ($(cat html/version.json 2>/dev/null || echo 'no version.json'))."

# --- 2. the stack ----------------------------------------------------------------
if [ "$NO_PROVISION" = 1 ]; then
  echo "--no-provision: stack left untouched."
elif [ ! -f docker-compose.yaml ]; then
  echo "No stack on this host yet – provisioning $CONTAINER ..."
  if command -v ss >/dev/null && ss -ltnH "sport = :$PORT" | grep -q .; then
    echo "Port $PORT is already in use on this host – refusing to provision." >&2
    echo "Free it or deploy with PORT=<other> (and adjust docker-compose.yaml)." >&2
    exit 1
  fi
  mv "$IN/.stack/docker-compose.yaml" docker-compose.yaml
  [ -f nginx.conf ] && echo "Kept existing nginx.conf." || mv "$IN/.stack/nginx.conf" nginx.conf
  install_env_if_missing || true
  validate_nginx
  compose_up
  echo "Container $CONTAINER is up on port $PORT."
elif [ "$UPDATE_STACK" = 1 ]; then
  STAMP="$(date +%Y%m%d-%H%M%S)"
  for f in docker-compose.yaml nginx.conf; do
    if ! cmp -s "$IN/.stack/$f" "$f"; then
      cp -p "$f" "$f.$STAMP"
      echo "Backed up $f as $f.$STAMP"
    fi
    cp "$IN/.stack/$f" "$f"
  done
  install_env_if_missing || true
  validate_nginx
  # nginx.conf is a single-file bind mount (pinned by inode) → recreate to pick it up.
  compose_up --force-recreate
else
  echo "Existing stack found – docker-compose.yaml/nginx.conf left untouched (use --update-stack to replace)."
  if install_env_if_missing; then
    compose_up
  fi
fi

rm -rf "$IN"
docker compose ps
