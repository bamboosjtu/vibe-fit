# 可观测性与监控

## 监控内容

```
基础监控：
- backend 健康检查
- worker 健康检查
- 关键日志事件

告警：
- Backend 5xx
- Worker 5xx
- Pub/Sub 积压
- 事件发布失败
- Cloud SQL 存储或连接异常
```

## 监控链路

```
Frontend
  ↓
Backend /api/auth/google
  ↓
Backend /api/backups
  ↓
Cloud SQL
  ↓
Pub/Sub Topic: vibe-fit-backup-created
  ↓
Subscription: vibe-fit-backup-created-worker-sub
  ↓
Worker /pubsub/backups
  ↓
204 ack
```
