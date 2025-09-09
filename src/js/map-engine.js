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
        this.currentLevel = 1; // 当前关卡

        // 性能优化缓存
        this.collisionCache = new Map(); // 碰撞检测缓存
        this.pathCache = new Map(); // 路径计算缓存
        this.cacheCleanupInterval = 10000; // 缓存清理间隔（毫秒）
        this.lastCacheCleanup = 0; // 上次清理时间
        
        // 元素类型碰撞规则配置（新增 - 修复元素类型区分问题）
        this.collisionRules = {
            'tetris': {
                canCollideWith: ['tetris', 'rock'],
                canPassThrough: ['gate'], // 同色门可以通过
                canMelt: ['ice'], // 可以融化冰块
                blocksMovement: true
            },
            'ice': {
                canCollideWith: ['tetris'],
                canPassThrough: [],
                canMelt: [],
                blocksMovement: false, // 冰块不阻止移动，会被融化
                canBeMelted: true
            },
            'rock': {
                canCollideWith: ['tetris'],
                canPassThrough: [],
                canMelt: [],
                blocksMovement: true,
                canBeMelted: false
            },
            'gate': {
                canCollideWith: ['tetris'],
                canPassThrough: [],
                canMelt: [],
                blocksMovement: true, // 默认阻止，除非颜色匹配
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
     * 加载地图数据
     * @param {Object} mapData - 地图配置数据
     */
    loadMap(mapData) {
        this.clearMap();
        
        // 设置当前关卡
        this.currentLevel = mapData.level || 1;

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
            type: 'tetris',
            color: block.color,
            position: block.position, // {x, y}
            shape: block.shape, // 原始形状数据
            shapeData: blockElement.shapeData, // 处理后的形状数据
            layer: block.layer || 0,
            movable: true,
            isMoving: false, // 初始化移动状态
            movingTo: null, // 初始化移动目标
            // occupiedCells 现在实时计算，不再缓存
            blockElement: blockElement, // 保存 block.js 创建的元素
            movementType: block.movementType, // 运动类型（feet, wings, crawl）
            wingConfig: block.wingConfig // 翅膀配置
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
            movable: false,
            // 添加 shapeData 属性，石块是单个格子
            shapeData: {
                blocks: [[0, 0]],
                width: 1,
                height: 1
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

        // 处理运动类型（如果是俄罗斯方块）
        if (element.type === 'tetris' && element.movementType && element.blockElement) {
            this.applyMovementType(element);
        }
    }

    /**
     * 应用运动类型到方块
     * @param {Object} element - 方块元素
     */
    applyMovementType(element) {
        if (!element.blockElement || !element.movementType) {
            return;
        }

        // 设置运动类型
        element.blockElement.movementType = element.movementType;

        // 根据运动类型应用相应的动画
        if (element.movementType === 'wings') {
            // 创建翅膀
            if (typeof createSimpleWings !== 'undefined') {
                createSimpleWings(element.blockElement);
            }
            // 开始飞行动画
            if (typeof startFlyingAnimation !== 'undefined') {
                startFlyingAnimation(element.blockElement);
            }
        } else if (element.movementType === 'feet') {
            // 创建腿
            if (typeof createSimpleFeet !== 'undefined') {
                createSimpleFeet(element.blockElement);
            }
            // 开始走路动画
            if (typeof startWalkingAnimation !== 'undefined') {
                startWalkingAnimation(element.blockElement);
            }
        } else if (element.movementType === 'crawl') {
            // 开始爬行动画
            if (typeof startCrawlingAnimation !== 'undefined') {
                startCrawlingAnimation(element.blockElement);
            }
        }

        console.log(`方块 ${element.id} 应用运动类型: ${element.movementType}`);
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
        const oldPosition = { ...element.position }; // 深拷贝防止引用问题
        
        // 验证新位置的有效性
        if (!this.isValidPosition(newPosition)) {
            this.debugLog(`无效位置更新请求: ${element.id} to (${newPosition.x},${newPosition.y})`);
            return false;
        }
        
        // 0. 清理相关缓存（确保数据一致性）
        this.clearCacheForElement(element.id, oldPosition);
        
        // 1. 更新逻辑位置（唯一数据源）
        element.position = { ...newPosition }; // 深拷贝防止意外修改
        
        // 2. 更新空间索引
        this.updateSpatialIndexForElement(element, oldPosition, newPosition);
        
        // 3. 更新层级数据的占用格子信息
        this.updateLayerOccupiedCells(element, oldPosition, newPosition);
        
        // 4. 更新渲染位置（如果存在）
        if (element.blockElement && element.blockElement.element) {
            element.blockElement.element.x = newPosition.x * this.CELL_SIZE;
            element.blockElement.element.y = newPosition.y * this.CELL_SIZE;
            
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
        return position && 
               typeof position.x === 'number' && 
               typeof position.y === 'number' &&
               position.x >= 0 && position.x < this.GRID_SIZE &&
               position.y >= 0 && position.y < this.GRID_SIZE;
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
        // 检查边界
        const maxX = Math.max(...element.shapeData.blocks.map(block => block[0]));
        const maxY = Math.max(...element.shapeData.blocks.map(block => block[1]));

        if (newPosition.x < 0 || newPosition.y < 0 || newPosition.x + maxX >= this.GRID_SIZE || newPosition.y + maxY >= this.GRID_SIZE) {
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

                // 只检查layer 0的元素
                if (element && element.layer === 0) {
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

        // 如果方块有 blockElement，使用 block.js 的移动动画
        if (element.blockElement && typeof moveBlock !== 'undefined') {
            moveBlock(element.blockElement, newPosition, () => {
                // 移动完成后的回调
                this.checkIceMelting();
                this.checkGateExit();
            });
        } else {
            // 否则直接检查
            this.checkIceMelting();
            this.checkGateExit();
        }

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
        // 检查方块是否在网格边缘，且与门的方向匹配（实时计算占据格子）
        const elementCells = this.calculateOccupiedCells(element.position, element.shapeData);

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

        // 如果方块有 blockElement，清理 block.js 的元素
        if (element.blockElement && typeof destroyBlock !== 'undefined') {
            destroyBlock(element.blockElement);
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
     * 检查指定位置是否被遮挡
     * @param {number} x - 网格X坐标
     * @param {number} y - 网格Y坐标
     * @param {number} layer - 层级
     * @returns {boolean} 是否被遮挡
     */
    isPositionCovered(x, y, layer) {
        const cellKey = `${x},${y}`;
        
        // 检查上层（layer-1）是否有遮挡
        for (let upperLayer = layer - 1; upperLayer >= 0; upperLayer--) {
            const upperLayerData = this.layers.get(upperLayer);
            if (!upperLayerData) continue;

            // 检查该位置是否有上层元素
            const elementsAtCell = this.spatialIndex.get(cellKey);
            if (elementsAtCell) {
                for (const elementId of elementsAtCell) {
                    const element = this.elementRegistry.get(elementId);
                    if (element && element.layer === upperLayer && element.type === 'tetris') {
                        return true; // 被遮挡
                    }
                }
            }
        }
        
        return false; // 没有被遮挡
    }

    /**
     * 显露隐藏的方块
     * @param {Object} hiddenElement - 隐藏的方块元素
     * @param {number} fromLayer - 原层级
     */
    revealHiddenElement(hiddenElement, fromLayer) {
        console.log(`显露隐藏方块: ${hiddenElement.id} 从第${fromLayer}层移动到第0层`);
        
        // 将方块移动到第0层
        hiddenElement.layer = 0;
        hiddenElement.movable = true;
        
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
            alpha: 0,
            scale: 0.5
        });
        
        // 显露动画：淡入并放大
        revealAnimation.to(blockElement, {
            alpha: 1,
            scale: 1,
            duration: 0.8,
            ease: "back.out(1.7)"
        });
        
        // 添加闪烁效果
        revealAnimation.to(blockElement, {
            alpha: 0.7,
            duration: 0.1,
            yoyo: true,
            repeat: 3,
            ease: "power2.inOut"
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
            return { collision: false, action: 'none', reason: 'no_elements' };
        }

        const movingRules = this.collisionRules[movingElement.type] || {};
        const targetRules = this.collisionRules[targetElement.type] || {};

        // 检查冰块融化
        if (targetElement.type === 'ice' && movingRules.canMelt && movingRules.canMelt.includes('ice')) {
            return { collision: false, action: 'melt_ice', reason: 'ice_melted' };
        }

        // 检查门的通过逻辑
        if (targetElement.type === 'gate') {
            if (targetRules.requiresColorMatch) {
                // 检查颜色匹配
                if (movingElement.color === targetElement.color) {
                    return { collision: false, action: 'pass_through_gate', reason: 'color_match' };
                } else {
                    return { collision: true, action: 'block', reason: 'color_mismatch' };
                }
            }
        }

        // 检查普通碰撞
        if (movingRules.canCollideWith && movingRules.canCollideWith.includes(targetElement.type)) {
            if (targetRules.blocksMovement) {
                return { collision: true, action: 'block', reason: 'normal_collision' };
            }
        }

        // 默认无碰撞
        return { collision: false, action: 'none', reason: 'no_collision' };
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

            // 注册Physics2D插件
            if (gsap.registerPlugin && typeof Physics2DPlugin !== 'undefined') {
                gsap.registerPlugin(Physics2DPlugin);
                console.log('Physics2D插件已注册');
            }

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

            // 网格呼吸动画 - 只在有交互时运行
            this.gridAnimation = gsap.to(this.animationTargets.grid, {
                scale: 1.03,
                alpha: 0.85,
                glow: 0.3,
                duration: 2.8,
                ease: "power2.inOut",
                repeat: -1,
                yoyo: true,
                paused: true // 默认暂停，只在需要时启动
            });

            // 脉冲动画 - 只在有交互时运行
            this.pulseAnimation = gsap.to(this.animationTargets.pulse, {
                scale: 1.12,
                alpha: 0.7,
                rotation: 1,
                duration: 2.2,
                ease: "elastic.out(1, 0.4)",
                repeat: -1,
                yoyo: true,
                paused: true // 默认暂停，只在需要时启动
            });

            // 方块动画 - 静态，不运行
            this.blockAnimation = gsap.to(this.animationTargets.blocks, {
                scale: 1, rotation: 0, bounce: 0, duration: 0, ease: "none", repeat: 0, yoyo: false, paused: true // 完全暂停
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
                shimmer: 0, glow: 0, crack: 0, scale: 1, duration: 0, ease: "none", repeat: 0, yoyo: false, paused: true
            });

            // 创建时间轴动画 - 静态，不运行
            this.masterTimeline = gsap.timeline({repeat: 0, paused: true});
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
            grid: {scale: 1, alpha: 1, glow: 0},
            pulse: {scale: 1, alpha: 1, rotation: 0},
            blocks: {scale: 1, alpha: 1, bounce: 0},
            gates: {scale: 1, alpha: 1, glow: 0},
            ice: {scale: 1, alpha: 1, glow: 0, shimmer: 0, crack: 0}
        };

        this.gridAnimation = {
            progress: () => Math.sin(Date.now() * 0.001) * 0.5 + 0.5, targets: () => [this.animationTargets.grid]
        };
        this.pulseAnimation = {
            progress: () => Math.sin(Date.now() * 0.002) * 0.5 + 0.5, targets: () => [this.animationTargets.pulse]
        };
        this.blockAnimation = {
            progress: () => Math.sin(Date.now() * 0.0015) * 0.5 + 0.5, targets: () => [this.animationTargets.blocks]
        };
        this.gateAnimation = {
            progress: () => Math.sin(Date.now() * 0.003) * 0.5 + 0.5, targets: () => [this.animationTargets.gates]
        };
        this.iceAnimation = {
            progress: () => Math.sin(Date.now() * 0.002) * 0.5 + 0.5, targets: () => [this.animationTargets.ice]
        };
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
                duration: 1, scale: 1.1, ease: "power2.inOut", repeat: -1, yoyo: true, onComplete: () => {
                    this.animations.delete(animationId);
                }
            });

            this.animations.set(animationId, pulseAnimation);
        } catch (error) {
            console.warn(`门 ${gate.id} 脉冲动画创建失败:`, error);
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
        ctx.translate(this.gridOffsetX + this.gridSize / 2, this.gridOffsetY + this.gridSize / 2);
        ctx.scale(gridScale, gridScale);
        ctx.translate(-this.gridSize / 2, -this.gridSize / 2);
        ctx.fillRect(0, 0, this.gridSize, this.gridSize);
        ctx.restore();

        // 绘制加粗的外边框 - 非门部分用黑色，门部分用对应颜色
        const borderWidth = Math.max(6, this.cellSize * 0.15); // 边框宽度与格子大小成比例
        const borderAlpha = 0.9 + (pulseAlpha - 1) * 0.2 + pulseRotation * 0.1;

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

        // 绘制完整的正方形边框，包含四个角
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
        const blocks = this.getAllElementsByType('tetris');

        blocks.forEach(block => {
            // 如果方块有 blockElement，使用 creature.js 的绘制函数
            if (block.blockElement && typeof drawCreature !== 'undefined') {
                // 确保 blockElement 的位置与逻辑位置同步（使用统一的位置更新）
                if (block.blockElement.element) {
                    block.blockElement.element.x = block.position.x * this.cellSize;
                    block.blockElement.element.y = block.position.y * this.cellSize;
                }

                // 同步 creature 的 row 和 col
                if (block.blockElement.row !== undefined) {
                    block.blockElement.row = block.position.y;
                }
                if (block.blockElement.col !== undefined) {
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

        // 根据形状的每个块分别绘制 - 实时计算占据格子
        const drawOccupiedCells = this.calculateOccupiedCells(block.position, block.shapeData);
        
        if (drawOccupiedCells.length === 0) {
            console.warn(`方块 ${block.id} 没有有效的格子坐标，跳过绘制`);
            return;
        }

        // 安全地解析坐标
        const cells = drawOccupiedCells.map(cellKey => {
            if (typeof cellKey !== 'string' || !cellKey.includes(',')) {
                console.warn(`无效的 cellKey 格式: ${cellKey}`);
                return [0, 0]; // 返回默认坐标
            }
            return cellKey.split(',').map(Number);
        }).filter(cell => !isNaN(cell[0]) && !isNaN(cell[1])); // 过滤掉无效坐标

        if (cells.length === 0) {
            console.warn(`方块 ${block.id} 没有有效的格子坐标，跳过绘制`);
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
            console.warn(`方块 ${block.id} 尺寸异常:`, {blockWidth, blockHeight, cellSize: this.cellSize});
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
        const debugOccupiedCells = this.calculateOccupiedCells(block.position, block.shapeData);
        if (debugOccupiedCells.length > 0) {
            const firstCell = debugOccupiedCells[0].split(',').map(Number);
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
            console.log(`尝试移动方块 ${this.selectedElement.id} 到位置 (${gridPos.x}, ${gridPos.y})`);
            this.moveElementToPosition(this.selectedElement.id, gridPos);
        }
    }

    /**
     * 移动元素到指定位置
     * @param {string} elementId - 元素ID
     * @param {Object} targetPosition - 目标位置 {x, y}
     */
    moveElementToPosition(elementId, targetPosition) {
        // 强制清理所有缓存以确保最新计算结果
        this.collisionCache.clear();
        this.pathCache.clear();
        
        const element = this.elementRegistry.get(elementId);
        if (!element) {
            console.warn(`元素 ${elementId} 不存在`);
            return;
        }

        const startPosition = {...element.position};
        
        // 使用BFS计算移动路径
        const path = this.calculateStepPath(startPosition, targetPosition, element);
        
        if (path.length === 0) {
            this.debugLog(`方块 ${elementId} 无法到达目标位置 (${targetPosition.x},${targetPosition.y})`);
            // 添加详细的诊断信息
            this.debugLog(`起始位置: (${startPosition.x},${startPosition.y})`);
            this.debugLog(`目标位置碰撞检测:`, this.checkCollisionAtPosition(element, targetPosition, element.id));
            this.debugLog(`当前方块信息:`, {
                id: element.id,
                position: element.position,
                shapeData: element.shapeData,
                movable: element.movable,
                isMoving: element.isMoving
            });
            return;
        }

        this.debugLog(`方块 ${elementId} 移动路径:`, {
            from: startPosition,
            to: targetPosition,
            path: path,
            pathLength: path.length
        });

        // 执行移动动画
        this.animateBlockMove(element, startPosition, targetPosition, path);
    }

    /**
     * 动画移动方块（使用BFS计算的路径）
     * @param {Object} element - 方块元素
     * @param {Object} fromPosition - 起始位置
     * @param {Object} toPosition - 目标位置
     * @param {Array} path - BFS计算的路径
     */
    animateBlockMove(element, fromPosition, toPosition, path) {
        if (!element.blockElement || !element.blockElement.element) {
            // 如果没有 blockElement，直接更新位置
            this.executeMove(element, toPosition);
            return;
        }

        // 检查是否已有动画在运行，如果有则停止
        const animationId = `block_move_${element.id}`;
        if (this.animations.has(animationId)) {
            console.log(`停止方块 ${element.id} 的旧动画`);
            const oldAnimation = this.animations.get(animationId);
            if (oldAnimation && oldAnimation.kill) {
                oldAnimation.kill();
            }
            this.animations.delete(animationId);
        }

        const blockElement = element.blockElement.element;

        // 开始移动动画 - 根据形状类型选择不同的移动方式
        if (typeof standUpAndExtendLimbs === 'function') {
            standUpAndExtendLimbs(element.blockElement);
        }

        this.debugLog(`方块 ${element.id} 使用BFS路径移动:`, {
            from: fromPosition,
            to: toPosition,
            path: path,
            pathLength: path.length
        });

        if (path.length === 0) {
            // 没有有效路径，直接收起脚
            this.debugLog(`方块 ${element.id} 没有有效路径`);
            if (typeof sitDownAndHideLimbs === 'function') {
                sitDownAndHideLimbs(element.blockElement);
            }
            return;
        }

        // 创建走路时间线
        const walkTimeline = gsap.timeline({
            onComplete: () => {
                // 使用新的统一方法确保最终位置同步
                this.updateElementPosition(element, toPosition);

                // 清除移动状态
                element.isMoving = false;
                element.movingTo = null;

                // 检查是否有下层方块显露
                this.checkLayerReveal(element);
                
                // 清理缓存
                this.cleanupCache();
                
                // 打印移动后的网格状态
                this.debugLog(`方块 ${element.id} 移动完成后的网格状态:`);
                this.printGridState();

                // 收起脚
                if (typeof sitDownAndHideLimbs === 'function') {
                    sitDownAndHideLimbs(element.blockElement);
                }

                // 清理动画
                this.animations.delete(animationId);

                this.debugLog(`方块 ${element.id} 移动动画完成，最终位置: (${toPosition.x},${toPosition.y})`);
            }
        });

        // 标记方块为移动状态
        element.isMoving = true;
        element.movingTo = toPosition;

        // 注册动画
        this.animations.set(animationId, walkTimeline);

        // 按照BFS路径一格一格移动
        path.forEach((step, index) => {
            const stepDuration = 0.6; // 每步持续时间
            const delay = index * stepDuration;

            // 更新逻辑位置（使用新的统一方法）
            walkTimeline.call(() => {
                this.updateElementPosition(element, {x: step.x, y: step.y});
                this.debugLog(`方块 ${element.id} 移动到步骤: (${step.x},${step.y})`);
            }, [], delay);

            // 使用更自然的缓动函数和物理效果
            if (typeof Physics2DPlugin !== 'undefined' && Physics2DPlugin) {
                // 使用Physics2D插件创建更自然的移动效果
                walkTimeline.to(blockElement, {
                    x: step.x * this.cellSize,
                    y: step.y * this.cellSize,
                    duration: stepDuration,
                    ease: "power2.out",
                    physics2D: {
                        velocity: 200 + Math.random() * 100, // 随机速度变化
                        angle: 0, gravity: 0, friction: 0.8, bounce: 0.1 // 轻微弹跳
                    }
                }, delay);
            } else {
                // 降级到普通动画，但使用更自然的缓动
                walkTimeline.to(blockElement, {
                    x: step.x * this.cellSize,
                    y: step.y * this.cellSize,
                    duration: stepDuration,
                    ease: "elastic.out(1, 0.6)" // 弹性缓动，更生动
                }, delay);
            }

            // 添加更丰富的身体动画
            walkTimeline.to(blockElement, {
                rotation: "+=5deg", // 增加旋转角度
                duration: stepDuration * 0.4, ease: "power2.inOut", yoyo: true, repeat: 1
            }, delay);

            // 添加轻微的缩放效果（呼吸感）
            walkTimeline.to(blockElement, {
                scale: 1.05, duration: stepDuration * 0.2, ease: "power2.out", yoyo: true, repeat: 1
            }, delay);

            // 添加垂直弹跳效果
            walkTimeline.to(blockElement, {
                y: step.y * this.cellSize - 3, // 轻微向上
                duration: stepDuration * 0.3, ease: "power2.out", yoyo: true, repeat: 1
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
        return { x: gridX, y: gridY };
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
        return { x: screenX, y: screenY };
    }

    /**
     * 计算门占据的所有格子
     * @param {Object} gate - 门元素
     * @returns {Array<string>} 格子键数组
     */
    calculateGateCells(gate) {
        const cells = [];
        const size = gate.size || { width: 1, height: 1 };
        
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
        const size = rock.size || { width: 1, height: 1 };
        
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
                            this.debugLog(`碰撞检测: ${collisionResult.reason} - ${element.id} vs ${otherElement.id}`);
                            this.collisionCache.set(cacheKey, true);
                            return true;
                        } else if (collisionResult.action !== 'none') {
                            // 记录特殊动作（如融化冰块、通过门）
                            this.debugLog(`特殊动作: ${collisionResult.action} - ${collisionResult.reason}`);
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
     * BFS路径计算 - 计算从起始位置到目标位置的最短路径
     * @param {Object} element - 方块元素
     * @param {Object} startPos - 起始位置 {x, y}
     * @param {Object} targetPos - 目标位置 {x, y}
     * @returns {Array} 路径数组，如果不可达返回空数组
     */
    calculateBFSPath(element, startPos, targetPos) {
        // 如果起始位置就是目标位置
        if (startPos.x === targetPos.x && startPos.y === targetPos.y) {
            return [];
        }

        // 使用路径缓存优化性能
        const pathCacheKey = `path-${element.id}-${startPos.x}-${startPos.y}-${targetPos.x}-${targetPos.y}`;
        if (this.pathCache.has(pathCacheKey)) {
            return this.pathCache.get(pathCacheKey);
        }

        // 注释掉过于激进的快速检查，因为目标位置可能通过移动其他方块变得可达
        // if (this.checkCollisionAtPosition(element, targetPos, element.id)) {
        //     this.pathCache.set(pathCacheKey, []);
        //     return [];
        // }

        // BFS队列：存储 {position, path}
        const queue = [{ position: startPos, path: [] }];
        const visited = new Set();
        visited.add(`${startPos.x},${startPos.y}`);

        // 八个方向：上下左右 + 四个对角线方向
        const directions = [
            { dx: 0, dy: -1 }, // 上
            { dx: 0, dy: 1 },  // 下
            { dx: -1, dy: 0 }, // 左
            { dx: 1, dy: 0 },  // 右
            { dx: -1, dy: -1 }, // 左上
            { dx: 1, dy: -1 },  // 右上
            { dx: -1, dy: 1 },  // 左下
            { dx: 1, dy: 1 }    // 右下
        ];

        // 限制搜索深度，避免无限搜索（增加深度限制以应对复杂路径）
        const maxDepth = this.GRID_SIZE * 3; // 从 *2 增加到 *3
        let currentDepth = 0;

        while (queue.length > 0) {
            const { position, path } = queue.shift();
            const currentPathLength = path.length;

            // 检查路径长度限制
            if (currentPathLength >= maxDepth) {
                continue;
            }

            this.debugLog(`BFS: 处理位置 (${position.x},${position.y}), 路径长度: ${currentPathLength}, 队列剩余: ${queue.length}`);

            // 尝试四个方向
            for (const dir of directions) {
                const newX = position.x + dir.dx;
                const newY = position.y + dir.dy;
                const newPos = { x: newX, y: newY };
                const newPosKey = `${newX},${newY}`;

                // 如果已经访问过，跳过
                if (visited.has(newPosKey)) {
                    continue;
                }

                // 检查新位置是否有效（检查整个方块的边界）
                if (!this.isPositionWithinBounds(newPos, element.shapeData)) {
                    continue;
                }

                // 检查是否碰撞
                if (this.checkCollisionAtPosition(element, newPos, element.id)) {
                    this.debugLog(`BFS: 位置(${newX},${newY})有碰撞，跳过`);
                    continue;
                }

                // 只有通过所有检查后才标记为已访问
                visited.add(newPosKey);

                // 创建新路径
                const newPath = [...path, newPos];

                // 如果到达目标位置
                if (newX === targetPos.x && newY === targetPos.y) {
                    this.pathCache.set(pathCacheKey, newPath);
                    return newPath;
                }

                // 添加到队列
                this.debugLog(`BFS: 添加位置(${newX},${newY})到队列，路径长度: ${newPath.length}`);
                queue.push({ position: newPos, path: newPath });
            }
        }

        // 没有找到路径
        this.debugLog(`BFS搜索失败: 从(${startPos.x},${startPos.y})到(${targetPos.x},${targetPos.y}), 最大深度: ${maxDepth}, 已访问位置数: ${visited.size}`);
        
        // 尝试使用改进的搜索策略
        this.debugLog(`尝试使用改进的搜索策略...`);
        const improvedPath = this.calculateImprovedPath(element, startPos, targetPos);
        if (improvedPath.length > 0) {
            this.pathCache.set(pathCacheKey, improvedPath);
            return improvedPath;
        }
        
        this.pathCache.set(pathCacheKey, []);
        return [];
    }

    /**
     * 改进的路径搜索策略
     * 当BFS失败时，尝试更智能的搜索方法
     * @param {Object} element - 方块元素
     * @param {Object} startPos - 起始位置
     * @param {Object} targetPos - 目标位置
     * @returns {Array} 路径数组
     */
    calculateImprovedPath(element, startPos, targetPos) {
        this.debugLog(`改进搜索: 从(${startPos.x},${startPos.y})到(${targetPos.x},${targetPos.y})`);
        
        // 策略1: 尝试直接路径（忽略中间障碍物）
        const directPath = this.calculateDirectPath(element, startPos, targetPos);
        if (directPath.length > 0) {
            this.debugLog(`直接路径成功: ${directPath.length} 步`);
            return directPath;
        }
        
        // 策略2: 尝试绕行路径（优先选择远离障碍物的方向）
        const detourPath = this.calculateDetourPath(element, startPos, targetPos);
        if (detourPath.length > 0) {
            this.debugLog(`绕行路径成功: ${detourPath.length} 步`);
            return detourPath;
        }
        
        // 策略3: 寻找最近的可达位置
        const nearestPos = this.findNearestReachablePosition(element, startPos, targetPos);
        if (nearestPos.x !== startPos.x || nearestPos.y !== startPos.y) {
            this.debugLog(`找到最近可达位置: (${nearestPos.x},${nearestPos.y})`);
            return this.calculateBFSPath(element, startPos, nearestPos);
        }
        
        this.debugLog(`改进搜索失败: 无法找到任何路径`);
        return [];
    }

    /**
     * 计算直接路径（直线移动）
     * @param {Object} element - 方块元素
     * @param {Object} startPos - 起始位置
     * @param {Object} targetPos - 目标位置
     * @returns {Array} 路径数组
     */
    calculateDirectPath(element, startPos, targetPos) {
        const path = [];
        let currentPos = { ...startPos };
        
        // 计算移动方向
        const dx = targetPos.x - startPos.x;
        const dy = targetPos.y - startPos.y;
        
        // 如果目标位置就是起始位置
        if (dx === 0 && dy === 0) {
            return [];
        }
        
        // 尝试直线移动
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
        
        for (let i = 0; i < steps; i++) {
            currentPos.x += stepX;
            currentPos.y += stepY;
            
            // 检查是否碰撞
            if (this.checkCollisionAtPosition(element, currentPos, element.id)) {
                this.debugLog(`直接路径在位置 (${currentPos.x},${currentPos.y}) 遇到碰撞`);
                return [];
            }
            
            path.push({ ...currentPos });
        }
        
        return path;
    }

    /**
     * 计算绕行路径（优先选择远离障碍物的方向）
     * @param {Object} element - 方块元素
     * @param {Object} startPos - 起始位置
     * @param {Object} targetPos - 目标位置
     * @returns {Array} 路径数组
     */
    calculateDetourPath(element, startPos, targetPos) {
        // 使用优先级队列，优先选择距离目标更近且障碍物更少的方向
        const queue = [{ position: startPos, path: [], priority: 0 }];
        const visited = new Set();
        visited.add(`${startPos.x},${startPos.y}`);
        
        const directions = [
            { dx: 0, dy: -1, name: '上' },
            { dx: 0, dy: 1, name: '下' },
            { dx: -1, dy: 0, name: '左' },
            { dx: 1, dy: 0, name: '右' },
            { dx: -1, dy: -1, name: '左上' },
            { dx: 1, dy: -1, name: '右上' },
            { dx: -1, dy: 1, name: '左下' },
            { dx: 1, dy: 1, name: '右下' }
        ];
        
        while (queue.length > 0) {
            // 按优先级排序（优先级越低越优先）
            queue.sort((a, b) => a.priority - b.priority);
            const { position, path } = queue.shift();
            
            if (path.length >= 10) { // 限制绕行路径长度
                continue;
            }
            
            // 尝试四个方向
            for (const dir of directions) {
                const newX = position.x + dir.dx;
                const newY = position.y + dir.dy;
                const newPos = { x: newX, y: newY };
                const newPosKey = `${newX},${newY}`;
                
                if (visited.has(newPosKey)) {
                    continue;
                }
                
                // 检查边界
                if (!this.isPositionWithinBounds(newPos, element.shapeData)) {
                    continue;
                }
                
                // 检查碰撞
                if (this.checkCollisionAtPosition(element, newPos, element.id)) {
                    continue;
                }
                
                visited.add(newPosKey);
                
                // 计算优先级（距离目标的曼哈顿距离）
                const distanceToTarget = Math.abs(newX - targetPos.x) + Math.abs(newY - targetPos.y);
                const newPath = [...path, newPos];
                
                // 如果到达目标
                if (newX === targetPos.x && newY === targetPos.y) {
                    this.debugLog(`绕行路径成功: ${newPath.length} 步`);
                    return newPath;
                }
                
                queue.push({ position: newPos, path: newPath, priority: distanceToTarget });
            }
        }
        
        return [];
    }

    /**
     * 寻找距离目标最近的可达位置
     * @param {Object} element - 方块元素
     * @param {Object} startPos - 起始位置
     * @param {Object} targetPos - 目标位置
     * @returns {Object} 最近的可达位置
     */
    findNearestReachablePosition(element, startPos, targetPos) {
        this.debugLog(`寻找最近可达位置: 从(${startPos.x},${startPos.y})到(${targetPos.x},${targetPos.y})`);
        
        // 使用BFS寻找最近的可达位置
        const queue = [{ position: startPos, distance: 0 }];
        const visited = new Set();
        visited.add(`${startPos.x},${startPos.y}`);

        let bestPosition = startPos;
        let bestDistance = Math.abs(startPos.x - targetPos.x) + Math.abs(startPos.y - targetPos.y);

        const directions = [
            // 四个基本方向
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            // 四个对角线方向
            { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
        ];

        while (queue.length > 0) {
            const { position, distance } = queue.shift();

            // 限制搜索深度，避免无限搜索
            if (distance > 5) {
                continue;
            }

            for (const dir of directions) {
                const newX = position.x + dir.dx;
                const newY = position.y + dir.dy;
                const newPos = { x: newX, y: newY };
                const newPosKey = `${newX},${newY}`;

                if (visited.has(newPosKey)) {
                    continue;
                }

                // 检查新位置是否有效（检查整个方块的边界）
                if (!this.isPositionWithinBounds(newPos, element.shapeData)) {
                    continue;
                }

                visited.add(newPosKey);

                // 检查是否可达
                if (!this.checkCollisionAtPosition(element, newPos, element.id)) {
                    // 计算到目标的距离
                    const distanceToTarget = Math.abs(newX - targetPos.x) + Math.abs(newY - targetPos.y);
                    
                    // 如果这个位置比当前最佳位置更接近目标，更新最佳位置
                    if (distanceToTarget < bestDistance) {
                        bestPosition = newPos;
                        bestDistance = distanceToTarget;
                        this.debugLog(`找到更好的位置: (${newX},${newY}), 距离目标: ${distanceToTarget}`);
                    }
                }

                queue.push({ position: newPos, distance: distance + 1 });
            }
        }

        this.debugLog(`最近可达位置: (${bestPosition.x},${bestPosition.y}), 距离目标: ${bestDistance}`);
        return bestPosition;
    }

    /**
     * 计算移动路径（使用BFS算法）
     * @param {Object} fromPosition - 起始位置
     * @param {Object} toPosition - 目标位置
     * @param {Object} element - 方块元素
     * @returns {Array} 路径数组
     */
    calculateStepPath(fromPosition, toPosition, element) {
        // 使用BFS计算最短路径
        const path = this.calculateBFSPath(element, fromPosition, toPosition);
        
        if (path.length === 0) {
            this.debugLog(`calculateStepPath: BFS失败，尝试改进的搜索策略...`);
            // 使用改进的搜索策略
            const improvedPath = this.calculateImprovedPath(element, fromPosition, toPosition);
            if (improvedPath.length > 0) {
                this.debugLog(`calculateStepPath: 改进搜索成功，找到 ${improvedPath.length} 步路径`);
                return improvedPath;
            }
            
            // 如果改进搜索也失败，寻找最近的可达位置
            this.debugLog(`calculateStepPath: 改进搜索失败，寻找最近可达位置...`);
            const nearestPos = this.findNearestReachablePosition(element, fromPosition, toPosition);
            
            // 防止无限循环：检查找到的位置是否与起始位置不同
            if (nearestPos.x !== fromPosition.x || nearestPos.y !== fromPosition.y) {
                this.debugLog(`calculateStepPath: 找到最近可达位置 (${nearestPos.x},${nearestPos.y})`);
                // 再次检查这个位置是否真的可达
                const nearestPath = this.calculateBFSPath(element, fromPosition, nearestPos);
                if (nearestPath.length > 0) {
                    this.debugLog(`calculateStepPath: 成功找到到最近位置的路径，长度: ${nearestPath.length}`);
                    return nearestPath;
                } else {
                    this.debugLog(`calculateStepPath: 到最近位置的路径也不可达，放弃移动`);
                }
            } else {
                this.debugLog(`calculateStepPath: 最近可达位置就是起始位置，无法移动`);
            }
            
            // 如果所有方法都失败，返回空路径
            this.debugLog(`calculateStepPath: 所有搜索策略都失败，无法移动`);
            return [];
        }
        
        return path;
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
                    // 检查这个隐藏元素是否完全显露
                    const elementCells = this.calculateOccupiedCells(element.position, element.shapeData);
                    
                    // 检查是否有任何格子与受影响的格子重叠
                    const hasOverlap = elementCells.some(cell => affectedCells.includes(cell));
                    
                    if (hasOverlap && this.isElementFullyRevealed(element, layer)) {
                        elementsToReveal.push(element);
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
