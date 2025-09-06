/**
 * 多层方块 Puzzle 游戏引擎
 * 核心特性：9x9网格 + 多层结构 + 障碍规避 + 颜色通关
 * 数据结构：分层网格 + 区域标记 + 哈希索引
 */

class MapEngine {
  constructor() {
    this.GRID_SIZE = 8; // 8x8网格
    this.MAX_LAYERS = 10; // 最大层数
    
    // 核心数据结构
    this.layers = new Map(); // 分层存储：layerId -> LayerData
    this.spatialIndex = new Map(); // 空间索引：(x,y) -> Set<Element>
    this.elementRegistry = new Map(); // 元素注册表：elementId -> Element
    
    // 游戏状态
    this.gameState = 'ready'; // ready, playing, completed
    this.selectedElement = null;
    this.moveHistory = [];
    
    // 性能优化缓存
    this.collisionCache = new Map(); // 碰撞检测缓存
    this.pathCache = new Map(); // 路径计算缓存
    
    // 动画相关
    this.animations = new Map(); // 存储动画对象
    this.animationQueue = []; // 动画队列
    this.blockAnimations = new Map(); // 方块动画状态
    this.gridAnimation = null; // 网格动画
    this.pulseAnimation = null; // 脉冲动画
    
    this.init();
  }
  
  init() {
    // 初始化所有层级
    for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
      this.layers.set(layer, {
        id: layer,
        elements: new Map(), // elementId -> Element
        occupiedCells: new Set(), // 被占用的格子
        iceCells: new Set(), // 冰层格子
        rockCells: new Set() // 石块格子
      });
    }
    
    // 初始化空间索引
    for (let x = 0; x < this.GRID_SIZE; x++) {
      for (let y = 0; y < this.GRID_SIZE; y++) {
        this.spatialIndex.set(`${x},${y}`, new Set());
      }
    }
    
    console.log('MapEngine 初始化完成');
  }
  
  /**
   * 加载地图数据
   * @param {Object} mapData - 地图配置数据
   */
  loadMap(mapData) {
    this.clearMap();
    
    // 加载门
    if (mapData.gates) {
      mapData.gates.forEach((gate, index) => {
        this.addGate(gate);
        // 延迟触发门脉冲动画
        setTimeout(() => {
          this.animateGatePulse(gate);
        }, index * 300);
      });
    }
    
    // 加载俄罗斯方块
    if (mapData.tetrisBlocks) {
      mapData.tetrisBlocks.forEach((block, index) => {
        this.addTetrisBlock(block);
        // 延迟触发进入动画
        setTimeout(() => {
          this.animateBlockEnter(block);
        }, index * 200);
      });
    }
    
    // 加载冰层
    if (mapData.iceLayers) {
      mapData.iceLayers.forEach(ice => this.addIceLayer(ice));
    }
    
    // 加载石块
    if (mapData.rocks) {
      mapData.rocks.forEach(rock => this.addRock(rock));
    }
    
    this.gameState = 'ready';
    console.log('地图加载完成:', mapData.name);
  }
  
  /**
   * 清空地图
   */
  clearMap() {
    this.layers.forEach(layer => {
      layer.elements.clear();
      layer.occupiedCells.clear();
      layer.iceCells.clear();
      layer.rockCells.clear();
    });
    
    this.spatialIndex.forEach(cellSet => cellSet.clear());
    this.elementRegistry.clear();
    this.collisionCache.clear();
    this.pathCache.clear();
    this.selectedElement = null;
    this.moveHistory = [];
  }
  
  /**
   * 添加门
   * @param {Object} gate - 门配置 {id, color, position, size, direction}
   */
  addGate(gate) {
    const element = {
      id: gate.id,
      type: 'gate',
      color: gate.color,
      position: gate.position,
      size: gate.size, // {width, height}
      direction: gate.direction, // 'up', 'right', 'down', 'left'
      layer: 0 // 门在最底层
    };
    
    this.addElement(element);
  }
  
  /**
   * 添加俄罗斯方块
   * @param {Object} block - 方块配置 {id, color, position, shape, layer}
   */
  addTetrisBlock(block) {
    // 使用 block.js 中的 createBlock 函数
    if (typeof createBlock === 'undefined') {
      console.error('createBlock 函数未找到，请确保 block.js 已加载');
      return;
    }
    
    const blockElement = createBlock(block);
    console.log('创建方块元素:', block.id, 'shapeData:', blockElement.shapeData);
    
    const element = {
      id: block.id,
      type: 'tetris',
      color: block.color,
      position: block.position, // {x, y}
      shape: block.shape, // 原始形状数据
      shapeData: blockElement.shapeData, // 处理后的形状数据
      layer: block.layer || 0,
      movable: true,
      occupiedCells: this.calculateOccupiedCells(block.position, blockElement.shapeData),
      blockElement: blockElement // 保存 block.js 创建的元素
    };
    
    console.log('添加方块到地图:', element.id, 'occupiedCells:', element.occupiedCells);
    this.addElement(element);
  }
  
  /**
   * 获取形状数据
   * @param {string} shapeName - 形状名称
   * @returns {Object} 形状数据
   */
  getShapeData(shapeName) {
    const shapes = {
      '1x1': { blocks: [[0, 0]] },
      '1x2': { blocks: [[0, 0], [0, 1]] },
      '1x3': { blocks: [[0, 0], [0, 1], [0, 2]] },
      '2x1': { blocks: [[0, 0], [1, 0]] },
      '2x2': { blocks: [[0, 0], [1, 0], [0, 1], [1, 1]] },
      '3x1': { blocks: [[0, 0], [1, 0], [2, 0]] },
      'L-shape': { blocks: [[0, 0], [0, 1], [0, 2], [1, 2]] },
      'T-shape': { blocks: [[0, 0], [1, 0], [2, 0], [1, 1]] }
    };
    
    return shapes[shapeName] || shapes['1x1'];
  }
  
  /**
   * 添加冰层
   * @param {Object} ice - 冰层配置 {id, position, layer, meltProgress}
   */
  addIceLayer(ice) {
    const element = {
      id: ice.id,
      type: 'ice',
      position: ice.position,
      layer: ice.layer || 1,
      meltProgress: ice.meltProgress || 0,
      covered: true // 初始被覆盖
    };
    
    this.addElement(element);
    this.layers.get(element.layer).iceCells.add(`${ice.position.x},${ice.position.y}`);
  }
  
  /**
   * 添加石块
   * @param {Object} rock - 石块配置 {id, position, layer}
   */
  addRock(rock) {
    const element = {
      id: rock.id,
      type: 'rock',
      position: rock.position,
      layer: rock.layer || 0,
      movable: false
    };
    
    this.addElement(element);
    this.layers.get(element.layer).rockCells.add(`${rock.position.x},${rock.position.y}`);
  }
  
  /**
   * 添加元素到引擎
   * @param {Object} element - 元素对象
   */
  addElement(element) {
    const layer = this.layers.get(element.layer);
    layer.elements.set(element.id, element);
    
    // 更新空间索引
    if (element.type === 'tetris') {
      element.occupiedCells.forEach(cell => {
        this.spatialIndex.get(cell).add(element.id);
      });
      layer.occupiedCells.add(...element.occupiedCells);
    } else {
      const cellKey = `${element.position.x},${element.position.y}`;
      this.spatialIndex.get(cellKey).add(element.id);
      layer.occupiedCells.add(cellKey);
    }
    
    this.elementRegistry.set(element.id, element);
  }
  
  /**
   * 计算方块占据的所有格子
   * @param {Object} position - 位置 {x, y}
   * @param {Object} shapeData - 形状数据 {blocks: [[x, y], ...]}
   * @returns {Array} 格子坐标数组
   */
  calculateOccupiedCells(position, shapeData) {
    console.log('calculateOccupiedCells 输入:', { position, shapeData });
    const cells = [];
    if (shapeData.blocks) {
      // 新的格式：blocks 数组
      console.log('使用 blocks 数组:', shapeData.blocks);
      shapeData.blocks.forEach(block => {
        cells.push(`${position.x + block[0]},${position.y + block[1]}`);
      });
    } else if (shapeData.width && shapeData.height) {
      // 旧的格式：width, height
      console.log('使用 width/height:', { width: shapeData.width, height: shapeData.height });
      for (let x = position.x; x < position.x + shapeData.width; x++) {
        for (let y = position.y; y < position.y + shapeData.height; y++) {
          cells.push(`${x},${y}`);
        }
      }
    } else {
      console.warn('无法识别的 shapeData 格式:', shapeData);
    }
    console.log('计算出的 cells:', cells);
    return cells;
  }
  
  /**
   * 选择方块
   * @param {string} elementId - 元素ID
   * @returns {boolean} 是否成功选择
   */
  selectElement(elementId) {
    const element = this.elementRegistry.get(elementId);
    if (!element || element.type !== 'tetris' || !element.movable) {
      return false;
    }
    
    this.selectedElement = element;
    return true;
  }
  
  /**
   * 移动方块
   * @param {string} direction - 移动方向 'up', 'down', 'left', 'right'
   * @returns {boolean} 是否成功移动
   */
  moveElement(direction) {
    if (!this.selectedElement) return false;
    
    const newPosition = this.calculateNewPosition(this.selectedElement.position, direction);
    
    // 检查移动是否合法
    if (!this.isValidMove(this.selectedElement, newPosition)) {
      return false;
    }
    
    // 执行移动
    this.executeMove(this.selectedElement, newPosition);
    
    // 检查冰层融化
    this.checkIceMelting();
    
    // 检查出门条件
    this.checkGateExit();
    
    return true;
  }
  
  /**
   * 计算新位置
   * @param {Object} currentPos - 当前位置
   * @param {string} direction - 方向
   * @returns {Object} 新位置
   */
  calculateNewPosition(currentPos, direction) {
    const newPos = { ...currentPos };
    
    switch (direction) {
      case 'up':
        newPos.y = Math.max(0, newPos.y - 1);
        break;
      case 'down':
        newPos.y = Math.min(this.GRID_SIZE - 1, newPos.y + 1);
        break;
      case 'left':
        newPos.x = Math.max(0, newPos.x - 1);
        break;
      case 'right':
        newPos.x = Math.min(this.GRID_SIZE - 1, newPos.x + 1);
        break;
    }
    
    return newPos;
  }
  
  /**
   * 检查移动是否合法
   * @param {Object} element - 要移动的元素
   * @param {Object} newPosition - 新位置
   * @returns {boolean} 是否合法
   */
  isValidMove(element, newPosition) {
    // 检查边界
    const maxX = Math.max(...element.shapeData.blocks.map(block => block[0]));
    const maxY = Math.max(...element.shapeData.blocks.map(block => block[1]));
    
    if (newPosition.x < 0 || newPosition.y < 0 || 
        newPosition.x + maxX >= this.GRID_SIZE ||
        newPosition.y + maxY >= this.GRID_SIZE) {
      return false;
    }
    
    // 计算新位置占据的格子
    const newCells = this.calculateOccupiedCells(newPosition, element.shapeData);
    
    // 检查碰撞
    return this.checkCollision(element.id, newCells);
  }
  
  /**
   * 碰撞检测 - 核心性能优化函数
   * @param {string} excludeId - 排除的元素ID（移动的元素）
   * @param {Array} cells - 要检查的格子
   * @returns {boolean} 是否有碰撞
   */
  checkCollision(excludeId, cells) {
    // 使用缓存提高性能
    const cacheKey = `${excludeId}-${cells.join(',')}`;
    if (this.collisionCache.has(cacheKey)) {
      return this.collisionCache.get(cacheKey);
    }
    
    let hasCollision = false;
    
    for (const cell of cells) {
      const elementsAtCell = this.spatialIndex.get(cell);
      
      for (const elementId of elementsAtCell) {
        if (elementId === excludeId) continue;
        
        const element = this.elementRegistry.get(elementId);
        
        // 检查石块碰撞
        if (element.type === 'rock') {
          hasCollision = true;
          break;
        }
        
        // 检查其他俄罗斯方块碰撞
        if (element.type === 'tetris' && element.movable) {
          hasCollision = true;
          break;
        }
      }
      
      if (hasCollision) break;
    }
    
    // 缓存结果
    this.collisionCache.set(cacheKey, hasCollision);
    return hasCollision;
  }
  
  /**
   * 执行移动
   * @param {Object} element - 要移动的元素
   * @param {Object} newPosition - 新位置
   */
  executeMove(element, newPosition) {
    const oldCells = [...element.occupiedCells];
    const newCells = this.calculateOccupiedCells(newPosition, element.shapeData);
    
    // 更新空间索引
    oldCells.forEach(cell => {
      this.spatialIndex.get(cell).delete(element.id);
    });
    
    newCells.forEach(cell => {
      this.spatialIndex.get(cell).add(element.id);
    });
    
    // 更新元素位置
    element.position = newPosition;
    element.occupiedCells = newCells;
    
    // 如果方块有 blockElement，使用 block.js 的移动动画
    if (element.blockElement && typeof moveBlock !== 'undefined') {
      moveBlock(element.blockElement, newPosition, () => {
        // 移动完成后的回调
        this.checkIceMelting();
        this.checkForExit(element);
      });
    } else {
      // 否则直接检查
      this.checkIceMelting();
      this.checkForExit(element);
    }
    
    // 记录移动历史
    this.moveHistory.push({
      elementId: element.id,
      from: oldCells,
      to: newCells,
      timestamp: Date.now()
    });
    
    // 清除相关缓存
    this.clearCacheForElement(element.id);
  }
  
  /**
   * 检查冰层融化
   */
  checkIceMelting() {
    this.layers.forEach((layer, layerId) => {
      layer.iceCells.forEach(cellKey => {
        const iceElement = this.findIceAtCell(cellKey, layerId);
        if (!iceElement) return;
        
        // 检查上方是否有方块覆盖
        const isCovered = this.isIceCovered(iceElement);
        
        if (!isCovered && iceElement.meltProgress < 100) {
          iceElement.meltProgress += 1; // 每帧融化1%
          
          if (iceElement.meltProgress >= 100) {
            this.completeIceMelting(iceElement);
          }
        }
      });
    });
  }
  
  /**
   * 检查冰层是否被覆盖
   * @param {Object} iceElement - 冰层元素
   * @returns {boolean} 是否被覆盖
   */
  isIceCovered(iceElement) {
    const cellKey = `${iceElement.position.x},${iceElement.position.y}`;
    const elementsAtCell = this.spatialIndex.get(cellKey);
    
    for (const elementId of elementsAtCell) {
      const element = this.elementRegistry.get(elementId);
      if (element.type === 'tetris' && element.layer > iceElement.layer) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 完成冰层融化
   * @param {Object} iceElement - 冰层元素
   */
  completeIceMelting(iceElement) {
    console.log(`冰层 ${iceElement.id} 融化完成`);
    
    // 移除冰层
    this.removeElement(iceElement.id);
    
    // 检查下层是否有新元素露出
    this.checkLayerReveal(iceElement.layer + 1, iceElement.position);
  }
  
  /**
   * 检查出门条件
   */
  checkGateExit() {
    if (!this.selectedElement) return;
    
    const gates = this.getAllElementsByType('gate');
    
    for (const gate of gates) {
      if (this.canExitThroughGate(this.selectedElement, gate)) {
        this.exitThroughGate(this.selectedElement, gate);
        break;
      }
    }
  }
  
  /**
   * 检查是否可以出门
   * @param {Object} element - 方块元素
   * @param {Object} gate - 门元素
   * @returns {boolean} 是否可以出门
   */
  canExitThroughGate(element, gate) {
    // 检查颜色匹配
    if (element.color !== gate.color) return false;
    
    // 检查位置是否在门内
    if (!this.isElementAtGate(element, gate)) return false;
    
    // 检查尺寸是否小于门的尺寸
    const maxX = Math.max(...element.shapeData.blocks.map(block => block[0])) + 1;
    const maxY = Math.max(...element.shapeData.blocks.map(block => block[1])) + 1;
    
    if (maxX >= gate.size.width || maxY >= gate.size.height) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 检查元素是否在门的位置
   * @param {Object} element - 方块元素
   * @param {Object} gate - 门元素
   * @returns {boolean} 是否在门内
   */
  isElementAtGate(element, gate) {
    // 检查方块是否在网格边缘，且与门的方向匹配
    const elementCells = element.occupiedCells;
    
    switch (gate.direction) {
      case 'up':
        // 检查方块是否在网格顶部边缘
        return elementCells.some(cell => {
          const [x, y] = cell.split(',').map(Number);
          return y === 0 && x >= gate.position.x && x < gate.position.x + gate.size.width;
        });
        
      case 'down':
        // 检查方块是否在网格底部边缘
        return elementCells.some(cell => {
          const [x, y] = cell.split(',').map(Number);
          return y === this.GRID_SIZE - 1 && x >= gate.position.x && x < gate.position.x + gate.size.width;
        });
        
      case 'left':
        // 检查方块是否在网格左侧边缘
        return elementCells.some(cell => {
          const [x, y] = cell.split(',').map(Number);
          return x === 0 && y >= gate.position.y && y < gate.position.y + gate.size.height;
        });
        
      case 'right':
        // 检查方块是否在网格右侧边缘
        return elementCells.some(cell => {
          const [x, y] = cell.split(',').map(Number);
          return x === this.GRID_SIZE - 1 && y >= gate.position.y && y < gate.position.y + gate.size.height;
        });
        
      default:
        return false;
    }
  }
  
  /**
   * 通过门离开
   * @param {Object} element - 方块元素
   * @param {Object} gate - 门元素
   */
  exitThroughGate(element, gate) {
    console.log(`方块 ${element.id} 通过 ${gate.color} 门离开`);
    
    // 如果方块有 blockElement，使用 block.js 的退出动画
    if (element.blockElement && typeof exitBlock !== 'undefined') {
      exitBlock(element.blockElement, () => {
        this.removeElement(element.id);
        this.selectedElement = null;
        this.checkWinCondition();
      });
    } else {
      // 否则直接移除
      this.removeElement(element.id);
      this.selectedElement = null;
      this.checkWinCondition();
    }
  }
  
  /**
   * 检查通关条件
   */
  checkWinCondition() {
    const tetrisBlocks = this.getAllElementsByType('tetris');
    
    if (tetrisBlocks.length === 0) {
      this.gameState = 'completed';
      console.log('恭喜通关！');
      this.onGameComplete();
    }
  }
  
  /**
   * 移除元素
   * @param {string} elementId - 元素ID
   */
  removeElement(elementId) {
    const element = this.elementRegistry.get(elementId);
    if (!element) return;
    
    // 如果方块有 blockElement，清理 block.js 的元素
    if (element.blockElement && typeof destroyBlock !== 'undefined') {
      destroyBlock(element.blockElement);
    }
    
    const layer = this.layers.get(element.layer);
    layer.elements.delete(elementId);
    
    // 更新空间索引
    if (element.type === 'tetris') {
      element.occupiedCells.forEach(cell => {
        this.spatialIndex.get(cell).delete(elementId);
      });
    } else {
      const cellKey = `${element.position.x},${element.position.y}`;
      this.spatialIndex.get(cellKey).delete(elementId);
    }
    
    this.elementRegistry.delete(elementId);
  }
  
  /**
   * 获取指定类型的所有元素
   * @param {string} type - 元素类型
   * @returns {Array} 元素数组
   */
  getAllElementsByType(type) {
    const elements = [];
    this.elementRegistry.forEach(element => {
      if (element.type === type) {
        elements.push(element);
      }
    });
    return elements;
  }
  
  /**
   * 查找指定位置的冰层
   * @param {string} cellKey - 格子键
   * @param {number} layer - 层级
   * @returns {Object|null} 冰层元素
   */
  findIceAtCell(cellKey, layer) {
    const layerData = this.layers.get(layer);
    for (const element of layerData.elements.values()) {
      if (element.type === 'ice' && 
          `${element.position.x},${element.position.y}` === cellKey) {
        return element;
      }
    }
    return null;
  }
  
  /**
   * 检查层级揭示
   * @param {number} layer - 层级
   * @param {Object} position - 位置
   */
  checkLayerReveal(layer, position) {
    // 检查下层是否有新元素露出
    const lowerLayer = this.layers.get(layer);
    if (!lowerLayer) return;
    
    const cellKey = `${position.x},${position.y}`;
    const elementsAtCell = this.spatialIndex.get(cellKey);
    
    // 检查是否有新的方块可以移动
    for (const elementId of elementsAtCell) {
      const element = this.elementRegistry.get(elementId);
      if (element.type === 'tetris' && element.layer === layer) {
        element.movable = true;
        console.log(`方块 ${element.id} 现在可以移动`);
      }
    }
  }
  
  /**
   * 清除元素相关缓存
   * @param {string} elementId - 元素ID
   */
  clearCacheForElement(elementId) {
    for (const [key, value] of this.collisionCache.entries()) {
      if (key.includes(elementId)) {
        this.collisionCache.delete(key);
      }
    }
  }
  
  /**
   * 获取可移动方向
   * @param {string} elementId - 元素ID
   * @returns {Array} 可移动方向数组
   */
  getValidMoves(elementId) {
    const element = this.elementRegistry.get(elementId);
    if (!element || element.type !== 'tetris') return [];
    
    const validMoves = [];
    const directions = ['up', 'down', 'left', 'right'];
    
    for (const direction of directions) {
      const newPosition = this.calculateNewPosition(element.position, direction);
      if (this.isValidMove(element, newPosition)) {
        validMoves.push(direction);
      }
    }
    
    return validMoves;
  }
  
  /**
   * 获取地图状态（用于渲染）
   * @returns {Object} 地图状态
   */
  getMapState() {
    return {
      gameState: this.gameState,
      selectedElement: this.selectedElement,
      layers: Array.from(this.layers.values()),
      elements: Array.from(this.elementRegistry.values()),
      moveHistory: this.moveHistory
    };
  }
  
  /**
   * 游戏完成回调
   */
  onGameComplete() {
    // 子类可以重写此方法
    console.log('游戏完成！');
  }
  
  /**
   * 更新游戏状态（每帧调用）
   */
  update() {
    if (this.gameState === 'playing') {
      this.checkIceMelting();
    }
  }
  
  /**
   * 初始化动画系统
   */
  initAnimations() {
    try {
      // 检查 GSAP 是否可用
      if (typeof gsap === 'undefined' || !gsap) {
        console.warn('GSAP 不可用，使用静态效果');
        this.initFallbackAnimations();
        return;
      }

      // 注册Physics2D插件
      if (gsap.registerPlugin && typeof Physics2DPlugin !== 'undefined') {
        gsap.registerPlugin(Physics2DPlugin);
        console.log('Physics2D插件已注册');
      }

      // 创建动画目标对象 - 使用更丰富的属性
      this.animationTargets = {
        grid: { 
          scale: 1, 
          rotation: 0, 
          alpha: 1,
          glow: 0,
          pulse: 0
        },
        pulse: { 
          scale: 1, 
          alpha: 1,
          rotation: 0,
          bounce: 0
        },
        blocks: { 
          scale: 1, 
          rotation: 0, 
          alpha: 1,
          bounce: 0,
          glow: 0
        },
        gates: { 
          scale: 1, 
          alpha: 1, 
          glow: 0,
          pulse: 0,
          rotation: 0
        }
      };

      // 网格呼吸动画 - 使用更复杂的缓动
      this.gridAnimation = gsap.to(this.animationTargets.grid, {
        scale: 1.03,
        alpha: 0.85,
        glow: 0.3,
        duration: 2.8,
        ease: "power2.inOut",
        repeat: -1,
        yoyo: true,
        paused: false
      });

      // 脉冲动画 - 使用弹性缓动
      this.pulseAnimation = gsap.to(this.animationTargets.pulse, {
        scale: 1.12,
        alpha: 0.7,
        rotation: 1,
        duration: 2.2,
        ease: "elastic.out(1, 0.4)",
        repeat: -1,
        yoyo: true,
        paused: false
      });

      // 方块动画 - 添加物理弹跳效果
      this.blockAnimation = gsap.to(this.animationTargets.blocks, {
        scale: 1.06,
        rotation: 3,
        bounce: 0.2,
        duration: 3.5,
        ease: "power1.inOut",
        repeat: -1,
        yoyo: true,
        paused: false
      });

      // 门发光动画 - 使用闪烁效果
      this.gateAnimation = gsap.to(this.animationTargets.gates, {
        scale: 1.1,
        glow: 1,
        pulse: 1,
        rotation: 2,
        duration: 1.8,
        ease: "power2.inOut",
        repeat: -1,
        yoyo: true,
        paused: false
      });

      // 创建时间轴动画 - 组合多个动画
      this.masterTimeline = gsap.timeline({ repeat: -1 });
      this.masterTimeline
        .add(this.gridAnimation, 0)
        .add(this.pulseAnimation, 0.5)
        .add(this.blockAnimation, 1)
        .add(this.gateAnimation, 1.5);

      console.log('GSAP高级动画系统初始化成功');
    } catch (error) {
      console.warn('GSAP动画初始化失败:', error);
      this.initFallbackAnimations();
    }
  }

  /**
   * 降级动画系统
   */
  initFallbackAnimations() {
    this.animationTargets = {
      grid: { scale: 1, alpha: 1, glow: 0 },
      pulse: { scale: 1, alpha: 1, rotation: 0 },
      blocks: { scale: 1, alpha: 1, bounce: 0 },
      gates: { scale: 1, alpha: 1, glow: 0 }
    };

    this.gridAnimation = {
      progress: () => Math.sin(Date.now() * 0.001) * 0.5 + 0.5,
      targets: () => [this.animationTargets.grid]
    };
    this.pulseAnimation = {
      progress: () => Math.sin(Date.now() * 0.002) * 0.5 + 0.5,
      targets: () => [this.animationTargets.pulse]
    };
    this.blockAnimation = {
      progress: () => Math.sin(Date.now() * 0.0015) * 0.5 + 0.5,
      targets: () => [this.animationTargets.blocks]
    };
    this.gateAnimation = {
      progress: () => Math.sin(Date.now() * 0.003) * 0.5 + 0.5,
      targets: () => [this.animationTargets.gates]
    };
  }
  
  /**
   * 开始方块进入动画
   * @param {Object} block - 方块对象
   */
  animateBlockEnter(block) {
    const animationId = `block_enter_${block.id}`;
    
    try {
      // 使用简单的数值对象作为动画目标
      const animationTarget = { scale: 0, alpha: 0 };
      const enterAnimation = gsap.fromTo(animationTarget, {
        scale: 0,
        alpha: 0
      }, {
        duration: 0.8,
        scale: 1,
        alpha: 1,
        ease: "back.out(1.7)",
        onComplete: () => {
          this.animations.delete(animationId);
        }
      });
      
      this.animations.set(animationId, enterAnimation);
    } catch (error) {
      console.warn(`方块 ${block.id} 进入动画创建失败:`, error);
    }
  }
  
  /**
   * 开始方块移动动画
   * @param {Object} block - 方块对象
   * @param {Object} fromPos - 起始位置
   * @param {Object} toPos - 目标位置
   */
  animateBlockMove(block, fromPos, toPos) {
    const animationId = `block_move_${block.id}`;
    
    try {
      // 创建移动动画
      const moveAnimation = gsap.to({}, {
        duration: 0.3,
        ease: "power2.out",
        onUpdate: () => {
          // 移动动画更新
        },
        onComplete: () => {
          this.animations.delete(animationId);
        }
      });
      
      this.animations.set(animationId, moveAnimation);
    } catch (error) {
      console.warn(`方块 ${block.id} 移动动画创建失败:`, error);
    }
  }

  /**
   * 使用Physics2D插件创建方块移动动画
   * @param {Object} block - 方块对象
   * @param {Object} fromPos - 起始位置
   * @param {Object} toPos - 目标位置
   */
  animateBlockMoveWithPhysics(block, fromPos, toPos) {
    try {
      if (typeof gsap === 'undefined' || !gsap || !Physics2DPlugin) {
        console.warn('Physics2D插件不可用，使用简单移动');
        this.animateBlockMove(block, fromPos, toPos);
        return;
      }

      const animationId = `block_move_physics_${block.id}`;
      
      // 创建物理动画目标
      const physicsTarget = {
        x: fromPos.x,
        y: fromPos.y,
        rotation: 0,
        scale: 1
      };

      // 使用Physics2D插件创建弹跳移动效果
      const physicsAnimation = gsap.to(physicsTarget, {
        duration: 0.8,
        x: toPos.x,
        y: toPos.y,
        rotation: 360, // 旋转一圈
        scale: 1.1,
        ease: "power2.out",
        physics2D: {
          velocity: 200,
          angle: 45,
          gravity: 300,
          friction: 0.8,
          bounce: 0.6
        },
        onUpdate: () => {
          // 更新方块位置
          block.position.x = Math.round(physicsTarget.x);
          block.position.y = Math.round(physicsTarget.y);
          block.occupiedCells = this.calculateOccupiedCells(block.position, block.shapeData);
        },
        onComplete: () => {
          // 动画完成后的清理
          block.position.x = toPos.x;
          block.position.y = toPos.y;
          block.occupiedCells = this.calculateOccupiedCells(block.position, block.shapeData);
          this.animations.delete(animationId);
          console.log(`方块 ${block.id} 物理移动动画完成`);
        }
      });

      this.animations.set(animationId, physicsAnimation);
      console.log(`方块 ${block.id} 开始物理移动动画`);
      
    } catch (error) {
      console.warn('Physics2D动画创建失败:', error);
      // 降级到简单动画
      this.animateBlockMove(block, fromPos, toPos);
    }
  }
  
  /**
   * 开始方块选中动画
   * @param {Object} block - 方块对象
   */
  animateBlockSelect(block) {
    const animationId = `block_select_${block.id}`;
    
    try {
      // 创建选中动画 - 使用简单的数值对象
      const animationObj = {scale: 1};
      const selectAnimation = gsap.to(animationObj, {
        duration: 0.5,
        scale: 1.05,
        ease: "power2.out",
        repeat: -1,
        yoyo: true,
        onComplete: () => {
          this.animations.delete(animationId);
        }
      });
      
      this.animations.set(animationId, selectAnimation);
    } catch (error) {
      console.warn(`方块 ${block.id} 选中动画创建失败:`, error);
    }
  }
  
  /**
   * 开始方块退出动画
   * @param {Object} block - 方块对象
   */
  animateBlockExit(block) {
    const animationId = `block_exit_${block.id}`;
    
    try {
      // 创建退出动画 - 使用简单的数值对象
      const animationObj = {scale: 1, alpha: 1};
      const exitAnimation = gsap.to(animationObj, {
        duration: 0.6,
        scale: 0,
        alpha: 0,
        ease: "back.in(1.7)",
        onComplete: () => {
          this.animations.delete(animationId);
        }
      });
      
      this.animations.set(animationId, exitAnimation);
    } catch (error) {
      console.warn(`方块 ${block.id} 退出动画创建失败:`, error);
    }
  }
  
  /**
   * 开始冰层融化动画
   * @param {Object} iceLayer - 冰层对象
   */
  animateIceMelt(iceLayer) {
    const animationId = `ice_melt_${iceLayer.id}`;
    
    try {
      // 创建融化动画
      const meltAnimation = gsap.to({}, {
        duration: 2,
        ease: "power2.out",
        onUpdate: () => {
          // 融化动画更新
        },
        onComplete: () => {
          this.animations.delete(animationId);
        }
      });
      
      this.animations.set(animationId, meltAnimation);
    } catch (error) {
      console.warn(`冰层 ${iceLayer.id} 融化动画创建失败:`, error);
    }
  }
  
  /**
   * 开始门闪烁动画
   * @param {Object} gate - 门对象
   */
  animateGatePulse(gate) {
    const animationId = `gate_pulse_${gate.id}`;
    
    try {
      // 创建门脉冲动画 - 使用简单的数值对象
      const animationObj = {scale: 1};
      const pulseAnimation = gsap.to(animationObj, {
        duration: 1,
        scale: 1.1,
        ease: "power2.inOut",
        repeat: -1,
        yoyo: true,
        onComplete: () => {
          this.animations.delete(animationId);
        }
      });
      
      this.animations.set(animationId, pulseAnimation);
    } catch (error) {
      console.warn(`门 ${gate.id} 脉冲动画创建失败:`, error);
    }
  }
  
  /**
   * 停止所有动画
   */
  stopAllAnimations() {
    try {
      this.animations.forEach(animation => {
        if (animation && animation.kill) {
          animation.kill();
        }
      });
      this.animations.clear();
      this.blockAnimations.clear();
    } catch (error) {
      console.warn('停止动画时出错:', error);
    }
  }
  
  /**
   * 设置渲染上下文
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {Object} systemInfo - 系统信息
   */
  setRenderContext(ctx, systemInfo) {
    this.ctx = ctx;
    this.systemInfo = systemInfo;
    
    // 安全获取系统信息，防止 NaN 或 Infinity
    const windowWidth = Number(systemInfo.windowWidth) || 375;
    const windowHeight = Number(systemInfo.windowHeight) || 667;
    
    // 确保值是有限的
    if (!isFinite(windowWidth) || !isFinite(windowHeight)) {
      console.warn('系统信息包含非有限值，使用默认值');
      systemInfo.windowWidth = 375;
      systemInfo.windowHeight = 667;
    }
    
    // 优化网格尺寸 - 针对抖音小游戏环境
    // 确保每个格子至少40px，最大60px，以获得更好的视觉效果
    const minCellSize = 40;
    const maxCellSize = 60;
    
    // 计算理想的网格尺寸
    const idealGridSize = this.GRID_SIZE * maxCellSize;
    
    // 根据屏幕尺寸调整
    const maxWidth = windowWidth * 0.9; // 使用更多宽度
    const maxHeight = windowHeight * 0.8; // 使用更多高度
    
    // 选择较小的限制，确保网格完全可见
    this.gridSize = Math.min(idealGridSize, maxWidth, maxHeight);
    
    // 计算实际格子大小
    this.cellSize = this.gridSize / this.GRID_SIZE;
    
    // 确保格子大小在合理范围内
    if (this.cellSize < minCellSize) {
      this.cellSize = minCellSize;
      this.gridSize = this.cellSize * this.GRID_SIZE;
    }
    
    // 确保所有值都是有限的
    this.gridSize = isFinite(this.gridSize) ? this.gridSize : 320;
    this.cellSize = isFinite(this.cellSize) ? this.cellSize : 40;
    
    // 居中定位
    this.gridOffsetX = (windowWidth - this.gridSize) / 2;
    this.gridOffsetY = (windowHeight - this.gridSize) / 2 + 20; // 减少顶部偏移
    
    // 确保偏移值也是有限的
    this.gridOffsetX = isFinite(this.gridOffsetX) ? this.gridOffsetX : 0;
    this.gridOffsetY = isFinite(this.gridOffsetY) ? this.gridOffsetY : 0;
    
    console.log('渲染上下文已设置:', {
      windowWidth: systemInfo.windowWidth,
      windowHeight: systemInfo.windowHeight,
      gridSize: this.gridSize,
      cellSize: this.cellSize,
      gridOffsetX: this.gridOffsetX,
      gridOffsetY: this.gridOffsetY,
      minCellSize: minCellSize,
      maxCellSize: maxCellSize
    });
    
    // 初始化动画系统
    this.initAnimations();
  }
  
  /**
   * 绘制地图网格
   */
  drawMapGrid() {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    
      // 安全获取GSAP动画属性
      let gridScale = 1, gridAlpha = 1, gridGlow = 0;
      let pulseScale = 1, pulseAlpha = 1, pulseRotation = 0;

      try {
        if (this.animationTargets && this.animationTargets.grid) {
          gridScale = this.animationTargets.grid.scale || 1;
          gridAlpha = this.animationTargets.grid.alpha || 1;
          gridGlow = this.animationTargets.grid.glow || 0;
        }
      } catch (error) {
        console.warn('获取网格动画属性失败:', error);
      }

      try {
        if (this.animationTargets && this.animationTargets.pulse) {
          pulseScale = this.animationTargets.pulse.scale || 1;
          pulseAlpha = this.animationTargets.pulse.alpha || 1;
          pulseRotation = this.animationTargets.pulse.rotation || 0;
        }
      } catch (error) {
        console.warn('获取脉冲动画属性失败:', error);
      }
    
    // 绘制网格背景 - 使用GSAP动画属性
    const bgAlpha = 0.15 + (gridAlpha - 1) * 0.1 + gridGlow * 0.2;
    ctx.fillStyle = `rgba(255, 255, 255, ${bgAlpha})`;
    
    // 应用缩放变换
    ctx.save();
    ctx.translate(this.gridOffsetX + this.gridSize/2, this.gridOffsetY + this.gridSize/2);
    ctx.scale(gridScale, gridScale);
    ctx.translate(-this.gridSize/2, -this.gridSize/2);
    ctx.fillRect(0, 0, this.gridSize, this.gridSize);
    ctx.restore();
    
          // 绘制加粗的外边框 - 非门部分用黑色，门部分用对应颜色
          const borderWidth = Math.max(6, this.cellSize * 0.15); // 边框宽度与格子大小成比例
    const borderAlpha = 0.9 + (pulseAlpha - 1) * 0.2 + pulseRotation * 0.1;
    
    // 获取门的位置信息
    const gates = this.getAllElementsByType('gate');
    const gatePositions = {
      up: gates.filter(gate => gate.direction === 'up').map(gate => ({
        start: gate.position.x,
        end: gate.position.x + gate.size.width
      })),
      right: gates.filter(gate => gate.direction === 'right').map(gate => ({
        start: gate.position.y,
        end: gate.position.y + gate.size.height
      })),
      down: gates.filter(gate => gate.direction === 'down').map(gate => ({
        start: gate.position.x,
        end: gate.position.x + gate.size.width
      })),
      left: gates.filter(gate => gate.direction === 'left').map(gate => ({
        start: gate.position.y,
        end: gate.position.y + gate.size.height
      }))
    };
    
    // 绘制上边框 - 非门部分黑色，门部分红色
    this.drawBorderWithGates(ctx, 
      this.gridOffsetX, this.gridOffsetY - borderWidth/2, 
      this.gridOffsetX + this.gridSize, this.gridOffsetY - borderWidth/2,
      gatePositions.up, 'up', borderWidth, borderAlpha);
    
    // 绘制右边框 - 非门部分黑色，门部分蓝色
    this.drawBorderWithGates(ctx,
      this.gridOffsetX + this.gridSize + borderWidth/2, this.gridOffsetY,
      this.gridOffsetX + this.gridSize + borderWidth/2, this.gridOffsetY + this.gridSize,
      gatePositions.right, 'right', borderWidth, borderAlpha);
    
    // 绘制下边框 - 非门部分黑色，门部分绿色
    this.drawBorderWithGates(ctx,
      this.gridOffsetX + this.gridSize, this.gridOffsetY + this.gridSize + borderWidth/2,
      this.gridOffsetX, this.gridOffsetY + this.gridSize + borderWidth/2,
      gatePositions.down, 'down', borderWidth, borderAlpha);
    
    // 绘制左边框 - 非门部分黑色，门部分黄色
    this.drawBorderWithGates(ctx,
      this.gridOffsetX - borderWidth/2, this.gridOffsetY,
      this.gridOffsetX - borderWidth/2, this.gridOffsetY + this.gridSize,
      gatePositions.left, 'left', borderWidth, borderAlpha);
    
    // 绘制内部网格线 - 使用GSAP动画属性
    const lineAlpha = 0.4 + (gridAlpha - 1) * 0.1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
    ctx.lineWidth = 1;
    
    // 垂直线
    for (let x = 0; x <= this.GRID_SIZE; x++) {
      const startX = this.gridOffsetX + x * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(startX, this.gridOffsetY);
      ctx.lineTo(startX, this.gridOffsetY + this.gridSize);
      ctx.stroke();
    }
    
    // 水平线
    for (let y = 0; y <= this.GRID_SIZE; y++) {
      const startY = this.gridOffsetY + y * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(this.gridOffsetX, startY);
      ctx.lineTo(this.gridOffsetX + this.gridSize, startY);
      ctx.stroke();
    }
    
    // 绘制网格边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.gridOffsetX, this.gridOffsetY, this.gridSize, this.gridSize);
  }
  
  /**
   * 绘制带门的边框
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} startX - 起始X坐标
   * @param {number} startY - 起始Y坐标
   * @param {number} endX - 结束X坐标
   * @param {number} endY - 结束Y坐标
   * @param {Array} gatePositions - 门的位置数组
   * @param {string} direction - 边框方向
   * @param {number} borderWidth - 边框宽度
   * @param {number} borderAlpha - 边框透明度
   */
  drawBorderWithGates(ctx, startX, startY, endX, endY, gatePositions, direction, borderWidth, borderAlpha) {
    ctx.lineWidth = borderWidth;
    
    // 获取门颜色
    const gateColors = {
      up: `rgba(255, 100, 100, ${borderAlpha})`,
      right: `rgba(100, 100, 255, ${borderAlpha})`,
      down: `rgba(100, 255, 100, ${borderAlpha})`,
      left: `rgba(255, 255, 100, ${borderAlpha})`
    };
    
    const gateColor = gateColors[direction];
    const blackColor = `rgba(0, 0, 0, ${borderAlpha})`;
    
    // 先绘制整条边框为黑色
    ctx.strokeStyle = blackColor;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // 然后在门的位置用门颜色覆盖
    if (gatePositions.length > 0) {
      ctx.strokeStyle = gateColor;
      
      gatePositions.forEach(gate => {
        const cellSize = this.cellSize;
        const gateStart = gate.start * cellSize;
        const gateEnd = gate.end * cellSize;
        
        // 计算门段的实际坐标 - 确保在边框范围内
        let gateStartX, gateStartY, gateEndX, gateEndY;
        
        if (startX === endX) { // 垂直边框
          gateStartX = startX;
          gateEndX = endX;
          gateStartY = startY + gateStart;
          gateEndY = startY + gateEnd;
        } else { // 水平边框
          gateStartX = startX + gateStart;
          gateEndX = startX + gateEnd;
          gateStartY = startY;
          gateEndY = endY;
        }
        
        // 绘制门段
        ctx.beginPath();
        ctx.moveTo(gateStartX, gateStartY);
        ctx.lineTo(gateEndX, gateEndY);
        ctx.stroke();
      });
    }
  }
  
  /**
   * 绘制地图元素
   */
  drawMapElements() {
    if (!this.ctx) return;
    
    // 绘制门
    this.drawGates();
    
    // 绘制石块
    this.drawRocks();
    
    // 绘制冰层
    this.drawIceLayers();
    
    // 绘制俄罗斯方块
    this.drawTetrisBlocks();
  }
  
  /**
   * 绘制门
   */
  drawGates() {
    const gates = this.getAllElementsByType('gate');
    
    gates.forEach(gate => {
      this.drawGate(gate);
    });
  }
  
  /**
   * 绘制单个门
   * @param {Object} gate - 门对象
   */
        drawGate(gate) {
          const color = this.getGateColor(gate.color);
          const borderWidth = Math.max(6, this.cellSize * 0.15); // 与主边框相同的宽度
          
          // 获取GSAP门动画属性
          let gateScale = 1, gateGlow = 0, gatePulse = 0, gateRotation = 0;
          try {
            if (this.animationTargets && this.animationTargets.gates) {
              gateScale = this.animationTargets.gates.scale || 1;
              gateGlow = this.animationTargets.gates.glow || 0;
              gatePulse = this.animationTargets.gates.pulse || 0;
              gateRotation = this.animationTargets.gates.rotation || 0;
            }
          } catch (error) {
            console.warn('获取门动画属性失败:', error);
          }
    
    let x, y, width, height;
    
    // 根据门的方向和位置计算坐标 - 门正好在边框上
    switch (gate.direction) {
      case 'up':
        // 上方的门 - 绘制在上边框上
        x = this.gridOffsetX + gate.position.x * this.cellSize;
        y = this.gridOffsetY - borderWidth / 2; // 在边框中心
        width = gate.size.width * this.cellSize;
        height = borderWidth;
        break;
        
      case 'down':
        // 下方的门 - 绘制在下边框上
        x = this.gridOffsetX + gate.position.x * this.cellSize;
        y = this.gridOffsetY + this.gridSize - borderWidth / 2; // 在边框中心
        width = gate.size.width * this.cellSize;
        height = borderWidth;
        break;
        
      case 'left':
        // 左侧的门 - 绘制在左边框上
        x = this.gridOffsetX - borderWidth / 2; // 在边框中心
        y = this.gridOffsetY + gate.position.y * this.cellSize;
        width = borderWidth;
        height = gate.size.height * this.cellSize;
        break;
        
      case 'right':
        // 右侧的门 - 绘制在右边框上
        x = this.gridOffsetX + this.gridSize - borderWidth / 2; // 在边框中心
        y = this.gridOffsetY + gate.position.y * this.cellSize;
        width = borderWidth;
        height = gate.size.height * this.cellSize;
        break;
        
      default:
        return; // 无效方向
    }
    
    // 安全获取门的动画状态 - 使用GSAP动画对象
    const animationId = `gate_pulse_${gate.id}`;
    const pulseAnimation = this.animations.get(animationId);
    let pulseScale = 1;
    
    try {
      if (pulseAnimation && pulseAnimation.targets && pulseAnimation.targets()[0]) {
        pulseScale = pulseAnimation.targets()[0].scale || 1;
      }
    } catch (error) {
      console.warn(`获取门 ${gate.id} 动画状态失败:`, error);
      pulseScale = 1;
    }
    
    // 应用GSAP动画变换
    this.ctx.save();
    this.ctx.translate(x + width / 2, y + height / 2);
    
    // 组合所有动画效果
    const finalScale = pulseScale * gateScale;
    const finalRotation = gateRotation * Math.PI / 180; // 转换为弧度
    
    this.ctx.scale(finalScale, finalScale);
    this.ctx.rotate(finalRotation);
    this.ctx.translate(-width / 2, -height / 2);
    
    // 门背景 - 使用GSAP发光和脉冲效果
    const brightColor = this.brightenColor(color, 0.3 + gateGlow * 0.2);
    this.ctx.fillStyle = brightColor;
    
    // 应用发光效果
    if (gateGlow > 0) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = gateGlow * 15;
    }
    
    this.ctx.fillRect(0, 0, width, height);
    
    // 脉冲高光效果
    if (gatePulse > 0) {
      const pulseAlpha = 0.3 + gatePulse * 0.4;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
      this.ctx.fillRect(0, 0, width, height / 2);
    }
    
    // 门边框 - 使用GSAP脉冲效果
    const borderAlpha = 0.9 + gatePulse * 0.2;
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderAlpha})`;
    this.ctx.lineWidth = 1 + gateGlow * 2; // 发光时边框更粗
    this.ctx.strokeRect(0, 0, width, height);
    
    // 门标签 - 使用GSAP脉冲效果
    const textAlpha = 1 + gatePulse * 0.3;
    this.ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      gate.color.toUpperCase(),
      width / 2,
      height / 2 + 3
    );
    
    this.ctx.restore();
    
    // 门的方向箭头
    this.drawGateArrow(x, y, width, height, gate.direction);
  }
  
  /**
   * 绘制门的方向箭头
   * @param {number} x - 门X坐标
   * @param {number} y - 门Y坐标
   * @param {number} width - 门宽度
   * @param {number} height - 门高度
   * @param {string} direction - 门方向
   */
  drawGateArrow(x, y, width, height, direction) {
    this.ctx.fillStyle = 'white';
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const arrowSize = Math.min(width, height) * 0.3;
    
    this.ctx.beginPath();
    
    switch (direction) {
      case 'up':
        // 向上箭头
        this.ctx.moveTo(centerX, centerY - arrowSize);
        this.ctx.lineTo(centerX - arrowSize/2, centerY);
        this.ctx.lineTo(centerX + arrowSize/2, centerY);
        this.ctx.closePath();
        break;
        
      case 'down':
        // 向下箭头
        this.ctx.moveTo(centerX, centerY + arrowSize);
        this.ctx.lineTo(centerX - arrowSize/2, centerY);
        this.ctx.lineTo(centerX + arrowSize/2, centerY);
        this.ctx.closePath();
        break;
        
      case 'left':
        // 向左箭头
        this.ctx.moveTo(centerX - arrowSize, centerY);
        this.ctx.lineTo(centerX, centerY - arrowSize/2);
        this.ctx.lineTo(centerX, centerY + arrowSize/2);
        this.ctx.closePath();
        break;
        
      case 'right':
        // 向右箭头
        this.ctx.moveTo(centerX + arrowSize, centerY);
        this.ctx.lineTo(centerX, centerY - arrowSize/2);
        this.ctx.lineTo(centerX, centerY + arrowSize/2);
        this.ctx.closePath();
        break;
    }
    
    this.ctx.fill();
  }
  
  /**
   * 绘制石块
   */
  drawRocks() {
    const rocks = this.getAllElementsByType('rock');
    
    rocks.forEach(rock => {
      const x = this.gridOffsetX + rock.position.x * this.cellSize;
      const y = this.gridOffsetY + rock.position.y * this.cellSize;
      
      // 石块阴影
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(x + 3, y + 3, this.cellSize, this.cellSize);
      
      // 石块背景
      this.ctx.fillStyle = '#8B4513';
      this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
      
      // 石块边框 - 更粗的边框
      this.ctx.strokeStyle = '#654321';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
      
      // 石块纹理 - 更明显的纹理
      this.ctx.fillStyle = '#A0522D';
      this.ctx.fillRect(x + 3, y + 3, this.cellSize - 6, this.cellSize - 6);
      
      // 石块高光
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.fillRect(x + 3, y + 3, this.cellSize - 6, 2);
      
      // 石块内阴影
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.fillRect(x + 3, y + this.cellSize - 3, this.cellSize - 6, 2);
    });
  }
  
  /**
   * 绘制冰层
   */
  drawIceLayers() {
    const iceLayers = this.getAllElementsByType('ice');
    
    iceLayers.forEach(ice => {
      const x = this.gridOffsetX + ice.position.x * this.cellSize;
      const y = this.gridOffsetY + ice.position.y * this.cellSize;
      
      // 冰层背景
      const alpha = 0.3 + (ice.meltProgress / 100) * 0.4; // 融化时变透明
      this.ctx.fillStyle = `rgba(173, 216, 230, ${alpha})`;
      this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
      
      // 冰层边框
      this.ctx.strokeStyle = `rgba(135, 206, 235, ${alpha})`;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
      
      // 融化进度
      if (ice.meltProgress > 0) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
          `${ice.meltProgress}%`,
          x + this.cellSize / 2,
          y + this.cellSize / 2 + 3
        );
      }
    });
  }
  
  /**
   * 绘制俄罗斯方块
   */
  drawTetrisBlocks() {
    const blocks = this.getAllElementsByType('tetris');
    
    console.log('绘制方块数量:', blocks.length);
    blocks.forEach(block => {
      console.log('绘制方块:', block.id, '位置:', block.position, 'occupiedCells:', block.occupiedCells);
      // 直接使用原来的绘制方式，因为 block.js 现在是纯数据驱动
      this.drawTetrisBlock(block);
    });
  }
  
  /**
   * 绘制使用 block.js 创建的方块元素
   * @param {Object} block - 方块对象
   */
  drawBlockElement(block) {
    const blockElement = block.blockElement;
    const element = blockElement.element;
    
    // 更新方块位置
    const screenX = this.gridOffsetX + block.position.x * this.cellSize;
    const screenY = this.gridOffsetY + block.position.y * this.cellSize;
    
    element.style.left = `${screenX}px`;
    element.style.top = `${screenY}px`;
    
    // 更新方块大小
    const maxWidth = Math.max(...blockElement.shapeData.blocks.map(b => b[0])) + 1;
    const maxHeight = Math.max(...blockElement.shapeData.blocks.map(b => b[1])) + 1;
    
    element.style.width = `${maxWidth * this.cellSize}px`;
    element.style.height = `${maxHeight * this.cellSize}px`;
    
    // 更新层级
    element.style.zIndex = block.layer + 10;
    
    // 如果方块被选中，添加选中效果
    if (this.selectedElement === block) {
      if (!blockElement.isSelected) {
        selectBlock(blockElement);
      }
    } else {
      if (blockElement.isSelected) {
        deselectBlock(blockElement);
      }
    }
  }
  
  /**
   * 绘制单个俄罗斯方块
   * @param {Object} block - 方块对象
   */
  drawTetrisBlock(block) {
    const color = this.getBlockColor(block.color);
    const isSelected = this.selectedElement === block;
    
    // 获取GSAP方块动画属性
    let blockScale = 1, blockRotation = 0, blockBounce = 0, blockGlow = 0;
    try {
      if (this.animationTargets && this.animationTargets.blocks) {
        blockScale = this.animationTargets.blocks.scale || 1;
        blockRotation = this.animationTargets.blocks.rotation || 0;
        blockBounce = this.animationTargets.blocks.bounce || 0;
        blockGlow = this.animationTargets.blocks.glow || 0;
      }
    } catch (error) {
      console.warn('获取方块动画属性失败:', error);
    }
    
    // 计算方块的边界框
    console.log('方块', block.id, 'occupiedCells:', block.occupiedCells);
    const cells = block.occupiedCells.map(cellKey => cellKey.split(',').map(Number));
    console.log('解析后的cells:', cells);
    
    if (cells.length === 0) {
      console.warn(`方块 ${block.id} 没有占用格子，跳过绘制`);
      return;
    }
    
    // 安全计算边界框，避免空数组导致的 Infinity
    const xs = cells.map(cell => cell[0]);
    const ys = cells.map(cell => cell[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    
    // 再次检查计算结果
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      console.warn(`方块 ${block.id} 边界框计算异常:`, { minX, minY, maxX, maxY, cells });
      return;
    }
    
    console.log('边界框:', { minX, minY, maxX, maxY });
    
    const blockWidth = (maxX - minX + 1) * this.cellSize;
    const blockHeight = (maxY - minY + 1) * this.cellSize;
    
    // 确保尺寸值是有限的
    if (!isFinite(blockWidth) || !isFinite(blockHeight) || blockWidth <= 0 || blockHeight <= 0) {
      console.warn(`方块 ${block.id} 尺寸异常:`, { blockWidth, blockHeight, cellSize: this.cellSize });
      return; // 跳过绘制
    }
    const blockScreenX = this.gridOffsetX + minX * this.cellSize;
    const blockScreenY = this.gridOffsetY + minY * this.cellSize;
    
    // 安全获取动画状态 - 使用GSAP动画对象
    const animationId = `block_select_${block.id}`;
    const selectAnimation = this.animations.get(animationId);
    let scale = 1;
    
    try {
      if (selectAnimation && selectAnimation.targets && selectAnimation.targets()[0]) {
        scale = selectAnimation.targets()[0].scale || 1;
      }
    } catch (error) {
      console.warn(`获取方块 ${block.id} 动画状态失败:`, error);
      scale = 1;
    }
    
    // 应用GSAP动画变换
    this.ctx.save();
    this.ctx.translate(blockScreenX + blockWidth / 2, blockScreenY + blockHeight / 2);
    
    // 组合所有动画效果
    const finalScale = scale * blockScale;
    const finalRotation = blockRotation * Math.PI / 180; // 转换为弧度
    const bounceOffset = blockBounce * 5; // 弹跳偏移
    
    this.ctx.scale(finalScale, finalScale);
    this.ctx.rotate(finalRotation);
    this.ctx.translate(-blockWidth / 2, -blockHeight / 2 + bounceOffset);
    
    // 绘制整个方块的阴影 - 使用GSAP发光效果
    const shadowAlpha = 0.2 + blockGlow * 0.3;
    this.ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    this.ctx.fillRect(2, 2, blockWidth, blockHeight);
    
    // 绘制发光效果（如果启用）
    if (blockGlow > 0) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = blockGlow * 10;
    }
    
    // 绘制整个方块的背景 - 带渐变效果
    try {
      const gradient = this.ctx.createLinearGradient(0, 0, blockWidth, blockHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, this.darkenColor(color, 0.2));
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, blockWidth, blockHeight);
    } catch (error) {
      console.warn(`方块 ${block.id} 渐变创建失败:`, error);
      // 使用纯色作为备用
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, blockWidth, blockHeight);
    }
    
    // 选中效果 - 带脉冲动画
    if (isSelected) {
      const pulseAlpha = 0.4 + Math.sin(Date.now() * 0.01) * 0.2;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
      this.ctx.fillRect(0, 0, blockWidth, blockHeight);
      
      // 选中边框 - 带闪烁效果
      const borderAlpha = 0.9 + Math.sin(Date.now() * 0.02) * 0.1;
      this.ctx.strokeStyle = `rgba(255, 255, 0, ${borderAlpha})`;
      this.ctx.lineWidth = 3 + Math.sin(Date.now() * 0.015) * 0.5;
      this.ctx.strokeRect(0, 0, blockWidth, blockHeight);
    }
    
    // 绘制整个方块的外边框 - 带呼吸效果
    const borderAlpha = 0.9 + Math.sin(Date.now() * 0.005) * 0.1;
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderAlpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, blockWidth, blockHeight);
    
    // 绘制整个方块的高光 - 带流动效果
    const highlightAlpha = 0.3 + Math.sin(Date.now() * 0.008) * 0.1;
    this.ctx.fillStyle = `rgba(255, 255, 255, ${highlightAlpha})`;
    this.ctx.fillRect(2, 2, blockWidth - 4, 3);
    
    // 绘制整个方块的内阴影 - 带呼吸效果
    const shadowAlpha2 = 0.1 + Math.sin(Date.now() * 0.006) * 0.05;
    this.ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha2})`;
    this.ctx.fillRect(2, blockHeight - 2, blockWidth - 4, 2);
    
    this.ctx.restore();
    
    // 绘制方块ID（调试用）
    if (block.occupiedCells.length > 0) {
      const firstCell = block.occupiedCells[0].split(',').map(Number);
      // 移除方块上的文字显示
    }
  }
  
  /**
   * 获取门颜色
   * @param {string} colorName - 颜色名称
   * @returns {string} 颜色值
   */
  getGateColor(colorName) {
    const colors = {
      red: '#FF6B6B',
      blue: '#45B7D1',
      green: '#96CEB4',
      yellow: '#FFEAA7',
      purple: '#DDA0DD',
      orange: '#FFA500'
    };
    return colors[colorName] || '#CCCCCC';
  }
  
  /**
   * 获取方块颜色
   * @param {string} colorName - 颜色名称
   * @returns {string} 颜色值
   */
  getBlockColor(colorName) {
    const colors = {
      red: '#FF6B6B',
      blue: '#45B7D1',
      green: '#96CEB4',
      yellow: '#FFEAA7',
      purple: '#DDA0DD',
      orange: '#FFA500'
    };
    return colors[colorName] || '#CCCCCC';
  }
  
  /**
   * 颜色变暗
   * @param {string} color - 原始颜色
   * @param {number} factor - 变暗因子 (0-1)
   * @returns {string} 变暗后的颜色
   */
  darkenColor(color, factor) {
    // 简单的颜色变暗实现
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const newR = Math.floor(r * (1 - factor));
    const newG = Math.floor(g * (1 - factor));
    const newB = Math.floor(b * (1 - factor));
    
    return `rgb(${newR}, ${newG}, ${newB})`;
  }
  
  /**
   * 颜色变亮
   * @param {string} color - 原始颜色
   * @param {number} factor - 变亮因子 (0-1)
   * @returns {string} 变亮后的颜色
   */
  brightenColor(color, factor) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
    const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
    const newB = Math.min(255, Math.floor(b + (255 - b) * factor));
    
    return `rgb(${newR}, ${newG}, ${newB})`;
  }
  
  /**
   * 处理点击事件
   * @param {number} x - 点击X坐标
   * @param {number} y - 点击Y坐标
   */
  handleClick(x, y) {
    // 检查是否点击在网格内
    if (x < this.gridOffsetX || x > this.gridOffsetX + this.gridSize ||
        y < this.gridOffsetY || y > this.gridOffsetY + this.gridSize) {
      return;
    }
    
    // 计算网格坐标
    const gridX = Math.floor((x - this.gridOffsetX) / this.cellSize);
    const gridY = Math.floor((y - this.gridOffsetY) / this.cellSize);
    
    // 检查是否点击了方块
    const blocks = this.getAllElementsByType('tetris');
    for (const block of blocks) {
      if (block.occupiedCells.includes(`${gridX},${gridY}`)) {
        this.selectElement(block.id);
        console.log(`点击了方块: ${block.id}`);
        return;
      }
    }
    
    // 如果没有点击方块，取消选择
    if (this.selectedElement) {
      this.selectedElement = null;
      console.log('取消选择');
    }
  }
  
  /**
   * 处理键盘事件
   * @param {string} key - 按键
   */
  handleKeyPress(key) {
    if (!this.selectedElement) return;
    
    const directions = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right'
    };
    
    const direction = directions[key];
    if (direction) {
      this.moveElement(direction);
    }
  }
}

// 导出引擎类
if (typeof window !== 'undefined') {
  window.MapEngine = MapEngine;
} else if (typeof global !== 'undefined') {
  global.MapEngine = MapEngine;
} else {
  this.MapEngine = MapEngine;
}
