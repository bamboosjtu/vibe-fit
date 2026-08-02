#!/bin/sh
set -e

# 数据库迁移机制（脚本化，不依赖 prisma CLI，不使用独立迁移服务）
#
# 使用 schema_migrations 表跟踪已应用的迁移：
#   1. 创建 schema_migrations 表（如不存在）
#   2. 兼容旧数据库：如果 schema_migrations 为空但 users 表已存在，
#      将所有现有迁移标记为已应用（旧机制已创建 schema）
#   3. 遍历 /app/prisma/migrations/*/migration.sql，执行未应用的迁移
#   4. 每次成功执行后记录到 schema_migrations 表
#
# 幂等：已应用的迁移会自动跳过。
# 支持增量：新增迁移文件后，重启容器会自动应用。

MIGRATIONS_DIR="/app/prisma/migrations"

# 1. 确保 schema_migrations 表存在
psql "$DATABASE_URL" -q -c "
CREATE TABLE IF NOT EXISTS \"schema_migrations\" (
    \"migration_name\" TEXT PRIMARY KEY,
    \"applied_at\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
" 2>/dev/null

# 2. 兼容旧数据库：如果 schema_migrations 为空但 users 表已存在，
#    说明旧机制已初始化 schema，将所有现有迁移标记为已应用
MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null || echo "0")
if [ "$MIGRATION_COUNT" = "0" ]; then
  USERS_EXISTS=$(psql "$DATABASE_URL" -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');" 2>/dev/null || echo "f")
  if [ "$USERS_EXISTS" = "t" ]; then
    echo "[entrypoint] Existing database detected without migration tracking. Bootstrapping schema_migrations..."
    if [ -d "$MIGRATIONS_DIR" ]; then
      for migration_dir in $(ls -1 "$MIGRATIONS_DIR" | grep -v "migration_lock.toml" | sort); do
        psql "$DATABASE_URL" -q -c "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_dir') ON CONFLICT DO NOTHING;" 2>/dev/null
        echo "[entrypoint] Marked $migration_dir as applied (bootstrap)."
      done
    fi
  fi
fi

# 3. 读取已应用的迁移
APPLIED=$(psql "$DATABASE_URL" -t -A -c "SELECT migration_name FROM schema_migrations;" 2>/dev/null || echo "")

# 4. 遍历迁移目录，按名称排序执行未应用的迁移
if [ -d "$MIGRATIONS_DIR" ]; then
  for migration_dir in $(ls -1 "$MIGRATIONS_DIR" | grep -v "migration_lock.toml" | sort); do
    migration_file="$MIGRATIONS_DIR/$migration_dir/migration.sql"
    if [ ! -f "$migration_file" ]; then
      continue
    fi

    # 检查是否已应用
    if echo "$APPLIED" | grep -qx "$migration_dir"; then
      echo "[entrypoint] Migration $migration_dir already applied, skipping."
      continue
    fi

    echo "[entrypoint] Applying migration: $migration_dir"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration_file"
    psql "$DATABASE_URL" -q -c "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_dir');" 2>/dev/null
    echo "[entrypoint] Migration $migration_dir applied successfully."
  done
else
  echo "[entrypoint] No migrations directory found at $MIGRATIONS_DIR"
fi

echo "[entrypoint] Starting server..."
exec node dist/server.js
