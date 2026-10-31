# 当前开发记录

## 2026-10-31：完成本人点评删除的前后端闭环

- 最新及历史点评仅在已认证账号ID等于作者ID时显示删除入口，昵称相同或管理员角色不能代替归属；DELETE /api/reviews/{reviewId}始终由后端从安全上下文取身份并校验。二次确认支持取消/Escape，历史面板关闭后释放滚动锁再确认；失败留在确认框内重试，成功回点评第一页并刷新餐厅统计。
- 事务先锁父店、重读点评，与发评/回复/删店共用锁顺序；删除历史只减条数，删除代表取上一条接替，删除本人最后一条移除人数及贡献。回复/照片关联硬删除，媒体通过file应用服务转为PENDING_DELETE；复用后台回收，OSS请求在事务外，失败保留重试。授权、统计或媒体失败全部回滚，不支持评价恢复或管理员代删。
- 新增V8独立发布/删除回执，回填存量点评。新发布与回执同事务，唯一键封住跨店并发重放窗口；删评只保留作者、UUID、点评/餐厅ID和删除时间，不保留正文照片。回执持续保留、当前无自动过期，账号清理另定策略；旧发布返回409 REVIEW_REQUEST_DELETED，本人重复删评204，不重复扣分。旧回复因原点评不存在返回404，不复活父内容。
- npm run check通过：198项前端测试、类型检查和生产构建通过，ESLint零错误，仅原RestaurantDetail.spec.ts两项可选prop默认值警告。真实MySQL 8.4隔离3321执行完整verify（restaurant.integration/review.integration均开启）：407项中385项执行通过、22项条件跳过，零失败/错误。覆盖匿名/越权、最新/历史/最后一条、统计回退、重复删除、旧请求拒绝、并发发布删除、子资源及媒体状态事务回滚、V7存量回填/重复迁移，以及OSS失败后后台重试成功。初轮迁移测试版本断言仍为V7导致失败，更新到V8并补回填测试后完整复跑通过。
- Edge浏览器1440、390、320px验证本人/同名他人入口、原生确认框焦点/Escape、历史删除转入确认框、失败重试、成功刷新和手机不溢出，零脚本错误。浏览器删除响应由独立测试上下文拦截，业务写入0；真实删除和计分由隔离MySQL接口测试验证，不将浏览器替身称为真实业务库删除验收。云清理用OSS替身验证重试，本轮不删除真实云对象验证。
- 开发后端8080使用本轮验证JAR启动（PID9208），开发库Flyway已从V7升级V8并回填；前端5173已启动。检查发现本地Redis未运行，复用既有D:/Redis_new/...-6379/redis.conf启动，未改配置。保留feat/reviews及原未提交成果，未创建分支、提交、推送或部署。
- 验证证据：D:/eat/.codex-backups/review-delete-backend-verify.log、ginkgo-browser-check/review-delete-check.cjs及artifacts/review-delete/facts.json、confirmation-320.png。git diff --check和文档链接/JSON检查通过。

| 文件（相对仓库根目录） | 本轮用途 |
| --- | --- |
| backend/src/main/java/com/ginkgo/foodmap/review/controller/ReviewDeleteController.java | 本人DELETE入口及204/no-store |
| backend/src/main/java/com/ginkgo/foodmap/review/service/ReviewDeleteService.java | 作者授权、父锁、事务删除及代表回退 |
| backend/src/main/java/com/ginkgo/foodmap/review/mapper/ReviewDeleteMapper.java | 独立请求回执及review自有子资源删除 |
| backend/src/main/java/com/ginkgo/foodmap/review/service/ReviewWriteService.java | 发布登记回执、拒绝删除后重放 |
| backend/src/main/java/com/ginkgo/foodmap/review/exception/ReviewErrorCode.java | 删评404/403、旧发布409及通用重试提示 |
| backend/src/main/resources/db/migration/V8__retain_review_request_receipts.sql | 新增回执表并回填存量 |
| backend/src/main/java/com/ginkgo/foodmap/restaurant/dto/RestaurantReviewDelta.java | 条数增量支持发布+1、删除-1 |
| backend/src/main/java/com/ginkgo/foodmap/restaurant/mapper/RestaurantReviewStatisticsMapper.java | 同一SQL更新正负累计值 |
| backend/src/main/java/com/ginkgo/foodmap/file/service/MediaFileService.java | 跨模块公开媒体释放入口 |
| backend/src/main/java/com/ginkgo/foodmap/file/mapper/MediaFileMapper.java | BOUND转可重试PENDING_DELETE |
| backend/src/test/java/com/ginkgo/foodmap/review/ReviewWriteApiIntegrationTest.java | 权限、代表回退、回滚、重放及并发删除 |
| backend/src/test/java/com/ginkgo/foodmap/review/ReviewSchemaIntegrationTest.java | V8升级、回填及重复迁移 |
| backend/src/test/java/com/ginkgo/foodmap/restaurant/RestaurantSchemaIntegrationTest.java | 更新完整迁移链断言 |
| backend/src/test/java/com/ginkgo/foodmap/file/ImageUploadIntegrationTest.java | 带图删评与云失败回收重试 |
| frontend/src/modules/review/api/reviewApi.ts、reviewApi.spec.ts | 真实DELETE适配及固定凭证/失败验证 |
| frontend/src/modules/review/model/review.ts、reviewHistory.spec.ts | 预览权限标记说明及历史作者删除回归 |
| frontend/src/modules/review/review.spec.ts | 本人入口、同名他人拒绝、确认取消及失败重试 |
| frontend/src/modules/review/ui/ReviewEntry.vue、ReviewHistory.vue、ReviewPanel.vue | 最新/历史作者入口、二次确认及分页/统计刷新 |
| docs/api.md、features.md、architecture/review-schema.md、plans/review-backend.md、plans/review-roadmap.md | 同步协议、数据保留策略及完成度 |

## 2026-10-30：补齐更多筛选、人均上限与校区直线距离

- 核对Git历史：8种排序（综合、距离、人均、点评数、味道/性价比/环境/服务）一直存在；旧目录仅有分类、搜索、经营状态及已按用户要求取消的杯型/推荐踩雷，未实现目录价格或距离上限。随机选店预算原来只属于随机流程。本轮恢复“更多筛选”入口，新增真实高级查询能力，不恢复已明确取消的杯型规则，不编造其他条件。
- 列表API新增可选maxPrice（元）与maxDistanceMeters（米），明确类型/边界校验并加入Controller绑定白名单。共用SQL条件在COUNT、排序和LIMIT前应用，保持同一只读事务快照、稳定排序及准确总页数。价格上限含边界且估值参与，未知价格在开启时排除；距离未舍入比较，缺坐标或待定位排除，未启用时未知值仍保留。复用现有字段，无新表、字段、迁移、数据回填或业务写入。
- Haversine表达式从原距离排序抽为同一SQL片段，地球半径6371000米，使用原站index.html:2449的CAMPUS定义（清水河校区GCJ-02纬度30.7544、经度103.9312），不是本轮编造参考点。筛选统一传米，既有distanceKm响应继续返回公里以兼容卡片与客户端。项目目前是单校区固定参考点，没有多校区切换、实时定位授权或步行距离，未重新测绘原站参考位置。
- 前端保留现有分类导航、全部排序及停业按钮，工具栏右侧恢复更多筛选与有效条件数。简洁双分组弹窗提供20/30/50/100元、500/1000/2000/3000米及不限；草稿确认批量写回只触发一次请求，取消不提交，重置只管理两项高级草稿；仅高级条件生成可删除标签。原生dialog与Teleport处理顶层模态、焦点约束、Escape、遮罩及滚动锁，窄屏/横屏滚动内容而保留底部按钮。复用Pinia、分页和请求取消，无新UI框架。随机选店通过已有条件快照自动继承新增约束，原随机和预算逻辑未修改。
- Java21真实MySQL8.4专用回环3321执行`mvn --batch-mode --no-transfer-progress verify -Drestaurant.integration=true -Dreview.integration=true`通过并打包：401项中379项实际通过、22项条件跳过、0失败/错误。餐厅读取67项全部执行通过，比原53项增加14项，验证30与29.99元边界、999/1001米、未知价格/位置、火锅+50元、火锅+2公里+隐藏停业、价格/距离/综合分及跨页全局排序、空集合和非法参数。首轮测试环境误连已占用的旧3319实例导致认证失败，改为新建独立数据目录的3321实例后完整重跑通过；未向开发或生产库写夹具。
- `npm run check`通过：26文件、194项前端测试，ESLint无错误（保留2条既有ReviewHistoryPreview可选prop警告）、vue-tsc与生产构建成功。测试验证真实Axios参数传递、组合条件不覆盖、确认一次查询/第一页、草稿取消/重置/重开、单标签移除与空结果重置。Edge在1440×960、390×844、320×568、844×390实际验收：无横向溢出或脚本错误，按钮和页脚完整可见，未确认不请求，取消焦点恢复，生效数量和标签正确；浏览器仅GET，业务写入0。
- 使用开发接口的全部27家店及独立Haversine函数核对6组查询，按每页2条遍历验证记录集合、无重复和总页数：30元以下17家；1公里内、火锅50元以下、火锅2公里内且隐藏停业、30元且1公里内及极低预算组合均为0家，与实际数据一致。当前25家位置待补，另外2家不在所测距离范围内；当前无未知价格，但未知值排除已在独立MySQL夹具验证。距离筛选要获得更多结果仍依赖真实位置补录，不通过模拟坐标制造命中。
- 同步接口、功能、需求与找店方案；`git diff --check`及文档60个本地链接、25个JSON示例检查通过。证据位于仓库外advanced-filter-backend-verify.log、advanced-filter-frontend-check.log、advanced-filter-browser.log与ginkgo-browser-check/artifacts/advanced-filter/。新版后端使用验证后JAR副本重启到8080（PID20016），前端5173热更新，开发库仍V7且无新增迁移。测试实例已清理并关闭；保留feat/reviews与原有未提交成果，未新建分支、提交、推送或部署。

## 2026-10-30：首页筛选入口去重与轻量操作栏

- 按用户明确的UI/UX范围收紧筛选系统：分类只保留顶部横向导航和橙色下划线；综合、距离、人均、点评数及四维共8种既有排序整合为一个分组单选框；经营状态改为“隐藏停业餐厅”即时开关，不声称提供实时营业状态。
- 当前目录只有关键词、分类、排序和停业标记，无独立高级条件，因此删除双栏筛选弹窗、重复入口及已选标签，不保留空置的“更多筛选”。空结果只有存在可清除条件时才显示重置按钮。原生select承担分组、键盘导航、选中回显、选择关闭及Escape取消，不额外维护草稿或焦点锁。
- 复用现有Pinia状态、查询watch、请求取消和分页机制；分类切换不重置排序及停业条件，选择相同排序不重复查询。原目录没有URL筛选同步，本轮不新增；详情后退继续保留目录条件。搜索、卡片、主导航、底部导航及随机选店业务保持既有实现；后端、API协议和数据库没有新增变更，保留工作区此前成果。
- `npm run check`通过：26个测试文件、192项测试通过，类型检查及生产构建成功；ESLint为0错误、2条既有ReviewHistoryPreview可选prop警告。目录行为测试替换已删除弹窗的草稿断言，覆盖全部排序、相同值不重查、分类/停业组合保留、第一页重置、单次请求及无条件空结果不显示重置。
- Edge真实开发接口在1440×960、390×844、320×568验收通过：分类横滑、统一排序、停业双向切换、组合条件、第二页切换条件回第一页、详情后退保留状态、下拉Escape关闭/焦点及零额外请求；页面无横向溢出、脚本错误，两个操作控件高度均44px。筛选组件含搜索区域实测高160px，较旧版默认状态184px缩减24px，应用条件后不再新增标签行。仅GET读取，无业务写入。
- 证据位于仓库外`D:/eat/.codex-backups/filter-simplify-check.log`、`filter-simplify-browser.log`及`ginkgo-browser-check/artifacts/filter-simplify/`。功能说明、需求和找店方案已同步；文档60个本地链接、25个JSON示例与`git diff --check`通过。前端5173热更新、后端8080继续运行；未新建分支、提交、推送或部署。高级弹窗的确认/取消/重置不再适用，未来有真实额外条件时再实现，不以空弹窗充数。

## 2026-10-30：移除前端杯型并接通滚动筛选与真实统计

- 按用户明确要求取消餐厅杯型评级、杯型筛选、相关说明表和按杯型定义的推荐/踩雷入口；删除CupBadge组件及前端分档/类型/状态/导出，保留原版社团封面与页头品牌图标。四维等权均分与独立推荐率不变，贝叶斯排序继续仅为后续设计。后端tiers/view/tier保留为兼容契约，新前端不发送、不读取，不在本轮破坏已有HTTP契约或修改迁移。
- 正式首页采用截图确认的交互：快捷分类及条件横向滚动，右侧固定筛选入口；模态面板按分类、常用排序、单项排序及经营状态分组，左右滚动独立、滚动同步高亮、底部按钮固定。确认前只编辑草稿，重置不提前查询，取消丢弃草稿，确认批量写入条件并由现有store发一次查询；原生dialog与Teleport处理焦点、背景inert及首页clip-path，关闭/卸载释放滚动锁，窗口变化重新定位，手机按钮保持在视口内，点击目标至少44px。
- 卡片与详情使用餐厅接口的均分、participantCount和reviewCount，不按图片请求或点评当前页推算评分人数。真实0分正常显示，无人时显示暂无评分。发布成功回执关闭后分别刷新点评第一页与统计，刷新不卸载讨论面板；统计失败保留上次值并提供只读重试，切店及卸载取消并拒绝晚到结果，返回目录时重新读取权威排序。
- npm run check通过：ESLint、183项前端测试、vue-tsc与生产构建。测试数变化包含删除已废弃的杯型分档/徽章/推荐踩雷共22项旧规则断言，新增4项筛选及统计生命周期用例；原品牌素材、认证、回复、图片、分页与发布测试继续通过。jsdom测试显式模拟原生dialog方法，实际模态行为由Edge另验，不把桩当浏览器验收。
- Edge真实读取1440×960、390×844、320×768：无横向溢出或脚本错误；筛选草稿不发请求、确认组合分类与性价比、取消/焦点恢复、滚动高亮及清空通过。手机快捷栏确有横向溢出供滑动，面板确定按钮均在视口内。公开目录请求未携带tiers/view；餐厅20真实返回3人、16条点评、综合约7.1667，页面正确展示人数/条数。详情与评分说明无杯型和待接入文案。浏览器仅GET，业务写入0；发布后刷新由组件事件及受控响应测试，真实持久化发布与跨设备正向验收仍待用户。
- 已将此前verify通过的统计读取JAR复制到仓库外score-filter-dev-start并重启后端8080（PID30476），健康UP；前端5173原Vite进程PID14696热更新。开发库仍V7，无新迁移、未写模拟业务数据、未访问生产。快速切页时照片流因客户端断开出现一次AsyncRequestNotUsableException及图片Content-Type下错误响应转换日志，浏览器无脚本错误；该图片异常处理不在本轮前端改动范围，不记作已修复。
- 证据：D:/eat/.codex-backups/frontend-filter-complete.log、frontend-filter-browser-final.log及ginkgo-browser-check/artifacts/filter-ui/的截图和facts.json。同步需求、功能、接口、结构及两份评价计划和找店方案；保留原feat/reviews分支与之前未提交的后端成果，未新建分支、提交、推送或部署。当前修改文件与用途如下（相对仓库根目录），上述后端统计步骤的文件清单仍见下一节。

| 文件 | 本轮用途 |
| --- | --- |
| frontend/src/app/router/index.ts | 移除杯型导出或更新评分说明路由标题 |
| frontend/src/modules/restaurant/api/restaurant.test-data.ts | 补齐真实契约的评分人数夹具 |
| frontend/src/modules/restaurant/api/restaurantApi.spec.ts | 验证人数映射与不再发送杯型/推荐踩雷参数 |
| frontend/src/modules/restaurant/api/restaurantApi.ts | 映射participantCount并显式发送当前有效查询参数 |
| frontend/src/modules/restaurant/index.ts | 移除杯型导出或更新评分说明路由标题 |
| frontend/src/modules/restaurant/model/catalog.logic.spec.ts | 移除废弃杯型规则用例，保留搜索排序与未知值验证 |
| frontend/src/modules/restaurant/model/catalog.logic.ts | 删除杯型分档与相关筛选，保留四维/价格/距离规则 |
| frontend/src/modules/restaurant/model/catalog.preview.ts | 预览空评分补零人数，不引入虚构评价 |
| frontend/src/modules/restaurant/model/catalog.store.ts | 删除杯型和推荐/踩雷状态，保留分页、取消及失效机制 |
| frontend/src/modules/restaurant/model/restaurant.types.ts | 删除杯型/视图类型，增加评分人数 |
| frontend/src/modules/restaurant/ui/RandomRestaurant.vue | 去除杯型条件与文案，沿用现行目录条件 |
| frontend/src/modules/restaurant/ui/RestaurantCard.vue | 删除杯型，展示真实均分、有效人数与总条数 |
| frontend/src/modules/restaurant/ui/RestaurantCatalog.spec.ts | 验证确认前不查询、取消/重置草稿、确认一次查询与焦点恢复 |
| frontend/src/modules/restaurant/ui/RestaurantCatalog.vue | 目录组合新筛选组件，删除分散条件和杯型空态 |
| frontend/src/modules/restaurant/ui/RestaurantDetail.spec.ts | 验证真实0分、人数/条数、统计刷新故障与切店晚到响应 |
| frontend/src/modules/restaurant/ui/RestaurantDetail.vue | 接通统计与发布后独立刷新、失败重试及切店取消 |
| frontend/src/modules/review/ui/ReviewComposer.vue | 去除单条杯型及旧查询条件，保留四维与发布机制 |
| frontend/src/pages/home/HomePage.vue | 更新评分说明入口文案，保留原品牌封面 |
| frontend/src/pages/home/brand-parity.spec.ts | 移除废弃杯型断言，继续保护原封面和社团文案 |
| frontend/src/pages/scoring/ScoringGuidePage.vue | 删除杯型说明表，解释最新计分、人数及真实0分 |
| frontend/src/shared/ui/layout/AppHeader.vue | 说明保留的是品牌杯子图标，不是业务评级 |
| frontend/src/modules/restaurant/ui/RestaurantFilters.vue | 统一滑动筛选、独立草稿、模态焦点、双栏滚动与固定确认按钮 |
| frontend/src/modules/restaurant/ui/CupBadge.vue（删除） | 删除业务杯型组件及其视觉标语 |
| docs/requirements.md、docs/features.md、docs/api.md | 取消杯型产品规则，更新当前交互、统计展示和后端兼容边界 |
| docs/architecture/review-schema.md、docs/plans/review-backend.md、docs/plans/review-roadmap.md、docs/plans/discovery-ui.md | 同步已完成与待办，取消原杯型榜要求 |
| docs/development.md | 记录本轮实现、验证、运行状态与限制 |

## 2026-10-30：确认初版均分规则并接通餐厅统计后端（第1、2步）

- 按用户授权完成规则确认与统计读取，在原feat/reviews分支修改，未新建分支。初版所有正常用户等权，每账号每店只取最新有效点评；四维分别平均，综合分继续平均已按HALF_UP保留两位的单条总分。明确评分人数与含历史的点评条数、无人评分与真实0分、展示舍入与原始杯型的区别。记录推荐排序公式W=(nR+mC)/(n+m)，仅为后续设计，参数及适用入口未定，不用于本轮展示或杯型。
- 列表、详情及管理回执关联restaurant自己的统计读模型，返回participantCount、reviewCount、综合分、四维、独立推荐率及杯型，不跨模块关联reviews。均分先扩展十进制精度再除法，杯型直接比较累计值与人数乘阈值；真实0分保留，无人时返回null/none。COUNT、筛选、结果及标签在同一REPEATABLE_READ只读快照；评分/四维/总条数排序及杯型/推荐/踩雷筛选在LIMIT前执行，同值沿用名称/ID顺序。推荐视图继续指大杯及以上，与独立推荐率无关。
- 无新表、新迁移或业务数据补写。保留首次发评事务内的惰性初始化，LEFT JOIN兼容新店及旧版本缺失零行，公开GET不补写。选择该方式可以复用已有发布事务，也避免为零行引入另一条写入路径；运行时重建、删除回退及异常治理不在本轮实施。
- 真实MySQL8.4.0独立回环3319实例验证，Java21执行`mvn --batch-mode --no-transfer-progress verify '-Drestaurant.integration=true' '-Dreview.integration=true'`成功并打包JAR：387项中365项实际通过、0失败/错误、22项条件跳过；不能记为387项全部执行。餐厅读取53项全部通过，其中新增20项覆盖统计映射、空/零、全部杯型临界值、真实全局排序/分页、视图交集、大人数下高精度差异及并发快照；原发布测试增加3条/2人/7.50分/50%推荐的真实公开读取与管理回执断言，原发布幂等、并发、故障回滚及餐厅维护测试亦执行通过。首轮发现管理Mapper复用SQL时嵌套片段按错误命名空间解析，修正全限定引用后完整重跑通过。
- 仓库外只读审计器显式限制127.0.0.1/localhost:3306的ginkgo_food_map开发库，使用服务器只读事务和一致快照，从全部点评按账号时间/ID最新代表重新推导后逐项比对：27家餐厅、34条点评、21份有效用户贡献，统计差异0家；1家无点评餐厅缺零统计行，已由只读兼容覆盖，无需修复数据。开发模拟数据不进入生产。当前小数据EXPLAIN显示统计表PRIMARY等值连接，目录排序仍有temporary/filesort；没有大库压测或吞吐提升结论。
- 验证日志为仓库外`D:/eat/.codex-backups/score-read-verify-final.log`和`score-statistics-audit.log`，审计器为`ScoreStatisticsAudit.java`。修改文档的60个本地文件链接及25个JSON示例检查通过，`git diff --check`通过；确认独立实例残留ginkgo测试库为0后关闭本轮MySQL3319。前端未修改，未重跑前端构建/浏览器验收，未重启前后端；运行中的服务尚未加载本轮后端。未提交、推送、合并或部署。后续先接详情统计区/人数/发布后刷新，再统一首页展示并联调。

本轮修改文件及用途（路径相对仓库根目录）：

| 文件 | 用途 |
| --- | --- |
| backend/src/main/java/com/ginkgo/foodmap/restaurant/dto/RestaurantListQuery.java | 移除所有餐厅均待评级的旧派生条件 |
| backend/src/main/java/com/ginkgo/foodmap/restaurant/entity/RestaurantEntity.java | 增加本模块统计投影，不作为接口对象 |
| backend/src/main/java/com/ginkgo/foodmap/restaurant/mapper/RestaurantCatalogMapper.java | 更新统计读取职责说明 |
| backend/src/main/java/com/ginkgo/foodmap/restaurant/service/RestaurantReadService.java | 映射真实统计、人数与条数到公开白名单 |
| backend/src/main/java/com/ginkgo/foodmap/restaurant/vo/RestaurantVo.java | 增加公开participantCount并说明空值语义 |
| backend/src/main/resources/mapper/restaurant/RestaurantCatalogMapper.xml | 共享统计连接、精确杯型、真实筛选和全局排序 |
| backend/src/main/resources/mapper/restaurant/RestaurantWriteMapper.xml | 管理回执复用相同统计投影，防止保存资料后分数空态 |
| backend/src/test/java/com/ginkgo/foodmap/restaurant/RestaurantReadApiIntegrationTest.java | 新增真实MySQL统计读取、边界、分页及并发快照验证 |
| backend/src/test/java/com/ginkgo/foodmap/review/ReviewWriteApiIntegrationTest.java | 验证真实发布后公开统计及授权管理读取一致 |
| docs/requirements.md、docs/api.md、docs/features.md | 固定产品规则、更新接口字段与当前可用范围 |
| docs/architecture/review-schema.md、docs/plans/review-backend.md、docs/plans/review-roadmap.md | 同步读模型选择与后端完成/前端待办边界 |
| docs/development.md | 记录本轮实现、取舍、验证及未完成内容 |

## 2026-10-30：整理一次本地提交

- 按用户要求，在现有feat/review-replies分支将累计开发成果整理为一次本地提交：点评发布与最新代表计分、最多五图上传/绑定/访问/回收、作者分组与历史分页、单层回复及简化交互、首页目录展示、模块职责调整、测试与文档归档。上述功能存在依赖，不单独提交回复组件而遗漏其读取、上传和公开作者服务。
- 提交依据为此前完成的前端201项测试、ESLint、TypeScript及生产构建，以及后端verify打包成功（299项中226通过、73项显式条件跳过）；真实数据库回复测试15项全部执行通过。浏览器桌面/手机检查和模拟提交证据见前述记录，真实持久化发送及跨设备验收不因此补记为完成。本轮未改业务实现，无需重复相同构建测试。
- 核对待纳入版本控制的文件未匹配当前本地配置及环境中的敏感值，无大体积构建产物；本地配置、密钥目录、node_modules、target和dist继续被忽略。只做本地提交，不新建分支、不合并、不推送或部署。

## 2026-10-30：简化点评操作与历史面板

- 用户指出三个折叠框层级混乱，调研后确认按“正文直接展示、一行操作、按需编辑”修改。在原feat/review-replies分支完成，没有新建分支。移除每卡“评价依据”、常驻黄色回复容器、排序说明及刷新按钮，主卡只保留“回复 / 查看回复 / 历史点评”操作；接口没有回复总数，不伪造数量。
- 回复阅读和编辑独立，点击回复才显示编辑器，同一列表和历史面板共享编辑焦点，只显示一个编辑框。取消或切换保留草稿及失败UUID；账号变化清空。回车发送、Shift+回车换行，输入法候选字确认不发送；成功后关闭自己的编辑框、只刷新当前回复区，保留主列表位置。失败重试及已发送但刷新失败提示继续保留。
- 历史点评通过原生dialog展示，桌面560px右侧面板、640px及以下为88dvh底部面板；Teleport到body，原生模态焦点约束配合背景滚动锁。关闭、Escape和卸载均取消读取并恢复滚动，焦点回原入口；保留已读历史及回复草稿。隐藏面板内的回复读取也取消；历史照片仍由原大图对话框显示，关闭大图后回历史面板。
- 修改文件及用途：frontend/src/modules/review/ui/ReplyThread.vue重构轻量操作、阅读和编辑；ReviewHistory.vue改为可访问的响应式历史面板；ReviewEntry.vue移除依据区并把历史入口接入操作行；ReviewPanel.vue提供共享编辑焦点并移除重复底部说明。新增model/replyEditor.ts定义编辑焦点和历史可见性的注入协议；更新model/replyThread.spec.ts与reviewHistory.spec.ts验证切换草稿、只开一个编辑框、隐藏读取取消、历史缓存/分页、焦点与滚动恢复。同步features、api、requirements、discovery-ui、review-roadmap及本日志。
- npm run check通过：ESLint、201项前端测试、TypeScript及生产构建；最后仅调整编辑框焦点样式后再次build通过。git diff --check通过。后端接口和数据库未修改，本轮未重复运行后端测试。
- Edge真实检查1440/390/320px：主卡零details、默认隐藏编辑器，操作行排布正常；桌面右侧/手机底部面板边界和宽度正确，无横向溢出。真实回复GET三次成功，历史5+1分页和重开缓存、照片大图、Escape/关闭后的入口焦点与原滚动位置验证通过。独立浏览器模拟账号及两次被拦截的POST，验证单编辑框、当前/历史草稿切换与关闭重开保留、同UUID失败重试、成功后刷新失败及只重试读取、HTML纯文本；零真实业务写入、零脚本错误。截图和facts位于D:/eat/.codex-backups/ginkgo-browser-check/artifacts/review-replies-redesign/，脚本为review-replies-redesign.cjs，前端验证日志为D:/eat/.codex-backups/reply-redesign-check.log。
- 前端5173已热更新，后端8080保持健康，http://127.0.0.1:5173/restaurants/20可继续联调。真实持久化发送与跨设备验证仍待用户；未提交、推送、合并或部署。

## 2026-10-30：回复前端接入并重启联调服务

- 回复后端经用户审核通过后，在原feat/review-replies分支接入前端，未新建分支。最新点评和按需加载的历史点评共用ReplyThread；每条点评展开后单独读取10条回复，按服务端游标追加，折叠/卸载取消读取；账号或点评变化清空旧草稿、取消请求并通过代次忽略旧响应。
- 发布固定发起账号凭证及同内容UUID，失败保留文字和编号；正文变更后生成新号。校验回执后才确认发送、清草稿，局部刷新回复第一页，保留外层点评页和历史展开，不触发评分刷新。成功回执与读取失败分别提示，读取重试不重新POST；HTML以插值纯文本显示，1–200码点校验、中文输入法回车保护和发送中防重均保留。长讨论发送后可继续加载更多，未伪造本地已发布记录。
- 修改文件及用途：新增frontend/src/modules/review/ui/ReplyThread.vue管理回复生命周期；ReviewEntry.vue接入新组件并保留独立预览，ReviewHistory.vue开放原点评回复，ReviewPanel.vue更新开放状态提示；model/review.ts定义分页/回执和可选读取能力，api/reviewApi.ts接GET/POST与响应校验；shared/api/httpClient.ts将精确回复GET列为匿名，POST继续认证。新增model/replyThread.spec.ts，更新api/reviewApi.spec.ts和shared/api/httpClient.spec.ts。同步features、api、review-roadmap、review-backend和本日志。
- npm run check通过：ESLint、196项测试、TypeScript及生产构建。新增11项组件生命周期及3项API测试，覆盖按需/游标、失败保留/正文变化换UUID、成功后刷新失败、折叠/换店/换账号晚到响应、Unicode、IME、防重、登录返回和纯文本；拦截器测试验证公开GET匿名、回复POST认证。后端本轮未修改，复用此前完整verify通过且包含ReplyController的JAR。
- 按用户要求重启后端8080和前端5173，后端使用当前已验证JAR副本及既有local配置，前端使用当前源码Vite；后端健康UP、前端HTTP200，通过5173代理真实读取餐厅20的点评34和回复成功。新进程后端PID29236、前端PID14696，日志、PID及JAR副本位于仓库外D:/eat/.codex-backups/ginkgo-food-map-v2/review-replies-dev-start/；未输出或修改本地凭证。
- Edge在1440/390/320px真实检查最新/历史点评回复，六次真实回复GET成功，无横向溢出或脚本错误；游客登录返回正常。登录及发送流程使用浏览器拦截模拟，验证历史点评33的失败后同UUID重试、发送成功但刷新失败的独立提示、仅重试读取、历史保持展开及HTML纯文本；两次POST全部被拦截，零真实业务写入。截图、facts.json和脚本位于D:/eat/.codex-backups/ginkgo-browser-check/artifacts/review-replies/及review-replies-check.cjs；不能将模拟发送记为真实持久化发布。
- 服务保留供用户通过http://127.0.0.1:5173/restaurants/20进行前后端联调；真实持久化发送与跨设备验证仍待用户操作。未提交、推送、合并或部署；删除功能、评分聚合和照片墙待各自后续步骤。

## 2026-10-30：清理本地分支与调整建分支规则

- 按本轮分支整理要求，核对所有本地分支均已被当前HEAD包含后，用git branch -d删除9个多余本地分支，仅保留develop和当前feat/review-replies。没有重写提交历史、删除远端分支或清理未提交的代码。
- AGENTS.md修改协作约定：每次新建分支都必须先说明名称、基线和用途，并取得用户明确同意；不得因进入新功能或新阶段而自动创建分支。
- 验证本地仅剩上述两个分支，未提交文件数量仍为116；AGENTS.md文本差异检查通过。本轮仅调整Git引用和开发约定，不涉及业务代码、接口或数据库，无需重跑构建测试。

## 2026-10-30：单层回复后端

- 从当前feat/home-ui-refresh基线新建feat/review-replies，保留工作区已有未提交改动。本步交付回复POST和公开GET游标分页，正式前端仍关闭回复，下一步再接主卡、历史卡和局部刷新。
- 复用V4的review_replies、账号+UUID唯一键及点评/时间/ID索引，无新迁移。1–200个Unicode码点纯文本，首尾Unicode空白归一；作者取登录上下文，未知字段拒绝。摘要包含规范化正文与点评ID，同请求重放返回原ID，不同内容409。
- 父店锁后再锁点评，与删店互斥；restaurant公开服务抽出仅锁父店的入口，回复不初始化或修改统计、不改点评时间。并发唯一键/锁/查询超时最多三个完整READ_COMMITTED事务，失败先回滚再重试，单次事务超时10秒。代价是同店写入串行，未声称吞吐提升。
- 单层回复绑定具体reviewId，保留旧点评归属。升序(createdAt,id)排他游标带版本和点评归属，核对真实锚点；单段REPEATABLE_READ，公开作者批量补齐，缺失账号保留ID及回退名。新回复时间不早于上一条，避免时钟回拨漏过游标；跨段非固定快照，无推送。未来删除仍需明确幂等键生命周期，当前回复不承诺删除后永久防重。
- 新增ReplyPolicyTest和ReplyApiIntegrationTest，真实MySQL8.4.0在独立回环3319实例及随机库测试，不读取local配置、不写业务库、不请求OSS或邮件；详细验证结果见本节后续记录。
- 本步文件清单（相对backend/src/main/java/com/ginkgo/foodmap）：review/controller/ReplyController.java提供两个HTTP入口；review/dto/ReplyPublishRequest.java与ReplyListQuery.java定义受限输入；review/vo/ReplyPublishVo.java与ReplyPageVo.java定义回执/公开分页；review/entity/ReplyEntity.java隔离持久化投影；review/mapper/ReplyMapper.java负责本模块SQL；review/policy/ReplyPolicy.java负责规范化、摘要和游标；review/exception/ReplyErrorCode.java定义回复错误；review/service/ReplyWriteService.java与ReplyReadService.java负责事务流程。另修改restaurant/service/RestaurantReviewApplicationService.java分离父锁与统计初始化，security/config/SecurityConfiguration.java显式公开GET。
- 测试文件为backend/src/test/java/com/ginkgo/foodmap/review/ReplyPolicyTest.java和ReplyApiIntegrationTest.java。文档更新docs/api.md、docs/features.md、docs/plans/review-roadmap.md、docs/plans/review-backend.md及本文件；前端、现有迁移均未修改。
- 最终验证：Java21 + 独立MySQL8.4.0，`mvn --batch-mode --no-transfer-progress verify '-Dreview.integration=true'`成功并打包可执行JAR。共299项、226通过、0失败/错误、73跳过（未开启其他领域的显式集成开关），不能记为299项全部实际执行。新增回复12项真实数据库/认证接口测试及3项规则测试全部通过；原点评发布、分组/历史读取及评价结构测试亦执行通过。覆盖并发同UUID/跨店冲突、插入后故障回滚与有界重试、删店互斥、历史归属/不计分、Unicode、游标同时间分页/失效、时钟回拨及缺失作者。`git diff --check`通过；没有前端改动，未运行前端构建或浏览器验收。
- Maven原始日志位于仓库外`D:/eat/.codex-backups/reply-verify.log`；测试随机库已清理，本轮3319专用实例在验证结束后关闭。未提交、推送、合并或部署；正式前端回复接入及删除功能仍待完成。

## 2026-10-30：首页视觉优化

- 从feat/review-history创建feat/home-ui-refresh，保留现有未提交工作。修改真实首页、目录、卡片和随机展示：紧凑搜索分类，移除未开放的禁用筛选按钮，低频条件收纳，桌面三列、中屏两列、手机单列，上图下文；浅黄随机横条保留抽取逻辑，PC与手机底部导航保留。
- 点评模块新增公开的useRestaurantReviewPreview，复用现有公开读取，一店只读第一页，当前目录最多8店；读取真实总条数和已有配图，模拟图标注非实拍。不扫描历史或聚合评分；取消与代次保护阻止旧响应覆盖，失败区分于真实零条。代价为每页最多8次辅助请求，专用封面接口另行设计。
- 修改HomePage.vue、RestaurantCatalog.vue、RestaurantCard.vue、RandomRestaurant.vue和review/index.ts，新增读取逻辑及3项生命周期测试；同步features和discovery-ui。后端及数据库未改，未提交推送。
- npm run check通过：ESLint、182项前端测试、TypeScript及生产构建。Edge实际检查1366/768/390/320px，无横向溢出和脚本错误；桌面首卡从440px开始、底栏从702px开始。真实接口验证搜索、分类、更多筛选、排序、分页、随机与预算、详情返回；拦截GET验证目录错误重试和图片失败回退，无业务写入。截图及事实记录在仓库外ginkgo-browser-check/artifacts/home-refresh/。

## 2026-10-30：C1历史点评按需展开与同店分页联调

- 从feat/review-list-ui新建feat/review-history，保留既有未提交工作，完成C1后端与前端。新增公开GET /api/restaurants/{restaurantId}/reviews/authors/{authorId}/history；默认5条、最多20条，以微秒时间+ID排他游标翻页，不把历史全量嵌入主列表。主列表有历史时返回nextHistoryCursor。游标限定版本/规范编码/路径归属，并核对真实锚点与时间；不把公开分页参数当授权凭证，不引入签名密钥或迁移。
- 单段父店可见性、当前代表、游标锚点、正文、公开作者和有序照片使用同一REPEATABLE_READ只读快照。当前代表变化时，前端丢弃历史并刷新当前页；页面不主动推送更新。首次展开才请求，每段5条，更多、折叠取消、重开缓存、失败原游标重试、卸载忽略晚到结果均实现。历史卡保留原记录评分、时间、正文及照片，大图沿用既有接口。
- 新增/修改文件用途：review/dto/ReviewHistoryQuery及ReviewHistoryBoundary定义参数和边界，policy/ReviewHistoryCursorPolicy负责游标校验，vo/ReviewHistoryVo定义响应；ReviewReadMapper/Service/Controller与SecurityConfiguration提供公开只读流程，ReviewPageVo与ReviewErrorCode补充协议。前端review/model/review.ts和api/reviewApi.ts定义历史传输与响应校验，ReviewHistory.vue管理按需请求与取消，ReviewEntry.vue新增历史插槽，ReviewPanel.vue接入并刷新，ReviewComposer.vue更新回执文案；httpClient.ts将精确历史GET列入匿名请求。ReviewReadApiIntegrationTest、reviewHistory.spec.ts、reviewApi.spec.ts及httpClient.spec.ts验证边界，既有review.spec.ts改用trim匹配格式化后的按钮文本。
- 前端npm run check通过：ESLint、179项测试、TypeScript及生产构建。后端Java21、隔离MySQL8.4.0、Redis完整verify共352项，351项实际执行通过，1项显式关闭的OSS-live测试跳过；0失败/错误。13项真实点评读取集成测试包含默认5条/尾段、同时间ID边界、作者/餐厅隔离、锚点与参数错误、无记录、父店可见性、五图和私密字段、代表变化及并发提交快照。OSS-live跳过不等于本轮真实照片未验证：开发库补充样例的12张历史照片逐条真实GET通过。
- EXPLAIN/ANALYZE使用30作者×50条同时间记录，结果生成backend/target/review-history-explain.txt；该小样本选择作者索引并排序，未强制复合索引，不声称常数开销、吞吐量或提升幅度。既有B1查询计划也在本轮重跑。
- 经用户授权，继续用两模拟账号各向开发餐厅20实际发布6条带图点评，共增加12条/12张新上传；复用之前审核过的Commons照片，每条恰一张并保留作者/许可证/来源及“联调模拟、非本店实拍”标识。现在每账号16条点评、16张照片、10家餐厅，餐厅20各7条（6历史）；实际接口验证历史5+1分页、无主卡重复、12张照片均200/JPEG。UUID、文件ID与进度持久化在仓库外seed_history_reviews.py/history-progress.json，验证在history-verification.json；更新photo-credits.md。不改变账号角色，结束注销脚本会话，不输出凭证。
- Edge真实浏览器在1440/390/320px通过：未展开零请求、5条+1条、折叠重开不重复请求、每历史卡一图并加载成功、历史照片大图、无横向溢出。代表变化与503重试采用拦截响应验证，无额外真实写入；页面无运行时错误。脚本和截图位于D:/eat/.codex-backups/ginkgo-browser-check/review-history-check.cjs及artifacts/review-history/。
- API第16节、features、review-backend/review-roadmap及review-schema同步完成状态。后端8080使用本轮验证的JAR副本重新启动，前端5173热更新，保留服务供用户联调；未提交/合并/推送。餐厅四维/聚合统计仍按要求暂缓，C2本人上下文/预测、回复、删除及独立照片墙仍待后续步骤。

## 2026-10-30：创建两个模拟账号并发布20条单图点评

- 按用户明确要求向当前回环3306的ginkgo_food_map开发库添加模拟数据，不连接生产。创建“模拟食客_小林_1030”和“模拟食客_小周_1030”，各仅授ROLE_USER；使用保留.invalid邮箱通过本地数据初始化建立可登录模拟账号，不发送验证邮件、不修改注册或认证代码。密码使用BCrypt，登录信息仅保存在仓库外credentials.json，日志不输出密码/令牌。
- 从Wikimedia Commons挑选20张开放授权美食照片，包含饺子、炒饭、火锅、面食和甜点；下载后视觉核对，缩放/转JPEG，均满足1200px及300KiB限制。每条正文注明联调模拟、非真实体验、配图非本店实拍，并保留作者、许可证、来源页面和缩放说明；完整来源清单保存在本地photo-credits.md及photo-sources.json。
- 选取10家仍营业且带“联调模拟”标签的现有餐厅（ID20、8、10、16、19、15、23、12、18、22），两个账号各在每家发布1条，共20条。账号创建后实际登录，全部图片上传与点评发布走现有认证HTTP接口，真实写入开发OSS并绑定；每条仅1张照片。请求UUID、文件ID和点评ID持久保存，发布可按同次编号重放，未直接插入点评或修改既有记录。
- 数据增量核对为用户+2、点评+20、照片关联+20、媒体+20、餐厅+0；每个模拟账号均为10条/10家/10张，普通用户角色。20个正式图片地址全部返回200且为JPEG，分组读取正确识别两个作者。完成后撤销脚本登录会话，用户仍可自行登录。
- Edge在1440/390/320px真实读取新增账号的点评和照片，每个模拟主卡恰好1图，模拟标识与来源可见，无横向溢出或浏览器错误。本轮不改业务代码、不迁移数据库、不提交推送，未重跑单元/构建；验证依据为实际发布、数据库增量、20张云图读取与浏览器检查。
- 本轮仅更新本日志及功能说明中的联调数据状态。账号登录信息、基线/增量、图片/来源、请求进度与验收结果位于仓库外D:/eat/.codex-backups/ginkgo-food-map-v2/demo-reviews-20261030/；页面截图位于ginkgo-browser-check/artifacts/demo-reviews-20261030/。模拟数据有意保留供用户联调，餐厅聚合统计前端仍按要求暂缓。

## 2026-10-30：接入真实点评列表，暂缓餐厅四维统计

- 按用户要求从feat/review-read新建feat/review-list-ui，先完成B3的点评读取部分，B2餐厅综合分/推荐率/四维聚合统计暂缓。详情页读取公开作者组分页，每页8位同学，显示人数与点评总条数、当前主卡、服务端单条分数、历史数量和按顺序排列的照片；照片可查看大图，不把本页照片当作全店照片墙。
- 正式GET不带旧Bearer，不推断作者管理权限；隐藏未开放的回复输入与删评入口，历史数量明确提示尚不可展开。预览传输同步分页模型，示例历史仍独立保留。上方餐厅统计区保持空评分，条数改为“待接入”并说明汇总尚未启用，避免已有点评时仍声称0条或没有评价。
- 列表支持上一页/下一页、刷新回第一页、失败原页重试、真实空态；切店或发布修订会取消旧请求并忽略晚到响应。发布成功保留编号回执，完成或关闭后只刷新点评第一页，不卸载整个详情或回填乐观假列表。首页发布后可进入餐厅详情读取。
- npm run check通过：ESLint、173项前端测试、TypeScript与生产构建全部通过。新增5项行为测试覆盖B1映射与五图顺序/URL、畸形响应、分页/发布重置、原页重试和切店取消；既有预览、草稿与同号重试回归通过。后端代码未改，未重跑后端测试，不将此前347项当成本轮执行。
- Edge真实浏览器在1440/390/320px读取本地餐厅20已有2条/1人记录及正式OSS照片，大图可打开、页面无横向溢出；独立历史预览仍可展开。另用拦截响应验证两页、读失败/重试/空态、发布503保留正文与UUID、成功回执保留及关闭后回第一页。写请求全部拦截，未向业务库新增测试点评或上传图片，未冒称真实正向发布持久化验收。浏览器错误0，截图和事实记录在仓库外ginkgo-browser-check/artifacts/review-list-ui；检查日志为review-list-ui-check.log。
- 本轮修改review/model/review.ts及api/reviewApi.ts、ReviewPanel.vue、ReviewEntry.vue、ReviewComposer.vue、ReviewHistoryPreview.vue，实现统一分页与真实展示；RestaurantDetail.vue接发布修订并澄清统计待接入；shared/api/httpClient.ts放行匿名点评GET。review.spec.ts、api/reviewApi.spec.ts、shared/api/httpClient.spec.ts验证相应行为；api/features/两份计划及本日志同步状态。后端8080与前端5173保持运行，Vite已热更新，未改数据库、提交或推送。

## 2026-10-30：启动B1前后端联调环境

- 按用户要求启动最新B1后端8080和Vite前端127.0.0.1:5173；后端使用已通过verify的JAR副本、local Profile及被Git忽略的本地配置。Redis6379从原redis-local持久化目录恢复；原MySQL3306保留，Flyway校验V1–V7通过，实际新增迁移0项。
- 首页、状态、餐厅目录及经Vite代理的点评GET均200；餐厅20已有2条点评，返回1位作者的最新主卡，验证B1已加载。非法每页数量400、不存在餐厅404、匿名/auth/me为401；Redis PONG。不发布测试点评、不上传图片或发送邮件。
- 本轮只补充启动记录，不修改业务代码或重复运行全套测试。服务保持运行供用户联调；点评列表页面仍待B3接入，当前可直接请求分组GET。运行日志与后端副本位于仓库外D:/eat/.codex-backups/ginkgo-food-map-v2/review-read-dev-start/，未提交或推送。

## 2026-10-30：B1公开点评按作者分组读取

- 从feat/review-images新建feat/review-read，保留原有未提交成果。新增公开GET /api/restaurants/{restaurantId}/reviews，每页默认8组、最多50组；按账号ID选最新代表后分页，返回独立人数、总条数、每人历史条数、单条评分/杯型及最多五个有序照片引用。nextHistoryCursor为空，历史展开留待C1；B2餐厅统计和B3页面读取仍未实施。
- 父店可见性、计数、分页、公开作者及照片共用REPEATABLE_READ只读快照。非空页5条SQL，空页2条，作者和照片各一次批量查询；不跨模块JOIN、不加载用户凭证或OSS信息、不调用云端或持写锁。缺失账号保留逻辑ID并显示统一回退名，停用账号不抹掉已发布署名。
- 新增9项真实MySQL读取测试和10项杯型边界测试。首轮修正测试夹具本地Timestamp时区转换，以及对抽象Mapper使用callRealMethod的错误拦截方式；改为LocalDateTime夹具和父店服务建立快照后独立连接提交，验证计数/主卡/署名一致。定向20项（含结构边界）通过。
- 完整mvn verify开启review/restaurant/auth/redis集成，最终报告348项：347项实际执行通过、0失败/错误，1项真实OSS上传测试未启用；JAR成功。首次完整回归因临时Redis的MSYS路径解析未启动而失败，修复启动路径并确认PONG后重跑通过。未访问真实OSS或发送邮件；未改前端，不重复运行前端检查。
- MySQL8.4.0、Java21和临时Redis8.6.1在独立回环环境验证；核对随机库已全部清理后关闭本轮临时MySQL/Redis。EXPLAIN/ANALYZE覆盖30位作者、30/300/1500条历史，实际出现全表扫描、窗口临时表及排序，未宣称索引命中或吞吐提升；取舍与复现入口见结构文档第12节。完整日志、执行计划保存在仓库外review-read-check目录。6份文档的44个本地链接/锚点、21个JSON示例及空白检查通过。
- 本轮无新迁移，未操作开发/生产业务库、重启开发前后端、提交或推送。接口/功能/路线图/后端计划/结构及本日志同步B1完成、B2/B3待办；本地现有服务不会自动加载新JAR。

本轮文件与用途（路径相对于backend/src/main/java/com/ginkgo/foodmap，测试相对于backend/src/test/java/com/ginkgo/foodmap）：

| 文件 | 用途 |
| --- | --- |
| review/controller/ReviewReadController.java、review/dto/ReviewListQuery.java | 公开HTTP入口、分页校验及字段绑定白名单 |
| review/service/ReviewReadService.java、review/policy/ReviewReadPolicy.java | 一致快照流程、展示组装、ID校验和杯型阈值 |
| review/entity/ReviewReadEntity.java、review/entity/ReviewCountsEntity.java、review/entity/ReviewPhotoReferenceEntity.java | 点评、计数及照片关联的内部持久化投影 |
| review/mapper/ReviewReadMapper.java、review/mapper/ReviewPhotoMapper.java | 作者代表分页与计数、批量有序照片关联 |
| review/vo/ReviewPageVo.java、review/exception/ReviewErrorCode.java | 显式公开响应白名单、读取ID错误码 |
| user/dto/PublicAuthor.java、user/mapper/PublicAuthorMapper.java、user/service/PublicAuthorService.java | 用户模块公开作者批量查询，仅包含ID和用户名 |
| security/config/SecurityConfiguration.java | 仅放行主列表GET，不放行历史或本人上下文 |
| review/ReviewReadApiIntegrationTest.java、review/ReviewReadPolicyTest.java | 真实MySQL/安全/快照/分页/隐私/照片顺序及阈值验证、生成执行计划 |
| docs/api.md、docs/features.md | 第15节正式契约与使用边界 |
| docs/plans/review-backend.md、docs/plans/review-roadmap.md、docs/architecture/review-schema.md、docs/development.md | 实施状态、后续步骤、查询成本与本轮验证记录 |

## 2026-10-30：接续历史会话规划点评阅读闭环

- 根据会话01a187c8-ed4f-70a2-b34f-f572e5e1fc19、当前源码及已有日志核对：五图发布、OSS上传/绑定/正式读取/清理已实现；正式点评list仍提示尚未开放，餐厅读取仍返回空评分。修正路线图与后端计划中图片尚未实现、file无业务服务及旧预测公式仍启用等过期状态。
- 将B步拆为B1按作者分组读取后端、B2餐厅真实统计/筛选排序、B3前端分页/图片展示/发布刷新；下一次最小交付限定B1及必要批量作者查询、照片关联读取和隔离测试。后续依次推进C1历史、C2本人预测、回复、含请求防重的删除、独立照片墙与榜单联动，保留统计重建待办。
- 路线图维护顺序与完成边界，后端计划维护协议、模块职责和分步验收。本轮只修改这两份计划与当前日志；未实现接口、修改数据库或重启服务。接续会话01a18abf-ddd6-7551-a511-0f79b5aceca6完成收尾校验：3份文档的16个本地链接（含章节锚点）、1个JSON示例及行尾空白检查通过，git diff --check通过。业务代码未变，未重跑前后端测试，不将历史329项后端/168项前端结果记为本轮执行。

## 2026-10-29：缩略图右侧新增入口及五张图片上限

- 按用户要求，ReviewComposer未选图显示上传框，选图后在同一区域切换为缩略图和80×80方形加号，移除按钮保留；满五张隐藏加号，移除后恢复，手机端自动换行。useReviewPhotos与前端公开模型统一五张上限，失败重试、本地预览和取消清理保持原语义。
- 后端ReviewPublishPolicy最多5个有序文件ID，ReviewPhotoService允许位置0–4；V7仅扩展review_photos位置约束和注释，保留旧迁移。新增V6有两张图片时升级、五图有序绑定及第五图访问/第六图拒绝验证；既有迁移数量断言同步。
- 完整mvn verify开启全部集成及真实OSS测试，329项实际执行，0失败/错误/跳过，JAR成功。前端168项、ESLint、类型及构建通过；Edge在1440/390/320宽验证单图右侧方形加号、五图隐藏、移除补图、超限拦截、顺序及重试，截图视觉复核通过。浏览器云请求使用替身，未向业务库发布测试点评。
- 本地开发库从V6升V7，升级前后的业务表指纹一致，已有27家餐厅和1条点评保留；新后端已加载，前端由Vite热更新，代理及匿名上传401检查通过，用户刷新5173可继续联调。临时测试库与MySQL已清理。
- 本轮修改ReviewComposer、review模型/useReviewPhotos及测试、ReviewPublishPolicy、ReviewPhotoService、V7迁移、图片/结构集成测试，需求/接口/功能/结构/范围和本日志同步；未提交或推送。证据位于仓库外five-photo相关日志、构建和截图，以及local-v7-upgrade快照。

## 2026-10-29：本地V6升级并启动真实OSS联调服务

- 用户授权升级并启动前后端。本地回环3306的ginkgo_food_map从V5升到V6，Flyway实际执行1项；27家餐厅、1条点评、其他业务表及全部业务数据指纹与升级前一致，未发布测试点评或上传业务图片。媒体结构快照和指纹保存在仓库外local-v6-upgrade目录。
- 使用当前源码和本地OSS凭证重新打包到仓库外oss-dev-build，核对旧进程后切换8080后端和5173前端；后端local Profile加载被忽略的application-local.yml，Vite固定端口。MySQL/Redis原实例保留，日志不输出配置或密钥。
- 新服务检查：公开状态200、前端首页200、餐厅GET代理200，匿名上传/取消401，不存在的正式照片404。正向真实OSS及JWT/隔离MySQL接口已在上一轮验证，本轮不冒称向业务库正向发布验收。
- 当前页面可登录后选图、本地压缩预览、上传与带图发布。点评列表、历史、照片墙及统计展示仍未接通，成功回执与照片访问接口不等于阅读闭环。未提交或推送。

## 2026-10-29：开发Bucket真实上传验收

- 用户保存本地RAM配置后要求测试上传。本轮只读取配置有效性，不输出ID/Secret，不提交local配置。真实ginkgo-bucket/成都SDK探针复用项目配置、图片处理器和存储适配：上传48×32 JPEG成功，下载字节完全一致，删除后检查对象不存在；只操作本次随机review-images/smoke对象。
- 新增显式oss.live开关的OssLiveUploadIntegrationTest，使用真实OSS、RS256/JWT及回环3316独立MySQL随机库，替换Redis会话依赖但不绕过数据库账号状态。multipart上传201，媒体TEMPORARY及尺寸正确，真实OSS读取成功，他人取消404，本人取消204，媒体记录删除，点评数0。1项实际执行，0失败/错误/跳过。
- 测试自行清理登记的云对象与随机库；实际业务库未写文件/点评、未执行其V6迁移，现有8080后端未重启，页面联调仍需加载新版本。云探针、依赖路径及日志位于仓库外OssLiveSmoke.java、oss-live-classpath.txt、oss-live-api.log。未提交或推送。

## 2026-10-29：允许在未跟踪的local配置中保存OSS凭证

- 按用户要求，OSS支持app.file.oss.access-key-id/access-key-secret本地成对配置，显式配置优先，都留空时沿用SDK环境变量；部分填写直接拒绝，避免意外切换身份。两个敏感字段排除Lombok toString，不输出完整本地配置。
- 本机application-local.yml保留其他配置与已有凭证，设置截图中的ginkgo-bucket及成都Region/HTTPS Endpoint，缺失凭证留空供用户填写。已确认文件未被Git跟踪且命中.gitignore；不在example中填写真实密钥。
- 修改OssProperties、OssConfiguration、配置示例，新增OssConfigurationTest并同步功能说明；针对配置和存储适配的5项测试通过，不访问真实OSS。当前未执行迁移、重启或云端上传，也未提交/推送。

## 2026-10-29：图片生命周期完善与后端各模块职责整理

- 用户确认图片方案并要求各模块整理。本轮在feat/review-images保留既有成果，service只保留业务服务；规则、ID解析、图片处理、云SDK、邮件、认证转换与调度分别进入模块内policy、support、image、storage、mail、authentication、job，控制器与配置归位。AGENTS和架构文档固定规则，新增结构边界测试。
- V6新增UPLOADING，取消先提交删除意图，再立即在事务外删OSS；完成204、待重试202、已绑定409。失败上传保留保护凭据覆盖普通晚到写入；极端冻结后的对象核对仍待后续，不承诺跨系统原子性。
- 点评接有序photoIds，按ID升序锁媒体、按请求顺序关联，MANDATORY加入点评与统计事务；任一失效/越权全部回滚。先检查UUID和有序内容再绑定，空图保持旧摘要兼容。正式照片GET核验点评、父店、关联与BOUND后读私有OSS，不缓存。
- 前端本地压缩预览，独立文件API与照片草稿函数负责上传/重试和取消；移除后晚到成功清理、不回填，账号变化使用原凭证；失败保留文件ID和UUID，成功后只释放本地URL。列表、历史、照片墙和统计展示仍待后续。
- 最终独立目录完整mvn verify开启review/restaurant/auth/redis，共324项实际执行，0失败/错误/跳过并生成JAR；前端167项、ESLint、类型及构建通过。覆盖V5到V6有数据升级、绑定回滚、有序重放、绑定/取消竞争、云删除时无数据库事务及模块结构。初轮旧迁移数量与旧photoIds拒绝断言已修正。
- Edge在1440/390/320宽、640高验证上传中移除后的晚到清理、双图顺序、失败同号重试、成功后不误删；云端及发布使用测试响应，未写业务库。日志与截图在仓库外oss-refactor产物中。
- V6只在隔离库执行，开发业务库未升级，现有服务未重启；真实Bucket/RAM配置和云端验收待提供。未提交、推送或操作生产。本轮文件用途索引见[架构文档](architecture/modular-monolith.md)。

## 2026-10-29：OSS图片第一步——上传、取消与到期清理

- 用户确认选图压缩后本地预览并上传OSS，移除/取消清理临时图片，提交时有序绑定，发布后校验点评再读取；不新增临时预览接口。按仓库逐步审核规则，本轮先交付文件基础，绑定、正式读取与前端启用下一步实施，B/C读取预测保留。
- 从当前feat/reviews创建feat/review-images，保留既有未提交成果。file模块新增上传与本人取消接口，服务端实际JPEG解码、尺寸/大小限制、重编码去附加内容、归属校验、私有ACL、V4签名与有界OSS超时。凭证只通过SDK环境变量读取，默认关闭OSS不影响文本发布。
- 复用V4 media_files：上传前短事务登记待清理凭据、事务外写OSS、成功后激活临时状态；取消/过期清理采用有界批次和单行锁，OSS成功删除后移除登记，失败保留重试。保护窗口与极端进程冻结边界记录于结构文档，不承诺跨系统原子性。
- API、功能、范围/后端计划、结构及本地配置示例同步；无新迁移、无前端代码改动、未启用云端配置，未提交或推送。开发Bucket与实际云端联调仍待配置。
- 本轮新增15项测试（图片策略5、云适配3、真实MySQL/JWT接口7），完整开启review/restaurant/auth/redis后共316项实际执行，0失败/错误/跳过。首次verify在重打包阶段因运行中的开发JAR被Windows锁定而失败；保留测试结果，用临时POM仅调整输出目录并跳过重复测试，独立verify成功生成可执行JAR，未重启现有前后端。
- 日志及构建产物位于仓库外oss-upload-verify.log、oss-upload-package.log及oss-upload-build；随机测试库已清理，临时MySQL实例已关闭。文档本地链接及git diff --check通过，前端未改故不重复运行前端测试。

## 2026-10-29：修复点评提交反馈不可见

- 接续会话01a18704-60ff-7c22-bb24-ea2ddb337e28最后的“点击提交点评没有反应”反馈。浏览器确认有效正文能触发POST，但校验和网络错误原先位于滚动区域内；短屏下原生fieldset还会撑出操作区，造成反馈不可见。
- 表单改为独立滚动容器包裹禁用字段组，错误与加载/发布状态放在提交按钮旁；未选店和正文长度错误分别说明。发布中取消按钮同步禁用，保留失败草稿及原请求编号。
- 补充实际按钮点击的组件回归；Edge在1440、390、320宽及640高验证空正文不发请求、提示可见、503失败反馈、同编号重试和成功回执。POST使用测试响应，没有向业务库写点评。前后端现有开发服务保留，前端由Vite热更新。
- 本轮仅调整ReviewComposer.vue、review.spec.ts、features.md及本日志；读取、图片和评分展示仍待后续，未提交或推送。
- 最终npm run check通过：162项前端测试、ESLint、TypeScript及生产构建通过；git diff --check通过。后端代码未改，未重跑后端测试。

接续[development2.md](history/development-02.md)。记录阶段性变更与验证，历史时点的描述不代替当前功能或需求。

## 2026-10-29：整理评价文档职责与过期规则

- 用户确认按冗余检查结果整理文档。需求正文统一账号署名、同人归组、每人最新代表计分、人数/条数与删除回退；修正匿名昵称、全部点评计分、评价恢复、旧R1–R7步骤和已过时的结构进度。贡献榜范围保留，分组方式仍待审核。
- features.md改为可用功能、使用方法、前端预览与尚未接通能力，不再承载迁移/事务设计和讨论经过。reviews-development.md改为完整范围与进度索引，后端实现细节由review-backend.md维护；review-schema.md明确已执行V4和拟议V5边界，移除重复事务/身份方案，保留字段、约束和媒体生命周期说明。
- 原站访问/源码依据/旧规划归档至archive/reviews-development-2026-10-29.md；需求原站差异与餐厅阶段历史归档至archive/requirements-history-2026-10-29.md，重新解析相对链接。归档保存旧内容且明确非现行规则，历史验证记录不改写成当前验收。
- README更新文档入口与职责，development2.md保留历史并链接本日志。图片、回复、删除、榜单、全站联动及地图/导入导出/离线/PWA待办保留；不新增或取消产品范围，不实现后端、不修改迁移或此前前端成果，不提交或推送。
- 文档本地链接及章节锚点、JSON示例和git diff --check检查通过；业务代码未变，不重复运行前后端测试。清理前文档备份保存在仓库外D:/eat/.codex-backups/docs-cleanup-20261029/。

## 2026-10-29：收拢文档目录与入口

- 用户反馈文件结构混乱，本轮限定整理docs。根层保留需求、功能、已实现接口和当前开发记录；新增README作为唯一文档导航。
- 旧日志与原站/需求归档统一进入history，部署说明进入operations，旧系统迁移计划进入plans；评价范围清单改名review-roadmap.md，与review-backend.md的实施方案区分。
- 所有文件迁移前核对目标在工作区内，保留完整内容并重算相对链接。README简化入口，AGENTS.md更新固定当前日志与轮转到history的规则，避免再次出现多个根层编号日志。
- 变更仅涉及文档与文档维护规则；此前前端成果保留。链接/章节锚点、JSON、移动内容完整性与Git空白检查通过，不重复运行业务测试，未提交或推送。整理前副本在仓库外docs-layout-20261029。

## 2026-10-29：收窄最基础的文本发布计划

- 用户要求先规划最基础的评价发布。在现有review-backend.md中细分A基础发布、B阅读/页面接入、C历史/预测；当前仅计划A步一个POST，不新增文档或接口实现。
- A步包括身份/参数校验、保留历史的文本入库、UUID幂等、每人最新代表的事务计分及隔离数据库验证；V5人数列/索引属于必要前置。明确仅插入记录不够，但不把分组分页、历史、OSS、回复和删除提前打包进此次交付。
- review-roadmap.md同步顺序，其他产品规则和待办保持。文档JSON与链接检查、git diff --check通过；未执行迁移、测试、提交或推送。

## 2026-10-29：V5迁移与A步最简文本发布完成

- 用户授权数据库迁移完成后直接继续最简发布开发。本轮在保留feat/reviews及全部未提交前端/文档成果的基础上，新增V5与纯文本POST，不扩大到B/C读取、历史、预测或前端正式接入；不提交、推送、合并或操作生产。
- V5新增participant_count、作者/时间/ID复合索引，按每账号最新代表重建统计并补缺行，保留历史点评和已删店状态。独立MySQL8.4结构测试验证后，再升级仅限回环ginkgo_food_map开发库；本地实际MySQL8.0.34升级成功、再次迁移0项、26行统计且人数/条数均0。其他业务表数据指纹一致，迁移前统计备份及执行日志在仓库外review-v5-tools；V1–V4与HEAD逐字节一致。
- 实现POST /api/restaurants/{restaurantId}/reviews：作者来自安全上下文，规范UUID、Unicode首尾空白/5–500码点、四维0–10半分和JSON布尔推荐校验；拒绝额外作者、图片、总分/状态字段。SHA256规范化内容摘要与author+UUID唯一键保证同次重试返回原ID，相同编号换内容409，不用内容唯一约束阻止下一次用餐。
- restaurant公开协作服务以MANDATORY加入发布事务，锁父餐厅后判断未删除，停业允许。review仅访问自身Mapper，差量替换本人旧分并更新人数/条数/推荐，全部提交或回滚。当前发布按需创建统计行，兼容旧餐厅服务新建店；主动创建统计及目录读取留待B步。
- 发布使用最多3次独立READ_COMMITTED事务，每次事务超时10秒，锁/查询超时或跨店唯一键竞争先完整回滚再重试，耗尽503。时钟回拨时新记录时间不早于旧代表，ID稳定定序。单条总分沿数据库HALF_UP两位，不用double做权威计算。
- 新增规范化规则及真实JWT/MySQL接口测试；V5结构测试补有历史/同时间/缺行/已删父店升级样例，原餐厅结构测试更新最新版本/迁移数量。初轮发现测试误用enabled字段及MANDATORY代理外的spy设置，已改为真实status字段和代理目标设置；完整回归的旧迁移数量断言同步至5。
- 最终mvn verify同时开启review/restaurant/auth/redis集成：301项全部实际执行，0失败/错误/跳过，JAR打包成功。其中review结构39项、规则14项、接口11项；验证幂等/冲突、身份、边界、同人更新、事务失败、并发重放/更新/跨店编号竞争、重试耗尽、时钟回拨和删店互斥。没有将前端既有153项测试冒充本轮新执行结果。
- 本地8080由旧仓库外V4 JAR切换为本轮构建的JAR，保留local Profile、本机Redis与Vite。公开状态/餐厅GET均200，匿名发布401；没有向本地业务库发布测试评价或发送邮件。正向发布验证只在隔离随机库执行，测试库清理后关闭3315临时MySQL；3306/6379/8080/5173开发服务保留。
- api.md第14节记录已实现协议；结构、功能、需求、范围/实施计划和文档索引同步A完成及B/C待办。发布结果只含ID和重放标记，不返回不存在的GET地址；餐厅GET仍为空评分，前端正式写评仍显示服务未开放。OSS、回复、删除及删除后永久防重仍待后续，不把POST阶段记为页面闭环完成。
- 验证日志在仓库外review-publish-verify.log，初始结构验证在review-v5-schema-test.log。文档链接/锚点/JSON、源码/新文件空白及git diff --check通过；无私密配置、凭据或构建产物纳入待提交文件。交付说明逐项列出本轮16个后端文件与文档用途。

## 2026-10-29：接通前端文本发布并重启联调服务

- 用户要求修改前端并重启前后端供联调。新增review/api/reviewApi.ts作为真实POST适配，固定提交时Bearer，仅发送UUID、四维、推荐和正文，拒绝附图；模块公开入口与main.ts注入真实传输，预览页仍在独立子树覆盖，不混入真实数据。
- ReviewComposer成功后保留服务端ID/重放回执，用户确认后才关闭，避免父详情刷新抹掉确认信息。同草稿失败重试沿用UUID，改动内容换号；失败保留输入，提交期间冻结表单及关闭入口，账号切换忽略旧异步结果；会话失效锁住正文并提供只读复制区。
- 图片选择禁用，移除旧的“点评条数当计分人数”的综合分预测；本条总分/杯型仍显示。读取、回复、删除分别明确尚未开放，不发送不存在的GET，不将发布内容回填为假列表，也不改餐厅空评分。
- 新增HTTP契约测试及组件回执/冻结/能力/登录失效测试，最终npm run check通过：161项、ESLint、TypeScript和生产构建。后端源码未变，沿用此前301项verify结果，不重复宣称新执行后端测试。
- Edge在1440/390/320px验证真实餐厅GET代理、POST形状、503后同UUID重试、200重放回执与关闭；正向POST使用浏览器路由注入测试响应，不写本地业务库，不能称真实浏览器正向持久化验收。结果/截图在仓库外ginkgo-browser-check/artifacts/review-live-contract及review-live-contract-check.cjs。
- 已核对进程命令行后重启本地前后端，8080加载已通过verify的V5发布JAR，5173固定端口Vite；本机MySQL/Redis保留，不用Docker。重启后真实状态/目录与匿名POST401通过代理核对，供用户使用真实账号正向联调。
- features、api、review-roadmap和review-backend同步已接发布/未接读取的边界。仅新增/修改7个本轮前端文件，不修改后端协议或数据库；未提交、推送或部署。
