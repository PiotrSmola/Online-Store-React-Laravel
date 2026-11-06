#!/usr/bin/env bash
#
# Builds and starts the Online Store (Laravel API + React + MySQL) in Docker.
#
#  - checks that Docker / Docker Compose are available,
#  - picks free host ports (if a preferred port is taken, the next free one is used;
#    nothing that is already running gets stopped - except this project's own containers),
#  - generates the root .env file (APP_KEY, DB and admin passwords) on first run and reuses it later,
#  - builds the images, starts the stack and waits until the shop responds.
#
# Usage:   ./setup.sh [--app-port N] [--backend-port N] [--db-port N] [--mailpit-port N] [--no-build]
# Re-run the script at any time to rebuild/redeploy.

set -euo pipefail

APP_PORT_PREF=8080
BACKEND_PORT_PREF=8000
DB_PORT_PREF=3306
MAILPIT_PORT_PREF=8025
BUILD_FLAG="--build"
PROJECT_NAME="online-store"

while [ $# -gt 0 ]; do
    case "$1" in
        --app-port)     APP_PORT_PREF="$2"; shift 2 ;;
        --backend-port) BACKEND_PORT_PREF="$2"; shift 2 ;;
        --db-port)      DB_PORT_PREF="$2"; shift 2 ;;
        --mailpit-port) MAILPIT_PORT_PREF="$2"; shift 2 ;;
        --no-build)     BUILD_FLAG=""; shift ;;
        -h|--help)      sed -n '2,13p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

cd "$(dirname "$0")"
ENV_FILE=".env"

step() { printf '\033[36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33mWARNING: %s\033[0m\n' "$*"; }
die()  { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# --- 1. Docker checks -------------------------------------------------------
step "Checking Docker..."
command -v docker >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || die "Docker is installed but not running (or you lack permissions). Start Docker and try again."
if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
else
    die "Docker Compose is not available."
fi

# --- 2. Stop this project's containers (so their own ports are not seen as taken)
step "Stopping previous '$PROJECT_NAME' containers (if any)..."
"${COMPOSE[@]}" down --remove-orphans >/dev/null 2>&1 || true

# --- helpers -----------------------------------------------------------------
port_in_use() {
    local port=$1
    if command -v ss >/dev/null 2>&1; then
        [ -n "$(ss -Hltn "sport = :$port" 2>/dev/null)" ] && return 0
    elif command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && return 0
    elif command -v netstat >/dev/null 2>&1; then
        netstat -an 2>/dev/null | grep -Eiq "[.:]$port[[:space:]].*LISTEN" && return 0
    fi
    # Fallback / extra check: can we connect to it?
    (exec 3<>"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1 && return 0
    return 1
}

find_free_port() {
    local port=$1; shift
    local max=$((port + 200))
    while [ "$port" -le "$max" ]; do
        local skip=0
        for excluded in "$@"; do [ "$port" = "$excluded" ] && skip=1; done
        if [ "$skip" = 0 ] && ! port_in_use "$port"; then
            echo "$port"; return 0
        fi
        port=$((port + 1))
    done
    die "No free port found starting from $1"
}

env_get() { # env_get FILE KEY
    [ -f "$1" ] || return 0
    grep -E "^$2=" "$1" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true
}

random_string() {
    LC_ALL=C tr -dc 'A-HJ-NP-Za-km-z2-9' </dev/urandom 2>/dev/null | head -c "${1:-24}" || true
}

new_app_key() {
    if command -v openssl >/dev/null 2>&1; then
        echo "base64:$(openssl rand -base64 32)"
    else
        echo "base64:$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
    fi
}

# --- 3. Configuration / secrets ---------------------------------------------
EXAMPLE=".env.docker.example"
APP_KEY="$(env_get "$ENV_FILE" APP_KEY)";            [ -n "$APP_KEY" ] || APP_KEY="$(new_app_key)"
DB_DATABASE="$(env_get "$ENV_FILE" DB_DATABASE)";    [ -n "$DB_DATABASE" ] || DB_DATABASE="$(env_get "$EXAMPLE" DB_DATABASE)"
DB_USERNAME="$(env_get "$ENV_FILE" DB_USERNAME)";    [ -n "$DB_USERNAME" ] || DB_USERNAME="$(env_get "$EXAMPLE" DB_USERNAME)"
DB_PASSWORD="$(env_get "$ENV_FILE" DB_PASSWORD)"
DB_ROOT_PASSWORD="$(env_get "$ENV_FILE" DB_ROOT_PASSWORD)"
if [ -z "$DB_PASSWORD" ] && docker volume inspect "${PROJECT_NAME}_db_data" >/dev/null 2>&1; then
    # Database volume was created earlier with the default credentials - keep them.
    DB_PASSWORD="$(env_get "$EXAMPLE" DB_PASSWORD)"
    DB_ROOT_PASSWORD="$(env_get "$EXAMPLE" DB_ROOT_PASSWORD)"
fi
[ -n "$DB_PASSWORD" ] || DB_PASSWORD="$(random_string 24)"
[ -n "$DB_ROOT_PASSWORD" ] || DB_ROOT_PASSWORD="$(random_string 24)"
DOCKER_SUBNET="$(env_get "$ENV_FILE" DOCKER_SUBNET)"; [ -n "$DOCKER_SUBNET" ] || DOCKER_SUBNET="$(env_get "$EXAMPLE" DOCKER_SUBNET)"
FRONTEND_IP="$(env_get "$ENV_FILE" FRONTEND_IP)";     [ -n "$FRONTEND_IP" ] || FRONTEND_IP="$(env_get "$EXAMPLE" FRONTEND_IP)"
APP_DEBUG="$(env_get "$ENV_FILE" APP_DEBUG)";         [ -n "$APP_DEBUG" ] || APP_DEBUG="$(env_get "$EXAMPLE" APP_DEBUG)"
MAIL_FROM_ADDRESS="$(env_get "$ENV_FILE" MAIL_FROM_ADDRESS)"; [ -n "$MAIL_FROM_ADDRESS" ] || MAIL_FROM_ADDRESS="$(env_get "$EXAMPLE" MAIL_FROM_ADDRESS)"
ADMIN_EMAIL="$(env_get "$ENV_FILE" ADMIN_EMAIL)";     [ -n "$ADMIN_EMAIL" ] || ADMIN_EMAIL="$(env_get "$EXAMPLE" ADMIN_EMAIL)"
ADMIN_PASSWORD="$(env_get "$ENV_FILE" ADMIN_PASSWORD)"; [ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(random_string 20)"

# --- 4. Free ports ------------------------------------------------------------
step "Looking for free ports..."
APP_PORT="$(find_free_port "$APP_PORT_PREF")"
BACKEND_PORT="$(find_free_port "$BACKEND_PORT_PREF" "$APP_PORT")"
DB_FORWARD_PORT="$(find_free_port "$DB_PORT_PREF" "$APP_PORT" "$BACKEND_PORT")"
MAILPIT_PORT="$(find_free_port "$MAILPIT_PORT_PREF" "$APP_PORT" "$BACKEND_PORT" "$DB_FORWARD_PORT")"

report_port() {
    if [ "$2" != "$3" ]; then
        printf '\033[33m    %s: port %s is busy -> using %s\033[0m\n' "$1" "$2" "$3"
    else
        printf '    %s: port %s\n' "$1" "$3"
    fi
}
report_port "Shop (frontend)" "$APP_PORT_PREF" "$APP_PORT"
report_port "API (backend)" "$BACKEND_PORT_PREF" "$BACKEND_PORT"
report_port "MySQL" "$DB_PORT_PREF" "$DB_FORWARD_PORT"
report_port "Mailpit" "$MAILPIT_PORT_PREF" "$MAILPIT_PORT"

# --- 5. Write .env ------------------------------------------------------------
cat > "$ENV_FILE" <<EOF
# Generated by setup.sh - safe to edit, re-run the setup script to apply.
APP_PORT=$APP_PORT
BACKEND_PORT=$BACKEND_PORT
DB_FORWARD_PORT=$DB_FORWARD_PORT
MAILPIT_PORT=$MAILPIT_PORT

DOCKER_SUBNET=$DOCKER_SUBNET
FRONTEND_IP=$FRONTEND_IP

APP_KEY=$APP_KEY
APP_DEBUG=$APP_DEBUG

DB_DATABASE=$DB_DATABASE
DB_USERNAME=$DB_USERNAME
DB_PASSWORD=$DB_PASSWORD
DB_ROOT_PASSWORD=$DB_ROOT_PASSWORD

MAIL_FROM_ADDRESS=$MAIL_FROM_ADDRESS
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
step "Saved configuration to .env"

# --- 6. Build & start ---------------------------------------------------------
step "Starting containers... first run can take a few minutes."
# shellcheck disable=SC2086
if ! "${COMPOSE[@]}" up -d $BUILD_FLAG; then
    warn "docker compose up failed. Recent backend logs:"
    "${COMPOSE[@]}" logs --tail 50 backend || true
    exit 1
fi

# --- 7. Wait for the shop -----------------------------------------------------
SHOP_URL="http://localhost:$APP_PORT"
step "Waiting for $SHOP_URL ..."
ready=0
for _ in $(seq 1 100); do
    if command -v curl >/dev/null 2>&1; then
        curl -fsS -m 5 "$SHOP_URL/api/categories" >/dev/null 2>&1 && { ready=1; break; }
    elif command -v wget >/dev/null 2>&1; then
        wget -q -T 5 -O /dev/null "$SHOP_URL/api/categories" && { ready=1; break; }
    else
        warn "Neither curl nor wget found - skipping readiness check."; ready=1; break
    fi
    sleep 3
done

if [ "$ready" != 1 ]; then
    warn "The shop did not respond within 5 minutes. Check: ${COMPOSE[*]} logs -f backend"
    exit 1
fi

printf '\n\033[32mOnline Store is up and running!\033[0m\n'
echo "  Shop:   $SHOP_URL"
echo "  API:    http://127.0.0.1:$BACKEND_PORT/api/products"
echo "  MySQL:  127.0.0.1:$DB_FORWARD_PORT  (db: $DB_DATABASE, user: $DB_USERNAME, password in .env)"
echo "  Mailpit: http://127.0.0.1:$MAILPIT_PORT"
echo "  Admin:  $ADMIN_EMAIL / $ADMIN_PASSWORD"
echo
echo "Useful commands:"
echo "  docker compose logs -f      # follow logs"
echo "  docker compose down         # stop"
echo "  docker compose down -v      # stop and delete the database"
