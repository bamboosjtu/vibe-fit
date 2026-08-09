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

variable "NGINX_IMAGE" {
  default = "nginx:1.29.4-alpine3.23@sha256:4870c12cd2ca986de501a804b4f506ad3875a0b1874940ba0a2c7f763f1855b2"
}

variable "POSTGRES_IMAGE" {
  default = "postgres:15.18-alpine@sha256:3d0f7584ed7d04e27fa050d6683a74746608faf21f202be78460d679cc56461f"
}

variable "CADDY_IMAGE" {
  default = "caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d"
}

group "default" {
  targets = ["backend", "worker", "frontend", "maintenance", "postgres", "caddy"]
}

target "common" {
  platforms = ["linux/amd64", "linux/arm64"]
  pull = true
}

target "backend" {
  inherits = ["common"]
  context = "./backend"
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
  context = "./backend"
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

target "frontend" {
  inherits = ["common"]
  context = "./frontend"
  dockerfile = "Dockerfile"
  tags = [
    "${REGISTRY}/${NAMESPACE}/vibefit-frontend:${VERSION}",
    "${REGISTRY}/${NAMESPACE}/vibefit-frontend:${VERSION}-${GIT_REVISION}",
  ]
  args = {
    NODE_IMAGE = NODE_IMAGE
    NGINX_IMAGE = NGINX_IMAGE
    APP_VERSION = VERSION
    GIT_REVISION = GIT_REVISION
    VITE_AUTH_MODE = "email"
    VITE_API_BASE_URL = ""
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
