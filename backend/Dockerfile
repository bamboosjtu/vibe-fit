# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build


# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
COPY prisma ./prisma

# 注意：这里先完整安装，包括 prisma CLI
RUN npm ci

# 在最终镜像里再生成一次 Prisma Client
RUN npx prisma generate

# 再删掉 devDependencies
RUN npm prune --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 8080

USER node

CMD ["node", "dist/server.js"]