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

# 三、OAuth2

OAuth 2.0 是一个“授权框架”，不是登录协议。 它的核心目的，是让第三方应用在不拿到用户账号密码的情况下，获得对某些资源的有限访问权限。例如：你用一个图片处理网站读取 Google Drive 里的照片，图片网站不应该知道你的 Google 密码，只应该拿到“读取照片”这类有限权限。OAuth 2.0 的核心规范是 RFC 6749，它定义了第三方客户端如何代表资源所有者获得对 HTTP 服务的有限访问权。

| 角色       | 英文                 | 作用                               | 例子                                           |
| ---------- | -------------------- | ---------------------------------- | ---------------------------------------------- |
| 资源所有者 | Resource Owner       | 拥有数据的人，通常是用户           | 你                                             |
| 客户端     | Client               | 想访问资源的应用                   | 第三方 App、你的前端、后端服务                 |
| 授权服务器 | Authorization Server | 负责认证用户、征求同意、签发 Token | Google 登录服务、GitHub OAuth 服务             |
| 资源服务器 | Resource Server      | 保存资源并验证 Token               | Google Drive API、GitHub API、你自己的业务 API |

## 1. 基本概念

### Access Token

Access Token 是访问资源服务器的凭证。 客户端调用 API 时，通常会把它放在 HTTP 请求头里：

```
Authorization: Bearer ACCESS_TOKEN
```

RFC 6750 定义了 OAuth 2.0 Bearer Token 的用法。Bearer Token 的含义是：谁持有这个 Token，谁就可以使用它访问对应资源，所以必须防止泄露，尤其要通过 TLS 传输并安全存储。

Access Token 通常有这些特征：

- 用途：访问 API
- 有效期：较短，例如几分钟到几小时
- 权限：由 scope 限定
- 格式：可以是 JWT，也可以是不透明字符串 opaque token

### Refresh Token

Refresh Token 用来换新的 Access Token。

Access Token 一般寿命较短，泄露后的风险窗口较小。Refresh Token 寿命较长，用于在用户不重新登录的情况下续期。

```
Access Token 过期
客户端用 Refresh Token 请求新 Access Token
授权服务器返回新的 Access Token
```

Refresh Token 风险更高，应该只保存在安全位置。浏览器前端、移动端这类“公开客户端”要特别谨慎。

### Authorization Code

Authorization Code 是授权码。

在主流的授权码流程中，用户登录并授权后，授权服务器不会直接把 Access Token 返回给浏览器，而是先返回一个短期的一次性授权码：

```
authorization code
```

客户端后端再用这个授权码去换 Access Token。这样可以避免 Token 直接暴露在浏览器地址栏、历史记录或前端环境中。

### Scope

Scope 是权限范围。

例如：

```
read:user
repo:read
email
profile
calendar.readonly
```

Scope 用来限制客户端能做什么。一个好的 OAuth 系统应该遵循最小权限原则：只申请业务真正需要的权限。

### Redirect URI

Redirect URI 是授权完成后跳回客户端的地址。

例如：

```
https://example.com/oauth/callback
```

授权服务器必须严格校验 Redirect URI。否则攻击者可能通过伪造回调地址劫持授权码或 Token。

### State

State 用来防 CSRF 和维护请求上下文。

客户端发起授权请求时生成一个随机值：

```
state=random_string
```

授权服务器回调时带回同一个 state。客户端检查是否一致，用来确认这次回调确实对应自己发起的那次授权请求。

### PKCE

PKCE，全称 `Proof Key for Code Exchange`，是授权码流程的重要安全增强。 它最初是为移动 App、SPA 等无法安全保存 client secret 的公开客户端设计，用于防止授权码被拦截后遭到兑换。RFC 7636 专门定义了 PKCE。

PKCE 的核心是：

```
客户端先生成 code_verifier
再计算 code_challenge
发起授权时提交 code_challenge
换 Token 时提交 code_verifier
授权服务器验证二者是否匹配
```

攻击者即使截获 authorization code，也没有 code_verifier，因此无法换取 Access Token。

## 2. 登录流程

### 授权码模式 Authorization Code Grant

这是最主流、最推荐的模式。现代实现通常搭配 PKCE。

适合：

- Web 应用
- 移动应用
- 桌面应用
- SPA

特点：

- 安全性较好
- Token 不直接暴露在授权跳转 URL 中
- 可结合 PKCE 防止授权码拦截

### Client Credentials Grant

这是机器对机器的授权模式，没有用户参与。

例如：

- 服务 A 调用服务 B
- 后端任务调用内部 API
- 微服务之间调用

流程大致是：

- 客户端用 client_id + client_secret 向授权服务器证明自己身份
- 授权服务器签发 Access Token
- 客户端用 Token 调用资源服务器

适合后端服务，不适合前端浏览器，因为前端无法安全保存 client secret。

### Refresh Token Grant

这不是用户首次授权流程，而是续期流程：

```
Refresh Token -> 新 Access Token
```

适合长期会话，但要特别注意 Refresh Token 的存储、轮换和撤销。

### Implicit Grant

Implicit 模式曾经用于浏览器单页应用，授权服务器会直接把 Access Token 返回到浏览器。现在不推荐新系统使用。OAuth 2.0 安全最佳实践 RFC 9700 更新并扩展了 RFC 6749、RFC 6750 和 RFC 6819 的安全建议，并废弃了一些被认为不安全或安全性较差的操作模式。

现在 SPA 更推荐：`Authorization Code + PKCE`

### Resource Owner Password Credentials Grant

也叫密码模式。用户把用户名密码直接交给客户端，客户端再拿去换 Token。

这个模式现在也不推荐。它违背了 OAuth 的核心设计初衷：第三方应用不应该接触用户密码。
