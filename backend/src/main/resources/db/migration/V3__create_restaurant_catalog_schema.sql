-- restaurant 模块独占分类、餐厅与标签。只初始化分类字典，不创建演示餐厅或评价。
-- 稳定机器编码采用大小写敏感的 ASCII 排序规则，避免错误大小写悄悄通过枚举校验。
CREATE TABLE restaurant_categories (
    code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '稳定分类编码',
    name VARCHAR(20) NOT NULL COMMENT '分类展示名称',
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '展示顺序，同值按编码排序',
    enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否允许用于新建或切换分类，停用不删除历史引用',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (code),
    CONSTRAINT uk_restaurant_categories_name UNIQUE (name),
    CONSTRAINT chk_restaurant_categories_code CHECK (
        REGEXP_LIKE(code, '^[A-Z]', 'c') AND NOT REGEXP_LIKE(code, '[^A-Z0-9_]', 'c')
    ),
    CONSTRAINT chk_restaurant_categories_name CHECK (
        CHAR_LENGTH(name) BETWEEN 1 AND 20
        AND NOT REGEXP_LIKE(name, '^[[:space:]]|[[:space:]]$')
    ),
    CONSTRAINT chk_restaurant_categories_enabled CHECK (enabled IN (0, 1))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '餐厅分类字典，由restaurant模块管理';

CREATE TABLE restaurants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'V2餐厅主键，不复用原版字符串ID',
    name VARCHAR(40) NOT NULL COMMENT '去首尾空白的餐厅名称，同名分店允许存在',
    category_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '分类字典编码',
    price_per_person SMALLINT UNSIGNED NULL COMMENT '整数元人均，未知为NULL，不使用0代替',
    price_kind VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'UNKNOWN'
        COMMENT 'UNKNOWN未知、EXACT填报金额、ESTIMATE估值；填报不代表已核实',
    address VARCHAR(80) NULL COMMENT '去首尾空白的地址，未知为NULL',
    latitude DECIMAL(8, 6) NULL COMMENT 'GCJ-02纬度，待定位时为空',
    longitude DECIMAL(9, 6) NULL COMMENT 'GCJ-02经度，待定位时为空',
    coordinate_system VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'GCJ02'
        COMMENT '首期仅接受GCJ-02，其他来源必须先转换坐标',
    needs_location BOOLEAN NOT NULL DEFAULT TRUE COMMENT '仅受控历史导入允许待定位',
    business_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'OPERATING'
        COMMENT 'OPERATING正常经营记录、CLOSED停业，不代表此刻营业或信息已核实',
    source_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
        COMMENT 'USER账号创建、LEGACY_IMPORT受控历史导入',
    created_by BIGINT UNSIGNED NULL COMMENT '创建者账号，历史归属未知时为空；跨模块逻辑关联',
    updated_by BIGINT UNSIGNED NULL COMMENT '最近修改者，受控历史或系统处理可以为空',
    row_version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '主表及标签变更统一使用的乐观锁版本',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at TIMESTAMP(6) NULL COMMENT '软删除时间，NULL表示未删除；公开查询必须检查',
    deleted_by BIGINT UNSIGNED NULL COMMENT '删除者，NULL仅供受控历史或系统处理',
    delete_reason_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL
        COMMENT 'OWNER_REQUEST、ADMIN_REMOVAL、LEGACY_IMPORT、SYSTEM，不公开返回',
    PRIMARY KEY (id),
    INDEX idx_restaurants_visible_name (deleted_at, name, id),
    INDEX idx_restaurants_category_visible_name (category_code, deleted_at, name, id),
    INDEX idx_restaurants_creator_visible (created_by, deleted_at, id),
    CONSTRAINT fk_restaurants_category FOREIGN KEY (category_code)
        REFERENCES restaurant_categories (code) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_restaurants_name CHECK (
        CHAR_LENGTH(name) BETWEEN 1 AND 40
        AND NOT REGEXP_LIKE(name, '^[[:space:]]|[[:space:]]$')
    ),
    CONSTRAINT chk_restaurants_address CHECK (
        address IS NULL OR (
            CHAR_LENGTH(address) BETWEEN 1 AND 80
            AND NOT REGEXP_LIKE(address, '^[[:space:]]|[[:space:]]$')
        )
    ),
    -- CHECK遇到NULL可能得到UNKNOWN而放行，条件内必须显式区分空金额与有效金额。
    CONSTRAINT chk_restaurants_price CHECK (
        (price_kind = 'UNKNOWN' AND price_per_person IS NULL)
        OR (price_kind IN ('EXACT', 'ESTIMATE') AND price_per_person IS NOT NULL
            AND price_per_person BETWEEN 1 AND 5000)
    ),
    CONSTRAINT chk_restaurants_coordinate_system CHECK (coordinate_system = 'GCJ02'),
    CONSTRAINT chk_restaurants_location CHECK (
        (needs_location = 1 AND latitude IS NULL AND longitude IS NULL)
        OR (needs_location = 0 AND latitude IS NOT NULL AND longitude IS NOT NULL
            AND latitude BETWEEN 3 AND 54 AND longitude BETWEEN 73 AND 136)
    ),
    CONSTRAINT chk_restaurants_business_status CHECK (business_status IN ('OPERATING', 'CLOSED')),
    -- ascii_bin区分大小写，但比较时仍可能忽略末尾空格；额外拒绝非规范编码以保证枚举读取稳定。
    CONSTRAINT chk_restaurants_machine_codes CHECK (
        CHAR_LENGTH(price_kind) = CHAR_LENGTH(TRIM(price_kind))
        AND CHAR_LENGTH(coordinate_system) = CHAR_LENGTH(TRIM(coordinate_system))
        AND CHAR_LENGTH(business_status) = CHAR_LENGTH(TRIM(business_status))
        AND CHAR_LENGTH(source_type) = CHAR_LENGTH(TRIM(source_type))
        AND (delete_reason_code IS NULL
            OR CHAR_LENGTH(delete_reason_code) = CHAR_LENGTH(TRIM(delete_reason_code)))
    ),
    CONSTRAINT chk_restaurants_source CHECK (
        source_type = 'LEGACY_IMPORT'
        OR (source_type = 'USER' AND created_by IS NOT NULL AND needs_location = 0)
    ),
    -- 用户模块独立维护账号；此处仅约束ID形态，身份与历史归属由应用服务核验。
    CONSTRAINT chk_restaurants_actor_ids CHECK (
        (created_by IS NULL OR created_by > 0)
        AND (updated_by IS NULL OR updated_by > 0)
        AND (deleted_by IS NULL OR deleted_by > 0)
    ),
    CONSTRAINT chk_restaurants_deletion CHECK (
        (deleted_at IS NULL AND deleted_by IS NULL AND delete_reason_code IS NULL)
        OR (deleted_at IS NOT NULL AND delete_reason_code IS NOT NULL AND (
            (delete_reason_code IN ('OWNER_REQUEST', 'ADMIN_REMOVAL') AND deleted_by IS NOT NULL)
            OR delete_reason_code IN ('LEGACY_IMPORT', 'SYSTEM')
        ))
    )
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '餐厅目录，不保存可手工改写的评分或杯型';

-- 同店位置唯一且限定0到7，使数据库也能保证最多8个标签；总字符数仍由应用事务校验。
-- 软删除保留标签，永久清理必须显式处理子记录，不使用级联删除。
CREATE TABLE restaurant_tags (
    restaurant_id BIGINT UNSIGNED NOT NULL COMMENT '所属餐厅',
    tag VARCHAR(80) NOT NULL COMMENT '去首尾空白的标签，同店按数据库排序规则去重',
    position TINYINT UNSIGNED NOT NULL COMMENT '展示顺序0到7',
    PRIMARY KEY (restaurant_id, tag),
    CONSTRAINT uk_restaurant_tags_position UNIQUE (restaurant_id, position),
    CONSTRAINT fk_restaurant_tags_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_restaurant_tags_tag CHECK (
        CHAR_LENGTH(tag) BETWEEN 1 AND 80
        AND NOT REGEXP_LIKE(tag, '^[[:space:]]|[[:space:]]$')
    ),
    CONSTRAINT chk_restaurant_tags_position CHECK (position BETWEEN 0 AND 7)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = '餐厅有序标签，最多8项，总字符数由应用校验';

INSERT INTO restaurant_categories (code, name, sort_order)
VALUES ('HOT_POT', '火锅', 1),
       ('SICHUAN', '川菜', 2),
       ('SNACK', '小吃', 3),
       ('CANTEEN', '食堂', 4),
       ('FAST_FOOD', '快餐', 5),
       ('BARBECUE', '烧烤', 6),
       ('DESSERT', '甜品', 7),
       ('MAO_CAI', '冒菜', 8),
       ('NOODLE', '面馆', 9),
       ('MALA_TANG', '麻辣烫', 10),
       ('PORRIDGE_NOODLE', '粥粉面', 11),
       ('LIGHT_MEAL', '轻食', 12),
       ('OTHER', '其他', 13);
