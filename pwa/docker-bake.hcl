# VibeFit Frontend (PWA/H5) 镜像构建编排
#
# 用法：在 pwa/ 目录下
#   docker buildx bake --file docker-bake.hcl --push
#
# 产出镜像（多架构 linux/amd64 + linux/arm64）：
#   - vibefit-frontend  （nginx + 构建产物 + Service Worker）
#
# backend 镜像由 backend/docker-bake.hcl 单独构建。前端镜像默认不反代后端，
# 跨端一体化部署由 backend/deploy/rpi/compose.yaml 编排（通过 FRONTEND_IMAGE 引用）。

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

group "default" {
  targets = ["frontend"]
}

target "common" {
  platforms = ["linux/amd64", "linux/arm64"]
  pull = true
}

target "frontend" {
  inherits = ["common"]
  context = "."
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
    # 默认空字符串 → 前端使用同源相对路径 /api/*，由部署侧网关反代到 backend。
    # Android 构建可注入局域网/公网 backend URL。
    VITE_API_BASE_URL = ""
    VITE_AUTH_MODE = "email"
  }
}
