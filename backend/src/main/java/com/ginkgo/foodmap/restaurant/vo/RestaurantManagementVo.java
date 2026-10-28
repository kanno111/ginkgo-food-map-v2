package com.ginkgo.foodmap.restaurant.vo;

import lombok.Data;

/** 仅创建者/管理员可读的管理资料，不暴露他人账号、删除原因或编辑版本。 */
@Data
public class RestaurantManagementVo {
    private RestaurantVo restaurant;
    private boolean deleted;
}
