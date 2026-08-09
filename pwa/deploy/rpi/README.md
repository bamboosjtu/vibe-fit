# VibeFit Raspberry Pi release bundle

这是 `1.1.0` 的生产部署目录。完整步骤见 [`../../docs/raspberry-pi.md`](../../docs/raspberry-pi.md)，30 天验收见 [`../../docs/rpi-30-day-validation.md`](../../docs/rpi-30-day-validation.md)。

最短入口：

1. 在构建机运行 `pwa/scripts/publish-acr.sh`，得到真实 `images.lock.env`。
2. 将本目录复制到树莓派，创建 `config.env` 与 `secrets/` 文件。
3. 登录 ACR 后运行 `sudo sh scripts/install.sh`。
4. 用 `sudo sh scripts/verify.sh` 验证真实 CA，不得使用 `curl -k`。

人工查看状态、日志或重建服务时，统一使用 `sudo sh scripts/compose.sh ...`。包装脚本只在 Compose 进程运行期间读取宿主机的 `0600` secret 文件，并以匹配服务 UID 的只读 Compose secret 提供给容器；不要绕过它直接执行生产 Compose。

备份 timer 默认关闭；配置外部目的地并通过 `scripts/rehearse-backup-restore.sh` 后才可启用。
