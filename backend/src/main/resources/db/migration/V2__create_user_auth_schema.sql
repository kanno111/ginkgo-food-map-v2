-- 用户表由 user 模块独占。用户名和邮箱的唯一约束是并发注册时的最终一致性防线，
-- 业务层的“是否存在”查询只能用于提前给出友好提示，不能替代数据库约束。
CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户主键',
    username VARCHAR(32) NOT NULL COMMENT '全局唯一用户名，按数据库排序规则进行大小写不敏感比较',
    email VARCHAR(254) NOT NULL COMMENT '规范化为小写后的校园邮箱',
    password_hash VARCHAR(255) NOT NULL COMMENT 'BCrypt 密码哈希，禁止保存明文密码',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE COMMENT '校园邮箱是否已通过验证码验证',
    email_verified_at TIMESTAMP(6) NULL COMMENT '校园邮箱验证完成时间',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '账号状态：ACTIVE、LOCKED、DISABLED、DELETED',
    student_verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        COMMENT '扩展学生认证状态：PENDING、VERIFIED、REJECTED',
    credential_version BIGINT UNSIGNED NOT NULL DEFAULT 0
        COMMENT '密码重置时递增；JWT 中版本不一致时立即拒绝旧会话',
    row_version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'MyBatis-Plus 乐观锁版本，用于防止并发更新覆盖',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED', 'DELETED')),
    CONSTRAINT chk_users_student_status
        CHECK (student_verification_status IN ('PENDING', 'VERIFIED', 'REJECTED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户账号与身份信息';

-- 角色使用稳定的 code 参与授权判断，展示名称可以独立调整。
CREATE TABLE roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色主键',
    code VARCHAR(50) NOT NULL COMMENT '授权使用的稳定角色编码',
    name VARCHAR(100) NOT NULL COMMENT '角色展示名称',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_roles_code UNIQUE (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '系统角色';

-- 用户与角色保持多对多关系，为后续增加商户、审核员等角色预留扩展能力。
CREATE TABLE user_roles (
    user_id BIGINT UNSIGNED NOT NULL COMMENT '用户主键',
    role_id BIGINT UNSIGNED NOT NULL COMMENT '角色主键',
    assigned_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, role_id),
    INDEX idx_user_roles_role_id (role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '用户角色关系';

-- 审计记录只保存非敏感事件元数据和不可逆摘要，不保存密码、验证码、JWT 或 SMTP 凭据。
CREATE TABLE security_audit_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '审计事件主键',
    user_id BIGINT UNSIGNED NULL COMMENT '已识别用户；匿名或未注册请求允许为空',
    event_type VARCHAR(64) NOT NULL COMMENT '事件类型，例如 LOGIN_SUCCESS、PASSWORD_RESET',
    outcome VARCHAR(16) NOT NULL COMMENT '事件结果：SUCCESS、FAILURE',
    reason_code VARCHAR(64) NULL COMMENT '不包含敏感数据的机器可读原因码',
    subject_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL
        COMMENT '邮箱或用户名的 HMAC/SHA-256 摘要，不保存原始标识',
    ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL
        COMMENT '客户端 IP 的服务端密钥摘要，不保存原始 IP',
    session_id_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL
        COMMENT 'JWT jti 的摘要，不保存完整令牌或可直接使用的会话标识',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    INDEX idx_security_audit_user_created (user_id, created_at),
    INDEX idx_security_audit_type_created (event_type, created_at),
    CONSTRAINT chk_security_audit_outcome CHECK (outcome IN ('SUCCESS', 'FAILURE')),
    CONSTRAINT fk_security_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '认证与账号安全审计事件';

-- 只初始化角色定义，不创建管理员账号，也不在迁移脚本中保存任何初始密码。
INSERT INTO roles (code, name)
VALUES ('ROLE_USER', '普通用户'),
       ('ROLE_ADMIN', '管理员');
