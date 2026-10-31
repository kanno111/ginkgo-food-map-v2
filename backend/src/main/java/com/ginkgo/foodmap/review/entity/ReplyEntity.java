package com.ginkgo.foodmap.review.entity;

import java.time.Instant;
import lombok.Data;
import lombok.ToString;

/** 回复持久化投影，UUID和摘要通过SQL转换为规范字符串。 */
@Data
public class ReplyEntity {
    private Long id;
    private long reviewId;
    private long authorUserId;
    @ToString.Exclude private String body;
    private String clientRequestId;
    private String requestHash;
    private Instant createdAt;
}
