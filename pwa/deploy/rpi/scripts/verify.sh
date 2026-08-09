#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

validate_deployment
host=$(env_value "$CONFIG_FILE" VIBEFIT_HOST)
root_ca=$(config_path ROOT_CA_FILE_PATH ./secrets/root_ca.pem)
tls_cert=$(config_path TLS_CERT_FILE_PATH ./secrets/tls_cert.pem)

for service in postgres worker backend frontend caddy; do
  container_id=$(compose ps --quiet "$service")
  [ -n "$container_id" ] || die "$service container is missing"
  state=$(docker inspect --format '{{.State.Status}}' "$container_id")
  [ "$state" = "running" ] || die "$service is $state"
  health_status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id")
  [ "$health_status" = "healthy" ] || die "$service health is ${health_status:-missing}"
done

migrate_id=$(compose ps --all --quiet migrate)
[ -n "$migrate_id" ] || die "migrate container is missing"
migrate_state=$(docker inspect --format '{{.State.Status}}:{{.State.ExitCode}}' "$migrate_id")
[ "$migrate_state" = "exited:0" ] || die "migrate result is $migrate_state"

secure_curl() {
  curl \
    --fail \
    --silent \
    --show-error \
    --cacert "$root_ca" \
    --resolve "$host:443:127.0.0.1" \
    --noproxy "$host" \
    "$@"
}

health=$(secure_curl "https://$host/health")
echo "$health" | grep -q '"status":"ok"' || die "HTTPS health response is invalid"

version=$(secure_curl "https://$host/api/version")
expected_version=$(env_value "$IMAGE_LOCK_FILE" RELEASE_VERSION)
expected_revision=$(env_value "$IMAGE_LOCK_FILE" GIT_REVISION)
echo "$version" | grep -Fq "\"releaseVersion\":\"$expected_version\"" \
  || die "Running release does not match images.lock.env: $version"
echo "$version" | grep -Fq "\"gitRevision\":\"$expected_revision\"" \
  || die "Running revision does not match images.lock.env: $version"
echo "$version" | grep -Eq '"databaseSchemaVersion":"[^"]+"' \
  || die "Running API did not report a database schema version: $version"

secure_curl "https://$host/" >/dev/null
openssl x509 -in "$tls_cert" -checkend 2592000 -noout >/dev/null \
  || die "TLS certificate expires within 30 days"

echo "VibeFit release $expected_version-$expected_revision passed HTTPS, migration and container health verification."
