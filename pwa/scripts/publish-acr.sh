#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PWA_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$PWA_DIR"

base_image_lock=deploy/rpi/base-images.lock.env
[ -r "$base_image_lock" ] || {
  echo "Missing base image lock: $base_image_lock" >&2
  exit 66
}
# Values are repository-controlled immutable image references without whitespace.
. "./$base_image_lock"
export NODE_IMAGE NGINX_IMAGE POSTGRES_IMAGE CADDY_IMAGE

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

lock_file=$(mktemp deploy/rpi/images.lock.env.tmp.XXXXXX)
trap 'rm -f "$lock_file"' EXIT HUP INT TERM
{
  echo "RELEASE_VERSION=$release_version"
  echo "GIT_REVISION=$git_revision"
} > "$lock_file"

for pair in \
  "BACKEND_IMAGE vibefit-backend" \
  "WORKER_IMAGE vibefit-worker" \
  "FRONTEND_IMAGE vibefit-frontend" \
  "MAINTENANCE_IMAGE vibefit-maintenance" \
  "POSTGRES_IMAGE vibefit-postgres" \
  "CADDY_IMAGE vibefit-caddy"
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
  # The first Digest line is the multi-platform index digest documented by
  # `imagetools inspect`; child manifests are rendered as Name: ...@sha256.
  digest=$(printf '%s\n' "$inspection" \
    | sed -n 's/^[[:space:]]*Digest:[[:space:]]*//p' \
    | head -n 1)
  echo "$digest" | grep -Eq '^sha256:[0-9a-f]{64}$' || {
    echo "Cannot resolve an immutable digest for $image: $digest" >&2
    exit 65
  }
  echo "$variable_name=$ACR_REGISTRY/$ACR_NAMESPACE/$repository_name@$digest" >> "$lock_file"
done

mv "$lock_file" deploy/rpi/images.lock.env
trap - EXIT HUP INT TERM
echo "Published $release_tag and wrote deploy/rpi/images.lock.env"
