#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "Run install.sh as root"
chmod 0755 "$DEPLOY_DIR"/scripts/*.sh "$DEPLOY_DIR"/scripts/*.py
preflight_host
validate_deployment

data_dir=$(env_value "$CONFIG_FILE" VIBEFIT_DATA_DIR)
data_dir=${data_dir:-/srv/vibefit/data}
backup_work=$(env_value "$CONFIG_FILE" VIBEFIT_BACKUP_WORK_DIR)
backup_work=${backup_work:-/srv/vibefit/backup-work}
restore_work=$(env_value "$CONFIG_FILE" VIBEFIT_RESTORE_DIR)
restore_work=${restore_work:-/srv/vibefit/restore-work}

install -d -m 0750 -o 70 -g 70 "$data_dir/postgres" "$backup_work" "$restore_work"
install -d -m 0750 "$DEPLOY_DIR/releases" "$DEPLOY_DIR/soak" /srv/vibefit/upgrade-snapshots /srv/vibefit/rehearsals
chmod 0600 \
  "$(config_path POSTGRES_PASSWORD_FILE_PATH ./secrets/postgres_password)" \
  "$(config_path DATABASE_URL_FILE_PATH ./secrets/database_url)" \
  "$(config_path JWT_SECRET_FILE_PATH ./secrets/jwt_secret)" \
  "$(config_path SMTP_PASSWORD_FILE_PATH ./secrets/smtp_password)" \
  "$(config_path TLS_KEY_FILE_PATH ./secrets/tls_key.pem)"
chmod 0644 \
  "$(config_path TLS_CERT_FILE_PATH ./secrets/tls_cert.pem)" \
  "$(config_path ROOT_CA_FILE_PATH ./secrets/root_ca.pem)"
chmod 0644 "$CONFIG_FILE" "$IMAGE_LOCK_FILE" "$COMPOSE_FILE" "$DEPLOY_DIR/Caddyfile"
restic_password_path=$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)
if [ -f "$restic_password_path" ]; then
  chmod 0600 "$restic_password_path"
fi

pull_or_use_cache "$IMAGE_LOCK_FILE"
compose up --detach --wait --wait-timeout 180
"$SCRIPT_DIR/verify.sh"

for unit in vibefit-observe.service vibefit-observe.timer vibefit-backup.service vibefit-backup.timer vibefit-backup-check.service vibefit-backup-check.timer; do
  sed "s|@DEPLOY_DIR@|$DEPLOY_DIR|g" "$DEPLOY_DIR/systemd/$unit.in" > "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now vibefit-observe.timer

echo "VibeFit installed. Backup timers were installed but remain disabled."
