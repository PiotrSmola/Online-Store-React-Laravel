#!/bin/sh
set -e

cd /var/www/html

if [ -z "$APP_KEY" ]; then
    APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
    export APP_KEY
    echo "[entrypoint] WARNING: APP_KEY was not set - generated a temporary one (run setup script to persist it)."
fi

echo "[entrypoint] Waiting for database ${DB_HOST}:${DB_PORT}..."
tries=0
until php -r 'try { new PDO("mysql:host=".getenv("DB_HOST").";port=".getenv("DB_PORT").";dbname=".getenv("DB_DATABASE"), getenv("DB_USERNAME"), getenv("DB_PASSWORD")); } catch (Throwable $e) { exit(1); }'; do
    tries=$((tries + 1))
    if [ "$tries" -ge 60 ]; then
        echo "[entrypoint] Database is not reachable after 120s - giving up."
        exit 1
    fi
    sleep 2
done
echo "[entrypoint] Database is up."

# The queue worker shares this image and must not race the web container over these steps.
if [ "$RUN_MIGRATIONS" != "false" ]; then
    php artisan migrate --force
    php artisan shop:seed --if-empty || echo "[entrypoint] WARNING: product seeding failed - the shop will start without products."
    php artisan shop:admin || echo "[entrypoint] WARNING: admin account not created - set ADMIN_EMAIL and ADMIN_PASSWORD."
    php artisan shop:thumbnails || echo "[entrypoint] WARNING: thumbnails not created - product pages will use the full size images."
    php artisan sanctum:prune-expired --hours=24 || echo "[entrypoint] WARNING: expired tokens not pruned."
fi

# After the steps above: directories they created have to end up writable for Apache.
chown -R www-data:www-data storage bootstrap/cache

exec "$@"
