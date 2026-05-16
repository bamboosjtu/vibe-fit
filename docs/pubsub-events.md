# 事件驱动和异步消息

## 环境配置

### 第1步：依赖安装

```powershell
npm install @google-cloud/pubsub
```

### 第2步：

```powershell
# 创建TOPIC
gcloud pubsub topics create $env:TOPIC_BACKUP_CREATED --project=$env:PROJECT_ID

# 查看TOPIC
gcloud pubsub topics list --project=$env:PROJECT_ID
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
Cloud Run API
  ↓
publish message to Pub/Sub topic
  ↓
Pub/Sub push subscription
  ↓
Cloud Run Worker /pubsub/backups
  ↓
Worker 日志出现 Processed backup.created event
```
