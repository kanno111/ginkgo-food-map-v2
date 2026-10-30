package com.ginkgo.foodmap.review.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Data;
import lombok.ToString;
import java.math.BigDecimal;

/** 点评输入只接受正文、评分和已上传文件ID，作者、URL、时间与总分不得由客户端指定。 */
@Data
public class ReviewPublishRequest {
    private String clientRequestId;
    private Scores scores;
    private Boolean recommended;
    @ToString.Exclude
    private String body;
    /** 只接受已上传文件ID，按数组顺序绑定；不接受URL、Bucket和作者。 */
    private java.util.List<String> photoIds = java.util.List.of();

    /** 推荐必须是JSON布尔值，不将数字或字符串强制转换为推荐。 */
    @JsonSetter("recommended")
    public void readRecommendation(Object value) {
        if (value != null && !(value instanceof Boolean)) throw new IllegalArgumentException("推荐必须是布尔值");
        recommended = (Boolean) value;
    }

    /** 未知字段明确拒绝，不把任意照片URL或错误参数静默忽略。 */
    @JsonAnySetter
    public void rejectUnknown(String field, Object value) {
        throw new IllegalArgumentException("评价请求包含不支持的字段");
    }

    /** 四维先按十进制原值接收，再做半分校验，不把非法精度先舍入。 */
    @Data
    public static class Scores {
        private BigDecimal taste;
        private BigDecimal value;
        private BigDecimal service;
        private BigDecimal ambience;

        /** 错拼维度及额外分数字段必须明确拒绝。 */
        @JsonAnySetter
        public void rejectUnknown(String field, Object value) {
            throw new IllegalArgumentException("评分包含不支持的字段");
        }
    }
}
