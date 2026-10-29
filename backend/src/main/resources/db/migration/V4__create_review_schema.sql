-- 评价归review模块：账号和餐厅为跨模块逻辑引用，服务端公开应用服务校验归属与状态。
-- 本阶段直接删除评价，不保留匿名昵称、来源、软删除、恢复或版本字段。
CREATE TABLE reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评价ID',
    restaurant_id BIGINT UNSIGNED NOT NULL COMMENT '餐厅逻辑ID',
    author_user_id BIGINT UNSIGNED NOT NULL COMMENT '登录作者逻辑ID',
    taste_score DECIMAL(3,1) NOT NULL COMMENT '味道0至10，步进0.5',
    value_score DECIMAL(3,1) NOT NULL COMMENT '性价比0至10，步进0.5',
    service_score DECIMAL(3,1) NOT NULL COMMENT '服务0至10，步进0.5',
    ambience_score DECIMAL(3,1) NOT NULL COMMENT '环境0至10，步进0.5',
    overall_score DECIMAL(4,2) GENERATED ALWAYS AS
        (ROUND((taste_score + value_score + service_score + ambience_score) * 0.25, 2)) STORED
        COMMENT '四维平均后HALF_UP两位，不接受手工总分',
    is_recommended BOOLEAN NOT NULL COMMENT '独立推荐判断',
    body VARCHAR(500) NOT NULL COMMENT '去首尾空白的5至500码点纯文本',
    client_request_id BINARY(16) NOT NULL COMMENT '同次发布UUID，重试沿用',
    request_hash BINARY(32) NOT NULL COMMENT '服务端规范化内容SHA256',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_reviews_author_request UNIQUE (author_user_id, client_request_id),
    KEY idx_reviews_restaurant_time (restaurant_id, created_at, id),
    CONSTRAINT chk_reviews_ids CHECK (restaurant_id BETWEEN 1 AND 9223372036854775807
        AND author_user_id BETWEEN 1 AND 9223372036854775807),
    CONSTRAINT chk_reviews_scores CHECK (
        taste_score BETWEEN 0 AND 10 AND MOD(taste_score, 0.5) = 0
        AND value_score BETWEEN 0 AND 10 AND MOD(value_score, 0.5) = 0
        AND service_score BETWEEN 0 AND 10 AND MOD(service_score, 0.5) = 0
        AND ambience_score BETWEEN 0 AND 10 AND MOD(ambience_score, 0.5) = 0),
    CONSTRAINT chk_reviews_recommended CHECK (is_recommended IN (0, 1)),
    CONSTRAINT chk_reviews_body CHECK (CHAR_LENGTH(body) BETWEEN 5 AND 500
        AND NOT REGEXP_LIKE(body, '^[[:space:]]|[[:space:]]$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='登录账号评价，直接删除';

-- 单层回复和照片关联属review模块，使用RESTRICT外键；直接删评必须先显式删除子记录。
CREATE TABLE review_replies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '回复ID',
    review_id BIGINT UNSIGNED NOT NULL COMMENT '所属评价',
    author_user_id BIGINT UNSIGNED NOT NULL COMMENT '登录作者逻辑ID',
    body VARCHAR(200) NOT NULL COMMENT '去首尾空白的1至200码点纯文本',
    client_request_id BINARY(16) NOT NULL COMMENT '同次回复UUID',
    request_hash BINARY(32) NOT NULL COMMENT '服务端规范化内容SHA256',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_review_replies_author_request UNIQUE (author_user_id, client_request_id),
    KEY idx_review_replies_review_time (review_id, created_at, id),
    CONSTRAINT fk_review_replies_review FOREIGN KEY (review_id) REFERENCES reviews(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_review_replies_ids CHECK (review_id BETWEEN 1 AND 9223372036854775807
        AND author_user_id BETWEEN 1 AND 9223372036854775807),
    CONSTRAINT chk_review_replies_body CHECK (CHAR_LENGTH(body) BETWEEN 1 AND 200
        AND NOT REGEXP_LIKE(body, '^[[:space:]]|[[:space:]]$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='评价单层回复，不计评分';

CREATE TABLE review_photos (
    review_id BIGINT UNSIGNED NOT NULL COMMENT '所属评价',
    position TINYINT UNSIGNED NOT NULL COMMENT '有序位置0或1，最多两图',
    media_file_id BIGINT UNSIGNED NOT NULL COMMENT 'file模块媒体逻辑ID',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (review_id, position),
    CONSTRAINT uk_review_photos_media UNIQUE (media_file_id),
    CONSTRAINT fk_review_photos_review FOREIGN KEY (review_id) REFERENCES reviews(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_review_photos_position CHECK (position IN (0, 1)),
    CONSTRAINT chk_review_photos_ids CHECK (review_id BETWEEN 1 AND 9223372036854775807
        AND media_file_id BETWEEN 1 AND 9223372036854775807)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='评价照片关联，跨模块绑定由应用服务核验';

-- 文件归file模块，OSS中保存图片本体；这里只保存对象位置、验证结果与绑定/清理状态。
CREATE TABLE media_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '文件ID',
    uploader_user_id BIGINT UNSIGNED NOT NULL COMMENT '登录上传者逻辑ID',
    bucket_name VARCHAR(63) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '服务端选定OSS Bucket',
    storage_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '应用生成的OSS Object Key',
    content_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '服务端验证后的图片类型',
    byte_size INT UNSIGNED NOT NULL COMMENT '最终图片不超过300KiB',
    width SMALLINT UNSIGNED NOT NULL COMMENT '解码宽度不超过1200',
    height SMALLINT UNSIGNED NOT NULL COMMENT '解码高度不超过1200',
    sha256 BINARY(32) NOT NULL COMMENT '最终文件内容摘要，不唯一',
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'TEMPORARY、BOUND或PENDING_DELETE',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    expires_at TIMESTAMP(6) NULL COMMENT '临时上传过期时间，由服务端设置',
    bound_at TIMESTAMP(6) NULL COMMENT '绑定时间',
    PRIMARY KEY (id),
    CONSTRAINT uk_media_files_object UNIQUE (bucket_name, storage_key),
    KEY idx_media_files_cleanup (status, expires_at, id),
    KEY idx_media_files_uploader (uploader_user_id, status, created_at, id),
    CONSTRAINT chk_media_files_uploader CHECK (uploader_user_id BETWEEN 1 AND 9223372036854775807),
    CONSTRAINT chk_media_files_bucket CHECK (
        REGEXP_LIKE(bucket_name, '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$', 'c')),
    CONSTRAINT chk_media_files_key CHECK (CHAR_LENGTH(storage_key) BETWEEN 1 AND 255
        AND REGEXP_LIKE(storage_key, '^[A-Za-z0-9][A-Za-z0-9/_.-]*$', 'c')),
    CONSTRAINT chk_media_files_type CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')
        AND NOT REGEXP_LIKE(content_type, '[[:space:]]')),
    CONSTRAINT chk_media_files_size CHECK (byte_size BETWEEN 1 AND 307200
        AND width BETWEEN 1 AND 1200 AND height BETWEEN 1 AND 1200),
    CONSTRAINT chk_media_files_state CHECK (NOT REGEXP_LIKE(status, '[[:space:]]') AND (
        (status = 'TEMPORARY' AND expires_at IS NOT NULL AND bound_at IS NULL)
        OR (status = 'BOUND' AND bound_at IS NOT NULL AND expires_at IS NULL)
        OR status = 'PENDING_DELETE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='OSS媒体登记，待清理对象删除成功后移除本行';

-- 评分读模型归restaurant模块，支持本模块全量筛选排序，不跨模块JOIN评价表。
CREATE TABLE restaurant_review_statistics (
    restaurant_id BIGINT UNSIGNED NOT NULL COMMENT '一店一行',
    review_count INT UNSIGNED NOT NULL DEFAULT 0,
    recommend_count INT UNSIGNED NOT NULL DEFAULT 0,
    taste_sum DECIMAL(16,2) NOT NULL DEFAULT 0,
    value_sum DECIMAL(16,2) NOT NULL DEFAULT 0,
    service_sum DECIMAL(16,2) NOT NULL DEFAULT 0,
    ambience_sum DECIMAL(16,2) NOT NULL DEFAULT 0,
    overall_score_sum DECIMAL(16,2) NOT NULL DEFAULT 0 COMMENT '已舍入单条正式总分累计值',
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (restaurant_id),
    CONSTRAINT fk_restaurant_review_statistics_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_restaurant_review_statistics_id CHECK (restaurant_id BETWEEN 1 AND 9223372036854775807),
    CONSTRAINT chk_restaurant_review_statistics_counts CHECK (recommend_count <= review_count),
    CONSTRAINT chk_restaurant_review_statistics_sums CHECK (
        taste_sum BETWEEN 0 AND review_count * 10
        AND value_sum BETWEEN 0 AND review_count * 10
        AND service_sum BETWEEN 0 AND review_count * 10
        AND ambience_sum BETWEEN 0 AND review_count * 10
        AND overall_score_sum BETWEEN 0 AND review_count * 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='可重建的评价计数累计分，不存手工均分或杯型';

-- 只为升级时已有餐厅补零行（含已软删除餐厅），不创建任何评价、账号或OSS对象。
INSERT INTO restaurant_review_statistics (restaurant_id) SELECT id FROM restaurants;
