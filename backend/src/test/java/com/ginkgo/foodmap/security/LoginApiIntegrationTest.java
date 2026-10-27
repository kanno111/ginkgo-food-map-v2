package com.ginkgo.foodmap.security;

import com.ginkgo.foodmap.security.config.AuthenticationProperties;
import com.ginkgo.foodmap.security.service.LoginProtectionService;
import com.ginkgo.foodmap.security.service.LoginSessionService;
import com.ginkgo.foodmap.user.entity.UserEntity;
import com.ginkgo.foodmap.user.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 真实 Mapper、BCrypt、RSA 签发解码和安全过滤链集成测试；Redis 独立进行真实原子性验证。 */
@ActiveProfiles("test")
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:login_api;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.sql.init.mode=always",
        "spring.sql.init.schema-locations=classpath:sql/user-persistence-schema.sql"
})
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@Import({TestJwtKeys.class, LoginApiIntegrationTest.AdminProbe.class})
class LoginApiIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserMapper users;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwords;
    @Autowired private JwtEncoder encoder;
    @Autowired private AuthenticationProperties properties;
    @MockitoBean private LoginSessionService sessions;
    @MockitoBean private LoginProtectionService protection;
    private final Map<String, String> activeSessions = new ConcurrentHashMap<>();
    private UserEntity user;

    @BeforeEach
    void prepareAccount() {
        activeSessions.clear();
        jdbc.update("DELETE FROM user_roles");
        jdbc.update("DELETE FROM users");
        jdbc.update("DELETE FROM roles");
        jdbc.update("INSERT INTO roles(id, code, name) VALUES (1, 'ROLE_USER', '普通用户'), (2, 'ROLE_ADMIN', '管理员')");
        user = UserEntity.registerVerified("ginkgo_user", "student@std.uestc.edu.cn", passwords.encode("Ginkgo2026"));
        users.insert(user);
        jdbc.update("INSERT INTO user_roles(user_id, role_id) VALUES (?, 1)", user.getId());
        when(protection.key(any(), anyString())).thenReturn("login-test");
        doAnswer(call -> {
            activeSessions.put(call.getArgument(0), call.getArgument(1) + ":" + call.getArgument(2));
            return null;
        }).when(sessions).create(anyString(), anyLong(), anyLong(), any());
        when(sessions.isActive(anyString(), anyLong(), anyLong())).thenAnswer(call ->
                (call.getArgument(1) + ":" + call.getArgument(2)).equals(activeSessions.get(call.getArgument(0))));
        doAnswer(call -> { activeSessions.remove(call.getArgument(0)); return null; })
                .when(sessions).revoke(anyString());
    }

    /** 登录返回可被真实过滤链接受的 JWT、公开用户信息及禁止缓存标头，不建立 HttpSession。 */
    @Test
    void shouldLoginAndReadCurrentUser() throws Exception {
        String token = login();
        var result = mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.username").value("ginkgo_user"))
                .andExpect(jsonPath("$.data.roles[0]").value("ROLE_USER"))
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.credentialVersion").doesNotExist()).andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
        verify(protection).succeeded("login-test");
    }

    /** 不存在账号、错误密码及停用账号返回同一提示，均不能签发会话。 */
    @Test
    void shouldHideAccountExistenceAndRejectUnavailableAccounts() throws Exception {
        for (String username : List.of("ginkgo_user", "missing_user")) {
            mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"" + username + "\",\"password\":\"wrongPassword1\"}"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("AUTH_INVALID_CREDENTIALS"));
        }
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE id = ?", user.getId());
        loginRequest().andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_INVALID_CREDENTIALS"));
        verify(sessions, never()).create(anyString(), anyLong(), anyLong(), any());
    }

    /** 明确公开 POST 登录，字段错误返回400；GET 登录、匿名读取及 Basic 均不能绕过 Bearer 认证。 */
    @Test
    void shouldEnforceProtocolAndAuthenticationBoundaries() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_VALIDATION_FAILED"));
        mvc.perform(get("/auth/login")).andExpect(status().isUnauthorized());
        mvc.perform(get("/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_UNAUTHENTICATED"));
        mvc.perform(post("/auth/logout")).andExpect(status().isUnauthorized());
        mvc.perform(get("/auth/me").header("Authorization", "Basic Z2lua2dvX3VzZXI6R2lua2dvMjAyNg=="))
                .andExpect(status().isUnauthorized());
    }

    /** 多次登录产生独立会话，退出后旧令牌立刻失效，另一个会话继续可用。 */
    @Test
    void shouldRevokeOnlyCurrentSession() throws Exception {
        String first = login();
        String second = login();
        assertThat(first).isNotEqualTo(second);
        mvc.perform(post("/auth/logout").header("Authorization", "Bearer " + first)).andExpect(status().isOk());
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + first)).andExpect(status().isUnauthorized());
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + second)).andExpect(status().isOk());
    }

    /** 签名有效也不能绕过停用账号或已递增的凭证版本。 */
    @Test
    void shouldRejectDisabledAndPasswordChangedAccounts() throws Exception {
        String token = login();
        jdbc.update("UPDATE users SET credential_version = 1 WHERE id = ?", user.getId());
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        jdbc.update("UPDATE users SET credential_version = 0, status = 'LOCKED' WHERE id = ?", user.getId());
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    /** 每次读取当前角色；没有管理权限返回统一403，不能依靠客户端声明越权。 */
    @Test
    void shouldUseCurrentRolesForAuthorization() throws Exception {
        String token = login();
        mvc.perform(get("/api/test/admin").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("AUTH_FORBIDDEN"));
        jdbc.update("INSERT INTO user_roles(user_id, role_id) VALUES (?, 2)", user.getId());
        mvc.perform(get("/api/test/admin").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        jdbc.update("DELETE FROM user_roles WHERE user_id = ? AND role_id = 2", user.getId());
        mvc.perform(get("/api/test/admin").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    /** 即使本机签名正确，过期、错误发行方/受众或缺少必要声明也必须拒绝。 */
    @Test
    void shouldValidateSignedClaimsAndRejectTampering() throws Exception {
        for (int variant = 0; variant < 5; variant++) {
            String id = UUID.randomUUID().toString();
            activeSessions.put(id, user.getId() + ":0");
            var claims = JwtClaimsSet.builder().subject(user.getId().toString()).id(id)
                    .issuer(variant == 1 ? "foreign-issuer" : properties.getJwt().getIssuer())
                    .audience(List.of(variant == 2 ? "foreign-api" : properties.getJwt().getAudience()))
                    .issuedAt(Instant.now().minusSeconds(120));
            if (variant != 3) claims.expiresAt(Instant.now().plusSeconds(variant == 0 ? -60 : 600));
            if (variant != 4) claims.claim("credential_version", 0L);
            String token = encoder.encode(JwtEncoderParameters.from(
                    JwsHeader.with(SignatureAlgorithm.RS256).build(), claims.build())).getTokenValue();
            mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        }
        String token = login();
        String tampered = (token.charAt(0) == 'a' ? "b" : "a") + token.substring(1);
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + tampered)).andExpect(status().isUnauthorized());
        String[] pieces = token.split("\\.");
        String forged = pieces[0] + "." + pieces[1] + "." + (pieces[2].charAt(0) == 'a' ? "b" : "a") + pieces[2].substring(1);
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
    }

    /** 锁定返回429，限流和会话基础设施故障返回503，绝不返回登录凭证。 */
    @Test
    void shouldFailClosedWhenLoginInfrastructureIsUnavailable() throws Exception {
        doThrow(new RedisConnectionFailureException("test only")).when(protection).check("login-test");
        loginRequest().andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AUTH_SERVICE_UNAVAILABLE"));
        doNothing().when(protection).check("login-test");
        doThrow(new RedisConnectionFailureException("test only"))
                .when(sessions).create(anyString(), anyLong(), anyLong(), any());
        loginRequest().andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.data.accessToken").doesNotExist());
    }

    /** 阈值失败和已锁定请求均使用429，不把锁定误认为密码校验成功。 */
    @Test
    void shouldReturnRateLimitForLockedAccount() throws Exception {
        when(protection.failed("login-test")).thenReturn(true);
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"ginkgo_user\",\"password\":\"wrongPassword1\"}"))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("AUTH_LOGIN_LOCKED"));
        doThrow(new com.ginkgo.foodmap.common.exception.BusinessException(
                com.ginkgo.foodmap.security.exception.AuthenticationErrorCode.LOGIN_LOCKED))
                .when(protection).check("login-test");
        loginRequest().andExpect(status().isTooManyRequests());
    }

    /** 会话存储读取故障时不可放行；退出写入失败时不得宣告服务端退出成功。 */
    @Test
    void shouldRejectSessionReadFailureAndReportLogoutFailure() throws Exception {
        String token = login();
        doThrow(new RedisConnectionFailureException("test only")).when(sessions).revoke(anyString());
        mvc.perform(post("/auth/logout").header("Authorization", "Bearer " + token)).andExpect(status().isServiceUnavailable());
        when(sessions.isActive(anyString(), anyLong(), anyLong()))
                .thenThrow(new RedisConnectionFailureException("test only"));
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("AUTH_SERVICE_UNAVAILABLE"));
    }

    private org.springframework.test.web.servlet.ResultActions loginRequest() throws Exception {
        return mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\" ginkgo_user \",\"password\":\"Ginkgo2026\"}"));
    }

    private String login() throws Exception {
        String body = loginRequest().andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("data").path("accessToken").asText();
    }

    /** 只存在于测试上下文，用于验证方法级角色授权。 */
    @RestController
    static class AdminProbe {
        @PreAuthorize("hasRole('ADMIN')")
        @GetMapping("/api/test/admin")
        public Map<String, Boolean> admin() { return Map.of("allowed", true); }
    }
}
