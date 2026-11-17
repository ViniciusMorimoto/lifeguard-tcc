#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${LIFEGUARD_PROJECT_DIR:-/home/ubuntu/lifeguard-tcc/backend}"
COMPOSE_FILE="${LIFEGUARD_COMPOSE_FILE:-${PROJECT_DIR}/compose.production.yml}"
BACKUP_DIR="${LIFEGUARD_BACKUP_DIR:-/home/ubuntu/backups/lifeguard-postgres}"
RETENTION_DAYS="${LIFEGUARD_BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +'%Y-%m-%dT%H-%M-%SZ')"
FINAL_FILE="${BACKUP_DIR}/lifeguard-${TIMESTAMP}.dump"
TEMP_FILE="${FINAL_FILE}.partial"

umask 077
mkdir -p "${BACKUP_DIR}"

cleanup() {
  rm -f -- "${TEMP_FILE}"
}
trap cleanup EXIT

cd "${PROJECT_DIR}"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump --username=lifeguard --dbname=lifeguard --format=custom --compress=9 \
  > "${TEMP_FILE}"

test -s "${TEMP_FILE}"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_restore --list < "${TEMP_FILE}" > /dev/null

mv -- "${TEMP_FILE}" "${FINAL_FILE}"
sha256sum "${FINAL_FILE}" > "${FINAL_FILE}.sha256"

find "${BACKUP_DIR}" -maxdepth 1 -type f \
  \( -name 'lifeguard-*.dump' -o -name 'lifeguard-*.dump.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

trap - EXIT
printf 'Backup criado e validado: %s\n' "${FINAL_FILE}"
