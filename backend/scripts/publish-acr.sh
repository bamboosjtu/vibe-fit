#!/bin/sh
# 发布 VibeFit 后端镜像到阿里云 ACR（多架构 + 不可变摘要锁）。
#
# 用法：在 backend/ 目录下
#   ACR_REGISTRY=crpi-xxx.personal.cr.aliyuncs.com \
#   ACR_NAMESPACE=vibefit \
#   RELEASE_VERSION=1.1.0 \
#   ./scripts/publish-acr.sh
#
# 产出镜像（linux/amd64 + linux/arm64）：
#   - vibefit-backend
#   - vibefit-worker
#
# 写入 backend/scripts/images.lock.env（仅后端 2 个镜像 + RELEASE_VERSION + GIT_REVISION），
# 供生产部署通过 image digest 引用。前端镜像由 pwa/scripts/publish-acr.sh 单独发布。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$BACKEND_DIR"

base_image_lock=scripts/base-images.lock.env
[ -r "$base_image_lock" ] || {
  echo "Missing base image lock: $base_image_lock" >&2
  exit 66
}
# Values are repository-controlled immutable image references without whitespace.
. "./$base_image_lock"
export NODE_IMAGE

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

# 锁文件位置：backend/scripts/images.lock.env
# 前端镜像由 pwa/scripts/publish-acr.sh 单独写入 pwa/scripts/images.lock.env。
lock_file=$(mktemp scripts/images.lock.env.tmp.XXXXXX)
trap 'rm -f "$lock_file"' EXIT HUP INT TERM
{
  echo "RELEASE_VERSION=$release_version"
  echo "GIT_REVISION=$git_revision"
} > "$lock_file"

for pair in \
  "BACKEND_IMAGE vibefit-backend" \
  "WORKER_IMAGE vibefit-worker"
do
  variable_name=${pair%% *}
  repository_name=${pair#* }
  image="$ACR_REGISTRY/$ACR_NAMESPACE/$repository_name:$release_tag"
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
  echo "$variable_name=$ACR_REGISTRY/$ACR_NAMESPACE/$repository_name@$digest" >> "$lock_file"
done

mv "$lock_file" scripts/images.lock.env
trap - EXIT HUP INT TERM
echo "Published backend images for $release_tag and wrote scripts/images.lock.env"
