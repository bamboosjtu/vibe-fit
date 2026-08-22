#!/bin/sh
# VibeFit Frontend 多架构镜像发布入口（委托给 scripts/publish-acr.sh）。
# 用法：在 pwa/ 目录下，设置 ACR_REGISTRY/ACR_NAMESPACE/RELEASE_VERSION 后执行。
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
echo "build-multiarch.sh now publishes the frontend immutable multi-arch release." >&2
echo "Set ACR_REGISTRY and ACR_NAMESPACE, then use scripts/publish-acr.sh." >&2
exec "$SCRIPT_DIR/scripts/publish-acr.sh" "$@"
