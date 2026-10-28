package com.ginkgo.foodmap.restaurant;

import com.ginkgo.foodmap.restaurant.dto.RestaurantListQuery;
import com.ginkgo.foodmap.restaurant.mapper.RestaurantCatalogMapper;
import com.ginkgo.foodmap.security.TestJwtKeys;
import com.ginkgo.foodmap.security.service.LoginSessionService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 真实MySQL 8.4、Flyway、Mapper、事务及安全过滤链的公开读取测试，不用H2替代排序或LIKE行为。
 * 显式开启restaurant.integration；只创建并清理自己的随机回环测试库，不加载本地业务配置或密钥。
 */
@EnabledIfSystemProperty(named = "restaurant.integration", matches = "true")
@ActiveProfiles("test")
@SpringBootTest(properties = {"spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver",
        "spring.datasource.hikari.minimum-idle=0", "spring.datasource.hikari.maximum-pool-size=4"})
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@Import(TestJwtKeys.class)
@Transactional
class RestaurantReadApiIntegrationTest {
    private static String database;
    private static boolean created;

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper json;
    @Autowired private SqlSessionTemplate sqlSession;
    @MockitoBean private LoginSessionService sessions;
    @MockitoSpyBean private RestaurantCatalogMapper mapper;

    /** 上下文启动前创建空库，由实际应用Flyway配置执行V1至V3，验证XML自动加载。 */
    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) throws SQLException {
        String server = server();
        database = "ginkgo_restaurant_api_it_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection connection = connect(""); Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE DATABASE `" + database + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
            created = true;
        }
        registry.add("spring.datasource.url", () -> url(server, database));
        registry.add("spring.datasource.username", RestaurantReadApiIntegrationTest::username);
        registry.add("spring.datasource.password", RestaurantReadApiIntegrationTest::password);
    }

    /** 专用夹具覆盖停业、未知值、同名、多标签、删除及大整数ID，不导入任何生产内容。 */
    @BeforeEach
    void seedFixtures() {
        reset(mapper);
        insert(101, "A同名", "OTHER", 20, "ESTIMATE", "清水河Alpha路", 30.7544, 103.9312, "OPERATING");
        insert(102, "A同名", "OTHER", 20, "EXACT", "南门测试路", 30.7644, 103.9312, "OPERATING");
        insert(103, "B停业", "HOT_POT", null, "UNKNOWN", null, null, null, "CLOSED");
        insert(104, "C无位置", "SICHUAN", 50, "EXACT", "夹具地址", null, null, "OPERATING");
        insert(105, "D未知人均", "SNACK", null, "UNKNOWN", "远处", 31.7544, 103.9312, "OPERATING");
        insert(106, "E已删除", "OTHER", null, "UNKNOWN", "仅删除地址", null, null, "OPERATING");
        insert(107, "百分%_!\\测试", "OTHER", null, "UNKNOWN", null, null, null, "OPERATING");
        insert(9007199254740993L, "Z大ID", "OTHER", null, "UNKNOWN", null, null, null, "OPERATING");
        jdbc.update("UPDATE restaurants SET deleted_at=CURRENT_TIMESTAMP(6), delete_reason_code='SYSTEM' WHERE id=106");
        jdbc.update("UPDATE restaurants SET source_type='USER', created_by=42, updated_by=43, row_version=7 WHERE id=101");
        jdbc.update("INSERT INTO restaurant_tags(restaurant_id,tag,position) VALUES "
                + "(101,'招牌',0),(101,'测试搜索',1),(101,'测试组合',2),(102,'测试搜索',0),(106,'仅删除命中',0)");
    }

    /** 并发快照测试不用外层事务，其余测试回滚；此处只清理专属随机库中的夹具。 */
    @AfterEach
    void clearFixtures() {
        reset(mapper);
        jdbc.update("DELETE FROM restaurant_tags");
        jdbc.update("DELETE FROM restaurants");
    }

    /** 非Flyway clean：只删除本测试实际创建并严格匹配前缀的数据库。 */
    @AfterAll
    static void dropDatabase() throws SQLException {
        if (!created) return;
        if (!database.matches("ginkgo_restaurant_api_it_[a-f0-9]{32}")) {
            throw new IllegalStateException("Refusing to remove an unexpected database name");
        }
        try (Connection connection = connect(""); Statement statement = connection.createStatement()) {
            statement.executeUpdate("DROP DATABASE `" + database + "`");
        }
    }

    /** 访客可读取13类字典，停用类仍可阅读，顺序由字典字段确定。 */
    @Test
    void shouldReadAllCategoriesInStableOrder() throws Exception {
        jdbc.update("UPDATE restaurant_categories SET enabled=0 WHERE code='OTHER'");
        mvc.perform(get("/api/restaurant-categories")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(13))
                .andExpect(jsonPath("$.data[0].code").value("HOT_POT"))
                .andExpect(jsonPath("$.data[12].code").value("OTHER"))
                .andExpect(jsonPath("$.data[12].enabled").value(false));
        mvc.perform(get("/api/restaurants").param("category", "OTHER"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(4));
        verifyNoInteractions(sessions);
    }

    /** 真实分页不会因多标签重复或先分页再过滤漏项，同名由数字ID确定次序。 */
    @Test
    void shouldPageBeforeLoadingOrderedTags() throws Exception {
        mvc.perform(get("/api/restaurants").param("pageSize", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(7))
                .andExpect(jsonPath("$.data.totalPages").value(7))
                .andExpect(jsonPath("$.data.records[0].id").value("101"))
                .andExpect(jsonPath("$.data.records[0].tags[0]").value("招牌"))
                .andExpect(jsonPath("$.data.records[0].tags[2]").value("测试组合"));
        mvc.perform(get("/api/restaurants").param("pageSize", "1").param("page", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.records[0].id").value("102"));
        mvc.perform(get("/api/restaurants").param("pageSize", "1").param("page", "8"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(7))
                .andExpect(jsonPath("$.data.records").isEmpty());
    }

    /** 标签多个匹配仍只计数一次，AND组合及关闭停业过滤在全局集合执行。 */
    @Test
    void shouldSearchTagsAndCombineGlobalFilters() throws Exception {
        mvc.perform(get("/api/restaurants").param("keyword", " 测试 ").param("category", "OTHER")
                        .param("pageSize", "1").param("page", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.records[0].id").value("102"));
        mvc.perform(get("/api/restaurants").param("category", "HOT_POT").param("hideClosed", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0));
        mvc.perform(get("/api/restaurants").param("category", "HOT_POT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.records[0].businessStatus").value("CLOSED"));
    }

    /** 名称、地址、分类中文与ASCII大小写均按MySQL配置匹配，空白搜索不改变集合。 */
    @ParameterizedTest
    @ValueSource(strings = {"A同名", "alpha", "其他", "招牌", "   "})
    void shouldSearchEveryPublicTextField(String keyword) throws Exception {
        var result = mvc.perform(get("/api/restaurants").param("keyword", keyword))
                .andExpect(status().isOk()).andReturn();
        var data = json.readTree(result.getResponse().getContentAsString()).get("data");
        assertThat(data.get("total").asLong()).isGreaterThan(0);
        assertThat(data.get("records").get(0).get("id").asString()).isEqualTo("101");
    }

    /** LIKE通配符、转义符及反斜杠是文字；SQL注入片段只可能匹配实际文字。 */
    @ParameterizedTest
    @ValueSource(strings = {"%", "_", "!", "\\", "%_!\\"})
    void shouldSearchLiteralSpecialCharacters(String keyword) throws Exception {
        mvc.perform(get("/api/restaurants").param("keyword", keyword)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].id").value("107"));
    }

    /** 用户文字不能成为SQL，非法排序在校验层拒绝。 */
    @Test
    void shouldRejectSqlOrderingAndTreatSqlLookingKeywordsAsText() throws Exception {
        mvc.perform(get("/api/restaurants").param("keyword", "' OR 1=1 --"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0));
        mvc.perform(get("/api/restaurants").param("sort", "price; DROP TABLE restaurants"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_VALIDATION_FAILED"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM restaurants", Long.class)).isEqualTo(8);
    }

    /** 人均和直线距离均在全局排序后分页；未知值不能先于有效值。 */
    @ParameterizedTest
    @ValueSource(strings = {"price", "distance"})
    void shouldSortKnownValuesBeforeUnknowns(String sort) throws Exception {
        mvc.perform(get("/api/restaurants").param("sort", sort).param("pageSize", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.records[0].id").value("101"))
                .andExpect(jsonPath("$.data.records[1].id").value("102"));
        mvc.perform(get("/api/restaurants").param("sort", sort).param("pageSize", "1").param("page", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].id").value("price".equals(sort) ? "104" : "105"));
    }

    /** 评分排序在没有评价阶段使用稳定后备次序，不为无评价店铺捏造分数。 */
    @ParameterizedTest
    @ValueSource(strings = {"score", "taste", "value", "service", "ambience", "reviews"})
    void shouldUseStableOrderForEmptyRatingSorts(String sort) throws Exception {
        mvc.perform(get("/api/restaurants").param("sort", sort).param("pageSize", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.records[0].id").value("101"));
    }

    /** 待评级不会被划入推荐或踩雷，五个有评分杯型在M1都没有命中。 */
    @ParameterizedTest
    @ValueSource(strings = {"bucket", "super", "large", "medium", "small"})
    void shouldExcludeUnratedFromScoredTiers(String tier) throws Exception {
        mvc.perform(get("/api/restaurants").param("tiers", tier)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(0));
    }

    /** 杯型为并集，视图与杯型为交集；待评级并入组合仍不能变成推荐。 */
    @Test
    void shouldApplyViewsAndTierUnionConsistently() throws Exception {
        mvc.perform(get("/api/restaurants").param("tiers", "none", "small"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(7));
        for (String view : new String[]{"recommended", "pitfall"}) {
            mvc.perform(get("/api/restaurants").param("view", view).param("tiers", "none"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0));
        }
    }

    /** 列表和详情均不泄露删除店铺，标签残留不让其通过搜索重新出现。 */
    @Test
    void shouldHideDeletedRestaurantsAtEveryEntry() throws Exception {
        mvc.perform(get("/api/restaurants/106")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESTAURANT_NOT_FOUND"));
        mvc.perform(get("/api/restaurants/999999")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESTAURANT_NOT_FOUND"));
        for (String keyword : new String[]{"E已删除", "仅删除地址", "仅删除命中"}) {
            mvc.perform(get("/api/restaurants").param("keyword", keyword)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.total").value(0));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM restaurant_tags WHERE restaurant_id=106", Long.class))
                .isEqualTo(1);
    }

    /** 输出白名单与null评分由实际JSON验证，内部归属、版本和删除字段均不返回。 */
    @Test
    void shouldReturnPublicDetailsWithNullScoresAndUtcTime() throws Exception {
        jdbc.update("UPDATE restaurants SET created_at='2026-10-28 01:02:03.123456' WHERE id=101");
        var result = mvc.perform(get("/api/restaurants/101")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("101"))
                .andExpect(jsonPath("$.data.priceKind").value("ESTIMATE"))
                .andExpect(jsonPath("$.data.sourceType").value("USER"))
                .andExpect(jsonPath("$.data.tags.length()").value(3))
                .andExpect(jsonPath("$.data.distanceKm").value(0.0))
                .andExpect(jsonPath("$.data.createdAt").value("2026-10-28T01:02:03.123456Z"))
                .andReturn();
        var data = json.readTree(result.getResponse().getContentAsString()).get("data");
        assertThat(data.get("score").isNull()).isTrue();
        assertThat(data.get("recommendRate").isNull()).isTrue();
        for (String field : new String[]{"taste", "value", "service", "ambience"}) {
            assertThat(data.get("dimensions").get(field).isNull()).isTrue();
        }
        assertThat(data.get("reviewCount").asLong()).isZero();
        assertThat(data.get("tier").asString()).isEqualTo("none");
        for (String field : new String[]{"createdBy", "updatedBy", "deletedBy", "deletedAt", "rowVersion", "deleteReasonCode"}) {
            assertThat(data.has(field)).as(field).isFalse();
        }
    }

    /** 大整数身份无精度损失，待定位与未知人均保留空值，停业详情仍可阅读。 */
    @Test
    void shouldReadUnknownsClosedRecordsAndLargeIds() throws Exception {
        mvc.perform(get("/api/restaurants/9007199254740993")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("9007199254740993"))
                .andExpect(jsonPath("$.data.needsLocation").value(true));
        var result = mvc.perform(get("/api/restaurants/103")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.businessStatus").value("CLOSED")).andReturn();
        var data = json.readTree(result.getResponse().getContentAsString()).get("data");
        assertThat(data.get("pricePerPerson").isNull()).isTrue();
        assertThat(data.get("latitude").isNull()).isTrue();
        assertThat(data.get("longitude").isNull()).isTrue();
        assertThat(data.get("distanceKm").isNull()).isTrue();
        assertThat(data.get("tags").isEmpty()).isTrue();
    }

    /** 放行仅限三个GET；写入、管理子资源和其他方法保持认证边界，坏Bearer也不能绕过。 */
    @Test
    void shouldKeepWriteAndManagementRoutesProtected() throws Exception {
        mvc.perform(post("/api/restaurants")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/restaurants/101")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/restaurants/101")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/restaurants/101/admin")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/restaurants").header("Authorization", "Bearer invalid-test-token"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_UNAUTHENTICATED"));
    }

    /** 在COUNT之后由另一连接删除餐厅和标签，当前读取仍须保持同一快照；下次读取才反映删除。 */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void shouldUseOneSnapshotForCountPageAndTags() throws Exception {
        AtomicBoolean changed = new AtomicBoolean();
        doAnswer(call -> {
            // MyBatis Mapper 是接口代理，不能使用 Mockito callRealMethod；经同一事务执行真实映射语句。
            long total = sqlSession.selectOne(RestaurantCatalogMapper.class.getName() + ".countVisible",
                    Map.of("query", call.getArgument(0)));
            if (changed.compareAndSet(false, true)) {
                try (Connection writer = connect(database); Statement statement = writer.createStatement()) {
                    statement.executeUpdate("UPDATE restaurants SET deleted_at=CURRENT_TIMESTAMP(6), "
                            + "delete_reason_code='SYSTEM' WHERE id=101");
                    statement.executeUpdate("DELETE FROM restaurant_tags WHERE restaurant_id=101");
                }
            }
            return total;
        }).when(mapper).countVisible(any(RestaurantListQuery.class));
        mvc.perform(get("/api/restaurants")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(7))
                .andExpect(jsonPath("$.data.records.length()").value(7))
                .andExpect(jsonPath("$.data.records[0].id").value("101"))
                .andExpect(jsonPath("$.data.records[0].tags.length()").value(3));
        mvc.perform(get("/api/restaurants")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(6))
                .andExpect(jsonPath("$.data.records[0].id").value("102"));
    }

    private void insert(long id, String name, String category, Integer price, String kind, String address,
                        Double latitude, Double longitude, String businessStatus) {
        jdbc.update("INSERT INTO restaurants(id,name,category_code,price_per_person,price_kind,address,latitude,longitude,"
                        + "needs_location,business_status,source_type) VALUES (?,?,?,?,?,?,?,?,?,?,'LEGACY_IMPORT')",
                id, name, category, price, kind, address, latitude, longitude, latitude == null, businessStatus);
    }

    /** 必须显式指定回环端口，不能误用业务URL或从开发配置读取数据库凭据。 */
    private static String server() {
        String server = System.getenv().getOrDefault("RESTAURANT_TEST_DB_SERVER", "jdbc:mysql://127.0.0.1:3306/");
        if (!server.matches("jdbc:mysql://(127\\.0\\.0\\.1|localhost):[0-9]{1,5}/")) {
            throw new IllegalArgumentException("Restaurant API tests require an explicit loopback MySQL server");
        }
        return server;
    }

    private static String username() {
        return System.getenv().getOrDefault("RESTAURANT_TEST_DB_USERNAME", "root");
    }

    private static String password() {
        String password = System.getenv("RESTAURANT_TEST_DB_PASSWORD");
        if (password == null) throw new IllegalStateException("Set RESTAURANT_TEST_DB_PASSWORD for isolated tests");
        return password;
    }

    private static String url(String server, String name) {
        return server + name + "?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC"
                + "&forceConnectionTimeZoneToSession=true&useSSL=false&allowPublicKeyRetrieval=true";
    }

    private static Connection connect(String name) throws SQLException {
        return DriverManager.getConnection(url(server(), name), username(), password());
    }
}
