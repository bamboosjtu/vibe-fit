ARG POSTGRES_IMAGE=postgres:15.18-alpine@sha256:3d0f7584ed7d04e27fa050d6683a74746608faf21f202be78460d679cc56461f
FROM ${POSTGRES_IMAGE}

ARG APP_VERSION=1.1.0
ARG GIT_REVISION=unknown

USER root
RUN apk add --no-cache ca-certificates restic tzdata
RUN mkdir -p /backup /work /restore /server-config \
    && chown 70:70 /backup /work /restore

COPY scripts/ /usr/local/bin/
RUN chmod 0755 /usr/local/bin/vibefit-maintenance \
    /usr/local/bin/vibefit-backup \
    /usr/local/bin/vibefit-backup-init \
    /usr/local/bin/vibefit-backup-check \
    /usr/local/bin/vibefit-restore

LABEL org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$GIT_REVISION

ENTRYPOINT ["vibefit-maintenance"]
CMD ["backup"]
