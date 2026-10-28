package com.ginkgo.foodmap.restaurant.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 列表与详情共用的公开餐厅字段白名单，不携带账号ID、删除元数据或行版本。
 * ID 使用字符串避免浏览器整数精度损失；M1 没有评价，所有分数与推荐率为 null。
 */
@Data
public class RestaurantVo {
    private String id;
    private String name;
    private String categoryCode;
    private String categoryName;
    private Integer pricePerPerson;
    private String priceKind;
    private String address;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String coordinateSystem;
    private boolean needsLocation;
    private String businessStatus;
    private String sourceType;
    private Instant createdAt;
    private Instant updatedAt;
    private Double distanceKm;
    private List<String> tags;
    private BigDecimal score;
    private BigDecimal recommendRate;
    private long reviewCount;
    private String tier = "none";
    private Dimensions dimensions = new Dimensions();

    /** 四维均分的空值是尚无评价，不可转换为零分。 */
    @Data
    public static class Dimensions {
        private BigDecimal taste;
        private BigDecimal value;
        private BigDecimal service;
        private BigDecimal ambience;
    }
}
