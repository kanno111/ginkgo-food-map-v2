-- 保留历史点评条数，新增独立计分人数；旧迁移保持原样。
ALTER TABLE restaurant_review_statistics
    ADD COLUMN participant_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '同店有有效点评的独立账号数' AFTER review_count,
    DROP CHECK chk_restaurant_review_statistics_counts,
    DROP CHECK chk_restaurant_review_statistics_sums;

CREATE INDEX idx_reviews_restaurant_author_time ON reviews (restaurant_id, author_user_id, created_at, id);

-- 补全后建餐厅及已删除餐厅的读模型行，不创建任何账号或点评。
INSERT INTO restaurant_review_statistics (restaurant_id)
SELECT r.id FROM restaurants r LEFT JOIN restaurant_review_statistics s ON s.restaurant_id=r.id
WHERE s.restaurant_id IS NULL;

-- 从真实点评重建：总条数含历史，累计分只取每账号时间/ID最新的一条。
UPDATE restaurant_review_statistics s
LEFT JOIN (SELECT restaurant_id, COUNT(*) AS total FROM reviews GROUP BY restaurant_id) n ON n.restaurant_id=s.restaurant_id
LEFT JOIN (
    SELECT r.restaurant_id, COUNT(*) AS participants, SUM(r.is_recommended) AS recommended,
           SUM(r.taste_score) AS taste, SUM(r.value_score) AS value_sum,
           SUM(r.service_score) AS service_sum, SUM(r.ambience_score) AS ambience,
           SUM(r.overall_score) AS overall_sum
    FROM reviews r
    WHERE NOT EXISTS (
        SELECT 1 FROM reviews newer WHERE newer.restaurant_id=r.restaurant_id AND newer.author_user_id=r.author_user_id
        AND (newer.created_at>r.created_at OR (newer.created_at=r.created_at AND newer.id>r.id))
    )
    GROUP BY r.restaurant_id
) latest ON latest.restaurant_id=s.restaurant_id
SET s.review_count=COALESCE(n.total,0), s.participant_count=COALESCE(latest.participants,0),
    s.recommend_count=COALESCE(latest.recommended,0), s.taste_sum=COALESCE(latest.taste,0),
    s.value_sum=COALESCE(latest.value_sum,0), s.service_sum=COALESCE(latest.service_sum,0),
    s.ambience_sum=COALESCE(latest.ambience,0), s.overall_score_sum=COALESCE(latest.overall_sum,0);

ALTER TABLE restaurant_review_statistics
    ADD CONSTRAINT chk_restaurant_review_statistics_counts CHECK (recommend_count<=participant_count AND participant_count<=review_count),
    ADD CONSTRAINT chk_restaurant_review_statistics_sums CHECK (
        taste_sum BETWEEN 0 AND participant_count*10 AND value_sum BETWEEN 0 AND participant_count*10
        AND service_sum BETWEEN 0 AND participant_count*10 AND ambience_sum BETWEEN 0 AND participant_count*10
        AND overall_score_sum BETWEEN 0 AND participant_count*10);
