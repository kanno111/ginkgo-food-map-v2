# 模块化单体架构

## 当前决策

V2 第一阶段使用模块化单体，而不是立即部署多个微服务。

原因：当前服务器只有 2 核 CPU 和 2 GB 内存。一个 Spring Boot 进程加 MySQL 与轻量 Redis 能承载求职展示和社团低并发访问，同时仍可通过清晰的业务边界为未来拆分微服务做准备。

## 模块

| 模块 | 职责 | 拥有的数据 |
| --- | --- | --- |
| user | 用户、身份、角色 | 用户、角色、用户角色关系 |
| restaurant | 餐厅档案、分类、位置 | 餐厅、分类、标签 |
| review | 评价、评分、回复 | 评价、维度评分、回复 |
| admin | 审核、回收站、管理操作 | 管理操作记录 |
| file | 图片元数据和对象存储适配 | 文件元数据 |
| security | 认证、授权、安全上下文 | 登录令牌或会话 |
| common | 通用错误和技术基础设施 | 不拥有业务数据 |

## 依赖规则

```text
user       restaurant
  \           /
   \         /
      review
        |
      admin

security -> user
file     <- restaurant / review
```

图中表示业务协作关系，不代表可以访问对方 Mapper。跨模块协作必须通过公开接口或事件完成。

## 模块内部职责（2026-10-29更新）

service保留业务流程，不能作为所有Spring Bean的容器。模块自己的规则、技术适配和调度分别放置，不转移到全局common。公开服务可以协作，禁止跨模块依赖Mapper/Entity；ArchitectureBoundaryTest自动检查持久化导入与service目录职责。

| 模块 | 本轮调整的文件与职责 |
| --- | --- |
| file | image/JpegImageProcessor、ProcessedImage负责解码重编码；storage/OssStorageClient负责SDK；job/MediaCleanupJob仅调度；service/ImageUploadService、MediaFileService、MediaCleanupService分别组织上传、绑定/读取、取消与回收 |
| file协议/持久化 | ImageUploadController、MediaFileMapper、FileErrorCode调整204/202/409及状态转换；V6__separate_media_upload_state.sql新增UPLOADING约束 |
| review | ReviewPublishPolicy移入policy；ReviewPublishRequest、ReviewWriteService支持有序photoIds和同事务绑定；ReviewPhotoMapper、ReviewPhotoService、ReviewPhotoController提供正式图片读取 |
| restaurant | RestaurantIdentifiers移入support；RestaurantReadService、RestaurantWriteService更新引用；读取服务增加只读可见性公开方法 |
| security | SecurityConfiguration移入config并精确放开照片GET；SessionJwtAuthenticationConverter移入authentication，业务会话/登录服务保留在service |
| user | UserRegistrationPolicy移入policy；VerificationMailSender在mail封装模板/SMTP及安全错误；VerificationCodeService保留额度、激活和消费业务；EmailCodeService、PasswordResetService、UserRegistrationService更新规则引用 |
| system | SystemStatusController移入controller |
| 前端 | file/api/mediaApi封装上传/取消；review/model/useReviewPhotos管理本地预览、失败重试与晚到结果；reviewApi、review类型、ReviewComposer接有序文件ID |
| 验证 | ArchitectureBoundaryTest、ImageUploadIntegrationTest、JpegImageProcessorTest、OssStorageClientTest及既有迁移/注册/点评测试同步；useReviewPhotos.spec、reviewApi.spec覆盖前端异步与传输 |

图片绑定采用餐厅父锁→媒体ID升序锁；图片展示顺序使用请求数组。点评、关联、媒体BOUND和统计加入同一数据库事务。上传与删除的OSS请求在事务外执行，删除意图先持久化，再立即尝试云端删除，失败保留重试。没有新增消息队列或跨系统事务。

## 部署运行

```text
Browser
   |
 Nginx
   |
Spring Boot modular monolith
   |           |
 MySQL       Redis
```

当前只生成一个 JAR。未来需要拆分时，优先考虑认证、文件和评价模块，但拆分必须由独立扩容、独立发布或团队边界等真实需求驱动。
