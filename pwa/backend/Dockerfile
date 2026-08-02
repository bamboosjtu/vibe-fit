# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src

# prisma generate 不连接数据库，但 prisma.config.ts 加载时校验 DATABASE_URL，故提供占位值
# 运行时由 docker-compose 的 environment 覆盖为真实连接串
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN npx prisma generate
RUN npm run build


# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
# 同上：generate 阶段占位，运行时由 compose 覆盖
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

COPY package.json package-lock.json ./
COPY prisma ./prisma

# 注意：这里先完整安装，包括 prisma CLI
RUN npm ci

# 在最终镜像里再生成一次 Prisma Client
RUN npx prisma generate

# 再删掉 devDependencies（prisma 已在 dependencies 中，保留用于 entrypoint 脚本）
RUN npm prune --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# entrypoint 脚本：先执行 prisma migrate deploy 初始化 schema，再启动 server
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

USER node

ENTRYPOINT ["./docker-entrypoint.sh"]