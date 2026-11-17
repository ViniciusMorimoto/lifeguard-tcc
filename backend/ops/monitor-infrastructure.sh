#!/usr/bin/env bash
set -Eeuo pipefail

PUBLIC_HOST="${PUBLIC_HOST:?PUBLIC_HOST não configurado}"
HEALTH_URL="${LIFEGUARD_HEALTH_URL:-https://${PUBLIC_HOST}/health}"
DISK_THRESHOLD="${LIFEGUARD_DISK_THRESHOLD:-85}"
STATE_DIR="${LIFEGUARD_MONITOR_STATE_DIR:-/home/ubuntu/.local/state/lifeguard-monitor}"
STATE_FILE="${STATE_DIR}/last-status"
PROJECT_DIR="${LIFEGUARD_PROJECT_DIR:-/home/ubuntu/lifeguard-tcc/backend}"
COMPOSE_FILE="${LIFEGUARD_COMPOSE_FILE:-${PROJECT_DIR}/compose.production.yml}"

mkdir -p "${STATE_DIR}"
chmod 700 "${STATE_DIR}"

problems=()
health_response="$(curl --fail --silent --show-error --max-time 15 "${HEALTH_URL}" 2>&1)" || \
  problems+=("API indisponível em ${HEALTH_URL}: ${health_response}")
if (( ${#problems[@]} == 0 )) && [[ "${health_response}" != *'"banco":"ok"'* ]]; then
  problems+=("A API respondeu, mas não confirmou a conexão com o PostgreSQL.")
fi

disk_used="$(df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
if [[ ! "${disk_used}" =~ ^[0-9]+$ ]]; then
  problems+=("Não foi possível medir o uso do disco principal.")
elif (( disk_used >= DISK_THRESHOLD )); then
  problems+=("Disco principal com ${disk_used}% de uso; limite configurado: ${DISK_THRESHOLD}%.")
fi

current_status="ok"
if (( ${#problems[@]} > 0 )); then
  current_status="failure"
fi
previous_status="unknown"
if [[ -f "${STATE_FILE}" ]]; then
  previous_status="$(<"${STATE_FILE}")"
fi

send_email() {
  local subject="$1"
  local body="$2"

  if [[ -z "${MONITOR_ALERT_EMAIL:-}" ]]; then
    printf 'Aviso por e-mail não configurado; registre MONITOR_ALERT_EMAIL.\n' >&2
    return 0
  fi

  cd "${PROJECT_DIR}"
  docker compose -f "${COMPOSE_FILE}" run --rm --no-deps -T api \
    node dist/src/scripts/send-monitor-email.js "${MONITOR_ALERT_EMAIL}" "${subject}" "${body}"
}

if [[ "${current_status}" != "${previous_status}" ]]; then
  if [[ "${current_status}" == "failure" ]]; then
    details="$(printf '%s\n' "${problems[@]}")"
    if ! send_email "LifeGuard: falha na infraestrutura" "O monitoramento detectou um problema:\n\n${details}\n\nHorário UTC: $(date -u --iso-8601=seconds)"; then
      printf 'Não foi possível enviar o aviso por e-mail; a falha permanece registrada no journal.\n' >&2
    fi
  elif [[ "${previous_status}" == "failure" ]]; then
    if ! send_email "LifeGuard: infraestrutura recuperada" "A API e o disco da VM voltaram ao estado normal.\n\nHorário UTC: $(date -u --iso-8601=seconds)"; then
      printf 'Não foi possível enviar o aviso de recuperação por e-mail.\n' >&2
    fi
  fi
fi

state_temp="${STATE_FILE}.tmp"
printf '%s\n' "${current_status}" > "${state_temp}"
mv -- "${state_temp}" "${STATE_FILE}"

if [[ "${current_status}" == "failure" ]]; then
  printf 'Falha no monitoramento:\n%s\n' "$(printf '%s\n' "${problems[@]}")" >&2
  exit 1
fi

printf 'Monitoramento normal: API e banco acessíveis; disco em %s%%.\n' "${disk_used}"
