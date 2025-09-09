// 生物状态常量
var CreatureStates = {
    idle: 'idle', walking: 'walking', celebrating: 'celebrating', eliminated: 'eliminated'
};

// 生物配置常量 - 使用统一配置
var CREATURE_CONFIG = GAME_CONFIG.CREATURE_CONFIG;

// 创建俄罗斯方块风格的小人 - 适配抖音小游戏Canvas环境
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
        x: col * CREATURE_CONFIG.CELL_SIZE,
        y: row * CREATURE_CONFIG.CELL_SIZE,
        width: Math.max.apply(Math, colorData.blocks.map(function (block) {
            return block[0];
        })) + 1,
        height: Math.max.apply(Math, colorData.blocks.map(function (block) {
            return block[1];
        })) + 1,
        blocks: colorData.blocks,
        color: colorData.name, // 使用颜色名称而不是渐变字符串
        gradient: colorData.gradient, // 保存渐变字符串
        scale: 1,
        rotation: 0,
        alpha: 1,
        eyeType: colorData.eyeType || 'circle' // 添加眼睛类型
    };

    return creature;
};

// 绘制生物到Canvas - 适配抖音小游戏环境
var drawCreature = function (ctx, creature, startX, startY) {
    startX = startX || 0;
    startY = startY || 0;

    var element = creature.element;
    var x = startX + element.x;
    var y = startY + element.y;

    ctx.save();
    ctx.translate(x + element.width * CREATURE_CONFIG.CELL_SIZE / 2, y + element.height * CREATURE_CONFIG.CELL_SIZE / 2);
    ctx.scale(element.scale, element.scale);
    ctx.translate(-element.width * CREATURE_CONFIG.CELL_SIZE / 2, -element.height * CREATURE_CONFIG.CELL_SIZE / 2);

    // 绘制生物方块
    element.blocks.forEach(function (block) {
        var blockX = block[0] * CREATURE_CONFIG.CELL_SIZE;
        var blockY = block[1] * CREATURE_CONFIG.CELL_SIZE;

        // 绘制方块背景
        ctx.fillStyle = getColorFromGradient(element.color);
        ctx.fillRect(blockX, blockY, CREATURE_CONFIG.CELL_SIZE, CREATURE_CONFIG.CELL_SIZE);

        // 绘制边框
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, CREATURE_CONFIG.CELL_SIZE, CREATURE_CONFIG.CELL_SIZE);

        // 绘制眼睛（智能选择位置）
        if (shouldDrawEyesOnBlock(block, element.blocks)) {
            drawEyes(ctx, blockX, blockY, creature.element);
        }
    });


    ctx.restore();
};

// 智能选择眼睛绘制位置
var shouldDrawEyesOnBlock = function (currentBlock, allBlocks) {
    // 安全检查：确保 allBlocks 数组不为空
    if (!allBlocks || allBlocks.length === 0) {
        return false;
    }

    // 对于1x1方块，在唯一方块上绘制眼睛
    if (allBlocks.length === 1) {
        return currentBlock === allBlocks[0];
    }

    // 对于2x2方块，在左上角方块上绘制眼睛
    if (allBlocks.length === 4) {
        // 安全地找到最左上角的方块
        var topLeftBlock = allBlocks[0]; // 初始化为第一个元素
        for (var i = 1; i < allBlocks.length; i++) {
            var block = allBlocks[i];
            if (block[1] < topLeftBlock[1] || (block[1] === topLeftBlock[1] && block[0] < topLeftBlock[0])) {
                topLeftBlock = block;
            }
        }
        return currentBlock === topLeftBlock;
    }

    // 对于其他形状，在第一个方块上绘制眼睛
    return currentBlock === allBlocks[0];
};

// 绘制眼睛 - 支持多种眼睛类型
var drawEyes = function (ctx, blockX, blockY, element) {
    var eyeSize = CREATURE_CONFIG.EYE_SIZE;
    var cellSize = CREATURE_CONFIG.CELL_SIZE;

    // 计算眼睛的精确位置，让它们居中
    var centerX = blockX + cellSize / 2;
    var centerY = blockY + cellSize / 3; // 稍微偏上一点
    var eyeSpacing = CREATURE_CONFIG.EYE_SPACING;

    // 获取眼睛类型配置 - 安全检查
    var eyeType = 'circle'; // 默认眼睛类型
    if (element && element.eyeType && typeof EYE_TYPES !== 'undefined' && EYE_TYPES) {
        eyeType = element.eyeType;
    }

    // 安全地获取眼睛配置，提供默认值
    var eyeConfig;
    if (typeof EYE_TYPES !== 'undefined' && EYE_TYPES && EYE_TYPES[eyeType]) {
        eyeConfig = EYE_TYPES[eyeType];
    } else if (typeof EYE_TYPES !== 'undefined' && EYE_TYPES && EYE_TYPES.circle) {
        eyeConfig = EYE_TYPES.circle;
    } else {
        // 提供一个默认的眼睛配置
        eyeConfig = {
            shape: 'circle', size: 1.0, pupilSize: 0.5, eyebrowStyle: 'curved'
        };
    }

    // 根据眼睛类型调整大小
    var adjustedEyeSize = eyeSize * eyeConfig.size;
    var adjustedEyeSpacing = eyeSpacing * eyeConfig.size;

    // 绘制眉毛
    drawEyebrows(ctx, centerX, centerY, adjustedEyeSize, adjustedEyeSpacing, eyeConfig.eyebrowStyle);

    // 绘制眼睛
    drawOpenEyes(ctx, centerX, centerY, adjustedEyeSize, adjustedEyeSpacing, eyeConfig);
};

// 绘制眉毛
var drawEyebrows = function (ctx, centerX, centerY, eyeSize, eyeSpacing, eyebrowStyle) {
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.2; // 稍微细一点，更可爱
    ctx.lineCap = 'round';

    switch (eyebrowStyle) {
        case 'curved':
            // 弯曲眉毛（默认）
            drawCurvedEyebrows(ctx, centerX, centerY, eyeSize, eyeSpacing);
            break;
        case 'straight':
            // 直线眉毛
            drawStraightEyebrows(ctx, centerX, centerY, eyeSize, eyeSpacing);
            break;
        case 'angular':
            // 角度眉毛
            drawAngularEyebrows(ctx, centerX, centerY, eyeSize, eyeSpacing);
            break;
        case 'droopy':
            // 下垂眉毛
            drawDroopyEyebrows(ctx, centerX, centerY, eyeSize, eyeSpacing);
            break;
        case 'raised':
            // 上扬眉毛
            drawRaisedEyebrows(ctx, centerX, centerY, eyeSize, eyeSpacing);
            break;
        case 'thin':
            // 细眉毛
            ctx.lineWidth = 1;
            drawCurvedEyebrows(ctx, centerX, centerY, eyeSize, eyeSpacing);
            break;
        default:
            drawCurvedEyebrows(ctx, centerX, centerY, eyeSize, eyeSpacing);
    }
};

// 绘制弯曲眉毛 - 优化为更可爱的样式
var drawCurvedEyebrows = function (ctx, centerX, centerY, eyeSize, eyeSpacing) {
    // 左眉毛 - 更柔和的弯曲
    ctx.beginPath();
    ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 2);
    ctx.quadraticCurveTo(centerX - eyeSpacing / 2, centerY - eyeSize - 4, // 稍微降低高度，更柔和
        centerX - eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 2);
    ctx.stroke();

    // 右眉毛 - 更柔和的弯曲
    ctx.beginPath();
    ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 2);
    ctx.quadraticCurveTo(centerX + eyeSpacing / 2, centerY - eyeSize - 4, // 稍微降低高度，更柔和
        centerX + eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 2);
    ctx.stroke();
};

// 绘制直线眉毛
var drawStraightEyebrows = function (ctx, centerX, centerY, eyeSize, eyeSpacing) {
    // 左眉毛
    ctx.beginPath();
    ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 3);
    ctx.lineTo(centerX - eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 3);
    ctx.stroke();

    // 右眉毛
    ctx.beginPath();
    ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 3);
    ctx.lineTo(centerX + eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 3);
    ctx.stroke();
};

// 绘制角度眉毛
var drawAngularEyebrows = function (ctx, centerX, centerY, eyeSize, eyeSpacing) {
    // 左眉毛（V形）
    ctx.beginPath();
    ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 3);
    ctx.lineTo(centerX - eyeSpacing / 2, centerY - eyeSize - 5);
    ctx.lineTo(centerX - eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 3);
    ctx.stroke();

    // 右眉毛（V形）
    ctx.beginPath();
    ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 3);
    ctx.lineTo(centerX + eyeSpacing / 2, centerY - eyeSize - 5);
    ctx.lineTo(centerX + eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 3);
    ctx.stroke();
};

// 绘制下垂眉毛
var drawDroopyEyebrows = function (ctx, centerX, centerY, eyeSize, eyeSpacing) {
    // 左眉毛（向下弯曲）
    ctx.beginPath();
    ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 3);
    ctx.quadraticCurveTo(centerX - eyeSpacing / 2, centerY - eyeSize - 1, centerX - eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 3);
    ctx.stroke();

    // 右眉毛（向下弯曲）
    ctx.beginPath();
    ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 3);
    ctx.quadraticCurveTo(centerX + eyeSpacing / 2, centerY - eyeSize - 1, centerX + eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 3);
    ctx.stroke();
};

// 绘制上扬眉毛
var drawRaisedEyebrows = function (ctx, centerX, centerY, eyeSize, eyeSpacing) {
    // 左眉毛（向上弯曲）
    ctx.beginPath();
    ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 3);
    ctx.quadraticCurveTo(centerX - eyeSpacing / 2, centerY - eyeSize - 7, centerX - eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 3);
    ctx.stroke();

    // 右眉毛（向上弯曲）
    ctx.beginPath();
    ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize / 2, centerY - eyeSize - 3);
    ctx.quadraticCurveTo(centerX + eyeSpacing / 2, centerY - eyeSize - 7, centerX + eyeSpacing / 2 + eyeSize / 2, centerY - eyeSize - 3);
    ctx.stroke();
};

// 绘制睁开的眼睛
var drawOpenEyes = function (ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
    switch (eyeConfig.shape) {
        case 'circle':
            drawCircularEyes(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig);
            break;
        case 'square':
            drawSquareEyes(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig);
            break;
        case 'triangle':
            drawTriangleEyes(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig);
            break;
        case 'star':
            drawStarEyes(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig);
            break;
        default:
            drawCircularEyes(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig);
    }
};

// 绘制圆形眼睛
var drawCircularEyes = function (ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
    // 左眼
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(centerX - eyeSpacing / 2, centerY, eyeSize, 0, 2 * Math.PI);
    ctx.fill();

    // 右眼
    ctx.beginPath();
    ctx.arc(centerX + eyeSpacing / 2, centerY, eyeSize, 0, 2 * Math.PI);
    ctx.fill();

    // 瞳孔
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(centerX - eyeSpacing / 2, centerY, eyeSize * eyeConfig.pupilSize, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + eyeSpacing / 2, centerY, eyeSize * eyeConfig.pupilSize, 0, 2 * Math.PI);
    ctx.fill();
};

// 绘制椭圆形眼睛
var drawEllipticalEyes = function (ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
    // 左眼
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(centerX - eyeSpacing / 2, centerY, eyeSize, eyeSize * 0.7, 0, 0, 2 * Math.PI);
    ctx.fill();

    // 右眼
    ctx.beginPath();
    ctx.ellipse(centerX + eyeSpacing / 2, centerY, eyeSize, eyeSize * 0.7, 0, 0, 2 * Math.PI);
    ctx.fill();

    // 瞳孔
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.ellipse(centerX - eyeSpacing / 2, centerY, eyeSize * eyeConfig.pupilSize, eyeSize * eyeConfig.pupilSize * 0.7, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(centerX + eyeSpacing / 2, centerY, eyeSize * eyeConfig.pupilSize, eyeSize * eyeConfig.pupilSize * 0.7, 0, 0, 2 * Math.PI);
    ctx.fill();
};

// 绘制方形眼睛
var drawSquareEyes = function (ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
    // 左眼
    ctx.fillStyle = 'white';
    ctx.fillRect(centerX - eyeSpacing / 2 - eyeSize, centerY - eyeSize, eyeSize * 2, eyeSize * 2);

    // 右眼
    ctx.fillRect(centerX + eyeSpacing / 2 - eyeSize, centerY - eyeSize, eyeSize * 2, eyeSize * 2);

    // 瞳孔
    ctx.fillStyle = 'black';
    ctx.fillRect(centerX - eyeSpacing / 2 - eyeSize * eyeConfig.pupilSize, centerY - eyeSize * eyeConfig.pupilSize, eyeSize * eyeConfig.pupilSize * 2, eyeSize * eyeConfig.pupilSize * 2);
    ctx.fillRect(centerX + eyeSpacing / 2 - eyeSize * eyeConfig.pupilSize, centerY - eyeSize * eyeConfig.pupilSize, eyeSize * eyeConfig.pupilSize * 2, eyeSize * eyeConfig.pupilSize * 2);
};

// 绘制半圆形眼睛（困倦眼睛）
var drawHalfCircleEyes = function (ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
    // 左眼（上半圆）
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(centerX - eyeSpacing / 2, centerY, eyeSize, Math.PI, 0, false);
    ctx.fill();

    // 右眼（上半圆）
    ctx.beginPath();
    ctx.arc(centerX + eyeSpacing / 2, centerY, eyeSize, Math.PI, 0, false);
    ctx.fill();

    // 瞳孔（小圆点）
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(centerX - eyeSpacing / 2, centerY - eyeSize * 0.3, eyeSize * eyeConfig.pupilSize, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + eyeSpacing / 2, centerY - eyeSize * 0.3, eyeSize * eyeConfig.pupilSize, 0, 2 * Math.PI);
    ctx.fill();
};

// 绘制闭合的眼睛
var drawClosedEyes = function (ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;

    // 左眼闭合线
    ctx.beginPath();
    ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize, centerY);
    ctx.lineTo(centerX - eyeSpacing / 2 + eyeSize, centerY);
    ctx.stroke();

    // 右眼闭合线
    ctx.beginPath();
    ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize, centerY);
    ctx.lineTo(centerX + eyeSpacing / 2 + eyeSize, centerY);
    ctx.stroke();
};

// 从渐变字符串获取颜色（统一版本）
var getColorFromGradient = function (gradientString) {
    if (!gradientString || typeof gradientString !== 'string') {
        return '#666666';
    }

    if (gradientString.includes('red')) return '#FF6B6B';
    if (gradientString.includes('blue')) return '#45B7D1';
    if (gradientString.includes('green')) return '#96CEB4';
    if (gradientString.includes('yellow')) return '#FFEAA7';
    if (gradientString.includes('purple')) return '#DDA0DD';
    if (gradientString.includes('orange')) return '#FFA500';
    if (gradientString.includes('cyan')) return '#00CED1';
    if (gradientString.includes('magenta')) return '#FF69B4';
    if (gradientString.includes('pink')) return '#FFB6C1';
    if (gradientString.includes('lime')) return '#32CD32';
    if (gradientString.includes('indigo')) return '#4B0082';
    return '#666666';
};

// 移动生物
var moveCreature = function (creature, newRow, newCol) {
    creature.row = newRow;
    creature.col = newCol;
    creature.element.x = newCol * CREATURE_CONFIG.CELL_SIZE;
    creature.element.y = newRow * CREATURE_CONFIG.CELL_SIZE;
};

// 选择生物（无视觉效果）
var selectCreature = function (creature) {
    // 无操作 - 选择效果由地图引擎处理
};

// 取消选择生物（无视觉效果）
var deselectCreature = function (creature) {
    // 无操作 - 选择效果由地图引擎处理
};

// 销毁生物
var destroyCreature = function (creature) {
    // 在Canvas环境中，无需特殊清理
};


// 注意：全局导出统一在文件末尾进行，避免重复导出


// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.createCreature = createCreature;
    window.drawCreature = drawCreature;
    window.drawEyes = drawEyes;
    window.CREATURE_CONFIG = CREATURE_CONFIG;
}

if (typeof global !== 'undefined') {
    global.createCreature = createCreature;
    global.drawCreature = drawCreature;
    global.drawEyes = drawEyes;
    global.CREATURE_CONFIG = CREATURE_CONFIG;
}

if (typeof this !== 'undefined') {
    this.createCreature = createCreature;
    this.drawCreature = drawCreature;
    this.drawEyes = drawEyes;
    this.CREATURE_CONFIG = CREATURE_CONFIG;
}


