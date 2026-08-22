#!/bin/sh
# 发布 VibeFit Frontend (PWA/H5) 镜像到阿里云 ACR（多架构 + 不可变摘要锁）。
#
# 用法：在 pwa/ 目录下
#   ACR_REGISTRY=crpi-xxx.personal.cr.aliyuncs.com \
#   ACR_NAMESPACE=vibefit \
#   RELEASE_VERSION=1.1.0 \
#   ./scripts/publish-acr.sh
#
# 产出镜像（linux/amd64 + linux/arm64）：
#   - vibefit-frontend
#
# 写入 pwa/scripts/images.lock.env（仅 FRONTEND_IMAGE + RELEASE_VERSION + GIT_REVISION）。
# 后端镜像由 backend/scripts/publish-acr.sh 单独发布并写入 backend/scripts/images.lock.env，
# 前后端独立部署、独立锁文件。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PWA_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$PWA_DIR"

base_image_lock=scripts/base-images.lock.env
[ -r "$base_image_lock" ] || {
  echo "Missing base image lock: $base_image_lock" >&2
  exit 66
}
. "./$base_image_lock"
export NODE_IMAGE NGINX_IMAGE

required() {
  name=$1
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "$name is required." >&2
    exit 64
  fi
}

required ACR_REGISTRY
required ACR_NAMESPACE

case "$ACR_REGISTRY" in
  *.personal.cr.aliyuncs.com) ;;
  *)
    echo "ACR_REGISTRY must be an Alibaba Cloud ACR Personal endpoint." >&2
    exit 64
    ;;
esac

release_version=${RELEASE_VERSION:-1.1.0}
echo "$release_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo "RELEASE_VERSION must be an exact semantic version." >&2
  exit 64
}
echo "$ACR_NAMESPACE" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]*$' || {
  echo "ACR_NAMESPACE contains unsupported characters." >&2
  exit 64
}
git_revision=${GIT_REVISION:-$(git rev-parse --short=12 HEAD)}
echo "$git_revision" | grep -Eq '^[0-9a-f]{7,40}$' || {
  echo "GIT_REVISION must be a 7-40 character lowercase Git SHA." >&2
  exit 64
}
release_tag="$release_version-$git_revision"

if [ "${ALLOW_DIRTY_BUILD:-false}" != "true" ] && [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to publish from a dirty worktree. Commit changes or set ALLOW_DIRTY_BUILD=true explicitly." >&2
  exit 65
fi

if [ -n "${ACR_USERNAME:-}" ]; then
  required ACR_PASSWORD_FILE
  if [ ! -r "$ACR_PASSWORD_FILE" ]; then
    echo "ACR_PASSWORD_FILE is not readable: $ACR_PASSWORD_FILE" >&2
    exit 66
  fi
  docker login "$ACR_REGISTRY" --username "$ACR_USERNAME" --password-stdin < "$ACR_PASSWORD_FILE"
fi

REGISTRY="$ACR_REGISTRY" \
NAMESPACE="$ACR_NAMESPACE" \
VERSION="$release_version" \
GIT_REVISION="$git_revision" \
docker buildx bake --file docker-bake.hcl --push

# 锁文件位置：pwa/scripts/images.lock.env（前端独立锁，与后端互不依赖）
image="$ACR_REGISTRY/$ACR_NAMESPACE/vibefit-frontend:$release_tag"
inspection=$(docker buildx imagetools inspect "$image")
echo "$inspection" | grep -q "linux/amd64" || {
  echo "$image is missing linux/amd64" >&2
  exit 65
}
echo "$inspection" | grep -q "linux/arm64" || {
  echo "$image is missing linux/arm64" >&2
  exit 65
}
digest=$(printf '%s\n' "$inspection" \
  | sed -n 's/^[[:space:]]*Digest:[[:space:]]*//p' \
  | head -n 1)
echo "$digest" | grep -Eq '^sha256:[0-9a-f]{64}$' || {
  echo "Cannot resolve an immutable digest for $image: $digest" >&2
  exit 65
}

lock_file=$(mktemp scripts/images.lock.env.tmp.XXXXXX)
trap 'rm -f "$lock_file"' EXIT HUP INT TERM
{
  echo "RELEASE_VERSION=$release_version"
  echo "GIT_REVISION=$git_revision"
  echo "FRONTEND_IMAGE=$ACR_REGISTRY/$ACR_NAMESPACE/vibefit-frontend@$digest"
} > "$lock_file"
mv "$lock_file" scripts/images.lock.env
trap - EXIT HUP INT TERM
echo "Published frontend image for $release_tag and wrote scripts/images.lock.env"
