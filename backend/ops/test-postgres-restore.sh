#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${LIFEGUARD_PROJECT_DIR:-/home/ubuntu/lifeguard-tcc/backend}"
COMPOSE_FILE="${LIFEGUARD_COMPOSE_FILE:-${PROJECT_DIR}/compose.production.yml}"
BACKUP_DIR="${LIFEGUARD_BACKUP_DIR:-/home/ubuntu/backups/lifeguard-postgres}"
BACKUP_FILE="${1:-}"
TEST_DATABASE="lifeguard_restore_test_$(date -u +'%Y%m%d%H%M%S')"

if [[ -z "${BACKUP_FILE}" ]]; then
  BACKUP_FILE="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'lifeguard-*.dump' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
fi

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  printf 'Nenhum backup foi encontrado para testar.\n' >&2
  exit 1
fi

if [[ -f "${BACKUP_FILE}.sha256" ]]; then
  sha256sum --check "${BACKUP_FILE}.sha256"
fi

cd "${PROJECT_DIR}"

cleanup() {
  docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    dropdb --username=lifeguard --if-exists "${TEST_DATABASE}" > /dev/null
}
trap cleanup EXIT

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  createdb --username=lifeguard "${TEST_DATABASE}"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_restore --username=lifeguard --dbname="${TEST_DATABASE}" \
  --no-owner --no-privileges --exit-on-error < "${BACKUP_FILE}"

MIGRATION_COUNT="$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql --username=lifeguard --dbname="${TEST_DATABASE}" --tuples-only --no-align \
  --command='SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;')"

if [[ ! "${MIGRATION_COUNT}" =~ ^[1-9][0-9]*$ ]]; then
  printf 'A restauração não contém migrations concluídas.\n' >&2
  exit 1
fi

printf 'Restauração validada em banco temporário (%s migrations): %s\n' \
  "${MIGRATION_COUNT}" "${BACKUP_FILE}"
