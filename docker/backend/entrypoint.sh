#!/bin/sh
set -e

# Fix storage and cache permissions on every container start.
# Needed because the ./backend volume mount overwrites the build-time chown,
# leaving storage/ owned by the host user (root) instead of www-data.
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

exec "$@"
