/**
 * 方块元素系统 - 整合地图元素的行为和动画
 * 基于原有小人系统的俄罗斯方块风格实现
 */

// 方块状态常量
const BlockStates = {
  idle: 'idle',
  moving: 'moving',
  selected: 'selected',
  exiting: 'exiting',
  eliminated: 'eliminated'
};

// 方块配置常量
const BLOCK_CONFIG = {
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
const BLOCK_COLORS = {
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
  }
};

// 形状配置 - 基于原代码的俄罗斯方块形状
const BLOCK_SHAPES = {
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
  '3x1': {
    name: '3x1',
    blocks: [[0, 0], [1, 0], [2, 0]],
    movementType: 'feet',
    eyePosition: 'left',
    description: '3个方块横线'
  },
  'L-shape': {
    name: 'L-shape',
    blocks: [[0, 0], [0, 1], [0, 2], [1, 2]],
    movementType: 'wings',
    eyePosition: 'top-left',
    description: 'L形状'
  },
  'T-shape': {
    name: 'T-shape',
    blocks: [[0, 0], [1, 0], [2, 0], [1, 1]],
    movementType: 'wings',
    eyePosition: 'top-center',
    description: 'T形状'
  },
  'Z-shape': {
    name: 'Z-shape',
    blocks: [[0, 0], [1, 0], [1, 1], [2, 1]],
    movementType: 'crawl',
    eyePosition: 'top-left',
    description: 'Z形状'
  },
  'line4': {
    name: 'line4',
    blocks: [[0, 0], [1, 0], [2, 0], [3, 0]],
    movementType: 'feet',
    eyePosition: 'left',
    description: '4个方块直线'
  },
  'bigL': {
    name: 'bigL',
    blocks: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
    movementType: 'wings',
    eyePosition: 'top-left',
    description: '大L形状'
  },
  'cross': {
    name: 'cross',
    blocks: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
    movementType: 'wings',
    eyePosition: 'top-center',
    description: '十字形状'
  }
};

/**
 * 创建方块元素
 * @param {Object} blockData - 方块数据 {id, color, position, shape, layer}
 * @returns {Object} 方块对象
 */
function createBlock(blockData) {
  // 抖音小游戏环境，使用 Canvas 渲染
  const colorData = BLOCK_COLORS[blockData.color] || BLOCK_COLORS.red;
  const shapeData = BLOCK_SHAPES[blockData.shape] || BLOCK_SHAPES['1x1'];
  
  const block = {
    id: blockData.id,
    type: 'tetris',
    color: blockData.color,
    colorData: colorData,
    shape: blockData.shape,
    shapeData: shapeData,
    position: blockData.position,
    layer: blockData.layer || 0,
    state: BlockStates.idle,
    animations: {},
    isSelected: false,
    isMoving: false,
    occupiedCells: calculateOccupiedCells(blockData.position, shapeData.blocks),
    // 抖音小游戏环境不需要 DOM 元素
    element: null,
    $shape: null,
    $eyes: [],
    $blocks: []
  };
  
  return block;
}

/**
 * 创建方块眼睛
 * @param {Object} block - 方块对象
 * @param {Object} shapeData - 形状数据
 */
function createBlockEyes(block, shapeData) {
  const eyePosition = shapeData.eyePosition;
  const blocks = shapeData.blocks;
  
  // 根据眼睛位置找到合适的方块
  let eyeBlock;
  switch (eyePosition) {
    case 'top-left':
      eyeBlock = blocks.find(b => b[1] === Math.min(...blocks.map(b => b[1])));
      break;
    case 'top-center':
      const topBlocks = blocks.filter(b => b[1] === Math.min(...blocks.map(b => b[1])));
      eyeBlock = topBlocks[Math.floor(topBlocks.length / 2)];
      break;
    case 'left':
      eyeBlock = blocks.find(b => b[0] === Math.min(...blocks.map(b => b[0])));
      break;
    case 'center':
    default:
      eyeBlock = blocks[0];
      break;
  }
  
  if (eyeBlock) {
    const $eye1 = createEye('30%', '25%', BLOCK_CONFIG.EYE_SIZE, BLOCK_CONFIG.EYE_SIZE, '50%');
    const $eye2 = createEye('55%', '25%', BLOCK_CONFIG.EYE_SIZE, BLOCK_CONFIG.EYE_SIZE, '50%');
    
    $eye1.style.left = `${eyeBlock[0] * BLOCK_CONFIG.CELL_SIZE + BLOCK_CONFIG.EYE_OFFSET}px`;
    $eye1.style.top = `${eyeBlock[1] * BLOCK_CONFIG.CELL_SIZE + BLOCK_CONFIG.EYE_OFFSET}px`;
    $eye2.style.left = `${eyeBlock[0] * BLOCK_CONFIG.CELL_SIZE + BLOCK_CONFIG.EYE_OFFSET + BLOCK_CONFIG.EYE_SPACING}px`;
    $eye2.style.top = `${eyeBlock[1] * BLOCK_CONFIG.CELL_SIZE + BLOCK_CONFIG.EYE_OFFSET}px`;
    
    block.element.appendChild($eye1);
    block.element.appendChild($eye2);
    block.$eyes = [$eye1, $eye2];
  }
}

/**
 * 创建眼睛元素
 * @param {string} left - 左边距
 * @param {string} top - 上边距
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {string} borderRadius - 圆角
 * @returns {HTMLElement} 眼睛元素
 */
function createEye(left, top, width, height, borderRadius) {
  const $eye = document.createElement('div');
  $eye.className = 'block-eye';
  $eye.style.position = 'absolute';
  $eye.style.width = `${width}px`;
  $eye.style.height = `${height}px`;
  $eye.style.background = '#333';
  $eye.style.borderRadius = borderRadius;
  $eye.style.top = top;
  $eye.style.left = left;
  $eye.style.zIndex = 5;
  $eye.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';
  
  // 眼睛高光
  const $highlight = document.createElement('div');
  $highlight.style.position = 'absolute';
  $highlight.style.width = '2px';
  $highlight.style.height = '2px';
  $highlight.style.background = 'white';
  $highlight.style.borderRadius = '50%';
  $highlight.style.top = '1px';
  $highlight.style.left = '1px';
  $highlight.style.zIndex = 6;
  
  $eye.appendChild($highlight);
  return $eye;
}

/**
 * 计算方块占据的所有格子
 * @param {Object} position - 位置 {x, y}
 * @param {Array} blocks - 方块形状数组
 * @returns {Array} 格子坐标数组
 */
function calculateOccupiedCells(position, blocks) {
  const cells = [];
  blocks.forEach(block => {
    cells.push(`${position.x + block[0]},${position.y + block[1]}`);
  });
  return cells;
}

/**
 * 选择方块
 * @param {Object} block - 方块对象
 */
function selectBlock(block) {
  if (block.isSelected) return;
  
  block.isSelected = true;
  block.state = BlockStates.selected;
  
  // 停止呼吸动画
  if (block.animations.breathing) {
    block.animations.breathing.kill();
  }
  
  // 选中动画
  try {
    gsap.to(block.element, {
      scale: BLOCK_CONFIG.SELECT_SCALE,
      duration: BLOCK_CONFIG.ANIMATION_DURATION,
      ease: "back.out(1.7)"
    });
  } catch (error) {
    console.warn('选中动画创建失败:', error);
  }
  
  // 方块发光效果
  try {
    gsap.to(block.$blocks, {
      boxShadow: `0 6px 12px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.6), 0 0 15px ${block.colorData.glowColor}`,
      duration: 0.4,
      ease: "back.out(1.7)",
      stagger: 0.1
    });
  } catch (error) {
    console.warn('发光效果创建失败:', error);
  }
  
  // 触发眨眼动画
  if (block.$eyes && block.$eyes.length > 0) {
    try {
      gsap.to(block.$eyes, {
        scaleY: 0.1,
        duration: 0.1,
        ease: "power2.inOut",
        yoyo: true,
        repeat: 1
      });
    } catch (error) {
      console.warn('眨眼动画触发失败:', error);
    }
  }
  
  console.log(`选中方块: ${block.id}`);
}

/**
 * 取消选择方块
 * @param {Object} block - 方块对象
 */
function deselectBlock(block) {
  if (!block.isSelected) return;
  
  block.isSelected = false;
  block.state = BlockStates.idle;
  
  // 恢复大小
  try {
    gsap.to(block.element, {
      scale: 1,
      duration: BLOCK_CONFIG.ANIMATION_DURATION,
      ease: "power2.out"
    });
  } catch (error) {
    console.warn('恢复大小动画失败:', error);
  }
  
  // 恢复方块样式
  try {
    gsap.to(block.$blocks, {
      boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.3)',
      duration: 0.3,
      ease: "power2.in",
      stagger: 0.05
    });
  } catch (error) {
    console.warn('恢复样式动画失败:', error);
  }
  
  // 恢复呼吸动画
  setTimeout(() => {
    try {
      block.animations.breathing = gsap.to(block.element, {
        scale: 1.05,
        duration: BLOCK_CONFIG.BREATHING_DURATION,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1
      });
    } catch (error) {
      console.warn('恢复呼吸动画失败:', error);
    }
  }, 50);
}

/**
 * 移动方块
 * @param {Object} block - 方块对象
 * @param {Object} newPosition - 新位置 {x, y}
 * @param {Function} onComplete - 完成回调
 */
function moveBlock(block, newPosition, onComplete) {
  if (block.isMoving) return;
  
  block.isMoving = true;
  block.state = BlockStates.moving;
  
  // 停止呼吸动画
  if (block.animations.breathing) {
    block.animations.breathing.kill();
  }
  
  // 根据形状类型选择移动方式
  const movementType = block.shapeData.movementType;
  
  switch (movementType) {
    case 'feet':
      moveWithFeet(block, newPosition, onComplete);
      break;
    case 'wings':
      moveWithWings(block, newPosition, onComplete);
      break;
    case 'crawl':
      moveWithCrawl(block, newPosition, onComplete);
      break;
    default:
      moveSimple(block, newPosition, onComplete);
  }
}

/**
 * 用脚移动（走路动画）
 * @param {Object} block - 方块对象
 * @param {Object} newPosition - 新位置
 * @param {Function} onComplete - 完成回调
 */
function moveWithFeet(block, newPosition, onComplete) {
  // 创建脚部
  createBlockFeet(block);
  
  // 移动动画
  try {
    gsap.to(block.element, {
      left: newPosition.x * BLOCK_CONFIG.CELL_SIZE,
      top: newPosition.y * BLOCK_CONFIG.CELL_SIZE,
      duration: BLOCK_CONFIG.MOVE_DURATION,
      ease: "circ.inOut",
      onComplete: () => {
        block.isMoving = false;
        block.state = BlockStates.idle;
        
        // 移除脚部
        removeBlockFeet(block);
        
        // 恢复呼吸动画
        setTimeout(() => {
          try {
            block.animations.breathing = gsap.to(block.element, {
              scale: 1.05,
              duration: BLOCK_CONFIG.BREATHING_DURATION,
              ease: "power2.inOut",
              yoyo: true,
              repeat: -1
            });
          } catch (error) {
            console.warn('恢复呼吸动画失败:', error);
          }
        }, 50);
        
        if (onComplete) onComplete();
      }
    });
  } catch (error) {
    console.warn('移动动画创建失败:', error);
    // 直接完成移动
    block.isMoving = false;
    block.state = BlockStates.idle;
    removeBlockFeet(block);
    if (onComplete) onComplete();
  }
  
  // 身体摆动
  try {
    gsap.to(block.element, {
      rotation: "+=3deg",
      duration: BLOCK_CONFIG.MOVE_DURATION * 0.3,
      ease: "circ.inOut",
      yoyo: true,
      repeat: 1
    });
  } catch (error) {
    console.warn('身体摆动动画失败:', error);
  }
}

/**
 * 用翅膀移动（飞行动画）
 * @param {Object} block - 方块对象
 * @param {Object} newPosition - 新位置
 * @param {Function} onComplete - 完成回调
 */
function moveWithWings(block, newPosition, onComplete) {
  // 创建翅膀
  createBlockWings(block);
  
  // 飞行动画
  try {
    gsap.to(block.element, {
      left: newPosition.x * BLOCK_CONFIG.CELL_SIZE,
      top: newPosition.y * BLOCK_CONFIG.CELL_SIZE,
      duration: BLOCK_CONFIG.MOVE_DURATION,
      ease: "power2.inOut",
      onComplete: () => {
        block.isMoving = false;
        block.state = BlockStates.idle;
        
        // 移除翅膀
        removeBlockWings(block);
        
        // 恢复呼吸动画
        setTimeout(() => {
          try {
            block.animations.breathing = gsap.to(block.element, {
              scale: 1.05,
              duration: BLOCK_CONFIG.BREATHING_DURATION,
              ease: "power2.inOut",
              yoyo: true,
              repeat: -1
            });
          } catch (error) {
            console.warn('恢复呼吸动画失败:', error);
          }
        }, 50);
        
        if (onComplete) onComplete();
      }
    });
  } catch (error) {
    console.warn('飞行动画创建失败:', error);
    // 直接完成移动
    block.isMoving = false;
    block.state = BlockStates.idle;
    removeBlockWings(block);
    if (onComplete) onComplete();
  }
  
  // 飞行起伏
  try {
    gsap.to(block.$blocks, {
      y: "+=4px",
      duration: 0.4,
      ease: "power2.inOut",
      yoyo: true,
      repeat: -1,
      stagger: 0.1
    });
  } catch (error) {
    console.warn('飞行起伏动画失败:', error);
  }
}

/**
 * 蠕动移动（虫子动画）
 * @param {Object} block - 方块对象
 * @param {Object} newPosition - 新位置
 * @param {Function} onComplete - 完成回调
 */
function moveWithCrawl(block, newPosition, onComplete) {
  // 蠕动动画
  try {
    gsap.to(block.element, {
      left: newPosition.x * BLOCK_CONFIG.CELL_SIZE,
      top: newPosition.y * BLOCK_CONFIG.CELL_SIZE,
      duration: BLOCK_CONFIG.MOVE_DURATION,
      ease: "power2.inOut",
      onComplete: () => {
        block.isMoving = false;
        block.state = BlockStates.idle;
        
        // 恢复呼吸动画
        setTimeout(() => {
          try {
            block.animations.breathing = gsap.to(block.element, {
              scale: 1.05,
              duration: BLOCK_CONFIG.BREATHING_DURATION,
              ease: "power2.inOut",
              yoyo: true,
              repeat: -1
            });
          } catch (error) {
            console.warn('恢复呼吸动画失败:', error);
          }
        }, 50);
        
        if (onComplete) onComplete();
      }
    });
  } catch (error) {
    console.warn('蠕动动画创建失败:', error);
    // 直接完成移动
    block.isMoving = false;
    block.state = BlockStates.idle;
    if (onComplete) onComplete();
  }
  
  // 上下跳跃
  try {
    gsap.to(block.element, {
      y: "+=4px",
      duration: 0.3,
      ease: "power2.inOut",
      yoyo: true,
      repeat: -1
    });
  } catch (error) {
    console.warn('跳跃动画失败:', error);
  }
  
  // 方块收缩
  try {
    gsap.to(block.$blocks, {
      scale: 0.95,
      duration: 0.2,
      ease: "power2.inOut",
      yoyo: true,
      repeat: -1,
      stagger: 0.05
    });
  } catch (error) {
    console.warn('收缩动画失败:', error);
  }
}

/**
 * 简单移动（无特殊动画）
 * @param {Object} block - 方块对象
 * @param {Object} newPosition - 新位置
 * @param {Function} onComplete - 完成回调
 */
function moveSimple(block, newPosition, onComplete) {
  gsap.to(block.element, {
    left: newPosition.x * BLOCK_CONFIG.CELL_SIZE,
    top: newPosition.y * BLOCK_CONFIG.CELL_SIZE,
    duration: BLOCK_CONFIG.MOVE_DURATION,
    ease: "power2.inOut",
    onComplete: () => {
      block.isMoving = false;
      block.state = BlockStates.idle;
      
      if (onComplete) onComplete();
    }
  });
}

/**
 * 创建方块脚部
 * @param {Object} block - 方块对象
 */
function createBlockFeet(block) {
  removeBlockFeet(block); // 清除之前的脚
  
  block.$feet = [];
  
  // 找到底部方块
  const bottomBlocks = block.shapeData.blocks.filter(blockPos => {
    return !block.shapeData.blocks.some(otherPos => 
      otherPos[0] === blockPos[0] && otherPos[1] === blockPos[1] + 1
    );
  });
  
  // 创建2个脚
  const footCount = Math.min(2, bottomBlocks.length);
  for (let i = 0; i < footCount; i++) {
    const blockPos = bottomBlocks[i] || bottomBlocks[0];
    
    const $foot = document.createElement('div');
    $foot.className = 'block-foot';
    $foot.style.position = 'absolute';
    $foot.style.width = '6px';
    $foot.style.height = '20px';
    $foot.style.background = '#000';
    $foot.style.borderRadius = '3px';
    $foot.style.left = `${blockPos[0] * BLOCK_CONFIG.CELL_SIZE + 12}px`;
    $foot.style.top = `${blockPos[1] * BLOCK_CONFIG.CELL_SIZE + BLOCK_CONFIG.CELL_SIZE}px`;
    $foot.style.zIndex = 2;
    
    block.element.appendChild($foot);
    block.$feet.push($foot);
  }
  
  // 脚部出现动画
  if (block.$feet.length > 0) {
    try {
      gsap.fromTo(block.$feet, 
        { scaleY: 0, opacity: 0 },
        { 
          scaleY: 1, 
          opacity: 1, 
          duration: 0.3, 
          ease: "back.out(1.7)",
          stagger: 0.1
        }
      );
    } catch (error) {
      console.warn('脚部出现动画失败:', error);
    }
  }
}

/**
 * 移除方块脚部
 * @param {Object} block - 方块对象
 */
function removeBlockFeet(block) {
  if (block.$feet) {
    block.$feet.forEach($foot => {
      if ($foot && $foot.parentNode) {
        $foot.parentNode.removeChild($foot);
      }
    });
    block.$feet = [];
  }
}

/**
 * 创建方块翅膀
 * @param {Object} block - 方块对象
 */
function createBlockWings(block) {
  removeBlockWings(block); // 清除之前的翅膀
  
  block.$wings = [];
  
  // 找到顶部方块
  const topBlocks = block.shapeData.blocks.filter(blockPos => {
    return !block.shapeData.blocks.some(otherPos => 
      otherPos[0] === blockPos[0] && otherPos[1] === blockPos[1] - 1
    );
  });
  
  const headBlock = topBlocks[0];
  
  // 创建2个翅膀
  for (let i = 0; i < 2; i++) {
    const $wing = document.createElement('div');
    $wing.className = 'block-wing';
    $wing.style.position = 'absolute';
    $wing.style.width = '20px';
    $wing.style.height = '12px';
    $wing.style.background = 'rgba(255, 255, 255, 0.8)';
    $wing.style.borderRadius = '50% 10px 50% 10px';
    $wing.style.left = `${headBlock[0] * BLOCK_CONFIG.CELL_SIZE + (i === 0 ? -15 : 15)}px`;
    $wing.style.top = `${headBlock[1] * BLOCK_CONFIG.CELL_SIZE + 5}px`;
    $wing.style.zIndex = 4;
    $wing.style.transform = `rotate(${i === 0 ? -30 : 30}deg)`;
    
    block.element.appendChild($wing);
    block.$wings.push($wing);
  }
  
  // 翅膀出现动画
  if (block.$wings.length > 0) {
    try {
      gsap.fromTo(block.$wings, 
        { scaleY: 0, opacity: 0 },
        { 
          scaleY: 1, 
          opacity: 1, 
          duration: 0.3, 
          ease: "back.out(1.7)",
          stagger: 0.1
        }
      );
    } catch (error) {
      console.warn('翅膀出现动画失败:', error);
    }
  }
}

/**
 * 移除方块翅膀
 * @param {Object} block - 方块对象
 */
function removeBlockWings(block) {
  if (block.$wings) {
    block.$wings.forEach($wing => {
      if ($wing && $wing.parentNode) {
        $wing.parentNode.removeChild($wing);
      }
    });
    block.$wings = [];
  }
}

/**
 * 方块出门动画
 * @param {Object} block - 方块对象
 * @param {Function} onComplete - 完成回调
 */
function exitBlock(block, onComplete) {
  block.state = BlockStates.exiting;
  
  // 出门动画
  try {
    gsap.to(block.element, {
      duration: 0.5,
      scale: 0,
      rotation: 360,
      ease: "back.in(1.7)",
      onComplete: () => {
        block.state = BlockStates.eliminated;
        if (onComplete) onComplete();
      }
    });
  } catch (error) {
    console.warn('出门动画创建失败:', error);
    // 直接完成退出
    block.state = BlockStates.eliminated;
    if (onComplete) onComplete();
  }
}

/**
 * 更新方块位置
 * @param {Object} block - 方块对象
 * @param {Object} newPosition - 新位置
 */
function updateBlockPosition(block, newPosition) {
  block.position = newPosition;
  block.occupiedCells = calculateOccupiedCells(newPosition, block.shapeData.blocks);
  
  // 更新DOM位置
  block.element.style.left = `${newPosition.x * BLOCK_CONFIG.CELL_SIZE}px`;
  block.element.style.top = `${newPosition.y * BLOCK_CONFIG.CELL_SIZE}px`;
}

/**
 * 销毁方块
 * @param {Object} block - 方块对象
 */
function destroyBlock(block) {
  // 停止所有动画
  Object.values(block.animations).forEach(animation => {
    if (animation && animation.kill) {
      animation.kill();
    }
  });
  
  // 移除DOM元素
  if (block.element && block.element.parentNode) {
    block.element.parentNode.removeChild(block.element);
  }
  
  // 清理引用
  block.element = null;
  block.$shape = null;
  block.$eyes = [];
  block.$blocks = [];
  block.$feet = [];
  block.$wings = [];
  block.animations = {};
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.BlockStates = BlockStates;
  window.BLOCK_CONFIG = BLOCK_CONFIG;
  window.BLOCK_COLORS = BLOCK_COLORS;
  window.BLOCK_SHAPES = BLOCK_SHAPES;
  window.createBlock = createBlock;
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
  global.selectBlock = selectBlock;
  global.deselectBlock = deselectBlock;
  global.moveBlock = moveBlock;
  global.exitBlock = exitBlock;
  global.updateBlockPosition = updateBlockPosition;
  global.destroyBlock = destroyBlock;
} else {
  this.BlockStates = BlockStates;
  this.BLOCK_CONFIG = BLOCK_CONFIG;
  this.BLOCK_COLORS = BLOCK_COLORS;
  this.BLOCK_SHAPES = BLOCK_SHAPES;
  this.createBlock = createBlock;
  this.selectBlock = selectBlock;
  this.deselectBlock = deselectBlock;
  this.moveBlock = moveBlock;
  this.exitBlock = exitBlock;
  this.updateBlockPosition = updateBlockPosition;
  this.destroyBlock = destroyBlock;
}
