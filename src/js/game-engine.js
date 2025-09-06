// 游戏引擎 - 负责游戏逻辑和渲染
class GameEngine {
  constructor(canvas, ctx, systemInfo, levelId) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.systemInfo = systemInfo;
    this.levelId = levelId;
    
    // 地图管理器
    this.mapManager = new MapManager();
    
    // 游戏状态
    this.gameState = {
      level: levelId,
      score: 0,
      target: 0,
      timeLeft: 0,
      board: [],
      creatures: [],
      exits: [],
      iceBlocks: [], // 冰块系统
      hiddenCreatures: [], // 被冰块隐藏的生物
      layers: [], // 多层网格
      blockRegions: new Map(), // 区域索引
      iceStates: new Map(), // 冰层状态
      selectedCreature: null,
      isGameOver: false,
      isPaused: false
    };
    
    // 游戏配置
    this.config = {
      BOARD_SIZE: 9, // 改为9x9棋盘
      CELL_SIZE: 30,
      CREATURE_COUNT: 8,
      HIDDEN_CREATURE_COUNT: 5,
      ICE_MELT_DELAY: 2000, // 冰块融化延迟
      STEP_DURATION: 0.4,
      ANIMATION_DURATION: 0.3
    };
    
    // 颜色配置
    this.colors = [
      { 
        name: 'red', 
        gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
        shape: 'single',
        blocks: [[0, 0]]
      },
      { 
        name: 'blue', 
        gradient: 'linear-gradient(135deg, #45B7D1, #6BC5D8)',
        shape: 'line2',
        blocks: [[0, 0], [1, 0]]
      },
      { 
        name: 'green', 
        gradient: 'linear-gradient(135deg, #96CEB4, #A8E6CF)',
        shape: 'line3',
        blocks: [[0, 0], [1, 0], [2, 0]]
      },
      { 
        name: 'yellow', 
        gradient: 'linear-gradient(135deg, #FFEAA7, #FFF3CD)',
        shape: 'square',
        blocks: [[0, 0], [1, 0], [0, 1], [1, 1]]
      },
      { 
        name: 'purple', 
        gradient: 'linear-gradient(135deg, #DDA0DD, #E6B3E6)',
        shape: 'lshape',
        blocks: [[0, 0], [0, 1], [0, 2], [1, 2]]
      },
      { 
        name: 'orange', 
        gradient: 'linear-gradient(135deg, #FFA500, #FFB347)',
        shape: 'tshape',
        blocks: [[0, 0], [1, 0], [2, 0], [1, 1]]
      },
      { 
        name: 'pink', 
        gradient: 'linear-gradient(135deg, #FFB6C1, #FFC0CB)',
        shape: 'zshape',
        blocks: [[0, 0], [1, 0], [1, 1], [2, 1]]
      },
      { 
        name: 'cyan', 
        gradient: 'linear-gradient(135deg, #00CED1, #40E0D0)',
        shape: 'line4',
        blocks: [[0, 0], [1, 0], [2, 0], [3, 0]]
      },
      { 
        name: 'lime', 
        gradient: 'linear-gradient(135deg, #32CD32, #90EE90)',
        shape: 'bigl',
        blocks: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]
      },
      { 
        name: 'indigo', 
        gradient: 'linear-gradient(135deg, #4B0082, #6A5ACD)',
        shape: 'cross',
        blocks: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]
      }
    ];
    
    this.init();
  }
  
  init() {
    // 加载地图数据
    const mapData = this.mapManager.getMap(this.levelId);
    if (!mapData) {
      console.error(`地图 ${this.levelId} 不存在`);
      return;
    }
    
    // 更新配置
    this.config.BOARD_SIZE = mapData.boardSize;
    this.config.CELL_SIZE = mapData.cellSize;
    this.gameState.target = mapData.target;
    this.gameState.timeLeft = mapData.timeLimit;
    
    // 初始化游戏
    this.initBoard();
    this.createCreaturesFromMap(mapData);
    this.createExitsFromMap(mapData);
    this.setupEventListeners();
    this.startGameTimer();
    
    console.log(`游戏引擎初始化完成 - 关卡 ${this.levelId}`);
  }
  
  // 开始游戏
  start() {
    console.log(`开始游戏 - 关卡 ${this.levelId}`);
    this.draw();
  }
  
  // 初始化游戏棋盘
  initBoard() {
    this.gameState.board = [];
    this.gameState.creatures = [];
    this.gameState.exits = [];
    this.gameState.selectedCreature = null;
    
    // 创建棋盘
    for (let row = 0; row < this.config.BOARD_SIZE; row++) {
      this.gameState.board[row] = [];
      for (let col = 0; col < this.config.BOARD_SIZE; col++) {
        this.gameState.board[row][col] = null;
      }
    }
  }
  
  // 从地图数据创建生物（支持多层结构）
  createCreaturesFromMap(mapData) {
    // 初始化多层网格
    this.gameState.layers = mapData.layers || [];
    this.gameState.blockRegions = mapData.blockRegions || new Map();
    this.gameState.iceStates = mapData.iceStates || new Map();
    
    // 从顶层（第0层）创建可见的生物
    if (this.gameState.layers.length > 0) {
      const topLayer = this.gameState.layers[0];
      topLayer.forEach((blockData, key) => {
        if (blockData.type !== 'ice') {
          const colorData = this.colors.find(c => c.name === blockData.color);
          if (colorData) {
            const creature = this.createCreatureFromBlockData(blockData, colorData);
            if (creature) {
              this.gameState.creatures.push(creature);
              
              // 标记占用的位置
              blockData.blocks.forEach(block => {
                const row = blockData.position.row + block[1];
                const col = blockData.position.col + block[0];
                if (row >= 0 && row < this.config.BOARD_SIZE && 
                    col >= 0 && col < this.config.BOARD_SIZE) {
                  this.gameState.board[row][col] = creature;
                }
              });
            }
          }
        }
      });
    }
  }
  
  // 从地图数据创建出口
  createExitsFromMap(mapData) {
    mapData.exits.forEach(exitData => {
      const colorData = this.colors.find(c => c.name === exitData.color);
      if (colorData) {
        const exit = this.createExit(colorData, exitData.position);
        this.gameState.exits.push(exit);
      }
    });
  }
  
  // 从砖块数据创建生物
  createCreatureFromBlockData(blockData, colorData) {
    const creature = {
      id: blockData.id,
      row: blockData.position.row,
      col: blockData.position.col,
      color: blockData.color,
      colorData: colorData,
      layer: blockData.layer,
      blockData: blockData,
      element: null,
      $shape: null,
      $eyes: [],
      animations: {},
      isWalking: false,
      hidden: blockData.hidden || false
    };
    
    // 创建生物元素（简化版，适配Canvas）
    creature.element = this.createCreatureElement(creature);
    
    return creature;
  }
  
  // 创建生物
  createCreature(row, col, colorData) {
    const creature = {
      id: `${row}-${col}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      row,
      col,
      color: colorData.name,
      colorData: colorData,
      element: null,
      $shape: null,
      $eyes: [],
      animations: {},
      isWalking: false
    };
    
    // 创建生物元素（简化版，适配Canvas）
    creature.element = this.createCreatureElement(creature);
    
    return creature;
  }
  
  // 创建生物元素（Canvas版本）
  createCreatureElement(creature) {
    const element = {
      x: creature.col * this.config.CELL_SIZE,
      y: creature.row * this.config.CELL_SIZE,
      width: Math.max(...creature.colorData.blocks.map(block => block[0])) + 1,
      height: Math.max(...creature.colorData.blocks.map(block => block[1])) + 1,
      blocks: creature.colorData.blocks,
      color: creature.colorData.gradient,
      scale: 1,
      rotation: 0,
      alpha: 1
    };
    
    return element;
  }
  
  // 创建出口
  createExit(colorData, position) {
    const exit = {
      color: colorData.name,
      colorData: colorData,
      position: position,
      element: null
    };
    
    // 创建出口元素（Canvas版本）
    exit.element = this.createExitElement(exit);
    
    return exit;
  }
  
  // 创建出口元素（Canvas版本）
  createExitElement(exit) {
    const element = {
      position: exit.position,
      color: exit.colorData.gradient,
      x: 0,
      y: 0,
      width: 40,
      height: 15
    };
    
    // 根据位置设置坐标
    switch (exit.position) {
      case 'top-left':
        element.x = 0;
        element.y = 0;
        break;
      case 'top-right':
        element.x = this.config.BOARD_SIZE * this.config.CELL_SIZE - element.width;
        element.y = 0;
        break;
      case 'bottom-left':
        element.x = 0;
        element.y = this.config.BOARD_SIZE * this.config.CELL_SIZE - element.height;
        break;
      case 'bottom-right':
        element.x = this.config.BOARD_SIZE * this.config.CELL_SIZE - element.width;
        element.y = this.config.BOARD_SIZE * this.config.CELL_SIZE - element.height;
        break;
      case 'left-center':
        element.x = 0;
        element.y = (this.config.BOARD_SIZE * this.config.CELL_SIZE - element.height) / 2;
        break;
      case 'right-center':
        element.x = this.config.BOARD_SIZE * this.config.CELL_SIZE - element.width;
        element.y = (this.config.BOARD_SIZE * this.config.CELL_SIZE - element.height) / 2;
        break;
    }
    
    return element;
  }
  
  // 设置事件监听器
  setupEventListeners() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e));
  }
  
  // 处理点击事件
  handleClick(event) {
    if (this.gameState.isGameOver || this.gameState.isPaused) return;
    
    let x, y;
    
    // 抖音小游戏环境兼容处理
    if (typeof this.canvas.getBoundingClientRect === 'function') {
      // 浏览器环境
      const rect = this.canvas.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else {
      // 抖音小游戏环境 - 直接使用坐标
      x = event.clientX || event.x || 0;
      y = event.clientY || event.y || 0;
    }
    
    // 转换屏幕坐标到游戏坐标
    const gameX = x;
    const gameY = y;
    
    // 检查是否点击了生物
    const clickedCreature = this.getCreatureAtPosition(gameX, gameY);
    if (clickedCreature) {
      this.selectCreature(clickedCreature);
      return;
    }
    
    // 检查是否点击了棋盘格子
    const clickedCell = this.getCellAtPosition(gameX, gameY);
    if (clickedCell && this.gameState.selectedCreature) {
      this.moveCreatureToTarget(clickedCell.row, clickedCell.col);
    }
  }
  
  // 处理触摸事件
  handleTouch(event) {
    event.preventDefault();
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      let x, y;
      
      // 抖音小游戏环境兼容处理
      if (typeof this.canvas.getBoundingClientRect === 'function') {
        // 浏览器环境
        const rect = this.canvas.getBoundingClientRect();
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
      } else {
        // 抖音小游戏环境 - 直接使用坐标
        x = touch.clientX || touch.x || 0;
        y = touch.clientY || touch.y || 0;
      }
      
      // 模拟点击事件
      this.handleClick({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }
  
  // 获取指定位置的生物
  getCreatureAtPosition(x, y) {
    for (let creature of this.gameState.creatures) {
      const element = creature.element;
      if (x >= element.x && x <= element.x + element.width * this.config.CELL_SIZE &&
          y >= element.y && y <= element.y + element.height * this.config.CELL_SIZE) {
        return creature;
      }
    }
    return null;
  }
  
  // 获取指定位置的格子
  getCellAtPosition(x, y) {
    const col = Math.floor(x / this.config.CELL_SIZE);
    const row = Math.floor(y / this.config.CELL_SIZE);
    
    if (row >= 0 && row < this.config.BOARD_SIZE && 
        col >= 0 && col < this.config.BOARD_SIZE) {
      return { row, col };
    }
    return null;
  }
  
  // 选择生物
  selectCreature(creature) {
    // 清除之前的选择
    if (this.gameState.selectedCreature) {
      this.clearCreatureSelection(this.gameState.selectedCreature);
    }
    
    // 选择新的生物
    this.gameState.selectedCreature = creature;
    creature.element.scale = 1.2;
    
    console.log(`选择了生物: ${creature.id}`);
  }
  
  // 清除生物选择
  clearCreatureSelection(creature) {
    creature.element.scale = 1;
  }
  
  // 移动生物到目标位置
  moveCreatureToTarget(targetRow, targetCol) {
    const creature = this.gameState.selectedCreature;
    if (!creature) return;
    
    // 检查是否可以移动到目标位置
    if (this.canMoveToPosition(creature, targetRow, targetCol)) {
      this.animateCreatureMove(creature, targetRow, targetCol);
    }
    
    // 清除选择
    this.clearCreatureSelection(creature);
    this.gameState.selectedCreature = null;
  }
  
  // 检查是否可以移动到指定位置
  canMoveToPosition(creature, targetRow, targetCol) {
    // 检查边界
    for (let block of creature.colorData.blocks) {
      const row = targetRow + block[1];
      const col = targetCol + block[0];
      
      if (row < 0 || row >= this.config.BOARD_SIZE || 
          col < 0 || col >= this.config.BOARD_SIZE) {
        return false;
      }
      
      // 检查是否被其他生物占用
      const existingCreature = this.gameState.board[row][col];
      if (existingCreature && existingCreature !== creature) {
        return false;
      }
    }
    
    return true;
  }
  
  // 动画移动生物
  animateCreatureMove(creature, targetRow, targetCol) {
    // 更新游戏状态
    creature.colorData.blocks.forEach(block => {
      const oldRow = creature.row + block[1];
      const oldCol = creature.col + block[0];
      this.gameState.board[oldRow][oldCol] = null;
    });
    
    creature.row = targetRow;
    creature.col = targetCol;
    
    creature.colorData.blocks.forEach(block => {
      const newRow = creature.row + block[1];
      const newCol = creature.col + block[0];
      this.gameState.board[newRow][newCol] = creature;
    });
    
    // 更新元素位置
    creature.element.x = targetCol * this.config.CELL_SIZE;
    creature.element.y = targetRow * this.config.CELL_SIZE;
    
    // 检查冰块融化
    this.checkIceMelt(creature);
    
    // 检查是否到达出口
    this.checkForExitMatch(creature);
  }
  
  // 检查冰块融化（核心性能优化逻辑）
  checkIceMelt(movedCreature) {
    const blockId = movedCreature.id;
    const currentLayer = movedCreature.layer || 0;
    
    // 1. 获取该砖块占据的所有格子（O(1)查找）
    const regions = this.gameState.blockRegions.get(blockId);
    if (!regions) return;
    
    // 2. 检查这些格子在当前层是否已无遮挡（批量检查）
    const allEmpty = regions.every(({x, y}) => {
      const key = `${x},${y}`;
      return !this.gameState.layers[currentLayer] || !this.gameState.layers[currentLayer].has(key);
    });
    
    if (allEmpty) {
      // 3. 若区域内无遮挡，标记下层冰层开始融化
      regions.forEach(({x, y}) => {
        const iceKey = `${currentLayer + 1},${x},${y}`;
        const iceState = this.gameState.iceStates.get(iceKey);
        
        if (iceState && iceState.isCovered) {
          // 标记冰层可融化
          iceState.isCovered = false;
          
          // 延迟融化（增加游戏体验）
          setTimeout(() => {
            this.meltIceAndRevealCreature(currentLayer + 1, x, y);
          }, this.config.ICE_MELT_DELAY);
        }
      });
    }
  }
  
  // 融化冰块并露出隐藏的生物
  meltIceAndRevealCreature(layer, x, y) {
    const iceKey = `${layer},${x},${y}`;
    const iceState = this.gameState.iceStates.get(iceKey);
    
    if (!iceState || iceState.isMelted) return;
    
    // 标记冰块已融化
    iceState.isMelted = true;
    
    // 从当前层移除冰块
    if (this.gameState.layers[layer]) {
      this.gameState.layers[layer].delete(`${x},${y}`);
    }
    
    // 检查下层是否有隐藏的生物
    const nextLayer = layer + 1;
    if (this.gameState.layers[nextLayer]) {
      const hiddenBlock = this.gameState.layers[nextLayer].get(`${x},${y}`);
      
      if (hiddenBlock && hiddenBlock.hidden) {
        // 露出隐藏的生物
        this.revealHiddenCreature(hiddenBlock);
      }
    }
  }
  
  // 露出隐藏的生物
  revealHiddenCreature(hiddenBlockData) {
    const colorData = this.colors.find(c => c.name === hiddenBlockData.color);
    if (!colorData) return;
    
    // 创建新的生物
    const creature = this.createCreatureFromBlockData(hiddenBlockData, colorData);
    creature.hidden = false;
    
    // 添加到游戏状态
    this.gameState.creatures.push(creature);
    
    // 更新棋盘状态
    hiddenBlockData.blocks.forEach(block => {
      const row = hiddenBlockData.position.row + block[1];
      const col = hiddenBlockData.position.col + block[0];
      if (row >= 0 && row < this.config.BOARD_SIZE && 
          col >= 0 && col < this.config.BOARD_SIZE) {
        this.gameState.board[row][col] = creature;
      }
    });
    
    // 从隐藏层移除
    const layer = hiddenBlockData.layer;
    if (this.gameState.layers[layer]) {
      this.gameState.layers[layer].delete(`${hiddenBlockData.position.row},${hiddenBlockData.position.col}`);
    }
    
    console.log(`隐藏生物 ${creature.id} 已露出`);
  }
  
  // 检查是否到达对应颜色的出口
  checkForExitMatch(creature) {
    // 检查是否在棋盘边缘
    const isAtEdge = creature.row === 0 || creature.row === this.config.BOARD_SIZE - 1 || 
                     creature.col === 0 || creature.col === this.config.BOARD_SIZE - 1;
    
    if (!isAtEdge) return false;
    
    // 找到对应颜色的出口
    const matchingExit = this.gameState.exits.find(exit => exit.color === creature.color);
    if (!matchingExit) return false;
    
    // 检查是否到达出口位置
    const exitElement = matchingExit.element;
    const creatureElement = creature.element;
    
    // 简化的碰撞检测
    if (this.isCreatureAtExit(creatureElement, exitElement)) {
      this.eliminateCreature(creature);
      this.gameState.score += 10;
      
      if (this.gameState.score >= this.gameState.target) {
        this.completeLevel();
      }
      
      return true;
    }
    
    return false;
  }
  
  // 检查生物是否在出口位置
  isCreatureAtExit(creatureElement, exitElement) {
    // 简化的碰撞检测
    const creatureCenterX = creatureElement.x + creatureElement.width * this.config.CELL_SIZE / 2;
    const creatureCenterY = creatureElement.y + creatureElement.height * this.config.CELL_SIZE / 2;
    
    return creatureCenterX >= exitElement.x && 
           creatureCenterX <= exitElement.x + exitElement.width &&
           creatureCenterY >= exitElement.y && 
           creatureCenterY <= exitElement.y + exitElement.height;
  }
  
  // 消除生物
  eliminateCreature(creature) {
    // 从棋盘和生物列表中移除
    creature.colorData.blocks.forEach(block => {
      const row = creature.row + block[1];
      const col = creature.col + block[0];
      this.gameState.board[row][col] = null;
    });
    
    const index = this.gameState.creatures.indexOf(creature);
    if (index > -1) {
      this.gameState.creatures.splice(index, 1);
    }
    
    console.log(`生物 ${creature.id} 被消除`);
  }
  
  // 完成关卡
  completeLevel() {
    this.gameState.isGameOver = true;
    console.log(`关卡 ${this.levelId} 完成！`);
    
    // 触发关卡完成回调
    if (window.onLevelComplete) {
      window.onLevelComplete(this.levelId);
    }
  }
  
  // 开始游戏计时器
  startGameTimer() {
    this.gameTimer = setInterval(() => {
      if (!this.gameState.isGameOver && !this.gameState.isPaused) {
        this.gameState.timeLeft--;
        
        if (this.gameState.timeLeft <= 0) {
          this.gameOver();
        }
      }
    }, 1000);
  }
  
  // 游戏结束
  gameOver() {
    this.gameState.isGameOver = true;
    console.log(`关卡 ${this.levelId} 失败！`);
    
    // 清除计时器
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    
    // 返回菜单
    if (window.onLevelComplete) {
      window.onLevelComplete(this.levelId);
    }
  }
  
  // 绘制游戏
  draw() {
    this.drawBackground();
    this.drawBoard();
    this.drawCreatures();
    this.drawExits();
    this.drawUI();
    
    if (this.gameState.isGameOver) {
      this.drawGameOverScreen();
    }
  }
  
  // 绘制背景
  drawBackground() {
    // 渐变背景
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.systemInfo.windowHeight);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#4682B4');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.systemInfo.windowWidth, this.systemInfo.windowHeight);
  }
  
  // 绘制棋盘
  drawBoard() {
    const boardWidth = this.config.BOARD_SIZE * this.config.CELL_SIZE;
    const boardHeight = this.config.BOARD_SIZE * this.config.CELL_SIZE;
    const startX = (this.systemInfo.windowWidth - boardWidth) / 2;
    const startY = (this.systemInfo.windowHeight - boardHeight) / 2;
    
    // 绘制棋盘背景
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.fillRect(startX, startY, boardWidth, boardHeight);
    
    // 绘制格子
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    
    for (let row = 0; row <= this.config.BOARD_SIZE; row++) {
      const y = startY + row * this.config.CELL_SIZE;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(startX + boardWidth, y);
      this.ctx.stroke();
    }
    
    for (let col = 0; col <= this.config.BOARD_SIZE; col++) {
      const x = startX + col * this.config.CELL_SIZE;
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, startY + boardHeight);
      this.ctx.stroke();
    }
  }
  
  // 绘制生物
  drawCreatures() {
    const startX = (this.systemInfo.windowWidth - this.config.BOARD_SIZE * this.config.CELL_SIZE) / 2;
    const startY = (this.systemInfo.windowHeight - this.config.BOARD_SIZE * this.config.CELL_SIZE) / 2;
    
    this.gameState.creatures.forEach(creature => {
      const element = creature.element;
      const x = startX + element.x;
      const y = startY + element.y;
      
      this.ctx.save();
      this.ctx.translate(x + element.width * this.config.CELL_SIZE / 2, 
                        y + element.height * this.config.CELL_SIZE / 2);
      this.ctx.scale(element.scale, element.scale);
      this.ctx.translate(-element.width * this.config.CELL_SIZE / 2, 
                        -element.height * this.config.CELL_SIZE / 2);
      
      // 绘制生物方块
      element.blocks.forEach(block => {
        const blockX = block[0] * this.config.CELL_SIZE;
        const blockY = block[1] * this.config.CELL_SIZE;
        
        this.ctx.fillStyle = this.getColorFromGradient(element.color);
        this.ctx.fillRect(blockX, blockY, this.config.CELL_SIZE, this.config.CELL_SIZE);
        
        // 绘制边框
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(blockX, blockY, this.config.CELL_SIZE, this.config.CELL_SIZE);
      });
      
      this.ctx.restore();
    });
  }
  
  // 绘制出口
  drawExits() {
    const startX = (this.systemInfo.windowWidth - this.config.BOARD_SIZE * this.config.CELL_SIZE) / 2;
    const startY = (this.systemInfo.windowHeight - this.config.BOARD_SIZE * this.config.CELL_SIZE) / 2;
    
    this.gameState.exits.forEach(exit => {
      const element = exit.element;
      const x = startX + element.x;
      const y = startY + element.y;
      
      this.ctx.fillStyle = this.getColorFromGradient(element.color);
      this.ctx.fillRect(x, y, element.width, element.height);
      
      // 绘制边框
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, element.width, element.height);
      
      // 绘制出口标识
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(exit.color.charAt(0).toUpperCase(), 
                       x + element.width / 2, 
                       y + element.height / 2 + 4);
    });
  }
  
  // 绘制UI
  drawUI() {
    // 绘制分数和时间
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`分数: ${this.gameState.score}`, 20, 30);
    this.ctx.fillText(`目标: ${this.gameState.target}`, 20, 50);
    this.ctx.fillText(`时间: ${this.gameState.timeLeft}`, 20, 70);
    
    // 绘制关卡信息
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`关卡: ${this.gameState.level}`, this.systemInfo.windowWidth - 20, 30);
  }
  
  // 绘制游戏结束屏幕
  drawGameOverScreen() {
    // 半透明遮罩
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.systemInfo.windowWidth, this.systemInfo.windowHeight);
    
    // 游戏结束文字
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    
    if (this.gameState.score >= this.gameState.target) {
      this.ctx.fillText('关卡完成！', this.systemInfo.windowWidth / 2, this.systemInfo.windowHeight / 2 - 20);
      this.ctx.fillText(`分数: ${this.gameState.score}`, this.systemInfo.windowWidth / 2, this.systemInfo.windowHeight / 2 + 20);
    } else {
      this.ctx.fillText('游戏结束', this.systemInfo.windowWidth / 2, this.systemInfo.windowHeight / 2 - 20);
      this.ctx.fillText(`时间到！`, this.systemInfo.windowWidth / 2, this.systemInfo.windowHeight / 2 + 20);
    }
  }
  
  // 从渐变字符串获取颜色
  getColorFromGradient(gradientString) {
    // 简化的颜色提取
    if (gradientString.includes('red')) return '#FF6B6B';
    if (gradientString.includes('blue')) return '#45B7D1';
    if (gradientString.includes('green')) return '#96CEB4';
    if (gradientString.includes('yellow')) return '#FFEAA7';
    if (gradientString.includes('purple')) return '#DDA0DD';
    if (gradientString.includes('orange')) return '#FFA500';
    if (gradientString.includes('pink')) return '#FFB6C1';
    if (gradientString.includes('cyan')) return '#00CED1';
    if (gradientString.includes('lime')) return '#32CD32';
    if (gradientString.includes('indigo')) return '#4B0082';
    return '#666666';
  }
  
  // 销毁游戏实例
  destroy() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    
    // 移除事件监听器
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('touchstart', this.handleTouch);
    
    console.log(`游戏引擎 ${this.levelId} 已销毁`);
  }
}
