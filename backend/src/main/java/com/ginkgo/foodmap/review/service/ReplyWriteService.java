package com.ginkgo.foodmap.review.service;

import com.ginkgo.foodmap.common.exception.BusinessException;
import com.ginkgo.foodmap.restaurant.service.RestaurantReviewApplicationService;
import com.ginkgo.foodmap.review.dto.ReplyPublishRequest;
import com.ginkgo.foodmap.review.entity.ReplyEntity;
import com.ginkgo.foodmap.review.exception.ReplyErrorCode;
import com.ginkgo.foodmap.review.mapper.ReplyMapper;
import com.ginkgo.foodmap.review.policy.ReplyPolicy;
import com.ginkgo.foodmap.review.vo.ReplyPublishVo;
import com.ginkgo.foodmap.security.service.CurrentActorService;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;

/** 回复发布只写回复，不调用计分；整个事务回滚后才能重试唯一键或锁竞争。 */
@Service
@RequiredArgsConstructor
public class ReplyWriteService {
    private final ReplyMapper mapper;
    private final RestaurantReviewApplicationService restaurants;
    private final CurrentActorService actors;
    private final PlatformTransactionManager transactions;

    /** 同一账号同UUID同正文返回原回执；最多三次完整事务重试。 */
    @PreAuthorize("isAuthenticated()")
    public ReplyPublishVo publish(String review, ReplyPublishRequest input) {
        var row = ReplyPolicy.normalize(review, actors.requireActor().getUserId(), input);
        for (int attempt = 0; attempt < 3; attempt++) {
            var tx = new TransactionTemplate(transactions);
            tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
            tx.setTimeout(10);
            try { return Objects.requireNonNull(tx.execute(status -> write(row))); }
            catch (DuplicateKeyException | PessimisticLockingFailureException | QueryTimeoutException | TransactionTimedOutException e) {
                if (attempt == 2) throw new BusinessException(ReplyErrorCode.BUSY);
            }
        }
        throw new IllegalStateException("Unreachable reply state");
    }

    private ReplyPublishVo write(ReplyEntity row) {
        Long restaurant = mapper.restaurant(row.getReviewId());
        if (restaurant == null) throw new BusinessException(ReplyErrorCode.NOT_FOUND);
        restaurants.lockVisibleParent(restaurant);
        if (!restaurant.equals(mapper.lockReview(row.getReviewId()))) throw new BusinessException(ReplyErrorCode.NOT_FOUND);
        var existing = mapper.request(row.getAuthorUserId(), row.getClientRequestId());
        if (existing != null) {
            if (existing.getReviewId() != row.getReviewId() || !existing.getBody().equals(row.getBody())
                    || !existing.getRequestHash().equalsIgnoreCase(row.getRequestHash())) throw new BusinessException(ReplyErrorCode.CONFLICT);
            return result(existing, true);
        }
        var latest = mapper.latest(row.getReviewId());
        row.setId(null); row.setCreatedAt(latest == null ? null : latest.getCreatedAt());
        mapper.insert(row);
        return result(row, false);
    }

    private ReplyPublishVo result(ReplyEntity row, boolean replayed) {
        var result = new ReplyPublishVo(); result.setReplyId(row.getId().toString());
        result.setReviewId(Long.toString(row.getReviewId())); result.setReplayed(replayed); return result;
    }
}
