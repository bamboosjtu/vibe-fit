# 部署手册

## 一、本地 docker 联调环境

### 前端

```powershell
cd frontend
# 步骤 1：构建 Docker 镜像
docker build --no-cache -t vibefit-frontend .

# 步骤 2：运行镜像
docker run -p 80:80 vibefit-frontend
```

这会启动一个本地服务器，并将其映射到本地的 80 端口。你可以在浏览器中访问 http://localhost:80 访问。

### 后端

```powershell
cd frontend
docker build --no-cache -t vibefit-backend .

docker run --rm -p 8080:8080 `
  -e NODE_ENV=production `
  -e AUTH_MODE=mock `
  -e DATA_MODE=postgres `
  -e JWT_SECRET=dev-only-secret `
  -e LOG_PRETTY=false `
  -e CORS_ORIGIN=http://localhost,http://localhost:80,http://localhost:5173 `
  -e DATABASE_URL="postgresql://vibefit:vibefit_dev_password@host.docker.internal:5432/vibefit_dev" `
  vibefit-backend
```

这会启动一个本地服务器，并将其映射到本地的 8080 端口。你可以在浏览器中访问 http://localhost:8080 访问。

### SQL

```
npx prisma migrate status
npx prisma migrate dev --name init
```

## 二、Cloud Run 联调环境

### 步骤 0：配置环境

```powershell
$env:PROJECT_ID = "your-gcp-project-id"
$env:REGION = "asia-east1"
$env:REPO = "vibe-fit"

$env:INSTANCE_ID = "vibe-fit-postgres"
$env:DB_NAME = "vibefit"
$env:DB_USER = "vibefit_app"
$env:DB_PASSWORD = "your-strong-password"
$env:BACKEND_SERVICE_ACCOUNT = "vibe-fit-backend-sa"
$env:BACKEND_SERVICE_ACCOUNT_EMAIL = "${env:BACKEND_SERVICE_ACCOUNT}@${env:PROJECT_ID}.iam.gserviceaccount.com"
$env:INSTANCE_CONNECTION_NAME = "${env:PROJECT_ID}:${env:REGION}:${env:INSTANCE_ID}"

$env:FRONTEND_URL = "https://vibe-fit-frontend-1085526549756.asia-east1.run.app"
```

# 1. 登录 Google Cloud

```powershell
gcloud auth login
```

# 2. 选择项目

```powershell
gcloud config set project $env:PROJECT_ID
```

# 3. 启用 Cloud Run 和 Cloud Build API

```powershell
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

# 4. 构建仓库

```powershell
gcloud artifacts repositories create $env:REPO `
  --repository-format=docker `
  --location=$env:REGION `
  --description="Vibe Fit container images"
```

# 5. 列出仓库

```powershell
gcloud artifacts repositories list --location=asia-east1
```

### 步骤 2：部署前端

```powershell
# 构建并发布到 Artifacts
$env:FRONTEND_SERVICE = "vibe-fit-frontend"
$env:FRONTEND_IMAGE = "$env:REGION-docker.pkg.dev/$env:PROJECT_ID/$env:REPO/$env:FRONTEND_SERVICE`:latest"

gcloud builds submit --tag="$env:FRONTEND_IMAGE" .

# 部署到 Cloud Run
gcloud run deploy $env:FRONTEND_SERVICE `
  --image="$env:FRONTEND_IMAGE" `
  --region=$env:REGION `
  --allow-unauthenticated
```

### 步骤 3：部署后端

```powershell
# 构建并发布到 Artifacts
$env:BACKEND_SERVICE = "vibe-fit-backend-dev"
$env:BACKEND_IMAGE = "$env:REGION-docker.pkg.dev/$env:PROJECT_ID/$env:REPO/$env:BACKEND_SERVICE`:latest"
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
  --set-env-vars="NODE_ENV=production,AUTH_MODE=mock,DATA_MODE=postgres,JWT_SECRET=dev-only-cloud-run-secret,LOG_PRETTY=false,CORS_ORIGIN=$env:FRONTEND_URL" `
  --set-secrets="DATABASE_URL=vibe-fit-database-url:latest"

# 失败看日志
gcloud run services logs read $env:BACKEND_SERVICE `
  --region=$env:REGION `
  --project=$env:PROJECT_ID `
  --limit=100 
```
