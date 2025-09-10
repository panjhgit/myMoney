/**
 * 多层方块 Puzzle 游戏引擎
 * 核心特性：9x9网格 + 多层结构 + 障碍规避 + 颜色通关
 * 数据结构：分层网格 + 区域标记 + 哈希索引
 */

class MapEngine {
    constructor() {
        // 使用统一配置
        this.GRID_SIZE = GAME_CONFIG.GRID_SIZE;
        this.MAX_LAYERS = 10; // 最大层数

        // 核心数据结构
        this.layers = new Map(); // 分层存储：layerId -> LayerData
        this.spatialIndex = new Map(); // 空间索引：(x,y) -> Set<Element>
        this.elementRegistry = new Map(); // 元素注册表：elementId -> Element

        // 游戏状态
        this.gameState = 'ready'; // ready, playing, completed
        this.selectedElement = null;
        this.moveHistory = [];
        this.currentLevel = 1; // 当前关卡

        // 性能优化缓存
        this.collisionCache = new Map(); // 碰撞检测缓存
        this.pathCache = new Map(); // 路径计算缓存
        this.cacheCleanupInterval = 10000; // 缓存清理间隔（毫秒）
        this.lastCacheCleanup = 0; // 上次清理时间

        // 元素类型碰撞规则配置（新增 - 修复元素类型区分问题）
        this.collisionRules = {
            'tetris': {
                canCollideWith: ['tetris', 'rock'], canPassThrough: ['gate'], // 同色门可以通过
                canMelt: ['ice'], // 可以融化冰块
                blocksMovement: true
            }, 'ice': {
                canCollideWith: ['tetris'], canPassThrough: [], canMelt: [], blocksMovement: false, // 冰块不阻止移动，会被融化
                canBeMelted: true
            }, 'rock': {
                canCollideWith: ['tetris'], canPassThrough: [], canMelt: [], blocksMovement: true, canBeMelted: false
            }, 'gate': {
                canCollideWith: ['tetris'], canPassThrough: [], canMelt: [], blocksMovement: true, // 默认阻止，除非颜色匹配
                requiresColorMatch: true // 需要颜色匹配才能通过
            }
        };

        // 调试开关
        this.debugMode = true; // 设置为false关闭调试日志

        // 调试日志方法
        this.debugLog = (...args) => {
            if (this.debugMode) {
                console.log(...args);
            }
        };

        // 动画相关属性已不再使用，但保留以避免引用错误
        this.animations = new Map();
        this.animationQueue = [];
        this.blockAnimations = new Map();
        this.needsRedraw = false; // 是否需要重绘

        this.init();
    }

    init() {
        // 初始化所有层级
        for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
            this.layers.set(layer, {
                id: layer, elements: new Map(), // elementId -> Element
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
     * 清理缓存以防止内存泄漏
     */
    cleanupCache() {
        const now = Date.now();
        if (now - this.lastCacheCleanup > this.cacheCleanupInterval) {
            this.collisionCache.clear();
            this.pathCache.clear();
            this.lastCacheCleanup = now;
            console.log('缓存已清理');
        }
    }

    /**
     * 根据关卡ID直接加载地图
     * @param {number} levelId - 关卡ID
     * @returns {boolean} 是否加载成功
     */
    loadMapByLevel(levelId) {
        console.log(`MapEngine: 开始加载关卡 ${levelId}`);
        
        // 根据关卡ID获取地图数据
        let mapData;
        switch(levelId) {
            case 1:
                if (typeof map1 === 'undefined') {
                    console.error(`地图文件 map1.js 未加载`);
                    return false;
                }
                mapData = map1;
                break;
            case 2:
                if (typeof map2 === 'undefined') {
                    console.error(`地图文件 map2.js 未加载`);
                    return false;
                }
                mapData = map2;
                break;
            default:
                console.error(`关卡 ${levelId} 不存在`);
                return false;
        }
        
        // 加载地图数据
        return this.loadMap(mapData);
    }

    /**
     * 加载地图数据
     * @param {Object} mapData - 地图配置数据
     * @returns {boolean} 是否加载成功
     */
    loadMap(mapData) {
        this.clearMap();

        // 设置当前关卡
        this.currentLevel = mapData.level || 1;

        // 加载门
        if (mapData.gates) {
            mapData.gates.forEach((gate, index) => {
                this.addGate(gate);
            });
        }

        // 加载俄罗斯方块
        if (mapData.tetrisBlocks) {
            mapData.tetrisBlocks.forEach((block, index) => {
                this.addTetrisBlock(block);
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

        // 清理空间索引，移除非layer 0的元素
        this.cleanupSpatialIndex();

        // 打印完整的网格状态
        this.printGridState();
        
        return true; // 返回加载成功状态
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

        // 清理数据
        this.animationQueue = [];
        this.blockAnimations.clear();
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
            id: gate.id, type: 'gate', color: gate.color, position: gate.position, size: gate.size, // {width, height}
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
            id: blockElement.id, // 暂时使用 blockElement.id 来匹配现有行为
            type: 'tetris', color: block.color, position: block.position, // {x, y}
            initialPosition: {...block.position}, // 保存初始位置
            shape: block.shape, // 原始形状数据
            shapeData: blockElement.shapeData, // 处理后的形状数据
            layer: block.layer || 0, movable: true, isMoving: false, // 初始化移动状态
            movingTo: null, // 初始化移动目标
            // occupiedCells 现在实时计算，不再缓存
            blockElement: blockElement, // 保存 block.js 创建的元素
        };

        this.debugLog(`创建方块: 地图ID=${block.id}, 元素ID=${element.id}, blockElementID=${blockElement.id}`);

        this.addElement(element);
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

        // 使用 calculateOccupiedCells 计算冰块占据的所有格子
        const occupiedCells = this.calculateOccupiedCells(iceElement.position, iceElement.shapeData);
        occupiedCells.forEach(cell => {
            this.layers.get(iceElement.layer).iceCells.add(cell);
        });
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
            movable: false, // 添加 shapeData 属性，石块是单个格子
            shapeData: {
                blocks: [[0, 0]], width: 1, height: 1
            }
        };

        this.addElement(element);

        // 使用 calculateOccupiedCells 计算石块占据的所有格子
        const occupiedCells = this.calculateOccupiedCells(element.position, element.shapeData);
        occupiedCells.forEach(cell => {
            this.layers.get(element.layer).rockCells.add(cell);
        });
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

            if (element.position.x < 0 || element.position.y < 0 || element.position.x + maxX >= this.GRID_SIZE || element.position.y + maxY >= this.GRID_SIZE) {
                console.warn(`方块 ${element.id} 超出边界，跳过添加 (位置: ${element.position.x},${element.position.y}, 最大: ${maxX},${maxY})`);
                return;
            }
        } else {
            if (element.position.x < 0 || element.position.y < 0 || element.position.x >= this.GRID_SIZE || element.position.y >= this.GRID_SIZE) {
                console.warn(`元素 ${element.id} 超出边界，跳过添加 (位置: ${element.position.x},${element.position.y})`);
                return;
            }
        }

        const layer = this.layers.get(element.layer);
        layer.elements.set(element.id, element);

        // 更新空间索引 - 只对layer 0的元素更新空间索引
        if (element.layer === 0) {
            if (element.type === 'tetris') {
                // 俄罗斯方块：实时计算占据格子
                const occupiedCells = this.calculateOccupiedCells(element.position, element.shapeData);
                occupiedCells.forEach(cell => {
                    if (!this.spatialIndex.has(cell)) {
                        this.spatialIndex.set(cell, new Set());
                    }
                    this.spatialIndex.get(cell).add(element.id);
                });
                occupiedCells.forEach(cell => layer.occupiedCells.add(cell));
            } else if (element.type === 'gate') {
                // 门：计算所有占据格子
                const gateCells = this.calculateGateCells(element);
                gateCells.forEach(cell => {
                    if (!this.spatialIndex.has(cell)) {
                        this.spatialIndex.set(cell, new Set());
                    }
                    this.spatialIndex.get(cell).add(element.id);
                });
                gateCells.forEach(cell => layer.occupiedCells.add(cell));
            } else if (element.type === 'rock') {
                // 岩石：计算所有占据格子
                const rockCells = this.calculateRockCells(element);
                rockCells.forEach(cell => {
                    if (!this.spatialIndex.has(cell)) {
                        this.spatialIndex.set(cell, new Set());
                    }
                    this.spatialIndex.get(cell).add(element.id);
                });
                rockCells.forEach(cell => layer.occupiedCells.add(cell));
            } else {
                // 其他类型：单格子
                const cellKey = `${element.position.x},${element.position.y}`;
                if (!this.spatialIndex.has(cellKey)) {
                    this.spatialIndex.set(cellKey, new Set());
                }
                this.spatialIndex.get(cellKey).add(element.id);
                layer.occupiedCells.add(cellKey);
            }
        } else {
            // 下层元素：只添加到layer的occupiedCells，不添加到空间索引
            if (element.type === 'tetris') {
                const occupiedCells = this.calculateOccupiedCells(element.position, element.shapeData);
                occupiedCells.forEach(cell => layer.occupiedCells.add(cell));
            } else {
                const cellKey = `${element.position.x},${element.position.y}`;
                layer.occupiedCells.add(cellKey);
            }
        }

        this.elementRegistry.set(element.id, element);

    }


    /**
     * 计算方块占据的所有格子（统一的位置计算方法）
     * @param {Object} position - 位置 {x, y}
     * @param {Object} shapeData - 形状数据 {blocks: [[x, y], ...]}
     * @returns {Array} 格子坐标数组
     */
    calculateOccupiedCells(position, shapeData) {
        const cells = [];
        if (shapeData && shapeData.blocks) {
            // 新的格式：blocks 数组
            shapeData.blocks.forEach(block => {
                cells.push(`${position.x + block[0]},${position.y + block[1]}`);
            });
        } else if (shapeData && shapeData.width && shapeData.height) {
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
     * 统一的位置更新方法（增强一致性保证）
     * @param {Object} element - 元素对象
     * @param {Object} newPosition - 新位置 {x, y}
     */
    updateElementPosition(element, newPosition) {
        const oldPosition = {...element.position}; // 深拷贝防止引用问题

        // 验证新位置的有效性
        if (!this.isValidPosition(newPosition)) {
            this.debugLog(`无效位置更新请求: ${element.id} to (${newPosition.x},${newPosition.y})`);
            return false;
        }

        // 0. 清理相关缓存（确保数据一致性）
        this.clearCacheForElement(element.id, oldPosition);

        // 1. 更新逻辑位置（唯一数据源）
        element.position = {...newPosition}; // 深拷贝防止意外修改

        // 2. 更新空间索引
        this.updateSpatialIndexForElement(element, oldPosition, newPosition);

        // 3. 更新层级数据的占用格子信息
        this.updateLayerOccupiedCells(element, oldPosition, newPosition);

        // 4. 更新渲染位置（如果存在）
        if (element.blockElement && element.blockElement.element) {
            element.blockElement.element.x = newPosition.x * this.cellSize;
            element.blockElement.element.y = newPosition.y * this.cellSize;

            // 同步 creature.js 的位置
            if (element.blockElement.row !== undefined) {
                element.blockElement.row = newPosition.y;
            }
            if (element.blockElement.col !== undefined) {
                element.blockElement.col = newPosition.x;
            }
        }

        // 5. 触发相关的游戏逻辑检查
        this.triggerPositionChangeEffects(element, oldPosition, newPosition);

        this.debugLog(`位置更新完成: ${element.id} 从 (${oldPosition.x},${oldPosition.y}) 到 (${newPosition.x},${newPosition.y})`);
        return true;
    }

    /**
     * 验证位置有效性（新增）
     * @param {Object} position - 位置对象 {x, y}
     * @returns {boolean} 是否有效
     */
    isValidPosition(position) {
        return position && typeof position.x === 'number' && typeof position.y === 'number' && position.x >= 0 && position.x < this.GRID_SIZE && position.y >= 0 && position.y < this.GRID_SIZE;
    }

    /**
     * 更新层级占用格子信息（新增 - 确保数据一致性）
     * @param {Object} element - 元素对象
     * @param {Object} oldPosition - 旧位置
     * @param {Object} newPosition - 新位置
     */
    updateLayerOccupiedCells(element, oldPosition, newPosition) {
        const layerData = this.layers.get(element.layer);
        if (!layerData) return;

        // 移除旧位置的占用格子
        const oldCells = this.calculateOccupiedCells(oldPosition, element.shapeData);
        oldCells.forEach(cell => {
            layerData.occupiedCells.delete(cell);
        });

        // 添加新位置的占用格子
        const newCells = this.calculateOccupiedCells(newPosition, element.shapeData);
        newCells.forEach(cell => {
            layerData.occupiedCells.add(cell);
        });
    }

    /**
     * 触发位置变化的相关效果（新增 - 统一处理位置变化的副作用）
     * @param {Object} element - 元素对象
     * @param {Object} oldPosition - 旧位置
     * @param {Object} newPosition - 新位置
     */
    triggerPositionChangeEffects(element, oldPosition, newPosition) {
        // 检查冰块融化
        if (element.type === 'tetris') {
            this.checkIceMelting();
        }

        // 检查出门条件
        if (element.type === 'tetris' && element.movable) {
            this.checkElementGateExit(element);
        }

        // 检查层级显露（已在updateSpatialIndexForElement中处理）

        // 清理相关的路径缓存
        this.clearPathCacheForPosition(oldPosition);
        this.clearPathCacheForPosition(newPosition);
    }

    /**
     * 清理位置相关的路径缓存（新增）
     * @param {Object} position - 位置对象
     */
    clearPathCacheForPosition(position) {
        const keysToDelete = [];
        const positionStr = `${position.x},${position.y}`;

        for (const [key, value] of this.pathCache.entries()) {
            if (key.includes(positionStr)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.pathCache.delete(key));
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
     * 计算新位置
     * @param {Object} currentPos - 当前位置
     * @param {string} direction - 方向
     * @returns {Object} 新位置
     */
    calculateNewPosition(currentPos, direction) {
        const newPos = {...currentPos};

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
        // 使用统一的边界检查方法
        if (!this.isPositionWithinBounds(newPosition, element.shapeData)) {
            return false;
        }

        // 计算新位置占据的格子
        const newCells = this.calculateOccupiedCells(newPosition, element.shapeData);

        // 检查碰撞
        return !this.checkCollision(element.id, newCells);
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

                // 只检查layer 0的元素，且不是部分显露的冰块
                if (element && element.layer === 0 && !element.partiallyRevealed) {
                    // 检查石块碰撞
                    if (element.type === 'rock') {
                        hasCollision = true;
                        break;
                    }

                    // 检查门碰撞
                    if (element.type === 'gate') {
                        hasCollision = true;
                        break;
                    }

                    // 检查其他俄罗斯方块碰撞
                    if (element.type === 'tetris' && element.movable && element.isMoving !== true) {
                        hasCollision = true;
                        break;
                    }
                }
            }

            if (hasCollision) break;
        }

        // 缓存结果
        this.collisionCache.set(cacheKey, hasCollision);
        return hasCollision;
    }

    /**
     * 执行移动（使用新的统一位置更新）
     * @param {Object} element - 要移动的元素
     * @param {Object} newPosition - 新位置
     */
    executeMove(element, newPosition) {
        const oldPosition = element.position;

        // 使用新的统一位置更新方法
        this.updateElementPosition(element, newPosition);

        // 直接检查，不再使用废弃的moveBlock函数
                this.checkIceMelting();
                this.checkGateExit();

        // 记录移动历史
        this.moveHistory.push({
            elementId: element.id,
            from: this.calculateOccupiedCells(oldPosition, element.shapeData),
            to: this.calculateOccupiedCells(newPosition, element.shapeData),
            timestamp: Date.now()
        });

        // 清除相关缓存（包括位置相关的级联缓存）
        this.clearCacheForElement(element.id, oldPosition);
        this.clearCacheForCells(this.calculateOccupiedCells(oldPosition, element.shapeData));
        this.clearCacheForCells(this.calculateOccupiedCells(newPosition, element.shapeData));
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
        // 使用 calculateOccupiedCells 计算冰块占据的所有格子
        const occupiedCells = this.calculateOccupiedCells(iceElement.position, iceElement.shapeData);

        for (const cellKey of occupiedCells) {
            const elementsAtCell = this.spatialIndex.get(cellKey);
            if (!elementsAtCell) continue;

            for (const elementId of elementsAtCell) {
                const element = this.elementRegistry.get(elementId);
                if (element && element.type === 'tetris' && element.layer > iceElement.layer) {
                    return true; // 被上层方块覆盖
                }
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
        this.checkCellReveal(iceElement.position.x, iceElement.position.y);
    }

    /**
     * 检查出门条件（选中元素）
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
     * 检查指定元素的出门条件（新增 - 修复方法调用错误）
     * @param {Object} element - 要检查的元素
     */
    checkElementGateExit(element) {
        if (!element || element.type !== 'tetris' || !element.movable) return;

        const gates = this.getAllElementsByType('gate');

        for (const gate of gates) {
            if (this.canExitThroughGate(element, gate)) {
                this.exitThroughGate(element, gate);
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
        if (element.color !== gate.color) {
            console.log(`[通过门] 颜色不匹配: 方块${element.color} vs 门${gate.color}`);
            return false;
        }

        // 检查位置是否贴着门
        if (!this.isElementAtGate(element, gate)) {
            console.log(`[通过门] 位置不匹配: 方块未贴着门`);
            return false;
        }

        // 检查尺寸：方块的上下左右都小于等于门的大小
        const blockWidth = Math.max(...element.shapeData.blocks.map(block => block[0])) - Math.min(...element.shapeData.blocks.map(block => block[0])) + 1;
        const blockHeight = Math.max(...element.shapeData.blocks.map(block => block[1])) - Math.min(...element.shapeData.blocks.map(block => block[1])) + 1;

        if (blockWidth > gate.size.width || blockHeight > gate.size.height) {
            console.log(`[通过门] 尺寸不匹配: 方块(${blockWidth}x${blockHeight}) vs 门(${gate.size.width}x${gate.size.height})`);
            return false;
        }

        // 检查门是否被其他方块挡住
        if (!this.isGateClear(gate)) {
            console.log(`[通过门] 门被挡住: 门${gate.id}被其他方块挡住`);
            return false;
        }

        console.log(`[通过门] 检查通过: 方块${element.id}可以通过门${gate.id}`);
        return true;
    }

    /**
     * 检查门是否被其他方块挡住
     * @param {Object} gate - 门元素
     * @returns {boolean} 门是否畅通
     */
    isGateClear(gate) {
        // 获取门覆盖的所有格子
        const gateCells = [];
        for (let x = gate.position.x; x < gate.position.x + gate.size.width; x++) {
            for (let y = gate.position.y; y < gate.position.y + gate.size.height; y++) {
                gateCells.push(`${x},${y}`);
            }
        }

        console.log(`[门畅通] 检查门${gate.id}的格子:`, gateCells);

        // 检查每个门格子是否有其他方块占据
        for (const cellKey of gateCells) {
            const elementsAtCell = this.spatialIndex.get(cellKey);
            if (elementsAtCell && elementsAtCell.size > 0) {
                // 检查是否有非门元素占据这个格子
                for (const elementId of elementsAtCell) {
                    const element = this.elementRegistry.get(elementId);
                    if (element && element.type !== 'gate') {
                        console.log(`[门畅通] 门${gate.id}被方块${elementId}挡住，位置: ${cellKey}`);
                        return false;
                    }
                }
            }
        }

        console.log(`[门畅通] 门${gate.id}畅通无阻`);
        return true;
    }

    /**
     * 检查元素是否在门的位置
     * @param {Object} element - 方块元素
     * @param {Object} gate - 门元素
     * @returns {boolean} 是否在门内
     */
    isElementAtGate(element, gate) {
        // 检查方块是否贴着门（相邻）
        const elementCells = this.calculateOccupiedCells(element.position, element.shapeData);
        
        console.log(`[贴着门] 检查方块${element.id}是否贴着门${gate.id}`);
        console.log(`[贴着门] 方块占据格子:`, elementCells);
        console.log(`[贴着门] 门位置: (${gate.position.x},${gate.position.y}), 尺寸: ${gate.size.width}x${gate.size.height}, 方向: ${gate.direction}`);

        switch (gate.direction) {
            case 'up':
                // 检查方块是否在门下方，贴着门
                return elementCells.some(cell => {
                    const [x, y] = cell.split(',').map(Number);
                    // 方块在门下方，且水平位置与门重叠
                    return y === gate.position.y + gate.size.height && 
                           x >= gate.position.x && x < gate.position.x + gate.size.width;
                });

            case 'down':
                // 检查方块是否在门上方，贴着门
                return elementCells.some(cell => {
                    const [x, y] = cell.split(',').map(Number);
                    // 方块在门上方，且水平位置与门重叠
                    return y === gate.position.y - 1 && 
                           x >= gate.position.x && x < gate.position.x + gate.size.width;
                });

            case 'left':
                // 检查方块是否在门右侧，贴着门
                return elementCells.some(cell => {
                    const [x, y] = cell.split(',').map(Number);
                    // 方块在门右侧，且垂直位置与门重叠
                    return x === gate.position.x + gate.size.width && 
                           y >= gate.position.y && y < gate.position.y + gate.size.height;
                });

            case 'right':
                // 检查方块是否在门左侧，贴着门
                return elementCells.some(cell => {
                    const [x, y] = cell.split(',').map(Number);
                    // 方块在门左侧，且垂直位置与门重叠
                    return x === gate.position.x - 1 && 
                           y >= gate.position.y && y < gate.position.y + gate.size.height;
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

        // 直接移除，不再使用废弃的exitBlock函数
            this.removeElement(element.id);
            this.selectedElement = null;
            this.checkWinCondition();
    }

    /**
     * 检查通关条件
     */
    checkWinCondition() {
        const tetrisBlocks = this.getAllElementsByType('tetris');

        console.log(`检查通关条件: 当前还有 ${tetrisBlocks.length} 个方块`);

        // 如果还有方块，检查是否所有方块都已经到达目标位置
        if (tetrisBlocks.length > 0) {
            // 检查是否所有方块都已经在正确的位置（通过门）
            const allBlocksAtTarget = tetrisBlocks.every(block => {
                return this.isBlockAtCorrectGate(block);
            });

            if (allBlocksAtTarget) {
                console.log('所有方块都已到达目标位置，关卡完成！');
                this.gameState = 'completed';
                this.onGameComplete();
            } else {
                console.log('还有方块未到达目标位置，继续游戏');
            }
        } else {
            // 没有方块了，关卡完成
            console.log('所有方块都已离开，关卡完成！');
            this.gameState = 'completed';
            this.onGameComplete();
        }
    }

    /**
     * 检查方块是否在正确的门位置
     * @param {Object} block - 方块元素
     * @returns {boolean} 是否在正确的门位置
     */
    isBlockAtCorrectGate(block) {
        const gates = this.getAllElementsByType('gate');

        // 找到与方块颜色匹配的门
        const matchingGate = gates.find(gate => gate.color === block.color);
        if (!matchingGate) {
            console.log(`方块 ${block.id} 没有找到匹配的门 (颜色: ${block.color})`);
            return false;
        }

        // 检查方块是否在门的位置
        const isAtGate = this.isElementAtGate(block, matchingGate);
        console.log(`方块 ${block.id} (${block.color}) 是否在门 ${matchingGate.id} (${matchingGate.color}) 位置: ${isAtGate}`);

        return isAtGate;
    }

    /**
     * 移除元素
     * @param {string} elementId - 元素ID
     */
    removeElement(elementId) {
        const element = this.elementRegistry.get(elementId);
        if (!element) return;

        // 清理 blockElement（不再使用废弃的destroyBlock函数）
        if (element.blockElement) {
            // 简单的清理，避免内存泄漏
            element.blockElement = null;
        }

        const layer = this.layers.get(element.layer);
        layer.elements.delete(elementId);

        // 更新空间索引 - 只对layer 0的元素更新空间索引
        if (element.layer === 0) {
            if (element.type === 'tetris') {
                // 俄罗斯方块：实时计算占据格子
                const occupiedCells = this.calculateOccupiedCells(element.position, element.shapeData);
                occupiedCells.forEach(cell => {
                    const cellSet = this.spatialIndex.get(cell);
                    if (cellSet) {
                        cellSet.delete(elementId);
                        if (cellSet.size === 0) {
                            this.spatialIndex.delete(cell);
                        }
                    }
                });
            } else if (element.type === 'gate') {
                // 门：计算所有占据格子
                const gateCells = this.calculateGateCells(element);
                gateCells.forEach(cell => {
                    const cellSet = this.spatialIndex.get(cell);
                    if (cellSet) {
                        cellSet.delete(elementId);
                        if (cellSet.size === 0) {
                            this.spatialIndex.delete(cell);
                        }
                    }
                });
            } else if (element.type === 'rock') {
                // 岩石：计算所有占据格子
                const rockCells = this.calculateRockCells(element);
                rockCells.forEach(cell => {
                    const cellSet = this.spatialIndex.get(cell);
                    if (cellSet) {
                        cellSet.delete(elementId);
                        if (cellSet.size === 0) {
                            this.spatialIndex.delete(cell);
                        }
                    }
                });
            } else {
                // 其他类型：单格子
                const cellKey = `${element.position.x},${element.position.y}`;
                const cellSet = this.spatialIndex.get(cellKey);
                if (cellSet) {
                    cellSet.delete(elementId);
                    if (cellSet.size === 0) {
                        this.spatialIndex.delete(cellKey);
                    }
                }
            }
        }
        // 下层元素不需要从空间索引中移除，因为它们本来就不在空间索引中

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
     * 获取所有可见元素（第0层）
     * @returns {Array} 可见元素数组
     */
    getAllVisibleElements() {
        const elements = [];
        this.elementRegistry.forEach(element => {
            if (element.layer === 0 && !element.partiallyRevealed) {
                elements.push(element);
            }
        });
        return elements;
    }

    /**
     * 获取指定位置的所有元素
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Array} 元素数组
     */
    getElementsAtPosition(x, y) {
        const cellKey = `${x},${y}`;
        const elementIds = this.spatialIndex.get(cellKey);
        if (!elementIds) return [];

        const elements = [];
        elementIds.forEach(elementId => {
            const element = this.elementRegistry.get(elementId);
            if (element) {
                elements.push(element);
            }
        });
        return elements;
    }

    /**
     * 检查关卡是否完成
     * @returns {boolean} 是否完成
     */
    isLevelComplete() {
        const creatures = this.getAllElementsByType('tetris');
        return creatures.length === 0; // 所有方块都出去了
    }

    /**
     * 获取游戏统计信息
     * @returns {Object} 统计信息
     */
    getGameStats() {
        return {
            totalElements: this.elementRegistry.size,
            visibleElements: this.getAllVisibleElements().length,
            hiddenElements: this.getAllElementsByType('tetris').filter(e => e.layer > 0).length,
            gates: this.getAllElementsByType('gate').length,
            rocks: this.getAllElementsByType('rock').length,
            iceCells: Array.from(this.layers.values()).reduce((total, layer) => total + layer.iceCells.size, 0)
        };
    }

    /**
     * 获取当前地图的配置数据
     * @returns {Object} 地图配置数据
     */
    getMapData() {
        // 根据当前关卡返回对应的地图配置
        switch(this.currentLevel) {
            case 1:
                return map1;
            case 2:
                return map2;
            default:
                console.warn(`关卡 ${this.currentLevel} 的配置数据不存在`);
                return {
                    level: this.currentLevel,
                    target: 5,
                    timeLimit: 300,
                    name: `关卡 ${this.currentLevel}`
                };
        }
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
            if (element.type === 'ice') {
                // 使用 calculateOccupiedCells 计算冰块占据的所有格子
                const occupiedCells = this.calculateOccupiedCells(element.position, element.shapeData);
                if (occupiedCells.includes(cellKey)) {
                    return element;
                }
            }
        }
        return null;
    }

    /**
     * 检查是否有下层方块显露（移动后调用）
     * @param {Object} movedElement - 移动的方块元素
     */
    checkLayerReveal(movedElement) {
        // 检查所有下层方块，看是否有完全显露的
        for (let layer = 1; layer < this.MAX_LAYERS; layer++) {
            const layerData = this.layers.get(layer);
            if (!layerData) continue;

            // 获取该层的所有方块
            const hiddenElements = Array.from(layerData.elements.values());

            for (const hiddenElement of hiddenElements) {
                // 检查这个下层方块的所有格子是否都被遮挡
                const isFullyRevealed = this.isElementFullyRevealed(hiddenElement, layer);

                if (isFullyRevealed) {
                    // 完全显露，冰块融化
                    this.revealHiddenElement(hiddenElement, layer);
                }
            }
        }
    }

    /**
     * 检查下层方块是否完全显露（所有格子都没有被遮挡）
     * @param {Object} hiddenElement - 隐藏的方块元素
     * @param {number} layer - 层级
     * @returns {boolean} 是否完全显露
     */
    isElementFullyRevealed(hiddenElement, layer) {
        // 检查方块的所有占据格子（实时计算）
        const occupiedCells = this.calculateOccupiedCells(hiddenElement.position, hiddenElement.shapeData);

        for (const cellKey of occupiedCells) {
            const [x, y] = cellKey.split(',').map(Number);

            // 检查这个格子是否被上层遮挡
            if (this.isPositionCovered(x, y, layer)) {
                return false; // 还有格子被遮挡，不完全显露
            }
        }

        return true; // 所有格子都显露，完全显露
    }

    /**
     * 检查指定位置是否有下层方块显露
     * @param {number} x - 网格X坐标
     * @param {number} y - 网格Y坐标
     */
    checkCellReveal(x, y) {
        // 检查所有层级，从第1层开始
        for (let layer = 1; layer < this.MAX_LAYERS; layer++) {
            const layerData = this.layers.get(layer);
            if (!layerData) continue;

            // 查找该位置是否有隐藏的方块
            const cellKey = `${x},${y}`;
            const hiddenElement = this.findHiddenElementAtCell(cellKey, layer);

            if (hiddenElement) {
                // 检查该位置上方是否还有遮挡
                const isCovered = this.isPositionCovered(x, y, layer);

                if (!isCovered) {
                    // 没有遮挡，显露方块
                    this.revealHiddenElement(hiddenElement, layer);
                }
            }
        }
    }

    /**
     * 查找指定位置和层级的隐藏方块
     * @param {string} cellKey - 格子键
     * @param {number} layer - 层级
     * @returns {Object|null} 隐藏的方块元素
     */
    findHiddenElementAtCell(cellKey, layer) {
        const layerData = this.layers.get(layer);
        if (!layerData) return null;

        // 遍历该层级的所有元素
        for (const element of layerData.elements.values()) {
            if (element.type === 'tetris' && element.layer === layer) {
                // 检查该方块的占据位置是否包含目标格子（实时计算）
                const occupiedCells = this.calculateOccupiedCells(element.position, element.shapeData);
                if (occupiedCells.includes(cellKey)) {
                    return element;
                }
            }
        }
        return null;
    }

    /**
     * 检查指定位置是否被遮挡（使用初始位置）
     * @param {number} x - 网格X坐标
     * @param {number} y - 网格Y坐标
     * @param {number} layer - 层级
     * @returns {boolean} 是否被遮挡
     */
    isPositionCoveredInitial(x, y, layer) {
        // 检查上层（layer-1）是否有遮挡
        for (let upperLayer = layer - 1; upperLayer >= 0; upperLayer--) {
            const upperLayerData = this.layers.get(upperLayer);
            if (!upperLayerData) continue;

            // 直接检查该层级的元素，不依赖spatialIndex
            for (const elementId of upperLayerData.elements.keys()) {
                const element = this.elementRegistry.get(elementId);
                if (element && element.type === 'tetris') {
                    // 使用初始位置检查遮挡
                    const initialPosition = element.initialPosition || element.position;
                    const occupiedCells = this.calculateOccupiedCells(initialPosition, element.shapeData);
                    const cellKey = `${x},${y}`;
                    
                    if (occupiedCells.includes(cellKey)) {
                        return true; // 被遮挡
                    }
                }
            }
        }

        return false; // 没有被遮挡
    }

    /**
     * 检查指定位置是否被遮挡
     * @param {number} x - 网格X坐标
     * @param {number} y - 网格Y坐标
     * @param {number} layer - 层级
     * @returns {boolean} 是否被遮挡
     */
    isPositionCovered(x, y, layer) {
        // 检查上层（layer-1）是否有遮挡
        for (let upperLayer = layer - 1; upperLayer >= 0; upperLayer--) {
            const upperLayerData = this.layers.get(upperLayer);
            if (!upperLayerData) continue;

            // 直接检查该层级的元素，不依赖spatialIndex
            for (const elementId of upperLayerData.elements.keys()) {
                const element = this.elementRegistry.get(elementId);
                if (element && element.type === 'tetris') {
                    // 检查这个元素是否覆盖了目标位置
                    const occupiedCells = this.calculateOccupiedCells(element.position, element.shapeData);
                    const cellKey = `${x},${y}`;
                    
                    if (occupiedCells.includes(cellKey)) {
                        // 添加调试日志
                        console.log(`[遮挡检测] 位置(${x},${y}) 被第${upperLayer}层方块 ${elementId} 遮挡`);
                        return true; // 被遮挡
                    }
                }
            }
        }

        return false; // 没有被遮挡
    }

    /**
     * 显示部分显露的冰块（不参与碰撞检测）
     * @param {Object} hiddenElement - 隐藏的方块元素
     * @param {number} layer - 层级
     */
    showPartialIce(hiddenElement, layer) {
        console.log(`部分显露冰块: ${hiddenElement.id} 在第${layer}层`);
        
        // 标记为部分显露状态
        hiddenElement.partiallyRevealed = true;
        hiddenElement.movable = false; // 仍然不可移动
        
        // 更新冰块状态（用于渲染）
        const occupiedCells = this.calculateOccupiedCells(hiddenElement.position, hiddenElement.shapeData);
        occupiedCells.forEach(cellKey => {
            const layerData = this.layers.get(layer);
            if (layerData) {
                layerData.iceCells.add(cellKey);
            }
        });
        
        console.log(`冰块 ${hiddenElement.id} 部分显露，不参与碰撞检测`);
    }

    /**
     * 显露隐藏的方块
     * @param {Object} hiddenElement - 隐藏的方块元素
     * @param {number} fromLayer - 原层级
     */
    revealHiddenElement(hiddenElement, fromLayer) {
        console.log(`显露隐藏方块: ${hiddenElement.id} 从第${fromLayer}层移动到第0层`);
        console.log(`[显露前] 方块 ${hiddenElement.id} 位置: (${hiddenElement.position.x},${hiddenElement.position.y})`);

        // 将方块移动到第0层
        hiddenElement.layer = 0;
        hiddenElement.movable = true;
        hiddenElement.partiallyRevealed = false; // 清除部分显露状态

        // 从原层级移除
        const oldLayerData = this.layers.get(fromLayer);
        if (oldLayerData) {
            oldLayerData.elements.delete(hiddenElement.id);
        }

        // 添加到第0层
        const newLayerData = this.layers.get(0);
        if (newLayerData) {
            newLayerData.elements.set(hiddenElement.id, hiddenElement);
        }

        // 更新空间索引
        const occupiedCells = this.calculateOccupiedCells(hiddenElement.position, hiddenElement.shapeData);
        occupiedCells.forEach(cellKey => {
            if (!this.spatialIndex.has(cellKey)) {
                this.spatialIndex.set(cellKey, new Set());
            }
            this.spatialIndex.get(cellKey).add(hiddenElement.id);
        });

        // 确保空间索引的一致性：移除可能存在的重复引用
        this.spatialIndex.forEach((elementSet, cellKey) => {
            const validElements = new Set();
            elementSet.forEach(elementId => {
                const element = this.elementRegistry.get(elementId);
                if (element) {
                    validElements.add(elementId);
                }
            });
            this.spatialIndex.set(cellKey, validElements);
        });

        // 触发显露动画
        this.animateElementReveal(hiddenElement);
    }

    /**
     * 播放方块显露动画
     * @param {Object} element - 显露的方块元素
     */
    animateElementReveal(element) {
        if (!element.blockElement || !element.blockElement.element) {
            return;
        }

        const blockElement = element.blockElement.element;

        // 创建显露动画
        const revealAnimation = gsap.timeline();

        // 初始状态：透明且缩小
        gsap.set(blockElement, {
            alpha: 0, scale: 0.5
        });

        // 显露动画：淡入并放大
        revealAnimation.to(blockElement, {
            alpha: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)"
        });

        // 添加闪烁效果
        revealAnimation.to(blockElement, {
            alpha: 0.7, duration: 0.1, yoyo: true, repeat: 3, ease: "power2.inOut"
        });

        console.log(`方块 ${element.id} 显露动画完成`);
    }

    /**
     * 清理元素相关的缓存（增强版 - 修复级联失效问题）
     * @param {string} elementId - 元素ID
     * @param {Object} position - 元素位置（可选，用于清理位置相关缓存）
     */
    clearCacheForElement(elementId, position = null) {
        const keysToDelete = [];

        for (const [key, value] of this.collisionCache.entries()) {
            // 清理包含该元素ID的所有缓存
            if (key.includes(elementId)) {
                keysToDelete.push(key);
            }

            // 如果提供了位置，清理可能受该位置影响的其他元素缓存
            if (position !== null) {
                const positionStr = `${position.x}-${position.y}`;
                if (key.includes(positionStr)) {
                    keysToDelete.push(key);
                }
            }
        }

        // 批量删除，避免迭代过程中修改Map
        keysToDelete.forEach(key => this.collisionCache.delete(key));

        this.debugLog(`清理缓存: 删除了 ${keysToDelete.length} 个缓存项 for element ${elementId}`);
    }

    /**
     * 清理区域相关的缓存（新增 - 修复级联失效）
     * @param {Array} cells - 受影响的格子列表
     */
    clearCacheForCells(cells) {
        const keysToDelete = [];

        for (const [key, value] of this.collisionCache.entries()) {
            // 检查缓存键是否包含任何受影响的格子坐标
            for (const cell of cells) {
                const [x, y] = cell.split(',').map(Number);
                const positionStr = `${x}-${y}`;
                if (key.includes(positionStr)) {
                    keysToDelete.push(key);
                    break; // 找到一个匹配就够了
                }
            }
        }

        keysToDelete.forEach(key => this.collisionCache.delete(key));

        if (keysToDelete.length > 0) {
            this.debugLog(`清理区域缓存: 删除了 ${keysToDelete.length} 个缓存项`);
        }
    }

    /**
     * 智能碰撞检测（新增 - 基于元素类型规则）
     * @param {Object} movingElement - 移动的元素
     * @param {Object} targetElement - 目标位置的元素
     * @returns {Object} 碰撞检测结果 {collision: boolean, action: string, reason: string}
     */
    checkSmartCollision(movingElement, targetElement) {
        if (!movingElement || !targetElement) {
            return {collision: false, action: 'none', reason: 'no_elements'};
        }

        const movingRules = this.collisionRules[movingElement.type] || {};
        const targetRules = this.collisionRules[targetElement.type] || {};

        // 检查冰块融化
        if (targetElement.type === 'ice' && movingRules.canMelt && movingRules.canMelt.includes('ice')) {
            return {collision: false, action: 'melt_ice', reason: 'ice_melted'};
        }

        // 检查门的通过逻辑
        if (targetElement.type === 'gate') {
            if (targetRules.requiresColorMatch) {
                // 检查颜色匹配
                if (movingElement.color === targetElement.color) {
                    return {collision: false, action: 'pass_through_gate', reason: 'color_match'};
                } else {
                    return {collision: true, action: 'block', reason: 'color_mismatch'};
                }
            }
        }

        // 检查普通碰撞
        if (movingRules.canCollideWith && movingRules.canCollideWith.includes(targetElement.type)) {
            if (targetRules.blocksMovement) {
                return {collision: true, action: 'block', reason: 'normal_collision'};
            }
        }

        // 特殊处理：tetris vs tetris 总是碰撞
        if (movingElement.type === 'tetris' && targetElement.type === 'tetris') {
            return {collision: true, action: 'block', reason: 'tetris_vs_tetris'};
        }

        // 特殊处理：tetris vs rock 总是碰撞
        if (movingElement.type === 'tetris' && targetElement.type === 'rock') {
            return {collision: true, action: 'block', reason: 'tetris_vs_rock'};
        }

        // 默认无碰撞
        return {collision: false, action: 'none', reason: 'no_collision'};
    }

    /**
     * 游戏完成回调
     */
    onGameComplete() {
        console.log('游戏完成！');

        // 触发关卡完成回调
        if (window.onLevelComplete) {
            window.onLevelComplete(this.currentLevel || 1);
        }

        // 延迟返回主菜单，让玩家看到完成效果
        setTimeout(() => {
            if (window.initMainMenu) {
                window.initMainMenu();
            }
        }, 2000);
    }

    /**
     * 更新游戏状态（每帧调用）
     */
    update() {
        // 静态游戏，只在有交互时才更新
        if (this.gameState === 'playing') {
            this.checkIceMelting();
        }

        // 不再自动设置 needsRedraw，只在有动画时才设置
        // this.needsRedraw = false; // 移除这行，让调用者决定是否需要重绘
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

            // 注册插件（静态模式不需要物理插件）

            // 创建动画目标对象 - 使用更丰富的属性
            this.animationTargets = {
                grid: {
                    scale: 1, rotation: 0, alpha: 1, glow: 0, pulse: 0
                }, pulse: {
                    scale: 1, alpha: 1, rotation: 0, bounce: 0
                }, blocks: {
                    scale: 1, rotation: 0, alpha: 1, bounce: 0, glow: 0
                }, gates: {
                    scale: 1, alpha: 1, glow: 0, pulse: 0, rotation: 0
                }, ice: {
                    scale: 1, rotation: 0, alpha: 1, glow: 0, shimmer: 0, crack: 0
                }
            };

            console.log('静态渲染模式');
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
            grid: {scale: 1, alpha: 1, glow: 0},
            pulse: {scale: 1, alpha: 1, rotation: 0},
            blocks: {scale: 1, alpha: 1, bounce: 0},
            gates: {scale: 1, alpha: 1, glow: 0},
            ice: {scale: 1, alpha: 1, glow: 0, shimmer: 0, crack: 0}
        };

        // 静态属性初始化
    }


    /**
     * 开始门闪烁动画
     * @param {Object} gate - 门对象
     */
    animateGatePulse(gate) {
        // 静态渲染模式 - 无动画
    }

    /**
     * 设置渲染上下文
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Object} systemInfo - 系统信息
     */
    setRenderContext(ctx, systemInfo) {
        this.ctx = ctx;
        this.systemInfo = systemInfo;

        // 安全获取系统信息，防止 NaN 或 Infinity 或零值
        const windowWidth = Number(systemInfo.windowWidth) || 375;
        const windowHeight = Number(systemInfo.windowHeight) || 667;

        // 确保值是有限的且大于零
        if (!isFinite(windowWidth) || !isFinite(windowHeight) || windowWidth <= 0 || windowHeight <= 0) {
            console.warn('系统信息包含非有限值或零值，使用默认值:', {windowWidth, windowHeight});
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

        try {
            if (this.animationTargets && this.animationTargets.grid) {
                gridScale = this.animationTargets.grid.scale || 1;
                gridAlpha = this.animationTargets.grid.alpha || 1;
                gridGlow = this.animationTargets.grid.glow || 0;
            }
        } catch (error) {
            console.warn('获取网格动画属性失败:', error);
        }


        // 绘制网格背景 - 使用GSAP动画属性
        const bgAlpha = 0.15 + (gridAlpha - 1) * 0.1 + gridGlow * 0.2;
        ctx.fillStyle = `rgba(200, 200, 200, 1)`; // 更明显的浅灰色

        // 应用缩放变换
        ctx.save();
        ctx.translate(this.gridOffsetX + this.gridSize / 2, this.gridOffsetY + this.gridSize / 2);
        ctx.scale(gridScale, gridScale);
        ctx.translate(-this.gridSize / 2, -this.gridSize / 2);
        ctx.fillRect(0, 0, this.gridSize, this.gridSize);
        ctx.restore();

        // 绘制加粗的外边框 - 非门部分用黑色，门部分用对应颜色
        const borderWidth = Math.max(12, this.cellSize * 0.25); // 更粗的边框，向外延伸
        const borderAlpha = 1.0; // 完全不透明的边框

        // 获取门的位置信息
        const gates = this.getAllElementsByType('gate');
        const gatePositions = {
            up: gates.filter(gate => gate.direction === 'up').map(gate => ({
                start: gate.position.x, end: gate.position.x + gate.size.width
            })), right: gates.filter(gate => gate.direction === 'right').map(gate => ({
                start: gate.position.y, end: gate.position.y + gate.size.height
            })), down: gates.filter(gate => gate.direction === 'down').map(gate => ({
                start: gate.position.x, end: gate.position.x + gate.size.width
            })), left: gates.filter(gate => gate.direction === 'left').map(gate => ({
                start: gate.position.y, end: gate.position.y + gate.size.height
            }))
        };

        // 绘制完整的正方形边框，包含四个角 - 紧贴棋盘边缘
        // 先绘制整个边框为黑色
        ctx.strokeStyle = `rgba(0, 0, 0, ${borderAlpha})`;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(this.gridOffsetX - borderWidth / 2, this.gridOffsetY - borderWidth / 2, this.gridSize + borderWidth, this.gridSize + borderWidth);

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

        // 绘制坐标标记
        this.drawCoordinateLabels(ctx);

        // 网格边框已由 drawGatesOnBorder 函数统一绘制，这里不需要再画
    }

    /**
     * 绘制坐标标签
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    drawCoordinateLabels(ctx) {
        ctx.save();
        
        // 设置文字样式
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 绘制每个格子的坐标
        for (let x = 0; x < this.GRID_SIZE; x++) {
            for (let y = 0; y < this.GRID_SIZE; y++) {
                const cellX = this.gridOffsetX + x * this.cellSize + this.cellSize / 2;
                const cellY = this.gridOffsetY + y * this.cellSize + this.cellSize / 2;
                
                const coordinateText = `${x},${y}`;
                
                // 绘制文字描边（黑色背景）
                ctx.strokeText(coordinateText, cellX, cellY);
                // 绘制文字（白色前景）
                ctx.fillText(coordinateText, cellX, cellY);
            }
        }
        
        ctx.restore();
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
            ctx.lineWidth = borderWidth + 2; // 门比边框稍粗一点

            let startX, startY, endX, endY;

            // 根据门的方向计算坐标 - 紧贴棋盘边缘
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

        // 绘制背景
        this.drawBackground();

        // 绘制地图网格和边框
        this.drawMapGrid();

        // 绘制棋盘
        this.drawBoard();

        // 绘制冰块
        this.drawIceBlocks();

        // 绘制门
        this.drawGates();

        // 绘制石块
        this.drawRocks();

        // 绘制冰层
        this.drawIceLayers();

        // 绘制俄罗斯方块（包括被冰块包裹的方块）
        this.drawTetrisBlocks();

        // 绘制UI
        this.drawUI();
    }

    /**
     * 绘制背景
     */
    drawBackground() {
        if (!this.ctx) return;

        // 渐变背景
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.systemInfo.windowHeight);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#4682B4');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.systemInfo.windowWidth, this.systemInfo.windowHeight);
    }

    /**
     * 绘制棋盘
     */
    drawBoard() {
        if (!this.ctx) return;

        // 使用与drawMapGrid相同的坐标系统
        const boardWidth = this.GRID_SIZE * this.cellSize;
        const boardHeight = this.GRID_SIZE * this.cellSize;
        const startX = this.gridOffsetX;
        const startY = this.gridOffsetY;

        // 绘制棋盘背景
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(startX, startY, boardWidth, boardHeight);

        // 绘制网格线
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;

        for (let row = 0; row <= this.GRID_SIZE; row++) {
            const y = startY + row * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(startX + boardWidth, y);
            this.ctx.stroke();
        }

        for (let col = 0; col <= this.GRID_SIZE; col++) {
            const x = startX + col * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, startY + boardHeight);
            this.ctx.stroke();
        }
    }

    /**
     * 绘制冰块（淡色渲染）
     */
    drawIceBlocks() {
        if (!this.ctx) return;

        // 使用与drawMapGrid相同的坐标系统
        const startX = this.gridOffsetX;
        const startY = this.gridOffsetY;

        // 绘制隐藏方块位置的冰块
        for (let layer = 1; layer < this.MAX_LAYERS; layer++) {
            const layerData = this.layers.get(layer);
            if (!layerData) continue;

            // 获取该层的所有隐藏方块
            const hiddenBlocks = Array.from(layerData.elements.values()).filter(element => element.type === 'tetris');
            
            hiddenBlocks.forEach(block => {
                // 检查方块是否被上层遮挡（使用初始位置，不受移动影响）
                const isCovered = this.isBlockCoveredByUpperLayersInitial(block, layer);
                
                if (isCovered) {
                    // 被遮挡，绘制冰块
                    const occupiedCells = this.calculateOccupiedCells(block.position, block.shapeData);
                    
                    occupiedCells.forEach(cellKey => {
                        const [x, y] = cellKey.split(',').map(Number);
                        const screenX = startX + x * this.cellSize;
                        const screenY = startY + y * this.cellSize;

                        this.ctx.save();
                        this.ctx.fillStyle = 'rgba(173, 216, 230, 0.8)'; // 提高透明度到80%
                        this.ctx.strokeStyle = 'rgba(135, 206, 235, 1.0)'; // 边框完全不透明
                        this.ctx.lineWidth = 2; // 增加边框宽度
                        this.ctx.fillRect(screenX, screenY, this.cellSize, this.cellSize);
                        this.ctx.strokeRect(screenX, screenY, this.cellSize, this.cellSize);
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // 提高内部透明度
                        this.ctx.fillRect(screenX + 2, screenY + 2, this.cellSize - 4, this.cellSize - 4);
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // 黑色文字更明显
                        this.ctx.font = '16px Arial'; // 增大字体
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText('🧊', screenX + this.cellSize / 2, screenY + this.cellSize / 2 + 6);
                        this.ctx.restore();
                    });
                }
            });
        }
    }

    /**
     * 检查隐藏方块是否被上层遮挡（使用初始位置，不受移动影响）
     * @param {Object} block - 隐藏方块
     * @param {number} layer - 方块所在层级
     * @returns {boolean} 是否被遮挡
     */
    isBlockCoveredByUpperLayersInitial(block, layer) {
        // 使用初始位置，不受移动影响
        const initialPosition = block.initialPosition || block.position;
        const occupiedCells = this.calculateOccupiedCells(initialPosition, block.shapeData);
        
        let coveredCells = 0;
        let totalCells = occupiedCells.length;
        
        // 检查方块的每个格子是否被上层遮挡
        for (const cellKey of occupiedCells) {
            const [x, y] = cellKey.split(',').map(Number);
            
            // 检查这个位置是否被上层遮挡（使用初始位置）
            const isCovered = this.isPositionCoveredInitial(x, y, layer);
            
            if (isCovered) {
                coveredCells++;
            }
        }
        
        // 如果所有格子都被遮挡，不显示冰块（完全隐藏）
        if (coveredCells === totalCells) {
            return false;
        }
        
        // 如果部分格子被遮挡，显示冰块
        if (coveredCells > 0) {
            return true;
        }
        
        // 如果没有格子被遮挡，直接显示方块
        return false;
    }

    /**
     * 检查隐藏方块是否被上层遮挡
     * @param {Object} block - 隐藏方块
     * @param {number} layer - 方块所在层级
     * @returns {boolean} 是否被遮挡
     */
    isBlockCoveredByUpperLayers(block, layer) {
        const occupiedCells = this.calculateOccupiedCells(block.position, block.shapeData);
        
        let coveredCells = 0;
        let totalCells = occupiedCells.length;
        
        console.log(`[冰块检测] 方块 ${block.id} 占据位置: ${occupiedCells.join(', ')}`);
        
        // 检查方块的每个格子是否被上层遮挡
        for (const cellKey of occupiedCells) {
            const [x, y] = cellKey.split(',').map(Number);
            
            // 检查这个位置是否被上层遮挡
            const isCovered = this.isPositionCovered(x, y, layer);
            console.log(`[冰块检测] 位置 (${x},${y}) 被遮挡: ${isCovered}`);
            
            if (isCovered) {
                coveredCells++;
            }
        }
        
        console.log(`[冰块检测] 方块 ${block.id} 被遮挡格子: ${coveredCells}/${totalCells}`);
        
        // 如果所有格子都被遮挡，不显示冰块（完全隐藏）
        if (coveredCells === totalCells) {
            console.log(`[冰块检测] 方块 ${block.id} 完全被遮挡，不显示冰块`);
            return false;
        }
        
        // 如果部分格子被遮挡，显示冰块
        if (coveredCells > 0) {
            console.log(`[冰块检测] 方块 ${block.id} 部分被遮挡，显示冰块`);
            return true;
        }
        
        // 如果没有格子被遮挡，直接显示方块
        console.log(`[冰块检测] 方块 ${block.id} 完全不被遮挡，不显示冰块`);
        return false;
    }

    /**
     * 绘制UI
     */
    drawUI() {
        if (!this.ctx) return;

        // 绘制顶部信息栏背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(15, 100, this.systemInfo.windowWidth - 30, 50);

        // 绘制金币
        this.drawCoinIcon(25, 110);
        this.drawCurrencyText(55, 110);

        // 绘制爱心
        this.drawHeartIcon(this.systemInfo.windowWidth - 100, 110);
        this.drawLivesText(this.systemInfo.windowWidth - 60, 110);

        // 绘制当前关卡
        this.drawCurrentLevelText(this.systemInfo.windowWidth / 2, 110);
    }

    /**
     * 绘制金币图标
     */
    drawCoinIcon(x, y) {
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(x + 15, y + 15, 15, 0, 2 * Math.PI);
        this.ctx.fill();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('$', x + 15, y + 20);
    }

    /**
     * 绘制金币数量
     */
    drawCurrencyText(x, y) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('1905', x, y + 15);

        // 加号按钮
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.beginPath();
        this.ctx.arc(x + 40, y + 15, 8, 0, 2 * Math.PI);
        this.ctx.fill();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('+', x + 40, y + 19);
    }

    /**
     * 绘制爱心图标
     */
    drawHeartIcon(x, y) {
        this.ctx.fillStyle = '#FF6B6B';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 15, y + 5);
        this.ctx.bezierCurveTo(x + 5, y - 5, x - 5, y - 5, x - 5, y + 10);
        this.ctx.bezierCurveTo(x - 5, y + 20, x + 15, y + 30, x + 15, y + 30);
        this.ctx.bezierCurveTo(x + 15, y + 30, x + 35, y + 20, x + 35, y + 10);
        this.ctx.bezierCurveTo(x + 35, y - 5, x + 25, y - 5, x + 15, y + 5);
        this.ctx.fill();
    }

    /**
     * 绘制生命值
     */
    drawLivesText(x, y) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('5', x, y + 15);

        // 加号按钮
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.beginPath();
        this.ctx.arc(x + 20, y + 15, 8, 0, 2 * Math.PI);
        this.ctx.fill();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('+', x + 20, y + 19);
    }

    /**
     * 绘制当前关卡
     */
    drawCurrentLevelText(x, y) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`关卡 ${this.currentLevel}`, x, y + 15);
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
        const borderWidth = Math.max(12, this.cellSize * 0.25); // 与边框保持一致

        let x, y, width, height;

        // 根据门的方向和位置计算坐标 - 紧贴棋盘边缘
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

        // 门标签 - 更清晰可见的标签
        this.ctx.fillStyle = `rgba(255, 255, 255, 1)`;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(gate.color.toUpperCase(), width / 2, height / 2 + 3);

        this.ctx.restore();
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
                        iceGlow = 0.3; // 静态发光
                        iceScale = 1; // 静态缩放
                        iceRotation = 0; // 静态旋转
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
                this.ctx.ellipse(this.cellSize * 0.2, this.cellSize * 0.9, this.cellSize * 0.1, this.cellSize * 0.05, 0, 0, 2 * Math.PI);
                this.ctx.fill();

                this.ctx.beginPath();
                this.ctx.ellipse(this.cellSize * 0.7, this.cellSize * 0.85, this.cellSize * 0.08, this.cellSize * 0.04, 0, 0, 2 * Math.PI);
                this.ctx.fill();
            }

            // 恢复状态
            this.ctx.restore();

            // 融化进度显示
            if (ice.meltProgress > 0) {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${iceAlpha})`;
                this.ctx.font = 'bold 10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`${ice.meltProgress}%`, x + this.cellSize / 2, y + this.cellSize / 2 + 3);
            }

            // 调试信息 - 显示冰块ID和位置
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.font = '8px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${ice.id}`, x + 2, y + 10);
        });
    }

    /**
     * 绘制俄罗斯方块
     */
    drawTetrisBlocks() {
        // 只绘制第0层的方块（可见且可移动的方块）
        const visibleBlocks = this.getAllElementsByType('tetris').filter(block => block.layer === 0);

        visibleBlocks.forEach(block => {
            // 如果方块有 blockElement，使用 creature.js 的绘制函数
            if (block.blockElement && typeof drawCreature !== 'undefined') {
                // 只在位置真正改变时才更新位置，避免不必要的重新渲染
                if (block.blockElement.element) {
                    const newX = block.position.x * this.cellSize;
                    const newY = block.position.y * this.cellSize;
                    
                    // 只有位置真正改变时才更新
                    if (block.blockElement.element.x !== newX || block.blockElement.element.y !== newY) {
                        block.blockElement.element.x = newX;
                        block.blockElement.element.y = newY;
                    }
                }

                // 同步 creature 的 row 和 col（只在需要时）
                if (block.blockElement.row !== undefined && block.blockElement.row !== block.position.y) {
                    block.blockElement.row = block.position.y;
                }
                if (block.blockElement.col !== undefined && block.blockElement.col !== block.position.x) {
                    block.blockElement.col = block.position.x;
                }

                drawCreature(this.ctx, block.blockElement, this.gridOffsetX, this.gridOffsetY);
            } else {
                // 降级到原来的绘制方式
                this.drawTetrisBlock(block);
            }
        });
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
     * 绘制单个俄罗斯方块（已删除，使用统一的drawCreature函数）
     * @param {Object} block - 方块对象
     */
    drawTetrisBlock(block) {
        // 已删除重复的绘制函数，统一使用 drawCreature
        console.warn('drawTetrisBlock 已废弃，请使用 drawCreature');
    }

    /**
     * 获取门颜色
     * @param {string} colorName - 颜色名称
     * @returns {string} 颜色值
     */
    getGateColor(colorName) {
        const colors = {
            red: '#FF6B6B', blue: '#45B7D1', green: '#96CEB4', yellow: '#FFEAA7', purple: '#DDA0DD', orange: '#FFA500'
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
     * 处理点击事件
     * @param {number} x - 点击X坐标
     * @param {number} y - 点击Y坐标
     */
    handleClick(x, y) {
        // 检查是否点击在网格内
        if (x < this.gridOffsetX || x > this.gridOffsetX + this.gridSize || y < this.gridOffsetY || y > this.gridOffsetY + this.gridSize) {
            console.log('点击在网格外，忽略');
            return;
        }

        // 使用新的网格坐标系统
        const gridPos = this.screenToGrid(x, y);
        console.log(`点击位置: 屏幕(${x}, ${y}) -> 网格(${gridPos.x}, ${gridPos.y})`);

        // 检查是否点击了方块
        const blocks = this.getAllElementsByType('tetris');

        for (const block of blocks) {
            const occupiedCells = this.calculateOccupiedCells(block.position, block.shapeData);
            if (occupiedCells.includes(`${gridPos.x},${gridPos.y}`)) {
                // 每次点击方块都是选中
                this.selectElement(block.id);
                console.log(`选择了方块: ${block.id}`);

                return; // 重要：点击方块后直接返回，不执行移动逻辑
            }
        }

        // 如果点击了空白区域且有选中的方块，尝试移动
        if (this.selectedElement) {
            console.log(`尝试移动方块 ${this.selectedElement.id} 到位置 (${gridPos.x}, ${gridPos.y})`);
            this.moveElementToPosition(this.selectedElement.id, gridPos);
        }
    }

    /**
     * 移动元素到指定位置（完整重构版）
     * @param {string} elementId - 元素ID
     * @param {Object} targetPosition - 目标位置 {x, y}
     */
    moveElementToPosition(elementId, targetPosition) {
        const element = this.elementRegistry.get(elementId);
        if (!element || element.type !== 'tetris' || !element.movable) {
            console.log(`[移动] 方块 ${elementId} 无法移动`);
            return;
        }

        const startPosition = {...element.position};
        console.log(`[移动] 开始移动方块 ${elementId} 从 (${startPosition.x},${startPosition.y}) 到 (${targetPosition.x},${targetPosition.y})`);

        // 计算完整路径
        const path = this.calculateCompletePath(element, startPosition, targetPosition);

        if (path.length === 0) {
            console.log(`[移动] 方块 ${elementId} 无法到达目标位置`);
            return;
        }

        console.log(`[移动] 找到路径，长度: ${path.length}`);
        // 执行移动动画
        this.executeMoveWithAnimation(element, path);
    }

    /**
     * 计算完整路径（重构版 - 功能完整）
     * @param {Object} element - 方块元素
     * @param {Object} startPos - 起始位置
     * @param {Object} targetPos - 目标位置
     * @returns {Array} 路径数组
     */
    calculateCompletePath(element, startPos, targetPos) {
        console.log(`[路径计算] 开始: 从(${startPos.x},${startPos.y})到(${targetPos.x},${targetPos.y})`);
        
        // 如果目标位置就是起始位置
        if (startPos.x === targetPos.x && startPos.y === targetPos.y) {
            console.log(`[路径计算] 起始位置就是目标位置`);
            return [];
        }

        // 使用A*算法计算最优路径
        const path = this.calculateAStarPath(element, startPos, targetPos);
        
        if (path.length > 0) {
            console.log(`[路径计算] 找到路径，长度: ${path.length}`);
            return path;
        }

        // 如果A*失败，使用BFS寻找最近可达位置
        console.log(`[路径计算] A*失败，寻找最近可达位置`);
        const nearestPos = this.findNearestPositionBFS(element, startPos, targetPos);
        
        if (nearestPos.x !== startPos.x || nearestPos.y !== startPos.y) {
            console.log(`[路径计算] 找到最近位置: (${nearestPos.x},${nearestPos.y})`);
            return this.calculateAStarPath(element, startPos, nearestPos);
        }

        console.log(`[路径计算] 无法找到任何可达位置`);
        return [];
    }

    /**
     * A*路径计算算法（功能完整）
     * @param {Object} element - 方块元素
     * @param {Object} startPos - 起始位置
     * @param {Object} targetPos - 目标位置
     * @returns {Array} 路径数组
     */
    calculateAStarPath(element, startPos, targetPos) {
        console.log(`[A*] 开始A*搜索: 从(${startPos.x},${startPos.y})到(${targetPos.x},${targetPos.y})`);
        
        // 开放列表和关闭列表
        const openList = [];
        const closedList = new Set();
        
        // 起始节点
        const startNode = {
            position: startPos,
            g: 0,
            h: this.calculateHeuristic(startPos, targetPos),
            f: 0,
            parent: null
        };
        startNode.f = startNode.g + startNode.h;
        openList.push(startNode);
        
        // 四个方向
        const directions = [
            {dx: 0, dy: -1}, // 上
            {dx: 0, dy: 1},  // 下
            {dx: -1, dy: 0}, // 左
            {dx: 1, dy: 0}   // 右
        ];
        
        let iterations = 0;
        const maxIterations = this.GRID_SIZE * this.GRID_SIZE;
        
        while (openList.length > 0 && iterations < maxIterations) {
            iterations++;
            
            // 找到f值最小的节点
            let currentIndex = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < openList[currentIndex].f) {
                    currentIndex = i;
                }
            }
            
            const currentNode = openList.splice(currentIndex, 1)[0];
            const currentPos = currentNode.position;
            const currentKey = `${currentPos.x},${currentPos.y}`;
            
            // 添加到关闭列表
            closedList.add(currentKey);
            
            // 如果到达目标
            if (currentPos.x === targetPos.x && currentPos.y === targetPos.y) {
                console.log(`[A*] 找到路径! 迭代次数: ${iterations}`);
                return this.reconstructPath(currentNode);
            }
            
            // 检查四个方向
            for (const dir of directions) {
                const newX = currentPos.x + dir.dx;
                const newY = currentPos.y + dir.dy;
                const newPos = {x: newX, y: newY};
                const newKey = `${newX},${newY}`;
                
                // 跳过已关闭的节点
                if (closedList.has(newKey)) {
                    continue;
                }
                
                // 检查边界
                if (newX < 0 || newY < 0 || newX >= this.GRID_SIZE || newY >= this.GRID_SIZE) {
                    continue;
                }
                
                // 检查碰撞
                if (this.checkCollisionAtPosition(element, newPos, element.id)) {
                    continue;
                }
                
                // 计算g值
                const tentativeG = currentNode.g + 1;
                
                // 检查是否已在开放列表中
                let existingNode = null;
                let existingIndex = -1;
                for (let i = 0; i < openList.length; i++) {
                    if (openList[i].position.x === newX && openList[i].position.y === newY) {
                        existingNode = openList[i];
                        existingIndex = i;
                        break;
                    }
                }
                
                if (existingNode) {
                    // 如果新路径更好，更新节点
                    if (tentativeG < existingNode.g) {
                        existingNode.g = tentativeG;
                        existingNode.f = existingNode.g + existingNode.h;
                        existingNode.parent = currentNode;
                    }
                } else {
                    // 创建新节点
                    const newNode = {
                        position: newPos,
                        g: tentativeG,
                        h: this.calculateHeuristic(newPos, targetPos),
                        f: 0,
                        parent: currentNode
                    };
                    newNode.f = newNode.g + newNode.h;
                    openList.push(newNode);
                }
            }
        }
        
        console.log(`[A*] 未找到路径! 迭代次数: ${iterations}`);
        return [];
    }
    
    /**
     * 计算启发式函数（曼哈顿距离）
     * @param {Object} pos1 - 位置1
     * @param {Object} pos2 - 位置2
     * @returns {number} 距离
     */
    calculateHeuristic(pos1, pos2) {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    }
    
    /**
     * 重构路径
     * @param {Object} targetNode - 目标节点
     * @returns {Array} 路径数组
     */
    reconstructPath(targetNode) {
        const path = [];
        let current = targetNode;
        
        while (current) {
            path.unshift(current.position);
            current = current.parent;
        }
        
        // 移除起始位置
        path.shift();
        return path;
    }

    /**
     * BFS寻找最近可达位置
     * @param {Object} element - 方块元素
     * @param {Object} startPos - 起始位置
     * @param {Object} targetPos - 目标位置
     * @returns {Object} 最近可达位置
     */
    findNearestPositionBFS(element, startPos, targetPos) {
        console.log(`[BFS最近] 开始搜索: 从(${startPos.x},${startPos.y})到(${targetPos.x},${targetPos.y})`);
        
        const queue = [{position: startPos, distance: 0}];
        const visited = new Set();
        visited.add(`${startPos.x},${startPos.y}`);
        
        let bestPosition = startPos;
        let bestDistance = this.calculateHeuristic(startPos, targetPos);
        
        const directions = [
            {dx: 0, dy: -1}, // 上
            {dx: 0, dy: 1},  // 下
            {dx: -1, dy: 0}, // 左
            {dx: 1, dy: 0}   // 右
        ];
        
        const maxDepth = this.GRID_SIZE * 2;
        let iterations = 0;
        
        while (queue.length > 0 && iterations < maxDepth) {
            iterations++;
            const {position, distance} = queue.shift();
            
            // 检查是否更接近目标
            const currentDistance = this.calculateHeuristic(position, targetPos);
            if (currentDistance < bestDistance) {
                bestPosition = position;
                bestDistance = currentDistance;
            }
            
            // 如果已经到达目标，直接返回
            if (currentDistance === 0) {
                console.log(`[BFS最近] 找到目标位置! 迭代次数: ${iterations}`);
                return position;
            }
            
            // 检查深度限制
            if (distance >= maxDepth) {
                continue;
            }
            
            // 尝试四个方向
            for (const dir of directions) {
                const newX = position.x + dir.dx;
                const newY = position.y + dir.dy;
                const newPos = {x: newX, y: newY};
                const newKey = `${newX},${newY}`;
                
                // 跳过已访问的位置
                if (visited.has(newKey)) {
                    continue;
                }
                
                // 检查边界
                if (newX < 0 || newY < 0 || newX >= this.GRID_SIZE || newY >= this.GRID_SIZE) {
                    continue;
                }
                
                // 检查碰撞
                if (this.checkCollisionAtPosition(element, newPos, element.id)) {
                    continue;
                }
                
                // 标记为已访问
                visited.add(newKey);
                
                // 添加到队列
                queue.push({position: newPos, distance: distance + 1});
            }
        }
        
        console.log(`[BFS最近] 找到最近位置: (${bestPosition.x},${bestPosition.y}), 距离: ${bestDistance}, 迭代次数: ${iterations}`);
        return bestPosition;
    }

    /**
     * 执行移动动画（完整版）
     * @param {Object} element - 方块元素
     * @param {Array} path - 移动路径
     */
    executeMoveWithAnimation(element, path) {
        if (!element.blockElement || !element.blockElement.element) {
            // 如果没有blockElement，直接更新位置
            this.updateElementPosition(element, path[path.length - 1]);
            return;
        }

        // 检查是否已有动画在运行
        const animationId = `block_move_${element.id}`;
        if (this.animations.has(animationId)) {
            this.animations.get(animationId).kill();
        }

        const blockElement = element.blockElement.element;
        element.isMoving = true;

        // 创建动画时间线
        const walkTimeline = gsap.timeline({
            onComplete: () => {
                element.isMoving = false;
                this.checkLayerReveal(element);
                this.cleanupCache();
                this.animations.delete(animationId);
            }
        });

        this.animations.set(animationId, walkTimeline);

        // 按路径逐步移动
        path.forEach((step, index) => {
            const stepDuration = 0.6;
            const delay = index * stepDuration;

            // 更新逻辑位置
            walkTimeline.call(() => {
                this.updateElementPosition(element, {x: step.x, y: step.y});
            }, [], delay);

            // 更新渲染位置
                walkTimeline.to(blockElement, {
                    x: step.x * this.cellSize,
                    y: step.y * this.cellSize,
                    duration: stepDuration,
                ease: "power2.out"
                }, delay);
        });
    }


    /**
     * 网格坐标系统 - 将屏幕坐标转换为网格坐标
     * @param {number} screenX - 屏幕X坐标
     * @param {number} screenY - 屏幕Y坐标
     * @returns {Object} 网格坐标 {x, y}
     */
    screenToGrid(screenX, screenY) {
        const gridX = Math.floor((screenX - this.gridOffsetX) / this.cellSize);
        const gridY = Math.floor((screenY - this.gridOffsetY) / this.cellSize);
        return {x: gridX, y: gridY};
    }

    /**
     * 网格坐标转换为屏幕坐标
     * @param {number} gridX - 网格X坐标
     * @param {number} gridY - 网格Y坐标
     * @returns {Object} 屏幕坐标 {x, y}
     */
    gridToScreen(gridX, gridY) {
        const screenX = this.gridOffsetX + gridX * this.cellSize;
        const screenY = this.gridOffsetY + gridY * this.cellSize;
        return {x: screenX, y: screenY};
    }

    /**
     * 计算门占据的所有格子
     * @param {Object} gate - 门元素
     * @returns {Array<string>} 格子键数组
     */
    calculateGateCells(gate) {
        const cells = [];
        const size = gate.size || {width: 1, height: 1};

        for (let x = gate.position.x; x < gate.position.x + size.width; x++) {
            for (let y = gate.position.y; y < gate.position.y + size.height; y++) {
                cells.push(`${x},${y}`);
            }
        }

        return cells;
    }

    /**
     * 计算岩石占据的所有格子
     * @param {Object} rock - 岩石元素
     * @returns {Array<string>} 格子键数组
     */
    calculateRockCells(rock) {
        const cells = [];
        const size = rock.size || {width: 1, height: 1};

        for (let x = rock.position.x; x < rock.position.x + size.width; x++) {
            for (let y = rock.position.y; y < rock.position.y + size.height; y++) {
                cells.push(`${x},${y}`);
            }
        }

        return cells;
    }

    /**
     * 清理空间索引 - 移除所有非layer 0的元素
     */
    cleanupSpatialIndex() {
        console.log('开始清理空间索引...');
        let removedCount = 0;

        // 遍历空间索引，移除非layer 0的元素
        for (const [cellKey, elementIds] of this.spatialIndex.entries()) {
            const validElementIds = new Set();

            for (const elementId of elementIds) {
                const element = this.elementRegistry.get(elementId);
                if (element && element.layer === 0) {
                    validElementIds.add(elementId);
                } else {
                    removedCount++;
                    console.log(`移除非layer 0元素: ${elementId} (layer: ${element?.layer})`);
                }
            }

            if (validElementIds.size === 0) {
                this.spatialIndex.delete(cellKey);
            } else {
                this.spatialIndex.set(cellKey, validElementIds);
            }
        }

        console.log(`空间索引清理完成，移除了 ${removedCount} 个非layer 0元素`);
    }

    /**
     * 清理缓存 - 避免内存泄漏
     */
    cleanupCache() {
        // 清理碰撞检测缓存
        if (this.collisionCache.size > 1000) {
            this.collisionCache.clear();
            this.debugLog('清理碰撞检测缓存');
        }

        // 清理路径计算缓存
        if (this.pathCache.size > 1000) {
            this.pathCache.clear();
            this.debugLog('清理路径计算缓存');
        }
    }

    /**
     * 清除指定元素的路径缓存
     * @param {string} elementId - 元素ID
     */
    clearPathCacheForElement(elementId) {
        const keysToDelete = [];
        for (const key of this.pathCache.keys()) {
            if (key.includes(elementId)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.pathCache.delete(key));
        console.log(`[缓存] 清除元素 ${elementId} 的路径缓存，删除了 ${keysToDelete.length} 个缓存项`);
    }

    /**
     * 清除所有缓存 - 调试用
     */
    clearAllCache() {
        this.collisionCache.clear();
        this.pathCache.clear();
        console.log(`[缓存] 清除所有缓存`);
    }

    /**
     * 打印完整的网格状态 - 调试用
     */
    printGridState() {
        console.log('=== 完整网格状态 ===');
        console.log(`网格大小: ${this.GRID_SIZE}x${this.GRID_SIZE}`);

        for (let y = 0; y < this.GRID_SIZE; y++) {
            let row = '';
            for (let x = 0; x < this.GRID_SIZE; x++) {
                const cellKey = `${x},${y}`;
                const elementsAtCell = this.spatialIndex.get(cellKey);

                if (elementsAtCell && elementsAtCell.size > 0) {
                    const elementIds = Array.from(elementsAtCell);
                    row += `[${elementIds.join(',')}]`;
                } else {
                    row += '[空]';
                }
                row += ' ';
            }
            console.log(`第${y}行: ${row}`);
        }

        console.log('=== 元素详情 ===');
        this.elementRegistry.forEach((element, id) => {
            console.log(`元素 ${id}:`, {
                type: element.type,
                position: element.position,
                layer: element.layer,
                movable: element.movable,
                isMoving: element.isMoving,
                occupiedCells: element.type === 'tetris' ? this.calculateOccupiedCells(element.position, element.shapeData) : 'N/A'
            });
        });
        console.log('=== 网格状态结束 ===');
    }

    isWithinBounds(x, y) {
        return x >= 0 && x < this.GRID_SIZE && y >= 0 && y < this.GRID_SIZE;
    }


    /**
     * 检查位置是否在边界内（检查整个方块）
     * @param {Object} position - 位置 {x, y}
     * @param {Object} shapeData - 形状数据
     * @returns {boolean} 是否在边界内
     */
    isPositionWithinBounds(position, shapeData) {
        const occupiedCells = this.calculateOccupiedCells(position, shapeData);

        for (const cellKey of occupiedCells) {
            const [x, y] = cellKey.split(',').map(Number);
            if (!this.isWithinBounds(x, y)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 检查方块在指定位置是否会碰撞（只检测第0层）
     * @param {Object} element - 方块元素
     * @param {Object} position - 目标位置 {x, y}
     * @param {string} excludeId - 排除的元素ID（移动的方块）
     * @returns {boolean} 是否碰撞
     */
    checkCollisionAtPosition(element, position, excludeId) {
        if (element.type !== 'tetris') return false;

        // 使用缓存提高性能
        const cacheKey = `collision-${element.id}-${position.x}-${position.y}-${excludeId}`;
        if (this.collisionCache.has(cacheKey)) {
            return this.collisionCache.get(cacheKey);
        }

        // 首先检查整个方块是否在边界内
        if (!this.isPositionWithinBounds(position, element.shapeData)) {
            this.collisionCache.set(cacheKey, true);
            return true; // 超出边界
        }

        // 计算方块在目标位置占据的所有格子
        const occupiedCells = this.calculateOccupiedCells(position, element.shapeData);

        // 检查每个格子是否碰撞
        for (const cellKey of occupiedCells) {
            const elementsAtCell = this.spatialIndex.get(cellKey);

            if (elementsAtCell) {
                for (const elementId of elementsAtCell) {
                    if (elementId === excludeId) continue;

                    const otherElement = this.elementRegistry.get(elementId);

                    // 只检查第0层的方块和障碍物
                    if (otherElement && otherElement.layer === 0) {
                        // 使用智能碰撞检测替代简单的类型检查
                        const collisionResult = this.checkSmartCollision(element, otherElement);

                        if (collisionResult.collision) {
                            this.collisionCache.set(cacheKey, true);
                            return true;
                        } else if (collisionResult.action !== 'none') {
                            // 记录特殊动作（如融化冰块、通过门）
                            // 这些情况不阻止移动，但可能触发特殊效果
                        }
                    }
                }
            }
        }
        this.collisionCache.set(cacheKey, false);
        return false;
    }








    /**
     * 为单个元素更新空间索引（增强多层处理）
     * @param {Object} element - 元素对象
     * @param {Object} oldPosition - 旧位置
     * @param {Object} newPosition - 新位置
     */
    updateSpatialIndexForElement(element, oldPosition, newPosition) {
        // 只对layer 0的元素更新空间索引
        if (element.layer !== 0) {
            this.debugLog(`跳过非第0层元素的空间索引更新: ${element.id} (layer: ${element.layer})`);
            return;
        }

        // 移除旧位置的空间索引
        const oldCells = this.calculateOccupiedCells(oldPosition, element.shapeData);
        oldCells.forEach(cell => {
            const elementsAtCell = this.spatialIndex.get(cell);
            if (elementsAtCell) {
                elementsAtCell.delete(element.id);
                if (elementsAtCell.size === 0) {
                    this.spatialIndex.delete(cell);
                }
            }
        });

        // 添加新位置的空间索引
        const newCells = this.calculateOccupiedCells(newPosition, element.shapeData);
        newCells.forEach(cell => {
            if (!this.spatialIndex.has(cell)) {
                this.spatialIndex.set(cell, new Set());
            }
            this.spatialIndex.get(cell).add(element.id);
        });

        // 检查是否有隐藏层元素因为此次移动而需要显露
        this.checkForLayerReveal(oldCells.concat(newCells));
    }

    /**
     * 检查层级显露（新增 - 修复多层边缘情况）
     * @param {Array} affectedCells - 受影响的格子
     */
    checkForLayerReveal(affectedCells) {
        // 遍历所有下层元素，检查是否需要显露
        for (let layer = 1; layer < this.MAX_LAYERS; layer++) {
            const layerData = this.layers.get(layer);
            if (!layerData) continue;

            const elementsToReveal = [];

            layerData.elements.forEach(element => {
                if (element.type === 'tetris' && !element.movable) {
                    // 检查这个隐藏元素是否与空出来的格子重叠
                    const elementCells = this.calculateOccupiedCells(element.position, element.shapeData);

                    // 检查是否有任何格子与受影响的格子重叠（空出来的格子）
                    const hasOverlap = elementCells.some(cell => affectedCells.includes(cell));

                    if (hasOverlap) {
                        // 检查是否完全显露
                        if (this.isElementFullyRevealed(element, layer)) {
                            // 完全显露，冰块融化，方块变为可移动
                        elementsToReveal.push(element);
                        } else {
                            // 部分显露，显示冰块但不参与碰撞检测
                            this.showPartialIce(element, layer);
                        }
                    }
                }
            });

            // 显露所有完全暴露的元素
            elementsToReveal.forEach(element => {
                this.revealHiddenElement(element, layer);
            });
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

