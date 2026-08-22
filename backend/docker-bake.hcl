# VibeFit Backend 镜像构建编排
#
# 用法：在 backend/ 目录下
#   docker buildx bake --file docker-bake.hcl --push
#
# 产出镜像（多架构 linux/amd64 + linux/arm64）：
#   - vibefit-backend       （Fastify API，api-runtime target）
#   - vibefit-worker        （备份事件 worker，worker-runtime target）
#   - vibefit-maintenance   （树莓派备份/恢复运维镜像）
#   - vibefit-postgres      （树莓派 PostgreSQL 镜像）
#   - vibefit-caddy         （树莓派 HTTPS 网关镜像）
#
# frontend 镜像由 pwa/docker-bake.hcl 单独构建，避免跨端耦合。

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
  default = "node:24.19.0-alpine3.23@sha256:244cc2b53f46f9e876304391d17682b0ddae9ac33491f4857e25e35a36ba7995"
}

variable "POSTGRES_IMAGE" {
  default = "postgres:15.18-alpine@sha256:3d0f7584ed7d04e27fa050d6683a74746608faf21f202be78460d679cc56461f"
}

variable "CADDY_IMAGE" {
  default = "caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d"
}

group "default" {
  targets = ["backend", "worker", "maintenance", "postgres", "caddy"]
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

target "maintenance" {
  inherits = ["common"]
  context = "./deploy/rpi/maintenance"
  dockerfile = "Dockerfile"
  tags = [
    "${REGISTRY}/${NAMESPACE}/vibefit-maintenance:${VERSION}",
    "${REGISTRY}/${NAMESPACE}/vibefit-maintenance:${VERSION}-${GIT_REVISION}",
  ]
  args = {
    POSTGRES_IMAGE = POSTGRES_IMAGE
    APP_VERSION = VERSION
    GIT_REVISION = GIT_REVISION
  }
}

target "postgres" {
  inherits = ["common"]
  context = "./deploy/rpi/images"
  dockerfile = "postgres.Dockerfile"
  tags = [
    "${REGISTRY}/${NAMESPACE}/vibefit-postgres:${VERSION}",
    "${REGISTRY}/${NAMESPACE}/vibefit-postgres:${VERSION}-${GIT_REVISION}",
  ]
  args = {
    POSTGRES_IMAGE = POSTGRES_IMAGE
    APP_VERSION = "15.18"
    GIT_REVISION = GIT_REVISION
  }
}

target "caddy" {
  inherits = ["common"]
  context = "./deploy/rpi/images"
  dockerfile = "caddy.Dockerfile"
  tags = [
    "${REGISTRY}/${NAMESPACE}/vibefit-caddy:${VERSION}",
    "${REGISTRY}/${NAMESPACE}/vibefit-caddy:${VERSION}-${GIT_REVISION}",
  ]
  args = {
    CADDY_IMAGE = CADDY_IMAGE
    APP_VERSION = "2.10.2"
    GIT_REVISION = GIT_REVISION
  }
}
