ARG POSTGRES_IMAGE=postgres:15.18-alpine@sha256:3d0f7584ed7d04e27fa050d6683a74746608faf21f202be78460d679cc56461f
FROM ${POSTGRES_IMAGE}

ARG APP_VERSION=15.18
ARG GIT_REVISION=upstream
LABEL org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$GIT_REVISION \
      org.opencontainers.image.source=https://github.com/docker-library/postgres
