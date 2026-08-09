#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "Run upgrade.sh as root"
[ "$#" -eq 1 ] || die "Usage: upgrade.sh /path/to/candidate-images.lock.env"
candidate_lock=$1
maintenance_open=false
close_failed_maintenance() {
  if [ "$maintenance_open" = "true" ]; then
    end_maintenance failed || true
  fi
}
trap close_failed_maintenance EXIT
validate_deployment
validate_image_lock "$candidate_lock"
"$SCRIPT_DIR/verify.sh"
preflight_upgrade_space

current_version=$(env_value "$IMAGE_LOCK_FILE" RELEASE_VERSION)
current_revision=$(env_value "$IMAGE_LOCK_FILE" GIT_REVISION)
candidate_version=$(env_value "$candidate_lock" RELEASE_VERSION)
candidate_revision=$(env_value "$candidate_lock" GIT_REVISION)
[ -n "$candidate_version" ] || die "Candidate lock has no RELEASE_VERSION"
[ -n "$candidate_revision" ] || die "Candidate lock has no GIT_REVISION"

echo "Pre-pulling candidate $candidate_version-$candidate_revision..."
echo "Refreshing the current/rollback image cache first..."
pull_or_use_cache "$IMAGE_LOCK_FILE"
pull_or_use_cache "$candidate_lock"
# Image layers may consume substantial space. Re-check the snapshot budget
# after both immutable releases are safely cached.
preflight_upgrade_space

require_file "$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)"
upgrade_backup_dir=/srv/vibefit/upgrade-snapshots
install -d -m 0750 -o 70 -g 70 "$upgrade_backup_dir"

archive_dir="$DEPLOY_DIR/releases/$current_version-$current_revision"
install -d -m 0750 "$archive_dir"
cp "$IMAGE_LOCK_FILE" "$archive_dir/images.lock.env"
cp "$COMPOSE_FILE" "$archive_dir/compose.yaml"
cp "$DEPLOY_DIR/Caddyfile" "$archive_dir/Caddyfile"

echo "Stopping application writes before the upgrade snapshot and candidate migration..."
start_maintenance "upgrade:$current_version-$current_revision-to-$candidate_version-$candidate_revision"
maintenance_open=true
compose stop caddy frontend backend worker

snapshot_failed=false
if [ ! -f "$upgrade_backup_dir/repository/config" ]; then
  if ! BACKUP_ENABLED=true VIBEFIT_BACKUP_DIR="$upgrade_backup_dir" \
    compose --profile backup run --rm maintenance init; then
    snapshot_failed=true
  fi
fi
if [ "$snapshot_failed" = "false" ] && ! \
  BACKUP_ENABLED=true VIBEFIT_BACKUP_DIR="$upgrade_backup_dir" \
  compose --profile backup run --rm maintenance backup; then
  snapshot_failed=true
fi
if [ "$snapshot_failed" = "true" ]; then
  echo "Verified upgrade snapshot failed; restarting the unchanged current release." >&2
  compose up --detach --wait --wait-timeout 180 \
    || die "Upgrade snapshot failed and the current release could not be restarted"
  "$SCRIPT_DIR/verify.sh" \
    || die "Upgrade snapshot failed and the restarted current release did not verify"
  exit 1
fi

if ! compose_with_lock "$candidate_lock" run --rm --no-deps migrate; then
  echo "Candidate migration failed; the atomic migration was rolled back." >&2
  compose up --detach --wait --wait-timeout 180
  "$SCRIPT_DIR/verify.sh"
  exit 1
fi

if ! compose_with_lock "$candidate_lock" up --detach --wait --wait-timeout 180; then
  echo "Candidate services did not become healthy. The current lock was not changed." >&2
  echo "Inspect logs, then run rollback.sh only after confirming schema compatibility." >&2
  exit 1
fi

IMAGE_LOCK_FILE="$candidate_lock" "$SCRIPT_DIR/verify.sh"
cp "$candidate_lock" "$DEPLOY_DIR/images.lock.env.next"
mv "$DEPLOY_DIR/images.lock.env.next" "$IMAGE_LOCK_FILE"
end_maintenance completed
maintenance_open=false
echo "Upgrade complete: $current_version-$current_revision -> $candidate_version-$candidate_revision"
echo "Previous release lock: $archive_dir/images.lock.env"
