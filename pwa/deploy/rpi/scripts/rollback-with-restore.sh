#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "Run rollback-with-restore.sh as root"
[ "$#" -ge 2 ] && [ "$#" -le 3 ] \
  || die "Usage: CONFIRM_DATABASE_ROLLBACK=YES rollback-with-restore.sh PREVIOUS_LOCK BACKUP_DIR [SNAPSHOT_ID]"
[ "${CONFIRM_DATABASE_ROLLBACK:-}" = "YES" ] \
  || die "Set CONFIRM_DATABASE_ROLLBACK=YES only after an isolated restore verified the snapshot"

target_lock=$1
backup_dir=$2
snapshot=${3:-latest}
maintenance_open=false
close_failed_maintenance() {
  if [ "$maintenance_open" = "true" ]; then
    end_maintenance failed || true
  fi
}
trap close_failed_maintenance EXIT

validate_deployment
validate_image_lock "$target_lock"
pull_or_use_cache "$target_lock"
[ -f "$backup_dir/repository/config" ] || die "Restic repository not found: $backup_dir/repository"
require_file "$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)"

current_version=$(env_value "$IMAGE_LOCK_FILE" RELEASE_VERSION)
current_revision=$(env_value "$IMAGE_LOCK_FILE" GIT_REVISION)
target_version=$(env_value "$target_lock" RELEASE_VERSION)
target_revision=$(env_value "$target_lock" GIT_REVISION)
archive_dir="$DEPLOY_DIR/releases/$current_version-$current_revision-database-rollback"
install -d -m 0750 "$archive_dir"
cp "$IMAGE_LOCK_FILE" "$archive_dir/images.lock.env"

start_maintenance "database-rollback:$current_version-$current_revision-to-$target_version-$target_revision"
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

compose_with_lock "$target_lock" up --detach --wait --wait-timeout 180
IMAGE_LOCK_FILE="$target_lock" "$SCRIPT_DIR/verify.sh"
cp "$target_lock" "$DEPLOY_DIR/images.lock.env.next"
mv "$DEPLOY_DIR/images.lock.env.next" "$IMAGE_LOCK_FILE"
end_maintenance completed
maintenance_open=false

echo "Database and images rolled back: $current_version-$current_revision -> $target_version-$target_revision"
