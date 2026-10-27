package com.ginkgo.foodmap.user.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

/**
 * 用户注册输入策略，由 {@code user} 模块拥有。
 *
 * <p>允许的校园邮箱域名和账号字段长度通过配置管理，便于未来增加其他学校域名，
 * 同时避免注册业务依赖 {@code security} 模块的内部实现。</p>
 *
 */
@Data
@Validated
@ConfigurationProperties("app.user.registration")
public class UserRegistrationProperties {

    @NotEmpty
    private List<String> allowedEmailDomains;

    @Min(3)
    @Max(64)
    private int usernameMinLength;

    @Min(3)
    @Max(64)
    private int usernameMaxLength;

    @Min(8)
    @Max(64)
    private int passwordMinLength;

    @Min(16)
    @Max(72)
    private int passwordMaxBytes;
}
