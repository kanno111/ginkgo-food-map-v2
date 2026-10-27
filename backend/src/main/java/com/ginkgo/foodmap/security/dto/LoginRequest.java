package com.ginkgo.foodmap.security.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.ToString;

/** 登录只接受用户名和原样密码；密码不参与日志输出，也不执行 trim。 */
@Data
public class LoginRequest {
    @NotBlank(message = "请输入用户名")
    @Size(max = 64, message = "用户名过长")
    private String username;

    @NotBlank(message = "请输入密码")
    @Size(max = 72, message = "密码过长")
    @ToString.Exclude
    private String password;
}
