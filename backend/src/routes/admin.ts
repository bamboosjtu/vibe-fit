import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";
import { repositories } from "../repositories/index.js";

/** 管理 token 鉴权：ADMIN_TOKEN 为空时全部返回 404 */
function adminGuard(request: FastifyRequest, reply: FastifyReply): void {
  if (!env.ADMIN_TOKEN) {
    reply.code(404).send("Not Found");
    return;
  }
  const token =
    (request.query as Record<string, string>).token
    || request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (token !== env.ADMIN_TOKEN) {
    reply.code(401).type("text/html").send(renderAuthPage());
  }
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function payloadSize(payload: unknown): string {
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 构建 token query string（用于页面间链接保持鉴权） */
function tokenQuery(request: FastifyRequest): string {
  const token = (request.query as Record<string, string>).token;
  return token ? `?token=${encodeURIComponent(token)}` : "";
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · VibeFit Admin</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; color: #222; }
  .header { background: #05A978; color: #fff; padding: 12px 20px; display: flex; align-items: center; gap: 16px; }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header a { color: #fff; text-decoration: none; font-size: 13px; opacity: 0.85; }
  .container { max-width: 1100px; margin: 20px auto; padding: 0 20px; }
  table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-radius: 6px; overflow: hidden; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
  th { background: #fafafa; font-weight: 600; color: #666; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f9f9f9; }
  a { color: #05A978; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .info-card { background: #fff; border-radius: 6px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .info-card h2 { font-size: 16px; margin-bottom: 12px; }
  .info-card dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; }
  .info-card dt { color: #999; font-size: 12px; }
  .info-card dd { font-weight: 500; word-break: break-all; }
  pre { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px; overflow: auto; font-size: 12px; line-height: 1.6; max-height: 70vh; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #e6f4ea; color: #137333; }
  .badge-gray { background: #f1f3f4; color: #5f6368; }
  .empty { text-align: center; padding: 40px; color: #999; }
  .back { margin-bottom: 16px; }
  code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <h1>VibeFit Admin</h1>
  <a href="/admin">用户列表</a>
</div>
<div class="container">${body}</div>
</body>
</html>`;
}

function renderAuthPage(): string {
  return layout("登录", `
    <div class="info-card">
      <h2>管理后台鉴权</h2>
      <p>在 URL 后加 <code>?token=你的ADMIN_TOKEN</code> 访问。</p>
    </div>
  `);
}

async function renderUserList(request: FastifyRequest): Promise<string> {
  const tq = tokenQuery(request);
  const users = await repositories.users.listAll();

  const rows = users.length === 0
    ? '<tr><td colspan="7" class="empty">暂无注册用户</td></tr>'
    : users.map((u) => `<tr>
        <td><a href="/admin/users/${u.id}${tq}">${esc(u.email)}</a></td>
        <td>${esc(u.name || "—")}</td>
        <td>${fmtDate(u.createdAt)}</td>
        <td><span class="badge ${u.backupCount > 0 ? "badge-green" : "badge-gray"}">${u.backupCount}</span></td>
        <td>${fmtDate(u.lastBackupAt)}</td>
        <td>${fmtDate(u.lastSyncedAt)}</td>
      </tr>`).join("");

  return layout("用户列表", `
    <table>
      <thead>
        <tr><th>邮箱</th><th>姓名</th><th>注册时间</th><th>备份数</th><th>最近备份</th><th>最近同步</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

async function renderUserDetail(request: FastifyRequest): Promise<string> {
  const { id } = request.params as { id: string };
  const tq = tokenQuery(request);

  const user = await repositories.users.findStatsById(id);
  if (!user) {
    return layout("未找到", '<div class="empty">用户不存在</div>');
  }

  const backups = await repositories.backups.listByUserId(id);

  const rows = backups.length === 0
    ? '<tr><td colspan="5" class="empty">暂无备份</td></tr>'
    : backups.map((b) => `<tr>
        <td><code>${b.id.slice(0, 8)}</code></td>
        <td>${esc(b.deviceId || "—")}</td>
        <td>${fmtDate(b.createdAt)}</td>
        <td>${payloadSize(b.payload)}</td>
        <td><a href="/admin/backups/${b.id}${tq}">查看 JSON</a></td>
      </tr>`).join("");

  return layout("用户详情", `
    <div class="back"><a href="/admin${tq}">← 返回用户列表</a></div>
    <div class="info-card">
      <h2>${esc(user.email)}</h2>
      <dl>
        <dt>用户 ID</dt><dd><code>${user.id}</code></dd>
        <dt>姓名</dt><dd>${esc(user.name || "—")}</dd>
        <dt>注册时间</dt><dd>${fmtDate(user.createdAt)}</dd>
        <dt>备份数</dt><dd>${user.backupCount}</dd>
        <dt>最近备份</dt><dd>${fmtDate(user.lastBackupAt)}</dd>
        <dt>最近同步</dt><dd>${fmtDate(user.lastSyncedAt)}</dd>
      </dl>
    </div>
    <h3 style="margin: 16px 0 8px; font-size: 14px;">备份快照列表</h3>
    <table>
      <thead><tr><th>备份 ID</th><th>设备</th><th>创建时间</th><th>大小</th><th>查看</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

async function renderBackupDetail(request: FastifyRequest): Promise<string> {
  const { id } = request.params as { id: string };
  const backup = await repositories.backups.findById(id);
  if (!backup) {
    return layout("未找到", '<div class="empty">备份不存在</div>');
  }

  const payload = backup.payload as Record<string, unknown>;
  const plans = Array.isArray(payload?.plans) ? payload.plans.length : 0;
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions.length : 0;
  const exercises = Array.isArray(payload?.exercises) ? payload.exercises.length : 0;

  return layout("备份详情", `
    <div class="back"><a href="/admin/users/${backup.userId}${tokenQuery(request)}">← 返回用户</a></div>
    <div class="info-card">
      <h2>备份 <code>${backup.id.slice(0, 8)}</code></h2>
      <dl>
        <dt>备份 ID</dt><dd><code>${backup.id}</code></dd>
        <dt>用户 ID</dt><dd><code>${backup.userId}</code></dd>
        <dt>设备 ID</dt><dd>${esc(backup.deviceId || "—")}</dd>
        <dt>创建时间</dt><dd>${fmtDate(backup.createdAt)}</dd>
        <dt>大小</dt><dd>${payloadSize(backup.payload)}</dd>
        <dt>计划数</dt><dd>${plans}</dd>
        <dt>训练记录数</dt><dd>${sessions}</dd>
        <dt>动作数</dt><dd>${exercises}</dd>
      </dl>
    </div>
    <h3 style="margin: 16px 0 8px; font-size: 14px;">Payload JSON</h3>
    <pre>${esc(JSON.stringify(backup.payload, null, 2))}</pre>
  `);
}

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/admin", { preHandler: [adminGuard] }, async (request, reply) => {
    reply.type("text/html").send(await renderUserList(request));
  });

  fastify.get("/admin/users/:id", { preHandler: [adminGuard] }, async (request, reply) => {
    reply.type("text/html").send(await renderUserDetail(request));
  });

  fastify.get("/admin/backups/:id", { preHandler: [adminGuard] }, async (request, reply) => {
    reply.type("text/html").send(await renderBackupDetail(request));
  });
}
