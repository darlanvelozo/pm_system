#!/bin/sh
# Daily compressed PostgreSQL dump; keeps the last 14.
set -eu
cd "$(dirname "$0")"
mkdir -p backups
docker compose exec -T postgres pg_dump -U bo -d bo | gzip > "backups/bo-$(date +%Y%m%d-%H%M).sql.gz"
ls -1t backups/bo-*.sql.gz | tail -n +15 | xargs -r rm -f
