/**
 * 地图1：完整俄罗斯方块 Puzzle (8x8网格)
 * 难度：中等
 * 目标：让所有方块通过对应颜色的门离开
 * 包含：所有俄罗斯方块形状、水泥砖、冰块
 */

const map1 = {
    level: 1, name: "完整俄罗斯方块", description: "包含所有俄罗斯方块形状的挑战关卡", difficulty: "中等",

    // 门配置 - 四边各有一个门
    gates: [{
        id: "gate_up_red", color: "red", position: {x: 2, y: 0}, size: {width: 3, height: 2}, direction: "up"
    }, {
        id: "gate_right_blue", color: "blue", position: {x: 6, y: 2}, size: {width: 2, height: 3}, direction: "right"
    }, {
        id: "gate_down_green", color: "green", position: {x: 2, y: 6}, size: {width: 3, height: 2}, direction: "down"
    }, {
        id: "gate_left_yellow", color: "yellow", position: {x: 0, y: 2}, size: {width: 2, height: 3}, direction: "left"
    }, {
        id: "gate_up_purple", color: "purple", position: {x: 5, y: 0}, size: {width: 2, height: 2}, direction: "up"
    }],

    // 俄罗斯方块配置 - 重新设计的2层结构
    tetrisBlocks: [
        // 第0层 - 顶层方块（可见，可移动，完全遮挡下层）
        {
            id: "red_single", color: "red", position: {x: 1, y: 0}, shape: "single", layer: 0
        }, {
            id: "blue_line", color: "blue", position: {x: 3, y: 0}, shape: "line2", layer: 0
        }, {
            id: "green_line3", color: "green", position: {x: 5, y: 0}, shape: "line3", layer: 0
        }, {
            id: "yellow_square", color: "yellow", position: {x: 0, y: 1}, shape: "square", layer: 0
        }, {
            id: "purple_lshape", color: "purple", position: {x: 4, y: 1}, shape: "lshape", layer: 0
        },

        // 第1层 - 隐藏的方块（被上层完全遮挡，显示为冰块）
        // 确保每个格子都被第0层遮挡，且石块(3,3)上方无任何方块
        {
            id: "hidden_red", color: "red", position: {x: 1, y: 1}, shape: "single", layer: 1
        }, {
            id: "hidden_blue", color: "blue", position: {x: 3, y: 1}, shape: "line2", layer: 1
        }, {
            id: "hidden_yellow", color: "yellow", position: {x: 0, y: 2}, shape: "square", layer: 1
        }, {
            id: "hidden_purple", color: "purple", position: {x: 4, y: 2}, shape: "lshape", layer: 1
        }
        // 遮挡检查：
        // red_single(1,0) 遮挡 hidden_red(1,1) ✅
        // blue_line2(3,0)(4,0) 遮挡 hidden_blue(3,1)(4,1) ✅  
        // green_line3(5,0)(6,0)(7,0) 没有下层方块 ✅
        // yellow_square(0,1)(1,1)(0,2)(1,2) 遮挡 hidden_yellow(0,2)(1,2)(0,3)(1,3) ✅
        // purple_lshape(4,1)(4,2)(4,3)(5,3) 遮挡 hidden_purple(4,2)(4,3)(4,4)(5,4) ✅
        // 石块(3,3)上方无任何方块 ✅
    ],

    // 石块配置 - 中心一个岩石作为障碍物
    rocks: [{
        id: "rock_center", position: {x: 3, y: 3}, layer: 0
    }],

    // 游戏规则配置
    rules: {
        maxMoves: 50, // 最大移动次数
        timeLimit: 300, // 时间限制（秒）
        hints: 3 // 提示次数
    },


    // 提示信息
    hints: [
        "点击方块选择，然后点击目标位置移动", 
        "方块会使用智能路径规划自动避开障碍物", 
        "移动上层方块后，下层的隐藏方块会显露出来", 
        "方块必须通过对应颜色的门才能离开", 
        "方块的尺寸必须小于门的尺寸", 
        "石块是不可移动的障碍物", 
        "尝试移动方块来\"挖出\"被隐藏的方块",
        "第1层的方块被部分遮挡时显示为冰块🧊",
        "第1层的方块被完全遮挡时不显示冰块",
        "移动第0层方块后，第1层方块完全显露时冰块融化",
        "本关有5种颜色的方块：红、蓝、绿、黄、紫",
        "绿色方块在第0层，移动后不会露出冰块",
        "每种颜色都有对应的门，需要全部通过才能胜利"
    ]
};

// 导出地图数据
if (typeof window !== 'undefined') {
    window.map1 = map1;
} else if (typeof global !== 'undefined') {
    global.map1 = map1;
} else {
    this.map1 = map1;
}
