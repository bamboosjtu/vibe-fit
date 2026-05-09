# 前端部署手册

## 本地开发环境

### 步骤 1：构建 Docker 镜像

```powershell
cd frontend
docker build -t vibe-fit-frontend .
```

### 步骤 2：运行镜像

```powershell
docker run -p 8080:80 vibe-fit-frontend
```

这会启动一个本地服务器，并将其映射到本地的 8080 端口。你可以在浏览器中访问 http://localhost:8080 访问。

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

### 步骤 2：构建

```powershell
$env:SERVICE = "vibe-fit-frontend"
$env:IMAGE = "$env:REGION-docker.pkg.dev/$env:PROJECT_ID/$env:REPO/$env:SERVICE`:latest"

gcloud builds submit --tag="$env:IMAGE" .
```

### 步骤 3：部署到 Cloud Run

```powershell
gcloud run deploy $env:SERVICE `
  --image="$env:IMAGE" `
  --platform=managed `
  --region="$env:REGION" `
  --port=80 `
  --allow-unauthenticated
```
