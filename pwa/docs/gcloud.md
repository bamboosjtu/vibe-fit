# GCP 云端部署与运维

> **说明**：当前 VibeFit 的主部署方式为[本地 Docker 部署](./deployment.md)，本文件整理的 GCP（Cloud Run / Cloud SQL / Pub/Sub / Secret Manager）部署与运维内容为**历史参考**，不再作为默认部署路径。
>
> **重要**：本地构建已移除所有 GCP 依赖：
> - 登录由 Google OAuth 改为**邮箱验证码登录**（163 SMTP）。
> - 事件由 Pub/Sub 改为**本地 HTTP push 到 worker**（`LocalHttpEventPublisher`）。
> - `pwa/backend` 已移除 `google-auth-library`、`@google-cloud/pubsub` 依赖，删除 `pubsubPublisher.ts`。
>
> 本文件保留原 GCP 部署与运维的完整步骤，仅供未来如需重新上云时参考。如要恢复 GCP 方案，需重新引入上述依赖与对应实现。

本文件由以下历史文档合并整理：`cicd.md`、`cloud-sql-setup.md`、`deploy-cloud-run.md`、`iam-and-secrets.md`、`pubsub-events.md`、`observability.md`、`runbook.md`。

## 1. 部署架构

![部署架构图](./部署架构图.png)

| 模块     | 本地开发环境                                            | GCP 生产环境                                    | 建议                                                  |
| -------- | ------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| 前端     | Vite dev server 或已部署的 dev Cloud Run 前端           | Cloud Run 前端服务                              | 已经完成前端部署，可继续保留本地 dev + 线上 prod 两套 |
| 后端 API | 本地 Node.js + TypeScript + Fastify                     | Cloud Run API                                   | `m2-backend-api` 先做本地 API，不急着上 Cloud SQL     |
| 数据库   | Docker PostgreSQL                                       | Cloud SQL PostgreSQL                            | 本地和生产都用 PostgreSQL，降低迁移成本               |
| 登录     | 开发模式 mock user / dev JWT / Google OAuth 测试 client | Google 登录 / Identity Platform / Firebase Auth | 开发环境不要依赖生产登录                              |
| 密钥     | `.env.local`                                            | Secret Manager                                  | 本地可以用 `.env`，生产必须用 Secret Manager          |
| 消息队列 | 先用函数调用或 EventEmitter，进阶用本地 worker          | Pub/Sub                                         | 不要一开始被 emulator 卡住，先跑通业务事件            |
| Worker   | 本地单独启动 `worker` 服务，或先内联处理                | Cloud Run Worker                                | `m5` 再拆成独立 worker                                |
| 日志     | Console log / pino logger                               | Cloud Logging                                   | 从第一天就用结构化日志                                |
| 监控     | 本地不做完整监控                                        | Cloud Monitoring                                | 生产阶段补 error rate、latency、Pub/Sub backlog       |
| CI/CD    | 本地命令 + GitHub Actions                               | Cloud Build / GitHub Actions + Cloud Run        | 先别急，等 API + DB 稳定后再自动化                    |

### GCP 生产环境链路

```
用户浏览器
  ↓
Vibe-Fit Frontend on Cloud Run
  ↓ HTTPS
Cloud Run API
  ↓
Cloud SQL PostgreSQL
  ↓
Pub/Sub
  ↓
Cloud Run Worker
  ↓
Cloud Logging / Monitoring
```

核心服务：

- Frontend Cloud Run：`vibe-fit-frontend`
- Backend Cloud Run：`vibe-fit-backend-dev`
- Worker Cloud Run：`vibe-fit-worker-dev`
- Cloud SQL PostgreSQL：`vibe-fit-postgres`
- Pub/Sub Topic：`vibe-fit-backup-created`
- Pub/Sub Subscription：`vibe-fit-backup-created-worker-sub`

## 2. 环境与项目配置

```powershell
gcloud auth login
gcloud config set project $env:PROJECT_ID

# 启用所需 API
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable pubsub.googleapis.com
```

通用环境变量（部署前先设置）：

```powershell
$env:PROJECT_ID = "<your-gcp-project-id>"
$env:REGION = "asia-east1"
$env:REPO = "vibe-fit"

$env:FRONTEND_SERVICE = "vibe-fit-frontend"
$env:BACKEND_SERVICE = "vibe-fit-backend-dev"
$env:WORKER_SERVICE = "vibe-fit-worker-dev"

$env:FRONTEND_SERVICE_ACCOUNT = "vibe-fit-frontend-sa"
$env:BACKEND_SERVICE_ACCOUNT = "vibe-fit-backend-sa"
$env:WORKER_SERVICE_ACCOUNT = "vibe-fit-worker-sa"
$env:PUBSUB_PUSH_SERVICE_ACCOUNT = "vibe-fit-pubsub-push-sa"

$env:FRONTEND_SERVICE_ACCOUNT_EMAIL = "${env:FRONTEND_SERVICE_ACCOUNT}@${env:PROJECT_ID}.iam.gserviceaccount.com"
$env:BACKEND_SERVICE_ACCOUNT_EMAIL = "${env:BACKEND_SERVICE_ACCOUNT}@${env:PROJECT_ID}.iam.gserviceaccount.com"
$env:WORKER_SERVICE_ACCOUNT_EMAIL = "${env:WORKER_SERVICE_ACCOUNT}@${env:PROJECT_ID}.iam.gserviceaccount.com"
$env:PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL = "${env:PUBSUB_PUSH_SERVICE_ACCOUNT}@${env:PROJECT_ID}.iam.gserviceaccount.com"

$env:TOPIC_BACKUP_CREATED = "vibe-fit-backup-created"
$env:SUBSCRIPTION_BACKUP_WORKER = "vibe-fit-backup-created-worker-sub"

$env:INSTANCE_ID = "vibe-fit-postgres"
$env:DB_NAME = "vibefit"
$env:DB_USER = "vibefit_app"
$env:DB_PASSWORD = "<your-strong-password>"
$env:INSTANCE_CONNECTION_NAME = "${env:PROJECT_ID}:${env:REGION}:${env:INSTANCE_ID}"

$env:FRONTEND_URL = "https://vibe-fit-frontend-1085526549756.asia-east1.run.app"
$env:GOOGLE_CLIENT_ID = "<your-google-client-id>"
$env:JWT_SECRET_VALUE = "换成一个新的长随机字符串"
```

## 3. Cloud SQL (PostgreSQL) 配置

```powershell
$env:INSTANCE_CONNECTION_NAME = "${env:PROJECT_ID}:${env:REGION}:${env:INSTANCE_ID}"
```

### 步骤1：创建数据库实例

```powershell
# 查看正在执行的操作
gcloud sql operations list `
  --instance=vibe-fit-postgres `
  --project="$env:PROJECT_ID"

# 查看某个操作详情
gcloud sql operations describe <OPERATION_ID> `
  --project="$env:PROJECT_ID"

gcloud sql instances create vibe-fit-postgres `
  --database-version=POSTGRES_16 `
  --region=asia-east1 `
  --edition=ENTERPRISE `
  --tier=db-f1-micro `
  --availability-type=ZONAL `
  --storage-size=10GB
```

### 步骤2：创建数据库

```powershell
gcloud sql databases create vibefit --instance=vibe-fit-postgres
```

### 步骤3：创建用户

```powershell
gcloud sql users create vibefit_app --instance=vibe-fit-postgres --password="换成强密码"
```

### 步骤4：获取连接名

```powershell
gcloud sql instances describe vibe-fit-postgres --format="value(connectionName)"
```

### 步骤5：迁移 Cloud SQL

先用 [Cloud SQL Auth Proxy](https://github.com/GoogleCloudPlatform/cloud-sql-proxy) 本地迁移，需要单独安装。

```powershell
# 启动 proxy，端口用 5433，避免和本地 Docker PostgreSQL 冲突：
cloud-sql-proxy $env:INSTANCE_CONNECTION_NAME --port 5433

# 另开一个终端：
cd backend
$env:DATABASE_URL="postgresql://vibefit_app:你的强密码@127.0.0.1:5433/vibefit"
npx prisma migrate deploy
```

### 步骤6：创建后端服务账号

```powershell
gcloud iam service-accounts create $env:BACKEND_SERVICE_ACCOUNT `
  --display-name="Vibe Fit Backend" `
  --project=$env:PROJECT_ID

$env:BACKEND_SERVICE_ACCOUNT_EMAIL = "${env:BACKEND_SERVICE_ACCOUNT}@${env:PROJECT_ID}.iam.gserviceaccount.com"
# 授权 Cloud SQL Client：
gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:${env:BACKEND_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/cloudsql.client"

# 授权读取 Secret：
gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:${env:BACKEND_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/secretmanager.secretAccessor"
```

## 4. Secret Manager 与密钥管理

### 4.1 JWT Secret

```powershell
$tempJwtSecretFile = "$env:TEMP\vibe-fit-jwt-secret.txt"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
  $tempJwtSecretFile,
  $env:JWT_SECRET_VALUE,
  $utf8NoBom
)

# 创建 Secret
gcloud secrets create vibe-fit-jwt-secret `
  --data-file=$tempJwtSecretFile `
  --project=$env:PROJECT_ID

# 更新 Secret
gcloud secrets versions add vibe-fit-jwt-secret `
  --data-file=$tempJwtSecretFile `
  --project=$env:PROJECT_ID

Remove-Item $tempJwtSecretFile

# 查看 Secret
gcloud secrets versions access latest --secret=vibe-fit-jwt-secret --project=$env:PROJECT_ID
```

### 4.2 DATABASE_URL（Cloud Run 连接 Cloud SQL 用 Unix socket URL）

```powershell
$env:DATABASE_URL_VALUE = "postgresql://${env:DB_USER}:${env:DB_PASSWORD}@127.0.0.1/${env:DB_NAME}?host=/cloudsql/${env:INSTANCE_CONNECTION_NAME}"
$env:DATABASE_URL_VALUE | gcloud secrets create vibe-fit-database-url --data-file=-

# 如果 secret 已存在：
$tempSecretFile = "$env:TEMP\vibe-fit-database-url.txt"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempSecretFile, $env:DATABASE_URL_VALUE, $utf8NoBom)
gcloud secrets versions add vibe-fit-database-url --data-file=$tempSecretFile --project=$env:PROJECT_ID

# 查看 secret
gcloud secrets versions access latest --secret=vibe-fit-database-url --project=$env:PROJECT_ID
```

## 5. OAuth2 与 Google 登录

OAuth 2.0 是一个"授权框架"，不是登录协议。它的核心目的，是让第三方应用在不拿到用户账号密码的情况下，获得对某些资源的有限访问权限。

| 角色       | 英文                 | 作用                               | 例子                                           |
| ---------- | -------------------- | ---------------------------------- | ---------------------------------------------- |
| 资源所有者 | Resource Owner       | 拥有数据的人，通常是用户           | 你                                             |
| 客户端     | Client               | 想访问资源的应用                   | 第三方 App、你的前端、后端服务                 |
| 授权服务器 | Authorization Server | 负责认证用户、征求同意、签发 Token | Google 登录服务、GitHub OAuth 服务             |
| 资源服务器 | Resource Server      | 保存资源并验证 Token               | Google Drive API、GitHub API、你自己的业务 API |

### 5.1 核心概念

- **Access Token**：访问资源服务器的凭证，放在 `Authorization: Bearer ACCESS_TOKEN`。有效期较短，由 scope 限定权限，可以是 JWT 或不透明字符串。必须防止泄露，尤其要通过 TLS 传输并安全存储（RFC 6750）。
- **Refresh Token**：用来换新的 Access Token，寿命较长，风险更高，应只保存在安全位置；浏览器/移动端这类"公开客户端"要特别谨慎。
- **Authorization Code**：授权码。用户登录授权后，授权服务器先返回一次性短期授权码，客户端后端再用它换 Access Token，避免 Token 暴露在浏览器地址栏或历史记录。
- **Scope**：权限范围（如 `read:user`、`email`、`profile`），遵循最小权限原则。
- **Redirect URI**：授权完成后跳回客户端的地址，授权服务器必须严格校验，防止回调地址劫持。
- **State**：随机值，防 CSRF 并维护请求上下文。
- **PKCE**（Proof Key for Code Exchange，RFC 7636）：为移动 App、SPA 等无法安全保存 client secret 的公开客户端设计。客户端先生成 `code_verifier`，再计算 `code_challenge`，发起授权时提交 `code_challenge`，换 Token 时提交 `code_verifier`，服务器验证二者匹配。攻击者即使截获 authorization code，也没有 code_verifier，无法换取 Access Token。

### 5.2 登录流程

主流模式对比：

| 模式 | 适用 | 备注 |
| --- | --- | --- |
| Authorization Code Grant（+ PKCE） | Web / 移动 / 桌面 / SPA | 最主流、最推荐；Token 不暴露在 URL；可结合 PKCE |
| Client Credentials Grant | 机器对机器（服务 A 调服务 B） | 用 client_id + client_secret，不适合前端浏览器 |
| Refresh Token Grant | 长期会话续期 | 注意 Refresh Token 的存储、轮换和撤销 |
| Implicit Grant | （旧）浏览器 SPA | 现已不推荐，RFC 9700 废弃 |
| Resource Owner Password Credentials | — | 不推荐，违背 OAuth 不接触密码的设计初衷 |

> 现代 SPA 推荐使用 `Authorization Code + PKCE`。

### 5.3 Google 登录链路

```
用户点击 Google 登录
  ↓
前端使用 VITE_GOOGLE_CLIENT_ID 调起 Google 登录
  ↓
Google 返回一个 ID Token
  ↓
前端把 ID Token 发给你的后端 /api/auth/google
  ↓
后端用 GOOGLE_CLIENT_ID 验证这个 ID Token
  ↓
验证通过后，从 token 里拿到 Google 用户的 sub / email / name / picture
  ↓
在你自己的 users 表里创建或更新用户
  ↓
你的后端签发自己的 app JWT
  ↓
前端继续用这个 app JWT 调 /api/backups
```

#### 步骤1：依赖安装

```powershell
$env:GOOGLE_CLIENT_ID=你的 Google OAuth Client ID

cd backend
npm install google-auth-library

cd frontend
npm install @react-oauth/google
```

#### 步骤2：创建 OAuth Client

路径：`Google Cloud Console → APIs & Services / Google Auth Platform → Credentials / Clients → Create OAuth client`

创建时选择 `Application type: Web application`，然后配置 `Authorized JavaScript origins` 为前端地址。

> 注意：`GOOGLE_CLIENT_ID` 不是密码也不是 Secret，可以出现在前端构建产物里，因为 Google 登录本来就要求浏览器知道这个 Client ID。真正不能泄露的是：数据库密码、`JWT_SECRET`、OAuth Client Secret。当前 "Google 登录按钮 → 前端拿 ID Token → 后端 verifyIdToken" 的方案不需要 OAuth Client Secret。

## 6. IAM 权限

生产环境应将 frontend/backend/worker 的运行身份完全拆开，确保最小权限。

### 6.1 frontend service

前端不需要额外的权限。

```powershell
# 创建前端账号
gcloud iam service-accounts create $env:FRONTEND_SERVICE_ACCOUNT `
  --display-name="Vibe Fit Frontend" `
  --project=$env:PROJECT_ID

# 重新部署服务
gcloud run services update $env:FRONTEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --service-account=$env:FRONTEND_SERVICE_ACCOUNT_EMAIL
```

### 6.2 backend service

需要：Cloud SQL Client、Secret Manager Secret Accessor、Pub/Sub Publisher。

```powershell
# 增加权限政策
gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:${env:BACKEND_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/pubsub.publisher"

# 查看账号权限
gcloud projects get-iam-policy $env:PROJECT_ID `
  --flatten="bindings[].members" `
  --filter="bindings.members:serviceAccount:${env:BACKEND_SERVICE_ACCOUNT_EMAIL}" `
  --format="table(bindings.role)"
```

### 6.3 worker service

与后端用同一镜像，但启动命令不同。需要：Cloud SQL Client、Secret Manager Secret Accessor、允许 Pub/Sub push 调用 private Worker、TokenCreator。

```powershell
gcloud run services add-iam-policy-binding $env:WORKER_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --member="serviceAccount:${env:PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/run.invoker"
```

## 7. Cloud Run 部署

### 7.1 创建 Artifact Registry 仓库

```powershell
# 创建仓库
gcloud artifacts repositories create $env:REPO `
  --repository-format=docker `
  --location=$env:REGION `
  --description="Vibe Fit container images"

# 查看仓库
gcloud artifacts repositories list --location=asia-east1
```

### 7.2 部署前端

```powershell
# 构建并发布到 Artifacts
$env:TAG = Get-Date -Format "yyyyMMddHHmmss"
$env:FRONTEND_IMAGE = "${env:REGION}-docker.pkg.dev/${env:PROJECT_ID}/${env:REPO}/${env:FRONTEND_SERVICE}:${env:TAG}"

gcloud builds submit --tag="$env:FRONTEND_IMAGE" .

# 部署到 Cloud Run
gcloud run deploy $env:FRONTEND_SERVICE `
  --image="$env:FRONTEND_IMAGE" `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --allow-unauthenticated
```

### 7.3 部署后端

```powershell
# 构建并发布到 Artifacts
$env:TAG = Get-Date -Format "yyyyMMddHHmmss"
$env:BACKEND_IMAGE = "${env:REGION}-docker.pkg.dev/${env:PROJECT_ID}/${env:REPO}/${env:BACKEND_SERVICE}:${env:TAG}"
gcloud builds submit --tag="$env:BACKEND_IMAGE" .

# 部署到 Cloud Run
gcloud run deploy $env:BACKEND_SERVICE `
  --image="$env:BACKEND_IMAGE" `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --allow-unauthenticated `
  --port=8080 `
  --service-account=$env:BACKEND_SERVICE_ACCOUNT_EMAIL `
  --add-cloudsql-instances=$env:INSTANCE_CONNECTION_NAME `
  --set-env-vars="NODE_ENV=production,AUTH_MODE=google,DATA_MODE=postgres,LOG_PRETTY=false,CORS_ORIGIN=$env:FRONTEND_URL,GOOGLE_CLIENT_ID=$env:GOOGLE_CLIENT_ID,EVENT_PUBLISHER=pubsub,PUBSUB_TOPIC_BACKUP_CREATED=$env:TOPIC_BACKUP_CREATED" `
  --set-secrets="DATABASE_URL=vibe-fit-database-url:latest,JWT_SECRET=vibe-fit-jwt-secret:latest"

# 失败看日志
gcloud run services logs read $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --limit=100
```

### 7.4 部署 worker

Worker 和 API 用同一个镜像，但启动命令不同。

```powershell
gcloud run deploy $env:WORKER_SERVICE `
  --image="$env:BACKEND_IMAGE" `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --no-allow-unauthenticated `
  --port=8080 `
  --service-account=$env:WORKER_SERVICE_ACCOUNT_EMAIL `
  --command="node" `
  --args="dist/worker.js" `
  --set-env-vars="NODE_ENV=production,AUTH_MODE=mock,DATA_MODE=mock,LOG_PRETTY=false,EVENT_PUBLISHER=mock" `
  --set-secrets="JWT_SECRET=vibe-fit-jwt-secret:latest"
```

## 8. Pub/Sub 事件驱动

### 8.1 依赖安装

```powershell
npm install @google-cloud/pubsub
```

### 8.2 创建 Topic

```powershell
# 创建 TOPIC
gcloud pubsub topics create $env:TOPIC_BACKUP_CREATED --project=$env:PROJECT_ID

# 查看 TOPIC
gcloud pubsub topics list --project=$env:PROJECT_ID
```

### 8.3 配置 service account

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

### 8.4 构建和部署 api 和 worker

1. 构建包含 worker 的后端镜像
2. 部署 backend API，开启真实 Pub/Sub
3. 部署 worker Cloud Run service

### 8.5 创建 Push Subscription

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

### 8.6 目标链路

**第1步：mock event**

```
/api/backups
  ↓
写入 PostgreSQL 成功
  ↓
Mock publisher 执行成功
  ↓
返回 eventPublished: true
```

**第2步：本地 worker**

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

**第3步：GCP Pub/Sub**

```
用户点击"立即备份"
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

## 9. CI/CD

### 9.1 构建流水线

- `cloudbuild.backend.yaml`：构建并部署 backend + worker
- `cloudbuild.frontend.yaml`：构建并部署 frontend

```powershell
gcloud builds submit `
  --config=cloudbuild.backend.yaml `
  --project=gen-lang-client-0642180192

gcloud builds submit `
  --config=cloudbuild.frontend.yaml `
  --project=gen-lang-client-0642180192
```

### 9.2 Cloud Build Trigger

```
push 到 GitHub 指定分支
  ↓
Cloud Build 自动拉代码
  ↓
读取 cloudbuild.backend.yaml / cloudbuild.frontend.yaml
  ↓
自动 typecheck、build、构建镜像、部署 Cloud Run
```

#### 步骤1：配置权限

```powershell
$env:CLOUDBUILD_SERVICE_ACCOUNT = "vibe-fit-cloudbuild-sa"
$env:CLOUDBUILD_SERVICE_ACCOUNT_EMAIL = "${env:CLOUDBUILD_SERVICE_ACCOUNT}@${env:PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:${env:CLOUDBUILD_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/cloudbuild.builds.builder" `
  --condition=None

# Artifact Registry 写权限
gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:${env:CLOUDBUILD_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/artifactregistry.writer" `
  --condition=None

# Cloud Run 管理权限
gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:${env:CLOUDBUILD_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/run.admin" `
  --condition=None

# 允许 Cloud Build 使用各个运行时服务账号
$env:FRONTEND_SERVICE_ACCOUNT_EMAIL = "vibe-fit-frontend-sa@${env:PROJECT_ID}.iam.gserviceaccount.com"
$env:BACKEND_SERVICE_ACCOUNT_EMAIL = "vibe-fit-backend-sa@${env:PROJECT_ID}.iam.gserviceaccount.com"
$env:WORKER_SERVICE_ACCOUNT_EMAIL = "vibe-fit-worker-sa@${env:PROJECT_ID}.iam.gserviceaccount.com"

# 授权 Cloud Build 可以 "act as" 这些账号：
gcloud iam service-accounts add-iam-policy-binding $env:FRONTEND_SERVICE_ACCOUNT_EMAIL `
  --project=$env:PROJECT_ID `
  --member="serviceAccount:${env:CLOUDBUILD_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/iam.serviceAccountUser" `
  --condition=None

gcloud iam service-accounts add-iam-policy-binding $env:BACKEND_SERVICE_ACCOUNT_EMAIL `
  --project=$env:PROJECT_ID `
  --member="serviceAccount:${env:CLOUDBUILD_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/iam.serviceAccountUser" `
  --condition=None

gcloud iam service-accounts add-iam-policy-binding $env:WORKER_SERVICE_ACCOUNT_EMAIL `
  --project=$env:PROJECT_ID `
  --member="serviceAccount:${env:CLOUDBUILD_SERVICE_ACCOUNT_EMAIL}" `
  --role="roles/iam.serviceAccountUser" `
  --condition=None
```

#### 步骤2：创建 Backend + Worker Trigger

```
名称：vibe-fit-backend-worker-dev
事件：推送到分支
仓库：bamboosjtu/vibe-fit
分支：^gcp/m6-engineering$
配置类型：Cloud Build 配置文件
配置文件路径：cloudbuild.backend.yaml
```

#### 步骤3：创建 Frontend Trigger

```
名称：vibe-fit-frontend-dev
事件：推送到分支
仓库：bamboosjtu/vibe-fit
分支：^gcp/m6-engineering$
配置类型：Cloud Build 配置文件
配置文件路径：cloudbuild.frontend.yaml
```

## 10. 可观测性与监控

### 监控内容

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

### 监控链路

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

## 11. Runbook 故障排查

建议先设置以下 PowerShell 环境变量：

```powershell
$env:PROJECT_ID = "gen-lang-client-0642180192"
$env:REGION = "asia-east1"
$env:BACKEND_SERVICE = "vibe-fit-backend-dev"
$env:WORKER_SERVICE = "vibe-fit-worker-dev"
$env:BACKEND_URL = "https://vibe-fit-backend-dev-1085526549756.asia-east1.run.app"
```

### 11.1 快速健康检查

#### Backend

```powershell
Invoke-WebRequest "$env:BACKEND_URL/health" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/healthz" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/readyz" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/api/version" -UseBasicParsing
```

期望：`/health`、`/healthz`、`/readyz` 返回 200；`/api/version` 中 `authMode=google`，`dataMode=postgres`。

#### Worker

Worker 是私有 Cloud Run service，不做公开 Uptime Check。检查最近是否成功处理过事件：

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-worker-dev`" AND jsonPayload.msg=`"Processed backup.created event`""

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=20 `
  --format="table(timestamp,jsonPayload.msg,jsonPayload.eventId,jsonPayload.backupId,jsonPayload.userId,jsonPayload.deviceId)"
```

#### Pub/Sub Subscription

```powershell
gcloud pubsub subscriptions describe vibe-fit-backup-created-worker-sub `
  --project=$env:PROJECT_ID
```

期望：

```text
state: ACTIVE
topic: projects/.../topics/vibe-fit-backup-created
pushEndpoint: https://.../pubsub/backups
oidcToken.serviceAccountEmail: vibe-fit-pubsub-push-sa@...
```

### 11.2 告警：Backend readiness failure

**含义**：Backend 的 Uptime Check 失败，通常表示 `/readyz` 没有返回 200。

**影响**：Backend 可能不可访问，或虽进程存活但无法访问关键依赖（如 Cloud SQL）。

**第一检查项**：

```powershell
Invoke-WebRequest "$env:BACKEND_URL/health" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/readyz" -UseBasicParsing
Invoke-WebRequest "$env:BACKEND_URL/api/version" -UseBasicParsing
```

**如何判断**：

| 结果 | 含义 |
|---|---|
| `/health` 200，`/readyz` 404 | `/readyz` 路由还没有部署 |
| `/health` 200，`/readyz` 503 | Backend 进程存活，但依赖检查失败 |
| `/api/version` 200，`/readyz` 失败 | 运行时正常，但 readiness 依赖失败 |
| 全部失败 | Backend 服务或 Cloud Run 路由异常 |

**查看日志**：

```powershell
gcloud run services logs read $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --limit=100
```

**常见原因**：`/readyz` 路由未部署；Cloud SQL 连接失败；`DATABASE_URL` Secret 错误；Backend service account 缺少 Cloud SQL Client 权限；Prisma Client 或 migration 异常。

**恢复动作**：

1. 如果 `/readyz` 不存在，部署包含 `/readyz` 的 backend 版本。
2. 如果 `/readyz` 返回 503，检查 Cloud SQL、`DATABASE_URL` 和 backend service account 权限。
3. 如果是新版本导致异常，回滚 backend revision。

### 11.3 告警：Backend 5xx

**含义**：Backend 返回 5xx 错误。

**影响**：用户可能无法登录、注册、同步备份、恢复备份或获取最新备份。

**查询结构化 5xx 日志**：

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-backend-dev`" AND httpRequest.status>=500"

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=50 `
  --format="table(timestamp,httpRequest.status,httpRequest.requestUrl,jsonPayload.msg,textPayload)"
```

**常见原因**：Google Auth 配置错误；JWT Secret 不一致；Cloud SQL 连接失败；Prisma migration 与数据库状态不一致；新版本部署后引入 bug；Cloud Run 环境变量缺失；Secret Manager 配置错误。

**恢复动作**：

1. 检查 `/api/version`，确认 `authMode`、`dataMode` 是否正确。
2. 检查 `/readyz`，判断数据库依赖是否正常。
3. 查看 backend 日志。
4. 如果是新版本导致，回滚 backend。
5. 如果是配置问题，修正环境变量或 Secret 后重新部署。

### 11.4 告警：Worker 5xx

**含义**：Pub/Sub 推送消息到 Worker 后，Worker 返回 5xx。

**影响**：Pub/Sub 会重试消息。持续失败可能导致消息积压，也可能造成重复投递。

**查询 5xx 日志**：

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-worker-dev`" AND httpRequest.status>=500"

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=50 `
  --format="table(timestamp,httpRequest.status,httpRequest.requestUrl,jsonPayload.msg,textPayload)"
```

**检查 Worker 部署入口**：

```powershell
gcloud run services describe $env:WORKER_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --format="yaml(spec.template.spec.containers[0].image,spec.template.spec.containers[0].command,spec.template.spec.containers[0].args)"
```

期望：

```yaml
command:
- node
args:
- dist/worker.js
```

**常见原因**：Worker 部署入口错误（不是 `dist/worker.js`）；Pub/Sub message body 格式不正确；事件 schema 校验失败；Worker 代码 bug；Worker 缺少必要环境变量或 Secret。

**恢复动作**：

1. 确认 Worker 启动入口是 `dist/worker.js`。
2. 检查 Worker 日志。
3. 如果是新版本导致，回滚 Worker。
4. 如果是事件格式问题，检查 publisher 代码和 `eventVersion`。

### 11.5 告警：Pub/Sub backlog

**含义**：消息进入 Pub/Sub 后，没有被 Worker 成功 ack。主要指标：`Cloud Pub/Sub Subscription → Oldest unacked message age`。

**影响**：异步 `backup.created` 事件处理延迟。如果 backlog 持续增长，说明 Worker 消费链路异常。

**第一检查项**：

```powershell
gcloud pubsub subscriptions describe vibe-fit-backup-created-worker-sub `
  --project=$env:PROJECT_ID
```

**查看 Worker 日志**：

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-worker-dev`""

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=50 `
  --format="table(timestamp,httpRequest.status,httpRequest.requestUrl,jsonPayload.msg,textPayload)"
```

**期望 Subscription 配置**：

```text
state: ACTIVE
pushEndpoint: https://.../pubsub/backups
oidcToken.serviceAccountEmail: vibe-fit-pubsub-push-sa@...
topic: projects/.../topics/vibe-fit-backup-created
```

**常见原因**：Worker 返回 5xx；Worker endpoint 配错；Pub/Sub push service account 缺少 Cloud Run Invoker 权限；Worker service 未部署或 revision 不健康；Worker 处理速度过慢。

**恢复动作**：

1. 先修复 Worker 5xx。
2. 确认 subscription endpoint 是 `/pubsub/backups`。
3. 确认 `vibe-fit-pubsub-push-sa` 有 Worker 的 `roles/run.invoker`。
4. 等待 Pub/Sub 自动重试。
5. 修复后手动发布测试消息验证。

**Worker smoke test**：

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

期望看到：`Processed backup.created event`。

### 11.6 告警：Event publish failed

**含义**：Backend 已写入备份数据，但发布 `backup.created` 到 Pub/Sub 失败。

**影响**：用户侧备份可能成功，但异步处理不会运行。当前系统还没有 outbox pattern，因此这个告警比较重要。

**查询失败日志**：

```powershell
$filter = "resource.type=`"cloud_run_revision`" AND resource.labels.service_name=`"vibe-fit-backend-dev`" AND jsonPayload.msg=`"Failed to publish backup.created`""

gcloud logging read "$filter" `
  --project=$env:PROJECT_ID `
  --limit=20 `
  --format="table(timestamp,jsonPayload.msg,jsonPayload.backupId,jsonPayload.userId,jsonPayload.err.message)"
```

**检查 Backend 环境变量**：

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

**检查 Topic**：

```powershell
gcloud pubsub topics describe vibe-fit-backup-created `
  --project=$env:PROJECT_ID
```

**检查 IAM**：

```powershell
gcloud projects get-iam-policy $env:PROJECT_ID `
  --flatten="bindings[].members" `
  --filter="bindings.members:vibe-fit-backend-sa" `
  --format="table(bindings.role)"
```

期望有 `roles/pubsub.publisher`。

**常见原因**：`EVENT_PUBLISHER` 不是 `pubsub`；`PUBSUB_TOPIC_BACKUP_CREATED` 配错；Topic 不存在；Backend service account 缺少 Pub/Sub Publisher 权限；Pub/Sub API 异常。

**恢复动作**：

1. 修正 Backend 环境变量。
2. 创建或修复 Topic。
3. 给 `vibe-fit-backend-sa` 授予 `roles/pubsub.publisher`。
4. 重新部署 Backend。
5. 重新测试 `/api/backups`。

### 11.7 告警：Cloud SQL CPU high

**含义**：Cloud SQL CPU 使用率持续过高。

**影响**：Backend 延迟可能升高。如果数据库过载，`/readyz` 和业务接口可能失败。

**第一检查项**：Cloud SQL CPU utilization dashboard、Backend latency p95、Backend 5xx、Cloud SQL connections。

**查看 Backend 日志**：

```powershell
gcloud run services logs read $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --limit=100
```

**常见原因**：请求量突然增加；查询过重；数据库连接过多；新版本出现循环或异常请求；backup payload 过大。

**恢复动作**：

1. 检查最近部署。
2. 如果 CPU 上升发生在新版本之后，优先回滚。
3. 必要时降低请求量。
4. 后续优化查询、payload 结构或连接管理。

### 11.8 告警：Cloud SQL disk high

**含义**：Cloud SQL 磁盘使用率超过阈值。

**影响**：如果磁盘耗尽，数据库写入可能失败。

**第一检查项**：Cloud SQL disk utilization dashboard、`backup_snapshots` 数据量、最近备份流量。

**常见原因**：`backup_snapshots` 数据持续增长；payload 太大；没有数据保留策略；WAL 或日志增长。

**恢复动作**：

1. 确认 Cloud SQL 是否开启自动扩容。
2. 为旧 `backup_snapshots` 添加保留策略。
3. 后续考虑压缩 payload。
4. 后续增加清理任务或归档任务。

### 11.9 回滚

**查看 Backend revisions**：

```powershell
gcloud run revisions list `
  --service=$env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID
```

**回滚 Backend**：

```powershell
gcloud run services update-traffic $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --to-revisions=REVISION_NAME=100
```

将 `REVISION_NAME` 替换成目标 revision 名称。

**查看 Worker revisions**：

```powershell
gcloud run revisions list `
  --service=$env:WORKER_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID
```

**回滚 Worker**：

```powershell
gcloud run services update-traffic $env:WORKER_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --to-revisions=REVISION_NAME=100
```

将 `REVISION_NAME` 替换成目标 revision 名称。

### 11.10 事故处理流程

收到告警后，按以下流程处理：

1. 打开告警详情。
2. 确认告警策略名称。
3. 在本文档中找到对应章节。
4. 执行第一检查项命令。
5. 判断故障域：Cloud Run Backend / Cloud Run Worker / Pub/Sub / Cloud SQL / IAM·Secret·环境变量 / 最近部署。
6. 执行恢复动作：修配置 / 重新部署 / 回滚 / 等待 Pub/Sub 自动重试。
7. 确认恢复：告警 incident 关闭、Dashboard 指标恢复正常、smoke test 通过。
8. 将本次事故的症状、原因、修复方式补充到本文档。
