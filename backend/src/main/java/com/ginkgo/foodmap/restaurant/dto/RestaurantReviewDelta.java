package com.ginkgo.foodmap.restaurant.dto;

import lombok.Data;
import java.math.BigDecimal;

/** restaurant公开统计协作输入，累计分增量由review计算；不作为HTTP可写字段。 */
@Data
public class RestaurantReviewDelta {
    private int participants;
    private int recommendations;
    private BigDecimal taste;
    private BigDecimal value;
    private BigDecimal service;
    private BigDecimal ambience;
    private BigDecimal overall;
}
