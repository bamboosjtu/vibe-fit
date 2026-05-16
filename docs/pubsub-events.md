# 事件驱动和异步消息

## 环境配置

### 第1步：依赖安装

```powershell
npm install @google-cloud/pubsub
```

### 第2步：创建 Topic

```powershell
# 创建TOPIC
gcloud pubsub topics create $env:TOPIC_BACKUP_CREATED --project=$env:PROJECT_ID

# 查看TOPIC
gcloud pubsub topics list --project=$env:PROJECT_ID
```

### 第3步：配置 account

```powershell
# 给 backend service account 增加 Pub/Sub Publisher
gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:${env:BACKEND_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/pubsub.publisher"

# 创建 worker service account
gcloud iam service-accounts create $env:WORKER_SERVICE_ACCOUNT `
  --display-name="Vibe Fit Worker" `
  --project=$env:PROJECT_ID

# 创建 Pub/Sub push service account
gcloud iam service-accounts create $env:PUBSUB_PUSH_SERVICE_ACCOUNT `
  --display-name="Vibe Fit PubSub Push" `
  --project=$env:PROJECT_ID

# 允许 Pub/Sub push 调用 private Worker
gcloud run services add-iam-policy-binding $env:WORKER_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --member="serviceAccount:${env:PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/run.invoker"

# 给 Pub/Sub service agent TokenCreator 权限
$env:PROJECT_NUMBER = gcloud projects describe $env:PROJECT_ID `
  --format="value(projectNumber)"
$env:PUBSUB_SERVICE_AGENT = "service-${env:PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"
Write-Host $env:PUBSUB_SERVICE_AGENT
gcloud iam service-accounts add-iam-policy-binding $env:PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL `
  --project=$env:PROJECT_ID `
  --member="serviceAccount:${env:PUBSUB_SERVICE_AGENT}" `
  --role="roles/iam.serviceAccountTokenCreator"
```

### 第4步：构建和部署 api 和 worker

1. 构建包含 worker 的后端镜像
2. 部署 backend API，开启真实 Pub/Sub
3. 部署 worker Cloud Run service

### 第5步：创建 Push Subscription

```powershell
gcloud pubsub subscriptions delete $env:SUBSCRIPTION_BACKUP_WORKER `
  --project=$env:PROJECT_ID

gcloud pubsub subscriptions create $env:SUBSCRIPTION_BACKUP_WORKER `
  --topic=$env:TOPIC_BACKUP_CREATED `
  --push-endpoint="${env:WORKER_URL}/pubsub/backups" `
  --push-auth-service-account=$env:PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL `
  --ack-deadline=30 `
  --project=$env:PROJECT_ID
```

## 目标链路

### 第1步：mock event

```
/api/backups
  ↓
写入 PostgreSQL 成功
  ↓
Mock publisher 执行成功
  ↓
返回 eventPublished: true
```

### 第2步：本地 worker

```
模拟 Pub/Sub Push
  ↓
POST http://localhost:8081/pubsub/backups
  ↓
Worker 解码 base64 message.data
  ↓
校验 backup.created event
  ↓
日志打印 Processed backup.created event
  ↓
返回 204
```

### 第3步：GCP Pub/Sub

```
用户点击“立即备份”
  ↓
Frontend
  ↓
POST /api/backups
  ↓
Backend Cloud Run: vibe-fit-backend-dev
  ↓
写入 Cloud SQL: backup_snapshots
  ↓
发布事件到 Pub/Sub Topic: vibe-fit-backup-created
  ↓
Pub/Sub Subscription: vibe-fit-backup-created-worker-sub
  ↓
Push 到 Worker Cloud Run: vibe-fit-worker-dev /pubsub/backups
  ↓
Worker 处理事件
  ↓
返回 204
  ↓
Pub/Sub ack 成功
```
