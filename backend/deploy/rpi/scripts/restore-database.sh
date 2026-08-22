#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "Run restore-database.sh as root"
[ "$#" -ge 1 ] && [ "$#" -le 2 ] \
  || die "Usage: CONFIRM_DATABASE_RESTORE=YES restore-database.sh BACKUP_DIR [SNAPSHOT_ID]"
[ "${CONFIRM_DATABASE_RESTORE:-}" = "YES" ] \
  || die "Set CONFIRM_DATABASE_RESTORE=YES after testing this snapshot in an isolated database"
backup_dir=$1
snapshot=${2:-latest}
maintenance_open=false
close_failed_maintenance() {
  if [ "$maintenance_open" = "true" ]; then
    end_maintenance failed || true
  fi
}
trap close_failed_maintenance EXIT
[ -f "$backup_dir/repository/config" ] || die "Restic repository not found: $backup_dir/repository"
validate_deployment
require_file "$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)"

start_maintenance "database-restore:$snapshot"
maintenance_open=true
compose stop caddy frontend backend worker

if ! BACKUP_ENABLED=true \
  VIBEFIT_BACKUP_DIR="$backup_dir" \
  CONFIRM_RESTORE=YES \
  RESTORE_SNAPSHOT="$snapshot" \
  compose --profile backup run --rm maintenance restore; then
  echo "Database restore failed. Application write services remain stopped." >&2
  exit 1
fi

compose up --detach --wait --wait-timeout 180
"$SCRIPT_DIR/verify.sh"
end_maintenance completed
maintenance_open=false
echo "Database restored from $snapshot and application services restarted."
