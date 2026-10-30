package com.ginkgo.foodmap.user.service;
import com.ginkgo.foodmap.user.policy.UserRegistrationPolicy;

import com.ginkgo.foodmap.common.exception.BusinessException;
import com.ginkgo.foodmap.user.config.UserRegistrationProperties;
import com.ginkgo.foodmap.user.exception.UserErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 用户注册输入策略测试，确保关键规则不依赖前端校验。
 */
class UserRegistrationPolicyTest {

    private UserRegistrationPolicy policy;

    @BeforeEach
    void setUp() {
        UserRegistrationProperties properties = new UserRegistrationProperties();
        properties.setAllowedEmailDomains(List.of("std.uestc.edu.cn"));
        properties.setUsernameMinLength(3);
        properties.setUsernameMaxLength(32);
        properties.setPasswordMinLength(8);
        properties.setPasswordMaxBytes(72);
        policy = new UserRegistrationPolicy(properties);
    }

    /** 校园邮箱域名必须完全匹配，不能用相似后缀绕过。 */
    @Test
    void shouldNormalizeExactCampusEmail() {
        assertThat(policy.normalizeCampusEmail(" Student@STD.UESTC.EDU.CN "))
                .isEqualTo("student@std.uestc.edu.cn");

        assertThatThrownBy(() -> policy.normalizeCampusEmail("student@std.uestc.edu.cn.example.com"))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getErrorCode())
                                .isEqualTo(UserErrorCode.CAMPUS_EMAIL_REQUIRED));
    }

    /** 用户名允许中文、字母、数字和下划线，但拒绝空格和标点。 */
    @Test
    void shouldValidateUsernameCharactersAndLength() {
        assertThat(policy.normalizeUsername(" 银杏同学_01 ")).isEqualTo("银杏同学_01");

        assertThatThrownBy(() -> policy.normalizeUsername("bad name"))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(UserErrorCode.USERNAME_INVALID));
    }

    /** 密码至少包含文字和数字，并受 BCrypt 72 字节上限保护。 */
    @Test
    void shouldValidatePasswordStrengthAndByteLimit() {
        policy.validatePassword("Ginkgo2026");

        assertThatThrownBy(() -> policy.validatePassword("onlyletters"))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(UserErrorCode.PASSWORD_WEAK));
        assertThatThrownBy(() -> policy.validatePassword("银".repeat(24) + "1"))
                .isInstanceOfSatisfying(BusinessException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(UserErrorCode.PASSWORD_WEAK));
    }
}
