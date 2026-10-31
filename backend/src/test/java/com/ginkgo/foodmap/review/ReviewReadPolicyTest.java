package com.ginkgo.foodmap.review;

import com.ginkgo.foodmap.review.policy.ReviewReadPolicy;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;

/** 杯型使用原始十进制比较，防止显示舍入把边界下方分数提档。 */
class ReviewReadPolicyTest {
    @ParameterizedTest
    @CsvSource({"0,small","4.999,small","5,medium","6.199,medium","6.2,large",
            "7.399,large","7.4,super","8.599,super","8.6,bucket","10,bucket"})
    void comparesExactTierBoundaries(String value,String tier) {
        assertThat(ReviewReadPolicy.tier(new BigDecimal(value))).isEqualTo(tier);
    }
}
