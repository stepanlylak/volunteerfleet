#!/usr/bin/env bash
# Update VolunteerFleet to a new release with an automatic pre-update DB backup.
#
# Usage:
#   ./update.sh                  # pull the tag from .env (VF_IMAGE) and restart
#   VF_IMAGE=ghcr.io/org/volunteerfleet:1.2.0 ./update.sh   # override the tag
#
# Steps: backup database → pull image → recreate app container → prune old images.
# Persistent data (./data/postgres, ./data/minio) is never touched.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

echo "[update] backing up database -> $BACKUP_DIR/db-$TS.dump"
# pg_dump runs inside the container and reads POSTGRES_* from the container env.
$COMPOSE exec -T volunteerfleet-postgres \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP_DIR/db-$TS.dump"

echo "[update] pulling new image..."
$COMPOSE pull volunteerfleet

echo "[update] recreating app container (migrations run automatically on start)..."
$COMPOSE up -d

echo "[update] pruning dangling images..."
docker image prune -f

echo "[update] done. Backup saved to $BACKUP_DIR/db-$TS.dump"
