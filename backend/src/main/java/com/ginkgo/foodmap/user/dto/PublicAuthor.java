package com.ginkgo.foodmap.user.dto;

import lombok.Data;

/** 跨模块公开作者信息白名单；邮箱、角色、账号状态与凭证不进入投影。 */
@Data
public class PublicAuthor {
    private String id;
    private String username;
}
