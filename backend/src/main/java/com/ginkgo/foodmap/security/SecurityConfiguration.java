package com.ginkgo.foodmap.security;

import com.ginkgo.foodmap.common.api.ApiResponse;
import com.ginkgo.foodmap.security.service.SessionJwtAuthenticationConverter;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * 全局 Web 安全入口，集中声明公开接口和受保护接口的边界。
 *
 * <p>使用 Bearer JWT 并继续校验 Redis 会话。公开接口必须显式列出，其他请求默认需要认证。</p>
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {

    /**
     * 构建服务端统一安全过滤链。
     *
     * <p>只从 Authorization 请求头读取凭证，不创建 HTTP Session 或使用 Cookie 认证，因此关闭 CSRF。
     * 禁止 HTTP Basic、表单登录和默认退出过滤器，避免绕过业务会话。</p>
     *
     * @param http Spring Security HTTP 配置入口
     * @return 应用于所有请求的安全过滤链
     * @throws Exception 安全过滤链构建失败时抛出
     */
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SessionJwtAuthenticationConverter converter,
                                            ObjectMapper json) throws Exception {
        var entryPoint = (org.springframework.security.web.AuthenticationEntryPoint) (request, response, exception) -> {
            if (exception instanceof org.springframework.security.oauth2.core.OAuth2AuthenticationException oauth
                    && "temporarily_unavailable".equals(oauth.getError().getErrorCode())) {
                writeError(response, json, 503, "AUTH_SERVICE_UNAVAILABLE", "登录服务暂时不可用，请稍后重试");
            } else {
                response.setHeader("WWW-Authenticate", "Bearer");
                writeError(response, json, 401, "AUTH_UNAUTHENTICATED", "登录状态无效或已过期，请重新登录");
            }
        };
        var deniedHandler = (org.springframework.security.web.access.AccessDeniedHandler) (request, response, exception) ->
                writeError(response, json, 403, "AUTH_FORBIDDEN", "没有权限执行此操作");
        return http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .httpBasic(basic -> basic.disable()).formLogin(form -> form.disable()).logout(logout -> logout.disable())
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/api/public/**").permitAll()
                        // 只公开明确列出的认证 POST 接口，不放开整个 /auth 路径。
                        .requestMatchers(
                                HttpMethod.POST,
                                "/auth/register",
                                "/auth/login",
                                "/auth/password-reset",
                                "/auth/email/code/register",
                                "/auth/email/code/password-reset"
                        ).permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(errors -> errors.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler))
                .oauth2ResourceServer(resource -> resource
                        .authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler)
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(converter)))
                .build();
    }

    /** 过滤器异常发生在 Controller 之外，仍返回统一且不含内部信息的 JSON。 */
    private void writeError(HttpServletResponse response, ObjectMapper json, int status, String code,
                            String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write(json.writeValueAsString(ApiResponse.error(code, message)));
    }

    /**
     * 提供统一的密码哈希组件。
     *
     * <p>BCrypt 会为每个密码自动生成随机盐，即使两个用户使用相同密码，数据库中的哈希也不同。
     * 使用框架默认强度可兼顾当前 2 核服务器的安全性和响应时间，业务代码不得自行实现密码算法。</p>
     *
     * @return Spring Security BCrypt 密码编码器
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
