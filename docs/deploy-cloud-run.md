# 部署手册

## 本地开发环境

### 前端

```powershell
cd frontend
# 步骤 1：构建 Docker 镜像
docker build --no-cache -t vibefit-frontend .

# 步骤 2：运行镜像
docker run -p 8080:80 vibefit-frontend
```

这会启动一个本地服务器，并将其映射到本地的 8080 端口。你可以在浏览器中访问 http://localhost:8080 访问。

### 后端

```powershell
cd frontend
docker build --no-cache -t vibefit-backend .

docker run -p 3000:3000 -e PORT=3000 -e JWT_SECRET="your-secret" vibefit-backend
```

这会启动一个本地服务器，并将其映射到本地的 3000 端口。你可以在浏览器中访问 http://localhost:3000 访问。

## 云端生产环境

### 步骤 0：配置环境

```powershell
$env:PROJECT_ID = "your-gcp-project-id"
$env:REGION = "asia-east1"
$env:REPO = "vibe-fit"

# 1. 登录 Google Cloud
gcloud auth login

# 2. 选择项目
gcloud config set project $env:PROJECT_ID

# 3. 启用 Cloud Run 和 Cloud Build API
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# 4. 构建仓库
gcloud artifacts repositories create $env:REPO `
  --repository-format=docker `
  --location=$env:REGION `
  --description="Vibe Fit container images"
```

### 步骤 2：部署前端

```powershell
# 构建并发布到 Artifacts
$env:SERVICE = "vibe-fit-frontend"
$env:IMAGE = "$env:REGION-docker.pkg.dev/$env:PROJECT_ID/$env:REPO/$env:SERVICE`:latest"

gcloud builds submit --tag="$env:IMAGE" .

# 部署到 Cloud Run
gcloud run deploy $env:SERVICE `
  --image="$env:IMAGE" `
  --platform=managed `
  --region="$env:REGION" `
  --port=80 `
  --allow-unauthenticated
```

### 步骤 3：部署后端

```powershell

```
