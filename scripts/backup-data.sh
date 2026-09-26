#!/bin/bash
# Daily backup of cawcawcaw data directory — keeps 5 most recent
set -e

APP_DIR="/opt/ns.s/ns.s-cawcawcaw"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"
cp -r "$APP_DIR/data" "$BACKUP_DIR/$TIMESTAMP"

# Keep only the 5 most recent backups
ls -1dt "$BACKUP_DIR"/*/ 2>/dev/null | tail -n +6 | xargs rm -rf
echo "Backup complete: $BACKUP_DIR/$TIMESTAMP"
