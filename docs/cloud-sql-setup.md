# Google Cloud SQL (PostgreSQL) 配置指南

## 环境配置

```powershell
$env:INSTANCE_ID = "vibe-fit-postgres"
$env:DB_NAME = "vibefit"
$env:DB_USER = "vibefit_app"
$env:DB_PASSWORD = "<your-strong-password>"
$env:BACKEND_SERVICE_ACCOUNT = "vibe-fit-backend-sa"
$env:INSTANCE_CONNECTION_NAME = "${env:PROJECT_ID}:${env:REGION}:${env:INSTANCE_ID}"
```

## 步骤1： 创建数据库实例

```powershell
# 查看正在执行的操作
gcloud sql operations list `
  --instance=vibe-fit-postgres `
  --project="$env:PROJECT_ID"

# 查看某个操作详情
gcloud sql operations describe <OPERATION_ID> `
  --project="$env:PROJECT_ID"

gcloud sql instances create vibe-fit-postgres `  --database-version=POSTGRES_16 `
--region=asia-east1 `  --edition=ENTERPRISE `
--tier=db-f1-micro `  --availability-type=ZONAL `
--storage-size=10GB
```

## 步骤2：创建数据库

```powershell
gcloud sql databases create vibefit --instance=vibe-fit-postgres
```

## 步骤3：创建用户

```powershell
gcloud sql users create vibefit_app --instance=vibe-fit-postgres --password="换成强密码"
```

## 步骤4：获取连接名

```powershell
gcloud sql instances describe vibe-fit-postgres --format="value(connectionName)"
```

## 步骤5：迁移 Cloud SQL

先用 [Cloud SQL Auth Proxy](https://github.com/GoogleCloudPlatform/cloud-sql-proxy) 本地迁移，需要单独安装。

```powershell
# 启动 proxy，端口用 5433，避免和本地 Docker PostgreSQL 冲突：
cloud-sql-proxy $env:INSTANCE_CONNECTION_NAME --port 5433

# 另开一个终端：
cd backend
$env:DATABASE_URL="postgresql://vibefit_app:你的强密码@127.0.0.1:5433/vibefit"
npx prisma migrate deploy
```

#### 步骤6：把 DATABASE_URL 放入 Secret Manager

```powershell
# Cloud Run 连接 Cloud SQL 时用 Unix socket URL：
$env:DATABASE_URL_VALUE = "postgresql://${env:DB_USER}:${env:DB_PASSWORD}@127.0.0.1/${env:DB_NAME}?host=/cloudsql/${env:INSTANCE_CONNECTION_NAME}"
$env:DATABASE_URL_VALUE | gcloud secrets create vibe-fit-database-url --data-file=-

# 如果 secret 已存在：
$env:DATABASE_URL_VALUE | gcloud secrets versions add vibe-fit-database-url --data-file=-

# 查看secret
gcloud secrets versions access latest --secret=vibe-fit-database-url --project=$env:PROJECT_ID
```

#### 步骤7：创建后端服务账号

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
