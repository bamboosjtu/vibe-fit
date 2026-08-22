#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "Run rehearse-backup-restore.sh as root"
validate_deployment
require_file "$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)"

network_name=vibefit_default
docker network inspect "$network_name" >/dev/null 2>&1 \
  || die "Compose network $network_name is not running"

run_id="$(date -u +%Y%m%d%H%M%S)-$$"
test_container="vibefit-rehearsal-$run_id"
test_volume="vibefit-rehearsal-$run_id"
rehearsal_root=/srv/vibefit/rehearsals
install -d -m 0750 -o 70 -g 70 "$rehearsal_root"
temp_dir=$(mktemp -d "$rehearsal_root/run.XXXXXX")
chown 70:70 "$temp_dir"

cleanup() {
  docker rm -f "$test_container" >/dev/null 2>&1 || true
  case "$test_volume" in
    vibefit-rehearsal-*) docker volume rm "$test_volume" >/dev/null 2>&1 || true ;;
  esac
  case "$temp_dir" in
    /srv/vibefit/rehearsals/run.*) rm -rf "$temp_dir" ;;
  esac
}
trap cleanup EXIT HUP INT TERM

postgres_image=$(env_value "$IMAGE_LOCK_FILE" POSTGRES_IMAGE)
postgres_password_path=$(config_path POSTGRES_PASSWORD_FILE_PATH ./secrets/postgres_password)
database_url_path=$(config_path DATABASE_URL_FILE_PATH ./secrets/database_url)
test_postgres_password_file="$temp_dir/postgres_password"
install -m 0400 -o 70 -g 70 "$postgres_password_path" "$test_postgres_password_file"
postgres_user=$(env_value "$CONFIG_FILE" POSTGRES_USER)
postgres_db=$(env_value "$CONFIG_FILE" POSTGRES_DB)
postgres_user=${postgres_user:-vibefit}
postgres_db=${postgres_db:-vibefit}

docker volume create "$test_volume" >/dev/null
docker run --detach \
  --name "$test_container" \
  --network "$network_name" \
  --network-alias rehearsal-postgres \
  --security-opt no-new-privileges:true \
  --mount "type=volume,src=$test_volume,dst=/var/lib/postgresql/data" \
  --mount "type=bind,src=$test_postgres_password_file,dst=/run/secrets/postgres_password,readonly" \
  --env POSTGRES_USER="$postgres_user" \
  --env POSTGRES_DB="$postgres_db" \
  --env POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password \
  --env POSTGRES_INITDB_ARGS=--data-checksums \
  "$postgres_image" >/dev/null

ready=false
for _attempt in $(seq 1 60); do
  if docker exec "$test_container" pg_isready -U "$postgres_user" -d "$postgres_db" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[ "$ready" = "true" ] || die "Isolated PostgreSQL did not become ready"

original_url=$(tr -d '\r\n' < "$database_url_path")
test_url=$(printf '%s' "$original_url" | sed 's/@postgres:/@rehearsal-postgres:/')
[ "$test_url" != "$original_url" ] \
  || die "database_url must use the Compose hostname postgres"
test_database_url_file="$temp_dir/test_database_url"
printf '%s\n' "$test_url" > "$test_database_url_file"
chmod 0600 "$test_database_url_file"
chown 70:70 "$test_database_url_file"
install -d -m 0750 -o 70 -g 70 "$temp_dir/repository" "$temp_dir/work" "$temp_dir/restore"

BACKUP_ENABLED=true \
VIBEFIT_BACKUP_DIR="$temp_dir" \
VIBEFIT_BACKUP_WORK_DIR="$temp_dir/work" \
VIBEFIT_RESTORE_DIR="$temp_dir/restore" \
compose --profile backup run --rm maintenance init

BACKUP_ENABLED=true \
VIBEFIT_BACKUP_DIR="$temp_dir" \
VIBEFIT_BACKUP_WORK_DIR="$temp_dir/work" \
VIBEFIT_RESTORE_DIR="$temp_dir/restore" \
compose --profile backup run --rm maintenance backup

BACKUP_ENABLED=true \
VIBEFIT_BACKUP_DIR="$temp_dir" \
VIBEFIT_BACKUP_WORK_DIR="$temp_dir/work" \
VIBEFIT_RESTORE_DIR="$temp_dir/restore" \
DATABASE_URL_FILE_PATH="$test_database_url_file" \
CONFIRM_RESTORE=YES \
RESTORE_SNAPSHOT=latest \
compose --profile backup run --rm maintenance restore

comparison_query="SELECT json_build_object(
  'users', (SELECT count(*) FROM users),
  'verificationCodes', (SELECT count(*) FROM email_verification_codes),
  'backupSnapshots', (SELECT count(*) FROM backup_snapshots),
  'syncMeta', (SELECT count(*) FROM sync_meta),
  'latestBackup', COALESCE((SELECT id::text || ':' || md5(payload::text) FROM backup_snapshots ORDER BY created_at DESC, id DESC LIMIT 1), '')
)::text;"

source_result=$(compose exec -T postgres \
  psql -U "$postgres_user" -d "$postgres_db" -Atc "$comparison_query")
restored_result=$(docker exec "$test_container" \
  psql -U "$postgres_user" -d "$postgres_db" -Atc "$comparison_query")

[ "$source_result" = "$restored_result" ] || {
  echo "Source:   $source_result" >&2
  echo "Restored: $restored_result" >&2
  die "Isolated restore content does not match the source database"
}

echo "Backup, encrypted repository, destructive test-volume restore and row/content comparison passed."
echo "The isolated container, volume and temporary repository will now be removed."
