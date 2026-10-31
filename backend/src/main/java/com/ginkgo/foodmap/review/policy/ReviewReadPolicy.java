package com.ginkgo.foodmap.review.policy;

import com.ginkgo.foodmap.common.exception.BusinessException;
import com.ginkgo.foodmap.review.exception.ReviewErrorCode;
import java.math.BigDecimal;

/** 读取入口校验和单条点评杯型；不引入餐厅聚合评分口径。 */
public final class ReviewReadPolicy {
    private ReviewReadPolicy() { }

    /** ID使用规范正整数且不超出Java long，非法输入不会进入SQL。 */
    public static long restaurantId(String value) {
        try {
            if (value == null || !value.matches("[1-9][0-9]{0,18}")) throw new IllegalArgumentException();
            return Long.parseLong(value);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ReviewErrorCode.INVALID_QUERY);
        }
    }

    /** 阈值与需求一致，使用BigDecimal比较；有效0分属于小杯。 */
    public static String tier(BigDecimal score) {
        if (score.compareTo(new BigDecimal("8.6")) >= 0) return "bucket";
        if (score.compareTo(new BigDecimal("7.4")) >= 0) return "super";
        if (score.compareTo(new BigDecimal("6.2")) >= 0) return "large";
        if (score.compareTo(new BigDecimal("5.0")) >= 0) return "medium";
        return "small";
    }
}
