# Dependencies + Prisma generation stage
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate


# Build stage
FROM deps AS builder

WORKDIR /app

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev && npm cache clean --force


# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 8080

USER node

CMD ["node", "dist/server.js"]