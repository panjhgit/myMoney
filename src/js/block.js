/**
 * 方块元素系统 - 适配抖音小游戏Canvas环境
 * 基于原有小人系统的俄罗斯方块风格实现
 */

// 方块状态常量
var BlockStates = {
  idle: 'idle',
  moving: 'moving',
  selected: 'selected',
  exiting: 'exiting',
  eliminated: 'eliminated'
};

// 方块配置常量
var BLOCK_CONFIG = {
  CELL_SIZE: 30, // 每个方块30px
  EYE_SIZE: 6, // 眼睛大小
  EYE_SPACING: 12, // 眼睛间距
  EYE_OFFSET: 6, // 眼睛偏移
  ANIMATION_DURATION: 0.3, // 动画持续时间
  BREATHING_DURATION: 2, // 呼吸动画持续时间
  MOVE_DURATION: 0.5, // 移动动画持续时间
  SELECT_SCALE: 1.2, // 选中时的缩放
  GLOW_INTENSITY: 0.8 // 发光强度
};

// 颜色配置
var BLOCK_COLORS = {
  red: {
    name: 'red',
    gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
    glowColor: 'rgba(255, 107, 107, 0.6)'
  },
  blue: {
    name: 'blue',
    gradient: 'linear-gradient(135deg, #45B7D1, #6BC5D8)',
    glowColor: 'rgba(69, 183, 209, 0.6)'
  },
  green: {
    name: 'green',
    gradient: 'linear-gradient(135deg, #96CEB4, #A8E6CF)',
    glowColor: 'rgba(150, 206, 180, 0.6)'
  },
  yellow: {
    name: 'yellow',
    gradient: 'linear-gradient(135deg, #FFEAA7, #FFF3CD)',
    glowColor: 'rgba(255, 234, 167, 0.6)'
  },
  purple: {
    name: 'purple',
    gradient: 'linear-gradient(135deg, #DDA0DD, #E6B3E6)',
    glowColor: 'rgba(221, 160, 221, 0.6)'
  },
  orange: {
    name: 'orange',
    gradient: 'linear-gradient(135deg, #FFA500, #FFB347)',
    glowColor: 'rgba(255, 165, 0, 0.6)'
  },
  cyan: {
    name: 'cyan',
    gradient: 'linear-gradient(135deg, #00CED1, #40E0D0)',
    glowColor: 'rgba(0, 206, 209, 0.6)'
  },
  magenta: {
    name: 'magenta',
    gradient: 'linear-gradient(135deg, #FF69B4, #FFB6C1)',
    glowColor: 'rgba(255, 105, 180, 0.6)'
  }
};

// 形状配置 - 基于原代码的俄罗斯方块形状
var BLOCK_SHAPES = {
  '1x1': {
    name: '1x1',
    blocks: [[0, 0]],
    movementType: 'feet',
    eyePosition: 'center',
    description: '单个方块'
  },
  '1x2': {
    name: '1x2',
    blocks: [[0, 0], [0, 1]],
    movementType: 'feet',
    eyePosition: 'top',
    description: '2个方块直线'
  },
  '1x3': {
    name: '1x3',
    blocks: [[0, 0], [0, 1], [0, 2]],
    movementType: 'crawl',
    eyePosition: 'top',
    description: '3个方块直线'
  },
  '2x1': {
    name: '2x1',
    blocks: [[0, 0], [1, 0]],
    movementType: 'feet',
    eyePosition: 'left',
    description: '2个方块横线'
  },
  '2x2': {
    name: '2x2',
    blocks: [[0, 0], [1, 0], [0, 1], [1, 1]],
    movementType: 'feet',
    eyePosition: 'top-left',
    description: '2x2方块'
  },
  'I-shape': {
    name: 'I-shape',
    blocks: [[0, 0], [0, 1], [0, 2], [0, 3]],
    movementType: 'crawl',
    eyePosition: 'top',
    description: 'I形方块'
  },
  'L-shape': {
    name: 'L-shape',
    blocks: [[0, 0], [0, 1], [0, 2], [1, 2]],
    movementType: 'feet',
    eyePosition: 'top',
    description: 'L形方块'
  },
  'T-shape': {
    name: 'T-shape',
    blocks: [[0, 0], [1, 0], [2, 0], [1, 1]],
    movementType: 'feet',
    eyePosition: 'top',
    description: 'T形方块'
  },
  'S-shape': {
    name: 'S-shape',
    blocks: [[0, 0], [1, 0], [1, 1], [2, 1]],
    movementType: 'feet',
    eyePosition: 'top',
    description: 'S形方块'
  },
  'Z-shape': {
    name: 'Z-shape',
    blocks: [[0, 1], [1, 1], [1, 0], [2, 0]],
    movementType: 'feet',
    eyePosition: 'top',
    description: 'Z形方块'
  },
  'bigL': {
    name: 'bigL',
    blocks: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
    movementType: 'feet',
    eyePosition: 'top',
    description: '大L形方块'
  },
  'cross': {
    name: 'cross',
    blocks: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
    movementType: 'feet',
    eyePosition: 'center',
    description: '十字形方块'
  }
};

// 创建方块 - 适配抖音小游戏Canvas环境
var createBlock = function(id, color, position, shape, layer) {
  layer = layer || 0;
  
  console.log('createBlock 调用参数:', { id: id, color: color, position: position, shape: shape, layer: layer });
  console.log('BLOCK_COLORS 可用颜色:', Object.keys(BLOCK_COLORS));
  console.log('BLOCK_SHAPES 可用形状:', Object.keys(BLOCK_SHAPES));
  
  var colorData = BLOCK_COLORS[color];
  var shapeData = BLOCK_SHAPES[shape];
  
  console.log('查找结果:', { colorData: colorData, shapeData: shapeData });
  
  if (!colorData || !shapeData) {
    console.error('无效的颜色或形状: ' + color + ', ' + shape);
    return null;
  }
  
  var block = {
    id: id,
    color: color,
    colorData: colorData,
    shape: shape,
    shapeData: shapeData,
    position: position,
    layer: layer,
    state: BlockStates.idle,
    element: null,
    animations: {},
    isSelected: false,
    isMoving: false
  };
  
  // 创建Canvas元素
  block.element = {
    x: position.x * BLOCK_CONFIG.CELL_SIZE,
    y: position.y * BLOCK_CONFIG.CELL_SIZE,
    width: Math.max.apply(Math, shapeData.blocks.map(function(block) { return block[0]; })) + 1,
    height: Math.max.apply(Math, shapeData.blocks.map(function(block) { return block[1]; })) + 1,
    blocks: shapeData.blocks,
    color: colorData.gradient,
    scale: 1,
    rotation: 0,
    alpha: 1,
    breathingScale: 1
  };
  
  return block;
};

// 绘制方块到Canvas
var drawBlock = function(ctx, block, startX, startY) {
  startX = startX || 0;
  startY = startY || 0;
  
  var element = block.element;
  var x = startX + element.x;
  var y = startY + element.y;
  
  ctx.save();
  ctx.translate(x + element.width * BLOCK_CONFIG.CELL_SIZE / 2, 
                y + element.height * BLOCK_CONFIG.CELL_SIZE / 2);
  ctx.scale(element.scale * element.breathingScale, element.scale * element.breathingScale);
  ctx.translate(-element.width * BLOCK_CONFIG.CELL_SIZE / 2, 
                -element.height * BLOCK_CONFIG.CELL_SIZE / 2);
  
  // 绘制方块
  element.blocks.forEach(function(blockPart) {
    var blockX = blockPart[0] * BLOCK_CONFIG.CELL_SIZE;
    var blockY = blockPart[1] * BLOCK_CONFIG.CELL_SIZE;
    
    // 绘制方块背景
    ctx.fillStyle = getColorFromGradient(element.color);
    ctx.fillRect(blockX, blockY, BLOCK_CONFIG.CELL_SIZE, BLOCK_CONFIG.CELL_SIZE);
    
    // 绘制边框
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(blockX, blockY, BLOCK_CONFIG.CELL_SIZE, BLOCK_CONFIG.CELL_SIZE);
    
    // 绘制眼睛（在第一个方块上）
    if (blockPart === element.blocks[0]) {
      drawEyes(ctx, blockX, blockY);
    }
  });
  
  ctx.restore();
};

// 绘制眼睛
var drawEyes = function(ctx, blockX, blockY) {
  var eyeSize = BLOCK_CONFIG.EYE_SIZE;
  var eyeOffset = BLOCK_CONFIG.EYE_OFFSET;
  var eyeSpacing = BLOCK_CONFIG.EYE_SPACING;
  
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

// 选择方块
var selectBlock = function(block) {
  block.isSelected = true;
  block.element.scale = BLOCK_CONFIG.SELECT_SCALE;
};

// 取消选择方块
var deselectBlock = function(block) {
  block.isSelected = false;
  block.element.scale = 1;
};

// 移动方块
var moveBlock = function(block, newPosition) {
  block.position = newPosition;
  block.element.x = newPosition.x * BLOCK_CONFIG.CELL_SIZE;
  block.element.y = newPosition.y * BLOCK_CONFIG.CELL_SIZE;
};

// 方块退出
var exitBlock = function(block) {
  block.state = BlockStates.exiting;
  block.element.alpha = 0.5;
};

// 更新方块位置
var updateBlockPosition = function(block, x, y) {
  block.element.x = x;
  block.element.y = y;
};

// 销毁方块
var destroyBlock = function(block) {
  // 清理动画
  if (block.animations) {
    Object.values(block.animations).forEach(function(animation) {
      if (animation && animation.kill) {
        animation.kill();
      }
    });
  }
};

// 创建冰块
var createIce = function(id, position, layer) {
  layer = layer || 1;
  var ice = {
    id: id,
    position: position,
    layer: layer,
    element: {
      x: position.x * BLOCK_CONFIG.CELL_SIZE,
      y: position.y * BLOCK_CONFIG.CELL_SIZE,
      width: BLOCK_CONFIG.CELL_SIZE,
      height: BLOCK_CONFIG.CELL_SIZE,
      alpha: 0.7
    }
  };
  
  return ice;
};

// 绘制冰块
var drawIce = function(ctx, ice, startX, startY) {
  startX = startX || 0;
  startY = startY || 0;
  
  var element = ice.element;
  var x = startX + element.x;
  var y = startY + element.y;
  
  ctx.save();
  ctx.globalAlpha = element.alpha;
  
  // 绘制冰块背景
  ctx.fillStyle = 'rgba(173, 216, 230, 0.8)';
  ctx.fillRect(x, y, element.width, element.height);
  
  // 绘制冰块边框
  ctx.strokeStyle = 'rgba(135, 206, 235, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, element.width, element.height);
  
  // 绘制冰块纹理
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 5);
  ctx.lineTo(x + element.width - 5, y + element.height - 5);
  ctx.moveTo(x + element.width - 5, y + 5);
  ctx.lineTo(x + 5, y + element.height - 5);
  ctx.stroke();
  
  ctx.restore();
};

// 确保在抖音小游戏环境中可用
if (typeof window !== 'undefined') {
  window.BlockStates = BlockStates;
  window.BLOCK_CONFIG = BLOCK_CONFIG;
  window.BLOCK_COLORS = BLOCK_COLORS;
  window.BLOCK_SHAPES = BLOCK_SHAPES;
  window.createBlock = createBlock;
  window.drawBlock = drawBlock;
  window.createIce = createIce;
  window.drawIce = drawIce;
  window.selectBlock = selectBlock;
  window.deselectBlock = deselectBlock;
  window.moveBlock = moveBlock;
  window.exitBlock = exitBlock;
  window.updateBlockPosition = updateBlockPosition;
  window.destroyBlock = destroyBlock;
} else if (typeof global !== 'undefined') {
  global.BlockStates = BlockStates;
  global.BLOCK_CONFIG = BLOCK_CONFIG;
  global.BLOCK_COLORS = BLOCK_COLORS;
  global.BLOCK_SHAPES = BLOCK_SHAPES;
  global.createBlock = createBlock;
  global.drawBlock = drawBlock;
  global.createIce = createIce;
  global.drawIce = drawIce;
  global.selectBlock = selectBlock;
  global.deselectBlock = deselectBlock;
  global.moveBlock = moveBlock;
  global.exitBlock = exitBlock;
  global.updateBlockPosition = updateBlockPosition;
  global.destroyBlock = destroyBlock;
} else {
  // 在抖音小游戏环境中，直接设置为全局变量
  this.BlockStates = BlockStates;
  this.BLOCK_CONFIG = BLOCK_CONFIG;
  this.BLOCK_COLORS = BLOCK_COLORS;
  this.BLOCK_SHAPES = BLOCK_SHAPES;
  this.createBlock = createBlock;
  this.drawBlock = drawBlock;
  this.createIce = createIce;
  this.drawIce = drawIce;
  this.selectBlock = selectBlock;
  this.deselectBlock = deselectBlock;
  this.moveBlock = moveBlock;
  this.exitBlock = exitBlock;
  this.updateBlockPosition = updateBlockPosition;
  this.destroyBlock = destroyBlock;
}
