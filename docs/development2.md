# Development Log 2

接续 [development.md](development.md)，记录后续阶段性变更及验证结果。

## 2026-10-27：改为服务器主动执行自动发布

### 原因与变更

- 首次 GitHub Actions 的前后端及部署检查均成功，但 SSH 发布步骤以255失败；服务器只允许本机来源访问 SSH，GitHub 托管 Runner 无法连接。
- 在独立 `fix/server-local-deployment` 分支将发布任务改为服务器自托管 Runner；前后端构建和测试继续在 GitHub 托管 Runner 运行。
- 服务器以现有低权限 `ginkgo-deploy` 用户安装并注册 `ginkgo-production` Runner，专用标签为 `ginkgo-deploy`，由 systemd 管理并开机启动。
- Runner 主动通过 HTTPS 连接 GitHub，下载同次运行检查通过的构建产物，在服务器本地调用现有发布脚本。保留串行发布、过期提交跳过、校验和、原子切换及失败回滚。
- 最新提交检查改用系统 Python 和任务临时只读令牌，不要求服务器安装 GitHub CLI。工作流不再读取 SSH 发布 Secrets，不修改原有 SSH 来源限制。
- 同步更新部署说明、功能文档和 README；业务接口及数据库迁移未发生变化。

### 已完成验证

- 官方 Runner 2.338.0 安装包的 SHA-256 与 GitHub 管理 API 提供的校验值一致，注册成功，systemd 服务已启动并启用开机启动。
- actionlint 1.7.7 检查通过，专用 Runner 标签已登记到静态检查配置。
- Bash 语法检查通过；在服务器独立临时目录执行11个部署及健康检查测试全部通过，使用模拟 systemctl，不切换正式应用。
- 前后端源码未改变，实际前后端检查和正式发布将在本次 develop 推送后由流水线执行，结果以 Actions 和站点提交号为准。

### 首次正式发布验收

- 提交 `a8df8ff62f578220d626682147fd7cf1b4f80069` 已合并并推送 develop，[Actions 40528088040](https://github.com/kanno111/ginkgo-food-map-v2/actions/runs/40528088040) 完成且全部成功。
- 前后端及部署检查由 GitHub 托管 Runner 完成，后端检查启用真实 MySQL、Redis；发布任务由 `ginkgo-production` 执行，成功下载同次构建产物、切换版本并启动正式服务。
- 外部访问首页、`/login`、`/register`、`/api/public/status`、`/version.txt` 均为200；匿名 `/auth/me` 返回统一401响应。站点版本与服务器 `commit.txt` 均匹配上述提交，服务器健康状态为 UP。
- Runner 在线空闲，Runner 与后端服务均已启用开机启动。确认部署用户没有应用环境配置、JWT 私钥的读取权限。
- 将自动发布能力移入功能文档的已完成部分，更新部署文档当前状态。本次验收记录以仅文档的 `[skip ci]` 提交保存，避免为记录结果再次重启已验收应用；线上版本仍为上述已检查提交。
- 未发送真实邮件或创建测试账号，尚未进行浏览器端到端交互验收；域名和 HTTPS 保持后续工作。
