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
      mapData.gates.forEach(gate => this.addGate(gate));
    }
    
    // 加载俄罗斯方块
    if (mapData.tetrisBlocks) {
      mapData.tetrisBlocks.forEach(block => this.addTetrisBlock(block));
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
    // 处理形状数据
    let shapeData;
    if (typeof block.shape === 'string') {
      // 字符串形状，需要从 BLOCK_SHAPES 获取
      shapeData = this.getShapeData(block.shape);
    } else {
      // 对象形状，直接使用
      shapeData = block.shape;
    }
    
    const element = {
      id: block.id,
      type: 'tetris',
      color: block.color,
      position: block.position, // {x, y}
      shape: block.shape, // 原始形状数据
      shapeData: shapeData, // 处理后的形状数据
      layer: block.layer || 0,
      movable: true,
      occupiedCells: this.calculateOccupiedCells(block.position, shapeData)
    };
    
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
    const cells = [];
    if (shapeData.blocks) {
      // 新的格式：blocks 数组
      shapeData.blocks.forEach(block => {
        cells.push(`${position.x + block[0]},${position.y + block[1]}`);
      });
    } else if (shapeData.width && shapeData.height) {
      // 旧的格式：width, height
      for (let x = position.x; x < position.x + shapeData.width; x++) {
        for (let y = position.y; y < position.y + shapeData.height; y++) {
          cells.push(`${x},${y}`);
        }
      }
    }
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
    
    this.removeElement(element.id);
    this.selectedElement = null;
    
    // 检查是否通关
    this.checkWinCondition();
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
   * 设置渲染上下文
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {Object} systemInfo - 系统信息
   */
  setRenderContext(ctx, systemInfo) {
    this.ctx = ctx;
    this.systemInfo = systemInfo;
    
    // 优化网格尺寸 - 针对抖音小游戏环境
    // 确保每个格子至少30px，最大50px，以获得更好的视觉效果
    const minCellSize = 30;
    const maxCellSize = 50;
    
    // 计算理想的网格尺寸
    const idealGridSize = this.GRID_SIZE * maxCellSize;
    
    // 根据屏幕尺寸调整
    const maxWidth = systemInfo.windowWidth * 0.85; // 使用更多宽度
    const maxHeight = systemInfo.windowHeight * 0.7; // 使用更多高度
    
    // 选择较小的限制，确保网格完全可见
    this.gridSize = Math.min(idealGridSize, maxWidth, maxHeight);
    
    // 计算实际格子大小
    this.cellSize = this.gridSize / this.GRID_SIZE;
    
    // 确保格子大小在合理范围内
    if (this.cellSize < minCellSize) {
      this.cellSize = minCellSize;
      this.gridSize = this.cellSize * this.GRID_SIZE;
    }
    
    // 居中定位
    this.gridOffsetX = (systemInfo.windowWidth - this.gridSize) / 2;
    this.gridOffsetY = (systemInfo.windowHeight - this.gridSize) / 2 + 30; // 减少顶部偏移
    
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
  }
  
  /**
   * 绘制地图网格
   */
  drawMapGrid() {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    
    // 绘制网格背景 - 更明显的背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(this.gridOffsetX, this.gridOffsetY, this.gridSize, this.gridSize);
    
    // 绘制网格边框 - 更粗的边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.gridOffsetX, this.gridOffsetY, this.gridSize, this.gridSize);
    
    // 绘制内部网格线 - 更清晰的线条
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
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
    const gateSize = Math.min(this.cellSize * 0.8, 20); // 门的大小，不超过格子大小
    
    let x, y, width, height;
    
    // 根据门的方向和位置计算坐标
    switch (gate.direction) {
      case 'up':
        // 上方的门
        x = this.gridOffsetX + gate.position.x * this.cellSize;
        y = this.gridOffsetY - gateSize - 5; // 在网格上方
        width = gate.size.width * this.cellSize;
        height = gateSize;
        break;
        
      case 'down':
        // 下方的门
        x = this.gridOffsetX + gate.position.x * this.cellSize;
        y = this.gridOffsetY + this.gridSize + 5; // 在网格下方
        width = gate.size.width * this.cellSize;
        height = gateSize;
        break;
        
      case 'left':
        // 左侧的门
        x = this.gridOffsetX - gateSize - 5; // 在网格左侧
        y = this.gridOffsetY + gate.position.y * this.cellSize;
        width = gateSize;
        height = gate.size.height * this.cellSize;
        break;
        
      case 'right':
        // 右侧的门
        x = this.gridOffsetX + this.gridSize + 5; // 在网格右侧
        y = this.gridOffsetY + gate.position.y * this.cellSize;
        width = gateSize;
        height = gate.size.height * this.cellSize;
        break;
        
      default:
        return; // 无效方向
    }
    
    // 门背景
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
    
    // 门边框
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);
    
    // 门标签
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      gate.color.toUpperCase(),
      x + width / 2,
      y + height / 2 + 3
    );
    
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
    
    blocks.forEach(block => {
      this.drawTetrisBlock(block);
    });
  }
  
  /**
   * 绘制单个俄罗斯方块
   * @param {Object} block - 方块对象
   */
  drawTetrisBlock(block) {
    const color = this.getBlockColor(block.color);
    const isSelected = this.selectedElement === block;
    
    // 计算方块的边界框
    const cells = block.occupiedCells.map(cellKey => cellKey.split(',').map(Number));
    const minX = Math.min(...cells.map(cell => cell[0]));
    const minY = Math.min(...cells.map(cell => cell[1]));
    const maxX = Math.max(...cells.map(cell => cell[0]));
    const maxY = Math.max(...cells.map(cell => cell[1]));
    
    const blockWidth = (maxX - minX + 1) * this.cellSize;
    const blockHeight = (maxY - minY + 1) * this.cellSize;
    const blockScreenX = this.gridOffsetX + minX * this.cellSize;
    const blockScreenY = this.gridOffsetY + minY * this.cellSize;
    
    // 绘制整个方块的阴影
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(blockScreenX + 2, blockScreenY + 2, blockWidth, blockHeight);
    
    // 绘制整个方块的背景
    this.ctx.fillStyle = color;
    this.ctx.fillRect(blockScreenX, blockScreenY, blockWidth, blockHeight);
    
    // 选中效果
    if (isSelected) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.fillRect(blockScreenX, blockScreenY, blockWidth, blockHeight);
      
      // 选中边框 - 整个方块的外边框
      this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(blockScreenX, blockScreenY, blockWidth, blockHeight);
    }
    
    // 绘制整个方块的外边框
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(blockScreenX, blockScreenY, blockWidth, blockHeight);
    
    // 绘制整个方块的高光
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fillRect(blockScreenX + 2, blockScreenY + 2, blockWidth - 4, 3);
    
    // 绘制整个方块的内阴影
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(blockScreenX + 2, blockScreenY + blockHeight - 2, blockWidth - 4, 2);
    
    // 绘制方块ID（调试用）
    if (block.occupiedCells.length > 0) {
      const firstCell = block.occupiedCells[0].split(',').map(Number);
      const screenX = this.gridOffsetX + firstCell[0] * this.cellSize;
      const screenY = this.gridOffsetY + firstCell[1] * this.cellSize;
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = '8px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(block.id, screenX + 2, screenY + 10);
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
