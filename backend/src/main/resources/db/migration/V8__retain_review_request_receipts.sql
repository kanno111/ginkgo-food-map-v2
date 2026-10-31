-- 独立回执不保留点评正文或照片，硬删除后仍防止旧发布请求复活。
-- 持续保留至账号数据清理策略单独实施；当前不设置自动过期窗口。
CREATE TABLE review_request_receipts (
    author_user_id BIGINT UNSIGNED NOT NULL,
    client_request_id BINARY(16) NOT NULL,
    review_id BIGINT UNSIGNED NOT NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    deleted_at TIMESTAMP(6) NULL,
    PRIMARY KEY (author_user_id, client_request_id),
    UNIQUE KEY uk_review_receipt_review (review_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='发布去重及作者删除回执，不随点评硬删除';

-- 升级现存点评，不能只保护迁移之后的新发布。
INSERT INTO review_request_receipts(author_user_id,client_request_id,review_id,restaurant_id)
SELECT author_user_id,client_request_id,id,restaurant_id FROM reviews;
