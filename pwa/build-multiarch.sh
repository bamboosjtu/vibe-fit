#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

echo "build-multiarch.sh now publishes the complete immutable Raspberry Pi release." >&2
echo "Set ACR_REGISTRY and ACR_NAMESPACE, then use scripts/publish-acr.sh." >&2
exec "$SCRIPT_DIR/scripts/publish-acr.sh" "$@"
