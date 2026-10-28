# Ginkgo 美食地图 V2 接口文档

最后核对日期：2026-10-28。

本文面向前后端联调和接口调用者，仅描述当前已实现的接口。参数规则和频率限制中的数值为仓库默认配置，部署环境可以覆盖允许域名、有效期和限流策略。

本次新增的密码重置提交接口、对应前端页面及登录凭证持久保存已在功能分支实现，尚未合并发布；线上是否具备此能力须以实际发布版本为准。

## 1. 地址与通用约定

| 项目 | 约定 |
| --- | --- |
| 后端直连地址 | `http://localhost:8080`，端口可通过 `SERVER_PORT` 覆盖 |
| 前端开发地址 | `http://localhost:5173`，Vite 代理 `/auth` 和 `/api` 请求 |
| 生产访问 | `http://8.137.98.235`，Nginx 原样代理 `/auth/` 和 `/api/`；首次成功发布前返回503 |
| 路径前缀 | 没有统一 `/api` 前缀；认证使用 `/auth`，公开状态使用 `/api/public` |
| 请求体 | 有请求体的业务 POST 使用 `Content-Type: application/json` |
| 响应体 | 业务响应为 JSON；健康检查有独立格式，见第8节 |
| 日期时间 | ISO 8601 UTC 字符串，例如 `2026-10-27T12:00:00Z` |
| 认证方式 | 请求头 `Authorization: Bearer <accessToken>`；不支持 HTTP Basic 或 Cookie 会话认证 |

GET 当前用户、POST 退出均无请求体，也没有查询参数。以下示例中的邮箱、密码、验证码、用户ID和令牌均为演示数据，不代表已有账号或有效凭证。

### 1.1 统一响应

业务接口的成功和失败响应均使用以下字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `success` | boolean | 请求是否成功 |
| `code` | string | 稳定机器错误码；成功固定为 `OK` |
| `message` | string | 可供用户阅读的提示；不要依赖提示文本编写分支 |
| `data` | object / array / null | 业务数据或字段错误详情；无数据时为 `null` |
| `timestamp` | string | 服务端生成的响应时间 |

无返回数据的成功示例：

```json
{
  "success": true,
  "code": "OK",
  "message": "请求成功",
  "data": null,
  "timestamp": "2026-10-27T12:00:00Z"
}
```

普通失败示例（HTTP 401）：

```json
{
  "success": false,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "用户名或密码错误，或账号暂不可用",
  "data": null,
  "timestamp": "2026-10-27T12:00:00Z"
}
```

DTO 参数校验失败返回 HTTP 400，`data` 为字段错误数组，按字段名排序；同一字段可能有多个错误。不会回传用户提交的敏感值。

```json
{
  "success": false,
  "code": "COMMON_VALIDATION_FAILED",
  "message": "请求参数校验失败",
  "data": [
    { "field": "password", "message": "请输入密码" },
    { "field": "username", "message": "请输入用户名" }
  ],
  "timestamp": "2026-10-27T12:00:00Z"
}
```

### 1.2 认证与错误处理

- 只有总览明确标记为公开的 HTTP 方法和路径允许匿名访问；不要把整个 `/auth` 当作公开路径。
- 登录、注册、密码重置和验证码请求应省略 `Authorization`。即使接口公开，主动携带无效、过期或已撤销的 Bearer 令牌也会触发认证失败。
- 受保护请求同时检查 JWT 签名、发行方、受众、有效期、Redis 会话、最新账号状态及凭证版本。角色使用数据库当前值。
- 受保护请求返回401时，可以清除该请求使用的本地凭证并引导重新登录；旧请求的401不能清除之后新登录得到的凭证。登录接口本身的401表示登录失败。
- 403表示权限不足；429表示限流；503表示服务暂不可用。503不应被当成“密码错误”或“退出成功”，可保留凭证供重试。
- 安全过滤器生成的401包含 `WWW-Authenticate: Bearer`。登录成功、当前用户成功响应和过滤器错误响应设置 `Cache-Control: no-store`。
- 请求方法不匹配时，如果匿名请求先被安全过滤器拦截，可能返回401；通过认证后到达 MVC 才可能得到405。不要依赖错误方法判断接口是否存在。

### 1.3 浏览器客户端的登录保存

- 前端默认将JWT保存到同源 `localStorage`（键名 `ginkgo.access-token`），无“记住我”选项，不保存密码；关闭页面或浏览器后可恢复，仍须调用 `/auth/me` 通过服务端验证后才显示为已登录。
- 同一浏览器同源标签页共享凭证，登录、切换账号或清除凭证后通过 `storage` 事件同步；旧请求的401不得清除其他标签页刚写入的新凭证。不同来源（包括HTTP/HTTPS或端口不同）不共享存储。
- 升级时迁移当前标签页的旧 `sessionStorage` 凭证并清除旧副本；持久存储中已有凭证时优先使用持久凭证。存储访问被浏览器拒绝时退化为本页面内存会话，不保证关闭后恢复。
- JWT与Redis会话的有效期不变，默认7天；没有刷新令牌或滑动续期。过期、撤销或凭证版本不匹配时，由受保护请求的401清除对应本地凭证；503保留以便重试。
- 找回密码页路径为 `/password-reset`，依次调用3.2及4.2接口，均不自动携带Bearer凭证。成功后仅清除提交开始时的旧本地凭证，提示使用新密码登录；失败保留原本的登录状态。其他设备的旧凭证在下次服务端认证时被拒绝。
- 当前仍为Bearer请求头认证，没有改为Cookie认证。`localStorage`可被同源JavaScript读取；HTTPS及HttpOnly Cookie属于后续认证与部署强化工作。

## 2. 接口总览

| 方法 | 路径 | 认证 | 成功状态 | 用途 |
| --- | --- | --- | --- | --- |
| POST | `/auth/email/code/register` | 公开 | 200 | 申请注册验证码 |
| POST | `/auth/email/code/password-reset` | 公开 | 200 | 申请密码重置验证码 |
| POST | `/auth/register` | 公开 | 201 | 校园邮箱注册 |
| POST | `/auth/password-reset` | 公开 | 200 | 使用邮箱验证码设置新密码 |
| POST | `/auth/login` | 公开 | 200 | 用户名密码登录 |
| GET | `/auth/me` | Bearer | 200 | 查询当前用户 |
| POST | `/auth/logout` | Bearer | 200 | 退出当前会话 |
| GET | `/api/public/status` | 公开 | 200 | 应用标识与架构信息 |
| GET | `/actuator/health` | 公开 | 200 / 503 | 基础设施健康检查 |

## 3. 邮箱验证码

### 3.1 申请注册验证码

`POST /auth/email/code/register`，无需认证。

| 参数 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `email` | string | 是 | 非空、有效邮箱格式；去除首尾空白并转小写后，域名必须精确匹配允许列表 |

```json
{
  "email": "student@std.uestc.edu.cn"
}
```

默认仅允许 `std.uestc.edu.cn`，可通过 `AUTH_ALLOWED_EMAIL_DOMAINS` 配置多个域名。基础邮箱格式在 DTO 层先校验，调用方应直接提交无多余空白的合法邮箱。相似域名或其他子域名不会自动被允许。

成功返回 HTTP 200、统一成功响应、`data: null`。验证码不在接口响应中返回，由邮件发送；接口成功不保证收件箱已完成投递。

默认策略：

- 6位数字验证码，5分钟有效；有效期从 Redis 预留时开始计时。
- 同一邮箱60秒冷却、小时窗口最多5次、24小时窗口最多10次；注册和密码重置共享邮箱发送配额与冷却。
- 注册与密码重置验证码按用途分别保存，不能混用；重新申请同用途验证码会替换之前的验证码。
- 同一验证码最多允许5次错误尝试，达到上限即失效；成功消费后立即失效。
- SMTP 发送失败会取消本次待激活验证码及其冷却，但不退还已计入的发送次数；请求已失败时仍可能消耗发送配额。

主要失败：

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `COMMON_VALIDATION_FAILED` | 邮箱缺失或格式不合法 |
| 400 | `USER_CAMPUS_EMAIL_REQUIRED` | 不属于允许的校园邮箱域名 |
| 409 | `USER_EMAIL_ALREADY_REGISTERED` | 邮箱已经注册 |
| 429 | `AUTH_CODE_RESEND_COOLDOWN` | 尚在重发冷却期 |
| 429 | `AUTH_CODE_EMAIL_RATE_LIMITED` | 超出邮箱发送配额 |
| 503 | `AUTH_CODE_MAIL_DELIVERY_FAILED` | 邮件发送失败 |
| 503 | `AUTH_CODE_DELIVERY_STATE_EXPIRED` | 邮件发送后无法激活本次验证码 |
| 503 | `AUTH_CODE_SERVICE_UNAVAILABLE` | Redis 验证码服务暂不可用 |

### 3.2 申请密码重置验证码

`POST /auth/email/code/password-reset`，无需认证。请求字段和格式与3.1相同。

成功返回 HTTP 200、统一成功响应、`data: null`。

- 已注册的校园邮箱会进入验证码发送流程。
- 未注册但格式、域名合法的邮箱直接返回相同的成功响应，不发送邮件。
- 成功响应不表示账号一定存在，也不表示密码已经修改。
- 实际发送时仍可能返回验证码限流或邮件/Redis故障错误；当前实现不保证各种条件下的响应或耗时完全一致。
- 基础参数校验及校园域名限制仍然生效；`USER_EMAIL_ALREADY_REGISTERED` 不用于此接口。

收到密码重置验证码后，可调用4.2的接口提交新密码；注册用途验证码不能用于该流程。

## 4. 注册与密码重置

### 4.1 注册账号

`POST /auth/register`，无需认证。

| 参数 | 类型 | 必填 | 默认规则 |
| --- | --- | --- | --- |
| `email` | string | 是 | 非空、有效校园邮箱；与申请验证码时一致 |
| `verificationCode` | string | 是 | 严格6位ASCII数字，保留可能出现的前导零 |
| `username` | string | 是 | 去除首尾空白后3至32个 Unicode 字符，只允许文字、数字和下划线 |
| `password` | string | 是 | 至少8个 Unicode 字符，UTF-8最多72字节，至少包含一个文字和一个数字，不能含控制字符；不执行 trim |

```json
{
  "email": "student@std.uestc.edu.cn",
  "verificationCode": "012345",
  "username": "ginkgo_user",
  "password": "ExamplePassword2026"
}
```

后端不接收确认密码字段，确认密码由前端表单自行比较。

成功返回 HTTP 201、统一成功响应、`data: null`：

- 账号邮箱标记为已验证，账号状态为 `ACTIVE`，分配 `ROLE_USER`。
- 不自动登录、不返回令牌；下一步调用 `/auth/login`。
- 邮箱和用户名必须唯一。用户名比较遵循数据库排序规则，当前 MySQL 配置为大小写、重音不敏感。
- 验证码先消费，再写入账号和角色。账号与角色写入在同一数据库事务中；消费验证码后的数据库写入失败，验证码不会恢复，需要重新申请。

主要失败：

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `COMMON_VALIDATION_FAILED` | 必填、邮箱格式或6位验证码格式不符 |
| 400 | `USER_CAMPUS_EMAIL_REQUIRED` | 非允许校园邮箱 |
| 400 | `USER_USERNAME_INVALID` | 用户名字符或长度不符 |
| 400 | `USER_PASSWORD_WEAK` | 密码不符合规则 |
| 400 | `AUTH_CODE_INVALID_OR_EXPIRED` | 验证码错误、未激活、过期、已消费或用途不匹配 |
| 409 | `USER_EMAIL_ALREADY_REGISTERED` | 邮箱重复 |
| 409 | `USER_USERNAME_ALREADY_REGISTERED` | 用户名重复 |
| 409 | `USER_REGISTRATION_CONFLICT` | 并发注册触发唯一约束冲突 |
| 429 | `AUTH_CODE_ATTEMPTS_EXCEEDED` | 当前验证码错误尝试达到上限 |
| 503 | `AUTH_CODE_SERVICE_UNAVAILABLE` | 验证码校验服务暂不可用 |

### 4.2 使用邮箱验证码设置新密码

`POST /auth/password-reset`，无需登录或角色授权，须提供绑定邮箱的密码重置验证码。请求应省略 `Authorization`，重置不会自动登录。

| 参数 | 类型 | 必填 | 默认规则 |
| --- | --- | --- | --- |
| `email` | string | 是 | 非空、有效校园邮箱；规范化后与申请验证码的绑定邮箱一致 |
| `verificationCode` | string | 是 | 严格6位ASCII数字，保留前导零；仅接受密码重置用途 |
| `newPassword` | string | 是 | 与注册密码规则一致：至少8个 Unicode 字符，UTF-8最多72字节，至少包含文字和数字，禁止控制字符；不执行 trim |

```json
{
  "email": "student@std.uestc.edu.cn",
  "verificationCode": "012345",
  "newPassword": "NewExamplePassword2026"
}
```

成功返回 HTTP 200，设置 `Cache-Control: no-store`，响应示例：

```json
{
  "success": true,
  "code": "OK",
  "message": "请求成功",
  "data": null,
  "timestamp": "2026-10-28T02:00:00Z"
}
```

重要副作用与失败处理：

- 先检查邮箱和密码规则，再原子消费验证码；错误、过期、已消费或注册用途的验证码不能改密。成功消费后不可重放，并发使用同一验证码只能成功一次。
- 只有邮箱已验证且状态为 `ACTIVE` 的已有账号能够重置。账号不存在、停用、锁定、删除或邮箱未验证时，统一返回 `AUTH_CODE_INVALID_OR_EXPIRED`，不恢复账号或公开具体状态。
- 规范化后的邮箱必须精确等于账号绑定邮箱，不能利用MySQL重音不敏感比较规则，用另一个相似邮箱的验证码修改该账号。
- 密码哈希、凭证版本和行版本在同一条SQL中更新。数据库提交后，所有重置前签发的登录凭证都会在后续认证时被拒绝；已通过认证的在途请求不会被追溯取消。
- Redis中旧会话记录保留至原有效期自然清理，但不能继续通过最新凭证版本校验。无需逐个删除会话，也不增加数据库迁移。
- 不修改邮箱、角色或账号状态，不自动清除登录失败锁定。重置后需用新密码重新登录；仍处于临时登录锁定期时须等待锁定结束。
- 输入策略校验失败不消费验证码。验证码消费后的数据库故障或并发冲突不恢复验证码，须重新申请，并遵循已有发送冷却与配额。
- 数据库更新核对读取时的邮箱、行版本、凭证版本及可用状态，拒绝覆盖计算密码哈希期间发生的账号变化。

主要失败响应均采用1.1的统一格式，`data: null`，DTO校验错误除外：

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `COMMON_VALIDATION_FAILED` | 必填、邮箱格式或6位验证码格式不符，`data`包含字段错误 |
| 400 | `USER_CAMPUS_EMAIL_REQUIRED` | 非允许校园邮箱 |
| 400 | `USER_PASSWORD_WEAK` | 新密码不符合注册时的密码规则 |
| 400 | `AUTH_CODE_INVALID_OR_EXPIRED` | 验证码错误、过期、已消费、用途不符，或账号不可用 |
| 429 | `AUTH_CODE_ATTEMPTS_EXCEEDED` | 验证码错误尝试达到上限 |
| 409 | `USER_PASSWORD_RESET_CONFLICT` | 消费验证码后账号发生并发变化，需重新申请验证码 |
| 503 | `AUTH_CODE_SERVICE_UNAVAILABLE` | Redis验证码服务暂不可用，密码未修改 |
| 503 | `USER_PASSWORD_RESET_UNAVAILABLE` | 验证码已消费后的账号读取或更新故障，需重新申请验证码 |
| 401 | `AUTH_UNAUTHENTICATED` | 主动携带的Bearer令牌无效或已撤销，应省略认证头 |

事务提交阶段等未被专门映射的基础设施错误仍可能返回500通用错误；失败不等于重置成功，也不保证验证码仍可用。

## 5. 用户名密码登录

`POST /auth/login`，无需认证。

| 参数 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `username` | string | 是 | 非空，DTO原始输入最多64个Java UTF-16代码单元，Service去除首尾空白后查询；实际注册用户名规则见第4节 |
| `password` | string | 是 | 非空，DTO最多72个Java UTF-16代码单元；Service另行限制UTF-8最多72字节，原样校验，不执行 trim |

```json
{
  "username": "ginkgo_user",
  "password": "ExamplePassword2026"
}
```

登录使用用户名，不接受邮箱替代用户名。登录不会重新要求密码符合注册时的全部强度规则，而是与已保存的 BCrypt 哈希匹配。

成功返回 HTTP 200：

```json
{
  "success": true,
  "code": "OK",
  "message": "请求成功",
  "data": {
    "accessToken": "<accessToken>",
    "tokenType": "Bearer",
    "expiresAt": "2026-11-03T12:00:00Z",
    "user": {
      "id": 42,
      "username": "ginkgo_user",
      "roles": ["ROLE_USER"]
    }
  },
  "timestamp": "2026-10-27T12:00:00Z"
}
```

| 响应字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.accessToken` | string | RS256签名的 JWT，后续作为 Bearer 发送 |
| `data.tokenType` | string | 固定 `Bearer` |
| `data.expiresAt` | string | 本次登录截止时间；默认有效期7天，可配置 |
| `data.user.id` | integer（64位） | 用户ID；JavaScript 调用方需注意超过安全整数范围时的精度问题，当前协议以JSON数字返回 |
| `data.user.username` | string | 数据库保存的用户名 |
| `data.user.roles` | string[] | 当前角色编码，例如 `ROLE_USER`、`ROLE_ADMIN`；客户端展示不替代服务端授权 |

每次成功登录创建独立会话，允许多个会话同时存在。默认15分钟内累计失败5次锁定15分钟；同一账号的大小写或重音别名共享限制。成功登录清除失败计数。当前没有刷新令牌，过期后重新登录，也不会因访问接口而自动延长有效期。

主要失败：

| HTTP | 错误码 | 含义 |
| --- | --- | --- |
| 400 | `COMMON_VALIDATION_FAILED` | 必填或DTO长度校验失败 |
| 401 | `AUTH_INVALID_CREDENTIALS` | 账号不存在、密码不匹配、邮箱未验证、账号不可用，或密码超过UTF-8字节限制；不区分具体原因 |
| 429 | `AUTH_LOGIN_LOCKED` | 达到错误阈值，或账号仍被临时锁定 |
| 503 | `AUTH_SERVICE_UNAVAILABLE` | 数据库、Redis限流或会话写入暂不可用 |

## 6. 查询当前用户

`GET /auth/me`，必须提供 Bearer 令牌，无请求体。

```http
GET /auth/me HTTP/1.1
Authorization: Bearer <accessToken>
Accept: application/json
```

成功返回 HTTP 200：

```json
{
  "success": true,
  "code": "OK",
  "message": "请求成功",
  "data": {
    "id": 42,
    "username": "ginkgo_user",
    "roles": ["ROLE_USER"]
  },
  "timestamp": "2026-10-27T12:00:00Z"
}
```

数据字段与登录响应中的 `user` 相同。页面刷新后应通过本接口确认身份，不能仅凭本地存在令牌就认为已经登录。

主要失败：401 `AUTH_UNAUTHENTICATED`（缺少、无效或过期令牌，会话失效或账号状态/版本不符）；503 `AUTH_SERVICE_UNAVAILABLE`（认证依赖故障）。如果账号在安全过滤器校验通过后、Controller查询前发生状态或版本变化，也可能返回401 `AUTH_INVALID_CREDENTIALS`。

## 7. 退出当前会话

`POST /auth/logout`，必须提供 Bearer 令牌，无请求体。

```http
POST /auth/logout HTTP/1.1
Authorization: Bearer <accessToken>
Accept: application/json
```

成功返回 HTTP 200、统一成功响应、`data: null`。服务端删除当前 JWT 对应的 Redis 会话，同一令牌在后续请求中立即失效；其他独立登录会话不受影响。

- 返回200后，客户端清除对应本地凭证和用户展示状态。
- 返回401 `AUTH_UNAUTHENTICATED` 表示凭证已不可使用，可清理对应本地状态。
- 返回503 `AUTH_SERVICE_UNAVAILABLE` 不表示服务端已完成退出，应提示失败并保留重试能力。
- Redis删除操作本身幂等，但HTTP接口先经过认证：已成功退出后再次携带同一令牌调用，会返回401，而非第二个200。
- 复制同一个令牌的标签页属于同一个会话；在其中一个标签页退出后，其他持有该令牌的页面也无法继续访问受保护接口。

## 8. 状态与健康检查

### 8.1 应用公开状态

`GET /api/public/status`，无需认证。

成功返回 HTTP 200：

```json
{
  "success": true,
  "code": "OK",
  "message": "请求成功",
  "data": {
    "application": "ginkgo-food-map-v2",
    "architecture": "modular-monolith"
  },
  "timestamp": "2026-10-27T12:00:00Z"
}
```

该接口只确认应用能够处理请求，不检查数据库、Redis或SMTP健康状态。

### 8.2 后端健康检查

`GET /actuator/health`，无需认证，使用 Spring Boot Actuator 响应，**不使用 `ApiResponse` 包装**。

健康时返回 HTTP 200：

```json
{ "status": "UP" }
```

健康状态为 `DOWN` 或 `OUT_OF_SERVICE` 时通常返回 HTTP 503；当前配置隐藏组件细节。它与“HTTP应用仍能响应”是两个不同概念，状态取决于实际启用的健康组件及其连接情况。

当前 Vite 和生产 Nginx未代理 `/actuator/`，应直连后端或使用部署环境单独配置的探针地址。生产 Nginx另有 `GET /nginx-health`，返回 `200`、`text/plain` 的 `ok` 加换行，仅检查Nginx本身；它不是后端接口，也不检查后端或数据库。Actuator还暴露 `/actuator/info`，但它不在匿名白名单中，需通过Bearer认证，使用Actuator原生格式，默认可能为空对象。

### 8.3 部署版本标识

服务器站点的 `GET /version.txt` 无需认证，无参数，成功返回 HTTP 200、纯文本40位 Git 提交号及换行，并设置 `Cache-Control: no-store`。由发布流水线生成并交给 Nginx 托管，不使用业务 JSON 包装，没有业务副作用。首次发布前站点返回503；文件缺失且站点已有版本时返回404。此资源不由后端或本地 Vite 提供，不能代替后端健康检查。

宿主机部署使用 [deploy/nginx.conf](../deploy/nginx.conf)，没有单独的 `/nginx-health` 探针；上节的该探针仅适用于前端 Docker 镜像。完整部署与排查说明见[自动部署文档](deployment.md)。

## 9. 错误码索引

各接口的常见错误见对应章节；以下索引汇总当前枚举及安全处理器已定义的错误码，不表示每个接口都会返回全部错误。未预期的业务基础设施异常仍可能被兜底映射为500，请始终兼容通用错误。

| HTTP | 错误码 | 说明 |
| --- | --- | --- |
| 400 | `COMMON_VALIDATION_FAILED` | DTO参数校验失败，`data`含字段错误 |
| 400 | `COMMON_MALFORMED_REQUEST` | 请求JSON缺失、语法错误或无法读取 |
| 405 | `COMMON_METHOD_NOT_ALLOWED` | 通过认证边界后，请求方法与Controller不匹配 |
| 409 | `COMMON_DATA_CONFLICT` | 数据库约束等状态冲突 |
| 500 | `COMMON_INTERNAL_SERVER_ERROR` | 未被专门映射的内部错误 |
| 400 | `USER_CAMPUS_EMAIL_REQUIRED` | 校园邮箱域名不允许 |
| 409 | `USER_EMAIL_ALREADY_REGISTERED` | 邮箱已经注册 |
| 409 | `USER_USERNAME_ALREADY_REGISTERED` | 用户名已经使用 |
| 400 | `USER_USERNAME_INVALID` | 用户名不符合规则 |
| 400 | `USER_PASSWORD_WEAK` | 注册或重置的新密码不符合规则 |
| 409 | `USER_REGISTRATION_CONFLICT` | 并发注册唯一约束冲突 |
| 409 | `USER_PASSWORD_RESET_CONFLICT` | 改密时账号状态或版本发生并发变化 |
| 503 | `USER_PASSWORD_RESET_UNAVAILABLE` | 验证码已消费后的账号读取或密码更新故障 |
| 429 | `AUTH_CODE_RESEND_COOLDOWN` | 邮箱重发冷却中 |
| 429 | `AUTH_CODE_EMAIL_RATE_LIMITED` | 邮箱发送次数超限 |
| 400 | `AUTH_CODE_INVALID_OR_EXPIRED` | 验证码错误或已失效 |
| 429 | `AUTH_CODE_ATTEMPTS_EXCEEDED` | 验证码错误尝试超限 |
| 503 | `AUTH_CODE_DELIVERY_STATE_EXPIRED` | 验证码投递状态已失效 |
| 503 | `AUTH_CODE_MAIL_DELIVERY_FAILED` | 邮件发送失败 |
| 503 | `AUTH_CODE_SERVICE_UNAVAILABLE` | 验证码Redis服务暂不可用 |
| 401 | `AUTH_INVALID_CREDENTIALS` | 登录失败或身份状态已变化 |
| 429 | `AUTH_LOGIN_LOCKED` | 密码登录被临时锁定 |
| 503 | `AUTH_SERVICE_UNAVAILABLE` | 登录、身份验证或会话服务暂不可用 |
| 401 | `AUTH_UNAUTHENTICATED` | 安全过滤器拒绝缺失或失效身份 |
| 403 | `AUTH_FORBIDDEN` | 没有执行操作的权限 |

当前限流错误不提供剩余次数、精确解锁时间或 `Retry-After`，客户端不要假设这些字段或标头存在。

## 10. PowerShell联调示例

以下步骤使用已经注册的账号。命令会实际登录、查询身份和撤销该次会话，不涉及发邮件或创建账号。

```powershell
$apiBase = 'http://localhost:8080'
$credential = Get-Credential -Message '请输入已注册的用户名和密码' -ErrorAction Stop
$loginBody = @{
    username = $credential.UserName
    password = $credential.GetNetworkCredential().Password
} | ConvertTo-Json

$loginResult = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/login" `
    -ContentType 'application/json; charset=utf-8' `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($loginBody)) -ErrorAction Stop
$loginBody = $null
$credential = $null
$authHeaders = @{ Authorization = "Bearer $($loginResult.data.accessToken)" }

$currentUser = Invoke-RestMethod -Method Get -Uri "$apiBase/auth/me" -Headers $authHeaders -ErrorAction Stop
$currentUser.data

$logoutResult = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/logout" -Headers $authHeaders -ErrorAction Stop
$logoutResult.success
$authHeaders = $null
$loginResult = $null
```

示例只输出公开用户信息和退出结果，不打印令牌或密码。调用失败时依据实际HTTP状态和响应错误码处理，不要把失败请求当成成功继续执行。

## 11. 尚未实现与维护要求

尚未提供刷新令牌、列出设备、退出其他会话、餐厅和评价等业务接口。密码重置提交接口及前端找回密码页面已实现，尚未合并发布和完成真实邮件验收。不要将计划中的路径作为现有API调用。

每次新增、修改或删除接口时同步更新本文，包括HTTP方法、路径、认证/角色要求、参数及默认规则、响应示例、状态码、错误码和重要副作用。接口行为以Controller、DTO、Service、安全配置及当前部署配置共同决定，不能只从Controller注解推断。

主要核对来源：

- [登录Controller](../backend/src/main/java/com/ginkgo/foodmap/security/controller/LoginController.java)、[登录Service](../backend/src/main/java/com/ginkgo/foodmap/security/service/LoginService.java)。
- [注册Controller](../backend/src/main/java/com/ginkgo/foodmap/user/controller/AuthController.java)、[验证码Controller](../backend/src/main/java/com/ginkgo/foodmap/user/controller/AuthEmailCodeController.java)。
- [密码重置Controller](../backend/src/main/java/com/ginkgo/foodmap/user/controller/PasswordResetController.java)、[密码重置Service](../backend/src/main/java/com/ginkgo/foodmap/user/service/PasswordResetService.java)。
- [安全配置](../backend/src/main/java/com/ginkgo/foodmap/security/SecurityConfiguration.java)、[统一响应](../backend/src/main/java/com/ginkgo/foodmap/common/api/ApiResponse.java)。
- [默认配置](../backend/src/main/resources/application.yml)、[功能说明](features.md)、[开发记录](development.md)。
