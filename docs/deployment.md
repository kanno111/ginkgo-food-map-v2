# 自动检查与发布

最后核对日期：2026-10-27。

## 当前状态

项目迁入独立仓库 [kanno111/ginkgo-food-map-v2](https://github.com/kanno111/ginkgo-food-map-v2)，默认分支为 `develop`。新历史从原 develop 的 V2 重构基线开始，随后保存登录、注册及 CI/CD 修改，不包含基线之前的旧系统提交。

服务器 `8.137.98.235` 已完成旧 Java 应用清理和新项目运行环境准备。流水线位于 [ci-cd.yml](../.github/workflows/ci-cd.yml)，部署 Secrets 需要在新仓库配置，原仓库的 Secrets 不会自动继承。首次推送 develop 后，在[新仓库 Actions](https://github.com/kanno111/ginkgo-food-map-v2/actions)查看实际执行结果。

访问地址为 `http://8.137.98.235`。首次成功发布前返回 HTTP 503 和 `Application deployment pending`；成功后提供页面和业务接口。当前仅配置 HTTP，尚未配置域名和 HTTPS。

## 触发条件与执行流程

仅远程 `develop` 分支的 `push` 触发本工作流，包括合并其他分支后产生的推送。其他分支推送、Pull Request 和仅在本地提交不会触发。

1. 后端使用 Java 21 执行 Maven `verify`，启用真实 MySQL、Redis 集成测试。CI 使用临时 MySQL 8.4 和 Redis 8 服务，不访问生产数据库；测试报告即使失败也保留7天。
2. 前端使用 Node.js 24 和 `npm ci`，执行 ESLint、Vitest、TypeScript 类型检查及 Vite 生产构建。
3. 检查部署脚本语法，运行发布、失败回滚及 HTTP 健康检查测试。
4. 三项检查全部通过后，取本次运行生成的 JAR 和前端产物，打包并生成 SHA-256 校验文件，不在服务器重新构建源码。产物保留7天。
5. 发布开始前核对远程 `develop` 最新提交；若当前提交已经被新推送取代，跳过本次发布。发布任务串行执行，不中断正在切换版本的任务。
6. 通过校验服务器主机密钥的 SSH 连接上传，服务器再次验证校验和、压缩包路径和提交号，然后原子切换当前版本链接并重启后端。
7. 同时验证后端健康、前端提交号、登录页面、公开 API 及匿名认证响应。失败时尝试恢复上一版程序，并将本次 Actions 标记为失败。

在 GitHub 仓库的 **Actions → CI and automatic deployment** 查看每个步骤及失败日志。检查失败时不会进入发布，线上已有版本继续运行。流水线核对的是发布开始时的最新提交；发布期间若又有推送，后续通过检查的版本会继续更新。

## 服务器部署结构

| 组件 | 配置与位置 |
| --- | --- |
| 系统 | Ubuntu 24.04，OpenJDK 21 |
| 访问入口 | 宿主机 Nginx，80端口，页面和 `/auth/`、`/api/` 同源 |
| 后端 | `ginkgo-backend.service`，用户 `ginkgo`，监听 `127.0.0.1:8080` |
| 发布账号 | `ginkgo-deploy`，独立 SSH 密钥；sudo 仅允许重启、停止该后端服务 |
| 上传目录 | `/opt/ginkgo/incoming/<提交号>-<运行编号>-<重试编号>/` |
| 版本目录 | `/opt/ginkgo/releases/<版本编号>/`，包含 JAR、前端及提交号 |
| 当前版本 | `/opt/ginkgo/current`，链接到一个版本目录 |
| 后端配置 | `/etc/ginkgo/backend.env`，仅管理员可读写，由 systemd 注入 |
| JWT 密钥 | `/etc/ginkgo/jwt-private.pem`、`jwt-public.pem`，应用组可读 |
| Nginx 配置 | `/etc/nginx/sites-available/ginkgo`，已链接到 `sites-enabled` |
| MySQL | 保留原容器并改名为 `ginkgo-mysql`，`127.0.0.1:3307`，现有版本8.0 |
| 新项目数据库 | `ginkgo_food_map`，独立 `ginkgo_app` 账号，仅授权该库 |
| Redis | 保留原容器并改名为 `ginkgo-redis`，`127.0.0.1:6380`，现有版本7.4，需密码；应用使用 DB 4 |
| 基础设施网络 | Docker 网络 `ginkgo-infrastructure` |

服务器运行配置中的数据库、Redis、SMTP、验证码 HMAC 及 JWT 密钥不进入 Git、构建产物或部署日志。RSA 和 HMAC 密钥由服务器独立生成。systemd 已设置开机启动；首次由流水线发布产物时启动后端服务。

## GitHub Secrets

仓库 Settings → Secrets and variables → Actions 中已配置下列 Repository Secrets：

| 名称 | 用途 |
| --- | --- |
| `DEPLOY_HOST` | 服务器地址 |
| `DEPLOY_PORT` | SSH 端口 |
| `DEPLOY_USER` | `ginkgo-deploy` 部署账号 |
| `DEPLOY_SSH_KEY` | 独立 CI 部署私钥 |
| `DEPLOY_KNOWN_HOSTS` | 已核验的服务器 SSH 主机公钥记录 |

CI 部署私钥的本机副本位于用户目录 `.ssh/ginkgo_ci_ed25519`，不在项目目录。服务器保留原有管理员 SSH 登录能力；管理员密钥没有配置给 Actions。轮换密钥或重装服务器后，需要同步更新对应 Secret 和服务器授权记录。

## 发布后的检查与排查

在本机验证页面和实际前端提交号：

```powershell
Invoke-WebRequest http://8.137.98.235/login
Invoke-RestMethod http://8.137.98.235/api/public/status
Invoke-RestMethod http://8.137.98.235/version.txt
```

`/version.txt` 返回当前前端产物的40位 Git 提交号。匿名访问 `/auth/me` 返回401属于预期结果。

在服务器以管理员身份检查：

```bash
systemctl status ginkgo-backend.service --no-pager
journalctl -u ginkgo-backend.service -n 100 --no-pager
nginx -t
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
readlink -f /opt/ginkgo/current
curl --fail http://127.0.0.1:8080/actuator/health
curl --fail http://127.0.0.1/version.txt
```

Actuator 只在服务器直连后端检查，没有通过站点 Nginx 暴露。分享日志前仍需检查是否含敏感信息，不要输出环境配置文件或私钥。

优先修复代码后重新推送 `develop`；同一提交可在 GitHub 重跑失败的任务，运行重试编号会生成新的版本目录。仅重跑发布任务时，原检查产物必须仍在保留期内。

## 回滚与运行边界

发布期间后端需要重启，会有短暂不可用，不保证零停机。健康检查验证程序及代理链路，不代替浏览器验收，也不实际发送注册邮件。

新版本失败时，发布脚本尝试切回上一版并重启；首次发布没有上一版，会停止失败的服务并移除当前链接。回滚本身失败会明确记录需要人工处理。Flyway 已执行的数据库迁移不会自动撤销，因此迁移需要兼容上一版代码；涉及数据变更时应单独安排备份和恢复方案。

版本目录和上传包暂不自动删除，便于排查和恢复，需定期检查磁盘容量，人工清理前先确认不涉及 `current` 指向的版本及需要保留的回滚版本。配置文件、数据库和 Redis 数据不随应用发布覆盖。

## 旧应用清理与基础设施保留

本次清理针对服务器上原 `/opt/healthy` 应用，已移除其源码、构建文件、配置、日志、备份、旧 Nginx 站点、`healthy-auto-deploy.service` 及脚本，删除原业务容器和对应镜像、Nacos、RabbitMQ 及其专属数据卷、旧网络。

MySQL、Redis 容器及持久化数据保留，没有重建实例。原数据库 `healthy`、`healthy_doctor`、`healthy_identity` 仍保留；这次没有删除旧业务数据库。持久化卷继续使用原名 `healthy-appointment_mysql_data` 和 `healthy-appointment_redis_data`，名称中的旧项目前缀不表示旧 Java 应用仍在运行。

管理员恢复快照位于 `/opt/ginkgo-infrastructure/compose.yaml`，权限限制为 root。现存容器仍保留原 Compose 标签；该文件用于容器缺失后的恢复，不应在当前容器存在时直接执行 `compose up`，避免名称冲突。恢复时必须继续挂载现有数据卷，不要执行删除卷的命令。

## 已完成验证

- 本机 Maven `verify` 成功，64个后端测试全部通过，包含真实 MySQL、Redis 测试。
- 前端 `npm run check` 成功，19个测试、ESLint、类型检查和生产构建通过。
- actionlint 1.7.7 校验流水线通过，Bash 语法检查通过。
- 11个部署及健康检查测试在 Ubuntu 服务器临时目录通过；测试模拟 systemctl，不切换正式服务。
- Nginx 配置和 systemd 单元静态校验通过，独立部署账号 SSH 登录及限定 sudo 权限已验证。
- 服务器复核：旧应用路径不存在，只有保留的 MySQL、Redis 容器运行且状态健康，站点返回首次发布等待状态。

本地验证不替代真实 GitHub runner 和正式版本切换验收，发布结果以新仓库 Actions 与站点版本标识为准。
