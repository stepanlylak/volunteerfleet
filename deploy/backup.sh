#!/usr/bin/env bash
# On-demand backup of a VolunteerFleet database (object files live in <env>/data/minio).
#
# Usage (from anywhere):
#   deploy/backup.sh [env]       # env = prod (default) | stg
#                                # writes deploy/<env>/backups/db-<timestamp>.dump
#
# Restore (into a running, empty database), from deploy/<env>/:
#   docker compose exec -T postgres \
#     sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/db-<timestamp>.dump
#
# MinIO objects are plain files under deploy/<env>/data/minio — back them up with
# your regular file backup (e.g. restic/rsync) or `tar`.
set -euo pipefail

ENV="${1:-prod}"
cd "$(dirname "$0")/$ENV"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

echo "[backup:$ENV] dumping database -> deploy/$ENV/$BACKUP_DIR/db-$TS.dump"
docker compose exec -T postgres \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP_DIR/db-$TS.dump"

echo "[backup:$ENV] done: deploy/$ENV/$BACKUP_DIR/db-$TS.dump"
