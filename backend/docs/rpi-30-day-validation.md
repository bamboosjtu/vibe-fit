# VibeFit 树莓派 30 天稳定性验收

本验收证明特定树莓派、特定 microSD 与 `images.lock.env` 所标识的软件栈在家庭负载下连续运行 30 天。它不能证明 microSD 多年耐久，也不能替代外部灾难备份。

## 开始条件

- `scripts/install.sh` 和 `scripts/verify.sh` 已通过。
- 实际 ACR manifest 已检查 ARM64，生产 Compose 策略校验通过。
- Android 真机已验证私有 CA、邮件登录、上传和恢复。
- 外部备份未配置时，明确记录“无灾难备份”；自动备份 timer 继续关闭。
- 记录树莓派型号、RAM、OS、内核、Docker/Compose 版本、microSD 型号/容量、`releaseVersion`、`gitRevision`、`databaseSchemaVersion` 与六个镜像 digest。

任何代码、镜像或数据库结构修复都必须更换 release digest，并从第 0 天重新计时。仅家庭网络中断且树莓派本机服务持续健康时，才可作为有证据的外部事件排除。

## 自动观测

安装脚本启用 `vibefit-observe.timer`，每 5 分钟向 `deploy/rpi/soak/observations.jsonl` 写一条 JSON。单文件到 10MiB 后轮转，最多保留当前文件与 3 个历史文件。

每条记录包含：

- 五个长期容器的运行/健康状态、重启数、OOM 标志与容器内全部进程 RSS。
- Docker CPU/内存统计。
- 一次性 migrate 的退出码。
- 经真实私有 CA HTTPS 读取的 `/api/version` 三个版本字段，以及它们是否匹配当前镜像锁。
- CPU 温度和 `get_throttled`。
- microSD 空间、PostgreSQL 大小。
- 最近 6 分钟内核 I/O、EXT4/mmc 和 OOM 事件。
- 叶子证书剩余天数。

检查 timer：

```bash
systemctl status vibefit-observe.timer
journalctl -u vibefit-observe.service --since today
tail -n 2 /opt/vibefit/soak/observations.jsonl
```

### 维护窗口

升级、镜像回滚和数据库恢复脚本会自动写维护窗口。主机重启或人工故障注入必须手工记录：

```bash
python3 /opt/vibefit/scripts/record-maintenance.py start "planned-host-reboot"
sudo systemctl reboot
# 主机恢复并通过 verify 后：
python3 /opt/vibefit/scripts/record-maintenance.py end --result completed
```

窗口存入 `soak/maintenance-windows.jsonl`。不要用维护窗口排除原因不明的故障；报告只排除明确记录的时间段。

## 时间表

| 日期 | 必做项目 |
| --- | --- |
| 第 0 天 | 记录基线；HTTPS/API/H5 冒烟；Android 上传/恢复往返；隔离数据库恢复 |
| 第 7 天 | Android 上传/恢复往返；核对核心数量、ID、最近训练；主机正常重启 |
| 第 14 天 | Android 往返；依次强制终止 Backend、Worker、PostgreSQL 并验证自动恢复 |
| 第 21 天 | Android 往返；发布一个候选 digest，完成完整升级与镜像回滚 |
| 第 30 天 | Android 往返；再次隔离数据库恢复；生成并签字确认最终报告 |

每次 Android 往返都应使用专用验收账号和可识别的测试训练。在上传前、清空专用测试数据后、恢复后分别记录：

- `users`、`backup_snapshots`、`sync_meta` 数量。
- Android 本地计划、训练、动作数量。
- 最近训练 ID、开始时间、动作与组数。
- `/api/version` 三个版本字段。
- Worker 对应 event ID、backup ID、deletedSnapshots 日志。

不要在包含真实用户唯一副本的数据上执行清空操作。

## 故障与恢复演练

所有演练先开始维护窗口，结束时运行 `scripts/verify.sh` 再关闭窗口。

### Backend

```bash
container_id=$(sudo sh scripts/compose.sh ps -q backend)
sudo docker kill "$container_id"
```

应由 `restart: unless-stopped` 自动恢复，健康中断不得超过 5 分钟，无令牌或本地训练数据丢失。

### Worker

```bash
container_id=$(sudo sh scripts/compose.sh ps -q worker)
sudo docker kill "$container_id"
```

Worker 停止期间上传必须仍写入 PostgreSQL；恢复后再次上传同一用户快照，确认幂等保留清理执行。

### PostgreSQL

```bash
container_id=$(sudo sh scripts/compose.sh ps -q postgres)
sudo docker kill "$container_id"
```

PostgreSQL 必须自动恢复，Backend readiness 随数据库状态变化；检查日志、数据校验和、核心行数与最近快照，不允许出现数据库损坏、迁移重跑或文件系统 I/O 错误。

### 升级与回滚

严格使用 `scripts/upgrade.sh` 与 `scripts/rollback.sh`，记录候选/上一版 lock。验证升级前加密快照、候选迁移、`/api/version`、TLS、Android 上传/恢复与上一版镜像缓存。

### 隔离数据库恢复

```bash
sudo sh /opt/vibefit/scripts/rehearse-backup-restore.sh
```

该脚本必须报告 dump 可读、Restic 加密仓库可恢复、测试卷内容与源数据库一致，并确认测试卷已销毁。不得把生产卷作为演练恢复目标。

## 生成报告

默认会按时间顺序读取 `.3`、`.2`、`.1` 和当前 JSONL；也可显式传入一个已归档的合并文件：

```bash
python3 /opt/vibefit/scripts/soak-report.py
# 或：python3 /opt/vibefit/scripts/soak-report.py /path/to/all-observations.jsonl
```

报告输出到 `soak/report.json`，自动检查：

- 日历观察期至少 30 天。
- 排除记录在案的维护窗口后，按应有 5 分钟采样数计算的健康成功率不低于 99.5%。缺失采样按失败计。
- 单次不可恢复故障不超过 5 分钟。
- 无 OOM、内核/文件系统 I/O 错误或 migrate 失败。
- 第 4 周相对第 1 周各服务 RSS 增长不超过 20%。
- 实测磁盘低于 80%，按 30 天增长线性外推 12 个月仍低于 80%。
- 无降频标志，叶子证书始终至少剩余 30 天。
- 内核与温度/降频遥测完整，PostgreSQL 大小、证书、版本和 RSS 遥测覆盖率均不低于 99.5%；缺失遥测不会被当作“零错误”。

最终人工判定还必须确认：

- 所有五次 Android 上传/恢复往返与核心数据核对通过。
- 正常重启、三个容器强制终止、升级、镜像回滚、隔离恢复全部完成。
- 无数据库损坏、迁移错误或单次超过 5 分钟的不可恢复故障。
- 所有排除窗口都有原因、开始/结束时间与 `verify.sh` 证据。

若自动报告失败，不得删除观测点或扩大维护窗口来“修正”结果；定位原因、发布新 digest，并在任何代码/镜像/schema 修复后重新开始 30 天。
