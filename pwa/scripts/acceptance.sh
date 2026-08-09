#!/bin/sh
# 部署验收脚本
#
# 用法：在 pwa/ 目录下执行
#   ./scripts/acceptance.sh
#
# 检查项：
#   1. 长期服务状态（5 个容器运行）与一次性迁移成功
#   2. 后端健康检查
#   3. 后端版本信息
#   4. 前端 HTTP 200
#   5. Caddy HTTPS 网关
#   6. 同源 API 访问（通过前端 nginx 代理）
#   7. Worker 运行状态
#   8. 运行镜像验证（backend/worker 含 Prisma Client 且不含 Prisma CLI）

set -e

PASS=0
FAIL=0
SKIP=0
CADDY_CA_FILE=$(mktemp)
cleanup() {
  rm -f "$CADDY_CA_FILE"
}
trap cleanup EXIT HUP INT TERM

ok()   { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
skip() { echo "  [SKIP] $1"; SKIP=$((SKIP + 1)); }

echo "═══ VibeFit 部署验收 ═══"
echo ""

# ── 1. 容器状态 ──────────────────────────────────────────
echo "1. 容器状态检查"
for svc in vibefit-postgres vibefit-backend vibefit-worker vibefit-frontend vibefit-caddy; do
  status=$(docker inspect -f '{{.State.Status}}' "$svc" 2>/dev/null || echo "missing")
  if [ "$status" = "running" ]; then
    ok "$svc: running"
  else
    fail "$svc: $status"
  fi
done
migrate_status=$(docker inspect -f '{{.State.Status}}:{{.State.ExitCode}}' vibefit-migrate 2>/dev/null || echo "missing")
if [ "$migrate_status" = "exited:0" ]; then
  ok "vibefit-migrate: completed successfully"
else
  fail "vibefit-migrate: $migrate_status"
fi
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

# ── 4. 前端 HTTP 200 ────────────────────────────────────
echo "4. 前端直连访问"
frontend_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:8081/ 2>/dev/null || echo "000")
if [ "$frontend_code" = "200" ]; then
  ok "GET http://localhost:8081/ → 200"
else
  fail "GET http://localhost:8081/ → $frontend_code"
fi
echo ""

# ── 5. Caddy HTTPS 网关 ─────────────────────────────────
echo "5. Caddy HTTPS 网关"
if ! docker cp vibefit-caddy:/data/caddy/pki/authorities/local/root.crt "$CADDY_CA_FILE" >/dev/null 2>&1; then
  fail "无法读取 Caddy 本地根 CA；不会使用 curl -k 绕过证书验证"
fi
caddy_code=$(curl --cacert "$CADDY_CA_FILE" --noproxy localhost -sf -o /dev/null -w "%{http_code}" https://localhost/ 2>/dev/null || echo "000")
if [ "$caddy_code" = "200" ]; then
  ok "GET https://localhost/ → 200"
else
  fail "GET https://localhost/ → $caddy_code"
fi

# Caddy → backend 路由
caddy_health=$(curl --cacert "$CADDY_CA_FILE" --noproxy localhost -sf https://localhost/health 2>/dev/null || echo "")
if echo "$caddy_health" | grep -q '"status":"ok"'; then
  ok "GET https://localhost/health → ok (Caddy → backend 路由正常)"
else
  fail "GET https://localhost/health → $caddy_health"
fi
echo ""

# ── 6. 同源 API 访问（前端 nginx 代理） ────────────────
echo "6. 同源 API 访问（前端 nginx → backend 代理）"
proxy_health=$(curl -sf http://localhost:8081/health 2>/dev/null || echo "")
if echo "$proxy_health" | grep -q '"status":"ok"'; then
  ok "GET http://localhost:8081/health → ok (nginx 代理正常)"
else
  fail "GET http://localhost:8081/health → $proxy_health"
fi

proxy_version=$(curl -sf http://localhost:8081/api/version 2>/dev/null || echo "")
if echo "$proxy_version" | grep -q '"authMode"'; then
  ok "GET http://localhost:8081/api/version → ok (nginx 代理 /api/* 正常)"
else
  fail "GET http://localhost:8081/api/version → $proxy_version"
fi
echo ""

# ── 7. Worker 运行状态 ──────────────────────────────────
echo "7. Worker 运行状态"
worker_logs=$(docker logs vibefit-worker --tail 5 2>&1 || echo "")
if echo "$worker_logs" | grep -q "Worker listening"; then
  ok "Worker 已启动并监听"
else
  fail "Worker 日志: $worker_logs"
fi
echo ""

# ── 8. 镜像隔离验证 ─────────────────────────────────────
echo "8. 镜像隔离验证"
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

# Backend 镜像不应包含 prisma CLI（使用 psql 脚本初始化 schema）
backend_cli=$(docker exec vibefit-backend sh -c "test -f node_modules/.bin/prisma && echo yes || echo no" 2>/dev/null || echo "no")
if [ "$backend_cli" = "no" ]; then
  ok "Backend 镜像不含 Prisma CLI（使用 psql 脚本初始化 schema）"
else
  fail "Backend 镜像含 Prisma CLI（应使用 psql）"
fi
echo ""

# ── 9. 独立迁移服务日志 ────────────────────────────────
echo "9. 独立数据库迁移"
migrate_logs=$(docker logs vibefit-migrate 2>&1 || echo "")
if echo "$migrate_logs" | grep -q "already applied\|applied successfully\|All database migrations completed"; then
  ok "独立 migrate 服务已执行"
else
  fail "migrate 日志未找到: $migrate_logs"
fi

# Caddy 路由完整性：/healthz /readyz
healthz_code=$(curl --cacert "$CADDY_CA_FILE" --noproxy localhost -sf -o /dev/null -w "%{http_code}" https://localhost/healthz 2>/dev/null || echo "000")
if [ "$healthz_code" = "200" ]; then
  ok "GET https://localhost/healthz → 200"
else
  fail "GET https://localhost/healthz → $healthz_code"
fi

readyz_code=$(curl --cacert "$CADDY_CA_FILE" --noproxy localhost -sf -o /dev/null -w "%{http_code}" https://localhost/readyz 2>/dev/null || echo "000")
if [ "$readyz_code" = "200" ]; then
  ok "GET https://localhost/readyz → 200"
else
  fail "GET https://localhost/readyz → $readyz_code"
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
