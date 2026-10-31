package com.ginkgo.foodmap.review.exception;

import com.ginkgo.foodmap.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/** 回复错误单独命名，避免误用点评的5–500字提示。 */
@Getter
@RequiredArgsConstructor
public enum ReplyErrorCode implements ErrorCode {
    INVALID_INPUT("REPLY_INVALID_INPUT", HttpStatus.BAD_REQUEST, "请检查点评ID、UUID及1–200字回复正文"),
    INVALID_CURSOR("REPLY_INVALID_CURSOR", HttpStatus.BAD_REQUEST, "回复游标无效，请重新加载回复"),
    NOT_FOUND("REPLY_REVIEW_NOT_FOUND", HttpStatus.NOT_FOUND, "点评不存在"),
    CONFLICT("REPLY_REQUEST_CONFLICT", HttpStatus.CONFLICT, "本次回复编号已用于不同内容"),
    BUSY("REPLY_TEMPORARILY_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE, "回复暂时繁忙，请保留正文和提交编号重试");
    private final String code;
    private final HttpStatus httpStatus;
    private final String defaultMessage;
}
