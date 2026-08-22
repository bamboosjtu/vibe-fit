#!/bin/sh
set -eu
. "$(dirname "$0")/lib.sh"

require_file "$CONFIG_FILE"
validate_image_lock "$IMAGE_LOCK_FILE"
compose "$@"
