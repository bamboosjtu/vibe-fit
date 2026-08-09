# ─── base ───────────────────────────────────────────────────────────
ARG NODE_IMAGE=node:24.19.0-alpine3.23@sha256:244cc2b53f46f9e876304391d17682b0ddae9ac33491f4857e25e35a36ba7995
FROM ${NODE_IMAGE} AS base
ARG APP_VERSION=1.1.0
ARG GIT_REVISION=unknown
ENV APP_VERSION=$APP_VERSION
ENV GIT_REVISION=$GIT_REVISION
LABEL org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$GIT_REVISION
WORKDIR /app

# ─── dependencies ──────────────────────────────────────────────────
# 完整依赖（含 devDependencies），仅供编译与 Prisma Client 生成使用。
# 不作为最终镜像基础层。
# 注意：不设置 NODE_ENV=production，否则 npm ci 会跳过 devDependencies。
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# ─── builder ───────────────────────────────────────────────────────
# 编译 TypeScript + 生成 Prisma Client。
FROM dependencies AS builder
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src
# prisma.config.ts 加载时校验 DATABASE_URL，提供占位值；运行时由 compose 覆盖
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

# ─── production-dependencies ───────────────────────────────────────
# 干净安装生产依赖（不含 devDependencies），避免"先装后删"导致分层膨胀。
# --ignore-scripts: 跳过 @prisma/client postinstall（不需要再 generate）
# --omit=optional: 跳过 @prisma/client 的可选 peer dep "prisma" CLI
# Prisma Client 运行时由 builder 阶段生成后复制。
FROM base AS production-dependencies
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force
# 验证 @prisma/client 运行时存在且未引入 prisma CLI
RUN test -d node_modules/@prisma/client && ! test -f node_modules/.bin/prisma

# ─── api-runtime ───────────────────────────────────────────────────
# Backend API 运行镜像：编译产物 + 生产依赖 + Prisma Client 运行时 + psql 迁移工具
FROM base AS api-runtime
ENV NODE_ENV=production
# 安装 postgresql-client 用于 entrypoint 脚本执行 SQL 初始化 schema
RUN apk add --no-cache postgresql-client
# 生产依赖
COPY --from=production-dependencies /app/node_modules ./node_modules
# Prisma Client 运行时（由 builder 阶段 prisma generate 生成）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# 编译产物
COPY --from=builder /app/dist ./dist
# Prisma schema 与迁移 SQL（entrypoint 脚本用 psql 执行）
COPY --from=builder /app/prisma ./prisma
# 元数据
COPY package.json ./
# entrypoint 脚本
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 8080
USER node
ENTRYPOINT ["./docker-entrypoint.sh"]

# ─── worker-runtime ────────────────────────────────────────────────
# Worker 运行镜像：消费 backup.created，并通过 Prisma 执行快照保留策略。
FROM base AS worker-runtime
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY package.json ./
USER node
CMD ["node", "dist/worker.js"]
