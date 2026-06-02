#!/usr/bin/env bash
# On-demand backup of the VolunteerFleet database (object files live in ./data/minio).
#
# Usage:
#   ./backup.sh                  # writes backups/db-<timestamp>.dump
#
# Restore (into a running, empty database):
#   docker compose -f docker-compose.prod.yml exec -T volunteerfleet-postgres \
#     sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/db-<timestamp>.dump
#
# MinIO objects are plain files under ./data/minio — back them up with your
# regular file backup (e.g. restic/rsync) or `tar`.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

echo "[backup] dumping database -> $BACKUP_DIR/db-$TS.dump"
$COMPOSE exec -T volunteerfleet-postgres \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP_DIR/db-$TS.dump"

echo "[backup] done: $BACKUP_DIR/db-$TS.dump"
