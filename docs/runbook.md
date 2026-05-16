# VibeFit 运行手册 Runbook

## 0. 适用范围

本文档用于 VibeFit 在 Google Cloud dev 环境中的故障排查与恢复。

核心服务：

- Frontend Cloud Run：`vibe-fit-frontend`
- Backend Cloud Run：`vibe-fit-backend-dev`
- Worker Cloud Run：`vibe-fit-worker-dev`
- Cloud SQL PostgreSQL：`vibe-fit-postgres`
- Pub/Sub Topic：`vibe-fit-backup-created`
- Pub/Sub Subscription：`vibe-fit-backup-created-worker-sub`

建议先设置以下 PowerShell 环境变量：

```powershell
$env:PROJECT_ID = "gen-lang-client-0642180192"
$env:REGION = "asia-east1"
$env:BACKEND_SERVICE = "vibe-fit-backend-dev"
$env:WORKER_SERVICE = "vibe-fit-worker-dev"
$env:BACKEND_URL = "https://vibe-fit-backend-dev-1085526549756.asia-east1.run.app"
```

---

## 1. 快速健康检查

### 1.1 Backend

```powershell
Invoke-WebRequest "$env:BACKEND_URL/health" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/healthz" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/readyz" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/api/version" -UseBasicParsing
```

期望结果：

- `/health` 返回 200
- `/healthz` 返回 200
- `/readyz` 返回 200
- `/api/version` 中 `authMode=google`，`dataMode=postgres`

### 1.2 Worker

Worker 是私有 Cloud Run service，不做公开 Uptime Check。

检查最近是否成功处理过事件：

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-worker-dev`" AND jsonPayload.msg=`"Processed backup.created event`""

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=20 `
  --format="table(timestamp,jsonPayload.msg,jsonPayload.eventId,jsonPayload.backupId,jsonPayload.userId,jsonPayload.deviceId)"
```

### 1.3 Pub/Sub Subscription

```powershell
gcloud pubsub subscriptions describe vibe-fit-backup-created-worker-sub `
  --project=$env:PROJECT_ID
```

期望看到：

```text
state: ACTIVE
topic: projects/.../topics/vibe-fit-backup-created
pushEndpoint: https://.../pubsub/backups
oidcToken.serviceAccountEmail: vibe-fit-pubsub-push-sa@...
```

---

## 2. 告警：Backend readiness failure

### 2.1 含义

Backend 的 Uptime Check 失败，通常表示 `/readyz` 没有返回 200。

### 2.2 影响

Backend 可能不可访问，或者 Backend 虽然进程存活，但无法访问关键依赖，例如 Cloud SQL。

### 2.3 第一检查项

```powershell
Invoke-WebRequest "$env:BACKEND_URL/health" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/readyz" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/api/version" -UseBasicParsing
```

### 2.4 如何判断

| 结果 | 含义 |
|---|---|
| `/health` 200，`/readyz` 404 | `/readyz` 路由还没有部署 |
| `/health` 200，`/readyz` 503 | Backend 进程存活，但依赖检查失败 |
| `/api/version` 200，`/readyz` 失败 | 运行时正常，但 readiness 依赖失败 |
| 全部失败 | Backend 服务或 Cloud Run 路由异常 |

### 2.5 查看日志

```powershell
gcloud run services logs read $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --limit=100
```

### 2.6 常见原因

- `/readyz` 路由没有部署
- Cloud SQL 连接失败
- `DATABASE_URL` Secret 错误
- Backend service account 缺少 Cloud SQL Client 权限
- Prisma Client 或 migration 异常

### 2.7 恢复动作

1. 如果 `/readyz` 不存在，部署包含 `/readyz` 的 backend 版本。
2. 如果 `/readyz` 返回 503，检查 Cloud SQL、`DATABASE_URL` 和 backend service account 权限。
3. 如果是新版本导致异常，回滚 backend revision。

---

## 3. 告警：Backend 5xx

### 3.1 含义

Backend 返回 5xx 错误。

### 3.2 影响

用户可能无法登录、注册、同步备份、恢复备份或获取最新备份。

### 3.3 第一检查项

```powershell
Invoke-WebRequest "$env:BACKEND_URL/api/version" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/readyz" -UseBasicParsing
```

### 3.4 查看服务日志

```powershell
gcloud run services logs read $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --limit=100
```

### 3.5 查询结构化 5xx 日志

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-backend-dev`" AND httpRequest.status>=500"

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=50 `
  --format="table(timestamp,httpRequest.status,httpRequest.requestUrl,jsonPayload.msg,textPayload)"
```

### 3.6 常见原因

- Google Auth 配置错误
- JWT Secret 不一致
- Cloud SQL 连接失败
- Prisma migration 与数据库状态不一致
- 新版本部署后引入 bug
- Cloud Run 环境变量缺失
- Secret Manager 配置错误

### 3.7 恢复动作

1. 检查 `/api/version`，确认 `authMode`、`dataMode` 是否正确。
2. 检查 `/readyz`，判断数据库依赖是否正常。
3. 查看 backend 日志。
4. 如果是新版本导致，回滚 backend。
5. 如果是配置问题，修正环境变量或 Secret 后重新部署。

---

## 4. 告警：Worker 5xx

### 4.1 含义

Pub/Sub 推送消息到 Worker 后，Worker 返回 5xx。

### 4.2 影响

Pub/Sub 会重试消息。持续失败可能导致消息积压，也可能造成重复投递。

### 4.3 查询 5xx 日志

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-worker-dev`" AND httpRequest.status>=500"

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=50 `
  --format="table(timestamp,httpRequest.status,httpRequest.requestUrl,jsonPayload.msg,textPayload)"
```

### 4.4 检查 Worker 部署入口

```powershell
gcloud run services describe $env:WORKER_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --format="yaml(spec.template.spec.containers[0].image,spec.template.spec.containers[0].command,spec.template.spec.containers[0].args)"
```

期望看到：

```yaml
command:
- node
args:
- dist/worker.js
```

### 4.5 常见原因

- Worker 部署入口错误，不是 `dist/worker.js`
- Pub/Sub message body 格式不正确
- 事件 schema 校验失败
- Worker 代码 bug
- Worker 缺少必要环境变量或 Secret

### 4.6 恢复动作

1. 确认 Worker 启动入口是 `dist/worker.js`。
2. 检查 Worker 日志。
3. 如果是新版本导致，回滚 Worker。
4. 如果是事件格式问题，检查 publisher 代码和 `eventVersion`。

---

## 5. 告警：Pub/Sub backlog

### 5.1 含义

消息进入 Pub/Sub 后，没有被 Worker 成功 ack。

主要指标：

```text
Cloud Pub/Sub Subscription → Oldest unacked message age
```

### 5.2 影响

异步 `backup.created` 事件处理延迟。如果 backlog 持续增长，说明 Worker 消费链路异常。

### 5.3 第一检查项

```powershell
gcloud pubsub subscriptions describe vibe-fit-backup-created-worker-sub `
  --project=$env:PROJECT_ID
```

### 5.4 查看 Worker 日志

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-worker-dev`""

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=50 `
  --format="table(timestamp,httpRequest.status,httpRequest.requestUrl,jsonPayload.msg,textPayload)"
```

### 5.5 检查 Subscription 配置

期望：

```text
state: ACTIVE
pushEndpoint: https://.../pubsub/backups
oidcToken.serviceAccountEmail: vibe-fit-pubsub-push-sa@...
topic: projects/.../topics/vibe-fit-backup-created
```

### 5.6 常见原因

- Worker 返回 5xx
- Worker endpoint 配错
- Pub/Sub push service account 缺少 Cloud Run Invoker 权限
- Worker service 未部署或 revision 不健康
- Worker 处理速度过慢

### 5.7 恢复动作

1. 先修复 Worker 5xx。
2. 确认 subscription endpoint 是 `/pubsub/backups`。
3. 确认 `vibe-fit-pubsub-push-sa` 有 Worker 的 `roles/run.invoker`。
4. 等待 Pub/Sub 自动重试。
5. 修复后手动发布测试消息验证。

### 5.8 Worker smoke test

发布测试事件：

```powershell
$event = @{
  eventType = "backup.created"
  eventVersion = 1
  eventId = [guid]::NewGuid().ToString()
  occurredAt = (Get-Date).ToUniversalTime().ToString("o")
  userId = [guid]::NewGuid().ToString()
  backupId = [guid]::NewGuid().ToString()
  deviceId = "manual-runbook-worker-test"
} | ConvertTo-Json -Compress

gcloud pubsub topics publish vibe-fit-backup-created `
  --message="$event" `
  --attribute="eventType=backup.created,eventVersion=1" `
  --project=$env:PROJECT_ID
```

查询处理结果：

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-worker-dev`" AND jsonPayload.deviceId=`"manual-runbook-worker-test`""

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=10 `
  --format="table(timestamp,jsonPayload.msg,jsonPayload.eventId,jsonPayload.backupId,jsonPayload.deviceId)"
```

期望看到：

```text
Processed backup.created event
```

---

## 6. 告警：Event publish failed

### 6.1 含义

Backend 已经写入备份数据，但发布 `backup.created` 到 Pub/Sub 失败。

### 6.2 影响

用户侧备份可能成功，但异步处理不会运行。

当前系统还没有 outbox pattern，因此这个告警比较重要。

### 6.3 查询失败日志

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-backend-dev`" AND jsonPayload.msg=`"Failed to publish backup.created`""

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=20 `
  --format="table(timestamp,jsonPayload.msg,jsonPayload.backupId,jsonPayload.userId,jsonPayload.err.message)"
```

### 6.4 检查 Backend 环境变量

```powershell
gcloud run services describe $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --format="yaml(spec.template.spec.serviceAccountName,spec.template.spec.containers[0].env)"
```

期望：

```text
EVENT_PUBLISHER=pubsub
PUBSUB_TOPIC_BACKUP_CREATED=vibe-fit-backup-created
serviceAccountName: vibe-fit-backend-sa@...
```

### 6.5 检查 Topic

```powershell
gcloud pubsub topics describe vibe-fit-backup-created `
  --project=$env:PROJECT_ID
```

### 6.6 检查 IAM

```powershell
gcloud projects get-iam-policy $env:PROJECT_ID `
  --flatten="bindings[].members" `
  --filter="bindings.members:vibe-fit-backend-sa" `
  --format="table(bindings.role)"
```

期望有：

```text
roles/pubsub.publisher
```

### 6.7 常见原因

- `EVENT_PUBLISHER` 不是 `pubsub`
- `PUBSUB_TOPIC_BACKUP_CREATED` 配错
- Topic 不存在
- Backend service account 缺少 Pub/Sub Publisher 权限
- Pub/Sub API 异常

### 6.8 恢复动作

1. 修正 Backend 环境变量。
2. 创建或修复 Topic。
3. 给 `vibe-fit-backend-sa` 授予 `roles/pubsub.publisher`。
4. 重新部署 Backend。
5. 重新测试 `/api/backups`。

---

## 7. 告警：Cloud SQL CPU high

### 7.1 含义

Cloud SQL CPU 使用率持续过高。

### 7.2 影响

Backend 延迟可能升高。如果数据库过载，`/readyz` 和业务接口可能失败。

### 7.3 第一检查项

- Cloud SQL CPU utilization dashboard
- Backend latency p95
- Backend 5xx
- Cloud SQL connections

### 7.4 查看 Backend 日志

```powershell
gcloud run services logs read $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --limit=100
```

### 7.5 常见原因

- 请求量突然增加
- 查询过重
- 数据库连接过多
- 新版本出现循环或异常请求
- backup payload 过大

### 7.6 恢复动作

1. 检查最近部署。
2. 如果 CPU 上升发生在新版本之后，优先回滚。
3. 必要时降低请求量。
4. 后续优化查询、payload 结构或连接管理。

---

## 8. 告警：Cloud SQL disk high

### 8.1 含义

Cloud SQL 磁盘使用率超过阈值。

### 8.2 影响

如果磁盘耗尽，数据库写入可能失败。

### 8.3 第一检查项

- Cloud SQL disk utilization dashboard
- `backup_snapshots` 数据量
- 最近备份流量

### 8.4 常见原因

- `backup_snapshots` 数据持续增长
- payload 太大
- 没有数据保留策略
- WAL 或日志增长

### 8.5 恢复动作

1. 确认 Cloud SQL 是否开启自动扩容。
2. 为旧 `backup_snapshots` 添加保留策略。
3. 后续考虑压缩 payload。
4. 后续增加清理任务或归档任务。

---

## 9. 回滚

### 9.1 查看 Backend revisions

```powershell
gcloud run revisions list `
  --service=$env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID
```

### 9.2 回滚 Backend

```powershell
gcloud run services update-traffic $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --to-revisions=REVISION_NAME=100
```

将 `REVISION_NAME` 替换成目标 revision 名称。

### 9.3 查看 Worker revisions

```powershell
gcloud run revisions list `
  --service=$env:WORKER_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID
```

### 9.4 回滚 Worker

```powershell
gcloud run services update-traffic $env:WORKER_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --to-revisions=REVISION_NAME=100
```

将 `REVISION_NAME` 替换成目标 revision 名称。

---

## 10. 事故处理流程

收到告警后，按以下流程处理：

1. 打开告警详情。
2. 确认告警策略名称。
3. 在本文档中找到对应章节。
4. 执行第一检查项命令。
5. 判断故障域：
   - Cloud Run Backend
   - Cloud Run Worker
   - Pub/Sub
   - Cloud SQL
   - IAM / Secret / 环境变量
   - 最近部署
6. 执行恢复动作：
   - 修配置
   - 重新部署
   - 回滚
   - 等待 Pub/Sub 自动重试
7. 确认恢复：
   - 告警 incident 关闭
   - Dashboard 指标恢复正常
   - smoke test 通过
8. 将本次事故的症状、原因、修复方式补充到 runbook 或项目文档。
