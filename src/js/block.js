/**
 * 方块元素系统 - 适配抖音小游戏Canvas环境
 * 重新设计的俄罗斯方块风格实现，支持8种方块类型
 */

// 方块状态常量
var BlockStates = {
    idle: 'idle', 
    moving: 'moving', 
    selected: 'selected', 
    exiting: 'exiting', 
    eliminated: 'eliminated'
};

// 颜色配置 - 随机分配的颜色
var BLOCK_COLORS = {
    red: {
        name: 'red',
        gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
        glowColor: 'rgba(255, 107, 107, 0.6)',
        hex: '#FF6B6B'
    },
    blue: {
        name: 'blue',
        gradient: 'linear-gradient(135deg, #45B7D1, #6BC5D8)',
        glowColor: 'rgba(69, 183, 209, 0.6)',
        hex: '#45B7D1'
    },
    green: {
        name: 'green',
        gradient: 'linear-gradient(135deg, #96CEB4, #A8E6CF)',
        glowColor: 'rgba(150, 206, 180, 0.6)',
        hex: '#96CEB4'
    },
    yellow: {
        name: 'yellow',
        gradient: 'linear-gradient(135deg, #FFEAA7, #FFF3CD)',
        glowColor: 'rgba(255, 234, 167, 0.6)',
        hex: '#FFEAA7'
    },
    purple: {
        name: 'purple',
        gradient: 'linear-gradient(135deg, #DDA0DD, #E6B3E6)',
        glowColor: 'rgba(221, 160, 221, 0.6)',
        hex: '#DDA0DD'
    },
    orange: {
        name: 'orange',
        gradient: 'linear-gradient(135deg, #FFA500, #FFB347)',
        glowColor: 'rgba(255, 165, 0, 0.6)',
        hex: '#FFA500'
    }
};

// 方块类型定义 - 8种方块类型，每种方向定义为独立对象
var BLOCK_TYPES = {
    // 1. 单格方块 (Single)
    single: {
        name: 'single',
        description: '单格方块',
        blocks: [[0, 0]],
        width: 1,
        height: 1
    },
    
    // 2. 直线方块 (Line2) - 水平方向
    line2_h: {
        name: 'line2_h',
        description: '直线方块(水平)',
        blocks: [[0, 0], [1, 0]],
        width: 2,
        height: 1
    },
    
    // 2. 直线方块 (Line2) - 垂直方向
    line2_v: {
        name: 'line2_v',
        description: '直线方块(垂直)',
        blocks: [[0, 0], [0, 1]],
        width: 1,
        height: 2
    },
    
    // 3. 长直线方块 (Line3) - 水平方向
    line3_h: {
        name: 'line3_h',
        description: '长直线方块(水平)',
        blocks: [[0, 0], [1, 0], [2, 0]],
        width: 3,
        height: 1
    },
    
    // 3. 长直线方块 (Line3) - 垂直方向
    line3_v: {
        name: 'line3_v',
        description: '长直线方块(垂直)',
        blocks: [[0, 0], [0, 1], [0, 2]],
        width: 1,
        height: 3
    },
    
    // 4. 正方形方块 (Square)
    square: {
        name: 'square',
        description: '正方形方块',
        blocks: [[0, 0], [1, 0], [0, 1], [1, 1]],
        width: 2,
        height: 2
    },
    
    // 5. L形方块 (L-Shape) - 向上
    lshape_up: {
        name: 'lshape_up',
        description: 'L形方块(向上)',
        blocks: [[0, 0], [0, 1], [0, 2], [1, 2]],
        width: 2,
        height: 3
    },
    
    // 5. L形方块 (L-Shape) - 向右
    lshape_right: {
        name: 'lshape_right',
        description: 'L形方块(向右)',
        blocks: [[0, 0], [1, 0], [2, 0], [0, 1]],
        width: 3,
        height: 2
    },
    
    // 5. L形方块 (L-Shape) - 向下
    lshape_down: {
        name: 'lshape_down',
        description: 'L形方块(向下)',
        blocks: [[0, 0], [1, 0], [1, 1], [1, 2]],
        width: 2,
        height: 3
    },
    
    // 5. L形方块 (L-Shape) - 向左
    lshape_left: {
        name: 'lshape_left',
        description: 'L形方块(向左)',
        blocks: [[2, 0], [0, 1], [1, 1], [2, 1]],
        width: 3,
        height: 2
    },
    
    // 6. T形方块 (T-Shape) - 向上
    tshape_up: {
        name: 'tshape_up',
        description: 'T形方块(向上)',
        blocks: [[0, 0], [1, 0], [2, 0], [1, 1]],
        width: 3,
        height: 2
    },
    
    // 6. T形方块 (T-Shape) - 向右
    tshape_right: {
        name: 'tshape_right',
        description: 'T形方块(向右)',
        blocks: [[1, 0], [0, 1], [1, 1], [1, 2]],
        width: 2,
        height: 3
    },
    
    // 6. T形方块 (T-Shape) - 向下
    tshape_down: {
        name: 'tshape_down',
        description: 'T形方块(向下)',
        blocks: [[1, 0], [0, 1], [1, 1], [2, 1]],
        width: 3,
        height: 2
    },
    
    // 6. T形方块 (T-Shape) - 向左
    tshape_left: {
        name: 'tshape_left',
        description: 'T形方块(向左)',
        blocks: [[0, 0], [0, 1], [1, 1], [0, 2]],
        width: 2,
        height: 3
    },
    
    // 7. H形方块 (H-Shape) - 向上
    hshape_up: {
        name: 'hshape_up',
        description: 'H形方块(向上)',
        blocks: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2]],
        width: 3,
        height: 3
    },
    
    // 7. H形方块 (H-Shape) - 向右
    hshape_right: {
        name: 'hshape_right',
        description: 'H形方块(向右)',
        blocks: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 2]],
        width: 3,
        height: 3
    },
    
    // 7. H形方块 (H-Shape) - 向下
    hshape_down: {
        name: 'hshape_down',
        description: 'H形方块(向下)',
        blocks: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2]],
        width: 3,
        height: 3
    },
    
    // 7. H形方块 (H-Shape) - 向左
    hshape_left: {
        name: 'hshape_left',
        description: 'H形方块(向左)',
        blocks: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 2]],
        width: 3,
        height: 3
    },
    
    // 8. 三角方块 (Triangle-Shape) - 向上
    triangle_up: {
        name: 'triangle_up',
        description: '三角方块(向上)',
        blocks: [[1, 0], [0, 1], [1, 1], [2, 1]],
        width: 3,
        height: 2
    },
    
    // 8. 三角方块 (Triangle-Shape) - 向右
    triangle_right: {
        name: 'triangle_right',
        description: '三角方块(向右)',
        blocks: [[0, 0], [0, 1], [1, 1], [0, 2]],
        width: 2,
        height: 3
    },
    
    // 8. 三角方块 (Triangle-Shape) - 向下
    triangle_down: {
        name: 'triangle_down',
        description: '三角方块(向下)',
        blocks: [[0, 0], [1, 0], [2, 0], [1, 1]],
        width: 3,
        height: 2
    },
    
    // 8. 三角方块 (Triangle-Shape) - 向左
    triangle_left: {
        name: 'triangle_left',
        description: '三角方块(向左)',
        blocks: [[1, 0], [2, 1], [1, 1], [1, 2]],
        width: 2,
        height: 3
    }
};

// 随机颜色分配函数
var getRandomColor = function() {
    var colorKeys = Object.keys(BLOCK_COLORS);
    var randomIndex = Math.floor(Math.random() * colorKeys.length);
    return colorKeys[randomIndex];
};

// 随机方块类型分配函数
var getRandomBlockType = function() {
    var typeKeys = Object.keys(BLOCK_TYPES);
    var randomIndex = Math.floor(Math.random() * typeKeys.length);
    return typeKeys[randomIndex];
};

// 创建方块 - 重新设计的方块创建系统
var createBlock = function (id, blockType, color, position, layer, options) {
    layer = layer || 0;
    options = options || {};

    // 如果没有指定颜色，随机分配
    if (!color) {
        color = getRandomColor();
    }
    
    // 如果没有指定方块类型，随机分配
    if (!blockType) {
        blockType = getRandomBlockType();
    }


    var colorData = BLOCK_COLORS[color];
    var typeData = BLOCK_TYPES[blockType];

    if (!colorData) {
        console.error('无效的颜色: ' + color);
        return null;
    }

    if (!typeData) {
        console.error('无效的方块类型: ' + blockType);
        return null;
    }

    var block = {
        id: id,
        type: blockType,
        typeData: typeData,
        color: color,
        colorData: colorData,
        position: position,
        layer: layer,
        state: BlockStates.idle,
        element: null,
        animations: {},
        isSelected: false,
        isMoving: false,
        // 冰块属性
        isIce: options.isIce || false,
        // 其他属性
        alpha: options.alpha || 1,
        scale: options.scale || 1
    };

    // 创建Canvas元素
    block.element = {
        x: position.x * GAME_CONFIG.CELL_SIZE,
        y: position.y * GAME_CONFIG.CELL_SIZE,
        width: typeData.width * GAME_CONFIG.CELL_SIZE,
        height: typeData.height * GAME_CONFIG.CELL_SIZE,
        blocks: typeData.blocks,
        color: colorData.gradient,
        scale: block.scale,
        rotation: 0, // Canvas旋转角度
        alpha: block.alpha,
    };

    return block;
};

// 绘制方块到Canvas - 重新设计的绘制系统
var drawBlock = function (ctx, block, startX, startY) {
    startX = startX || 0;
    startY = startY || 0;

    var element = block.element;
    var x = startX + element.x;
    var y = startY + element.y;

    ctx.save();
    ctx.globalAlpha = element.alpha;
    
    // 应用变换
    ctx.translate(x + element.width / 2, y + element.height / 2);
    ctx.scale(element.scale, element.scale);
    ctx.translate(-element.width / 2, -element.height / 2);

    // 绘制方块
    element.blocks.forEach(function (blockPart) {
        var blockX = blockPart[0] * GAME_CONFIG.CELL_SIZE;
        var blockY = blockPart[1] * GAME_CONFIG.CELL_SIZE;

        // 绘制方块背景
        ctx.fillStyle = getColorFromGradient(element.color);
        ctx.fillRect(blockX, blockY, GAME_CONFIG.CELL_SIZE, GAME_CONFIG.CELL_SIZE);

        // 绘制边框
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, GAME_CONFIG.CELL_SIZE, GAME_CONFIG.CELL_SIZE);

        // 如果是冰块，绘制冰块效果
        if (block.isIce) {
            drawIceEffect(ctx, blockX, blockY);
        }
    });

    ctx.restore();
};

// 绘制冰块效果
var drawIceEffect = function(ctx, x, y) {
    ctx.save();
    
    // 绘制冰块覆盖层
    ctx.fillStyle = 'rgba(173, 216, 230, 0.6)';
    ctx.fillRect(x, y, GAME_CONFIG.CELL_SIZE, GAME_CONFIG.CELL_SIZE);
    
    // 绘制冰块边框
    ctx.strokeStyle = 'rgba(135, 206, 235, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, GAME_CONFIG.CELL_SIZE, GAME_CONFIG.CELL_SIZE);
    
    // 绘制冰块纹理
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x + GAME_CONFIG.CELL_SIZE - 5, y + GAME_CONFIG.CELL_SIZE - 5);
    ctx.moveTo(x + GAME_CONFIG.CELL_SIZE - 5, y + 5);
    ctx.lineTo(x + 5, y + GAME_CONFIG.CELL_SIZE - 5);
    ctx.stroke();
    
    ctx.restore();
};

// 获取方块的旋转版本（返回新的方块类型名称）
var getRotatedBlockType = function(blockType, direction) {
    direction = direction || 1; // 1为顺时针，-1为逆时针
    
    var rotationMap = {
        // Line2 旋转
        'line2_h': 'line2_v',
        'line2_v': 'line2_h',
        
        // Line3 旋转
        'line3_h': 'line3_v',
        'line3_v': 'line3_h',
        
        // L-Shape 旋转
        'lshape_up': 'lshape_right',
        'lshape_right': 'lshape_down',
        'lshape_down': 'lshape_left',
        'lshape_left': 'lshape_up',
        
        // T-Shape 旋转
        'tshape_up': 'tshape_right',
        'tshape_right': 'tshape_down',
        'tshape_down': 'tshape_left',
        'tshape_left': 'tshape_up',
        
        // H-Shape 旋转
        'hshape_up': 'hshape_right',
        'hshape_right': 'hshape_down',
        'hshape_down': 'hshape_left',
        'hshape_left': 'hshape_up',
        
        // Triangle 旋转
        'triangle_up': 'triangle_right',
        'triangle_right': 'triangle_down',
        'triangle_down': 'triangle_left',
        'triangle_left': 'triangle_up'
    };
    
    if (direction === -1) {
        // 逆时针旋转，需要反转映射
        var reverseMap = {};
        for (var key in rotationMap) {
            reverseMap[rotationMap[key]] = key;
        }
        return reverseMap[blockType] || blockType;
    }
    
    return rotationMap[blockType] || blockType;
};

// 创建冰块方块（便捷函数）
var createIceBlock = function(id, blockType, color, position, layer) {
    return createBlock(id, blockType, color, position, layer, {
        isIce: true
    });
};

// 融化冰块（整个方块一起融化）
var meltIce = function(block) {
    if (block.isIce) {
        block.isIce = false;
    }
    return block;
};

// 确保在抖音小游戏环境中可用
if (typeof window !== 'undefined') {
    window.BlockStates = BlockStates;
    window.BLOCK_COLORS = BLOCK_COLORS;
    window.BLOCK_TYPES = BLOCK_TYPES;
    window.getRandomColor = getRandomColor;
    window.getRandomBlockType = getRandomBlockType;
    window.createBlock = createBlock;
    window.drawBlock = drawBlock;
    window.drawIceEffect = drawIceEffect;
    window.getRotatedBlockType = getRotatedBlockType;
    window.createIceBlock = createIceBlock;
    window.meltIce = meltIce;
} else if (typeof global !== 'undefined') {
    global.BlockStates = BlockStates;
    global.BLOCK_COLORS = BLOCK_COLORS;
    global.BLOCK_TYPES = BLOCK_TYPES;
    global.getRandomColor = getRandomColor;
    global.getRandomBlockType = getRandomBlockType;
    global.createBlock = createBlock;
    global.drawBlock = drawBlock;
    global.drawIceEffect = drawIceEffect;
    global.getRotatedBlockType = getRotatedBlockType;
    global.createIceBlock = createIceBlock;
    global.meltIce = meltIce;
} else {
    // 在抖音小游戏环境中，直接设置为全局变量
    this.BlockStates = BlockStates;
    this.BLOCK_COLORS = BLOCK_COLORS;
    this.BLOCK_TYPES = BLOCK_TYPES;
    this.getRandomColor = getRandomColor;
    this.getRandomBlockType = getRandomBlockType;
    this.createBlock = createBlock;
    this.drawBlock = drawBlock;
    this.drawIceEffect = drawIceEffect;
    this.getRotatedBlockType = getRotatedBlockType;
    this.createIceBlock = createIceBlock;
    this.meltIce = meltIce;
}
