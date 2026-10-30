package com.ginkgo.foodmap.review.exception;

import com.ginkgo.foodmap.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/** 文本发布的可公开错误；不将数据库信息或用户正文写入错误提示。 */
@Getter
@RequiredArgsConstructor
public enum ReviewErrorCode implements ErrorCode {
    INVALID_CURSOR("REVIEW_INVALID_CURSOR", HttpStatus.BAD_REQUEST, "历史游标无效或不属于该餐厅和作者，请刷新点评列表"),
    INVALID_QUERY("REVIEW_INVALID_QUERY", HttpStatus.BAD_REQUEST, "餐厅ID必须为规范正整数"),
    INVALID_INPUT("REVIEW_INVALID_INPUT", HttpStatus.BAD_REQUEST, "请检查UUID、四维半分、推荐及5–500字正文"),
    REQUEST_CONFLICT("REVIEW_REQUEST_CONFLICT", HttpStatus.CONFLICT, "本次提交编号已用于不同内容，请核对提交结果"),
    BUSY("REVIEW_TEMPORARILY_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE, "发布暂时繁忙，请保留内容及提交编号重试");

    private final String code;
    private final HttpStatus httpStatus;
    private final String defaultMessage;
}
