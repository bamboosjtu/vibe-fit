#!/bin/sh
set -e

# 数据库 schema 初始化脚本（固定为 schema 1）
# 由 backend 容器启动时执行，无需独立迁移服务。
# prisma migrate deploy 是幂等的：已应用的迁移会跳过，仅执行新增迁移。
echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Migration complete, starting server..."
exec node dist/server.js
