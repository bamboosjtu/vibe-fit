#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

validate_deployment
backup_enabled=$(env_value "$CONFIG_FILE" BACKUP_ENABLED)
[ "$backup_enabled" = "true" ] || die "Set BACKUP_ENABLED=true only after configuring a real backup destination"
backup_dir=$(env_value "$CONFIG_FILE" VIBEFIT_BACKUP_DIR)
[ -n "$backup_dir" ] || die "VIBEFIT_BACKUP_DIR is required"
echo "$backup_dir" | grep -q 'backup-not-configured' && die "VIBEFIT_BACKUP_DIR is still the disabled placeholder"
require_file "$(config_path RESTIC_PASSWORD_FILE_PATH ./secrets/restic_password)"

install -d -m 0750 -o 70 -g 70 "$backup_dir"
if [ ! -f "$backup_dir/repository/config" ]; then
  compose --profile backup run --rm maintenance init
fi
compose --profile backup run --rm maintenance backup
