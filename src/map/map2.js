/**
 * 地图2：翅膀测试地图 - 新棋盘系统版本
 * 包含一个L形木块用于测试翅膀飞行动画
 */

const map2 = {
    level: 2,
    name: "翅膀测试地图",
    description: "包含一个L形木块，可以测试翅膀的扇动效果",
    difficulty: "简单",
    
    // 新棋盘系统 - 数字矩阵 (简单的8x8棋盘，没有门)
    boardMatrix: [
        [1,1,1,1,1,1,1,1], // 第0行：墙
        [1,0,0,0,0,0,0,1], // 第1行：棋盘区域
        [1,0,0,0,0,0,0,1], // 第2行：棋盘区域
        [1,0,0,0,0,0,0,1], // 第3行：棋盘区域
        [1,0,0,0,0,0,0,1], // 第4行：棋盘区域
        [1,0,0,0,0,0,0,1], // 第5行：棋盘区域
        [1,0,0,0,0,0,0,1], // 第6行：棋盘区域
        [1,1,1,1,1,1,1,1]  // 第7行：墙
    ],
    
    // 俄罗斯方块配置 - L形木块用于测试翅膀
    tetrisBlocks: [
        {
            id: "l_block_1",
            color: "purple",
            position: { x: 3, y: 3 }, // 地图中心位置
            blockType: "lshape_up", // 使用新的blockType格式
            layer: 0
        },
        {
            id: "square_block_1",
            color: "yellow",
            position: { x: 1, y: 1 }, // 左上角位置
            blockType: "square", // 使用新的blockType格式
            layer: 0
        }
    ],
    
    // 石块配置（空）
    rocks: []
};

// 导出地图数据
console.log('Map2 正在加载，方块数量:', map2.tetrisBlocks.length);
if (typeof window !== 'undefined') {
    window.map2 = map2;
    console.log('Map2 已导出到 window.map2');
} else if (typeof global !== 'undefined') {
    global.map2 = map2;
    console.log('Map2 已导出到 global.map2');
} else {
    this.map2 = map2;
    console.log('Map2 已导出到 this.map2');
}

console.log('地图2已更新为新棋盘系统:', map2.name);