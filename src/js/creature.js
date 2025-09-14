/**
 * 生物/方块绘制工具 - 简化版
 * 只保留必要的绘制功能，移除眼睛系统
 */

// 生物状态常量
var CreatureStates = {
    idle: 'idle', walking: 'walking', celebrating: 'celebrating', eliminated: 'eliminated'
};

// 创建生物/方块 - 简化版，主要用于兼容性
var createCreature = function (row, col, colorData) {
    // 安全检查：确保 colorData 有 blocks 属性
    if (!colorData || !colorData.blocks) {
        console.error('createCreature: colorData 无效或缺少 blocks 属性:', colorData);
        return null;
    }

    var creature = {
        id: row + '-' + col + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9), // 唯一ID
        row: row,
        col: col,
        color: colorData.name,
        colorData: colorData,
        element: null,
        isWalking: false,
        shapeData: colorData // 添加 shapeData 属性，指向 colorData
    };

    // 在抖音小游戏环境中，创建Canvas元素而不是DOM元素
    creature.element = {
        x: col * GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE,
        y: row * GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE,
        width: Math.max.apply(Math, colorData.blocks.map(function (block) {
            return block[0];
        })) + 1,
        height: Math.max.apply(Math, colorData.blocks.map(function (block) {
            return block[1];
        })) + 1,
        blocks: colorData.blocks,
        color: colorData.gradient,
        scale: 1,
        rotation: 0,
        alpha: 1,
    };

    return creature;
};

// 绘制生物/方块到Canvas - 简化版
var drawCreature = function (ctx, creature, startX, startY) {
    startX = startX || 0;
    startY = startY || 0;

    var element = creature.element;
    var x = startX + element.x;
    var y = startY + element.y;

    ctx.save();
    ctx.translate(x + element.width * GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE / 2, y + element.height * GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE / 2);
    ctx.scale(element.scale, element.scale);
    ctx.translate(-element.width * GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE / 2, -element.height * GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE / 2);

    // 绘制方块
    element.blocks.forEach(function (blockPart) {
        var blockX = blockPart[0] * GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE;
        var blockY = blockPart[1] * GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE;

        // 绘制方块背景
        ctx.fillStyle = getColorFromGradient(element.color);
        ctx.fillRect(blockX, blockY, GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE, GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE);

        // 绘制边框
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE, GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE);

        // 不再绘制眼睛
    });

    ctx.restore();
};

// 从渐变字符串中提取颜色
var getColorFromGradient = function (gradientString) {
    if (!gradientString) {
        return '#FF6B6B'; // 默认红色
    }
    
    // 简单的颜色提取，从渐变字符串中提取第一个颜色
    var match = gradientString.match(/#[0-9A-Fa-f]{6}/);
    if (match) {
        return match[0];
    }
    
    // 如果没有找到十六进制颜色，尝试提取RGB颜色
    var rgbMatch = gradientString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        var r = parseInt(rgbMatch[1]);
        var g = parseInt(rgbMatch[2]);
        var b = parseInt(rgbMatch[3]);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    return '#FF6B6B'; // 默认红色
};

// 确保在抖音小游戏环境中可用
if (typeof window !== 'undefined') {
    window.CreatureStates = CreatureStates;
    window.createCreature = createCreature;
    window.drawCreature = drawCreature;
    window.getColorFromGradient = getColorFromGradient;
} else if (typeof global !== 'undefined') {
    global.CreatureStates = CreatureStates;
    global.createCreature = createCreature;
    global.drawCreature = drawCreature;
    global.getColorFromGradient = getColorFromGradient;
} else {
    // 在抖音小游戏环境中，直接设置为全局变量
    this.CreatureStates = CreatureStates;
    this.createCreature = createCreature;
    this.drawCreature = drawCreature;
    this.getColorFromGradient = getColorFromGradient;
}