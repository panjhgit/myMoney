// 生物状态常量
var CreatureStates = {
  idle: 'idle',
  walking: 'walking',
  celebrating: 'celebrating',
  eliminated: 'eliminated'
};

// 生物配置常量
var CREATURE_CONFIG = {
  CELL_SIZE: 30, // 每个方块30px
  EYE_SIZE: 6, // 眼睛大小
  EYE_SPACING: 12, // 眼睛间距
  EYE_OFFSET: 6, // 眼睛偏移
  ANIMATION_DURATION: 0.3, // 动画持续时间
  BREATHING_DURATION: 2, // 呼吸动画持续时间
  WALK_DURATION: 0.5 // 走路动画持续时间
};

// 创建俄罗斯方块风格的小人 - 适配抖音小游戏Canvas环境
var createCreature = function(row, col, colorData) {
  var creature = {
    id: row + '-' + col + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9), // 唯一ID
    row: row,
    col: col,
    color: colorData.name,
    colorData: colorData,
    element: null,
    animations: {},
    isWalking: false
  };
  
  // 在抖音小游戏环境中，创建Canvas元素而不是DOM元素
  creature.element = {
    x: col * CREATURE_CONFIG.CELL_SIZE,
    y: row * CREATURE_CONFIG.CELL_SIZE,
    width: Math.max.apply(Math, colorData.blocks.map(function(block) { return block[0]; })) + 1,
    height: Math.max.apply(Math, colorData.blocks.map(function(block) { return block[1]; })) + 1,
    blocks: colorData.blocks,
    color: colorData.gradient,
    scale: 1,
    rotation: 0,
    alpha: 1,
    breathingScale: 1
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
      drawEyes(ctx, blockX, blockY);
    }
  });
  
  ctx.restore();
};

// 绘制眼睛
var drawEyes = function(ctx, blockX, blockY) {
  var eyeSize = CREATURE_CONFIG.EYE_SIZE;
  var eyeOffset = CREATURE_CONFIG.EYE_OFFSET;
  var eyeSpacing = CREATURE_CONFIG.EYE_SPACING;
  
  // 左眼
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(blockX + eyeOffset, blockY + eyeOffset, eyeSize, 0, 2 * Math.PI);
  ctx.fill();
  
  // 右眼
  ctx.beginPath();
  ctx.arc(blockX + eyeOffset + eyeSpacing, blockY + eyeOffset, eyeSize, 0, 2 * Math.PI);
  ctx.fill();
  
  // 眼珠
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(blockX + eyeOffset, blockY + eyeOffset, eyeSize / 2, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(blockX + eyeOffset + eyeSpacing, blockY + eyeOffset, eyeSize / 2, 0, 2 * Math.PI);
  ctx.fill();
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

// 确保在抖音小游戏环境中可用
if (typeof window !== 'undefined') {
  window.CreatureStates = CreatureStates;
  window.createCreature = createCreature;
  window.drawCreature = drawCreature;
  window.moveCreature = moveCreature;
  window.selectCreature = selectCreature;
  window.deselectCreature = deselectCreature;
  window.destroyCreature = destroyCreature;
} else if (typeof global !== 'undefined') {
  global.CreatureStates = CreatureStates;
  global.createCreature = createCreature;
  global.drawCreature = drawCreature;
  global.moveCreature = moveCreature;
  global.selectCreature = selectCreature;
  global.deselectCreature = deselectCreature;
  global.destroyCreature = destroyCreature;
} else {
  // 在抖音小游戏环境中，直接设置为全局变量
  this.CreatureStates = CreatureStates;
  this.createCreature = createCreature;
  this.drawCreature = drawCreature;
  this.moveCreature = moveCreature;
  this.selectCreature = selectCreature;
  this.deselectCreature = deselectCreature;
  this.destroyCreature = destroyCreature;
}
