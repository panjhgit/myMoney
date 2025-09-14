/**
 * 地图1：完整俄罗斯方块 Puzzle (8x8网格)
 * 难度：中等
 * 目标：让所有方块通过对应颜色的门离开
 * 包含：所有俄罗斯方块形状、水泥砖、冰块
 */

var map1 = {
    level: 1, name: "完整俄罗斯方块", description: "包含所有俄罗斯方块形状的挑战关卡", difficulty: "中等",

    // 门配置 - 重新设计避免重叠
    gates: [{
        id: "gate_up_red", color: "red", position: {x: 1, y: 0}, length: 2, direction: "up"
    }, {
        id: "gate_up_purple", color: "purple", position: {x: 4, y: 0}, length: 2, direction: "up"
    }, {
        id: "gate_right_blue", color: "blue", position: {x: 7, y: 1}, length: 2, direction: "right"
    }, {
        id: "gate_right_orange", color: "orange", position: {x: 7, y: 4}, length: 3, direction: "right"
    }, {
        id: "gate_down_green", color: "green", position: {x: 1, y: 7}, length: 2, direction: "down"
    }, {
        id: "gate_left_yellow", color: "yellow", position: {x: 0, y: 3}, length: 2, direction: "left"
    }],

    // 俄罗斯方块配置 - 使用新的方块类型定义
    tetrisBlocks: [
        // 第0层 - 顶层方块（可见，可移动，完全遮挡下层）
        {
            id: "red_single", color: "red", position: {x: 1, y: 0}, blockType: "single", layer: 0
        }, {
            id: "blue_line", color: "blue", position: {x: 3, y: 0}, blockType: "line2_h", layer: 0
        }, {
            id: "green_line3", color: "green", position: {x: 5, y: 0}, blockType: "line3_h", layer: 0
        }, {
            id: "yellow_square", color: "yellow", position: {x: 0, y: 1}, blockType: "square", layer: 0
        }, {
            id: "purple_lshape", color: "purple", position: {x: 4, y: 1}, blockType: "lshape_up", layer: 0
        }, {
            id: "orange_hshape", color: "orange", position: {x: 0, y: 3}, blockType: "hshape_up", layer: 0
        },

        // 第1层 - 隐藏的方块（被上层完全遮挡，显示为冰块）
        // 确保每个格子都被第0层遮挡，且石块(3,3)上方无任何方块
        {
            id: "hidden_red", color: "red", position: {x: 1, y: 1}, blockType: "single", layer: 1, isIce: true
        }, {
            id: "hidden_blue", color: "blue", position: {x: 3, y: 1}, blockType: "line2_h", layer: 1, isIce: true
        }, {
            id: "hidden_yellow", color: "yellow", position: {x: 0, y: 2}, blockType: "square", layer: 1, isIce: true
        }, {
            id: "hidden_purple", color: "purple", position: {x: 4, y: 2}, blockType: "lshape_up", layer: 1, isIce: true
        }

    ],

    // 石块配置 - 中心一个岩石作为障碍物
    rocks: [{
        id: "rock_center", position: {x: 3, y: 3}, layer: 0
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
