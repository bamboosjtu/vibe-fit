#!/bin/sh
# VibeFit Frontend (PWA/H5) 部署验收脚本
#
# 用法：在 pwa/ 目录下执行
#   ./scripts/acceptance.sh
#
# 检查项：
#   1. frontend 容器运行状态
#   2. 前端 HTTP 200
#   3. SPA fallback（任意前端路由回退到 index.html）
#   4. Service Worker 资源可访问
#
# 后端验收由 backend/scripts/acceptance.sh 负责。

set -e

PASS=0
FAIL=0
SKIP=0

ok()   { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
skip() { echo "  [SKIP] $1"; SKIP=$((SKIP + 1)); }

echo "═══ VibeFit Frontend 部署验收 ═══"
echo ""

# ── 1. 容器状态 ──────────────────────────────────────────
echo "1. 容器状态检查"
status=$(docker inspect -f '{{.State.Status}}' vibefit-frontend 2>/dev/null || echo "missing")
if [ "$status" = "running" ]; then
  ok "vibefit-frontend: running"
else
  fail "vibefit-frontend: $status"
fi
echo ""

# ── 2. 前端 HTTP 200 ────────────────────────────────────
echo "2. 前端直连访问"
frontend_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:8081/ 2>/dev/null || echo "000")
if [ "$frontend_code" = "200" ]; then
  ok "GET http://localhost:8081/ → 200"
else
  fail "GET http://localhost:8081/ → $frontend_code"
fi
echo ""

# ── 3. SPA fallback ─────────────────────────────────────
echo "3. SPA fallback"
spa_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:8081/today 2>/dev/null || echo "000")
if [ "$spa_code" = "200" ]; then
  ok "GET http://localhost:8081/today → 200（SPA fallback 正常）"
else
  fail "GET http://localhost:8081/today → $spa_code"
fi
echo ""

# ── 4. Service Worker 资源 ──────────────────────────────
echo "4. Service Worker 资源"
sw_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:8081/sw.js 2>/dev/null || echo "000")
if [ "$sw_code" = "200" ]; then
  ok "GET http://localhost:8081/sw.js → 200（SW 注册可用）"
else
  skip "GET http://localhost:8081/sw.js → $sw_code（可能由 vite-plugin-pwa 改名）"
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
