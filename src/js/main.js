// 小丘三小 - 小人走路出口匹配游戏
// 类似Color Block Jam：不同颜色的小人走到对应颜色的出口

// 初始化
console.clear();

const $stage = document.querySelector('.stage');
const $gameBoard = document.querySelector('#game-board');
const $score = document.querySelector('#score');
const $level = document.querySelector('#level');
const $target = document.querySelector('#target');

// 游戏配置
const CONFIG = {
  BOARD_SIZE: 12, // 12x12的小方块地图
  CELL_SIZE: 30, // 每个小方块30px
  CREATURE_COUNT: 8, // 初始小人数量
  HIDDEN_CREATURE_COUNT: 5, // 隐藏小人数量
  ICE_MELT_DELAY: 3000, // 冰块融化延迟(ms)
  STEP_DURATION: 0.4, // 移动步长持续时间(s)
  ANIMATION_DURATION: 0.3 // 动画持续时间(s)
};
const COLORS = [
  { 
    name: 'red', 
    gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
    shape: 'single', // 单个方块
    blocks: [[0, 0]] // 1个方块
  },
  { 
    name: 'blue', 
    gradient: 'linear-gradient(135deg, #45B7D1, #6BC5D8)',
    shape: 'line2', // 2个方块直线
    blocks: [[0, 0], [1, 0]] // 2个方块
  },
  { 
    name: 'green', 
    gradient: 'linear-gradient(135deg, #96CEB4, #A8E6CF)',
    shape: 'line3', // 3个方块直线
    blocks: [[0, 0], [1, 0], [2, 0]] // 3个方块
  },
  { 
    name: 'yellow', 
    gradient: 'linear-gradient(135deg, #FFEAA7, #FFF3CD)',
    shape: 'square', // 2x2方块
    blocks: [[0, 0], [1, 0], [0, 1], [1, 1]] // 4个方块
  },
  { 
    name: 'purple', 
    gradient: 'linear-gradient(135deg, #DDA0DD, #E6B3E6)',
    shape: 'lshape', // L形状
    blocks: [[0, 0], [0, 1], [0, 2], [1, 2]] // 4个方块
  },
  { 
    name: 'orange', 
    gradient: 'linear-gradient(135deg, #FFA500, #FFB347)',
    shape: 'tshape', // T形状
    blocks: [[0, 0], [1, 0], [2, 0], [1, 1]] // 4个方块
  },
  { 
    name: 'pink', 
    gradient: 'linear-gradient(135deg, #FFB6C1, #FFC0CB)',
    shape: 'zshape', // Z形状
    blocks: [[0, 0], [1, 0], [1, 1], [2, 1]] // 4个方块，真正的Z字形
  },
  { 
    name: 'cyan', 
    gradient: 'linear-gradient(135deg, #00CED1, #40E0D0)',
    shape: 'line4', // 4个方块直线
    blocks: [[0, 0], [1, 0], [2, 0], [3, 0]] // 4个方块
  },
  { 
    name: 'lime', 
    gradient: 'linear-gradient(135deg, #32CD32, #90EE90)',
    shape: 'bigl', // 大L形状
    blocks: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] // 5个方块
  },
  { 
    name: 'indigo', 
    gradient: 'linear-gradient(135deg, #4B0082, #6A5ACD)',
    shape: 'cross', // 十字形状
    blocks: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] // 5个方块
  }
];

// 游戏状态
let gameState = {
  level: 1,
  score: 0,
  target: 0, // 需要走出去的小人数量
  board: [], // 12x12的小方块地图
  creatures: [], // 所有小人
  iceBlocks: [], // 冰块（隐藏下方小人）
  hiddenCreatures: [], // 隐藏的小人
  exits: [], // 出口
  selectedCreature: null // 当前选中的小人
};

// 工具函数
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

const getRandomPosition = (maxOffset = 3) => ({
  row: Math.floor(Math.random() * (CONFIG.BOARD_SIZE - maxOffset)),
  col: Math.floor(Math.random() * (CONFIG.BOARD_SIZE - maxOffset))
});

// 创建出口
const createExit = (colorData, position) => {
  const exit = {
    color: colorData.name,
    colorData: colorData,
    position: position, // 'top', 'bottom', 'left', 'right'
    element: null
  };
  
  const $exit = document.createElement('div');
  $exit.className = 'exit';
  $exit.style.position = 'absolute';
  $exit.style.background = colorData.gradient;
  $exit.style.border = '3px solid rgba(255,255,255,0.9)';
  $exit.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  $exit.style.zIndex = 5;
  
  // 根据位置设置出口样式
  switch (position) {
    case 'top-left':
      $exit.style.width = '40px';
      $exit.style.height = '15px';
      $exit.style.top = '-8px';
      $exit.style.left = '-5px';
      $exit.style.borderRadius = '0 0 10px 0';
      break;
    case 'top-right':
      $exit.style.width = '40px';
      $exit.style.height = '15px';
      $exit.style.top = '-8px';
      $exit.style.right = '-5px';
      $exit.style.borderRadius = '0 0 0 10px';
      break;
    case 'bottom-left':
      $exit.style.width = '40px';
      $exit.style.height = '15px';
      $exit.style.bottom = '-8px';
      $exit.style.left = '-5px';
      $exit.style.borderRadius = '0 10px 0 0';
      break;
    case 'bottom-right':
      $exit.style.width = '40px';
      $exit.style.height = '15px';
      $exit.style.bottom = '-8px';
      $exit.style.right = '-5px';
      $exit.style.borderRadius = '10px 0 0 0';
      break;
    case 'left-center':
      $exit.style.width = '15px';
      $exit.style.height = '40px';
      $exit.style.left = '-8px';
      $exit.style.top = '50%';
      $exit.style.transform = 'translateY(-50%)';
      $exit.style.borderRadius = '0 10px 10px 0';
      break;
    case 'right-center':
      $exit.style.width = '15px';
      $exit.style.height = '40px';
      $exit.style.right = '-8px';
      $exit.style.top = '50%';
      $exit.style.transform = 'translateY(-50%)';
      $exit.style.borderRadius = '10px 0 0 10px';
      break;
  }
  
  // 添加出口标识
  const $label = document.createElement('div');
  $label.style.position = 'absolute';
  $label.style.top = '50%';
  $label.style.left = '50%';
  $label.style.transform = 'translate(-50%, -50%)';
  $label.style.color = 'white';
  $label.style.fontSize = '12px';
  $label.style.fontWeight = 'bold';
  $label.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
  $label.textContent = colorData.name.charAt(0).toUpperCase();
  
  $exit.appendChild($label);
  exit.element = $exit;
  
  return exit;
};

// 创建出口
const createExits = () => {
  gameState.exits = [];
  
  // 为每种形状创建一个出口，分布在棋盘边缘
  COLORS.forEach((colorData, index) => {
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left-center', 'right-center'];
    const position = positions[index];
    
    const exit = createExit(colorData, position);
    gameState.exits.push(exit);
    
    // 将出口添加到对应的边缘格子
    let targetRow, targetCol;
    switch (position) {
      case 'top-left':
        targetRow = 0;
        targetCol = 1;
        break;
      case 'top-right':
        targetRow = 0;
        targetCol = CONFIG.BOARD_SIZE - 2;
        break;
      case 'bottom-left':
        targetRow = CONFIG.BOARD_SIZE - 1;
        targetCol = 1;
        break;
      case 'bottom-right':
        targetRow = CONFIG.BOARD_SIZE - 1;
        targetCol = CONFIG.BOARD_SIZE - 2;
        break;
      case 'left-center':
        targetRow = Math.floor(CONFIG.BOARD_SIZE / 2);
        targetCol = 0;
        break;
      case 'right-center':
        targetRow = Math.floor(CONFIG.BOARD_SIZE / 2);
        targetCol = CONFIG.BOARD_SIZE - 1;
        break;
    }
    
    const targetCell = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
    if (targetCell) {
      targetCell.appendChild(exit.element);
    } else {
      console.warn(`找不到目标格子: row=${targetRow}, col=${targetCol}`);
    }
  });
  
  console.log('出口创建完成，共', gameState.exits.length, '个出口');
};

// 检查是否到达对应颜色的出口
const checkForExitMatch = (creature) => {
  // 检查是否在棋盘边缘
  const isAtEdge = creature.row === 0 || creature.row === CONFIG.BOARD_SIZE - 1 || 
                   creature.col === 0 || creature.col === CONFIG.BOARD_SIZE - 1;
  
  if (!isAtEdge) return false;
  
  // 找到对应颜色的出口
  const matchingExit = gameState.exits.find(exit => exit.color === creature.color);
  if (!matchingExit) return false;
  
  // 检查是否到达出口位置
  const cell = document.querySelector(`[data-row="${creature.row}"][data-col="${creature.col}"]`);
  if (!cell) return false;
  
  // 检查出口是否在这个位置
  const exitInCell = cell.querySelector('.exit');
  if (!exitInCell) return false;
  
  // 小人到达出口，消除
  eliminateCreature(creature);
  gameState.score += 10;
  updateUI();
  
  if (gameState.score >= gameState.target) {
    nextLevel();
  }
  
  return true;
};

// 消除小人
const meltIceAndRevealCreature = (row, col) => {
  const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  const iceBlock = cell.querySelector('.ice-block');
  
  if (!iceBlock) return;
  
  // 延迟融化
  setTimeout(() => {
    // 冰块融化动画
    gsap.to(iceBlock, {
      scale: 0.8,
      opacity: 0.3,
      duration: 0.5,
      ease: "power2.inOut",
      onComplete: () => {
        // 检查是否有隐藏的小人
        const hiddenCreature = gameState.hiddenCreatures.find(c => c.row === row && c.col === col);
        
        if (hiddenCreature) {
          // 露出隐藏的小人
          hiddenCreature.element.style.display = 'block';
          gameState.board[row][col] = hiddenCreature;
          gameState.creatures.push(hiddenCreature);
          
          // 从隐藏列表中移除
          const hiddenIndex = gameState.hiddenCreatures.indexOf(hiddenCreature);
          if (hiddenIndex > -1) {
            gameState.hiddenCreatures.splice(hiddenIndex, 1);
          }
          
          // 隐藏小人生成动画
          gsap.fromTo(hiddenCreature.element, {
            scale: 0,
            opacity: 0
          }, {
            scale: 1,
            opacity: 1,
            duration: 0.3,
            ease: "back.out(1.7)"
          });
        } else {
          // 没有隐藏小人，生成新小人
          const colorData = getRandomColor();
          const creature = createCreature(row, col, colorData);
          gameState.board[row][col] = creature;
          gameState.creatures.push(creature);
          
          // 将小人添加到格子中
          cell.appendChild(creature.element);
          
          // 新小人生成动画
          gsap.fromTo(creature.element, {
            scale: 0,
            opacity: 0
          }, {
            scale: 1,
            opacity: 1,
            duration: 0.3,
            ease: "back.out(1.7)"
          });
        }
        
        // 冰块恢复
        gsap.set(iceBlock, {
          scale: 1,
          opacity: 1
        });
      }
    });
  }, CONFIG.ICE_MELT_DELAY); // 使用配置的延迟时间
};

const eliminateCreature = (creature) => {
  // 播放消除动画
  gsap.to(creature.element, {
    duration: 0.5,
    scale: 0,
    rotation: 360,
    ease: "back.in(1.7)",
    onComplete: () => {
      creature.element.remove();
      // 从棋盘和生物列表中移除
      gameState.board[creature.row][creature.col] = null;
      const index = gameState.creatures.indexOf(creature);
      if (index > -1) {
        gameState.creatures.splice(index, 1);
      }
      
      // 触发冰块融化并露出隐藏小人
      setTimeout(() => {
        meltIceAndRevealCreature(creature.row, creature.col);
      }, 200);
    }
  });
};

// 初始化游戏棋盘
const initBoard = () => {
  $gameBoard.innerHTML = '';
  gameState.board = [];
  gameState.creatures = [];
  gameState.iceBlocks = [];
  gameState.hiddenCreatures = [];
  gameState.exits = [];
  gameState.selectedCreature = null;
  
  // 设置游戏板尺寸
  $gameBoard.style.width = `${CONFIG.BOARD_SIZE * CONFIG.CELL_SIZE}px`;
  $gameBoard.style.height = `${CONFIG.BOARD_SIZE * CONFIG.CELL_SIZE}px`;
  $gameBoard.style.position = 'relative';
  $gameBoard.style.border = '2px solid #333';
  $gameBoard.style.backgroundColor = '#f0f0f0';
  
  // 创建小方块地图
  for (let row = 0; row < CONFIG.BOARD_SIZE; row++) {
    gameState.board[row] = [];
    for (let col = 0; col < CONFIG.BOARD_SIZE; col++) {
      const $cell = document.createElement('div');
      $cell.className = 'map-cell';
      $cell.dataset.row = row;
      $cell.dataset.col = col;
      $cell.style.position = 'absolute';
      $cell.style.width = `${CONFIG.CELL_SIZE}px`;
      $cell.style.height = `${CONFIG.CELL_SIZE}px`;
      $cell.style.left = `${col * CONFIG.CELL_SIZE}px`;
      $cell.style.top = `${row * CONFIG.CELL_SIZE}px`;
      $cell.style.border = '1px solid #ddd';
      $cell.style.backgroundColor = '#fff';
      $cell.style.cursor = 'pointer';
      
      $gameBoard.appendChild($cell);
      
      // 初始化为空
      gameState.board[row][col] = null;
    }
  }
  
  // 创建小人
  createCreatures();
  
  // 创建出口
  createExits();
  
  // 创建冰块隐藏的小人
  createIceHiddenCreatures();
};

// 创建小人
const createCreatures = () => {
  // 随机创建一些小人
  for (let i = 0; i < CONFIG.CREATURE_COUNT; i++) {
    const colorData = getRandomColor();
    const { row, col } = getRandomPosition();
    
    // 检查是否可以放置
    if (canPlaceCreature(row, col, colorData.blocks)) {
      const creature = createCreature(row, col, colorData);
      
      if (creature) {
        gameState.creatures.push(creature);
        gameState.target++;
        
        // 标记占用的位置（每个位置都指向同一个creature对象）
        colorData.blocks.forEach(block => {
          gameState.board[row + block[1]][col + block[0]] = creature;
        });
      }
    }
  }
  
  // 设置点击移动系统
  setupClickMoveSystem();
  
  updateUI();
};

// 检查是否可以放置小人
const canPlaceCreature = (startRow, startCol, blocks) => {
  for (const block of blocks) {
    const row = startRow + block[1];
    const col = startCol + block[0];
    
    if (row < 0 || row >= CONFIG.BOARD_SIZE || col < 0 || col >= CONFIG.BOARD_SIZE) {
      return false;
    }
    
    if (gameState.board[row][col] !== null) {
      return false;
    }
  }
  
  return true;
};

// 创建冰块
const createIceBlock = (creature) => {
  const iceBlock = {
    creature: creature,
    element: null,
    isMelted: false
  };
  
  const $iceBlock = document.createElement('div');
  
  if (!$iceBlock) {
    console.error('无法创建冰块元素');
    return null;
  }
  
  $iceBlock.className = 'ice-block';
  $iceBlock.style.position = 'absolute';
  $iceBlock.style.left = `${creature.col * CONFIG.CELL_SIZE}px`;
  $iceBlock.style.top = `${creature.row * CONFIG.CELL_SIZE}px`;
  
  // 计算冰块大小（根据俄罗斯方块形状）
  const maxWidth = Math.max(...creature.colorData.blocks.map(block => block[0])) + 1;
  const maxHeight = Math.max(...creature.colorData.blocks.map(block => block[1])) + 1;
  
  $iceBlock.style.width = `${maxWidth * CONFIG.CELL_SIZE}px`;
  $iceBlock.style.height = `${maxHeight * CONFIG.CELL_SIZE}px`;
  $iceBlock.style.background = 'linear-gradient(135deg, #E6F3FF, #B3D9FF, #80BFFF)';
  $iceBlock.style.borderRadius = '6px';
  $iceBlock.style.boxShadow = 'inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.1)';
  $iceBlock.style.border = '2px solid rgba(255,255,255,0.6)';
  $iceBlock.style.zIndex = 2;
  
  iceBlock.element = $iceBlock;
  
  if (!$gameBoard) {
    console.error('游戏板元素不存在');
    return null;
  }
  
  if (!$iceBlock) {
    console.error('冰块元素不存在');
    return null;
  }
  
  $gameBoard.appendChild($iceBlock);
  
  return iceBlock;
};

// 创建冰块隐藏的小人
const createIceHiddenCreatures = () => {
  // 随机创建一些冰块隐藏的小人
  for (let i = 0; i < CONFIG.HIDDEN_CREATURE_COUNT; i++) {
    const colorData = getRandomColor();
    const { row, col } = getRandomPosition();
    
    // 检查是否可以放置
    if (canPlaceCreature(row, col, colorData.blocks)) {
      const creature = createCreature(row, col, colorData);
      
      if (creature) {
        // 创建冰块覆盖
        const iceBlock = createIceBlock(creature);
        gameState.iceBlocks.push(iceBlock);
        creature.element.style.display = 'none'; // 隐藏小人
        
        // 将小人添加到隐藏列表中
        gameState.hiddenCreatures.push(creature);
        
        // 标记占用的位置（每个位置都指向同一个creature对象）
        colorData.blocks.forEach(block => {
          gameState.board[row + block[1]][col + block[0]] = creature;
        });
      }
    }
  }
};

// 更新UI
const updateUI = () => {
  $score.textContent = gameState.score;
  $level.textContent = gameState.level;
  $target.textContent = gameState.target;
};

// 开始游戏
const startGame = () => {
  // 隐藏开始按钮
  const startButton = document.getElementById('start-button');
  if (startButton) {
    startButton.classList.add('hidden');
  }
  
  initBoard();
};

// 点击选择小人
const selectCreature = (creature) => {
  // 清除之前的选择
  if (gameState.selectedCreature) {
    clearCreatureSelection(gameState.selectedCreature);
  }
  
  // 选择新的小人
  gameState.selectedCreature = creature;
  
  // 让小人变大并眨眼
  gsap.to(creature.element, {
    scale: 1.2,
    duration: CONFIG.ANIMATION_DURATION,
    ease: "back.out(1.7)"
  });
  
  // 触发眨眼动画
  if (creature.$eyes && creature.$eyes.length > 0) {
    gsap.to(creature.$eyes, {
      scaleY: 0.1,
      duration: 0.1,
      ease: "power2.inOut",
      yoyo: true,
      repeat: 1
    });
  }
  
  console.log(`选择了小人: ${creature.id}`);
};

// 清除小人选择样式
const clearCreatureSelection = (creature) => {
  // 移除所有选择框
  if (creature.selectionBoxes) {
    creature.selectionBoxes.forEach(box => {
      box.remove();
    });
    creature.selectionBoxes = [];
  }
  
  // 恢复小人大小
  gsap.to(creature.element, {
    scale: 1,
    duration: CONFIG.ANIMATION_DURATION,
    ease: "power2.out"
  });
};

// 使用GSAP优化的点击移动系统
const setupClickMoveSystem = () => {
  // 添加点击事件监听
  $gameBoard.addEventListener('click', (e) => {
    const target = e.target;
    
    // 检查是否点击了小人的实际方块部分
    if (target.classList.contains('tetris-block') || target.closest('.tetris-block')) {
      const blockElement = target.classList.contains('tetris-block') ? target : target.closest('.tetris-block');
      const creatureElement = blockElement.closest('.creature');
      const creature = gameState.creatures.find(c => c.element === creatureElement);
      
      if (creature) {
        // 如果点击的是已经选中的小人，取消选择
        if (gameState.selectedCreature === creature) {
          clearCreatureSelection(creature);
          gameState.selectedCreature = null;
        } else {
          // 如果点击的是其他小人，先清除之前的选择，再选择新的
          if (gameState.selectedCreature) {
            clearCreatureSelection(gameState.selectedCreature);
          }
          selectCreature(creature);
        }
        return;
      }
    }
    
    // 检查是否点击了格子
    if (target.classList.contains('map-cell')) {
      const row = parseInt(target.dataset.row);
      const col = parseInt(target.dataset.col);
      
      if (gameState.selectedCreature) {
        moveCreatureToTarget(row, col);
      }
    }
    
    // 点击空白区域（游戏板本身）取消选择
    if (target === $gameBoard && gameState.selectedCreature) {
      clearCreatureSelection(gameState.selectedCreature);
      gameState.selectedCreature = null;
    }
  });
};

// 移动小人到目标位置（简化版）
const moveCreatureToTarget = (targetRow, targetCol) => {
  const creature = gameState.selectedCreature;
  if (!creature) return;
  
  // 直接移动到目标位置
  animateCreatureWalk(creature, targetRow, targetCol);
};

// 使用GSAP动画小人走路（一格一格移动）
const animateCreatureWalk = (creature, targetRow, targetCol) => {
  // 长出脚
  standUpAndExtendLimbs(creature);
  
  // 计算移动路径（只能上下左右移动，不能斜着移动）
  const path = calculateStepPath(creature.row, creature.col, targetRow, targetCol);
  
  if (path.length === 0) {
    // 没有有效路径，直接收起脚
    sitDownAndHideLimbs(creature);
    clearCreatureSelection(creature);
    gameState.selectedCreature = null;
    return;
  }
  
  // 创建走路时间线
  const walkTimeline = gsap.timeline({
    onComplete: () => {
      // 检查是否到达出口
      checkForExitMatch(creature);
      
      // 收起脚
      sitDownAndHideLimbs(creature);
      
      // 清除选择
      clearCreatureSelection(creature);
      gameState.selectedCreature = null;
    }
  });
  
  // 一格一格移动
  path.forEach((step, index) => {
    const stepDuration = CONFIG.STEP_DURATION; // 每步持续时间
    const delay = index * stepDuration;
    
    walkTimeline.to(creature.element, {
      left: step.col * CONFIG.CELL_SIZE,
      top: step.row * CONFIG.CELL_SIZE,
      duration: stepDuration,
      ease: "circ.inOut"
    }, delay);
    
    // 添加身体摆动
    walkTimeline.to(creature.element, {
      rotation: "+=3deg",
      duration: stepDuration * 0.3,
      ease: "circ.inOut",
      yoyo: true,
      repeat: 1
    }, delay);
    
    // 更新游戏状态
    walkTimeline.call(() => {
      gameState.board[creature.row][creature.col] = null;
      creature.row = step.row;
      creature.col = step.col;
      gameState.board[step.row][step.col] = creature;
    }, [], delay);
  });
};

// 计算移动路径（只能上下左右移动）
const calculateStepPath = (startRow, startCol, targetRow, targetCol) => {
  const path = [];
  let currentRow = startRow;
  let currentCol = startCol;
  
  // 先移动行（上下）
  while (currentRow !== targetRow) {
    if (currentRow < targetRow) {
      currentRow++;
    } else {
      currentRow--;
    }
    path.push({ row: currentRow, col: currentCol });
  }
  
  // 再移动列（左右）
  while (currentCol !== targetCol) {
    if (currentCol < targetCol) {
      currentCol++;
    } else {
      currentCol--;
    }
    path.push({ row: currentRow, col: currentCol });
  }
  
  return path;
};

// 页面加载完成后等待用户点击开始按钮
document.addEventListener('DOMContentLoaded', () => {
  // 页面加载完成，等待用户点击开始按钮
});

// 暴露到全局作用域
window.startGame = startGame;

// 下一关
const nextLevel = () => {
  gameState.level++;
  gameState.target = Math.min(5 + gameState.level * 2, 20);
  gameState.score = 0; // 重置分数
  
  // 重新初始化棋盘
  initBoard();
  updateUI();
  
  // 显示关卡完成消息
  showMessage(`关卡 ${gameState.level - 1} 完成！`);
};

// 显示消息
const showMessage = (message) => {
  const $message = document.createElement('div');
  $message.textContent = message;
  $message.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 20px 40px;
    border-radius: 10px;
    font-size: 1.2rem;
    z-index: 1000;
    pointer-events: none;
  `;
  
  document.body.appendChild($message);
  
  gsap.fromTo($message, 
    { scale: 0, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }
  );
  
  setTimeout(() => {
    gsap.to($message, {
      scale: 0,
      opacity: 0,
      duration: 0.3,
      ease: "back.in(1.7)",
      onComplete: () => {
        document.body.removeChild($message);
      }
    });
  }, 2000);
};

// 页面加载完成后显示开始按钮
window.addEventListener('load', () => {
  setTimeout(() => {
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');
    setTimeout(() => {
      loading.style.display = 'none';
    }, 500);
  }, 1000);
});