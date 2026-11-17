#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${LIFEGUARD_PROJECT_DIR:-/home/ubuntu/lifeguard-tcc/backend}"
SYSTEMD_DIR="${PROJECT_DIR}/ops/systemd"
BACKUP_DIR="${LIFEGUARD_BACKUP_DIR:-/home/ubuntu/backups/lifeguard-postgres}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
chmod 700 "${PROJECT_DIR}/ops/backup-postgres.sh" "${PROJECT_DIR}/ops/test-postgres-restore.sh"
chmod 700 "${PROJECT_DIR}/ops/monitor-infrastructure.sh"

sudo install -m 0644 "${SYSTEMD_DIR}/lifeguard-backup.service" /etc/systemd/system/lifeguard-backup.service
sudo install -m 0644 "${SYSTEMD_DIR}/lifeguard-backup.timer" /etc/systemd/system/lifeguard-backup.timer
sudo install -m 0644 "${SYSTEMD_DIR}/lifeguard-restore-test.service" /etc/systemd/system/lifeguard-restore-test.service
sudo install -m 0644 "${SYSTEMD_DIR}/lifeguard-restore-test.timer" /etc/systemd/system/lifeguard-restore-test.timer
sudo install -m 0644 "${SYSTEMD_DIR}/lifeguard-monitor.service" /etc/systemd/system/lifeguard-monitor.service
sudo install -m 0644 "${SYSTEMD_DIR}/lifeguard-monitor.timer" /etc/systemd/system/lifeguard-monitor.timer

sudo systemctl daemon-reload
sudo systemctl enable --now lifeguard-backup.timer lifeguard-restore-test.timer
sudo systemctl enable --now lifeguard-monitor.timer

printf 'Agendamentos instalados. Confira com: systemctl list-timers lifeguard-*\n'
