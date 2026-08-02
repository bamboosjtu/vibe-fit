#!/bin/sh
# 多架构（AMD64 + ARM64）本地构建脚本
#
# 用法：
#   ./build-multiarch.sh          # 构建 backend + worker 双架构镜像
#   ./build-multiarch.sh backend  # 仅构建 backend
#   ./build-multiarch.sh worker   # 仅构建 worker
#
# 前提：
#   docker buildx create --use --name multiarch --driver docker-container
#   docker buildx inspect --bootstrap
#
# 说明：
#   - 本地 Docker 部署使用 docker compose（自动匹配宿主架构）
#   - 此脚本用于手动构建多架构镜像（如推送到局域网仓库供 ARM 设备拉取）
#   - Cloud Run 部署使用 cloudbuild.backend.yaml（AMD64）

set -e

CONTEXT_DIR="./backend"
REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
TAG="${TAG:-latest}"

build_backend() {
  echo "Building backend (api-runtime) for linux/amd64,linux/arm64..."
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --target api-runtime \
    -t "${REGISTRY}/vibe-fit-backend:${TAG}" \
    --push \
    "${CONTEXT_DIR}"
}

build_worker() {
  echo "Building worker (worker-runtime) for linux/amd64,linux/arm64..."
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --target worker-runtime \
    -t "${REGISTRY}/vibe-fit-worker:${TAG}" \
    --push \
    "${CONTEXT_DIR}"
}

TARGET="${1:-all}"

case "$TARGET" in
  backend)
    build_backend
    ;;
  worker)
    build_worker
    ;;
  all)
    build_backend
    build_worker
    ;;
  *)
    echo "Usage: $0 [backend|worker|all]"
    exit 1
    ;;
esac

echo "Done. Images pushed to ${REGISTRY}"
