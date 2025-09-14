/**
 * 地图1：完整俄罗斯方块 Puzzle (8x8网格) - 新棋盘系统版本
 * 难度：中等
 * 目标：让所有方块通过对应颜色的门离开
 * 包含：所有俄罗斯方块形状、水泥砖、冰块
 */

var map1 = {
    level: 1, 
    name: "完整俄罗斯方块", 
    description: "包含所有俄罗斯方块形状的挑战关卡", 
    difficulty: "中等",

    // 新棋盘系统 - 数字矩阵 (8x8棋盘)
    boardMatrix: [
        [1,2,2,1,3,3,1,1], // 第0行：红色门(1,2) + 蓝色门(4,5)
        [5,0,0,0,0,0,0,4], // 第1行：黄色门(0) + 绿色门(7)
        [5,0,0,0,0,0,0,4], // 第2行：黄色门(0) + 绿色门(7)
        [5,0,0,0,0,0,0,1], // 第3行：黄色门(0)
        [5,0,0,0,0,0,0,7], // 第4行：黄色门(0) + 橙色门(7)
        [5,0,0,0,0,0,0,7], // 第5行：黄色门(0) + 橙色门(7)
        [5,0,0,0,0,0,0,7], // 第6行：黄色门(0) + 橙色门(7)
        [1,6,6,6,0,0,0,1]  // 第7行：紫色门(1,2,3)
    ],

    // 俄罗斯方块配置 - 使用新的方块类型定义
    tetrisBlocks: [
        // 第0层 - 顶层方块（可见，可移动，完全遮挡下层）
        {
            id: "red_single", 
            color: "red", 
            position: {x: 1, y: 1}, 
            blockType: "single", 
            layer: 0
        }, {
            id: "blue_line", 
            color: "blue", 
            position: {x: 3, y: 1}, 
            blockType: "line2_h", 
            layer: 0
        }, {
            id: "green_line3", 
            color: "green", 
            position: {x: 5, y: 1}, 
            blockType: "line3_h", 
            layer: 0
        }, {
            id: "yellow_square", 
            color: "yellow", 
            position: {x: 1, y: 3}, 
            blockType: "square", 
            layer: 0
        }, {
            id: "purple_lshape", 
            color: "purple", 
            position: {x: 4, y: 3}, 
            blockType: "lshape_up", 
            layer: 0
        }, {
            id: "orange_hshape", 
            color: "orange", 
            position: {x: 2, y: 5}, 
            blockType: "hshape_up", 
            layer: 0
        },

        // 第1层 - 隐藏的方块（被上层完全遮挡，显示为冰块）
        {
            id: "hidden_red", 
            color: "red", 
            position: {x: 1, y: 2}, 
            blockType: "single", 
            layer: 1, 
            isIce: true
        }, {
            id: "hidden_blue", 
            color: "blue", 
            position: {x: 3, y: 2}, 
            blockType: "line2_h", 
            layer: 1, 
            isIce: true
        }, {
            id: "hidden_yellow", 
            color: "yellow", 
            position: {x: 1, y: 4}, 
            blockType: "square", 
            layer: 1, 
            isIce: true
        }, {
            id: "hidden_purple", 
            color: "purple", 
            position: {x: 4, y: 4}, 
            blockType: "lshape_up", 
            layer: 1, 
            isIce: true
        }
    ],

    // 石块配置 - 中心一个岩石作为障碍物
    rocks: [{
        id: "rock_center", 
        position: {x: 3, y: 3}, 
        layer: 0
    }]
};

// 导出地图数据
if (typeof window !== 'undefined') {
    window.map1 = map1;
} else if (typeof global !== 'undefined') {
    global.map1 = map1;
} else {
    this.map1 = map1;
}

console.log('地图1已更新为新棋盘系统:', map1.name);