# Ginkgo 美食地图 V2

V2 是对旧版 Ginkgo 美食地图的渐进式重构。第一阶段采用模块化单体：业务代码按领域分开，运行时仍是一个 Spring Boot 进程，数据使用 MySQL，缓存与会话基础设施使用 Redis。

独立仓库：[kanno111/ginkgo-food-map-v2](https://github.com/kanno111/ginkgo-food-map-v2)。默认分支为 `develop`，历史从原 develop 的 V2 重构基线开始保留。推送 develop 后由 GitHub 检查构建，服务器自托管 Runner 主动下载已检查产物并在本地发布，无需对 GitHub 开放入站 SSH。结果见[GitHub Actions](https://github.com/kanno111/ginkgo-food-map-v2/actions)。

## 当前阶段

- 已建立 Java 21 + Spring Boot 4.0 的后端骨架
- 已建立 Vue 3 + TypeScript + Vite 前端，并由 Nginx 承担静态部署和 API 反向代理
- 已按用户、餐厅、评价、管理、文件和安全领域划分包
- 已接入 MySQL、Redis、Flyway、MyBatis-Plus、Spring Security 和 Actuator
- 已提供 MySQL 与 Redis 的 Compose 配置
- 已实现校园邮箱验证码注册、用户名密码登录、JWT 与 Redis 会话校验、当前用户查询和退出当前会话
- 暂未迁移旧系统业务和数据

## 项目文档

- [功能说明](docs/features.md)：使用非技术人员也能理解的语言说明当前可用和计划中的功能。
- [接口文档](docs/api.md)：维护已实现接口的认证要求、请求参数、响应示例、错误码及联调方法。
- [自动部署](docs/deployment.md)：develop 推送检查与发布、服务器结构、排查及回滚边界。
- [开发记录](docs/development.md)：记录阶段性变更、关键决策和验证结果。

## 目录

```text
ginkgo-food-map-v2/
├── backend/                 Spring Boot 模块化单体
├── frontend/                Vue 3 前端与 Nginx 部署配置
├── deploy/                  服务器发布、健康检查、systemd 与 Nginx 配置
├── .github/workflows/       develop 自动检查与发布流水线
├── docs/                    产品、架构和迁移文档
├── compose.yaml             本地 MySQL 与 Redis
└── AGENTS.md                AI 和开发协作规则
```

## 本地启动

前置条件：Java 21、Maven 3.9，以及已经运行的 MySQL 8 和 Redis；也可以使用 Docker Compose 启动它们。
本地数据库、Redis 和 SMTP 凭据写入已被 Git 忽略的
`backend/config/application-local.yml`，文件结构参考同目录的
`application-local.example.yml`。启动后端时必须显式启用 `local` Profile。

```powershell
docker compose up -d mysql redis
cd backend
# 首次启动前生成本机 RSA 密钥；已有密钥时不要重复执行，工具会拒绝覆盖。
java tools/GenerateJwtKeys.java
mvn spring-boot:run "-Dspring-boot.run.profiles=local"
```

前端构建与预览：

```powershell
cd frontend
npm install
npm run build
npm test
npm run dev
```

前端开发地址为 `http://localhost:5173`，请求通过 Vite 代理访问 Java 后端。生产构建由 Nginx 托管，`/api` 请求由 Nginx 反向代理到 Spring Boot。

健康检查：

```text
GET http://localhost:8080/actuator/health
GET http://localhost:8080/api/public/status
```

运行测试：

```powershell
cd backend
mvn test
```

## 配置

开发环境默认连接：

```text
jdbc:mysql://localhost:3306/ginkgo_food_map
redis://localhost:6379
```

MySQL 默认用户名为 `root`、默认密码为空。实际用户名、密码和端口都应通过环境变量覆盖，具体见 `backend/src/main/resources/application.yml`。Redis 默认无密码，也可以通过环境变量设置。

环境变量示例见 `.env.example`。不要把真实密码提交到 Git。

JWT 使用 `backend/secrets/jwt-private.pem`（PKCS#8 私钥）和
`backend/secrets/jwt-public.pem`（X.509 公钥），该目录已被 Git 忽略，密钥不会打包进 JAR。
从 `backend` 目录启动时默认使用这两个文件；生产环境应通过
`JWT_PRIVATE_KEY_LOCATION`、`JWT_PUBLIC_KEY_LOCATION` 指定部署环境管理的匹配 RSA 密钥。
应用启动时会校验密钥至少2048位且公私钥匹配，缺失或不匹配时拒绝启动。

当前认证接口：`POST /auth/login`、`GET /auth/me`、`POST /auth/logout`。
登录以 JSON 提交 `username`、`password`，成功后用
`Authorization: Bearer <accessToken>` 访问需要认证的接口。响应中的 `expiresAt` 是本次会话截止时间。
当前没有刷新令牌，过期后需要重新登录。不要在日志中记录登录请求或响应中的敏感字段。

## 重构原则

1. 旧系统保持可运行，V2 在新目录独立开发。
2. 先建立数据库、身份和模块边界，再迁移页面功能。
3. 每次迁移一个可测试的垂直功能。
4. 跨模块只能调用对方公开接口，不能直接访问对方 Mapper。
5. 第一阶段只部署一个进程；确有扩容需求时再拆微服务。
