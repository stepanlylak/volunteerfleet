#!/usr/bin/env bash
# Update a VolunteerFleet stack to a new release with an automatic pre-update DB backup.
#
# Usage (from anywhere):
#   deploy/update.sh [env]       # env = prod (default) | stg
#                                # pulls the tag from deploy/<env>/.env (VF_IMAGE) and restarts
#   VF_IMAGE=ghcr.io/org/volunteerfleet:1.2.0 deploy/update.sh stg   # override the tag
#
# Steps: backup database → pull image → recreate app container → prune old images.
# Persistent data (deploy/<env>/data/postgres, .../data/minio) is never touched.
set -euo pipefail

ENV="${1:-prod}"
cd "$(dirname "$0")/$ENV"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

echo "[update:$ENV] backing up database -> deploy/$ENV/$BACKUP_DIR/db-$TS.dump"
# pg_dump runs inside the container and reads POSTGRES_* from the container env.
docker compose exec -T postgres \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP_DIR/db-$TS.dump"

echo "[update:$ENV] pulling new image..."
docker compose pull app

echo "[update:$ENV] recreating app container (migrations run automatically on start)..."
docker compose up -d

echo "[update:$ENV] pruning dangling images..."
docker image prune -f

echo "[update:$ENV] done. Backup saved to deploy/$ENV/$BACKUP_DIR/db-$TS.dump"
