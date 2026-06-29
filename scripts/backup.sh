#!/bin/sh
# Periodic pg_dump backup for the self-hosted Postgres, run by the `db-backup`
# service in docker-compose.yml. Writes gzipped SQL dumps to $BACKUP_DIR and
# prunes anything older than $BACKUP_RETENTION_DAYS. Plain (text) dumps so they
# restore with `gunzip -c <file> | psql`.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
PGHOST="${PGHOST:-db}"
mkdir -p "$BACKUP_DIR"

run_backup() {
  ts="$(date +%Y%m%d-%H%M%S)"
  out="$BACKUP_DIR/${PGDATABASE}-${ts}.sql.gz"
  echo "[backup] dumping '$PGDATABASE' -> $out"
  if pg_dump --no-owner --no-privileges -h "$PGHOST" -U "$PGUSER" "$PGDATABASE" | gzip > "$out.tmp"; then
    mv "$out.tmp" "$out"
    echo "[backup] ok ($(du -h "$out" | cut -f1))"
  else
    echo "[backup] FAILED" >&2
    rm -f "$out.tmp"
  fi
  # Prune dumps older than the retention window.
  find "$BACKUP_DIR" -name "${PGDATABASE}-*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
}

# Wait for Postgres to accept connections, then take an immediate backup.
until pg_isready -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  echo "[backup] waiting for db…"
  sleep 3
done
run_backup

# Then loop ~daily. GNU `date -d` (for an exact 03:00 target) isn't in busybox,
# so fall back to a fixed 24h interval when it's unavailable.
while true; do
  now="$(date +%s)"
  next="$(date -d 'tomorrow 03:00' +%s 2>/dev/null || echo $((now + 86400)))"
  secs=$((next - now))
  [ "$secs" -le 0 ] && secs=86400
  echo "[backup] next run in ${secs}s"
  sleep "$secs"
  run_backup
done
