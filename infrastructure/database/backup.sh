#!/usr/bin/env bash
# Encrypted PostgreSQL backup. Schedule via cron/systemd (e.g. hourly WAL + nightly full).
#   DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/orgil GPG_RECIPIENT=backup@orgil.example ./backup.sh
# Restore:  gpg -d orgil-<ts>.dump.gpg | pg_restore --clean --if-exists -d "$DATABASE_URL"
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${GPG_RECIPIENT:?GPG_RECIPIENT is required (backups must be encrypted)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/orgil}"
RETENTION_DAYS="${RETENTION_DAYS:-35}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
umask 077
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" \
  | gpg --batch --yes --encrypt --recipient "$GPG_RECIPIENT" \
  > "$BACKUP_DIR/orgil-$TS.dump.gpg"

sha256sum "$BACKUP_DIR/orgil-$TS.dump.gpg" > "$BACKUP_DIR/orgil-$TS.dump.gpg.sha256"
find "$BACKUP_DIR" -name 'orgil-*.dump.gpg*' -mtime +"$RETENTION_DAYS" -delete
echo "Backup written: $BACKUP_DIR/orgil-$TS.dump.gpg"
# Also back up the encrypted uploads volume (UPLOAD_DIR) and keep ENCRYPTION_KEY in a separate secret store —
# without the key, database field ciphertext and documents cannot be decrypted.
