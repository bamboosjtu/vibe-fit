#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
CONFIG_FILE=${CONFIG_FILE:-$DEPLOY_DIR/config.env}
IMAGE_LOCK_FILE=${IMAGE_LOCK_FILE:-$DEPLOY_DIR/images.lock.env}
COMPOSE_FILE=$DEPLOY_DIR/compose.yaml

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || die "Required file not found: $1"
}

env_value() {
  file=$1
  key=$2
  sed -n "s/^${key}=//p" "$file" | tail -n 1
}

config_path() {
  key=$1
  default_value=$2
  eval "override_value=\${$key:-}"
  value=${override_value:-$(env_value "$CONFIG_FILE" "$key")}
  value=${value:-$default_value}
  case "$value" in
    /*) printf '%s\n' "$value" ;;
    ./*) printf '%s\n' "$DEPLOY_DIR/${value#./}" ;;
    *) printf '%s\n' "$DEPLOY_DIR/$value" ;;
  esac
}

load_secret_environment() {
  VIBEFIT_SECRET_POSTGRES_PASSWORD=$(cat "$(config_path POSTGRES_PASSWORD_FILE_PATH ./secrets/postgres_password)")
  VIBEFIT_SECRET_DATABASE_URL=$(cat "$(config_path DATABASE_URL_FILE_PATH ./secrets/database_url)")
  VIBEFIT_SECRET_JWT_SECRET=$(cat "$(config_path JWT_SECRET_FILE_PATH ./secrets/jwt_secret)")
  VIBEFIT_SECRET_SMTP_PASSWORD=$(cat "$(config_path SMTP_PASSWORD_FILE_PATH ./secrets/smtp_password)")
  VIBEFIT_SECRET_TLS_CERT=$(cat "$(config_path TLS_CERT_FILE_PATH ./secrets/tls_cert.pem)")
  VIBEFIT_SECRET_TLS_KEY=$(cat "$(config_path TLS_KEY_FILE_PATH ./secrets/tls_key.pem)")
  VIBEFIT_SECRET_ROOT_CA=$(cat "$(config_path ROOT_CA_FILE_PATH ./secrets/root_ca.pem)")
  restic_password_path=$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)
  if [ -f "$restic_password_path" ]; then
    VIBEFIT_SECRET_RESTIC_PASSWORD=$(cat "$restic_password_path")
    export VIBEFIT_SECRET_RESTIC_PASSWORD
  else
    unset VIBEFIT_SECRET_RESTIC_PASSWORD || true
  fi
  export VIBEFIT_SECRET_POSTGRES_PASSWORD VIBEFIT_SECRET_DATABASE_URL
  export VIBEFIT_SECRET_JWT_SECRET VIBEFIT_SECRET_SMTP_PASSWORD
  export VIBEFIT_SECRET_TLS_CERT VIBEFIT_SECRET_TLS_KEY VIBEFIT_SECRET_ROOT_CA
}

validate_image_lock() {
  lock_file=$1
  require_file "$lock_file"

  release_version=$(env_value "$lock_file" RELEASE_VERSION)
  git_revision=$(env_value "$lock_file" GIT_REVISION)
  echo "$release_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' \
    || die "RELEASE_VERSION must be an exact semantic version"
  echo "$git_revision" | grep -Eq '^[0-9a-f]{7,40}$' \
    || die "GIT_REVISION must be a 7-40 character lowercase Git SHA"

  for key in BACKEND_IMAGE WORKER_IMAGE FRONTEND_IMAGE MAINTENANCE_IMAGE POSTGRES_IMAGE CADDY_IMAGE; do
    value=$(env_value "$lock_file" "$key")
    echo "$value" | grep -Eq '^[^/[:space:]]+\.personal\.cr\.aliyuncs\.com/[^/[:space:]]+/[^/@[:space:]]+@sha256:[0-9a-f]{64}$' \
      || die "$key must be an immutable Alibaba ACR Personal repo@sha256 reference"
    echo "$value" | grep -q '@sha256:0000000000000000000000000000000000000000000000000000000000000000' \
      && die "$key still contains the example digest"
    echo "$value" | grep -Eq '(^|:)latest(@|$)' && die "$key must not use latest"
  done
}

compose() {
  load_secret_environment
  docker compose \
    --env-file "$CONFIG_FILE" \
    --env-file "$IMAGE_LOCK_FILE" \
    --file "$COMPOSE_FILE" \
    "$@"
}

compose_with_lock() {
  selected_lock=$1
  shift
  load_secret_environment
  docker compose \
    --env-file "$CONFIG_FILE" \
    --env-file "$selected_lock" \
    --file "$COMPOSE_FILE" \
    "$@"
}

ensure_images_cached() {
  lock_file=$1
  for key in BACKEND_IMAGE WORKER_IMAGE FRONTEND_IMAGE MAINTENANCE_IMAGE POSTGRES_IMAGE CADDY_IMAGE; do
    image=$(env_value "$lock_file" "$key")
    docker image inspect "$image" >/dev/null 2>&1 \
      || die "$image is neither pullable nor present in the local cache"
  done
}

pull_or_use_cache() {
  lock_file=$1
  if ! compose_with_lock "$lock_file" --profile backup pull; then
    echo "Registry pull failed; checking the immutable local cache..." >&2
    ensure_images_cached "$lock_file"
  fi
}

start_maintenance() {
  python3 "$SCRIPT_DIR/record-maintenance.py" start "$1"
}

end_maintenance() {
  python3 "$SCRIPT_DIR/record-maintenance.py" end --result "${1:-completed}"
}

validate_certificate() {
  host=$(env_value "$CONFIG_FILE" VIBEFIT_HOST)
  [ -n "$host" ] || die "VIBEFIT_HOST is missing in config.env"
  echo "$host" | grep -Eq '^[A-Za-z0-9.-]+$' \
    || die "VIBEFIT_HOST must be a DNS name or IPv4 address without scheme, port, path or credentials"
  root_ca=$(config_path ROOT_CA_FILE_PATH ./secrets/root_ca.pem)
  tls_cert=$(config_path TLS_CERT_FILE_PATH ./secrets/tls_cert.pem)
  tls_key=$(config_path TLS_KEY_FILE_PATH ./secrets/tls_key.pem)
  require_file "$root_ca"
  require_file "$tls_cert"
  require_file "$tls_key"

  openssl verify -CAfile "$root_ca" "$tls_cert" >/dev/null \
    || die "TLS certificate is not signed by root_ca.pem"
  openssl x509 -in "$tls_cert" -checkend 2592000 -noout >/dev/null \
    || die "TLS certificate expires in less than 30 days"
  cert_public_key=$(openssl x509 -in "$tls_cert" -pubkey -noout | openssl sha256)
  private_public_key=$(openssl pkey -in "$tls_key" -pubout 2>/dev/null | openssl sha256)
  [ "$cert_public_key" = "$private_public_key" ] \
    || die "TLS private key does not match the leaf certificate"

  case "$host" in
    *[!0-9.]* ) openssl x509 -in "$tls_cert" -checkhost "$host" -noout >/dev/null ;;
    * ) openssl x509 -in "$tls_cert" -checkip "$host" -noout >/dev/null ;;
  esac || die "TLS certificate SAN does not match VIBEFIT_HOST=$host"
}

validate_deployment() {
  require_file "$CONFIG_FILE"
  require_file "$COMPOSE_FILE"
  validate_image_lock "$IMAGE_LOCK_FILE"

  require_file "$(config_path POSTGRES_PASSWORD_FILE_PATH ./secrets/postgres_password)"
  require_file "$(config_path DATABASE_URL_FILE_PATH ./secrets/database_url)"
  require_file "$(config_path JWT_SECRET_FILE_PATH ./secrets/jwt_secret)"
  require_file "$(config_path SMTP_PASSWORD_FILE_PATH ./secrets/smtp_password)"
  validate_certificate

  backup_enabled=$(env_value "$CONFIG_FILE" BACKUP_ENABLED)
  backup_enabled=${backup_enabled:-false}
  case "$backup_enabled" in
    true)
      backup_dir=$(env_value "$CONFIG_FILE" VIBEFIT_BACKUP_DIR)
      [ -n "$backup_dir" ] || die "VIBEFIT_BACKUP_DIR is required when backups are enabled"
      echo "$backup_dir" | grep -q 'backup-not-configured' \
        && die "VIBEFIT_BACKUP_DIR is still the disabled placeholder"
      require_file "$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)"
      ;;
    false) ;;
    *) die "BACKUP_ENABLED must be true or false" ;;
  esac

  jwt_value=$(cat "$(config_path JWT_SECRET_FILE_PATH ./secrets/jwt_secret)")
  [ "${#jwt_value}" -ge 32 ] || die "jwt_secret must contain at least 32 characters"
  echo "$jwt_value" | grep -Eiq 'dev[-_ ]?only[-_ ]?secret|replace[-_ ]?with|change.?me' \
    && die "jwt_secret still contains a known placeholder"

  compose config --quiet
}

preflight_upgrade_space() {
  data_dir=$(env_value "$CONFIG_FILE" VIBEFIT_DATA_DIR)
  data_dir=${data_dir:-/srv/vibefit/data}
  free_kib=$(df -Pk "$data_dir" | awk 'NR == 2 { print $4 }')
  database_bytes=$(compose exec -T postgres \
    psql -U "$(env_value "$CONFIG_FILE" POSTGRES_USER)" \
    -d "$(env_value "$CONFIG_FILE" POSTGRES_DB)" \
    -Atc 'SELECT pg_database_size(current_database());')
  database_kib=$((database_bytes / 1024))
  required_kib=$((database_kib * 2 + 524288))
  [ "$required_kib" -ge 2097152 ] || required_kib=2097152
  [ "$free_kib" -ge "$required_kib" ] \
    || die "Insufficient free space for a verified upgrade snapshot: need ${required_kib}KiB, have ${free_kib}KiB"
}

preflight_host() {
  [ "$(uname -m)" = "aarch64" ] || die "Raspberry Pi host must be aarch64"
  [ "$(getconf LONG_BIT)" = "64" ] || die "Raspberry Pi OS must be 64-bit"

  memory_kib=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
  [ "$memory_kib" -ge 3500000 ] || die "At least 4GB RAM is required"

  command -v docker >/dev/null 2>&1 || die "Docker Engine is not installed"
  docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is not installed"
  compose_version=$(docker compose version --short | sed 's/^v//; s/[^0-9.].*$//')
  minimum_compose_version=2.23.1
  first_version=$(printf '%s\n%s\n' "$minimum_compose_version" "$compose_version" | sort -V | head -n 1)
  [ "$first_version" = "$minimum_compose_version" ] \
    || die "Docker Compose >= $minimum_compose_version is required (found $compose_version)"
  command -v openssl >/dev/null 2>&1 || die "openssl is not installed"
  command -v curl >/dev/null 2>&1 || die "curl is not installed"
}
