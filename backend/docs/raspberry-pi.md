# VibeFit 树莓派部署与运维手册

本手册对应首个家庭部署版本 `1.1.0`。目标为 Raspberry Pi 4/5、至少 4GB 内存、64 位 Raspberry Pi OS；应用与 PostgreSQL 可放在高耐久 microSD，但真正的灾难备份必须位于另一块介质或远端存储。

仓库已经交付构建、部署、HTTPS、备份、恢复、升级、回滚和观测能力。由于仓库不包含 ACR 凭据、生产证书、SMTP secret，也没有连接真实树莓派，实际推送、真机安装和 30 天结论必须按本手册在目标环境留证后才能宣称完成。

## 交付物

| 路径 | 用途 |
| --- | --- |
| `docker-bake.hcl` | 同时构建 `linux/amd64` 与 `linux/arm64` 的六个发布镜像 |
| `scripts/publish-acr.sh` | 登录 ACR、推送双标签、检查两个平台、生成摘要锁 |
| `deploy/rpi/compose.yaml` | 无 `build:`、只接受 `repo@sha256` 的生产 Compose |
| `deploy/rpi/images.lock.env` | 发布脚本生成的实际镜像摘要；不提交仓库 |
| `deploy/rpi/Caddyfile` | 加载用户签发叶子证书的 HTTPS 网关 |
| `deploy/rpi/maintenance/` | PostgreSQL 15 dump/restore、SHA-256、Restic 加密与保留策略 |
| `deploy/rpi/scripts/` | 安装、验证、备份演练、升级、两级回滚和 30 天观测 |
| `deploy/rpi/systemd/` | 5 分钟观测；默认关闭的日备与周检定时器 |

生产网络仅由 Caddy 暴露 80/443。PostgreSQL、Backend、Worker 与 Frontend 没有宿主端口。长期服务使用健康检查、`restart: unless-stopped`、`no-new-privileges`、能力裁剪、只读文件系统（可行处）和每容器 `3 × 10MB` Docker 日志轮转。

资源上限为 PostgreSQL 1GB、Backend 512MB、Worker 384MB、Frontend 128MB、Caddy 128MB、Maintenance/Migrate 256MB。PostgreSQL 显式启用 `fsync`、`full_page_writes`、同步提交和数据校验和，不以降低一致性换取 microSD 写入量。

## 必须由部署者提供

- 阿里云 ACR 个人版杭州地域 endpoint、namespace、用户名和访问密码。
- 固定局域网域名或 IP，即 `VIBEFIT_HOST`。
- 私有根 CA 公钥 PEM；根私钥必须离线，不能复制到仓库、构建机发布目录或树莓派。
- SAN 匹配 `VIBEFIT_HOST` 的服务器叶子证书及私钥。
- SMTP 主机、账号、授权码，以及 PostgreSQL/JWT/Restic 随机 secret。

ACR 个人版无 SLA；每次升级会先拉取当前版和候选版，并在拉取失败时验证本地不可变镜像缓存。首次灾难重建仍取决于仓库当时可用。参见[阿里云 ACR 个人版计费与服务说明](https://help.aliyun.com/en/acr/product-overview/billing-description)。

## 发布到阿里云 ACR

### 1. 创建仓库

在同一 ACR 个人版 namespace 中预先创建六个私有仓库：

- `vibefit-backend`
- `vibefit-worker`
- `vibefit-frontend`
- `vibefit-maintenance`
- `vibefit-postgres`
- `vibefit-caddy`

构建主机需要 Docker Engine、Buildx 和可推送 ACR 的网络。Node、Nginx、PostgreSQL 与 Caddy 上游基础镜像均固定到补丁版本和多平台 index digest，记录于 `deploy/rpi/base-images.lock.env`。当前 Node 基线为 24.19.0 LTS；版本周期见 [Node.js Releases](https://nodejs.org/en/about/previous-releases)。

### 2. 创建 Buildx builder

```bash
docker buildx create --name vibefit-multiarch --driver docker-container --use
docker buildx inspect --bootstrap
```

### 3. 发布

在 `pwa/` 下设置环境变量。密码文件只放 ACR 登录密码，不提交：

```bash
export ACR_REGISTRY=crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com
export ACR_NAMESPACE=your-namespace
export ACR_USERNAME=your-user
export ACR_PASSWORD_FILE=/secure/path/acr-password
export RELEASE_VERSION=1.1.0
sh scripts/publish-acr.sh
```

脚本默认从 Git 读取 12 位 revision，拒绝脏工作树，构建并推送两个标签：`1.1.0` 和 `1.1.0-<git-sha>`。随后逐个检查 manifest 同时包含 `linux/amd64` 与 `linux/arm64`，最终把六个 manifest digest 写入 `deploy/rpi/images.lock.env`。生产 Compose 只使用 digest，不使用这两个标签。

发布后再执行一次带远端 manifest 检查的策略校验：

```bash
python3 deploy/rpi/scripts/validate-release.py \
  --lock deploy/rpi/images.lock.env \
  --check-manifests
```

Docker 多平台原理见 [Docker multi-platform builds](https://docs.docker.com/build/building/multi-platform/)，ACR 多架构说明见[阿里云 ACR multi-arch 文档](https://help.aliyun.com/en/acr/user-guide/build-multi-schema-container-images)。

## 首次安装

### 1. 准备主机

确认系统为 64 位、内存不少于 4GB，并安装 Docker Engine、Docker Compose `2.23.1` 或更高版本、Python 3、OpenSSL 和 curl。该最低版本用于 environment-backed Compose secrets；同时必须支持 `--wait`、profiles 和 `service_completed_successfully`。

```bash
uname -m                  # 必须为 aarch64
getconf LONG_BIT          # 必须为 64
docker compose version
python3 --version
```

把 `pwa/deploy/rpi/` 复制到树莓派，例如 `/opt/vibefit`。发布生成的 `images.lock.env` 必须随部署包传输，但 ACR 密码和应用 secret 不得放入该文件。

### 2. 非敏感配置

```bash
cd /opt/vibefit
cp config.env.example config.env
```

至少修改：

- `VIBEFIT_HOST`：叶子证书 SAN 中的域名或固定 IP。
- SMTP 参数。
- `VIBEFIT_DATA_DIR`：默认 `/srv/vibefit/data`。
- 备份保持 `BACKUP_ENABLED=false`，直到外部目的地完成配置。

### 3. Secret 文件

在 `/opt/vibefit/secrets/` 创建：

| 文件 | 内容与权限 |
| --- | --- |
| `postgres_password` | PostgreSQL 随机密码，0600 |
| `database_url` | `postgresql://vibefit:<URL编码密码>@postgres:5432/vibefit`，0600 |
| `jwt_secret` | 至少 32 字符随机值，0600 |
| `smtp_password` | SMTP 授权码，0600 |
| `tls_cert.pem` | 服务器叶子证书/必要链，0644 |
| `tls_key.pem` | 叶子私钥，0600 |
| `root_ca.pem` | 私有根 CA 公钥，0644 |
| `restic_password` | 加密备份密码；首次安装且备份关闭时可暂缺，备份/演练/恢复/升级前必须存在，0600 |

除 `restic_password` 的上述例外外，其余文件均为首次安装必需。`postgres_password` 与 `database_url` 中的密码必须相同。根 CA 私钥不在此列表，也不得出现在树莓派上。

生产 Compose 通过 `scripts/compose.sh` 读取这些宿主机文件，再以 Compose secret 挂载到对应服务的 `/run/secrets/`，并为非 root 容器设置匹配的 UID 与只读权限。secret 不会成为容器环境变量。所有人工 Compose 操作都必须经由该包装脚本；直接运行 `docker compose` 会缺少临时 secret source，且不属于受支持的运维路径。

安装前可人工验证：

```bash
openssl verify -CAfile secrets/root_ca.pem secrets/tls_cert.pem
openssl x509 -in secrets/tls_cert.pem -checkhost vibefit.home.example -noout
openssl x509 -in secrets/tls_cert.pem -checkend 2592000 -noout
```

固定 IP 证书将 `-checkhost` 换成 `-checkip`。证书剩余不足 30 天时，安装、验证和 30 天报告都会失败。

### 4. 登录 ACR 并安装

```bash
docker login crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com
sudo sh /opt/vibefit/scripts/install.sh
```

安装脚本拒绝非 ARM64/非 64 位/不足 4GB、浮动标签、非 ACR 个人版摘要、示例 digest、弱 JWT、证书链或 SAN 错误。它创建 PostgreSQL 绑定目录、拉取镜像、等待健康、执行 HTTPS 冒烟，并只启用 5 分钟观测 timer；备份 timer 被安装但不会启用。

### 5. 验证

```bash
sudo sh /opt/vibefit/scripts/verify.sh
sudo sh /opt/vibefit/scripts/compose.sh ps --all
```

验证脚本使用 `root_ca.pem` 和 `--resolve` 检查真实证书、H5、`/health`、`/api/version` 与运行版本；禁止添加 `curl -k`。

## Android 私有 CA、上传与恢复

版本 `1.1.0` 使用 `versionCode 83`。Android Network Security Configuration 禁止明文 HTTP，并只信任系统 CA 与构建时嵌入的 VibeFit 根 CA；不固定叶子证书。根不变时轮换服务器叶子证书不需要重发 APK，根变化时必须重新构建 APK。

Windows PowerShell 构建示例：

```powershell
cd android
npm install
npm run sync
$env:VIBEFIT_CA_CERT_PATH = "C:\secure\vibefit-root-ca.pem"
cd android
.\gradlew.bat assembleRelease
```

Linux/macOS 使用 `export VIBEFIT_CA_CERT_PATH=/secure/vibefit-root-ca.pem` 与 `./gradlew assembleRelease`。Gradle 在每次构建时生成 `@raw/vibefit_root_ca`；缺少、过期、无法解析或不是 `CA:TRUE` 的 X.509 PEM 时构建失败，根 CA 公钥不会提交仓库。

Android 首次从根路径启动且没有服务器配置时进入“连接家庭服务器”，只接受规范化后的 HTTPS origin，不接受凭据、路径、查询串或 fragment。连接测试通过后才进入邮件登录。设置页可修改服务器；切换后清除令牌、同步队列和远端同步元数据，但不删除训练、计划、动作、设置或未完成训练。

真机验收必须完成：

1. 通过内置根 CA 连接，不安装绕过证书验证的调试代理。
2. 邮件验证码登录。
3. “立即备份”成功，Worker 日志出现 `Processed backup.created event`。
4. 记录本地核心表数量、ID 与最近训练，清空专用测试数据后执行“恢复备份”。
5. 恢复后的数量、ID 与最近训练一致；损坏快照校验失败时本地数据不被清空。
6. H5 通过同一 HTTPS origin 访问，生产 CORS 仅允许该 origin 与 Capacitor `https://localhost`。

单次上传上限为 10MiB；Android 在发送前检查，Backend 在解析层返回 413，并对缺字段或嵌套 schema 错误返回 400。

Android 自定义 CA 机制见 [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)，Caddy 证书文件配置见 [Caddy `tls` directive](https://caddyserver.com/docs/caddyfile/directives/tls)。

## PostgreSQL 自动备份

Maintenance 镜像使用与服务器相同的 PostgreSQL 15 客户端。每次备份：

1. 生成 custom-format `pg_dump`。
2. 用 `pg_restore --list` 验证并生成 SHA-256。
3. 只归档 dump、校验和、Compose、Caddyfile、非敏感 config、镜像锁和叶子公钥证书。
4. 由 Restic 加密写入仓库；数据库/JWT/SMTP secret、TLS 私钥和根私钥不会进入快照。
5. 保留 7 个日备、4 个周备、6 个月备，并 prune。

### 启用

先把外部 SSD、NAS 或远端挂载点稳定挂载到树莓派，再将 `config.env` 改为：

```env
BACKUP_ENABLED=true
VIBEFIT_BACKUP_DIR=/mnt/external-vibefit-backup
```

该路径不能仍为 `backup-not-configured`。若它和 PostgreSQL 位于同一张 microSD，只能称为升级快照，不能称为灾难备份。

先手工执行并做隔离恢复演练：

```bash
sudo sh scripts/backup-now.sh
sudo sh scripts/backup-check.sh
sudo sh scripts/rehearse-backup-restore.sh
```

演练脚本在临时加密 Restic 仓库生成真实备份，创建唯一 Docker 测试卷，将 dump 恢复到隔离 PostgreSQL，再比较用户数、验证码数、快照数、同步元数据、最新快照 ID 与 payload 哈希。它不会对生产卷执行 `DROP`/restore，结束后删除临时容器、测试卷和临时仓库。

确认外部目的地和演练通过后才启用定时器：

```bash
sudo systemctl enable --now vibefit-backup.timer vibefit-backup-check.timer
systemctl list-timers 'vibefit-*'
```

日备在 03:15，完整性检查每周日 04:00。关闭：

```bash
sudo systemctl disable --now vibefit-backup.timer vibefit-backup-check.timer
```

### 常规数据库恢复

先运行隔离演练并确定 snapshot ID。常规同版本恢复会停止所有写服务：

```bash
sudo CONFIRM_DATABASE_RESTORE=YES \
  sh scripts/restore-database.sh /mnt/external-vibefit-backup <snapshot-id>
```

恢复失败时写服务保持停止，避免在部分恢复的数据上继续运行。

## 升级

把新发布生成的锁文件复制为独立候选文件，不要直接覆盖当前 `images.lock.env`：

```bash
sudo sh scripts/upgrade.sh /opt/vibefit/candidates/1.1.1-images.lock.env
```

脚本固定执行：

1. 当前 HTTPS/容器健康与磁盘空间预检。
2. 预拉取当前版和候选版；ACR 不可用时必须在本机找到对应 digest。
3. 归档当前锁、Compose 和 Caddyfile。
4. 记录维护窗口并停止写服务，避免升级快照与停写之间出现数据丢失窗口。
5. 即使定时备份关闭，也在 `/srv/vibefit/upgrade-snapshots` 生成并校验加密快照；失败时自动重启并验证未变更的当前版。
6. 使用候选 Backend 镜像在单事务中执行迁移；失败即中止并重启当前版。
7. 启动候选服务，等待健康并验证 TLS、H5、API 和 `/api/version`。
8. 全部通过后才原子替换当前镜像锁。

dump、SHA/`pg_restore --list`、空间、迁移或健康任何一步失败都不会把候选锁标为当前版。

## 回滚

### Schema 向后兼容

只有确认候选迁移与上一版兼容时使用镜像回滚：

```bash
sudo CONFIRM_IMAGE_ROLLBACK=YES \
  sh scripts/rollback.sh releases/<previous>/images.lock.env
```

脚本先确认上一版 digest 已拉取或仍在本机，记录维护窗口并停止写服务，然后启动、验证上一版，最后切换当前锁；不会恢复数据库。

### Schema 不兼容

先用 `rehearse-backup-restore.sh` 或等价隔离实例验证升级前 snapshot，再同时回滚数据库与镜像：

```bash
sudo CONFIRM_DATABASE_ROLLBACK=YES \
  sh scripts/rollback-with-restore.sh \
  releases/<previous>/images.lock.env \
  /srv/vibefit/upgrade-snapshots \
  <pre-upgrade-snapshot-id>
```

脚本停止写入，恢复经过确认的升级前数据库，启动并验证上一版镜像，最后切换锁。任一恢复步骤失败时不会启动写服务。

## 证书轮换

保持根 CA 不变，离线签发 SAN 匹配 `VIBEFIT_HOST` 的新叶子证书，替换 `tls_cert.pem` 与 `tls_key.pem`，设置 0644/0600 后执行：

```bash
sudo sh scripts/verify.sh
sudo sh scripts/compose.sh up --detach --force-recreate caddy
sudo sh scripts/verify.sh
```

第一次 `verify` 会检查文件链、SAN 和有效期，但旧 Caddy 仍在使用内存中的证书；重建后第二次验证实际服务。若根 CA 变化，必须同步更新树莓派 `root_ca.pem` 和 Android APK 内置公钥，并重新完成真机 TLS 验收。

## 故障定位

```bash
sudo sh scripts/compose.sh ps --all
sudo sh scripts/compose.sh logs --tail 200 backend worker postgres caddy migrate
df -h /srv/vibefit
dmesg --level=err
vcgencmd measure_temp
vcgencmd get_throttled
systemctl status vibefit-observe.timer
```

- `migrate` 非 0：不要反复重启 Backend；检查事务错误与升级前快照。
- Caddy unhealthy：先检查 SAN、证书到期、根链和文件权限，禁止用 `curl -k` 掩盖。
- Worker unavailable：上传仍保存在 PostgreSQL；该用户下一次成功事件会再次执行幂等清理。
- microSD I/O/EXT4 错误：立即停止写入并从外部备份恢复到新介质，不能把容器重启视为修复。
- ACR 不可用：继续运行本机当前 digest；没有当前/上一版缓存时不要升级。

PostgreSQL 保持 15.18，避免本阶段引入大版本迁移。PostgreSQL 15 支持到 2027-11-11，应在 2027 年上半年开始独立规划、演练并观察大版本升级，参见 [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)。

30 天观测、故障注入和判定标准见 [树莓派 30 天稳定性验收](./rpi-30-day-validation.md)。
