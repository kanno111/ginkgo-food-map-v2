package com.ginkgo.foodmap.restaurant.mapper;

import com.ginkgo.foodmap.restaurant.dto.RestaurantListQuery;
import com.ginkgo.foodmap.restaurant.entity.RestaurantCategoryEntity;
import com.ginkgo.foodmap.restaurant.entity.RestaurantEntity;
import com.ginkgo.foodmap.restaurant.entity.RestaurantTagEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 仅查询 restaurant 模块自己的三张表，全部 SQL 位于同名 XML。
 * 不继承通用 CRUD Mapper，防止调用默认 selectById 绕过 deleted_at 显式过滤。
 */
@Mapper
public interface RestaurantCatalogMapper {
    /** 包含停用分类以支持旧记录筛选，按字典顺序和编码稳定返回。 */
    List<RestaurantCategoryEntity> selectCategories();

    /** 公开详情只读未删除餐厅，缺失和已删除均返回 null。 */
    RestaurantEntity selectVisibleById(@Param("id") long id);

    /** 与分页共用 WHERE 片段，不通过标签连接重复计数。 */
    long countVisible(@Param("query") RestaurantListQuery query);

    /** 全局筛选与白名单排序在 LIMIT 之前执行，offset 使用 long。 */
    List<RestaurantEntity> selectVisiblePage(@Param("query") RestaurantListQuery query);

    /** 仅批量读取本页可见餐厅的标签，并再次检查父餐厅未删除。 */
    List<RestaurantTagEntity> selectVisibleTags(@Param("ids") List<Long> ids);
}
