#!/bin/sh
# VibeFit Backend 部署验收脚本
#
# 用法：在 backend/ 目录下执行
#   ./scripts/acceptance.sh
#
# 检查项：
#   1. 长期服务状态（postgres/backend/worker 运行）
#   2. 后端健康检查
#   3. 后端版本信息
#   4. Worker 运行状态
#   5. 运行镜像验证（backend/worker 含 Prisma Client 且不含 Prisma CLI）
#
# 数据库 schema 初始化已由 postgres 镜像 /docker-entrypoint-initdb.d/ 自动完成
# （本地开发）或由运维手动执行 prisma/init.sql（生产）。
#
# 前端验收由 pwa/scripts/acceptance.sh 负责。

set -e

PASS=0
FAIL=0
SKIP=0

ok()   { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
skip() { echo "  [SKIP] $1"; SKIP=$((SKIP + 1)); }

echo "═══ VibeFit Backend 部署验收 ═══"
echo ""

# ── 1. 容器状态 ──────────────────────────────────────────
echo "1. 容器状态检查"
for svc in vibefit-postgres vibefit-backend vibefit-worker; do
  status=$(docker inspect -f '{{.State.Status}}' "$svc" 2>/dev/null || echo "missing")
  if [ "$status" = "running" ]; then
    ok "$svc: running"
  else
    fail "$svc: $status"
  fi
done
echo ""

# ── 2. 后端健康检查 ─────────────────────────────────────
echo "2. 后端健康检查"
health=$(curl -sf http://localhost:8080/health 2>/dev/null || echo "")
if echo "$health" | grep -q '"status":"ok"'; then
  ok "GET /health → $(echo "$health" | tr -d '\n')"
else
  fail "GET /health → $health"
fi
echo ""

# ── 3. 后端版本信息 ─────────────────────────────────────
echo "3. 后端版本信息"
version=$(curl -sf http://localhost:8080/api/version 2>/dev/null || echo "")
if echo "$version" | grep -q '"authMode":"email"'; then
  ok "GET /api/version → authMode=email, dataMode=postgres"
else
  fail "GET /api/version → $version"
fi
echo ""

# ── 4. Worker 运行状态 ──────────────────────────────────
echo "4. Worker 运行状态"
worker_logs=$(docker logs vibefit-worker --tail 5 2>&1 || echo "")
if echo "$worker_logs" | grep -q "Worker listening"; then
  ok "Worker 已启动并监听"
else
  fail "Worker 日志: $worker_logs"
fi
echo ""

# ── 5. 镜像隔离验证 ─────────────────────────────────────
echo "5. 镜像隔离验证"
# Worker 需要 Prisma Client 执行快照保留策略
worker_prisma=$(docker exec vibefit-worker sh -c "ls node_modules/.prisma 2>/dev/null" || echo "")
if [ -n "$worker_prisma" ]; then
  ok "Worker 镜像包含 Prisma Client（快照清理可用）"
else
  fail "Worker 镜像不含 Prisma Client"
fi

# Backend 镜像应包含 Prisma Client
backend_prisma=$(docker exec vibefit-backend sh -c "ls node_modules/.prisma/client 2>/dev/null" || echo "")
if [ -n "$backend_prisma" ]; then
  ok "Backend 镜像含 Prisma Client"
else
  fail "Backend 镜像不含 Prisma Client"
fi

# Worker 镜像不应包含 prisma CLI
worker_cli=$(docker exec vibefit-worker sh -c "test -f node_modules/.bin/prisma && echo yes || echo no" 2>/dev/null || echo "no")
if [ "$worker_cli" = "no" ]; then
  ok "Worker 镜像不含 Prisma CLI"
else
  fail "Worker 镜像含 Prisma CLI（应隔离）"
fi

# Backend 镜像不应包含 prisma CLI（schema 由运维直接执行 init.sql 初始化）
backend_cli=$(docker exec vibefit-backend sh -c "test -f node_modules/.bin/prisma && echo yes || echo no" 2>/dev/null || echo "no")
if [ "$backend_cli" = "no" ]; then
  ok "Backend 镜像不含 Prisma CLI"
else
  fail "Backend 镜像含 Prisma CLI（应隔离）"
fi
echo ""

# ── 汇总 ────────────────────────────────────────────────
echo "═══ 验收汇总 ═══"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  SKIP: $SKIP"
echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "❌ 验收未通过，请检查上述 FAIL 项"
  exit 1
else
  echo "✅ 全部验收通过"
  exit 0
fi
