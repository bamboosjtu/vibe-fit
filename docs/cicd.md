# CI & CD

## 构建流水线

- cloudbuild.backend.yaml：构建并部署 backend + worker
- cloudbuild.frontend.yaml：构建并部署 frontend

```powershell
gcloud builds submit `
  --config=cloudbuild.backend.yaml `
  --project=gen-lang-client-0642180192

gcloud builds submit `
  --config=cloudbuild.frontend.yaml `
  --project=gen-lang-client-0642180192
```

## Cloud Build Trigger

```
push 到 GitHub 指定分支
  ↓
Cloud Build 自动拉代码
  ↓
读取 cloudbuild.backend.yaml / cloudbuild.frontend.yaml
  ↓
自动 typecheck、build、构建镜像、部署 Cloud Run
```

### 步骤1：配置权限

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

# 授权 Cloud Build 可以 “act as” 这些账号：
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

### 步骤2：创建 Backend + Worker Trigger

```
名称：vibe-fit-backend-worker-dev

事件：推送到分支

仓库：bamboosjtu/vibe-fit

分支：^gcp/m6-engineering$

配置类型：Cloud Build 配置文件

配置文件路径：cloudbuild.backend.yaml
```

### 步骤3：创建 Frontend Trigger

```
名称：
vibe-fit-frontend-dev

事件：
推送到分支

仓库：
bamboosjtu/vibe-fit

分支：
^gcp/m6-engineering$

配置类型：
Cloud Build 配置文件

配置文件路径：
cloudbuild.frontend.yaml
```

### 步骤4：配置 substitutions
