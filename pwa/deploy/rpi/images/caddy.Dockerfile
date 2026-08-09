ARG CADDY_IMAGE=caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d
FROM ${CADDY_IMAGE}

USER root
RUN apk add --no-cache curl

ARG APP_VERSION=2.10.2
ARG GIT_REVISION=upstream
LABEL org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$GIT_REVISION \
      org.opencontainers.image.source=https://github.com/caddyserver/caddy-docker
