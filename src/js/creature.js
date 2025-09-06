// 生物状态常量
const CreatureStates = {
  idle: 'idle',
  walking: 'walking',
  celebrating: 'celebrating',
  eliminated: 'eliminated'
};

// 生物配置常量
const CREATURE_CONFIG = {
  CELL_SIZE: 30, // 每个方块30px
  EYE_SIZE: 6, // 眼睛大小
  EYE_SPACING: 12, // 眼睛间距
  EYE_OFFSET: 6, // 眼睛偏移
  ANIMATION_DURATION: 0.3, // 动画持续时间
  BREATHING_DURATION: 2, // 呼吸动画持续时间
  WALK_DURATION: 0.5 // 走路动画持续时间
};


// 创建俄罗斯方块风格的小人
const createCreature = (row, col, colorData) => {
  const creature = {
    id: `${row}-${col}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // 唯一ID
    row,
    col,
    color: colorData.name,
    colorData: colorData,
    element: null,
    $shape: null, // 整体形状
    $eyes: [],
    animations: {},
    isWalking: false
  };
  
  const $creature = document.createElement('div');
  $creature.className = 'creature';
  
  // 设置容器尺寸（根据方块数量调整）
  const maxWidth = Math.max(...colorData.blocks.map(block => block[0])) + 1;
  const maxHeight = Math.max(...colorData.blocks.map(block => block[1])) + 1;
  
  $creature.style.width = `${maxWidth * CREATURE_CONFIG.CELL_SIZE}px`; // 每个方块30px
  $creature.style.height = `${maxHeight * CREATURE_CONFIG.CELL_SIZE}px`;
  $creature.style.position = 'absolute';
  $creature.style.left = `${col * CREATURE_CONFIG.CELL_SIZE}px`; // 设置小人在格子中的位置
  $creature.style.top = `${row * CREATURE_CONFIG.CELL_SIZE}px`;
  $creature.style.cursor = 'pointer';
  $creature.style.transition = 'all 0.3s ease';
  $creature.style.overflow = 'visible';
  
  // 添加呼吸动画
  gsap.set($creature, {
    scale: 1,
    transformOrigin: 'center center'
  });
  
  // 创建呼吸动画
  creature.animations.breathing = gsap.to($creature, {
    scale: 1.05,
    duration: CREATURE_CONFIG.BREATHING_DURATION,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
  
  // 创建整体形状容器
  const $shape = document.createElement('div');
  $shape.className = 'creature-shape';
  $shape.style.position = 'absolute';
  $shape.style.left = '0px';
  $shape.style.top = '0px';
  $shape.style.width = `${maxWidth * CREATURE_CONFIG.CELL_SIZE}px`;
  $shape.style.height = `${maxHeight * CREATURE_CONFIG.CELL_SIZE}px`;
  $shape.style.zIndex = 3;
  
  // 为每个方块创建独立的div元素
  creature.$blocks = [];
  colorData.blocks.forEach((block, index) => {
    const $block = document.createElement('div');
    $block.className = 'tetris-block';
    $block.style.position = 'absolute';
    $block.style.left = `${block[0] * CREATURE_CONFIG.CELL_SIZE}px`;
    $block.style.top = `${block[1] * CREATURE_CONFIG.CELL_SIZE}px`;
    $block.style.width = `${CREATURE_CONFIG.CELL_SIZE}px`;
    $block.style.height = `${CREATURE_CONFIG.CELL_SIZE}px`;
    $block.style.background = colorData.gradient;
    $block.style.borderRadius = '0px';
    $block.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.3)';
    $block.style.border = '1px solid rgba(0,0,0,0.1)';
    $block.dataset.blockIndex = index;
    
    $shape.appendChild($block);
    creature.$blocks.push($block);
  });
  
  $creature.appendChild($shape);
  creature.$shape = $shape;
  
  // 创建眼睛（在整体形状的左上角）
  const firstBlock = colorData.blocks[0];
  if (firstBlock) {
    const $eye1 = createEye('30%', '25%', CREATURE_CONFIG.EYE_SIZE, CREATURE_CONFIG.EYE_SIZE, '50%');
    const $eye2 = createEye('55%', '25%', CREATURE_CONFIG.EYE_SIZE, CREATURE_CONFIG.EYE_SIZE, '50%');
    
    $eye1.style.left = `${firstBlock[0] * CREATURE_CONFIG.CELL_SIZE + CREATURE_CONFIG.EYE_OFFSET}px`;
    $eye1.style.top = `${firstBlock[1] * CREATURE_CONFIG.CELL_SIZE + CREATURE_CONFIG.EYE_OFFSET}px`;
    $eye2.style.left = `${firstBlock[0] * CREATURE_CONFIG.CELL_SIZE + CREATURE_CONFIG.EYE_OFFSET + CREATURE_CONFIG.EYE_SPACING}px`;
    $eye2.style.top = `${firstBlock[1] * CREATURE_CONFIG.CELL_SIZE + CREATURE_CONFIG.EYE_OFFSET}px`;
    
    $creature.appendChild($eye1);
    $creature.appendChild($eye2);
    creature.$eyes = [$eye1, $eye2];
  }
  
  creature.element = $creature;
  
  // 将小人添加到游戏板上
  const $gameBoard = document.querySelector('#game-board');
  if ($gameBoard) {
    $gameBoard.appendChild($creature);
  } else {
    console.error('找不到游戏板元素');
  }
  
  // 添加眨眼动画
  if (creature.$eyes.length > 0) {
    creature.animations.blinking = gsap.to(creature.$eyes, {
      scaleY: 0.1,
      duration: 0.1,
      ease: "power2.inOut",
      yoyo: true,
      repeat: 1,
      delay: Math.random() * 3 + 2
    });
  }
  
  return creature;
};

// 小人站起来并伸出手脚（俄罗斯方块版本）
const standUpAndExtendLimbs = (creature) => {
  if (creature.isWalking) return;
  
  creature.isWalking = true;
  
  // 停止呼吸动画
  if (creature.animations.breathing) {
    creature.animations.breathing.kill();
  }
  
  // 站起来动画
  gsap.to(creature.element, {
    scale: 1.1,
    duration: CREATURE_CONFIG.ANIMATION_DURATION,
    ease: "back.out(1.7)"
  });
  
  // 方块发光动画
  gsap.to(creature.$blocks, {
    boxShadow: '0 6px 12px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.6), 0 0 10px rgba(255,255,255,0.5)',
    duration: 0.4,
    ease: "back.out(1.7)",
    stagger: 0.1
  });
  
  // 根据形状配置选择运动方式
  const config = getShapeConfig(creature.colorData.shape);
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

// 小人坐下并收起手脚（俄罗斯方块版本）
const sitDownAndHideLimbs = (creature) => {
  creature.isWalking = false;
  
  // 坐下动画
  gsap.to(creature.element, {
    scale: 1,
    duration: CREATURE_CONFIG.ANIMATION_DURATION,
    ease: "power2.out"
  });
  
  // 方块恢复正常
  gsap.to(creature.$blocks, {
    boxShadow: '0 4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4)',
    duration: 0.3,
    ease: "power2.in",
    stagger: 0.05
  });
  
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
  creature.animations.breathing = gsap.to(creature.element, {
    scale: 1.05,
    duration: 2,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
};

// 开始走路动画（火柴人风格 - 简单有节奏）
const startWalkingAnimation = (creature) => {
  // 停止呼吸动画
  if (creature.animations.breathing) {
    creature.animations.breathing.kill();
  }
  
  // 自然走路动画（使用GSAP）
  if (creature.$feet && creature.$feet.length > 0) {
    // 创建时间线来协调所有动画
    const walkTimeline = gsap.timeline({ repeat: -1 });
    
    // 将腿分为两组
    const leftLegs = creature.$feet.filter((leg, index) => index % 2 === 0);
    const rightLegs = creature.$feet.filter((leg, index) => index % 2 === 1);
    
    // 自然走路逻辑：
    // 1. 身体轻微上下起伏（走路节奏）
    // 2. 腿部自然前后摆动（像真人走路）
    // 3. 左右腿交替，有重心转移
    // 4. 使用更平滑的缓动函数
    
    // 身体自然起伏（走路时的重心转移）
    walkTimeline
      .to(creature.element, { 
        y: "+=2px", 
        duration: 0.3, 
        ease: "power1.inOut" 
      }, 0)
      .to(creature.element, { 
        y: "-=2px", 
        duration: 0.3, 
        ease: "power1.inOut" 
      }, 0.3)
      .to(creature.element, { 
        y: "+=2px", 
        duration: 0.3, 
        ease: "power1.inOut" 
      }, 0.6)
      .to(creature.element, { 
        y: "-=2px", 
        duration: 0.3, 
        ease: "power1.inOut" 
      }, 0.9);
    
    // 左腿前后摆动（不弯曲，只是前后移动）
    walkTimeline
      .to(leftLegs, { 
        x: "+=8px", // 左腿向前
        duration: 0.4, 
        ease: "power2.inOut" 
      }, 0)
      .to(leftLegs, { 
        x: "-=8px", // 左腿向后
        duration: 0.4, 
        ease: "power2.inOut" 
      }, 0.4)
      .to(leftLegs, { 
        x: "0px", // 回到原位
        duration: 0.4, 
        ease: "power2.inOut" 
      }, 0.8);
    
    // 右腿前后摆动（与左腿相反，形成交替）
    walkTimeline
      .to(rightLegs, { 
        x: "-=8px", // 右腿向后
        duration: 0.4, 
        ease: "power2.inOut" 
      }, 0)
      .to(rightLegs, { 
        x: "+=8px", // 右腿向前
        duration: 0.4, 
        ease: "power2.inOut" 
      }, 0.4)
      .to(rightLegs, { 
        x: "0px", // 回到原位
        duration: 0.4, 
        ease: "power2.inOut" 
      }, 0.8);
    
    creature.animations.walkTimeline = walkTimeline;
  }
};

// 开始飞行动画（翅膀扇动）
const startFlyingAnimation = (creature) => {
  // 停止呼吸动画
  if (creature.animations.breathing) {
    creature.animations.breathing.kill();
  }
  
  // 方块上下浮动动画（飞行时的起伏）
  creature.animations.flying = gsap.to(creature.$blocks, {
    y: "+=4px",
    duration: 0.4,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1,
    stagger: 0.1
  });
  
  // 翅膀扇动动画（真实鸟类飞行风格）
  if (creature.$wings && creature.$wings.length > 0) {
    // 将翅膀分为两组：左翅膀和右翅膀
    const leftWings = creature.$wings.filter((wing, index) => index % 2 === 0);
    const rightWings = creature.$wings.filter((wing, index) => index % 2 === 1);
    
    // 创建翅膀扇动时间线
    const wingTimeline = gsap.timeline({ repeat: -1 });
    
    // 真实鸟类飞行特点：
    // 1. 翅膀扇动幅度更大
    // 2. 扇动频率更快
    // 3. 有"上扇-下扇"的节奏
    // 4. 左右翅膀完全同步
    
    // 翅膀羽毛摆动周期：向下 -> 恢复 -> 向下 -> 恢复
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

// 停止飞行动画
const stopFlyingAnimation = (creature) => {
  if (creature.animations.flying) {
    creature.animations.flying.kill();
  }
  if (creature.animations.wingTimeline) {
    creature.animations.wingTimeline.kill();
  }
  
  // 重置方块位置
  gsap.set(creature.$blocks, {
    y: 0,
    rotation: 0
  });
  
  // 重置翅膀位置到初始对称状态
  if (creature.$wings) {
    creature.$wings.forEach((wing, index) => {
      if (index === 0) {
        // 左翅膀：回到-15度
        gsap.set(wing, { rotation: -15 });
      } else {
        // 右翅膀：回到+15度
        gsap.set(wing, { rotation: 15 });
      }
    });
  }
  
  // 重置身体位置
  gsap.set(creature.element, {
    y: 0,
    rotation: 0
  });
};

// 停止走路动画（俄罗斯方块版本）
const stopWalkingAnimation = (creature) => {
  if (creature.animations.walking) {
    creature.animations.walking.kill();
  }
  if (creature.animations.rotation) {
    creature.animations.rotation.kill();
  }
  if (creature.animations.walkTimeline) {
    creature.animations.walkTimeline.kill();
  }
  
  // 重置方块位置
  gsap.set(creature.$blocks, {
    y: 0,
    rotation: 0
  });
  
  // 重置脚部位置到自然状态
  if (creature.$feet) {
    gsap.set(creature.$feet, {
      rotation: 0,
      x: 0,
      y: 0
    });
  }
  
  // 重置身体位置
  gsap.set(creature.element, {
    y: 0,
    rotation: 0
  });
};

// 创建基础眼睛
const createEye = (left, top, width, height, borderRadius) => {
  const $eye = document.createElement('div');
  $eye.className = 'eye';
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
};

// 图形配置对象 - 统一管理所有图形的属性
const SHAPE_CONFIGS = {
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
const getShapeConfig = (shapeName) => {
  return SHAPE_CONFIGS[shapeName] || SHAPE_CONFIGS.single;
};

// 动态计算脚部大小
const calculateFootSize = (creature) => {
  const config = creature.shapeConfig;
  if (!config || config.footSize !== 'dynamic') {
    return { width: 3, height: 20 }; // 默认大小
  }
  
  // 根据元素大小动态计算
  const elementWidth = creature.element.offsetWidth || 30;
  const elementHeight = creature.element.offsetHeight || 30;
  
  // 脚部大小与元素大小成比例（腿细短，脚掌大）
  const footWidth = Math.max(3, Math.floor(elementWidth * 0.08)); // 最小3px，调整为8%（腿细一点）
  const footHeight = Math.max(10, Math.floor(elementHeight * 0.35)); // 最小10px，调整为35%（腿短一点）
  
  return { width: footWidth, height: footHeight };
};

// 动态计算翅膀大小（参考图片比例）
const calculateWingSize = (creature) => {
  const config = creature.shapeConfig;
  if (!config || config.wingSize !== 'dynamic') {
    return { width: 20, height: 12 }; // 默认大小，稍微大一点
  }
  
  // 根据元素大小动态计算
  const elementWidth = creature.element.offsetWidth || 30;
  const elementHeight = creature.element.offsetHeight || 30;
  
  // 翅膀大小与元素大小成比例（参考图片，翅膀大约等于一个方块的大小）
  const wingWidth = Math.max(15, Math.floor(elementWidth * 0.9)); // 最小15px，调整为90%（增加50%）
  const wingHeight = Math.max(8, Math.floor(elementHeight * 0.6)); // 最小8px，调整为60%（增加50%）
  
  return { width: wingWidth, height: wingHeight };
};


// 创建简单的翅膀（2个翅膀，飞行时扇动）
const createSimpleWings = (creature) => {
  // 清除之前的翅膀
  removeSimpleWings(creature);
  
  creature.$wings = [];
  
  // 找到眼睛所在的那一列作为翅膀对称中心
  const blocks = creature.colorData.blocks;
  const minY = Math.min(...blocks.map(b => b[1]));
  
  // 找到最顶部的方块（头部，有眼睛）
  const topBlocks = blocks.filter(block => block[1] === minY);
  const headBlock = topBlocks[0];
  
  // 眼睛所在的那一列的X坐标（翅膀对称中心）
  const eyeColumnX = headBlock[0];
  
  // 获取动态翅膀大小
  const wingSize = calculateWingSize(creature);
  
  // 创建翅膀（使用SVG绘制真正的Q版翅膀）
  for (let i = 0; i < 2; i++) {
    // 创建SVG容器
    const $wing = document.createElement('div');
    $wing.className = 'simple-wing';
    $wing.dataset.wingIndex = i; // 标记翅膀的索引
    $wing.style.position = 'absolute';
    $wing.style.width = `${wingSize.width}px`;
    $wing.style.height = `${wingSize.height}px`;
    $wing.style.transformOrigin = 'center center';
    
    // 创建SVG元素
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    svg.setAttribute('viewBox', '0 0 1368 1368'); // 使用原始SVG的viewBox
    
    // 创建g元素包含变换
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // 根据左右翅膀设置不同的变换，保持原始SVG角度
    if (i === 0) {
      // 左翅膀：保持原始角度
      g.setAttribute('transform', 'translate(0,1368) scale(0.1,-0.1)');
    } else {
      // 右翅膀：水平翻转，保持原始角度
      g.setAttribute('transform', 'translate(1368,1368) scale(-0.1,-0.1)');
    }
    
    g.setAttribute('fill', 'none');
    g.setAttribute('stroke', '#000');
    // 根据左右翅膀设置不同的线条粗细
    if (i === 0) {
      g.setAttribute('stroke-width', '300'); // 左翅膀更粗
    } else {
      g.setAttribute('stroke-width', '300'); // 右翅膀保持原粗细
    }
    g.setAttribute('stroke-linejoin', 'round');
    
    // 绘制与图片完全一样的翅膀形状
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    // 根据翅膀方向（左右）设置不同的路径
    let wingPath;
    if (i === 0) {
      // 左翅膀：专业SVG路径（高质量）
      wingPath = 'M5231 9564 c-242 -65 -518 -329 -625 -598 -55 -138 -95 -371 -82 -487 4 -35 10 -107 15 -159 21 -232 144 -573 289 -804 34 -54 62 -100 62 -102 0 -2 -62 -4 -137 -4 -166 0 -289 -27 -418 -91 -138 -68 -286 -214 -349 -344 -66 -137 -71 -164 -71 -430 0 -267 8 -312 80 -455 114 -226 383 -467 723 -646 50 -26 92 -52 92 -56 0 -4 -21 -16 -46 -27 -55 -25 -141 -110 -171 -171 -56 -111 -66 -190 -37 -310 72 -306 477 -674 953 -866 164 -67 601 -173 711 -174 19 0 63 -7 97 -15 161 -38 600 -38 758 0 226 54 278 70 378 119 l108 54 46 -92 c61 -121 107 -187 197 -283 120 -127 278 -227 420 -263 241 -61 662 -45 904 36 274 91 520 255 656 438 140 189 184 280 233 486 15 64 18 122 18 400 -1 301 -2 333 -24 435 -82 387 -267 833 -568 1370 -41 73 -223 350 -309 470 -117 163 -390 495 -573 695 -251 275 -659 666 -942 902 -69 58 -462 355 -561 425 -413 290 -878 500 -1225 552 -109 17 -535 13 -602 -5z m614 -241 c249 -61 563 -191 794 -330 354 -214 806 -562 1186 -912 138 -128 493 -489 606 -616 444 -502 717 -893 966 -1385 120 -236 167 -343 238 -538 124 -342 175 -589 175 -853 0 -210 -43 -389 -136 -570 -107 -208 -310 -373 -583 -476 -255 -96 -613 -110 -844 -32 -215 72 -388 280 -492 592 -140 421 -75 866 163 1119 122 130 270 205 447 228 82 11 255 11 338 1 31 -4 61 -5 65 -2 4 4 13 38 20 76 10 61 9 72 -4 82 -24 18 -154 26 -319 20 -236 -9 -396 -62 -565 -188 -144 -107 -241 -242 -311 -432 -83 -222 -96 -417 -52 -783 5 -40 4 -42 -49 -76 -123 -82 -259 -138 -423 -175 -151 -34 -452 -43 -642 -19 -578 73 -931 194 -1248 425 -97 71 -238 213 -292 295 -139 207 -120 322 64 407 131 60 254 71 728 69 435 -3 461 -3 453 5 -3 3 -171 48 -374 101 -203 52 -432 115 -509 141 -241 79 -520 212 -656 312 -30 22 -71 53 -93 68 -65 47 -201 198 -250 276 -76 123 -99 200 -104 352 -6 228 42 372 168 496 110 108 231 156 421 166 219 12 451 -59 630 -192 41 -30 79 -55 86 -55 7 0 17 10 24 23 6 12 28 39 48 61 l36 38 -49 42 c-388 326 -686 868 -725 1319 -14 158 1 312 40 427 79 229 266 426 474 499 55 20 76 21 265 17 157 -3 224 -9 285 -23z';
    } else {
      // 右翅膀：使用相同路径，通过CSS transform水平翻转
      wingPath = 'M5231 9564 c-242 -65 -518 -329 -625 -598 -55 -138 -95 -371 -82 -487 4 -35 10 -107 15 -159 21 -232 144 -573 289 -804 34 -54 62 -100 62 -102 0 -2 -62 -4 -137 -4 -166 0 -289 -27 -418 -91 -138 -68 -286 -214 -349 -344 -66 -137 -71 -164 -71 -430 0 -267 8 -312 80 -455 114 -226 383 -467 723 -646 50 -26 92 -52 92 -56 0 -4 -21 -16 -46 -27 -55 -25 -141 -110 -171 -171 -56 -111 -66 -190 -37 -310 72 -306 477 -674 953 -866 164 -67 601 -173 711 -174 19 0 63 -7 97 -15 161 -38 600 -38 758 0 226 54 278 70 378 119 l108 54 46 -92 c61 -121 107 -187 197 -283 120 -127 278 -227 420 -263 241 -61 662 -45 904 36 274 91 520 255 656 438 140 189 184 280 233 486 15 64 18 122 18 400 -1 301 -2 333 -24 435 -82 387 -267 833 -568 1370 -41 73 -223 350 -309 470 -117 163 -390 495 -573 695 -251 275 -659 666 -942 902 -69 58 -462 355 -561 425 -413 290 -878 500 -1225 552 -109 17 -535 13 -602 -5z m614 -241 c249 -61 563 -191 794 -330 354 -214 806 -562 1186 -912 138 -128 493 -489 606 -616 444 -502 717 -893 966 -1385 120 -236 167 -343 238 -538 124 -342 175 -589 175 -853 0 -210 -43 -389 -136 -570 -107 -208 -310 -373 -583 -476 -255 -96 -613 -110 -844 -32 -215 72 -388 280 -492 592 -140 421 -75 866 163 1119 122 130 270 205 447 228 82 11 255 11 338 1 31 -4 61 -5 65 -2 4 4 13 38 20 76 10 61 9 72 -4 82 -24 18 -154 26 -319 20 -236 -9 -396 -62 -565 -188 -144 -107 -241 -242 -311 -432 -83 -222 -96 -417 -52 -783 5 -40 4 -42 -49 -76 -123 -82 -259 -138 -423 -175 -151 -34 -452 -43 -642 -19 -578 73 -931 194 -1248 425 -97 71 -238 213 -292 295 -139 207 -120 322 64 407 131 60 254 71 728 69 435 -3 461 -3 453 5 -3 3 -171 48 -374 101 -203 52 -432 115 -509 141 -241 79 -520 212 -656 312 -30 22 -71 53 -93 68 -65 47 -201 198 -250 276 -76 123 -99 200 -104 352 -6 228 42 372 168 496 110 108 231 156 421 166 219 12 451 -59 630 -192 41 -30 79 -55 86 -55 7 0 17 10 24 23 6 12 28 39 48 61 l36 38 -49 42 c-388 326 -686 868 -725 1319 -14 158 1 312 40 427 79 229 266 426 474 499 55 20 76 21 265 17 157 -3 224 -9 285 -23z';
    }
    
    path.setAttribute('d', wingPath);
    
    g.appendChild(path);
    svg.appendChild(g);
    
    $wing.appendChild(svg);
    
    // 翅膀位置：基于眼睛所在列对称
    if (i === 0) {
      // 左翅膀：在眼睛所在列左侧，距离边缘15px
      $wing.style.left = `${eyeColumnX * 30 - wingSize.width + 15}px`;
    } else {
      // 右翅膀：恢复到之前正确的状态
      $wing.style.left = `${eyeColumnX * 30  + 15}px`;
    }
    
    // 调试信息
    console.log(`翅膀 ${i}: 位置 = ${$wing.style.left}, 眼睛列X = ${eyeColumnX}, 头部方块 = [${headBlock[0]}, ${headBlock[1]}]`);
    
    // 垂直位置：在头部方块中间高度
    $wing.style.top = `${headBlock[1] * 30 + 5}px`;
    $wing.style.zIndex = 4; // 在小人前面，不被挡住
    
    // 设置翅膀的初始旋转角度，让它们向下倾斜对称
    if (i === 0) {
      // 左翅膀：向左下倾斜
      $wing.style.transform = 'rotate(-30deg)';
    } else {
      // 右翅膀：向右下倾斜
      $wing.style.transform = 'rotate(30deg)';
    }
    
    creature.element.appendChild($wing);
    creature.$wings.push($wing);
  }
  
  // 翅膀出现动画
  if (creature.$wings.length > 0) {
    gsap.fromTo(creature.$wings, 
      { scaleY: 0, opacity: 0 },
      { 
        scaleY: 1, 
        opacity: 1, 
        duration: 0.3, 
        ease: "back.out(1.7)",
        stagger: 0.1
      }
    );
  }
};

// 移除简单的翅膀
const removeSimpleWings = (creature) => {
  if (creature.$wings) {
    creature.$wings.forEach($wing => {
      if ($wing && $wing.parentNode) {
        $wing.parentNode.removeChild($wing);
      }
    });
    creature.$wings = [];
  }
};

// 开始蠕动动画（像虫子一样一格一格跳跃）
const startCrawlingAnimation = (creature) => {
  // 停止呼吸动画
  if (creature.animations.breathing) {
    creature.animations.breathing.kill();
  }
  
  // 虫子蠕动：整体上下跳跃（一格一格的感觉）
  creature.animations.crawling = gsap.to(creature.element, {
    y: "+=4px",
    duration: 0.3,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
  
  // 方块轻微收缩（虫子收缩效果）
  creature.animations.crawlBounce = gsap.to(creature.$blocks, {
    scale: 0.95,
    duration: 0.2,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1,
    stagger: 0.05
  });
  
  // 整体轻微左右移动（前进感）
  creature.animations.crawlMove = gsap.to(creature.element, {
    x: "+=2px",
    duration: 0.6,
    ease: "power2.inOut",
    yoyo: true,
    repeat: -1
  });
};

// 停止蠕动动画
const stopCrawlingAnimation = (creature) => {
  if (creature.animations.crawling) {
    creature.animations.crawling.kill();
  }
  if (creature.animations.crawlBounce) {
    creature.animations.crawlBounce.kill();
  }
  if (creature.animations.crawlMove) {
    creature.animations.crawlMove.kill();
  }
  
  // 重置身体位置
  gsap.set(creature.element, {
    y: 0,
    x: 0,
    rotation: 0
  });
  
  // 重置方块位置
  gsap.set(creature.$blocks, {
    y: 0,
    rotation: 0,
    scale: 1
  });
};

// 从图片提取轮廓的函数
const extractWingContour = (imageData) => {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const points = [];
  
  // 扫描每一行，找到黑色像素
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      
      // 如果是黑色像素（RGB都接近0）
      if (r < 50 && g < 50 && b < 50) {
        points.push({ x, y });
      }
    }
  }
  
  // 转换为SVG路径
  return pointsToSVGPath(points);
};

// 将点转换为SVG路径
const pointsToSVGPath = (points) => {
  if (points.length === 0) return '';
  
  let path = `M${points[0].x},${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    path += ` L${point.x},${point.y}`;
  }
  
  path += ' Z';
  return path;
};

// 创建简单的脚（2个或4个，走路时交替）
const createSimpleFeet = (creature) => {
  // 清除之前的脚
  removeSimpleFeet(creature);
  
  creature.$feet = [];
  
  // 找到小人的底部方块位置
  const bottomBlocks = creature.colorData.blocks.filter(block => {
    return !creature.colorData.blocks.some(otherBlock => 
      otherBlock[0] === block[0] && otherBlock[1] === block[1] + 1
    );
  });
  
  // 决定腿的数量：固定2个腿
  let legCount = 2; // 固定2个腿
  
  // 创建腿 - 选择最合适的底部方块
  const selectedBlocks = [];
  if (bottomBlocks.length === 1) {
    // 只有1个底部方块：创建2个脚在同一个方块下方
    selectedBlocks.push(bottomBlocks[0]);
    selectedBlocks.push(bottomBlocks[0]);
  } else {
    // 多个底部方块：选择最左边和最右边的
    selectedBlocks.push(bottomBlocks[0]); // 最左边
    selectedBlocks.push(bottomBlocks[bottomBlocks.length - 1]); // 最右边
  }
  
  // 获取动态脚部大小
  const footSize = calculateFootSize(creature);
  
  // 创建腿
  for (let i = 0; i < legCount; i++) {
    const block = selectedBlocks[i];
    
    const $leg = document.createElement('div');
    $leg.className = 'simple-leg';
    $leg.dataset.legIndex = i; // 标记腿的索引
    $leg.style.position = 'absolute';
    // 创建L形状的脚（像你图片中的样子）
    $leg.style.width = `${footSize.width}px`;
    $leg.style.height = `${footSize.height}px`;
    $leg.style.background = 'transparent';
    $leg.style.transformOrigin = 'center bottom'; // 设置旋转中心在底部中心
    
    // 调整脚的位置：如果是同一个方块下的两个脚，稍微分开
    let leftOffset = 13.5; // 默认居中
    if (legCount === 2 && selectedBlocks[0] === selectedBlocks[1]) {
      // 同一个方块下的两个脚：一个偏左，一个偏右
      leftOffset = i === 0 ? 8 : 19;
    }
    
    $leg.style.left = `${block[0] * 30 + leftOffset}px`;
    $leg.style.top = `${block[1] * 30 + 30}px`; // 在方块下方
    $leg.style.zIndex = 2;
    
    // 创建L形状的脚（垂直部分 - 小腿）
    const $shin = document.createElement('div');
    $shin.className = 'shin';
    $shin.style.position = 'absolute';
    $shin.style.width = `${footSize.width}px`;
    $shin.style.height = `${footSize.height * 0.7}px`; // 小腿高度
    $shin.style.background = '#000';
    $shin.style.left = '0px';
    $shin.style.top = '0px';
    $shin.style.borderRadius = '2px';
    
    // 创建L形状的脚（水平部分 - 脚掌）
    const $foot = document.createElement('div');
    $foot.className = 'foot';
    $foot.style.position = 'absolute';
    $foot.style.width = `${footSize.width * 2}px`; // 脚掌宽度
    $foot.style.height = `${footSize.width}px`; // 脚掌高度
    $foot.style.background = '#000';
    $foot.style.left = '0px'; // 所有脚都向右延伸（同向）
    $foot.style.top = `${footSize.height * 0.7}px`; // 在小腿底部
    $foot.style.borderRadius = '2px';
    
    $leg.appendChild($shin);
    $leg.appendChild($foot);
    creature.element.appendChild($leg);
    creature.$feet.push($leg);
  }
  
  // 脚部出现动画
  if (creature.$feet.length > 0) {
    gsap.fromTo(creature.$feet, 
      { scaleY: 0, opacity: 0 },
      { 
        scaleY: 1, 
        opacity: 1, 
        duration: 0.3, 
        ease: "back.out(1.7)",
        stagger: 0.1
      }
    );
  }
};

// 移除简单的脚
const removeSimpleFeet = (creature) => {
  if (creature.$feet) {
    creature.$feet.forEach($foot => {
      if ($foot && $foot.parentNode) {
        $foot.parentNode.removeChild($foot);
      }
    });
    creature.$feet = [];
  }
};

// 暴露到全局作用域
window.CreatureStates = CreatureStates;
window.createCreature = createCreature;
window.standUpAndExtendLimbs = standUpAndExtendLimbs;
window.sitDownAndHideLimbs = sitDownAndHideLimbs;