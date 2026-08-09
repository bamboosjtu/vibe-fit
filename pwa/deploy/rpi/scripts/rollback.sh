#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "Run rollback.sh as root"
[ "$#" -eq 1 ] || die "Usage: CONFIRM_IMAGE_ROLLBACK=YES rollback.sh /path/to/previous/images.lock.env"
[ "${CONFIRM_IMAGE_ROLLBACK:-}" = "YES" ] \
  || die "Set CONFIRM_IMAGE_ROLLBACK=YES after confirming schema compatibility"
target_lock=$1
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

current_version=$(env_value "$IMAGE_LOCK_FILE" RELEASE_VERSION)
current_revision=$(env_value "$IMAGE_LOCK_FILE" GIT_REVISION)
target_version=$(env_value "$target_lock" RELEASE_VERSION)
target_revision=$(env_value "$target_lock" GIT_REVISION)

archive_dir="$DEPLOY_DIR/releases/$current_version-$current_revision-rollback"
install -d -m 0750 "$archive_dir"
cp "$IMAGE_LOCK_FILE" "$archive_dir/images.lock.env"

start_maintenance "image-rollback:$current_version-$current_revision-to-$target_version-$target_revision"
maintenance_open=true
compose stop caddy frontend backend worker
compose_with_lock "$target_lock" up --detach --wait --wait-timeout 180
IMAGE_LOCK_FILE="$target_lock" "$SCRIPT_DIR/verify.sh"
cp "$target_lock" "$DEPLOY_DIR/images.lock.env.next"
mv "$DEPLOY_DIR/images.lock.env.next" "$IMAGE_LOCK_FILE"
end_maintenance completed
maintenance_open=false

echo "Image rollback complete: $current_version-$current_revision -> $target_version-$target_revision"
echo "No database data was restored. Use restore-database.sh only for an incompatible schema."
