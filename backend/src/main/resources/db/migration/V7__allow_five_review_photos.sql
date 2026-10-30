-- 图片上限由两张扩展为五张，保留已有文件关联和展示顺序。
ALTER TABLE review_photos DROP CHECK chk_review_photos_position;
ALTER TABLE review_photos MODIFY position TINYINT UNSIGNED NOT NULL COMMENT '有序位置0到4，最多五图';
ALTER TABLE review_photos ADD CONSTRAINT chk_review_photos_position CHECK (position BETWEEN 0 AND 4);
