# 一、Google 登录

Google Oauth 登录机制

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

## 步骤1：环境准备

```powershell
$env:GOOGLE_CLIENT_ID=你的 Google OAuth Client ID

cd backend
npm install google-auth-library

cd frontend
npm install @react-oauth/google
```

## 步骤2：创建Oauth Client

路径大致是：

```
Google Cloud Console
  → APIs & Services / Google Auth Platform
  → Credentials / Clients
  → Create OAuth client
```

创建时选择：`Application type: Web application`，然后配置 `Authorized JavaScript origins` 为前端地址。

特别需要注意的是 `GOOGLE_CLIENT_ID` 不是密码，也不是 Secret，因此可以出现在前端构建产物里，因为 Google 登录本来就要求浏览器知道这个 Client ID。真正不能泄露的是：

- 数据库密码
- JWT_SECRET
- OAuth Client Secret

但你当前这种 “Google 登录按钮 → 前端拿 ID Token → 后端 verifyIdToken” 的方案，不需要 OAuth Client Secret。

# 二、Secret Manager 管理密钥

```powershell
$env:JWT_SECRET_VALUE = "换成一个新的长随机字符串"

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
