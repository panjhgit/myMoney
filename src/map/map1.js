/**
 * 地图1：完整俄罗斯方块 Puzzle (10x10网格) - 新棋盘系统版本
 * 难度：中等
 * 目标：让所有方块通过对应颜色的门离开
 * 包含：所有俄罗斯方块形状、水泥砖、冰块
 * 设计：外围墙/门设计，内部8x8核心游戏区域
 */

var map1 = {
    level: 1, name: "完整俄罗斯方块", description: "10x10棋盘，外围墙门设计，内部8x8核心区域", difficulty: "中等",

    // 新棋盘系统 - 数字矩阵 (10x10棋盘)
    boardMatrix: [[1, 2, 2, 2, 1, 1, 3, 3, 3, 1], // 第0行：墙+红色门(1,2,3)+墙+蓝色门(6,7,8)+墙
        [5, 0, 0, 0, 0, 0, 0, 0, 0, 4], // 第1行：黄色门+8x8核心游戏区域+绿色门
        [5, 0, 0, 0, 0, 10, 0, 0, 0, 4], // 第2行：黄色门+8x8核心游戏区域+砖块(6,2)+绿色门
        [5, 0, 0, 0, 0, 0, 0, 0, 0, 4], // 第3行：黄色门+8x8核心游戏区域+绿色门
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1], // 第4行：墙+8x8核心游戏区域+墙
        [1, 0, 0, 0, 0, 0, 10, 0, 0, 1], // 第5行：墙+8x8核心游戏区域+砖块(7,4)+墙
        [6, 0, 0, 0, 0, 0, 0, 0, 0, 7], // 第6行：紫色门+8x8核心游戏区域+橙色门
        [6, 0, 0, 0, 0, 0, 0, 0, 0, 7], // 第7行：紫色门+8x8核心游戏区域+橙色门
        [6, 0, 0, 0, 0, 0, 0, 0, 0, 7], // 第8行：紫色门+8x8核心游戏区域+橙色门
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // 第9行：全墙边界
    ],

    // 俄罗斯方块配置 - 使用新的方块类型定义
    tetrisBlocks: [// 第0层 - 顶层方块（可见，可移动，完全遮挡下层）
        // 位置调整为8×8游戏区域 (0,0) 到 (7,7)
        {
            id: "red_single", color: "red", position: {x: 1, y: 1}, blockType: "single", layer: 0
        }, {
            id: "blue_line", color: "blue", position: {x: 3, y: 1}, blockType: "line2_h", layer: 0
        }, {
            id: "green_line3", color: "green", position: {x: 5, y: 1}, blockType: "line3_h", layer: 0
        }, {
            id: "yellow_square", color: "yellow", position: {x: 1, y: 3}, blockType: "square", layer: 0
        }, {
            id: "purple_lshape", color: "purple", position: {x: 3, y: 3}, blockType: "lshape_up", layer: 0
        }, {
            id: "orange_hshape", color: "orange", position: {x: 5, y: 5}, blockType: "hshape_up", layer: 0
        },

        // 第1层 - 隐藏的方块（被上层完全遮挡，显示为冰块）
        {
            id: "hidden_red", color: "red", position: {x: 1, y: 1}, blockType: "single", layer: 1, isIce: true
        }, {
            id: "hidden_blue", color: "blue", position: {x: 3, y: 1}, blockType: "line2_h", layer: 1, isIce: true
        }, {
            id: "hidden_green", color: "green", position: {x: 5, y: 1}, blockType: "line3_h", layer: 1, isIce: true
        }, {
            id: "hidden_yellow", color: "yellow", position: {x: 1, y: 3}, blockType: "square", layer: 1, isIce: true
        }]
};

// 导出地图数据
window.map1 = map1;

// 自动验证地图布局
if (typeof window.MapLayoutValidator !== 'undefined') {
    console.log('正在验证 map1 布局...');
    const validationResult = window.validateMapLayout(map1);
    if (!validationResult.isValid) {
        console.error('Map1 布局验证失败！');
    } else {
        console.log('Map1 布局验证通过 ✅');
    }
}