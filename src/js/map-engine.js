/**
 * 多层方块 Puzzle 游戏引擎
 * 核心特性：9x9网格 + 多层结构 + 障碍规避 + 颜色通关
 * 数据结构：分层网格 + 区域标记 + 哈希索引
 */

class MapEngine {
  constructor() {
    // 使用统一配置
    this.GRID_SIZE = GAME_CONFIG.GRID_SIZE;
    this.CELL_SIZE = GAME_CONFIG.CELL_SIZE;
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
    this.needsRedraw = false; // 是否需要重绘
    
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
    
    this.spatialIndex.clear();
    this.elementRegistry.clear();
    this.collisionCache.clear();
    this.pathCache.clear();
    this.selectedElement = null;
    this.moveHistory = [];
    
    // 清理动画数据
    this.animations.clear();
    this.animationQueue = [];
    this.blockAnimations.clear();
    
    // 停止所有动画
    if (this.gridAnimation && this.gridAnimation.kill) {
      this.gridAnimation.kill();
    }
    if (this.pulseAnimation && this.pulseAnimation.kill) {
      this.pulseAnimation.kill();
    }
    if (this.blockAnimation && this.blockAnimation.kill) {
      this.blockAnimation.kill();
    }
    if (this.gateAnimation && this.gateAnimation.kill) {
      this.gateAnimation.kill();
    }
    if (this.iceAnimation && this.iceAnimation.kill) {
      this.iceAnimation.kill();
    }
    if (this.masterTimeline && this.masterTimeline.kill) {
      this.masterTimeline.kill();
    }
    
    // 重置动画对象
    this.gridAnimation = null;
    this.pulseAnimation = null;
    this.blockAnimation = null;
    this.gateAnimation = null;
    this.iceAnimation = null;
    this.masterTimeline = null;
    
    // 重新初始化空间索引
    for (let x = 0; x < this.GRID_SIZE; x++) {
      for (let y = 0; y < this.GRID_SIZE; y++) {
        this.spatialIndex.set(`${x},${y}`, new Set());
      }
    }
    
    console.log('地图数据已完全清理');
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
    // 使用 creature.js 中的 createCreature 函数
    if (typeof createCreature === 'undefined') {
      console.error('createCreature 函数未找到，请确保 creature.js 已加载');
      return;
    }
    
    // 获取正确的颜色和形状数据
    let colorData = block.colorData;
    if (!colorData && typeof BLOCK_COLORS !== 'undefined') {
      colorData = BLOCK_COLORS[block.color];
    }
    
    if (!colorData) {
      console.error('无法找到颜色数据:', block.color);
      return;
    }
    
    // 检查颜色数据是否包含形状信息
    if (!colorData.shape || !colorData.blocks) {
      console.error('颜色数据缺少形状信息:', colorData);
      return;
    }
    
    // 使用颜色数据中的形状信息
    const combinedData = {
      name: colorData.name,
      gradient: colorData.gradient,
      glowColor: colorData.glowColor,
      blocks: colorData.blocks,
      shape: colorData.shape
    };
    
    const blockElement = createCreature(block.position.y, block.position.x, combinedData);
    
    if (!blockElement) {
      console.error('方块创建失败:', block);
      return;
    }
    
    if (!blockElement.shapeData || !blockElement.shapeData.blocks) {
      console.error('方块 shapeData 无效:', blockElement);
      return;
    }
    
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
    const iceElement = createIce(ice);

    if (!iceElement.shapeData || !iceElement.shapeData.blocks) {
      console.error('冰块 shapeData 无效:', iceElement);
      return;
    }
    
    this.addElement(iceElement);
    this.layers.get(iceElement.layer).iceCells.add(`${ice.position.x},${ice.position.y}`);
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
    // 检查边界
    if (element.type === 'tetris') {
      const maxX = Math.max(...element.shapeData.blocks.map(block => block[0]));
      const maxY = Math.max(...element.shapeData.blocks.map(block => block[1]));
      
      if (element.position.x < 0 || element.position.y < 0 || 
          element.position.x + maxX >= this.GRID_SIZE ||
          element.position.y + maxY >= this.GRID_SIZE) {
        console.warn(`方块 ${element.id} 超出边界，跳过添加 (位置: ${element.position.x},${element.position.y}, 最大: ${maxX},${maxY})`);
        return;
      }
    } else {
      if (element.position.x < 0 || element.position.y < 0 || 
          element.position.x >= this.GRID_SIZE ||
          element.position.y >= this.GRID_SIZE) {
        console.warn(`元素 ${element.id} 超出边界，跳过添加 (位置: ${element.position.x},${element.position.y})`);
        return;
      }
    }
    
    const layer = this.layers.get(element.layer);
    layer.elements.set(element.id, element);
    
    // 更新空间索引
    if (element.type === 'tetris') {
      element.occupiedCells.forEach(cell => {
        if (!this.spatialIndex.has(cell)) {
          this.spatialIndex.set(cell, new Set());
        }
        this.spatialIndex.get(cell).add(element.id);
      });
      element.occupiedCells.forEach(cell => layer.occupiedCells.add(cell));
    } else {
      const cellKey = `${element.position.x},${element.position.y}`;
      if (!this.spatialIndex.has(cellKey)) {
        this.spatialIndex.set(cellKey, new Set());
      }
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
    } else {
      console.warn('无法识别的 shapeData 格式:', shapeData);
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
    
    // 如果选择的是不同的方块，取消之前选中的
    if (this.selectedElement && this.selectedElement.id !== elementId) {
      this.selectedElement = null;
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
      if (!elementsAtCell) continue;
      
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
      const cellSet = this.spatialIndex.get(cell);
      if (cellSet) {
        cellSet.delete(element.id);
      }
    });
    
    newCells.forEach(cell => {
      if (!this.spatialIndex.has(cell)) {
        this.spatialIndex.set(cell, new Set());
      }
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
    if (!elementsAtCell) return false;
    
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
        const cellSet = this.spatialIndex.get(cell);
        if (cellSet) {
          cellSet.delete(elementId);
        }
      });
    } else {
      const cellKey = `${element.position.x},${element.position.y}`;
      const cellSet = this.spatialIndex.get(cellKey);
      if (cellSet) {
        cellSet.delete(elementId);
      }
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
    if (!elementsAtCell) return;
    
    // 检查是否有新的方块可以移动
    for (const elementId of elementsAtCell) {
      const element = this.elementRegistry.get(elementId);
      if (element.type === 'tetris' && element.layer === layer) {
        // 将第2层方块移动到第0层，使其可移动
        element.layer = 0;
        element.movable = true;
        console.log(`方块 ${element.id} 从第${layer}层移动到第0层，现在可以移动`);
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
        },
        ice: { 
          scale: 1, 
          rotation: 0, 
          alpha: 1,
          glow: 0,
          shimmer: 0,
          crack: 0
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

      // 方块动画 - 移除旋转摆动，只保留轻微的缩放效果
      this.blockAnimation = gsap.to(this.animationTargets.blocks, {
        scale: 1.02,
        rotation: 0, // 移除旋转
        bounce: 0, // 移除弹跳
        duration: 3.5,
        ease: "power1.inOut",
        repeat: -1,
        yoyo: true,
        paused: false
      });

      // 门动画 - 移除所有特效，保持静态
      this.gateAnimation = gsap.to(this.animationTargets.gates, {
        scale: 1,
        glow: 0,
        pulse: 0,
        rotation: 0,
        duration: 0,
        ease: "none",
        repeat: 0,
        yoyo: false,
        paused: true
      });

      // 🧊 冰块动画 - 静态效果
      this.iceAnimation = gsap.to(this.animationTargets.ice, {
        shimmer: 0,
        glow: 0,
        crack: 0,
        scale: 1,
        duration: 0,
        ease: "none",
        repeat: 0,
        yoyo: false,
        paused: true
      });

      // 创建时间轴动画 - 组合多个动画
      this.masterTimeline = gsap.timeline({ repeat: -1 });
      this.masterTimeline
        .add(this.gridAnimation, 0)
        .add(this.pulseAnimation, 0.5)
        .add(this.blockAnimation, 1)
        .add(this.gateAnimation, 1.5)
        .add(this.iceAnimation, 2);

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
      gates: { scale: 1, alpha: 1, glow: 0 },
      ice: { scale: 1, alpha: 1, glow: 0, shimmer: 0, crack: 0 }
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
    this.iceAnimation = {
      progress: () => Math.sin(Date.now() * 0.002) * 0.5 + 0.5,
      targets: () => [this.animationTargets.ice]
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
      // 如果方块有 blockElement，使用 creature.js 的动画效果
      if (block.blockElement && typeof standUpAndExtendLimbs !== 'undefined') {
        // 开始动画效果
        standUpAndExtendLimbs(block.blockElement);
        
        // 创建移动动画
        const moveAnimation = gsap.to(block.blockElement.element, {
          x: toPos.x * this.cellSize,
          y: toPos.y * this.cellSize,
          duration: 0.5,
          ease: "power2.out",
          onComplete: () => {
            // 移动完成后收起动画效果
            if (typeof sitDownAndHideLimbs !== 'undefined') {
              sitDownAndHideLimbs(block.blockElement);
            }
            this.animations.delete(animationId);
          }
        });
        
        this.animations.set(animationId, moveAnimation);
      } else {
        // 降级到简单动画
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
      }
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
    // 使用统一配置的格子大小范围
    const maxCellSize = GAME_CONFIG.MAX_CELL_SIZE;
    
    // 计算理想的网格尺寸
    const idealGridSize = this.GRID_SIZE * maxCellSize;
    
    // 根据屏幕尺寸调整
    const maxWidth = windowWidth * 0.9; // 使用更多宽度
    const maxHeight = windowHeight * 0.8; // 使用更多高度
    
    // 选择较小的限制，确保网格完全可见
    this.gridSize = Math.min(idealGridSize, maxWidth, maxHeight);
    
    // 使用固定格子大小，确保与方块大小一致
    this.cellSize = GAME_CONFIG.CELL_SIZE;
    this.gridSize = this.cellSize * this.GRID_SIZE;
    
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
      minCellSize: GAME_CONFIG.MIN_CELL_SIZE,
      maxCellSize: GAME_CONFIG.MAX_CELL_SIZE
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
    ctx.fillStyle = `rgba(200, 200, 200, 1)`; // 更明显的浅灰色
    
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
    
    // 绘制完整的正方形边框，包含四个角
    // 先绘制整个边框为黑色
    ctx.strokeStyle = `rgba(0, 0, 0, ${borderAlpha})`;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(
      this.gridOffsetX - borderWidth/2, 
      this.gridOffsetY - borderWidth/2, 
      this.gridSize + borderWidth, 
      this.gridSize + borderWidth
    );
    
    // 然后在门的位置用门颜色覆盖
    this.drawGatesOnBorder(ctx, borderWidth, borderAlpha);
    
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
    
    // 网格边框已由 drawGatesOnBorder 函数统一绘制，这里不需要再画
  }
  
  /**
   * 在边框上绘制门 - 动态处理所有门
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} borderWidth - 边框宽度
   * @param {number} borderAlpha - 边框透明度
   */
  drawGatesOnBorder(ctx, borderWidth, borderAlpha) {
    // 获取所有门
    const gates = this.getAllElementsByType('gate');
    
    gates.forEach(gate => {
      const color = this.getGateColor(gate.color);
      const gateColor = `rgba(${this.hexToRgb(color)}, ${borderAlpha})`;
      
      ctx.strokeStyle = gateColor;
      ctx.lineWidth = borderWidth;
      
      let startX, startY, endX, endY;
      
      // 根据门的方向计算坐标
      switch (gate.direction) {
        case 'up':
          // 上方的门
          startX = this.gridOffsetX + gate.position.x * this.cellSize;
          startY = this.gridOffsetY - borderWidth / 2;
          endX = this.gridOffsetX + (gate.position.x + gate.size.width) * this.cellSize;
          endY = this.gridOffsetY - borderWidth / 2;
          break;
          
        case 'down':
          // 下方的门
          startX = this.gridOffsetX + gate.position.x * this.cellSize;
          startY = this.gridOffsetY + this.gridSize + borderWidth / 2;
          endX = this.gridOffsetX + (gate.position.x + gate.size.width) * this.cellSize;
          endY = this.gridOffsetY + this.gridSize + borderWidth / 2;
          break;
          
        case 'left':
          // 左侧的门
          startX = this.gridOffsetX - borderWidth / 2;
          startY = this.gridOffsetY + gate.position.y * this.cellSize;
          endX = this.gridOffsetX - borderWidth / 2;
          endY = this.gridOffsetY + (gate.position.y + gate.size.height) * this.cellSize;
          break;
          
        case 'right':
          // 右侧的门
          startX = this.gridOffsetX + this.gridSize + borderWidth / 2;
          startY = this.gridOffsetY + gate.position.y * this.cellSize;
          endX = this.gridOffsetX + this.gridSize + borderWidth / 2;
          endY = this.gridOffsetY + (gate.position.y + gate.size.height) * this.cellSize;
          break;
          
        default:
          console.warn(`未知的门方向: ${gate.direction}`);
          return;
      }
      
      // 绘制门段
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
  }
  
  /**
   * 将十六进制颜色转换为RGB
   * @param {string} hex - 十六进制颜色值
   * @returns {string} RGB颜色值
   */
  hexToRgb(hex) {
    // 移除 # 号
    hex = hex.replace('#', '');
    
    // 解析RGB值
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `${r}, ${g}, ${b}`;
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
    
    // 绘制俄罗斯方块（包括被冰块包裹的方块）
    this.drawTetrisBlocks();
  }
  
  /**
   * 绘制门
   */
  drawGates() {
    const gates = this.getAllElementsByType('gate');
    
    gates.forEach(gate => {
      this.drawGateLabel(gate);
    });
  }
  
  /**
   * 绘制门的标签 - 动态处理所有门
   * @param {Object} gate - 门对象
   */
  drawGateLabel(gate) {
    const borderWidth = Math.max(6, this.cellSize * 0.15);
    
    let x, y, width, height;
    
    // 根据门的方向和位置计算坐标
    switch (gate.direction) {
      case 'up':
        x = this.gridOffsetX + gate.position.x * this.cellSize;
        y = this.gridOffsetY - borderWidth / 2;
        width = gate.size.width * this.cellSize;
        height = borderWidth;
        break;
        
      case 'down':
        x = this.gridOffsetX + gate.position.x * this.cellSize;
        y = this.gridOffsetY + this.gridSize - borderWidth / 2;
        width = gate.size.width * this.cellSize;
        height = borderWidth;
        break;
        
      case 'left':
        x = this.gridOffsetX - borderWidth / 2;
        y = this.gridOffsetY + gate.position.y * this.cellSize;
        width = borderWidth;
        height = gate.size.height * this.cellSize;
        break;
        
      case 'right':
        x = this.gridOffsetX + this.gridSize - borderWidth / 2;
        y = this.gridOffsetY + gate.position.y * this.cellSize;
        width = borderWidth;
        height = gate.size.height * this.cellSize;
        break;
        
      default:
        return;
    }
    
    // 应用GSAP动画变换
    this.ctx.save();
    this.ctx.translate(x + width / 2, y + height / 2);
    this.ctx.translate(-width / 2, -height / 2);
    
    // 门标签 - 移除脉冲特效，保持静态
    this.ctx.fillStyle = `rgba(255, 255, 255, 1)`;
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      gate.color.toUpperCase(),
      width / 2,
      height / 2 + 3
    );
    
    this.ctx.restore();
  }

  /**
   * 绘制单个门（已废弃，由 drawBorderWithGates 统一绘制）
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
        height = borderWidth; // 使用边框宽度
        break;
        
      case 'down':
        // 下方的门 - 绘制在下边框上
        x = this.gridOffsetX + gate.position.x * this.cellSize;
        y = this.gridOffsetY + this.gridSize - borderWidth / 2; // 在边框中心
        width = gate.size.width * this.cellSize;
        height = borderWidth; // 使用边框宽度
        break;
        
      case 'left':
        // 左侧的门 - 绘制在左边框上
        x = this.gridOffsetX - borderWidth / 2; // 在边框中心
        y = this.gridOffsetY + gate.position.y * this.cellSize;
        width = borderWidth; // 使用边框宽度
        height = gate.size.height * this.cellSize;
        break;
        
      case 'right':
        // 右侧的门 - 绘制在右边框上
        x = this.gridOffsetX + this.gridSize - borderWidth / 2; // 在边框中心
        y = this.gridOffsetY + gate.position.y * this.cellSize;
        width = borderWidth; // 使用边框宽度
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
    
    // 门背景 - 移除发光和脉冲效果，保持静态
    const brightColor = this.brightenColor(color, 0.3);
    this.ctx.fillStyle = brightColor;
    this.ctx.fillRect(0, 0, width, height);
    
    // 门的高光效果 - 移除脉冲，保持静态
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fillRect(0, 0, width, height / 2);
    
    // 门边框由 drawBorderWithGates 函数统一绘制，这里不需要再画边框
    
    // 门标签 - 移除脉冲特效，保持静态
    this.ctx.fillStyle = `rgba(255, 255, 255, 1)`;
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
   * 绘制冰层 - 每个冰块独立渲染，确保是一个格子一个格子的
   */
  drawIceLayers() {
    const iceLayers = this.getAllElementsByType('ice');
    
    iceLayers.forEach(ice => {
      const x = this.gridOffsetX + ice.position.x * this.cellSize;
      const y = this.gridOffsetY + ice.position.y * this.cellSize;
      
      // 获取冰块动画属性
      let iceGlow = 0.3;
      let iceScale = 1;
      let iceRotation = 0;
      let iceAlpha = 0.8;
      
      // 尝试从GSAP动画获取属性
      if (this.animationTargets && this.animationTargets.ice) {
        try {
          const iceAnimation = this.animationTargets.ice;
          if (typeof iceAnimation.progress === 'function') {
            const progress = iceAnimation.progress();
            iceGlow = 0.3 + Math.sin(Date.now() * 0.003 + ice.position.x * 0.5 + ice.position.y * 0.3) * 0.2;
            iceScale = 1 + Math.sin(Date.now() * 0.002 + ice.position.x * 0.4) * 0.05;
            iceRotation = Math.sin(Date.now() * 0.001 + ice.position.y * 0.6) * 2;
            iceAlpha = 0.8 - (ice.meltProgress / 100) * 0.5;
          }
        } catch (e) {
          // 如果GSAP不可用，使用默认值
          iceGlow = 0.3;
          iceScale = 1;
          iceRotation = 0;
          iceAlpha = 0.8 - (ice.meltProgress / 100) * 0.5;
        }
      }
      
      // 保存当前状态
      this.ctx.save();
      
      // 应用变换
      this.ctx.translate(x + this.cellSize / 2, y + this.cellSize / 2);
      this.ctx.rotate(iceRotation * Math.PI / 180);
      this.ctx.scale(iceScale, iceScale);
      this.ctx.translate(-this.cellSize / 2, -this.cellSize / 2);
      
      // 🧊 几乎完全透明的冰块效果 - 圆角立方体
      const cornerRadius = this.cellSize * 0.15; // 圆角半径
      
      // 冰块主体 - 几乎完全透明蓝色
      this.ctx.fillStyle = `rgba(173, 216, 230, ${iceAlpha * 0.01})`;
      this.ctx.beginPath();
      this.ctx.roundRect(0, 0, this.cellSize, this.cellSize, cornerRadius);
      this.ctx.fill();
      
      // 冰块顶部高光 - 更亮的区域
      this.ctx.fillStyle = `rgba(255, 255, 255, ${iceAlpha * 0.02})`;
      this.ctx.beginPath();
      this.ctx.roundRect(0, 0, this.cellSize, this.cellSize * 0.3, cornerRadius);
      this.ctx.fill();
      
      // 冰块边框 - 圆角边框
      this.ctx.strokeStyle = `rgba(135, 206, 235, ${iceAlpha * 0.03})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.roundRect(0.5, 0.5, this.cellSize - 1, this.cellSize - 1, cornerRadius);
      this.ctx.stroke();
      
      // 冰块内部裂纹 - 白色线条
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${iceAlpha * 0.1})`;
      this.ctx.lineWidth = 0.8;
      
      // 绘制裂纹 - 网状结构
      const crackCount = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < crackCount; i++) {
        const startX = Math.random() * this.cellSize;
        const startY = Math.random() * this.cellSize;
        const endX = Math.random() * this.cellSize;
        const endY = Math.random() * this.cellSize;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
      }
      
      // 冰块底部融化效果 - 小水珠
      if (ice.meltProgress > 0) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${iceAlpha * 0.4})`;
        this.ctx.beginPath();
        this.ctx.ellipse(
          this.cellSize * 0.2, this.cellSize * 0.9, 
          this.cellSize * 0.1, this.cellSize * 0.05, 
          0, 0, 2 * Math.PI
        );
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.ellipse(
          this.cellSize * 0.7, this.cellSize * 0.85, 
          this.cellSize * 0.08, this.cellSize * 0.04, 
          0, 0, 2 * Math.PI
        );
        this.ctx.fill();
      }
      
      // 恢复状态
      this.ctx.restore();
      
      // 融化进度显示
      if (ice.meltProgress > 0) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${iceAlpha})`;
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
          `${ice.meltProgress}%`,
          x + this.cellSize / 2,
          y + this.cellSize / 2 + 3
        );
      }
      
      // 调试信息 - 显示冰块ID和位置
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      this.ctx.font = '8px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(
        `${ice.id}`,
        x + 2,
        y + 10
      );
    });
  }
  
  /**
   * 绘制俄罗斯方块
   */
  drawTetrisBlocks() {
    const blocks = this.getAllElementsByType('tetris');
    
    blocks.forEach(block => {
      // 如果方块有 blockElement，使用 creature.js 的绘制函数
      if (block.blockElement && typeof drawCreature !== 'undefined') {
        drawCreature(this.ctx, block.blockElement, this.gridOffsetX, this.gridOffsetY);
      } else {
        // 降级到原来的绘制方式
        this.drawTetrisBlock(block);
      }
    });
  }
  
  /**
   * 绘制使用 block.js 创建的方块元素 - 已废弃，使用纯Canvas绘制
   * @param {Object} block - 方块对象
   * @deprecated 此函数包含DOM操作，在抖音小游戏环境中不可用
   */
  drawBlockElement(block) {
    // 在抖音小游戏环境中，所有绘制都通过Canvas完成
    // 此函数已被 drawTetrisBlock 替代
    console.warn('drawBlockElement 已废弃，请使用 drawTetrisBlock');
  }
  
  /**
   * 绘制被冰块包裹的方块 - 静态冰块效果
   * @param {Object} block - 方块对象
   * @param {number} blockWidth - 方块宽度
   * @param {number} blockHeight - 方块高度
   */
  drawIceWrappedBlock(block, blockWidth, blockHeight) {
    // 🧊 冰块主体 - 静态渐变效果
    const mainGradient = this.ctx.createLinearGradient(0, 0, blockWidth, blockHeight);
    mainGradient.addColorStop(0, `rgba(173, 216, 230, 0.9)`);
    mainGradient.addColorStop(0.5, `rgba(135, 206, 235, 0.8)`);
    mainGradient.addColorStop(1, `rgba(100, 149, 237, 0.9)`);
    this.ctx.fillStyle = mainGradient;
    this.ctx.fillRect(0, 0, blockWidth, blockHeight);
    
    // 冰块高光层 - 静态高光
    const highlightGradient = this.ctx.createLinearGradient(0, 0, blockWidth * 0.6, blockHeight * 0.4);
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, 0.3)`);
    highlightGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
    this.ctx.fillStyle = highlightGradient;
    this.ctx.fillRect(0, 0, blockWidth * 0.6, blockHeight * 0.4);
    
    // 冰块边框 - 静态边框
    this.ctx.strokeStyle = `rgba(135, 206, 235, 0.6)`;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(1, 1, blockWidth - 2, blockHeight - 2);
    
    // 冰块内部裂纹 - 静态裂纹
    this.ctx.strokeStyle = `rgba(255, 255, 255, 0.7)`;
    this.ctx.lineWidth = 1;
    
    // 绘制静态裂纹
    const crackCount = 3;
    for (let i = 0; i < crackCount; i++) {
      const startX = blockWidth * (0.2 + i * 0.3);
      const startY = blockHeight * (0.2 + i * 0.2);
      const endX = blockWidth * (0.8 - i * 0.2);
      const endY = blockHeight * (0.8 - i * 0.3);
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    }
    
    // 冰块表面反射 - 静态光斑
    this.ctx.fillStyle = `rgba(255, 255, 255, 0.2)`;
    this.ctx.beginPath();
    this.ctx.ellipse(blockWidth * 0.3, blockHeight * 0.3, blockWidth * 0.15, blockHeight * 0.1, 0, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  /**
   * 绘制单个俄罗斯方块
   * @param {Object} block - 方块对象
   */
  drawTetrisBlock(block) {
    const color = this.getBlockColor(block.color);
    const isSelected = this.selectedElement === block;
    const isIceWrapped = block.layer === 1; // 第1层方块被冰块包裹
    
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
    
    // 根据形状的每个块分别绘制
    const cells = block.occupiedCells.map(cellKey => cellKey.split(',').map(Number));
    
    if (cells.length === 0) {
      console.warn(`方块 ${block.id} 没有占用格子，跳过绘制`);
      return;
    }
    
    // 为每个块分别绘制
    cells.forEach(cell => {
      const [cellX, cellY] = cell;
      const x = this.gridOffsetX + cellX * this.cellSize;
      const y = this.gridOffsetY + cellY * this.cellSize;
      
      this.ctx.save();
      
      // 应用变换
      this.ctx.translate(x + this.cellSize / 2, y + this.cellSize / 2);
      this.ctx.rotate(blockRotation * Math.PI / 180);
      this.ctx.scale(blockScale, blockScale);
      this.ctx.translate(-this.cellSize / 2, -this.cellSize / 2);
      
      // 设置阴影
      if (blockGlow > 0) {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = blockGlow * 10;
      }
      
      // 绘制单个块
      if (isIceWrapped) {
        // 被冰块包裹的方块：使用冰块效果
        this.drawIceWrappedBlock(block, this.cellSize, this.cellSize);
      } else {
        // 正常方块：原始颜色
        try {
          const gradient = this.ctx.createLinearGradient(0, 0, this.cellSize, this.cellSize);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, this.darkenColor(color, 0.2));
          this.ctx.fillStyle = gradient;
          this.ctx.fillRect(0, 0, this.cellSize, this.cellSize);
        } catch (error) {
          console.warn(`方块 ${block.id} 渐变创建失败:`, error);
          this.ctx.fillStyle = color;
          this.ctx.fillRect(0, 0, this.cellSize, this.cellSize);
        }
      }
      
      // 选中效果
      if (isSelected) {
        const pulseAlpha = 0.4 + Math.sin(Date.now() * 0.01) * 0.2;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
        this.ctx.fillRect(0, 0, this.cellSize, this.cellSize);
        
        const borderAlpha = 0.9 + Math.sin(Date.now() * 0.02) * 0.1;
        this.ctx.strokeStyle = `rgba(255, 255, 0, ${borderAlpha})`;
        this.ctx.lineWidth = 3 + Math.sin(Date.now() * 0.015) * 0.5;
        this.ctx.strokeRect(0, 0, this.cellSize, this.cellSize);
      }
      
      // 绘制边框
      const borderAlpha = 0.9 + Math.sin(Date.now() * 0.005) * 0.1;
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderAlpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(0, 0, this.cellSize, this.cellSize);
      
      this.ctx.restore();
    });
    
    return; // 提前返回，不再执行下面的边界框绘制
    
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
    if (isIceWrapped) {
      // 🧊 被冰块包裹的方块：使用GSAP动画的冰块效果
      this.drawIceWrappedBlock(block, blockWidth, blockHeight);
    } else {
      // 正常方块：原始颜色
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
      orange: '#FFA500',
      cyan: '#00CED1',
      magenta: '#FF69B4'
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
      console.log('点击在网格外，忽略');
      return;
    }
    
    // 计算网格坐标
    const gridX = Math.floor((x - this.gridOffsetX) / this.cellSize);
    const gridY = Math.floor((y - this.gridOffsetY) / this.cellSize);
    
    // 检查是否点击了方块
    const blocks = this.getAllElementsByType('tetris');
    
    for (const block of blocks) {
      if (block.occupiedCells.includes(`${gridX},${gridY}`)) {
        // 每次点击方块都是选中
        this.selectElement(block.id);
        console.log(`选择了方块: ${block.id}`);
        
        // 触发眨眼动画 - 只在点击方块时触发
        if (block.blockElement && typeof blinkAnimation !== 'undefined') {
          // 检查blockElement是否有正确的结构
          if (block.blockElement.element) {
            blinkAnimation(block.blockElement);
          }
        }
        return; // 重要：点击方块后直接返回，不执行移动逻辑
      }
    }
    
    // 如果点击了空白区域且有选中的方块，尝试移动
    if (this.selectedElement) {
      const targetPosition = { x: gridX, y: gridY };
      this.moveElementToPosition(this.selectedElement.id, targetPosition);
    }
  }
  
  /**
   * 移动元素到指定位置
   * @param {string} elementId - 元素ID
   * @param {Object} targetPosition - 目标位置 {x, y}
   */
  moveElementToPosition(elementId, targetPosition) {
    const element = this.elementRegistry.get(elementId);
    if (!element) {
      console.warn(`元素 ${elementId} 不存在`);
      return;
    }
    
    // 检查目标位置是否有效
    if (!this.isValidPosition(targetPosition, element)) {
      console.log(`位置 ${targetPosition.x},${targetPosition.y} 无效`);
      console.log(`方块 ${elementId} 形状:`, element.shapeData.blocks);
      console.log(`尝试移动到的格子:`, this.calculateOccupiedCells(targetPosition, element.shapeData));
      return;
    }
    
    // 执行移动动画
    const oldPosition = { ...element.position };
    this.animateBlockMove(element, oldPosition, targetPosition);
    
    console.log(`移动方块 ${elementId} 从 (${oldPosition.x},${oldPosition.y}) 到 (${targetPosition.x},${targetPosition.y})`);
  }
  
  /**
   * 动画移动方块（一格一格移动，参考old实现）
   * @param {Object} element - 方块元素
   * @param {Object} fromPosition - 起始位置
   * @param {Object} toPosition - 目标位置
   */
  animateBlockMove(element, fromPosition, toPosition) {
    if (!element.blockElement || !element.blockElement.element) {
      // 如果没有 blockElement，直接更新位置
      this.executeMove(element, toPosition);
      return;
    }
    
    const blockElement = element.blockElement.element;
    
    // 开始移动动画 - 根据形状类型选择不同的移动方式
    if (typeof standUpAndExtendLimbs === 'function') {
      standUpAndExtendLimbs(element.blockElement);
    }
    
    // 计算移动路径（只能上下左右移动，不能斜着移动）
    const path = this.calculateStepPath(fromPosition, toPosition);
    
    if (path.length === 0) {
      // 没有有效路径，直接收起脚
      if (typeof sitDownAndHideLimbs === 'function') {
        sitDownAndHideLimbs(element.blockElement);
      }
      return;
    }
    
    // 创建走路时间线
    const walkTimeline = gsap.timeline({
      onComplete: () => {
        // 动画完成后更新逻辑位置
        element.position = toPosition;
        element.occupiedCells = this.calculateOccupiedCells(toPosition, element.shapeData);
        
        // 更新空间索引
        this.updateSpatialIndex(element, fromPosition, toPosition);
        
        // 标记需要重绘
        this.needsRedraw = true;
        
        // 收起脚
        if (typeof sitDownAndHideLimbs === 'function') {
          sitDownAndHideLimbs(element.blockElement);
        }
        
        console.log(`方块 ${element.id} 移动动画完成`);
      }
    });
    
    // 一格一格移动
    path.forEach((step, index) => {
      const stepDuration = 0.4; // 每步持续时间
      const delay = index * stepDuration;
      
      walkTimeline.to(blockElement, {
        x: step.x * this.cellSize,
        y: step.y * this.cellSize,
        duration: stepDuration,
        ease: "circ.inOut"
      }, delay);
      
      // 添加身体摆动
      walkTimeline.to(blockElement, {
        rotation: "+=3deg",
        duration: stepDuration * 0.3,
        ease: "circ.inOut",
        yoyo: true,
        repeat: 1
      }, delay);
    });
  }
  
  /**
   * 计算移动路径（只能上下左右移动，参考old实现）
   * @param {Object} fromPosition - 起始位置
   * @param {Object} toPosition - 目标位置
   */
  calculateStepPath(fromPosition, toPosition) {
    const path = [];
    let currentX = fromPosition.x;
    let currentY = fromPosition.y;
    
    // 先移动行（上下）
    while (currentY !== toPosition.y) {
      if (currentY < toPosition.y) {
        currentY++;
      } else {
        currentY--;
      }
      path.push({ x: currentX, y: currentY });
    }
    
    // 再移动列（左右）
    while (currentX !== toPosition.x) {
      if (currentX < toPosition.x) {
        currentX++;
      } else {
        currentX--;
      }
      path.push({ x: currentX, y: currentY });
    }
    
    return path;
  }
  
  /**
   * 执行移动（无动画版本）
   * @param {Object} element - 方块元素
   * @param {Object} targetPosition - 目标位置
   */
  executeMove(element, targetPosition) {
    const oldPosition = { ...element.position };
    element.position = targetPosition;
    element.occupiedCells = this.calculateOccupiedCells(targetPosition, element.shapeData);
    
    // 更新 blockElement 的位置（用于绘制）
    if (element.blockElement && element.blockElement.element) {
      element.blockElement.element.x = targetPosition.x * this.cellSize;
      element.blockElement.element.y = targetPosition.y * this.cellSize;
    }
    
    // 更新空间索引
    this.updateSpatialIndex(element, oldPosition, targetPosition);
    
    // 标记需要重新绘制
    this.needsRedraw = true;
  }
  
  /**
   * 检查位置是否有效
   * @param {Object} position - 位置 {x, y}
   * @param {Object} element - 元素对象
   * @returns {boolean} 是否有效
   */
  isValidPosition(position, element) {
    if (element.type !== 'tetris') return true;
    
    // 检查边界
    const maxX = Math.max(...element.shapeData.blocks.map(block => block[0]));
    const maxY = Math.max(...element.shapeData.blocks.map(block => block[1]));
    
    if (position.x < 0 || position.y < 0 || 
        position.x + maxX >= this.GRID_SIZE ||
        position.y + maxY >= this.GRID_SIZE) {
      return false;
    }
    
    // 检查是否与其他元素冲突
    const newCells = this.calculateOccupiedCells(position, element.shapeData);
    
    for (const cell of newCells) {
      const elementsAtCell = this.spatialIndex.get(cell);
      if (elementsAtCell) {
        for (const otherElementId of elementsAtCell) {
          if (otherElementId !== element.id) {
            return false; // 有冲突
          }
        }
      }
    }
    
    return true;
  }
  
  /**
   * 更新空间索引
   * @param {Object} element - 元素对象
   * @param {Object} oldPosition - 旧位置
   * @param {Object} newPosition - 新位置
   */
  updateSpatialIndex(element, oldPosition, newPosition) {
    // 移除旧位置的空间索引
    const oldCells = this.calculateOccupiedCells(oldPosition, element.shapeData);
    oldCells.forEach(cell => {
      const elementsAtCell = this.spatialIndex.get(cell);
      if (elementsAtCell) {
        elementsAtCell.delete(element.id); // 使用Set.delete
        if (elementsAtCell.size === 0) { // 使用Set.size
          this.spatialIndex.delete(cell);
        }
      }
    });
    
    // 添加新位置的空间索引
    const newCells = this.calculateOccupiedCells(newPosition, element.shapeData);
    newCells.forEach(cell => {
      if (!this.spatialIndex.has(cell)) {
        this.spatialIndex.set(cell, new Set()); // 初始化新的Set
      }
      this.spatialIndex.get(cell).add(element.id); // 使用Set.add，存储element.id
    });
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
