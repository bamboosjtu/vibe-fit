# Vibe-Fit 后端 API

后端使用 **Node.js, TypeScript 和 Fastify** 构建。它为离线优先的前端提供可选的云端同步和备份层。

`m2-backend-api`阶段，使用内存模拟数据库（`mockDb.ts`）在本地验证 API 逻辑和身份验证流程。

## 一、基础 URL

在开发环境和本地联调环境中，后端运行在 `http://localhost:8080`。

## 二、接口概览 (Endpoints Overview)

### 1. 健康检查与元数据

- `GET /health`: 负载均衡器的标准健康检查（返回 `{ status: "ok" }`）。
- `GET /api/version`: 返回 API 版本和环境信息。

### 2. 身份验证 (Authentication)

> 注意：在开发环境中，我们使用模拟 Token 生成器，而不是真实的 OAuth 提供商。

- `POST /dev/login`: 仅限开发的端点，用于登录并获取 JWT 以进行测试。
  - 请求体：`{ "email": "user@example.com", "password": "password123" }`
- `POST /api/auth/register`: 注册新的模拟用户。
- `POST /api/auth/login`: 与 `/dev/login` 相同，用于模拟生产环境的登录。
- `GET /api/me`: 返回当前已通过验证的用户信息。
  - 鉴权：`Authorization: Bearer <token>`

### 3. 同步与备份 (Sync & Backups)

这些接口旨在接受和返回整个应用程序状态（IndexedDB 快照），以支持离线优先架构。

- `POST /api/backups`: 将本地应用状态推送到云端。
  - 鉴权：`Authorization: Bearer <token>`
  - 请求体：
    ```json
    {
      "schemaVersion": 1,
      "exportedAt": "ISOString",
      "appVersion": "1.0.0",
      "settings": {},
      "plans": [],
      "sessions": [],
      "exercises": []
    }
    ```
  - 响应：`{ "success": true, "syncedAt": "ISOString", "message": "..." }`

- `GET /api/backups/latest`: 从云端拉取最新的备份状态。
  - 鉴权：`Authorization: Bearer <token>`
  - 响应：
    ```json
    {
      "success": true,
      "data": {
        "schemaVersion": 1,
        "exportedAt": "ISOString",
        "appVersion": "1.0.0",
        "settings": {},
        "plans": [],
        "sessions": []
      },
      "syncedAt": "ISOString"
    }
    ```

