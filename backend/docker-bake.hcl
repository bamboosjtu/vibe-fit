# VibeFit Backend 镜像构建编排
#
# 用法：在 backend/ 目录下
#   docker buildx bake --file docker-bake.hcl --push
#
# 产出镜像（多架构 linux/amd64 + linux/arm64）：
#   - vibefit-backend       （Fastify API，api-runtime target）
#   - vibefit-worker        （备份事件 worker，worker-runtime target）
#
# frontend 镜像由 pwa/docker-bake.hcl 单独构建，前后端独立部署。

variable "REGISTRY" {
  default = "crpi-replace.cn-hangzhou.personal.cr.aliyuncs.com"
}

variable "NAMESPACE" {
  default = "vibefit"
}

variable "VERSION" {
  default = "1.1.0"
}

variable "GIT_REVISION" {
  default = "dev"
}

variable "NODE_IMAGE" {
  # 锁定基础镜像 digest，由 scripts/base-images.lock.env 覆盖
  default = "node:24.19.0-alpine3.23@sha256:244cc2b53f46f9e876304391d17682b0ddae9ac33491f4857e25e35a36ba7995"
}

group "default" {
  targets = ["backend", "worker"]
}

target "common" {
  platforms = ["linux/amd64", "linux/arm64"]
  pull = true
}

target "backend" {
  inherits = ["common"]
  context = "."
  dockerfile = "Dockerfile"
  target = "api-runtime"
  tags = [
    "${REGISTRY}/${NAMESPACE}/vibefit-backend:${VERSION}",
    "${REGISTRY}/${NAMESPACE}/vibefit-backend:${VERSION}-${GIT_REVISION}",
  ]
  args = {
    NODE_IMAGE = NODE_IMAGE
    APP_VERSION = VERSION
    GIT_REVISION = GIT_REVISION
  }
}

target "worker" {
  inherits = ["common"]
  context = "."
  dockerfile = "Dockerfile"
  target = "worker-runtime"
  tags = [
    "${REGISTRY}/${NAMESPACE}/vibefit-worker:${VERSION}",
    "${REGISTRY}/${NAMESPACE}/vibefit-worker:${VERSION}-${GIT_REVISION}",
  ]
  args = {
    NODE_IMAGE = NODE_IMAGE
    APP_VERSION = VERSION
    GIT_REVISION = GIT_REVISION
  }
}
