/**
 * 多层方块 Puzzle 游戏引擎 - 模块化版
 * 核心特性：8*8网格 + 多层结构 + 智能路径规划 + 颜色通关
 */

// CommonJS 导入依赖
const {CollisionDetector} = require('./collision.js');
const {MovementManager} = require('./movement.js');
const {Block, BLOCK_COLORS, BLOCK_TYPES} = require('./block.js');
const {GAME_CONFIG, ConfigUtils} = require('./config.js');

class MapEngine {
    constructor(canvas, ctx, systemInfo) {
        // 基础配置
        this.GRID_SIZE = ConfigUtils.getGridSize();
        this.MAX_LAYERS = 10;

        // 棋盘矩阵系统（整合自BoardSystem）
        this.boardMatrix = null;
        this.boardWidth = 0;
        this.boardHeight = 0;

        // 核心数据结构
        this.grid = null; // 将在加载地图时初始化
        this.blocks = new Map(); // blockId -> Block
        this.gates = new Map(); // gateId -> Gate
        this.rocks = new Set(); // rock positions

        // 游戏状态
        this.gameState = 'ready';
        this.selectedBlock = null;
        this.currentLevel = 1;
        this.lastMoveTime = 0; // 🔧 移动时间限制
        this.lastAStarTime = 0; // 🔧 A*算法调用时间限制
        this.cachedOptimalPosition = null; // 🔧 缓存的最优位置
        this.cachedTargetPosition = null; // 🔧 缓存的目标位置

        // 渲染相关
        this.ctx = null;
        this.systemInfo = null;
        this.cellSize = ConfigUtils.getFixedCellSize(); // 使用统一配置
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;

        // 模块 - 将在加载地图时初始化
        this.collisionDetector = null;
        this.movementManager = null;

        // 动画管理
        this.animations = new Map();

        // 拖动状态
        this.isDragging = false;
        this.dragStartPos = null;
        this.dragStartScreenPos = null;

        // 道具系统
        this.items = {
            colorChanger: {count: 3, name: '颜色转换剂', icon: '🎨'},
            bomb: {count: 2, name: '炸弹', icon: '💣'},
            rocket: {count: 1, name: '火箭', icon: '🚀'}
        };
        this.selectedItem = null;

        // 如果提供了参数，立即设置渲染上下文
        if (ctx && systemInfo) {
            this.setRenderContext(ctx, systemInfo);
        }
        this.init();
    }

    /**
     * 初始化地图引擎
     */
    init() {
        console.log('MapEngine 初始化完成');
    }

    /**
     * 加载地图数据
     */
    loadMap(mapData) {
        this.clearMap();
        this.currentLevel = mapData.level || 1;

        // 优先加载棋盘矩阵系统
        if (mapData.boardMatrix) {
            this.loadBoardFromMatrix(mapData.boardMatrix);
        } else {
            console.error('loadMap: 缺少 boardMatrix 数据，无法加载地图。');
            return;
        }

        // 加载方块
        if (mapData.tetrisBlocks) {
            mapData.tetrisBlocks.forEach(block => this.addBlock(block));
        }

        // 加载石块
        if (mapData.rocks) {
            mapData.rocks.forEach(rock => this.addRock(rock));
        }

        this.gameState = 'ready';
        console.log('地图加载完成:', mapData.name);
        return true;
    }

    /**
     * 清空地图
     */
    clearMap() {
        if (this.grid) {
            this.grid.forEach(row => row.fill(null));
        }
        this.blocks.clear();
        this.gates.clear();
        this.rocks.clear();
        this.selectedBlock = null;
        this.animations.clear();
    }


    /**
     * 添加方块
     */
    addBlock(block) {
        if (typeof Block === 'undefined') {
            console.error('Block 类未找到');
            return;
        }

        // 直接使用 Block 类，移除双重数据结构
        const blockInstance = new Block(block.id, block.blockType, // 只使用 blockType，不再支持 shape
            block.color, block.position, block.layer || 0, {
                isIce: block.isIce || false, alpha: block.alpha || 1, scale: block.scale || 1
            });

        if (!blockInstance) {
            console.error('方块创建失败:', block);
            return;
        }

        // 直接存储 Block 实例，不再包装
        this.blocks.set(blockInstance.id, blockInstance);
        this.updateGrid();
    }

    /**
     * 添加石块
     */
    addRock(rock) {
        const rockKey = `${rock.position.x},${rock.position.y}`;
        this.rocks.add(rockKey);
        this.updateGrid();
    }

    /**
     * 按层级获取方块
     */
    getBlocksByLayer(layer) {
        return Array.from(this.blocks.values()).filter(block => block.layer === layer);
    }

    /**
     * 获取所有下层方块（layer > 0）
     */
    getLowerLayerBlocks() {
        return Array.from(this.blocks.values()).filter(block => block.layer > 0);
    }

    /**
     * 更新网格数据
     */
    updateGrid() {
        // 清空网格
        if (this.grid) {
            this.grid.forEach(row => row.fill(null));
        }

        // 按层级顺序填充网格（第0层优先显示）
        for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
            const layerBlocks = this.getBlocksByLayer(layer);

            if (layerBlocks.length > 0) {
                // 添加方块
                layerBlocks.forEach(block => {
                    const cells = this.collisionDetector.getBlockCells(block);
                    cells.forEach(cell => {
                        // 检查位置是否在有效范围内（不检查boardMatrix值，因为方块可以移动到门的位置）
                        if (cell.x >= 0 && cell.x < this.boardWidth && cell.y >= 0 && cell.y < this.boardHeight) {
                            // 第0层方块优先显示，第1层及以下只在空白位置填充
                            if (layer === 0 || this.grid[cell.y][cell.x] === null) {
                                this.grid[cell.y][cell.x] = block.id;
                            }
                        }
                    });
                });
            }

            // 添加石块（只在第0层）
            if (layer === 0) {
                this.rocks.forEach(rockKey => {
                    const [x, y] = rockKey.split(',').map(Number);
                    // 检查位置是否在有效范围内（不检查boardMatrix值，因为石块可以放在门的位置）
                    if (x >= 0 && x < this.boardWidth && y >= 0 && y < this.boardHeight) {
                        this.grid[y][x] = 'rock';
                    }
                });
            }
        }
    }

    /**
     * 选择方块
     */
    selectBlock(blockId) {
        console.log(`[选择调试] 尝试选择方块: ${blockId}`);

        const block = this.blocks.get(blockId);
        if (!block) {
            console.log(`[选择调试] 方块不存在: ${blockId}`);
            return false;
        }

        if (!block.movable) {
            console.log(`[选择调试] 方块不可移动: ${blockId} (${block.color})`);
            return false;
        }

        console.log(`[选择调试] 成功选择方块: ${block.id} (${block.color})`);
        console.log(`[选择调试] 方块位置: (${block.position.x}, ${block.position.y})`);
        console.log(`[选择调试] 方块类型: ${block.type}`);

        // 清除之前选中方块的选中状态
        if (this.selectedBlock) {
            this.selectedBlock.isSelected = false;
        }

        // 设置新选中方块的选中状态
        block.isSelected = true;
        this.selectedBlock = block;

        // 🔧 优化：选择方块后触发重绘
        this.triggerRedraw();

        return true;
    }

    /**
     * 触发重绘（统一方法）
     */
    triggerRedraw() {
        if (typeof globalThis.markNeedsRedraw === 'function') {
            globalThis.markNeedsRedraw();
        }
    }


    /**
     * 统一的冰块处理逻辑 - 在方块移动或消除后调用
     * @param {Object} movedBlock - 移动或消除的方块（可选）
     */
    processIceBlocks(movedBlock = null) {
        // 获取所有下层方块（冰块）
        const lowerBlocks = this.getLowerLayerBlocks();

        lowerBlocks.forEach(block => {
            // 排除刚移动的方块（如果提供了movedBlock）
            if (movedBlock && block.id === movedBlock.id) {
                return;
            }

            // 检查方块是否完全显露
            const isFullyRevealed = this.collisionDetector.isBlockFullyRevealed(block, this.grid, this.blocks);

            if (isFullyRevealed) {
                // 方块完全显露，直接显露（后续用精灵图动画）
                this.revealBlock(block);
            }
        });
    }


    /**
     * 显露方块
     */
    revealBlock(block) {
        console.log(`显露方块: ${block.id}`);

        // 使用 Block 类的显露方法
        if (block.revealIce && typeof block.revealIce === 'function') {
            block.revealIce();
        } else {
            // 如果不是 Block 类，使用旧逻辑
            block.layer = 0;
            block.movable = true;
        }

        // 🔧 修复：冰块融化后需要重新初始化网格状态
        console.log(`[冰块融化] 方块 ${block.id} 从第1层显露到第0层，重新初始化网格`);
        this.reinitializeGrid();
    }

    /**
     * 检查出门条件
     */
    checkGateExit(block) {
        this.gates.forEach(gate => {
            const exitResult = this.collisionDetector.canExitThroughGate(block, gate, this.grid, this.blocks);
            if (exitResult.canExit) {
                this.exitThroughGate(block, gate);
            }
        });
    }

    /**
     * 通过门离开
     */
    exitThroughGate(block, gate) {
        console.log(`方块 ${block.id} 通过 ${gate.color} 门离开`);

        // 停止当前动画
        const animationId = `block_move_${block.id}`;
        if (this.animations.has(animationId)) {
            console.log(`[通过门] 停止方块 ${block.id} 的移动动画`);
            this.animations.get(animationId).kill();
            this.animations.delete(animationId);
        }

        // 播放消除闪烁动画
        this.playEliminationAnimation(block, gate);
    }

    /**
     * 播放消除闪烁动画
     */
    playEliminationAnimation(block, gate) {
        // 抖音小游戏环境使用原生动画
        console.log('使用原生动画播放消除效果');

        const animationId = `block_eliminate_${block.id}`;

        // 设置方块状态为消除中
        block.state = 'eliminating';
        block.isEliminating = true;

        // 使用原生动画创建闪烁效果
        let flashCount = 0;
        const maxFlashes = 6;
        const flashDuration = 100; // 每次闪烁100ms

        const flash = () => {
            block.alpha = block.alpha === 1 ? 0.3 : 1;
            if (typeof globalThis.markNeedsRedraw === 'function') {
                globalThis.markNeedsRedraw();
            }
            flashCount++;

            if (flashCount < maxFlashes) {
                setTimeout(flash, flashDuration);
            } else {
                // 动画完成，移除方块
                this.removeBlockAfterAnimation(block, gate);

                // 清理动画
                if (this.animations) {
                    this.animations.delete(animationId);
                }
            }
        };

        // 开始闪烁动画
        flash();

        console.log(`[消除动画] 开始播放方块 ${block.id} 的闪烁动画`);
    }

    /**
     * 动画完成后移除方块
     */
    removeBlockAfterAnimation(block, gate) {
        console.log(`[消除动画] 动画完成，移除方块 ${block.id}`);

        // 移除方块
        this.blocks.delete(block.id);
        this.selectedBlock = null;
        this.updateGrid();

        // 🔧 修复：方块出门后统一处理冰块
        console.log(`[通过门] 处理冰块 - 方块 ${block.id} 出门后`);
        this.processIceBlocks(block);

        // 检查胜利条件
        this.checkWinCondition();
    }

    /**
     * 检查胜利条件
     */
    checkWinCondition() {
        const movableBlocks = Array.from(this.blocks.values()).filter(block => block.movable);

        console.log(`检查通关条件: 当前还有 ${movableBlocks.length} 个可移动方块`);

        if (movableBlocks.length === 0) {
            console.log('所有可移动方块都已离开，关卡完成！');
            this.gameState = 'completed';
            this.onGameComplete();
            return;
        }

        // 检查是否所有方块都已经在正确的位置（通过门）
        const allBlocksAtTarget = movableBlocks.every(block => {
            return this.isBlockAtCorrectGate(block);
        });

        if (allBlocksAtTarget) {
            console.log('所有可移动方块都已到达目标位置，关卡完成！');
            this.gameState = 'completed';
            this.onGameComplete();
        } else {
            console.log('还有可移动方块未到达目标位置，继续游戏');
        }
    }

    /**
     * 检查方块是否在正确的位置（通过门）
     */
    isBlockAtCorrectGate(block) {
        // 找到与方块颜色匹配的门
        const matchingGate = Array.from(this.gates.values()).find(gate => gate.color === block.color);
        if (!matchingGate) {
            console.log(`方块 ${block.id} 没有找到匹配的门 (颜色: ${block.color})`);
            return false;
        }

        // 检查方块是否在门的位置
        const isAtGate = this.isBlockAtGate(block, matchingGate);
        console.log(`方块 ${block.id} (${block.color}) 是否在门 ${matchingGate.id} (${matchingGate.color}) 位置: ${isAtGate}`);

        return isAtGate;
    }

    /**
     * 检查方块是否在门的位置
     * 使用正确的门检测逻辑，确保方块完全贴着边界且完全在门覆盖范围内
     */
    isBlockAtGate(block, gate) {
        // 直接使用已经正确的碰撞检测逻辑
        const exitResult = this.collisionDetector.canExitThroughGate(block, gate, this.grid, this.blocks);
        return exitResult.canExit;
    }

    /**
     * 游戏完成回调
     */
    onGameComplete() {
        console.log('游戏完成！');
        if (globalThis.onLevelComplete) {
            globalThis.onLevelComplete(this.currentLevel);
        }
    }


    /**
     * 设置渲染上下文
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

        // 统一计算网格尺寸 - 基于棋盘矩阵
        this.calculateGridDimensions(windowWidth, windowHeight);

        console.log('渲染上下文已设置:', {
            windowWidth,
            windowHeight,
            cellSize: this.cellSize,
            gridSize: this.gridSize,
            gridOffsetX: this.gridOffsetX,
            gridOffsetY: this.gridOffsetY
        });
    }

    /**
     * 统一计算网格尺寸
     */
    calculateGridDimensions(windowWidth, windowHeight) {
        // 使用固定格子大小，不进行缩放（已在构造函数中设置）

        // 网格尺寸由 updateGridFromBoard() 设置，这里只计算渲染尺寸
        // 计算网格总尺寸
        this.gridSize = this.cellSize * this.GRID_SIZE;

        // 居中定位（不进行缩放）
        this.gridOffsetX = (windowWidth - this.gridSize) / 2;
        this.gridOffsetY = (windowHeight - this.gridSize) / 2 + 20;

        // 确保偏移值有限
        this.gridOffsetX = isFinite(this.gridOffsetX) ? this.gridOffsetX : 0;
        this.gridOffsetY = isFinite(this.gridOffsetY) ? this.gridOffsetY : 0;
    }

    /**
     * 渲染游戏
     */
    render() {
        if (!this.ctx) return;

        // 🔧 渲染前进行碰撞检测和状态同步
        this.validateAndSyncBlockPositions();

        // 绘制背景
        this.drawBackground();

        // 绘制棋盘
        this.drawBoard();

        // 绘制冰块
        this.drawIceBlocks();

        // 绘制石块
        this.drawRocks();

        // 绘制冰层
        this.drawIceLayers();

        // 绘制俄罗斯方块（包括被冰块包裹的方块）
        this.drawTetrisBlocks();

        // 绘制火箭创建的砖块（确保在方块之后绘制）
        this.drawRocketBricks();

        // 绘制UI
        this.drawUI();

        // 绘制弹窗
        this.drawDialog();
    }

    /**
     * 验证并同步方块位置（渲染前碰撞检测）
     */
    validateAndSyncBlockPositions() {
        if (!this.blocks || !this.grid) return;

        // 🔧 修复：只检查第0层的方块（可移动的方块）
        const topLayerBlocks = this.getBlocksByLayer(0);
        console.log(`[渲染前检测] 检查 ${topLayerBlocks.length} 个第0层方块`);

        // 检查所有第0层方块的位置是否有效
        topLayerBlocks.forEach(block => {
            const pos = block.position;
            
            // 🔧 调试：打印方块详细信息
            console.log(`[调试] 检查方块 ${block.id}:`, {
                position: pos,
                type: block.type,
                typeData: block.typeData
            });
            console.log(`[调试] 方块 ${block.id} 位置: x=${pos.x}, y=${pos.y}`);
            
            // 检查边界
            if (!this.collisionDetector.isValidPosition(pos.x, pos.y)) {
                console.warn(`[渲染前检测] 方块 ${block.id} 位置超出边界:`, pos);
                return;
            }
            
            // 检查方块的每个格子是否都在0区域（游戏区域）
            const cells = block.getCells();
            console.log(`[调试] 方块 ${block.id} 的格子:`, cells);
            
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const cellX = pos.x + cell.x;
                const cellY = pos.y + cell.y;
                
                console.log(`[调试] 格子${i}: 相对坐标(${cell.x},${cell.y}) + 方块位置(${pos.x},${pos.y}) = 绝对坐标(${cellX},${cellY})`);
                
                // 检查边界
                if (!this.collisionDetector.isValidPosition(cellX, cellY)) {
                    console.warn(`[渲染前检测] 方块 ${block.id} 格子超出边界:`, { cellX, cellY });
                    console.warn(`[调试] 边界检查失败详情:`, {
                        cellX, cellY,
                        boardWidth: this.boardWidth,
                        boardHeight: this.boardHeight,
                        isValidPosition: this.collisionDetector.isValidPosition(cellX, cellY)
                    });
                    return;
                }
                
                // 检查是否为0区域（游戏区域）
                const boardValue = this.getCellValue(cellX, cellY);
                if (boardValue !== 0) {
                    console.warn(`[渲染前检测] 方块 ${block.id} 格子不在游戏区域:`, { cellX, cellY }, 'boardValue:', boardValue);
                    return;
                }
            }
            
            // 检查网格状态是否一致
            const gridValue = this.grid[pos.y][pos.x];
            if (gridValue !== block.id) {
                console.warn(`[渲染前检测] 方块 ${block.id} 网格状态不一致:`, pos, 'gridValue:', gridValue, 'blockId:', block.id);
                // 修复网格状态
                this.grid[pos.y][pos.x] = block.id;
            }
        });
    }

    /**
     * 重新初始化网格状态（修复初始化问题）
     */
    reinitializeGrid() {
        if (!this.blocks || !this.grid) return;

        console.log('[网格重新初始化] 开始重新初始化网格状态...');

        // 清空网格
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                this.grid[y][x] = 0;
            }
        }

        // 🔧 修复：只处理第0层的方块（可移动的方块）
        const topLayerBlocks = this.getBlocksByLayer(0);
        console.log(`[网格重新初始化] 找到 ${topLayerBlocks.length} 个第0层方块`);

        // 重新设置方块位置
        topLayerBlocks.forEach(block => {
            const pos = block.position;
            
            // 检查边界
            if (this.collisionDetector.isValidPosition(pos.x, pos.y)) {
                // 检查方块的每个格子是否都在0区域（游戏区域）
                const cells = block.getCells();
                let canPlace = true;
                
                for (const cell of cells) {
                    const cellX = pos.x + cell.x;
                    const cellY = pos.y + cell.y;
                    
                    // 检查边界
                    if (!this.collisionDetector.isValidPosition(cellX, cellY)) {
                        console.warn(`[网格重新初始化] 方块 ${block.id} 格子超出边界:`, { cellX, cellY });
                        canPlace = false;
                        break;
                    }
                    
                    // 检查是否为0区域（游戏区域）
                    const boardValue = this.getCellValue(cellX, cellY);
                    if (boardValue !== 0) {
                        console.warn(`[网格重新初始化] 方块 ${block.id} 格子不在游戏区域:`, { cellX, cellY }, 'boardValue:', boardValue);
                        canPlace = false;
                        break;
                    }
                }
                
                if (canPlace) {
                    // 设置网格状态
                    this.grid[pos.y][pos.x] = block.id;
                    console.log(`[网格重新初始化] 方块 ${block.id} 位置设置成功:`, pos);
                } else {
                    console.warn(`[网格重新初始化] 方块 ${block.id} 无法放置，跳过`);
                }
            } else {
                console.warn(`[网格重新初始化] 方块 ${block.id} 位置超出边界:`, pos);
            }
        });

        console.log('[网格重新初始化] 网格状态重新初始化完成');
    }

    /**
     * 绘制背景
     */
    drawBackground() {
        if (!this.ctx) return;

        // 确保系统信息有效
        const windowWidth = this.systemInfo && this.systemInfo.windowWidth ? Number(this.systemInfo.windowWidth) || 375 : 375;
        const windowHeight = this.systemInfo && this.systemInfo.windowHeight ? Number(this.systemInfo.windowHeight) || 667 : 667;

        // 渐变背景
        const gradient = this.ctx.createLinearGradient(0, 0, 0, windowHeight);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#4682B4');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, windowWidth, windowHeight);
    }


    /**
     * 绘制棋盘
     */
    drawBoard() {
        if (!this.ctx) return;

        // 使用新的棋盘矩阵系统绘制
        if (this.boardMatrix) {
            this.drawNewBoard();
        } else {
            console.warn('drawBoard: 未加载棋盘矩阵，无法绘制。');
        }
    }

    /**
     * 使用棋盘矩阵绘制新棋盘 - 绘制8×8游戏区域和管道边框
     */
    drawNewBoard() {
        const matrix = this.boardMatrix;

        // 1. 绘制8×8游戏区域
        this.drawGameArea(matrix);

        // 2. 绘制管道边框（门和墙，贴着棋盘边缘）
        this.drawPipeBorder(matrix);

        // 3. 绘制坐标标签
        this.drawCoordinateLabels();
    }

    /**
     * 计算游戏区域位置并绘制网格线
     */
    drawGameArea(matrix) {
        if (!matrix || matrix.length === 0) return;

        const matrixWidth = matrix[0].length;
        const matrixHeight = matrix.length;
        const maxSize = Math.max(matrixWidth, matrixHeight);
        const totalSize = maxSize * this.cellSize;

        // 使用系统信息获取画布尺寸，确保是有效数字
        const canvasWidth = this.systemInfo && this.systemInfo.windowWidth ? Number(this.systemInfo.windowWidth) || 375 : 375;
        const canvasHeight = this.systemInfo && this.systemInfo.windowHeight ? Number(this.systemInfo.windowHeight) || 667 : 667;

        // 计算居中位置
        const centerX = (canvasWidth - totalSize) / 2;
        const centerY = (canvasHeight - totalSize) / 2;

        // 保存偏移量
        this.gridOffsetX = centerX;
        this.gridOffsetY = centerY;

        // 绘制游戏区域（值为0的格子）之间的网格线
        this.drawGameAreaGridLines(matrix);
    }

    /**
     * 绘制游戏区域（值为0的格子）之间的网格线
     */
    drawGameAreaGridLines(matrix) {
        if (!this.ctx || !matrix) return;

        const cellSize = this.cellSize;
        const matrixWidth = matrix[0].length;
        const matrixHeight = matrix.length;

        // 设置网格线样式
        this.ctx.strokeStyle = '#CCCCCC'; // 浅灰色
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]); // 实线

        // 绘制水平网格线（只在相邻的0格子之间）
        for (let y = 0; y < matrixHeight - 1; y++) {
            for (let x = 0; x < matrixWidth; x++) {
                // 检查当前格子和下方格子是否都是游戏区域（值为0）
                if (matrix[y][x] === 0 && matrix[y + 1][x] === 0) {
                    const startX = this.gridOffsetX + x * cellSize;
                    const endX = this.gridOffsetX + (x + 1) * cellSize;
                    const lineY = this.gridOffsetY + (y + 1) * cellSize;

                    this.ctx.beginPath();
                    this.ctx.moveTo(startX, lineY);
                    this.ctx.lineTo(endX, lineY);
                    this.ctx.stroke();
                }
            }
        }

        // 绘制垂直网格线（只在相邻的0格子之间）
        for (let y = 0; y < matrixHeight; y++) {
            for (let x = 0; x < matrixWidth - 1; x++) {
                // 检查当前格子和右方格子是否都是游戏区域（值为0）
                if (matrix[y][x] === 0 && matrix[y][x + 1] === 0) {
                    const startY = this.gridOffsetY + y * cellSize;
                    const endY = this.gridOffsetY + (y + 1) * cellSize;
                    const lineX = this.gridOffsetX + (x + 1) * cellSize;

                    this.ctx.beginPath();
                    this.ctx.moveTo(lineX, startY);
                    this.ctx.lineTo(lineX, endY);
                    this.ctx.stroke();
                }
            }
        }
    }

    /**
     * 绘制管道边框（门和墙作为棋盘边框，而非占据格子）
     */
    drawPipeBorder(matrix) {
        if (!matrix || matrix.length === 0) return;

        const borderWidth = 10; // 固定边框宽度
        const matrixWidth = matrix[0].length;
        const matrixHeight = matrix.length;

        // 使用Set来避免重复绘制边框
        const drawnBorders = new Set();

        // 遍历所有格子，找到游戏区域(0)的边界，然后绘制对应的门/墙边框
        for (let y = 0; y < matrixHeight; y++) {
            for (let x = 0; x < matrixWidth; x++) {
                const elementType = matrix[y][x];

                // 只处理游戏区域(0)
                if (elementType === 0) {
                    // 检查四个方向，找到相邻的门/墙
                    const directions = [{dx: 0, dy: -1, side: 'top'},    // 上边
                        {dx: 0, dy: 1, side: 'bottom'},  // 下边
                        {dx: -1, dy: 0, side: 'left'},   // 左边
                        {dx: 1, dy: 0, side: 'right'}    // 右边
                    ];

                    for (const dir of directions) {
                        const adjX = x + dir.dx;
                        const adjY = y + dir.dy;

                        let adjElementType;

                        // 检查相邻格子是否是门/墙
                        if (adjX >= 0 && adjX < matrixWidth && adjY >= 0 && adjY < matrixHeight) {
                            const adjElementType = matrix[adjY][adjX];

                            // 如果是门(2-9)或墙(1)，绘制边框（-1是填充，不需要处理）
                            if (adjElementType === 1 || (adjElementType >= 2 && adjElementType <= 9)) {
                                // 创建边框的唯一标识，避免重复绘制
                                const borderKey = `${x},${y},${dir.side}`;

                                if (!drawnBorders.has(borderKey)) {
                                    this.drawBorderForGameArea(x, y, dir.side, adjElementType, borderWidth);
                                    drawnBorders.add(borderKey);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * 为游戏区域绘制边框（紧贴游戏区域外边缘）
     * @param {number} gameAreaX - 游戏区域X坐标
     * @param {number} gameAreaY - 游戏区域Y坐标
     * @param {string} side - 边框方向 ('top', 'bottom', 'left', 'right')
     * @param {number} elementType - 相邻的门/墙类型
     * @param {number} borderWidth - 边框宽度
     */
    drawBorderForGameArea(gameAreaX, gameAreaY, side, elementType, borderWidth) {
        const cellSize = this.cellSize;
        let borderX, borderY, borderW, borderH;

        // 设置边框颜色
        let borderColor;
        if (elementType === 1) {
            // 墙：深灰色
            borderColor = GAME_CONFIG.RENDER_COLORS.PIPE_BACKGROUND;
        } else if (elementType >= 2 && elementType <= 9) {
            // 门：对应颜色
            const gateColor = this.getBlockColor(GAME_CONFIG.BOARD_SYSTEM.GATE_COLOR_MAP[elementType]);
            borderColor = gateColor;
        }

        // 计算边框位置（紧贴游戏区域外边缘）
        if (side === 'top') {
            // 上边框：在游戏区域上方
            borderX = this.gridOffsetX + gameAreaX * cellSize;
            borderY = this.gridOffsetY + gameAreaY * cellSize - borderWidth;
            borderW = cellSize;
            borderH = borderWidth;

        } else if (side === 'bottom') {
            // 下边框：在游戏区域下方
            borderX = this.gridOffsetX + gameAreaX * cellSize;
            borderY = this.gridOffsetY + (gameAreaY + 1) * cellSize;
            borderW = cellSize;
            borderH = borderWidth;

        } else if (side === 'left') {
            // 左边框：在游戏区域左方
            borderX = this.gridOffsetX + gameAreaX * cellSize - borderWidth;
            borderY = this.gridOffsetY + gameAreaY * cellSize;
            borderW = borderWidth;
            borderH = cellSize;

        } else if (side === 'right') {
            // 右边框：在游戏区域右方
            borderX = this.gridOffsetX + (gameAreaX + 1) * cellSize;
            borderY = this.gridOffsetY + gameAreaY * cellSize;
            borderW = borderWidth;
            borderH = cellSize;
        }


        // 绘制边框
        this.ctx.fillStyle = borderColor;
        this.ctx.fillRect(borderX, borderY, borderW, borderH);
    }


    /**
     * 绘制实心格子（墙或砖块）
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {string} fillColor - 填充颜色
     */
    drawSolidCell(x, y, fillColor) {
        const cellX = this.gridOffsetX + x * this.cellSize;
        const cellY = this.gridOffsetY + y * this.cellSize;

        // 清除任何可能的边框设置
        this.ctx.strokeStyle = 'transparent';
        this.ctx.lineWidth = 0;

        // 绘制实心背景
        this.ctx.fillStyle = fillColor;
        this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);

        // 确保没有任何边框或阴影效果
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }

    /**
     * 绘制砖块（火箭创建的砖块，仍然占据完整格子）
     */
    drawBrick(x, y) {
        this.drawSolidCell(x, y, GAME_CONFIG.RENDER_COLORS.PIPE_BACKGROUND);
    }


    /**
     * 绘制坐标标签（适应边框渲染模式）
     */
    drawCoordinateLabels() {
        if (!this.ctx || !this.boardMatrix) return;

        const matrixWidth = this.boardMatrix[0].length;
        const matrixHeight = this.boardMatrix.length;
        const borderWidth = 10; // 边框宽度

        // 设置文字样式
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#333333';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // 只绘制游戏区域的坐标标签
        const gameAreaBounds = this.getGameAreaBounds();

        // 绘制X轴坐标标签（只标记游戏区域）
        for (let x = gameAreaBounds.minX; x <= gameAreaBounds.maxX; x++) {
            const labelX = this.gridOffsetX + x * this.cellSize + this.cellSize / 2;
            const topLabelY = this.gridOffsetY + gameAreaBounds.minY * this.cellSize - borderWidth - 10;
            const bottomLabelY = this.gridOffsetY + (gameAreaBounds.maxY + 1) * this.cellSize + borderWidth + 10;

            // 顶部标签
            this.ctx.fillText(x.toString(), labelX, topLabelY);

            // 底部标签
            this.ctx.fillText(x.toString(), labelX, bottomLabelY);
        }

        // 绘制Y轴坐标标签（只标记游戏区域）
        for (let y = gameAreaBounds.minY; y <= gameAreaBounds.maxY; y++) {
            const leftLabelX = this.gridOffsetX + gameAreaBounds.minX * this.cellSize - borderWidth - 10;
            const rightLabelX = this.gridOffsetX + (gameAreaBounds.maxX + 1) * this.cellSize + borderWidth + 10;
            const labelY = this.gridOffsetY + y * this.cellSize + this.cellSize / 2;

            // 左侧标签
            this.ctx.fillText(y.toString(), leftLabelX, labelY);

            // 右侧标签
            this.ctx.fillText(y.toString(), rightLabelX, labelY);
        }
    }

    /**
     * 获取游戏区域的边界（从boardMatrix中找到值为0的区域）
     */
    getGameAreaBounds() {
        if (this.boardMatrix) {
            // 从boardMatrix中找到值为0的区域边界
            const matrix = this.boardMatrix;
            let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;

            for (let y = 0; y < matrix.length; y++) {
                for (let x = 0; x < matrix[y].length; x++) {
                    if (matrix[y][x] === 0) { // 0表示游戏区域
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            return {minX, maxX, minY, maxY};
        }

        // 如果没有boardMatrix，使用默认的8x8区域 (0,0)到(7,7)
        return {minX: 0, maxX: this.GRID_SIZE - 1, minY: 0, maxY: this.GRID_SIZE - 1};
    }

    /**
     * 获取方块颜色 - 统一使用 BLOCK_COLORS
     */
    getBlockColor(colorName) {
        // 统一使用 BLOCK_COLORS 中的颜色定义
        if (typeof BLOCK_COLORS !== 'undefined' && BLOCK_COLORS[colorName]) {
            return BLOCK_COLORS[colorName].hex;
        }

        // 默认颜色
        return '#CCCCCC';
    }


    /**
     * 绘制石块
     */
    drawRocks() {
        this.rocks.forEach(rockKey => {
            const [x, y] = rockKey.split(',').map(Number);
            const screenX = this.gridOffsetX + x * this.cellSize;
            const screenY = this.gridOffsetY + y * this.cellSize;

            this.drawCellWithStyle(screenX, screenY, {
                fillColor: '#404040',
                strokeColor: '#2A2A2A',
                strokeWidth: GAME_CONFIG.STYLES.LINE_WIDTH_THICK,
                textureColor: GAME_CONFIG.COLORS.BLACK + '0.3)',
                highlightColor: GAME_CONFIG.COLORS.WHITE + '0.2)'
            });
        });
    }

    /**
     * 绘制冰块样式（统一方法）
     */
    drawIceStyle(x, y, includeTexture = true) {
        const style = {
            fillColor: GAME_CONFIG.COLORS.ICE_BLUE + '0.8)',
            strokeColor: GAME_CONFIG.COLORS.ICE_BORDER + '1.0)',
            strokeWidth: GAME_CONFIG.STYLES.LINE_WIDTH_THIN
        };

        if (includeTexture) {
            style.textureColor = GAME_CONFIG.COLORS.WHITE + '0.3)';
            style.highlightColor = GAME_CONFIG.COLORS.WHITE + '0.15)';
        }

        this.drawCellWithStyle(x, y, style);
    }

    /**
     * 绘制冰块（淡色渲染）
     */
    drawIceBlocks() {
        const lowerBlocks = this.getLowerLayerBlocks();

        lowerBlocks.forEach(block => {
            if (!this.collisionDetector.isBlockFullyRevealed(block, this.grid, this.blocks)) {
                const cells = this.collisionDetector.getBlockCells(block);

                // 使用统一的冰块样式绘制
                cells.forEach(cell => {
                    const pos = this.getCellScreenPosition(cell);
                    this.drawIceStyle(pos.x, pos.y, true);
                });
            }
        });
    }

    /**
     * 绘制冰层
     */
    drawIceLayers() {
        // 绘制冰层效果，显示被遮挡的方块
        const lowerBlocks = this.getLowerLayerBlocks();

        lowerBlocks.forEach(block => {
            const cells = this.collisionDetector.getBlockCells(block);
            cells.forEach(cell => {
                const pos = this.getCellScreenPosition(cell);
                // 使用统一的冰块样式绘制（不包含纹理）
                this.drawIceStyle(pos.x, pos.y, false);
            });
        });
    }

    /**
     * 绘制俄罗斯方块（包括被冰块包裹的方块）
     */
    drawTetrisBlocks() {
        // 只绘制第0层方块（可移动的方块）
        const topLayerBlocks = this.getBlocksByLayer(0);

        topLayerBlocks.forEach(block => {
            this.drawTetrisBlock(block);
        });
    }

    /**
     * 计算格子屏幕坐标
     */
    getCellScreenPosition(cell) {
        // 方块坐标直接对应8×8游戏区域，不需要偏移调整
        return {
            x: this.gridOffsetX + cell.x * this.cellSize, y: this.gridOffsetY + cell.y * this.cellSize
        };
    }


    drawRect(x, y, width, height, fill = true, stroke = true) {
        if (fill) {
            this.ctx.fillRect(x, y, width, height);
        }
        if (stroke) {
            this.ctx.strokeRect(x, y, width, height);
        }
    }

    drawRectWithOffset(x, y, width, height, offset, fill = true) {
        if (fill) {
            this.ctx.fillRect(x + offset, y + offset, width - offset * 2, height - offset * 2);
        }
    }

    /**
     * 统一绘制带样式的格子
     */
    drawCellWithStyle(x, y, style) {
        // 主体
        this.ctx.fillStyle = style.fillColor;
        this.drawRect(x, y, this.cellSize, this.cellSize);

        // 边框
        if (style.strokeColor) {
            this.ctx.strokeStyle = style.strokeColor;
            this.ctx.lineWidth = style.strokeWidth || GAME_CONFIG.STYLES.LINE_WIDTH_THIN;
            this.drawRect(x, y, this.cellSize, this.cellSize, false, true);
        }

        // 纹理
        if (style.textureColor) {
            this.ctx.fillStyle = style.textureColor;
            this.drawRectWithOffset(x, y, this.cellSize, this.cellSize, 2);
        }

        // 高光
        if (style.highlightColor) {
            this.ctx.fillStyle = style.highlightColor;
            this.drawRectWithOffset(x, y, this.cellSize, this.cellSize, 4);
        }
    }

    setTextStyle(font, align = 'left') {
        this.ctx.font = font;
        this.ctx.textAlign = align;
    }

    /**
     * 绘制单个俄罗斯方块
     */
    drawTetrisBlock(block) {
        // 使用 Block 类的绘制方法
        if (block.draw && typeof block.draw === 'function') {
            block.draw(this.ctx, this.cellSize, this.gridOffsetX, this.gridOffsetY);
        } else {
            console.warn('drawTetrisBlock: 方块不是 Block 类实例，无法绘制', block);
        }
    }

    /**
     * 绘制所有砖块（包括原始砖块和火箭创建的砖块）
     */
    drawRocketBricks() {
        if (!this.boardMatrix || !this.ctx) return;

        const matrixWidth = this.boardMatrix[0].length;
        const matrixHeight = this.boardMatrix.length;

        // 遍历boardMatrix，绘制所有砖块
        for (let y = 0; y < matrixHeight; y++) {
            for (let x = 0; x < matrixWidth; x++) {
                const elementType = this.boardMatrix[y][x];

                // 绘制所有类型为砖块的位置
                if (elementType === GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.BRICK) {
                    this.drawBrick(x, y);
                }
            }
        }
    }

    /**
     * 绘制UI
     */
    drawUI() {
        if (!this.ctx) return;

        // 绘制游戏状态信息
        this.ctx.fillStyle = GAME_CONFIG.COLORS.WHITE + '0.9)';
        this.setTextStyle('16px Arial', 'left');

        const infoY = 30;
        this.ctx.fillText(`关卡: ${this.currentLevel}`, 20, infoY);
        this.ctx.fillText(`状态: ${this.gameState}`, 20, infoY + 25);

        if (this.selectedBlock) {
            this.ctx.fillText(`选中: ${this.selectedBlock.id}`, 20, infoY + 50);
        }

        // 绘制道具栏
        this.drawItemBar();

        // 绘制移动提示
        if (this.selectedBlock) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
            this.setTextStyle('14px Arial', 'left');
            const windowHeight = this.systemInfo && this.systemInfo.windowHeight ? Number(this.systemInfo.windowHeight) || 667 : 667;
            this.ctx.fillText('点击目标位置移动方块', 20, windowHeight - 20);
        }
    }

    /**
     * 绘制道具栏
     */
    drawItemBar() {
        if (!this.ctx) return;

        const windowWidth = this.systemInfo && this.systemInfo.windowWidth ? Number(this.systemInfo.windowWidth) || 375 : 375;
        const windowHeight = this.systemInfo && this.systemInfo.windowHeight ? Number(this.systemInfo.windowHeight) || 667 : 667;

        // 悬浮道具按钮位置：屏幕下方，稍微往上一点
        const itemSize = 60;
        const itemSpacing = 20;
        const totalWidth = (itemSize + itemSpacing) * 3 - itemSpacing;
        const startX = (windowWidth - totalWidth) / 2;
        const itemY = windowHeight - itemSize - 30; // 距离底部30px

        // 绘制三个道具
        const itemKeys = Object.keys(this.items);
        itemKeys.forEach((itemKey, index) => {
            const item = this.items[itemKey];
            const itemX = startX + index * (itemSize + itemSpacing);

            // 绘制阴影效果（悬浮感）
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(itemX + 2, itemY + 2, itemSize, itemSize);

            // 绘制道具背景
            if (this.selectedItem === itemKey) {
                // 选中状态：金色背景
                this.ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';
            } else if (item.count > 0) {
                // 可用状态：白色背景
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            } else {
                // 不可用状态：灰色背景
                this.ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
            }

            this.ctx.fillRect(itemX, itemY, itemSize, itemSize);

            // 绘制道具边框
            if (this.selectedItem === itemKey) {
                this.ctx.strokeStyle = 'rgba(255, 140, 0, 1)';
                this.ctx.lineWidth = 3;
            } else {
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                this.ctx.lineWidth = 2;
            }
            this.ctx.strokeRect(itemX, itemY, itemSize, itemSize);

            // 绘制道具图标
            this.ctx.font = '24px Arial';
            this.ctx.fillStyle = item.count > 0 ? '#333333' : '#999999';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(item.icon, itemX + itemSize / 2, itemY + itemSize / 2 - 5);

            // 绘制道具数量
            this.ctx.font = '12px Arial';
            this.ctx.fillStyle = item.count > 0 ? '#333333' : '#999999';
            this.ctx.fillText(item.count.toString(), itemX + itemSize / 2, itemY + itemSize - 8);

            // 绘制道具名称
            this.ctx.font = '10px Arial';
            this.ctx.fillStyle = item.count > 0 ? '#333333' : '#999999';
            this.ctx.fillText(item.name, itemX + itemSize / 2, itemY + itemSize + 12);
        });

    }

    /**
     * 绘制弹窗
     */
    drawDialog() {
        // 暂时为空，可以后续添加弹窗功能
    }

    /**
     * 检查是否有方块正在移动
     */
    isAnyBlockMoving() {
        return Array.from(this.blocks.values()).some(block => block.isMoving);
    }


    /**
     * 处理点击事件 - 支持点击移动和道具栏
     */
    handleClick(x, y) {
        // 🔧 优化：触发重绘
        this.triggerRedraw();

        // 输出点击坐标（开发模式）
        const gridPos = this.screenToGrid(x, y);
        if (GAME_CONFIG.DEBUG_MODE) {
            console.log(`[点击坐标] 屏幕坐标: (${x}, ${y}) -> 网格坐标: (${gridPos.x}, ${gridPos.y})`);
        }

        // 检查是否有方块正在移动
        if (this.isAnyBlockMoving()) {
            return;
        }

        // 检查是否点击了道具栏
        if (this.handleItemBarClick(x, y)) {
            return;
        }

        // 检查grid是否已初始化和边界检查
        if (!this.grid || !this.grid[gridPos.y] || gridPos.x < 0 || gridPos.y < 0 || gridPos.y >= this.grid.length || gridPos.x >= this.grid[0].length) {
            console.warn(`[点击错误] 无效的网格坐标: (${gridPos.x}, ${gridPos.y}), grid状态:`, this.grid ? 'initialized' : 'null');
            return;
        }

        const gridValue = this.grid[gridPos.y][gridPos.x];

        if (gridValue && this.blocks.has(gridValue)) {
            // 点击了方块
            const clickedBlock = this.blocks.get(gridValue);
            console.log(`[点击调试] 点击了方块: ${clickedBlock.id} (${clickedBlock.color})`);
            console.log(`[点击调试] 方块当前位置: (${clickedBlock.position.x}, ${clickedBlock.position.y})`);
            console.log(`[点击调试] 方块类型: ${clickedBlock.type}`);
            console.log(`[点击调试] 方块是否可移动: ${clickedBlock.movable ? '✅是' : '❌否'}`);

            // 检查是否选中了颜色转换剂道具
            if (this.selectedItem === 'colorChanger') {
                console.log(`[道具] 使用颜色转换剂对方块 ${clickedBlock.id} 进行颜色转换`);
                const success = this.useColorChanger(gridPos);
                if (success) {
                    // 减少道具数量
                    this.items.colorChanger.count--;
                }
                return;
            }

            // 检查是否选中了炸弹道具
            if (this.selectedItem === 'bomb') {
                console.log(`[道具] 使用炸弹对方块 ${clickedBlock.id} 进行爆炸`);
                const success = this.useBomb(gridPos);
                if (success) {
                    // 减少道具数量
                    this.items.bomb.count--;
                }
                return;
            }

            // 检查是否选中了火箭道具
            if (this.selectedItem === 'rocket') {
                console.log(`[道具] 使用火箭对方块 ${clickedBlock.id} 进行发射`);
                const success = this.useRocket(gridPos);
                if (success) {
                    // 减少道具数量
                    this.items.rocket.count--;
                }
                return;
            }

            if (clickedBlock.movable) {
                // 如果点击的是可移动方块，选择它
                console.log(`[点击调试] 选中方块: ${clickedBlock.id}`);
                this.selectBlock(gridValue);
            } else if (this.selectedBlock) {
                // 如果点击的是不可移动方块（如冰块），但已有选中方块，尝试移动
                console.log(`[移动调试] 尝试移动选中方块 ${this.selectedBlock.id} 到不可移动方块位置`);
                this.movementManager.clickMove(this.selectedBlock, gridPos, this);
            }
        } else if (this.selectedBlock) {
            // 点击了空白位置，尝试点击移动
            console.log(`[移动调试] 尝试移动选中方块: ${this.selectedBlock.id} (${this.selectedBlock.color})`);
            console.log(`[移动调试] 从位置: (${this.selectedBlock.position.x}, ${this.selectedBlock.position.y})`);
            console.log(`[移动调试] 到位置: (${gridPos.x}, ${gridPos.y})`);

            // 显示移动坐标类型
            const boardWidth = this.boardWidth || 8;
            const boardHeight = this.boardHeight || 8;

            if (gridPos.x < 0 || gridPos.x >= boardWidth || gridPos.y < 0 || gridPos.y >= boardHeight) {
                console.log(`[移动调试] 目标坐标类型: 墙区域 (${gridPos.x}, ${gridPos.y})`);
            } else {
                console.log(`[移动调试] 目标坐标类型: 游戏区域 (${gridPos.x}, ${gridPos.y})`);
            }

            this.movementManager.clickMove(this.selectedBlock, gridPos, this);
        } else {
            // 点击空白区域，取消选中
            if (this.selectedBlock) {
                console.log(`[点击调试] 点击空白区域，取消选中方块: ${this.selectedBlock.id}`);
                this.clearSelection();
                this.triggerRedraw();
            } else {
                console.log(`[点击调试] 点击空白区域，但没有选中的方块`);
            }
        }
    }

    /**
     * 处理道具栏点击
     */
    handleItemBarClick(x, y) {
        const windowHeight = this.systemInfo && this.systemInfo.windowHeight ? Number(this.systemInfo.windowHeight) || 667 : 667;
        const windowWidth = this.systemInfo && this.systemInfo.windowWidth ? Number(this.systemInfo.windowWidth) || 375 : 375;

        const itemSize = 60;
        const itemSpacing = 20;
        const totalWidth = (itemSize + itemSpacing) * 3 - itemSpacing;
        const startX = (windowWidth - totalWidth) / 2;
        const itemY = windowHeight - itemSize - 30;

        // 检查是否点击在悬浮按钮区域内
        if (y < itemY || y > itemY + itemSize) {
            return false;
        }

        // 检查点击了哪个道具
        const itemKeys = Object.keys(this.items);
        for (let i = 0; i < itemKeys.length; i++) {
            const itemX = startX + i * (itemSize + itemSpacing);

            if (x >= itemX && x <= itemX + itemSize && y >= itemY && y <= itemY + itemSize) {
                const itemKey = itemKeys[i];
                const item = this.items[itemKey];

                if (item.count > 0) {
                    // 切换选中状态
                    if (this.selectedItem === itemKey) {
                        this.selectedItem = null; // 取消选中
                    } else {
                        this.selectedItem = itemKey; // 选中道具
                    }
                    console.log(`[道具] ${this.selectedItem ? '选中' : '取消选中'} ${item.name}`);
                } else {
                    console.log(`[道具] ${item.name} 数量不足`);
                }
                return true;
            }
        }

        return false;
    }


    /**
     * 使用颜色转换剂
     * 将选中方块的颜色转换为当前地图中可以通过的门颜色
     */
    useColorChanger(targetPos) {
        console.log('[道具] 颜色转换剂效果 - 开始转换');

        // 1. 获取目标位置的方块
        const targetBlock = this.getBlockAtPosition(targetPos.x, targetPos.y);
        if (!targetBlock) {
            console.log('[道具] 目标位置没有方块');
            return false;
        }

        // 2. 获取方块的最小尺寸（长或宽的最小值）
        const blockBounds = this.collisionDetector.getBlockBounds(targetBlock);
        const minBlockSize = Math.min(blockBounds.width, blockBounds.height);
        console.log(`[道具] 方块最小尺寸: ${minBlockSize}`);

        // 3. 获取当前地图中所有的门
        const availableGates = this.getAllGates();
        console.log(`[道具] 当前地图门数量: ${availableGates.length}`);

        // 4. 筛选出可以通过的门（门的长度 >= 方块最小尺寸）
        const passableGates = availableGates.filter(gate => {
            const canPass = gate.length >= minBlockSize;
            const isDifferentColor = gate.color !== targetBlock.color; // 排除当前颜色
            console.log(`[道具] 门 ${gate.color} (长度:${gate.length}) 可通过: ${canPass}, 不同颜色: ${isDifferentColor}`);
            return canPass && isDifferentColor;
        });

        if (passableGates.length === 0) {
            console.log('[道具] 没有可以通过的门');
            return false;
        }

        // 5. 从可通过的门中随机选择一个颜色
        const randomGate = passableGates[Math.floor(Math.random() * passableGates.length)];
        const newColor = randomGate.color;

        console.log(`[道具] 方块 ${targetBlock.id} 颜色从 ${targetBlock.color} 转换为 ${newColor}`);

        // 6. 更新方块颜色
        targetBlock.color = newColor;

        // 6.1. 重新设置颜色数据（重要！）
        if (typeof BLOCK_COLORS !== 'undefined' && BLOCK_COLORS[newColor]) {
            targetBlock.colorData = BLOCK_COLORS[newColor];
            console.log(`[道具] 方块颜色数据已更新: ${newColor}`);
        } else {
            console.error(`[道具] 无效的颜色: ${newColor}`);
        }

        // 7. 标记需要重绘
        this.triggerRedraw();

        // 8. 取消道具选中状态
        this.selectedItem = null;

        console.log('[道具] 颜色转换完成');
        return true;
    }

    /**
     * 获取指定位置的方块
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Object|null} 方块对象或null
     */
    getBlockAtPosition(x, y) {
        // 遍历所有方块，检查是否包含指定位置
        for (const [blockId, block] of this.blocks) {
            const blockCells = this.collisionDetector.getBlockCells(block);

            // 检查指定位置是否在方块的任何格子中
            for (const cell of blockCells) {
                if (cell.x === x && cell.y === y) {
                    console.log(`[道具] 找到方块 ${blockId} 在位置 (${x}, ${y})`);
                    return block;
                }
            }
        }

        console.log(`[道具] 在位置 (${x}, ${y}) 没有找到方块`);
        return null;
    }

    /**
     * 获取当前地图中所有的门
     * @returns {Array} 门信息数组
     */
    getAllGates() {
        const gates = [];

        // 遍历所有门
        for (const [gateId, gate] of this.gates) {
            gates.push({
                id: gate.id, color: gate.color, length: gate.length, direction: gate.direction, x: gate.x, y: gate.y
            });
        }

        return gates;
    }

    /**
     * 使用炸弹
     * 直接移除目标位置的方块
     */
    useBomb(targetPos) {
        console.log('[道具] 炸弹效果 - 开始爆炸');

        // 1. 获取目标位置的方块
        const targetBlock = this.getBlockAtPosition(targetPos.x, targetPos.y);
        if (!targetBlock) {
            console.log('[道具] 目标位置没有方块');
            return false;
        }

        console.log(`[道具] 炸弹爆炸，移除方块: ${targetBlock.id} (${targetBlock.color})`);

        // 2. 从数据结构中移除方块
        this.removeBlock(targetBlock.id);

        // 3. 标记需要重绘
        this.triggerRedraw();

        // 4. 取消道具选中状态
        this.selectedItem = null;

        console.log('[道具] 炸弹爆炸完成');
        return true;
    }

    /**
     * 移除方块
     * @param {string} blockId - 方块ID
     */
    removeBlock(blockId) {
        // 从方块Map中移除
        if (this.blocks.has(blockId)) {
            this.blocks.delete(blockId);
            console.log(`[方块移除] 方块 ${blockId} 已从数据结构中移除`);
        }

        // 更新网格
        this.updateGrid();

        // 处理冰块显露（炸弹爆炸后显露下层冰块）
        this.processIceBlocks();

        // 如果移除的是当前选中的方块，清除选中状态
        if (this.selectedBlock && this.selectedBlock.id === blockId) {
            this.selectedBlock = null;
            console.log(`[方块移除] 清除选中状态`);
        }
    }

    /**
     * 使用火箭
     * 选中的方块位置变成砖块，并移除该位置下方所有方块
     */
    useRocket(targetPos) {
        console.log('[道具] 火箭效果 - 开始发射');

        // 1. 获取目标位置的方块
        const targetBlock = this.getBlockAtPosition(targetPos.x, targetPos.y);
        if (!targetBlock) {
            console.log('[道具] 目标位置没有方块');
            return false;
        }

        console.log(`[道具] 火箭发射，目标方块: ${targetBlock.id} (${targetBlock.color})`);

        // 2. 获取目标方块的所有格子位置
        const targetBlockCells = this.collisionDetector.getBlockCells(targetBlock);
        console.log(`[道具] 目标方块占用格子:`, targetBlockCells);

        // 3. 移除目标方块（消除效果）
        this.removeBlock(targetBlock.id);
        console.log(`[火箭] 目标方块 ${targetBlock.id} 已消除`);

        // 4. 在目标方块占用的所有格子位置创建砖块（不可通行区域）
        targetBlockCells.forEach(cell => {
            this.createBrickAtPosition(cell.x, cell.y);
        });
        console.log(`[火箭] 在 ${targetBlockCells.length} 个格子位置创建砖块`);

        // 5. 消除目标方块占用的所有格子位置下方所有方块
        this.removeBlocksBelowCells(targetBlockCells);

        // 6. 标记需要重绘
        this.triggerRedraw();

        // 7. 取消道具选中状态
        this.selectedItem = null;

        console.log('[道具] 火箭发射完成');
        return true;
    }

    /**
     * 在指定位置创建砖块
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    createBrickAtPosition(x, y) {
        console.log(`[警告] 有代码在位置 (${x}, ${y}) 创建砖块！`);
        console.log(`[警告] 调用堆栈:`, new Error().stack);
        console.log(`[火箭] boardWidth: ${this.boardWidth}, boardHeight: ${this.boardHeight}`);
        console.log(`[火箭] boardMatrix大小: ${this.boardMatrix ? this.boardMatrix.length : 'null'} x ${this.boardMatrix && this.boardMatrix[0] ? this.boardMatrix[0].length : 'null'}`);

        // 检查坐标是否在有效范围内
        if (x >= 0 && x < this.boardWidth && y >= 0 && y < this.boardHeight) {
            // 在网格中设置砖块标记
            this.grid[y][x] = GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.BRICK; // 10表示砖块

            // 在boardMatrix中也设置砖块标记（用于渲染）
            if (this.boardMatrix && this.boardMatrix[y] && this.boardMatrix[y][x] !== undefined) {
                this.boardMatrix[y][x] = GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.BRICK; // 10表示砖块
                console.log(`[火箭] 在boardMatrix位置 (${x}, ${y}) 创建砖块成功`);
            } else {
                console.log(`[火箭] boardMatrix位置 (${x}, ${y}) 无效或超出范围`);
            }

            console.log(`[火箭] 在位置 (${x}, ${y}) 创建砖块完成`);
        } else {
            console.log(`[火箭] 位置 (${x}, ${y}) 超出游戏区域范围`);
        }
    }

    /**
     * 消除目标方块占用的所有格子位置下方的方块
     * @param {Array} targetCells - 目标方块占用的格子位置数组
     */
    removeBlocksBelowCells(targetCells) {
        const blocksToRemove = [];

        // 遍历所有方块，检查是否在目标格子位置下方
        for (const [blockId, block] of this.blocks) {
            const blockCells = this.collisionDetector.getBlockCells(block);

            // 检查方块是否与任何目标格子位置有重叠（在下方）
            const shouldRemove = blockCells.some(blockCell => {
                return targetCells.some(targetCell => {
                    // 检查是否在目标格子的正下方或重叠
                    return blockCell.x === targetCell.x && blockCell.y >= targetCell.y;
                });
            });

            if (shouldRemove) {
                blocksToRemove.push(blockId);
                console.log(`[火箭] 标记消除方块: ${blockId} (位置: ${block.position.x}, ${block.position.y})`);
            }
        }

        // 消除所有标记的方块
        blocksToRemove.forEach(blockId => {
            this.removeBlock(blockId);
        });

        console.log(`[火箭] 共消除 ${blocksToRemove.length} 个方块`);
    }


    /**
     * 处理拖动事件 - 支持拖动移动
     * @param {number} startX - 起始X坐标
     * @param {number} startY - 起始Y坐标
     * @param {number} endX - 结束X坐标
     * @param {number} endY - 结束Y坐标
     */
    handleDrag(startX, startY, endX, endY) {
        // 检查是否有方块正在移动
        if (this.isAnyBlockMoving()) {
            return;
        }

        const startGridPos = this.screenToGrid(startX, startY);
        const endGridPos = this.screenToGrid(endX, endY);

        console.log('[拖动调试] 屏幕坐标:', {startX, startY, endX, endY});
        console.log('[拖动调试] 网格坐标:', {
            startGridPos: {x: startGridPos.x, y: startGridPos.y},
            endGridPos: {x: endGridPos.x, y: endGridPos.y}
        });

        // 检查起始位置是否有方块
        if (!this.collisionDetector.isValidPosition(startGridPos.x, startGridPos.y)) {
            console.warn('[拖动调试] 起始位置无效:', startGridPos);
            return;
        }

        const gridValue = this.grid[startGridPos.y][startGridPos.x];
        if (!gridValue || !this.blocks.has(gridValue)) {
            console.warn('[拖动调试] 起始位置没有方块:', {gridValue, hasBlock: this.blocks.has(gridValue)});
            return;
        }

        const draggedBlock = this.blocks.get(gridValue);
        if (!draggedBlock.movable) {
            console.warn('[拖动调试] 方块不可移动:', draggedBlock);
            return;
        }

        // 计算移动距离
        const dx = Math.abs(endGridPos.x - startGridPos.x);
        const dy = Math.abs(endGridPos.y - startGridPos.y);
        const distance = dx + dy;

        console.log('[拖动调试] 移动距离:', {dx, dy, distance, isAdjacent: distance === 1});

        // 检查拖动是否有效（在碰撞检测范围内自由拖动）
        if (this.movementManager.isValidDrag(draggedBlock, startGridPos, endGridPos, this)) {
            // 执行拖动移动
            this.movementManager.dragMove(draggedBlock, startGridPos, endGridPos, this);
            console.log('[拖动调试] 拖动成功');
        } else {
            console.warn('拖动无效：目标位置有障碍或超出游戏区域');
        }
    }

    /**
     * 处理鼠标按下事件
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    handleMouseDown(x, y) {
        const gridPos = this.screenToGrid(x, y);

        if (this.collisionDetector.isValidPosition(gridPos.x, gridPos.y)) {
            const gridValue = this.grid[gridPos.y][gridPos.x];
            if (gridValue && this.blocks.has(gridValue)) {
                const block = this.blocks.get(gridValue);
                if (block.movable) {
                    // 取消之前选中的方块
                    this.clearSelection();

                    // 选中当前方块
                    block.isSelected = true;
                    this.selectedBlock = block;

                    // 记录拖动的起始位置
                    this.dragStartPos = {x: gridPos.x, y: gridPos.y};
                    this.dragStartScreenPos = {x, y};
                    this.isDragging = true;

                    console.log('[选中] 方块被选中:', block.id);

                    // 触发重绘以显示选中效果
                    this.triggerRedraw();
                }
            }
        }
    }

    /**
     * 清除所有方块的选中状态
     */
    clearSelection() {
        if (this.selectedBlock) {
            this.selectedBlock.isSelected = false;
            this.selectedBlock = null;
        }
    }

    /**
     * 🔧 重构：智能触摸移动系统
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    handleMouseMove(x, y) {
        if (!this.isDragging || !this.selectedBlock) {
            return;
        }

        const now = Date.now();
        
        // 频率限制：避免过于频繁的移动
        if (this.lastMoveTime && (now - this.lastMoveTime) < 100) {
            return;
        }

        const gridPos = this.screenToGrid(x, y);
        const currentPos = this.selectedBlock.position;

        // 如果触摸位置没有变化，跳过处理
        if (gridPos.x === currentPos.x && gridPos.y === currentPos.y) {
            return;
        }

        // 计算下一步最佳移动
        const nextMove = this.calculateBestMove(currentPos, gridPos, now);
        
        if (nextMove && this.executeMove(currentPos, nextMove)) {
            this.lastMoveTime = now;
        }
    }

    /**
     * 🔧 新增：计算最佳移动方向
     * @param {Object} currentPos - 当前位置
     * @param {Object} targetPos - 目标位置
     * @param {number} timestamp - 时间戳
     * @returns {Object|null} 下一步移动位置
     */
    calculateBestMove(currentPos, targetPos, timestamp) {
        // 1. 简单情况：检查直接移动
        const directMove = this.getDirectMove(currentPos, targetPos);
        if (directMove && this.isValidMovePosition(directMove.x, directMove.y, this.selectedBlock)) {
            return directMove;
        }

        // 2. 复杂情况：使用智能路径规划
        const optimalPos = this.getOptimalPosition(currentPos, targetPos, timestamp);
        if (!optimalPos) {
            return null;
        }

        // 3. 计算朝向最优位置的一步移动
        return this.getStepTowardsTarget(currentPos, optimalPos);
    }

    /**
     * 🔧 新增：获取直接移动（优先级最高）
     * @param {Object} current - 当前位置
     * @param {Object} target - 目标位置
     * @returns {Object|null} 直接移动位置
     */
    getDirectMove(current, target) {
        const dx = target.x - current.x;
        const dy = target.y - current.y;

        // 只允许单步移动
        if (Math.abs(dx) === 1 && dy === 0) {
            return { x: target.x, y: current.y };
        }
        if (Math.abs(dy) === 1 && dx === 0) {
            return { x: current.x, y: target.y };
        }

        // 选择主要方向
        if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
            return { x: current.x + (dx > 0 ? 1 : -1), y: current.y };
        }
        if (Math.abs(dy) > Math.abs(dx) && dy !== 0) {
            return { x: current.x, y: current.y + (dy > 0 ? 1 : -1) };
        }

        return null;
    }

    /**
     * 🔧 新增：获取最优位置（使用缓存和A*）
     * @param {Object} current - 当前位置
     * @param {Object} target - 目标位置
     * @param {number} timestamp - 时间戳
     * @returns {Object|null} 最优位置
     */
    getOptimalPosition(current, target, timestamp) {
        // 检查是否需要重新计算
        if (this.shouldRecalculateOptimalPosition(target, timestamp)) {
            const optimal = this.findOptimalPosition(current, target, this.selectedBlock);
            this.updateOptimalPositionCache(target, optimal, timestamp);
            return optimal;
        }

        return this.cachedOptimalPosition;
    }

    /**
     * 🔧 新增：判断是否需要重新计算最优位置
     * @param {Object} target - 目标位置
     * @param {number} timestamp - 时间戳
     * @returns {boolean} 是否需要重新计算
     */
    shouldRecalculateOptimalPosition(target, timestamp) {
        // 1. 没有缓存
        if (!this.cachedOptimalPosition || !this.cachedTargetPosition) {
            return true;
        }

        // 2. 目标位置显著变化
        const dx = Math.abs(target.x - this.cachedTargetPosition.x);
        const dy = Math.abs(target.y - this.cachedTargetPosition.y);
        if (dx > 2 || dy > 2) {
            return true;
        }

        // 3. 时间超时（降低频率）
        if (timestamp - this.lastAStarTime > 500) {
            return true;
        }

        return false;
    }

    /**
     * 🔧 新增：更新最优位置缓存
     * @param {Object} target - 目标位置
     * @param {Object} optimal - 最优位置
     * @param {number} timestamp - 时间戳
     */
    updateOptimalPositionCache(target, optimal, timestamp) {
        this.cachedTargetPosition = { x: target.x, y: target.y };
        this.cachedOptimalPosition = optimal;
        this.lastAStarTime = timestamp;
    }

    /**
     * 🔧 新增：计算朝向目标的一步移动
     * @param {Object} current - 当前位置
     * @param {Object} target - 目标位置
     * @returns {Object|null} 下一步位置
     */
    getStepTowardsTarget(current, target) {
        if (!target) return null;

        const dx = target.x - current.x;
        const dy = target.y - current.y;

        // 生成候选移动
        const candidates = [];

        // 主要方向
        if (dx !== 0) {
            candidates.push({
                x: current.x + (dx > 0 ? 1 : -1),
                y: current.y,
                priority: 1,
                distance: Math.abs(dx - (dx > 0 ? 1 : -1)) + Math.abs(dy)
            });
        }
        if (dy !== 0) {
            candidates.push({
                x: current.x,
                y: current.y + (dy > 0 ? 1 : -1),
                priority: 1,
                distance: Math.abs(dx) + Math.abs(dy - (dy > 0 ? 1 : -1))
            });
        }

        // 备选方向
        const directions = [
            { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
        ];

        for (const dir of directions) {
            const newPos = { x: current.x + dir.x, y: current.y + dir.y };
            const distance = Math.abs(target.x - newPos.x) + Math.abs(target.y - newPos.y);
            
            if (!candidates.find(c => c.x === newPos.x && c.y === newPos.y)) {
                candidates.push({
                    x: newPos.x,
                    y: newPos.y,
                    priority: 2,
                    distance: distance
                });
            }
        }

        // 按优先级和距离排序
        candidates.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.distance - b.distance;
        });

        // 选择第一个有效移动
        for (const candidate of candidates) {
            if (this.isValidMovePosition(candidate.x, candidate.y, this.selectedBlock)) {
                return { x: candidate.x, y: candidate.y };
            }
        }

        return null;
    }

    /**
     * 🔧 新增：执行移动操作
     * @param {Object} currentPos - 当前位置
     * @param {Object} nextPos - 下一步位置
     * @returns {boolean} 移动是否成功
     */
    executeMove(currentPos, nextPos) {
        // 最终安全检查
        if (!this.isValidMovePosition(nextPos.x, nextPos.y, this.selectedBlock)) {
            return false;
        }

        // 执行移动
        try {
            // 🔧 修复：清除方块所有格子的当前位置
            const oldCells = this.selectedBlock.getCells();
            for (const cell of oldCells) {
                const cellX = currentPos.x + cell.x;
                const cellY = currentPos.y + cell.y;
                if (this.grid[cellY] && this.grid[cellY][cellX] === this.selectedBlock.id) {
                    this.grid[cellY][cellX] = 0;
                }
            }
            
            // 更新方块位置
            this.selectedBlock.position.x = nextPos.x;
            this.selectedBlock.position.y = nextPos.y;
            
            // 🔧 修复：更新方块所有格子的新位置
            const newCells = this.selectedBlock.getCells();
            for (const cell of newCells) {
                const cellX = nextPos.x + cell.x;
                const cellY = nextPos.y + cell.y;
                this.grid[cellY][cellX] = this.selectedBlock.id;
            }
            
            // 验证移动结果
            if (!this.validateMoveResult(nextPos.x, nextPos.y)) {
                this.rollbackMove(currentPos, nextPos.x, nextPos.y);
                return false;
            }
            
            // 触发重绘
            this.triggerRedraw();
            return true;
            
        } catch (error) {
            console.error('[移动] 执行移动时发生错误:', error);
            this.rollbackMove(currentPos, nextPos.x, nextPos.y);
            return false;
        }
    }

    /**
     * 处理鼠标释放事件
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    handleMouseUp(x, y) {
        if (this.isDragging && this.selectedBlock) {
            // 实时拖动模式下，方块位置已经在handleMouseMove中更新
            // 这里只需要更新网格状态
            
            // 更新网格以反映方块的新位置
            this.updateGrid();
            
            // 处理冰块逻辑
            this.processIceBlocks(this.selectedBlock);
            
            // 检查是否通过门
            this.checkGateExit(this.selectedBlock);
            
            // 重置拖动状态，但保持选中状态
            this.isDragging = false;
            this.dragStartPos = null;
            this.dragStartScreenPos = null;
            
            console.log('[拖动完成] 方块位置已更新:', this.selectedBlock.position);
        }
    }


    /**
     * 屏幕坐标转网格坐标
     */
    screenToGrid(screenX, screenY) {
        // 确保坐标是有效数字
        const x = +screenX || 0;
        const y = +screenY || 0;

        // 获取偏移量和格子大小
        const offsetX = +this.gridOffsetX || 0;
        const offsetY = +this.gridOffsetY || 0;
        const cellSize = +this.cellSize || 45;

        // 如果偏移量未初始化，尝试重新计算
        if (offsetX === 0 && offsetY === 0 && this.boardMatrix) {
            console.warn('[screenToGrid] 偏移量未初始化，尝试重新计算');
            this.drawGameArea(this.boardMatrix);
            const newOffsetX = +this.gridOffsetX || 0;
            const newOffsetY = +this.gridOffsetY || 0;
            console.log('[screenToGrid] 重新计算后的偏移量:', {newOffsetX, newOffsetY});
        }

        console.log('[screenToGrid调试] 输入:', {screenX, screenY, x, y});
        console.log('[screenToGrid调试] 偏移量:', {offsetX, offsetY, cellSize});

        const gridX = Math.floor((x - offsetX) / cellSize);
        const gridY = Math.floor((y - offsetY) / cellSize);

        console.log('[screenToGrid调试] 输出:', {gridX, gridY});

        return {x: gridX, y: gridY};
    }


    /**
     * 从数字矩阵加载棋盘
     * @param {Array<Array<number>>} matrix - 数字矩阵
     */
    loadBoardFromMatrix(matrix) {
        if (!Array.isArray(matrix) || matrix.length === 0) {
            console.error('无效的棋盘矩阵');
            return false;
        }

        this.boardMatrix = matrix;


        this.boardHeight = matrix.length;
        this.boardWidth = matrix[0] ? matrix[0].length : 0;

        // 解析棋盘元素
        this.parseBoardElements();

        // 更新网格和碰撞检测器
        this.updateGridFromBoard();

        console.log('棋盘加载完成:', {
            width: this.boardWidth, height: this.boardHeight, gates: this.gates.size, gridSize: this.GRID_SIZE
        });

        return true;
    }

    /**
     * 解析棋盘元素
     */
    parseBoardElements() {
        const processedGates = new Set(); // 跟踪已处理的门格子

        for (let y = 0; y < this.boardHeight; y++) {
            for (let x = 0; x < this.boardWidth; x++) {
                const elementType = this.boardMatrix[y][x];

                // 只处理门 (2-9)，墙和棋盘区域不需要特殊处理
                if (elementType >= 2 && elementType <= 9) {
                    const gateKey = `${x},${y}`;
                    if (!processedGates.has(gateKey)) {
                        const gateInfo = this.parseGateSegment(x, y, elementType, processedGates);
                        if (gateInfo) {
                            this.addGateFromMatrix(gateInfo);
                        }
                    }
                }
            }
        }
    }

    /**
     * 解析门段（连续的门格子）
     * @param {number} startX - 起始X坐标
     * @param {number} startY - 起始Y坐标
     * @param {number} gateType - 门类型
     * @param {Set} processedGates - 已处理的门格子集合
     * @returns {Object|null} 门信息
     */
    parseGateSegment(startX, startY, gateType, processedGates) {
        const color = GAME_CONFIG.BOARD_SYSTEM.GATE_COLOR_MAP[gateType];
        if (!color) return null;

        // 确定门的方向
        const direction = this.determineGateDirection(startX, startY);

        // 计算门的长度
        let length = 1;
        let currentX = startX;
        let currentY = startY;

        // 根据门的方向扩展长度
        while (true) {
            const gateKey = `${currentX},${currentY}`;
            processedGates.add(gateKey);

            let nextX = currentX;
            let nextY = currentY;

            // 根据方向计算下一个位置
            switch (direction) {
                case 'up':
                case 'down':
                    nextX = currentX + 1; // 水平扩展
                    break;
                case 'left':
                case 'right':
                    nextY = currentY + 1; // 垂直扩展
                    break;
                default:
                    break;
            }

            // 检查下一个位置是否是相同类型的门
            const nextValue = this.getCellValue(nextX, nextY);
            if (nextValue === gateType) {
                length++;
                currentX = nextX;
                currentY = nextY;
            } else {
                break;
            }
        }

        return {
            x: startX, y: startY, type: 'gate', gateType: gateType, color: color, direction: direction, length: length
        };
    }

    /**
     * 确定门的方向
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {string} 门的方向
     */
    determineGateDirection(x, y) {
        // 检查是否在边界上
        if (y === 0) return 'up';
        if (y === this.boardHeight - 1) return 'down';
        if (x === 0) return 'left';
        if (x === this.boardWidth - 1) return 'right';

        // 如果不在边界上，检查周围是否有墙
        const neighbors = this.getNeighbors(x, y);
        if (neighbors.top === GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.WALL) return 'up';
        if (neighbors.bottom === GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.WALL) return 'down';
        if (neighbors.left === GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.WALL) return 'left';
        if (neighbors.right === GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.WALL) return 'right';

        return 'unknown';
    }

    /**
     * 获取指定位置的邻居元素
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Object} 邻居元素
     */
    getNeighbors(x, y) {
        return {
            top: this.getCellValue(x, y - 1),
            bottom: this.getCellValue(x, y + 1),
            left: this.getCellValue(x - 1, y),
            right: this.getCellValue(x + 1, y)
        };
    }

    /**
     * 获取指定位置的值
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {number|null} 单元格值
     */
    getCellValue(x, y) {
        if (x < 0 || x >= this.boardWidth || y < 0 || y >= this.boardHeight) {
            return null;
        }
        return this.boardMatrix[y][x];
    }

    /**
     * 从矩阵信息添加门
     * @param {Object} gateInfo - 门信息
     */
    addGateFromMatrix(gateInfo) {
        const gateElement = {
            id: `gate_${gateInfo.color}_${gateInfo.x}_${gateInfo.y}`,
            color: gateInfo.color,
            position: {x: gateInfo.x, y: gateInfo.y},
            length: gateInfo.length || 1,
            direction: gateInfo.direction,
            layer: 0,
            gateType: gateInfo.gateType
        };
        this.gates.set(gateElement.id, gateElement);
    }

    /**
     * 基于棋盘矩阵更新网格和碰撞检测器
     */
    updateGridFromBoard() {
        if (this.boardMatrix) {
            const matrixWidth = this.boardMatrix[0] ? this.boardMatrix[0].length : ConfigUtils.getGridSize();
            const matrixHeight = this.boardMatrix.length;

            // 不修改 GRID_SIZE，使用配置中的值
            // 矩阵尺寸可能不同，但游戏逻辑基于配置的 GRID_SIZE

            // 初始化网格数组
            this.grid = Array(matrixHeight).fill().map(() => Array(matrixWidth).fill(null));

            // 初始化碰撞检测器和移动管理器（只在首次创建时）
            if (!this.collisionDetector) {
                this.collisionDetector = new CollisionDetector(this.GRID_SIZE);
                this.collisionDetector.setMapEngine(this);
            }

            if (!this.movementManager) {
                this.movementManager = new MovementManager(this.GRID_SIZE);
            }

            console.log('网格已更新:', {
                gridSize: this.GRID_SIZE, matrixWidth: matrixWidth, matrixHeight: matrixHeight
            });
        }
    }

    /**
     * 检查位置是否是有效的棋盘区域
     * 注意：screenToGrid返回的坐标需要转换为boardMatrix坐标
     * @param {number} x - X坐标 (来自screenToGrid)
     * @param {number} y - Y坐标 (来自screenToGrid)
     * @returns {boolean} 是否有效
     */
    isValidBoardPosition(x, y) {
        if (!this.boardMatrix) return false;

        // 如果坐标超出boardMatrix范围，则不可移动
        if (x < 0 || x >= this.boardWidth || y < 0 || y >= this.boardHeight) {
            return false;
        }

        const value = this.getCellValue(x, y);

        // 只有值为0的位置才是可移动的游戏区域
        return value === GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.BOARD;
    }

    /**
     * 🔧 修复：严格检查方块是否可以移动到指定位置（包含方块间重叠检测）
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {Block} block - 要移动的方块
     * @returns {boolean} 是否可以移动
     */
    isValidMovePosition(x, y, block) {
        if (!this.boardMatrix) return false;

        // 基本边界检查
        if (x < 0 || x >= this.boardWidth || y < 0 || y >= this.boardHeight) {
            return false;
        }

        // 检查方块的所有格子是否都在有效区域内且不与其他方块重叠
        const cells = block.getCells();
        for (const cell of cells) {
            const cellX = x + cell.x;
            const cellY = y + cell.y;
            
            // 1. 检查边界
            if (cellX < 0 || cellX >= this.boardWidth || cellY < 0 || cellY >= this.boardHeight) {
                return false;
            }
            
            // 2. 检查是否为0区域（游戏区域）
            const boardValue = this.getCellValue(cellX, cellY);
            if (boardValue !== 0) {
                return false;
            }

            // 🔧 3. 严格检查方块间重叠（核心规则）
            const gridValue = this.grid[cellY] && this.grid[cellY][cellX];
            if (gridValue && gridValue !== block.id) {
                // 发现方块重叠，记录详细信息
                console.log(`[重叠检测] 方块 ${block.id} 无法移动到 (${x},${y})，格子 (${cellX},${cellY}) 被方块 ${gridValue} 占据`);
                return false;
            }
        }

        return true;
    }

    /**
     * 🔧 优化：A*路径规划算法，找到最优可达位置
     * @param {Object} start - 起始位置 {x, y}
     * @param {Object} target - 目标位置 {x, y}
     * @param {Block} block - 要移动的方块
     * @returns {Object|null} 最优可达位置 {x, y} 或 null
     */
    findOptimalPosition(start, target, block) {
        // 边界检查：验证起始和目标位置
        if (!this.isValidMovePosition(start.x, start.y, block)) {
            console.warn(`[A*路径] 起始位置无效: (${start.x}, ${start.y})`);
            return null;
        }
        
        if (!this.isValidMovePosition(target.x, target.y, block)) {
            console.warn(`[A*路径] 目标位置无效: (${target.x}, ${target.y})`);
            // 目标位置无效，但继续寻找最优可达位置
        }

        const openList = [];
        const closedList = new Set();
        let bestNode = null; // 记录最接近目标的节点

        const startNode = {
            position: start, 
            g: 0, 
            h: this.calculateHeuristic(start, target), 
            f: 0, 
            parent: null
        };
        startNode.f = startNode.g + startNode.h;
        openList.push(startNode);
        bestNode = startNode; // 初始最佳节点

        while (openList.length > 0) {
            // 优化性能：更高效地找到f值最小的节点
            let currentIndex = 0;
            let minF = openList[0].f;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < minF) {
                    minF = openList[i].f;
                    currentIndex = i;
                }
            }

            const currentNode = openList.splice(currentIndex, 1)[0];
            const currentPos = currentNode.position;
            const currentKey = `${currentPos.x},${currentPos.y}`;

            closedList.add(currentKey);

            // 如果到达目标
            if (currentPos.x === target.x && currentPos.y === target.y) {
                console.log(`[A*路径] 成功找到路径: 从 (${start.x},${start.y}) 到 (${target.x},${target.y})`);
                return target;
            }

            // 修复最佳节点选择逻辑：根据移动方向选择最佳对齐的节点
            if (this.isBetterNode(currentNode, bestNode, start, target)) {
                bestNode = currentNode;
            }

            // 检查四个方向
            const directions = [
                { dx: 0, dy: -1 }, // 上
                { dx: 0, dy: 1 },  // 下
                { dx: -1, dy: 0 }, // 左
                { dx: 1, dy: 0 }   // 右
            ];

            for (const dir of directions) {
                const newX = currentPos.x + dir.dx;
                const newY = currentPos.y + dir.dy;
                const newPos = {x: newX, y: newY};
                const newKey = `${newX},${newY}`;

                if (closedList.has(newKey)) continue;
                // isValidMovePosition 已经包含完整的重叠检测，无需重复检查
                if (!this.isValidMovePosition(newX, newY, block)) continue;

                const tentativeG = currentNode.g + 1;

                // 检查是否已在开放列表中
                let existingNode = null;
                for (let i = 0; i < openList.length; i++) {
                    if (openList[i].position.x === newX && openList[i].position.y === newY) {
                        existingNode = openList[i];
                        break;
                    }
                }

                if (existingNode) {
                    if (tentativeG < existingNode.g) {
                        existingNode.g = tentativeG;
                        existingNode.f = existingNode.g + existingNode.h;
                        existingNode.parent = currentNode;
                    }
                } else {
                    const newNode = {
                        position: newPos,
                        g: tentativeG,
                        h: this.calculateHeuristic(newPos, target),
                        f: 0,
                        parent: currentNode
                    };
                    newNode.f = newNode.g + newNode.h;
                    openList.push(newNode);
                }
            }
        }

        // 如果无法到达目标，返回能到达的最远位置的路径
        if (bestNode && bestNode !== startNode) {
            const direction = this.getMainDirection(start, target);
            const score = this.calculateDirectionalScore(bestNode, direction, target);
            console.log(`[A*路径] 无法到达目标，返回最佳路径: 从 (${start.x},${start.y}) 到 (${bestNode.position.x},${bestNode.position.y})`);
            console.log(`[A*路径] 移动方向: ${direction}, 方向得分: ${score}, h值: ${bestNode.h}, g值: ${bestNode.g}`);
            return bestNode.position;
        }

        console.log(`[A*路径] 无法找到任何有效路径: 从 (${start.x},${start.y}) 到 (${target.x},${target.y})`);
        return null;
    }

    /**
     * 🔧 优化：计算启发式函数（曼哈顿距离）
     */
    calculateHeuristic(pos1, pos2) {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    }

    /**
     * 🔧 优化：判断节点是否更好（用于最佳节点选择）
     * 根据移动方向选择最佳对齐的节点
     */
    isBetterNode(node, bestNode, startPos, targetPos) {
        if (!bestNode) return true;
        
        // 计算主要移动方向
        const direction = this.getMainDirection(startPos, targetPos);
        
        // 根据方向选择最佳节点
        const nodeScore = this.calculateDirectionalScore(node, direction, targetPos);
        const bestScore = this.calculateDirectionalScore(bestNode, direction, targetPos);
        
        // 优先选择方向得分更高的节点
        if (nodeScore > bestScore) {
            return true;
        }
        
        // 如果方向得分相同，优先考虑启发式值(h值) - 距离目标更近
        if (nodeScore === bestScore) {
            if (node.h < bestNode.h) {
                return true;
            }
            
            // 如果启发式值相同，选择实际成本更低的节点(g值更小)
            if (node.h === bestNode.h && node.g < bestNode.g) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 🔧 优化：获取主要移动方向
     */
    getMainDirection(startPos, targetPos) {
        const dx = targetPos.x - startPos.x;
        const dy = targetPos.y - startPos.y;
        
        // 判断主要方向（绝对值较大的方向）
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > Math.abs(dx)) {
            return dy > 0 ? 'down' : 'up';
        } else {
            // 对角线移动，根据具体情况选择
            if (dx > 0 && dy > 0) return 'down-right';
            if (dx > 0 && dy < 0) return 'up-right';
            if (dx < 0 && dy > 0) return 'down-left';
            if (dx < 0 && dy < 0) return 'up-left';
        }
        
        return 'none';
    }
    
    /**
     * 🔧 优化：计算基于方向的节点得分
     */
    calculateDirectionalScore(node, direction, targetPos) {
        const pos = node.position;
        let score = 0;
        
        // 基础得分：距离目标越近得分越高
        const distance = this.calculateHeuristic(pos, targetPos);
        score += Math.max(0, 20 - distance); // 距离得分
        
        // 方向对齐得分：根据移动方向给予额外得分
        switch (direction) {
            case 'up':
                // 向上移动：y坐标越小（越靠上）得分越高
                score += Math.max(0, 10 - pos.y);
                break;
            case 'down':
                // 向下移动：y坐标越大（越靠下）得分越高
                score += pos.y;
                break;
            case 'left':
                // 向左移动：x坐标越小（越靠左）得分越高
                score += Math.max(0, 10 - pos.x);
                break;
            case 'right':
                // 向右移动：x坐标越大（越靠右）得分越高
                score += pos.x;
                break;
            case 'up-left':
                // 左上移动：x和y都越小得分越高
                score += Math.max(0, 10 - pos.x) + Math.max(0, 10 - pos.y);
                break;
            case 'up-right':
                // 右上移动：x越大，y越小得分越高
                score += pos.x + Math.max(0, 10 - pos.y);
                break;
            case 'down-left':
                // 左下移动：x越小，y越大得分越高
                score += Math.max(0, 10 - pos.x) + pos.y;
                break;
            case 'down-right':
                // 右下移动：x和y都越大得分越高
                score += pos.x + pos.y;
                break;
        }
        
        return score;
    }

    /**
     * 🔧 新增：智能判断是否需要调用A*算法
     * @param {Object} currentPos - 当前位置
     * @param {Object} targetPos - 目标位置
     * @param {number} now - 当前时间
     * @returns {boolean} 是否需要调用A*算法
     */
    shouldCallAStarAlgorithm(currentPos, targetPos, now) {
        // 1. 时间限制：A*算法调用间隔至少300ms
        if (this.lastAStarTime && (now - this.lastAStarTime) < 300) {
            return false;
        }
        
        // 2. 目标位置变化：如果目标位置没有变化，使用缓存
        if (this.cachedTargetPosition && 
            this.cachedTargetPosition.x === targetPos.x && 
            this.cachedTargetPosition.y === targetPos.y) {
            return false;
        }
        
        // 3. 距离变化：如果目标位置变化很小，使用缓存
        if (this.cachedTargetPosition) {
            const dx = Math.abs(targetPos.x - this.cachedTargetPosition.x);
            const dy = Math.abs(targetPos.y - this.cachedTargetPosition.y);
            if (dx <= 1 && dy <= 1) {
                return false;
            }
        }
        
        // 4. 简单路径检查：如果直线路径可达，不需要A*
        if (this.isDirectPathReachable(currentPos, targetPos)) {
            return false;
        }
        
        return true;
    }

    /**
     * 🔧 新增：检查直线路径是否可达
     * @param {Object} start - 起始位置
     * @param {Object} target - 目标位置
     * @returns {boolean} 直线路径是否可达
     */
    isDirectPathReachable(start, target) {
        const dx = target.x - start.x;
        const dy = target.y - start.y;
        
        // 如果距离很近，直接检查
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            return this.isValidMovePosition(target.x, target.y, this.selectedBlock);
        }
        
        // 检查直线路径上的障碍物
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        const stepX = dx / steps;
        const stepY = dy / steps;
        
        for (let i = 1; i <= steps; i++) {
            const checkX = Math.round(start.x + stepX * i);
            const checkY = Math.round(start.y + stepY * i);
            
            if (!this.isValidMovePosition(checkX, checkY, this.selectedBlock)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 🔧 新增：验证移动结果
     * @param {number} x - 移动后的X坐标
     * @param {number} y - 移动后的Y坐标
     * @returns {boolean} 移动结果是否有效
     */
    validateMoveResult(x, y) {
        if (!this.selectedBlock) return false;
        
        const cells = this.selectedBlock.getCells();
        for (const cell of cells) {
            const cellX = x + cell.x;
            const cellY = y + cell.y;
            
            // 检查网格状态是否一致
            if (this.grid[cellY][cellX] !== this.selectedBlock.id) {
                console.error('[移动验证] 网格状态不一致:', {
                    position: { cellX, cellY },
                    expected: this.selectedBlock.id,
                    actual: this.grid[cellY][cellX]
                });
                return false;
            }
        }
        
        return true;
    }

    /**
     * 🔧 新增：回滚移动操作
     * @param {Object} originalPos - 原始位置
     * @param {number} failedX - 失败的X坐标
     * @param {number} failedY - 失败的Y坐标
     */
    rollbackMove(originalPos, failedX, failedY) {
        if (!this.selectedBlock) return;
        
        try {
            // 🔧 修复：清除失败位置的所有格子
            const currentCells = this.selectedBlock.getCells();
            for (const cell of currentCells) {
                const cellX = this.selectedBlock.position.x + cell.x;
                const cellY = this.selectedBlock.position.y + cell.y;
                if (this.grid[cellY] && this.grid[cellY][cellX] === this.selectedBlock.id) {
                    this.grid[cellY][cellX] = 0;
                }
            }
            
            // 恢复原始位置
            this.selectedBlock.position.x = originalPos.x;
            this.selectedBlock.position.y = originalPos.y;
            
            // 🔧 修复：恢复原始位置的所有格子
            const originalCells = this.selectedBlock.getCells();
            for (const cell of originalCells) {
                const cellX = originalPos.x + cell.x;
                const cellY = originalPos.y + cell.y;
                if (this.grid[cellY] && this.grid[cellY][cellX] !== undefined) {
                    this.grid[cellY][cellX] = this.selectedBlock.id;
                }
            }
            
            console.log('[回滚] 已恢复到原始位置:', originalPos);
        } catch (error) {
            console.error('[回滚] 回滚操作失败:', error);
        }
    }
}

// CommonJS 导出（抖音小游戏规范）
module.exports = {
    MapEngine: MapEngine
};

