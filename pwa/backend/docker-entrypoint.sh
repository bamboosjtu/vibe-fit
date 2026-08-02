#!/bin/sh
set -e

# 数据库 schema 初始化（固定为版本 1）
# 使用 psql 直接执行 SQL，不依赖 prisma CLI。
# 幂等：已初始化的数据库会跳过。
TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')" 2>/dev/null || echo "f")
if [ "$TABLE_EXISTS" != "t" ]; then
  echo "[entrypoint] Initializing database schema (v1)..."
  psql "$DATABASE_URL" -f /app/prisma/migrations/20260801000000_init/migration.sql
  echo "[entrypoint] Schema initialized."
else
  echo "[entrypoint] Schema already exists, skipping initialization."
fi

echo "[entrypoint] Starting server..."
exec node dist/server.js
