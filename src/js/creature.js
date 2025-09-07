// 生物状态常量
var CreatureStates = {
  idle: 'idle',
  walking: 'walking',
  celebrating: 'celebrating',
  eliminated: 'eliminated'
};

// 生物配置常量 - 使用统一配置
var CREATURE_CONFIG = GAME_CONFIG.CREATURE_CONFIG;

// 创建俄罗斯方块风格的小人 - 适配抖音小游戏Canvas环境
var createCreature = function(row, col, colorData) {
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
    animations: {},
    isWalking: false,
    shapeData: colorData // 添加 shapeData 属性，指向 colorData
  };
  
  // 在抖音小游戏环境中，创建Canvas元素而不是DOM元素
  creature.element = {
    x: col * CREATURE_CONFIG.CELL_SIZE,
    y: row * CREATURE_CONFIG.CELL_SIZE,
    width: Math.max.apply(Math, colorData.blocks.map(function(block) { return block[0]; })) + 1,
    height: Math.max.apply(Math, colorData.blocks.map(function(block) { return block[1]; })) + 1,
    blocks: colorData.blocks,
    color: colorData.name, // 使用颜色名称而不是渐变字符串
    gradient: colorData.gradient, // 保存渐变字符串
    scale: 1,
    rotation: 0,
    alpha: 1,
    breathingScale: 1,
    eyeType: colorData.eyeType || 'circle' // 添加眼睛类型
  };
  
  return creature;
};

// 绘制生物到Canvas - 适配抖音小游戏环境
var drawCreature = function(ctx, creature, startX, startY) {
  startX = startX || 0;
  startY = startY || 0;
  
  var element = creature.element;
  var x = startX + element.x;
  var y = startY + element.y;
  
  ctx.save();
  ctx.translate(x + element.width * CREATURE_CONFIG.CELL_SIZE / 2, 
                y + element.height * CREATURE_CONFIG.CELL_SIZE / 2);
  ctx.scale(element.scale * element.breathingScale, element.scale * element.breathingScale);
  ctx.translate(-element.width * CREATURE_CONFIG.CELL_SIZE / 2, 
                -element.height * CREATURE_CONFIG.CELL_SIZE / 2);
  
  // 绘制生物方块
  element.blocks.forEach(function(block) {
    var blockX = block[0] * CREATURE_CONFIG.CELL_SIZE;
    var blockY = block[1] * CREATURE_CONFIG.CELL_SIZE;
    
    // 绘制方块背景
    ctx.fillStyle = getColorFromGradient(element.color);
    ctx.fillRect(blockX, blockY, CREATURE_CONFIG.CELL_SIZE, CREATURE_CONFIG.CELL_SIZE);
    
    // 绘制边框
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(blockX, blockY, CREATURE_CONFIG.CELL_SIZE, CREATURE_CONFIG.CELL_SIZE);
    
    // 绘制眼睛（在第一个方块上）
    if (block === element.blocks[0]) {
      drawEyes(ctx, blockX, blockY, creature.element);
    }
  });
  
  // 绘制脚（如果存在）
  if (creature.feet && creature.feet.length > 0) {
    creature.feet.forEach(function(foot) {
      // 调整脚的位置，使其相对于creature的坐标系统
      var adjustedFoot = {
        x: foot.x,
        y: foot.y,
        width: foot.width,
        height: foot.height,
        rotation: foot.rotation,
        originalX: foot.originalX,
        originalY: foot.originalY,
        color: foot.color
      };
      drawFoot(ctx, adjustedFoot);
    });
  }
  
  // 绘制翅膀（如果存在）
  if (creature.wings && creature.wings.length > 0) {
    creature.wings.forEach(function(wing) {
      drawWing(ctx, wing);
    });
  }
  
  ctx.restore();
};

// 绘制眼睛 - 支持多种眼睛类型
var drawEyes = function(ctx, blockX, blockY, element) {
  var eyeSize = CREATURE_CONFIG.EYE_SIZE;
  var cellSize = CREATURE_CONFIG.CELL_SIZE;
  
  // 计算眼睛的精确位置，让它们居中
  var centerX = blockX + cellSize / 2;
  var centerY = blockY + cellSize / 3; // 稍微偏上一点
  var eyeSpacing = CREATURE_CONFIG.EYE_SPACING;
  
  // 获取眼睛类型配置
  var eyeType = 'circle'; // 默认眼睛类型
  if (element && element.eyeType && typeof EYE_TYPES !== 'undefined') {
    eyeType = element.eyeType;
  }
  
  var eyeConfig = EYE_TYPES && EYE_TYPES[eyeType] ? EYE_TYPES[eyeType] : EYE_TYPES.circle;
  
  // 根据眼睛类型调整大小
  var adjustedEyeSize = eyeSize * eyeConfig.size;
  var adjustedEyeSpacing = eyeSpacing * eyeConfig.size;
  
  // 绘制眉毛
  drawEyebrows(ctx, centerX, centerY, adjustedEyeSize, adjustedEyeSpacing, eyeConfig.eyebrowStyle);
  
  // 获取眼睛动画属性
  var eyeScaleY = 1;
  var eyeAlpha = 1;
  if (element && element.eyeAnimation) {
    eyeScaleY = element.eyeAnimation.eyeScaleY || 1;
    eyeAlpha = element.eyeAnimation.eyeAlpha || 1;
  }
  
  // 设置眼睛透明度
  ctx.globalAlpha = eyeAlpha;
  
  // 如果眼睛正在闭合，绘制闭合效果
  if (eyeScaleY < 0.5) {
    drawClosedEyes(ctx, centerX, centerY, adjustedEyeSize, adjustedEyeSpacing, eyeConfig);
  } else {
    // 绘制睁开的眼睛
    drawOpenEyes(ctx, centerX, centerY, adjustedEyeSize, adjustedEyeSpacing, eyeConfig);
  }
  
  // 恢复透明度
  ctx.globalAlpha = 1;
};

// 绘制眉毛
var drawEyebrows = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyebrowStyle) {
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
var drawCurvedEyebrows = function(ctx, centerX, centerY, eyeSize, eyeSpacing) {
  // 左眉毛 - 更柔和的弯曲
  ctx.beginPath();
  ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 2);
  ctx.quadraticCurveTo(
    centerX - eyeSpacing / 2, centerY - eyeSize - 4, // 稍微降低高度，更柔和
    centerX - eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 2
  );
  ctx.stroke();
  
  // 右眉毛 - 更柔和的弯曲
  ctx.beginPath();
  ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 2);
  ctx.quadraticCurveTo(
    centerX + eyeSpacing / 2, centerY - eyeSize - 4, // 稍微降低高度，更柔和
    centerX + eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 2
  );
  ctx.stroke();
};

// 绘制直线眉毛
var drawStraightEyebrows = function(ctx, centerX, centerY, eyeSize, eyeSpacing) {
  // 左眉毛
  ctx.beginPath();
  ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 3);
  ctx.lineTo(centerX - eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 3);
  ctx.stroke();
  
  // 右眉毛
  ctx.beginPath();
  ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 3);
  ctx.lineTo(centerX + eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 3);
  ctx.stroke();
};

// 绘制角度眉毛
var drawAngularEyebrows = function(ctx, centerX, centerY, eyeSize, eyeSpacing) {
  // 左眉毛（V形）
  ctx.beginPath();
  ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 3);
  ctx.lineTo(centerX - eyeSpacing / 2, centerY - eyeSize - 5);
  ctx.lineTo(centerX - eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 3);
  ctx.stroke();
  
  // 右眉毛（V形）
  ctx.beginPath();
  ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 3);
  ctx.lineTo(centerX + eyeSpacing / 2, centerY - eyeSize - 5);
  ctx.lineTo(centerX + eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 3);
  ctx.stroke();
};

// 绘制下垂眉毛
var drawDroopyEyebrows = function(ctx, centerX, centerY, eyeSize, eyeSpacing) {
  // 左眉毛（向下弯曲）
  ctx.beginPath();
  ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 3);
  ctx.quadraticCurveTo(
    centerX - eyeSpacing / 2, centerY - eyeSize - 1,
    centerX - eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 3
  );
  ctx.stroke();
  
  // 右眉毛（向下弯曲）
  ctx.beginPath();
  ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 3);
  ctx.quadraticCurveTo(
    centerX + eyeSpacing / 2, centerY - eyeSize - 1,
    centerX + eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 3
  );
  ctx.stroke();
};

// 绘制上扬眉毛
var drawRaisedEyebrows = function(ctx, centerX, centerY, eyeSize, eyeSpacing) {
  // 左眉毛（向上弯曲）
  ctx.beginPath();
  ctx.moveTo(centerX - eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 3);
  ctx.quadraticCurveTo(
    centerX - eyeSpacing / 2, centerY - eyeSize - 7,
    centerX - eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 3
  );
  ctx.stroke();
  
  // 右眉毛（向上弯曲）
  ctx.beginPath();
  ctx.moveTo(centerX + eyeSpacing / 2 - eyeSize/2, centerY - eyeSize - 3);
  ctx.quadraticCurveTo(
    centerX + eyeSpacing / 2, centerY - eyeSize - 7,
    centerX + eyeSpacing / 2 + eyeSize/2, centerY - eyeSize - 3
  );
  ctx.stroke();
};

// 绘制睁开的眼睛
var drawOpenEyes = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
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
var drawCircularEyes = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
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
var drawEllipticalEyes = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
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
var drawSquareEyes = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
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
var drawHalfCircleEyes = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
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
var drawClosedEyes = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
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

// 从渐变字符串获取颜色
var getColorFromGradient = function(gradientString) {
  if (gradientString.includes('red')) return '#FF6B6B';
  if (gradientString.includes('blue')) return '#45B7D1';
  if (gradientString.includes('green')) return '#96CEB4';
  if (gradientString.includes('yellow')) return '#FFEAA7';
  if (gradientString.includes('purple')) return '#DDA0DD';
  if (gradientString.includes('orange')) return '#FFA500';
  if (gradientString.includes('cyan')) return '#00CED1';
  if (gradientString.includes('magenta')) return '#FF69B4';
  return '#666666';
};

// 移动生物
var moveCreature = function(creature, newRow, newCol) {
  creature.row = newRow;
  creature.col = newCol;
  creature.element.x = newCol * CREATURE_CONFIG.CELL_SIZE;
  creature.element.y = newRow * CREATURE_CONFIG.CELL_SIZE;
};

// 选择生物
var selectCreature = function(creature) {
  creature.element.scale = 1.2;
};

// 取消选择生物
var deselectCreature = function(creature) {
  creature.element.scale = 1;
};

// 销毁生物
var destroyCreature = function(creature) {
  // 在Canvas环境中，只需要清理动画
  if (creature.animations) {
    Object.values(creature.animations).forEach(function(animation) {
      if (animation && animation.kill) {
        animation.kill();
      }
    });
  }
};

// 眨眼动画（Canvas版本）- 只让眼睛部分眨眼
var blinkAnimation = function(creature) {
  if (!creature || !creature.element) {
    return;
  }
  
  // 停止之前的眨眼动画
  if (creature.animations && creature.animations.blink) {
    creature.animations.blink.kill();
  }
  
  // 确保 animations 对象存在
  if (!creature.animations) {
    creature.animations = {};
  }
  
  // 为眼睛创建独立的动画对象
  if (!creature.element.eyeAnimation) {
    creature.element.eyeAnimation = {
      eyeScaleY: 1, // 眼睛的垂直缩放
      eyeAlpha: 1   // 眼睛的透明度
    };
  }
  
  // 眨眼动画：只影响眼睛部分
  var blinkTimeline = gsap.timeline();
  
  // 第一阶段：眼睛闭合（垂直缩放到0）
  blinkTimeline.to(creature.element.eyeAnimation, {
    eyeScaleY: 0, // 眼睛垂直缩放为0，模拟闭合
    duration: 0.08,
    ease: "power2.inOut",
  })
  // 第二阶段：眼睛睁开（恢复原状）
  .to(creature.element.eyeAnimation, {
    eyeScaleY: 1, // 恢复原始大小
    duration: 0.12,
    ease: "power2.out",
  });
  
  // 保存动画引用
  creature.animations.blink = blinkTimeline;
  
  // 动画完成后清理
  blinkTimeline.eventCallback("onComplete", function() {
    if (creature.animations && creature.animations.blink) {
      creature.animations.blink = null;
    }
    // 标记需要重绘
    if (typeof markNeedsRedraw === 'function') {
      markNeedsRedraw();
    }
  });
  
  // 动画进行中也需要重绘
  blinkTimeline.eventCallback("onUpdate", function() {
    if (typeof markNeedsRedraw === 'function') {
      markNeedsRedraw();
    }
  });
};

// 确保在抖音小游戏环境中可用
if (typeof window !== 'undefined') {
  window.CreatureStates = CreatureStates;
  window.createCreature = createCreature;
  window.drawCreature = drawCreature;
  window.moveCreature = moveCreature;
  window.selectCreature = selectCreature;
  window.deselectCreature = deselectCreature;
  window.destroyCreature = destroyCreature;
  
  // 动画效果函数
  window.standUpAndExtendLimbs = standUpAndExtendLimbs;
  window.sitDownAndHideLimbs = sitDownAndHideLimbs;
  window.startWormAnimation = startWormAnimation;
  window.startWingAnimation = startWingAnimation;
  window.startLegWalkingAnimation = startLegWalkingAnimation;
} else if (typeof global !== 'undefined') {
  global.CreatureStates = CreatureStates;
  global.createCreature = createCreature;
  global.drawCreature = drawCreature;
  global.moveCreature = moveCreature;
  global.selectCreature = selectCreature;
  global.deselectCreature = deselectCreature;
  global.destroyCreature = destroyCreature;
  
  // 动画效果函数
  global.standUpAndExtendLimbs = standUpAndExtendLimbs;
  global.sitDownAndHideLimbs = sitDownAndHideLimbs;
  global.startWormAnimation = startWormAnimation;
  global.startWingAnimation = startWingAnimation;
  global.startLegWalkingAnimation = startLegWalkingAnimation;
} else {
  // 在抖音小游戏环境中，直接设置为全局变量
  this.CreatureStates = CreatureStates;
  this.createCreature = createCreature;
  this.drawCreature = drawCreature;
  this.moveCreature = moveCreature;
  this.selectCreature = selectCreature;
  this.deselectCreature = deselectCreature;
  this.destroyCreature = destroyCreature;
  
  // 动画效果函数
  this.standUpAndExtendLimbs = standUpAndExtendLimbs;
  this.sitDownAndHideLimbs = sitDownAndHideLimbs;
  this.startWormAnimation = startWormAnimation;
  this.startWingAnimation = startWingAnimation;
  this.startLegWalkingAnimation = startLegWalkingAnimation;
}

// 图形配置对象 - 统一管理所有图形的属性
var SHAPE_CONFIGS = {
  // 单个方块
  single: {
    name: 'single',
    movementType: 'feet', // 用脚走路
    eyeType: 'round', // 圆形眼睛
    eyePosition: 'center', // 眼睛位置：中心
    footPosition: 'bottom', // 脚部位置：底部
    footCount: 2, // 脚部数量
    footAnimation: 'alternating', // 脚部动画：交替
    footSize: 'dynamic', // 脚部大小：动态计算
    wingPosition: null, // 无翅膀
    wingAnimation: null, // 无翅膀动画
    wingSize: null, // 无翅膀大小
    crawlAnimation: null // 无蠕动动画
  },
  
  // 直线2
  line2: {
    name: 'line2',
    movementType: 'crawl', // 蠕动
    eyeType: 'oval', // 椭圆形眼睛
    eyePosition: 'left', // 眼睛位置：左侧
    footPosition: null, // 无脚部
    footCount: 0,
    footAnimation: null,
    footSize: null,
    wingPosition: null, // 无翅膀
    wingAnimation: null,
    wingSize: null,
    crawlAnimation: 'bounce' // 蠕动动画：上下跳跃
  },
  
  // 直线3
  line3: {
    name: 'line3',
    movementType: 'crawl', // 蠕动
    eyeType: 'oval', // 椭圆形眼睛
    eyePosition: 'left', // 眼睛位置：左侧
    footPosition: null, // 无脚部
    footCount: 0,
    footAnimation: null,
    footSize: null,
    wingPosition: null, // 无翅膀
    wingAnimation: null,
    wingSize: null,
    crawlAnimation: 'bounce' // 蠕动动画：上下跳跃
  },
  
  // 直线4
  line4: {
    name: 'line4',
    movementType: 'crawl', // 蠕动
    eyeType: 'oval', // 椭圆形眼睛
    eyePosition: 'left', // 眼睛位置：左侧
    footPosition: null, // 无脚部
    footCount: 0,
    footAnimation: null,
    footSize: null,
    wingPosition: null, // 无翅膀
    wingAnimation: null,
    wingSize: null,
    crawlAnimation: 'bounce' // 蠕动动画：上下跳跃
  },
  
  // 正方形
  square: {
    name: 'square',
    movementType: 'feet', // 用脚走路
    eyeType: 'round', // 圆形眼睛
    eyePosition: 'top-left', // 眼睛位置：左上角
    footPosition: 'bottom', // 脚部位置：底部
    footCount: 2, // 脚部数量
    footAnimation: 'alternating', // 脚部动画：交替
    footSize: 'dynamic', // 脚部大小：动态计算
    wingPosition: null, // 无翅膀
    wingAnimation: null,
    wingSize: null,
    crawlAnimation: null // 无蠕动动画
  },
  
  // L形
  lshape: {
    name: 'lshape',
    movementType: 'wings', // 用翅膀飞行
    eyeType: 'round', // 圆形眼睛
    eyePosition: 'top-left', // 眼睛位置：左上角
    footPosition: null, // 无脚部
    footCount: 0,
    footAnimation: null,
    footSize: null,
    wingPosition: 'top-sides', // 翅膀位置：顶部两侧
    wingAnimation: 'symmetric', // 翅膀动画：对称扇动
    wingSize: 'dynamic', // 翅膀大小：动态计算
    crawlAnimation: null // 无蠕动动画
  },
  
  // T形
  tshape: {
    name: 'tshape',
    movementType: 'wings', // 用翅膀飞行
    eyeType: 'round', // 圆形眼睛
    eyePosition: 'top-center', // 眼睛位置：顶部中心
    footPosition: null, // 无脚部
    footCount: 0,
    footAnimation: null,
    footSize: null,
    wingPosition: 'top-sides', // 翅膀位置：顶部两侧
    wingAnimation: 'symmetric', // 翅膀动画：对称扇动
    wingSize: 'dynamic', // 翅膀大小：动态计算
    crawlAnimation: null // 无蠕动动画
  },
  
  // Z形
  zshape: {
    name: 'zshape',
    movementType: 'crawl', // 蠕动
    eyeType: 'round', // 圆形眼睛
    eyePosition: 'top-left', // 眼睛位置：左上角
    footPosition: null, // 无脚部
    footCount: 0,
    footAnimation: null,
    footSize: null,
    wingPosition: null, // 无翅膀
    wingAnimation: null,
    wingSize: null,
    crawlAnimation: 'bounce' // 蠕动动画：上下跳跃
  },
  
  // 十字形
  cross: {
    name: 'cross',
    movementType: 'crawl', // 蠕动
    eyeType: 'round', // 圆形眼睛
    eyePosition: 'top-center', // 眼睛位置：顶部中心
    footPosition: null, // 无脚部
    footCount: 0,
    footAnimation: null,
    footSize: null,
    wingPosition: null, // 无翅膀
    wingAnimation: null,
    wingSize: null,
    crawlAnimation: 'bounce' // 蠕动动画：上下跳跃
  },
  
  // 大L形
  bigl: {
    name: 'bigl',
    movementType: 'wings', // 用翅膀飞行
    eyeType: 'round', // 圆形眼睛
    eyePosition: 'top-left', // 眼睛位置：左上角
    footPosition: null, // 无脚部
    footCount: 0,
    footAnimation: null,
    footSize: null,
    wingPosition: 'top-sides', // 翅膀位置：顶部两侧
    wingAnimation: 'symmetric', // 翅膀动画：对称扇动
    wingSize: 'dynamic', // 翅膀大小：动态计算
    crawlAnimation: null // 无蠕动动画
  }
};

// 根据形状名称获取配置
var getShapeConfig = function(shapeName) {
  return SHAPE_CONFIGS[shapeName] || SHAPE_CONFIGS.single;
};

// 小人站起来并伸出手脚（Canvas版本）
var standUpAndExtendLimbs = function(creature) {
  if (creature.isWalking) return;
  
  creature.isWalking = true;
  
  // 停止呼吸动画
  if (creature.animations && creature.animations.breathing) {
    creature.animations.breathing.kill();
  }
  
  // 站起来动画 - 放大
  creature.element.scale = 1.1;
  
  // 根据形状配置选择运动方式
  var config = getShapeConfig(creature.colorData.shape);
  creature.movementType = config.movementType;
  creature.shapeConfig = config;
  
  if (config.movementType === 'feet') {
    // 用脚走路
    createSimpleFeet(creature);
    startWalkingAnimation(creature);
  } else if (config.movementType === 'wings') {
    // 用翅膀飞
    createSimpleWings(creature);
    startFlyingAnimation(creature);
  } else if (config.movementType === 'crawl') {
    // 像虫子一样蠕动
    startCrawlingAnimation(creature);
  }
};

// 小人坐下并收起手脚（Canvas版本）
var sitDownAndHideLimbs = function(creature) {
  creature.isWalking = false;
  
  // 坐下动画 - 恢复原始大小
  creature.element.scale = 1;
  
  // 根据运动方式移除相应的肢体
  if (creature.movementType === 'feet') {
    removeSimpleFeet(creature);
    stopWalkingAnimation(creature);
  } else if (creature.movementType === 'wings') {
    removeSimpleWings(creature);
    stopFlyingAnimation(creature);
  } else if (creature.movementType === 'crawl') {
    stopCrawlingAnimation(creature);
  }
  
  // 恢复呼吸动画
  if (!creature.animations) {
    creature.animations = {};
  }
  creature.animations.breathing = gsap.to(creature.element, {
    breathingScale: 1.05,
    duration: 2,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
};

// 开始走路动画（Canvas版本）
var startWalkingAnimation = function(creature) {
  // 停止呼吸动画
  if (creature.animations && creature.animations.breathing) {
    creature.animations.breathing.kill();
  }
  
  // 自然走路动画（使用GSAP）
  if (creature.feet && creature.feet.length > 0) {
    // 创建时间线来协调所有动画
    var walkTimeline = gsap.timeline({ repeat: -1 });
    
    // 将腿分为两组
    var leftLegs = creature.feet.filter(function(leg, index) { return index % 2 === 0; });
    var rightLegs = creature.feet.filter(function(leg, index) { return index % 2 === 1; });
    
    // 身体自然起伏（走路时的重心转移）
    walkTimeline
      .to(creature.element, { 
        y: creature.element.y + 2, 
        duration: 0.3, 
        ease: "power1.inOut" 
      }, 0)
      .to(creature.element, { 
        y: creature.element.y - 2, 
        duration: 0.3, 
        ease: "power1.inOut" 
      }, 0.3)
      .to(creature.element, { 
        y: creature.element.y + 2, 
        duration: 0.3, 
        ease: "power1.inOut" 
      }, 0.6)
      .to(creature.element, { 
        y: creature.element.y - 2, 
        duration: 0.3, 
        ease: "power1.inOut" 
      }, 0.9);
    
    // 水平交替走路动画 - 右腿移动到左腿位置，左腿移动到右腿位置
    if (creature.feet && creature.feet.length >= 2) {
      var leftLeg = creature.feet[0];
      var rightLeg = creature.feet[1];
      
      // 计算腿之间的水平距离
      var legDistance = Math.abs(rightLeg.originalX - leftLeg.originalX);
      
      // 第一步：右腿移动到左腿位置，左腿移动到右腿位置
      walkTimeline
        .to(rightLeg, { 
          x: leftLeg.originalX, // 右腿移动到左腿位置
          duration: 0.4, 
          ease: "power2.inOut" 
        }, 0)
        .to(leftLeg, { 
          x: rightLeg.originalX, // 左腿移动到右腿位置
          duration: 0.4, 
          ease: "power2.inOut" 
        }, 0)
        
        // 第二步：腿回到原位
        .to(rightLeg, { 
          x: rightLeg.originalX, // 右腿回到原位
          duration: 0.4, 
          ease: "power2.inOut" 
        }, 0.4)
        .to(leftLeg, { 
          x: leftLeg.originalX, // 左腿回到原位
          duration: 0.4, 
          ease: "power2.inOut" 
        }, 0.4);
    }
    
    if (!creature.animations) {
      creature.animations = {};
    }
    creature.animations.walkTimeline = walkTimeline;
  }
};

// 开始飞行动画（Canvas版本）
var startFlyingAnimation = function(creature) {
  // 停止呼吸动画
  if (creature.animations && creature.animations.breathing) {
    creature.animations.breathing.kill();
  }
  
  // 方块上下浮动动画（飞行时的起伏）
  if (!creature.animations) {
    creature.animations = {};
  }
  
  creature.animations.flying = gsap.to(creature.element, {
    y: creature.element.y + 4,
    duration: 0.4,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
  
  // 翅膀扇动动画
  if (creature.wings && creature.wings.length > 0) {
    // 将翅膀分为两组：左翅膀和右翅膀
    var leftWings = creature.wings.filter(function(wing, index) { return index % 2 === 0; });
    var rightWings = creature.wings.filter(function(wing, index) { return index % 2 === 1; });
    
    // 创建翅膀扇动时间线
    var wingTimeline = gsap.timeline({ repeat: -1 });
    
    // 翅膀扇动周期
    wingTimeline
      // 羽毛向下摆动 - 左右翅膀垂直对称摆动
      .to(leftWings, {
        rotation: -45, // 左翅膀向下摆动到-45°
        duration: 0.4,
        ease: "power2.inOut"
      }, 0)
      .to(rightWings, {
        rotation: 45, // 右翅膀向下摆动到+45°（垂直对称）
        duration: 0.4,
        ease: "power2.inOut"
      }, 0)
      // 恢复到原位
      .to(leftWings, {
        rotation: -30, // 左翅膀恢复到-30°
        duration: 0.4,
        ease: "power2.inOut"
      }, 0.4)
      .to(rightWings, {
        rotation: 30, // 右翅膀恢复到+30°
        duration: 0.4,
        ease: "power2.inOut"
      }, 0.4);
    
    creature.animations.wingTimeline = wingTimeline;
  }
};

// 开始蠕动动画（Canvas版本）
var startCrawlingAnimation = function(creature) {
  // 停止呼吸动画
  if (creature.animations && creature.animations.breathing) {
    creature.animations.breathing.kill();
  }
  
  if (!creature.animations) {
    creature.animations = {};
  }
  
  // 虫子蠕动：整体上下跳跃（一格一格的感觉）
  creature.animations.crawling = gsap.to(creature.element, {
    y: creature.element.y + 4,
    duration: 0.3,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
  
  // 方块轻微收缩（虫子收缩效果）
  creature.animations.crawlBounce = gsap.to(creature.element, {
    scale: 0.95,
    duration: 0.2,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
  
  // 整体轻微左右移动（前进感）
  creature.animations.crawlMove = gsap.to(creature.element, {
    x: creature.element.x + 2,
    duration: 0.6,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
};

// 停止走路动画（Canvas版本）
var stopWalkingAnimation = function(creature) {
  if (creature.animations) {
    if (creature.animations.walking) {
      creature.animations.walking.kill();
    }
    if (creature.animations.rotation) {
      creature.animations.rotation.kill();
    }
    if (creature.animations.walkTimeline) {
      creature.animations.walkTimeline.kill();
    }
  }
  
  // 重置身体位置
  creature.element.y = creature.row * CREATURE_CONFIG.CELL_SIZE;
  creature.element.x = creature.col * CREATURE_CONFIG.CELL_SIZE;
  creature.element.rotation = 0;
  
  // 重置脚部位置到自然状态
  if (creature.feet) {
    creature.feet.forEach(function(foot) {
      foot.rotation = 0;
      foot.x = foot.originalX || foot.x;
      foot.y = foot.originalY || foot.y;
    });
  }
};

// 停止飞行动画（Canvas版本）
var stopFlyingAnimation = function(creature) {
  if (creature.animations) {
    if (creature.animations.flying) {
      creature.animations.flying.kill();
    }
    if (creature.animations.wingTimeline) {
      creature.animations.wingTimeline.kill();
    }
  }
  
  // 重置身体位置
  creature.element.y = creature.row * CREATURE_CONFIG.CELL_SIZE;
  creature.element.x = creature.col * CREATURE_CONFIG.CELL_SIZE;
  creature.element.rotation = 0;
  
  // 重置翅膀位置到初始对称状态
  if (creature.wings) {
    creature.wings.forEach(function(wing, index) {
      if (index === 0) {
        // 左翅膀：回到-15度
        wing.rotation = -15;
      } else {
        // 右翅膀：回到+15度
        wing.rotation = 15;
      }
    });
  }
};

// 停止蠕动动画（Canvas版本）
var stopCrawlingAnimation = function(creature) {
  if (creature.animations) {
    if (creature.animations.crawling) {
      creature.animations.crawling.kill();
    }
    if (creature.animations.crawlBounce) {
      creature.animations.crawlBounce.kill();
    }
    if (creature.animations.crawlMove) {
      creature.animations.crawlMove.kill();
    }
  }
  
  // 重置身体位置
  creature.element.y = creature.row * CREATURE_CONFIG.CELL_SIZE;
  creature.element.x = creature.col * CREATURE_CONFIG.CELL_SIZE;
  creature.element.rotation = 0;
  creature.element.scale = 1;
};

// 创建简单的脚（Canvas版本）
var createSimpleFeet = function(creature) {
  // 清除之前的脚
  removeSimpleFeet(creature);
  
  creature.feet = [];
  
  // 找到小人的底部方块位置
  var bottomBlocks = creature.colorData.blocks.filter(function(block) {
    return !creature.colorData.blocks.some(function(otherBlock) { 
      return otherBlock[0] === block[0] && otherBlock[1] === block[1] + 1;
    });
  });
  
  // 决定腿的数量：只有1x1和2x2方块才有腿
  var legCount = 0;
  var selectedBlocks = [];
  
  // 检查方块形状
  var blocks = creature.colorData.blocks;
  var is1x1 = blocks.length === 1; // 1x1方块
  var is2x2 = blocks.length === 4 && 
              blocks.every(function(block) {
                return blocks.some(function(otherBlock) {
                  return (Math.abs(block[0] - otherBlock[0]) <= 1 && 
                          Math.abs(block[1] - otherBlock[1]) <= 1);
                });
              }); // 2x2方块
  
  if (is1x1) {
    // 1x1方块：2条腿
    legCount = 2;
    selectedBlocks.push(bottomBlocks[0]);
    selectedBlocks.push(bottomBlocks[0]);
  } else if (is2x2) {
    // 2x2方块：2条腿
    legCount = 2;
    selectedBlocks.push(bottomBlocks[0]); // 最左边
    selectedBlocks.push(bottomBlocks[bottomBlocks.length - 1]); // 最右边
  } else {
    // 其他形状：无腿
    legCount = 0;
  }
  
  // 创建腿
  for (var i = 0; i < legCount; i++) {
    var block = selectedBlocks[i];
    var cellSize = CREATURE_CONFIG.CELL_SIZE;
    
    // 计算腿的位置 - 确保在身体内部
    var legX, legY;
    
    if (legCount === 2 && selectedBlocks[0] === selectedBlocks[1]) {
      // 同一个方块下的两个脚：在方块内部，合理间距
      var centerX = block[0] * cellSize + cellSize / 2;
      var spacing = cellSize * 0.25; // 25%的格子宽度作为间距，确保在身体内
      legX = i === 0 ? centerX - spacing : centerX + spacing;
    } else {
      // 不同方块下的脚：在各自方块内部居中
      legX = block[0] * cellSize + cellSize / 2;
    }
    
    legY = block[1] * cellSize + cellSize; // 在方块下方
    
    var leg = {
      x: legX,
      y: legY,
      width: Math.max(4, cellSize * 0.08), // 腿宽度：格子大小的8%，最小4像素
      height: Math.max(15, cellSize * 0.35), // 腿高度：格子大小的35%，最小15像素
      rotation: 0,
      originalX: legX,
      originalY: legY,
      color: '#2C3E50' // 深蓝色，更可爱
    };
    
    creature.feet.push(leg);
  }
};

// 移除简单的脚（Canvas版本）
var removeSimpleFeet = function(creature) {
  if (creature.feet) {
    creature.feet = [];
  }
};

// 创建简单的翅膀（Canvas版本）
var createSimpleWings = function(creature) {
  // 清除之前的翅膀
  removeSimpleWings(creature);
  
  creature.wings = [];
  
  // 找到眼睛所在的那一列作为翅膀对称中心
  var blocks = creature.colorData.blocks;
  var minY = Math.min.apply(Math, blocks.map(function(b) { return b[1]; }));
  
  // 找到最顶部的方块（头部，有眼睛）
  var topBlocks = blocks.filter(function(block) { return block[1] === minY; });
  var headBlock = topBlocks[0];
  
  // 眼睛所在的那一列的X坐标（翅膀对称中心）
  var eyeColumnX = headBlock[0];
  
  // 创建翅膀
  for (var i = 0; i < 2; i++) {
    var wing = {
      x: eyeColumnX * CREATURE_CONFIG.CELL_SIZE + (i === 0 ? -15 : 15),
      y: headBlock[1] * CREATURE_CONFIG.CELL_SIZE + 5,
      width: 20,
      height: 12,
      rotation: i === 0 ? -30 : 30, // 左翅膀向左下倾斜，右翅膀向右下倾斜
      color: '#000',
      originalRotation: i === 0 ? -30 : 30
    };
    
    creature.wings.push(wing);
  }
};

// 移除简单的翅膀（Canvas版本）
var removeSimpleWings = function(creature) {
  if (creature.wings) {
    creature.wings = [];
  }
};

// 绘制脚 - L形状，连续，可爱
var drawFoot = function(ctx, foot) {
  ctx.save();
  ctx.translate(foot.x, foot.y);
  ctx.rotate(foot.rotation * Math.PI / 180);
  
  // 设置更可爱的颜色
  ctx.fillStyle = foot.color;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  
  // 绘制L形状的腿和脚
  var legWidth = foot.width;
  var legHeight = foot.height * 0.6; // 小腿高度
  var footWidth = foot.width * 1.8; // 脚掌宽度，比小腿大
  var footHeight = foot.width * 1.2; // 脚掌高度
  
  // 绘制小腿（垂直部分）
  ctx.fillRect(-legWidth/2, 0, legWidth, legHeight);
  
  // 绘制脚掌（水平部分）- 与小腿连接形成L形
  ctx.fillRect(-legWidth/2, legHeight - 1, footWidth, footHeight);
  
  // 添加可爱的细节 - 脚趾
  ctx.fillStyle = '#444';
  var toeWidth = footWidth / 3;
  for (var i = 0; i < 3; i++) {
    ctx.fillRect(-legWidth/2 + i * toeWidth, legHeight + footHeight - footWidth * 0.3, 
                 toeWidth * 0.8, footWidth * 0.3);
  }
  
  // 添加高光效果
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(-legWidth/2 + 1, 1, legWidth - 2, legHeight * 0.3);
  ctx.fillRect(-legWidth/2 + 1, legHeight, footWidth * 0.3, footHeight * 0.3);
  
  ctx.restore();
};

// 绘制翅膀
var drawWing = function(ctx, wing) {
  ctx.save();
  ctx.translate(wing.x, wing.y);
  ctx.rotate(wing.rotation * Math.PI / 180);
  
  // 绘制简单的翅膀形状（椭圆形）
  ctx.fillStyle = wing.color;
  ctx.beginPath();
  ctx.ellipse(wing.width / 2, wing.height / 2, wing.width / 2, wing.height / 2, 0, 0, 2 * Math.PI);
  ctx.fill();
  
  // 绘制翅膀纹理线条
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (var i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(wing.width * 0.2, wing.height * i / 3);
    ctx.lineTo(wing.width * 0.8, wing.height * i / 3);
    ctx.stroke();
  }
  
  ctx.restore();
};

// 为Canvas版本添加的别名函数
var startWormAnimation = startCrawlingAnimation;
var startWingAnimation = startFlyingAnimation;
var startLegWalkingAnimation = startWalkingAnimation;

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.createCreature = createCreature;
  window.drawCreature = drawCreature;
  window.drawEyes = drawEyes;
  window.drawFoot = drawFoot;
  window.drawWing = drawWing;
  window.standUpAndExtendLimbs = standUpAndExtendLimbs;
  window.sitDownAndHideLimbs = sitDownAndHideLimbs;
  window.startWalkingAnimation = startWalkingAnimation;
  window.stopWalkingAnimation = stopWalkingAnimation;
  window.startFlyingAnimation = startFlyingAnimation;
  window.stopFlyingAnimation = stopFlyingAnimation;
  window.startCrawlingAnimation = startCrawlingAnimation;
  window.stopCrawlingAnimation = stopCrawlingAnimation;
  window.startWormAnimation = startWormAnimation;
  window.startWingAnimation = startWingAnimation;
  window.startLegWalkingAnimation = startLegWalkingAnimation;
  window.blinkAnimation = blinkAnimation;
  window.CREATURE_CONFIG = CREATURE_CONFIG;
}

if (typeof global !== 'undefined') {
  global.createCreature = createCreature;
  global.drawCreature = drawCreature;
  global.drawEyes = drawEyes;
  global.drawFoot = drawFoot;
  global.drawWing = drawWing;
  global.standUpAndExtendLimbs = standUpAndExtendLimbs;
  global.sitDownAndHideLimbs = sitDownAndHideLimbs;
  global.startWalkingAnimation = startWalkingAnimation;
  global.stopWalkingAnimation = stopWalkingAnimation;
  global.startFlyingAnimation = startFlyingAnimation;
  global.stopFlyingAnimation = stopFlyingAnimation;
  global.startCrawlingAnimation = startCrawlingAnimation;
  global.stopCrawlingAnimation = stopCrawlingAnimation;
  global.startWormAnimation = startWormAnimation;
  global.startWingAnimation = startWingAnimation;
  global.startLegWalkingAnimation = startLegWalkingAnimation;
  global.blinkAnimation = blinkAnimation;
  global.CREATURE_CONFIG = CREATURE_CONFIG;
}

if (typeof this !== 'undefined') {
  this.createCreature = createCreature;
  this.drawCreature = drawCreature;
  this.drawEyes = drawEyes;
  this.drawFoot = drawFoot;
  this.drawWing = drawWing;
  this.standUpAndExtendLimbs = standUpAndExtendLimbs;
  this.sitDownAndHideLimbs = sitDownAndHideLimbs;
  this.startWalkingAnimation = startWalkingAnimation;
  this.stopWalkingAnimation = stopWalkingAnimation;
  this.startFlyingAnimation = startFlyingAnimation;
  this.stopFlyingAnimation = stopFlyingAnimation;
  this.startCrawlingAnimation = startCrawlingAnimation;
  this.stopCrawlingAnimation = stopCrawlingAnimation;
  this.startWormAnimation = startWormAnimation;
  this.startWingAnimation = startWingAnimation;
  this.startLegWalkingAnimation = startLegWalkingAnimation;
  this.blinkAnimation = blinkAnimation;
  this.CREATURE_CONFIG = CREATURE_CONFIG;
}

// 绘制三角形眼睛
var drawTriangleEyes = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
  // 左眼（正三角形）
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(centerX - eyeSpacing / 2, centerY - eyeSize); // 顶点（上）
  ctx.lineTo(centerX - eyeSpacing / 2 - eyeSize, centerY + eyeSize); // 左下角
  ctx.lineTo(centerX - eyeSpacing / 2 + eyeSize, centerY + eyeSize); // 右下角
  ctx.closePath();
  ctx.fill();
  
  // 右眼（正三角形）
  ctx.beginPath();
  ctx.moveTo(centerX + eyeSpacing / 2, centerY - eyeSize); // 顶点（上）
  ctx.lineTo(centerX + eyeSpacing / 2 - eyeSize, centerY + eyeSize); // 左下角
  ctx.lineTo(centerX + eyeSpacing / 2 + eyeSize, centerY + eyeSize); // 右下角
  ctx.closePath();
  ctx.fill();
  
  // 瞳孔（小圆形，位于正三角形中心稍微往下）
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(centerX - eyeSpacing / 2, centerY + eyeSize * 0.2, eyeSize * eyeConfig.pupilSize, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + eyeSpacing / 2, centerY + eyeSize * 0.2, eyeSize * eyeConfig.pupilSize, 0, 2 * Math.PI);
  ctx.fill();
};

// 绘制五角星眼睛
var drawStarEyes = function(ctx, centerX, centerY, eyeSize, eyeSpacing, eyeConfig) {
  // 绘制墨镜（正方形，圆角，无连接桥）
  ctx.fillStyle = 'black';
  
  // 左眼镜片（圆角正方形，更大）
  ctx.beginPath();
  ctx.roundRect(centerX - eyeSpacing / 2 - eyeSize * 0.7, centerY - eyeSize * 0.7, eyeSize * 1.4, eyeSize * 1.4, eyeSize * 0.3);
  ctx.fill();
  
  // 右眼镜片（圆角正方形，更大）
  ctx.beginPath();
  ctx.roundRect(centerX + eyeSpacing / 2 - eyeSize * 0.7, centerY - eyeSize * 0.7, eyeSize * 1.4, eyeSize * 1.4, eyeSize * 0.3);
  ctx.fill();
  
  // 添加反光效果（根据眨眼动画调整透明度）
  var eyeScaleY = eyeConfig && eyeConfig.eyeAnimation ? eyeConfig.eyeAnimation.eyeScaleY || 1 : 1;
  var reflectionAlpha = eyeScaleY < 0.5 ? 0.3 : 0.8; // 眨眼时反光减弱
  ctx.fillStyle = 'rgba(255, 255, 255, ' + reflectionAlpha + ')';
  
  // 左眼镜片反光
  ctx.beginPath();
  ctx.roundRect(centerX - eyeSpacing / 2 - eyeSize * 0.5, centerY - eyeSize * 0.5, eyeSize * 0.4, eyeSize * 0.3, eyeSize * 0.1);
  ctx.fill();
  
  // 右眼镜片反光
  ctx.beginPath();
  ctx.roundRect(centerX + eyeSpacing / 2 - eyeSize * 0.5, centerY - eyeSize * 0.5, eyeSize * 0.4, eyeSize * 0.3, eyeSize * 0.1);
  ctx.fill();
};

