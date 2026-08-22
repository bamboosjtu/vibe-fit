#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

validate_deployment
[ "$(env_value "$CONFIG_FILE" BACKUP_ENABLED)" = "true" ] \
  || die "Scheduled backup is disabled"
require_file "$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)"
compose --profile backup run --rm maintenance check
