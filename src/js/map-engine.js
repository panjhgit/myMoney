/**
 * 多层方块 Puzzle 游戏引擎 - 模块化版
 * 核心特性：8*8网格 + 多层结构 + 智能路径规划 + 颜色通关
 */

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
            colorChanger: { count: 3, name: '颜色转换剂', icon: '🎨' },
            bomb: { count: 2, name: '炸弹', icon: '💣' },
            shuffle: { count: 1, name: '重新打乱', icon: '🔀' }
        };
        this.selectedItem = null;

        // 如果提供了参数，立即设置渲染上下文
        if (ctx && systemInfo) {
            this.setRenderContext(ctx, systemInfo);
        }

        // 使用全局配置

        // 元素类型碰撞规则配置
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
                        if (this.collisionDetector.isValidPosition(cell.x, cell.y)) {
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
                    if (this.collisionDetector.isValidPosition(x, y)) {
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
        
        this.selectedBlock = block;
        
        // 🔧 优化：选择方块后触发重绘
        this.triggerRedraw();

        return true;
    }

    /**
     * 触发重绘（统一方法）
     */
    triggerRedraw() {
        if (typeof markNeedsRedraw === 'function') {
            markNeedsRedraw();
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

        this.updateGrid();
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
        // 检查GSAP是否可用
        if (typeof gsap === 'undefined') {
            console.log('GSAP 不可用，直接移除方块');
            this.removeBlockAfterAnimation(block, gate);
            return;
        }

        const animationId = `block_eliminate_${block.id}`;
        
        // 设置方块状态为消除中
        block.state = 'eliminating';
        block.isEliminating = true;

        // 创建闪烁动画时间线
        const timeline = gsap.timeline({
            onUpdate: () => {
                // 动画进行时持续重绘
                if (typeof markNeedsRedraw === 'function') {
                    markNeedsRedraw();
                }
            },
            onComplete: () => {
                // 动画完成后移除方块
                this.removeBlockAfterAnimation(block, gate);
                
                // 清理动画
                if (this.animations) {
                    this.animations.delete(animationId);
                }
            }
        });

        // 保存动画引用
        if (this.animations) {
            this.animations.set(animationId, timeline);
        }

        // 闪烁动画：透明度在0.2和1之间快速变化
        timeline.to(block, {
            alpha: 0.2,
            duration: 0.1,
            ease: "power2.out"
        })
        .to(block, {
            alpha: 1,
            duration: 0.1,
            ease: "power2.out"
        })
        .to(block, {
            alpha: 0.2,
            duration: 0.1,
            ease: "power2.out"
        })
        .to(block, {
            alpha: 1,
            duration: 0.1,
            ease: "power2.out"
        })
        .to(block, {
            alpha: 0.2,
            duration: 0.1,
            ease: "power2.out"
        })
        .to(block, {
            alpha: 1,
            duration: 0.1,
            ease: "power2.out"
        })
        // 最后淡出
        .to(block, {
            alpha: 0,
            scale: 0.8,
            duration: 0.3,
            ease: "power2.out"
        });

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
        if (window.onLevelComplete) {
            window.onLevelComplete(this.currentLevel);
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

        // 绘制UI
        this.drawUI();

        // 绘制弹窗
        this.drawDialog();
    }

    /**
     * 绘制背景
     */
    drawBackground() {
        if (!this.ctx) return;

        // 确保系统信息有效
        const windowWidth = this.systemInfo && this.systemInfo.windowWidth ? 
            Number(this.systemInfo.windowWidth) || 375 : 375;
        const windowHeight = this.systemInfo && this.systemInfo.windowHeight ? 
            Number(this.systemInfo.windowHeight) || 667 : 667;

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
     * 绘制游戏区域（根据boardMatrix绘制不规则游戏区域）
     */
    drawGameArea(matrix) {
        if (!matrix || matrix.length === 0) return;
        
        const matrixWidth = matrix[0].length;
        const matrixHeight = matrix.length;
        const maxSize = Math.max(matrixWidth, matrixHeight);
        const totalSize = maxSize * this.cellSize;
        
        // 使用系统信息获取画布尺寸，确保是有效数字
        const canvasWidth = this.systemInfo && this.systemInfo.windowWidth ? 
            Number(this.systemInfo.windowWidth) || 375 : 375;
        const canvasHeight = this.systemInfo && this.systemInfo.windowHeight ? 
            Number(this.systemInfo.windowHeight) || 667 : 667;
        
        // 计算居中位置
        const centerX = (canvasWidth - totalSize) / 2;
        const centerY = (canvasHeight - totalSize) / 2;
        
        // 绘制游戏区域背景（浅蓝色）
        this.ctx.fillStyle = GAME_CONFIG.RENDER_COLORS.GAME_AREA_BACKGROUND;
        this.ctx.fillRect(centerX, centerY, totalSize, totalSize);
        
        // 绘制外边框（细线）
        this.ctx.strokeStyle = GAME_CONFIG.RENDER_COLORS.GAME_AREA_BORDER;
        this.ctx.lineWidth = GAME_CONFIG.STYLES.LINE_WIDTH_THIN;
        this.ctx.strokeRect(centerX, centerY, totalSize, totalSize);
        
        // 绘制内部网格线（分隔所有格子）
        for (let i = 1; i < maxSize; i++) {
            const lineX = centerX + i * this.cellSize;
            const lineY = centerY + i * this.cellSize;
            
            // 垂直线
            this.ctx.beginPath();
            this.ctx.moveTo(lineX, centerY);
            this.ctx.lineTo(lineX, centerY + totalSize);
            this.ctx.stroke();
            
            // 水平线
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, lineY);
            this.ctx.lineTo(centerX + totalSize, lineY);
            this.ctx.stroke();
        }
        
        // 更新偏移量，让方块绘制知道游戏区域的位置
        this.gridOffsetX = centerX;
        this.gridOffsetY = centerY;
    }
    
    /**
     * 绘制管道边框（门和墙，根据boardMatrix绘制不规则边界）
     */
    drawPipeBorder(matrix) {
        if (!matrix || matrix.length === 0) return;
        
        const pipeThickness = 8; // 管道厚度
        const matrixWidth = matrix[0].length;
        const matrixHeight = matrix.length;
        
        // 根据boardMatrix绘制墙和门
        for (let y = 0; y < matrixHeight; y++) {
            for (let x = 0; x < matrixWidth; x++) {
                const elementType = matrix[y][x];
                
                if (elementType === 1) {
                    // 绘制墙
                    this.drawWall(x, y, pipeThickness);
                } else if (elementType >= 2 && elementType <= 9) {
                    // 绘制门
                    this.drawGate(x, y, elementType, pipeThickness);
                }
            }
        }
    }
    
    /**
     * 绘制墙（完整45px格子）
     */
    drawWall(x, y, thickness) {
        const wallX = this.gridOffsetX + x * this.cellSize;
        const wallY = this.gridOffsetY + y * this.cellSize;
        
        // 绘制墙背景（实心灰色）
        this.ctx.fillStyle = GAME_CONFIG.RENDER_COLORS.PIPE_BACKGROUND;
        this.ctx.fillRect(wallX, wallY, this.cellSize, this.cellSize);
        
        // 绘制墙边框
        this.ctx.strokeStyle = GAME_CONFIG.RENDER_COLORS.PIPE_BACKGROUND;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(wallX, wallY, this.cellSize, this.cellSize);
    }
    
    /**
     * 绘制门（完整45px格子）
     */
    drawGate(x, y, gateType, thickness) {
        const gateX = this.gridOffsetX + x * this.cellSize;
        const gateY = this.gridOffsetY + y * this.cellSize;
        
        // 获取门颜色
        const color = GAME_CONFIG.BOARD_SYSTEM.GATE_COLOR_MAP[gateType];
        const gateColor = this.getBlockColor(color);
        
        // 绘制门背景（实心彩色）
        this.ctx.fillStyle = this.convertToRgba(gateColor, 1.0);
        this.ctx.fillRect(gateX, gateY, this.cellSize, this.cellSize);
        
        // 绘制门边框
        this.ctx.strokeStyle = gateColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(gateX, gateY, this.cellSize, this.cellSize);
    }
    
    
    /**
     * 绘制坐标标签（适应不规则地图）
     */
    drawCoordinateLabels() {
        if (!this.ctx || !this.boardMatrix) return;
        
        const matrixWidth = this.boardMatrix[0].length;
        const matrixHeight = this.boardMatrix.length;
        const pipeThickness = 12; // 管道厚度
        
        // 设置文字样式
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#333333';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 绘制X轴坐标标签（列号）
        for (let x = 0; x < matrixWidth; x++) {
            const labelX = this.gridOffsetX + x * this.cellSize + this.cellSize / 2;
            const labelY = this.gridOffsetY - pipeThickness / 2;
            
            // 顶部标签
            this.ctx.fillText(x.toString(), labelX, labelY);
            
            // 底部标签
            const bottomLabelY = this.gridOffsetY + matrixHeight * this.cellSize + pipeThickness / 2;
            this.ctx.fillText(x.toString(), labelX, bottomLabelY);
        }
        
        // 绘制Y轴坐标标签（行号）
        for (let y = 0; y < matrixHeight; y++) {
            const labelX = this.gridOffsetX - pipeThickness / 2;
            const labelY = this.gridOffsetY + y * this.cellSize + this.cellSize / 2;
            
            // 左侧标签
            this.ctx.fillText(y.toString(), labelX, labelY);
            
            // 右侧标签
            const rightLabelX = this.gridOffsetX + matrixWidth * this.cellSize + pipeThickness / 2;
            this.ctx.fillText(y.toString(), rightLabelX, labelY);
        }
        
        // 绘制墙和门的坐标标签
        this.drawWallAndGateLabels(matrixWidth, matrixHeight, pipeThickness);
    }
    
    /**
     * 绘制墙和门的坐标标签（适合45px格子）
     */
    drawWallAndGateLabels(matrixWidth, matrixHeight, pipeThickness) {
        // 设置标签样式
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 遍历boardMatrix，为墙和门添加标签
        for (let y = 0; y < matrixHeight; y++) {
            for (let x = 0; x < matrixWidth; x++) {
                const elementType = this.boardMatrix[y][x];
                
                if (elementType === 1) {
                    // 墙标签
                    this.ctx.fillStyle = '#FFFFFF'; // 白色，在灰色墙上更清楚
                    const labelX = this.gridOffsetX + x * this.cellSize + this.cellSize / 2;
                    const labelY = this.gridOffsetY + y * this.cellSize + this.cellSize / 2;
                    this.ctx.fillText('墙', labelX, labelY);
                } else if (elementType >= 2 && elementType <= 9) {
                    // 门标签
                    this.ctx.fillStyle = '#FFFFFF'; // 白色，在各种颜色门上更清楚
                    const labelX = this.gridOffsetX + x * this.cellSize + this.cellSize / 2;
                    const labelY = this.gridOffsetY + y * this.cellSize + this.cellSize / 2;
                    this.ctx.fillText(`${elementType}`, labelX, labelY); // 只显示门编号，更简洁
                }
            }
        }
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
     * 将十六进制颜色转换为RGBA格式
     */
    convertToRgba(hexColor, alpha) {
        // 移除 # 符号
        const hex = hexColor.replace('#', '');
        
        // 解析RGB值
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
            x: this.gridOffsetX + cell.x * this.cellSize,
            y: this.gridOffsetY + cell.y * this.cellSize
        };
    }

    /**
     * Canvas绘制工具函数
     */
    drawLine(x1, y1, x2, y2) {
            this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
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
            const windowHeight = this.systemInfo && this.systemInfo.windowHeight ? 
                Number(this.systemInfo.windowHeight) || 667 : 667;
            this.ctx.fillText('点击目标位置移动方块', 20, windowHeight - 20);
        }
    }

    /**
     * 绘制道具栏
     */
    drawItemBar() {
        if (!this.ctx) return;

        const windowWidth = this.systemInfo && this.systemInfo.windowWidth ? 
            Number(this.systemInfo.windowWidth) || 375 : 375;
        const windowHeight = this.systemInfo && this.systemInfo.windowHeight ? 
            Number(this.systemInfo.windowHeight) || 667 : 667;

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
        
        // 检查是否有方块正在移动
        if (this.isAnyBlockMoving()) {
            return;
        }
        
        // 检查是否点击了道具栏
        if (this.handleItemBarClick(x, y)) {
            return;
        }
        
        const gridPos = this.screenToGrid(x, y);

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
            console.log(`[点击调试] 点击空白区域，但没有选中的方块`);
        }
    }
    
    /**
     * 处理道具栏点击
     */
    handleItemBarClick(x, y) {
        const windowHeight = this.systemInfo && this.systemInfo.windowHeight ? 
            Number(this.systemInfo.windowHeight) || 667 : 667;
        const windowWidth = this.systemInfo && this.systemInfo.windowWidth ? 
            Number(this.systemInfo.windowWidth) || 375 : 375;

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
     * 使用选中的道具
     */
    useSelectedItem(targetPos = null) {
        if (!this.selectedItem) {
            console.log('[道具] 没有选中任何道具');
            return false;
        }

        const item = this.items[this.selectedItem];
        if (item.count <= 0) {
            console.log(`[道具] ${item.name} 数量不足`);
            return false;
        }

        console.log(`[道具] 使用 ${item.name}`);
        
        // 减少道具数量
        item.count--;
        
        // 根据道具类型执行不同效果
        switch (this.selectedItem) {
            case 'colorChanger':
                this.useColorChanger(targetPos);
                break;
            case 'bomb':
                this.useBomb(targetPos);
                break;
            case 'shuffle':
                this.useShuffle();
                break;
        }
        
        // 使用后取消选中
        this.selectedItem = null;
        return true;
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
                id: gate.id,
                color: gate.color,
                length: gate.length,
                direction: gate.direction,
                x: gate.x,
                y: gate.y
            });
        }
        
        return gates;
    }

    /**
     * 使用炸弹（功能待开发）
     * 计划：清除目标位置周围的方块
     */
    useBomb(targetPos) {
        console.log('[道具] 炸弹效果 - 功能待开发');
        // 功能说明：清除目标位置周围3x3范围内的方块
        // 实现思路：1. 计算爆炸范围 2. 移除范围内的方块 3. 更新网格
    }

    /**
     * 使用重新打乱（功能待开发）
     * 计划：重新随机排列所有方块位置
     */
    useShuffle() {
        console.log('[道具] 重新打乱效果 - 功能待开发');
        // 功能说明：重新随机排列所有可移动方块的位置
        // 实现思路：1. 收集所有方块 2. 随机分配新位置 3. 检查碰撞并调整
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

        // 检查起始位置是否有方块
        if (!this.collisionDetector.isValidPosition(startGridPos.x, startGridPos.y)) {
            return;
        }

        const gridValue = this.grid[startGridPos.y][startGridPos.x];
        if (!gridValue || !this.blocks.has(gridValue)) {
            return;
        }

        const draggedBlock = this.blocks.get(gridValue);
        if (!draggedBlock.movable) {
            return;
        }

        // 检查拖动是否有效（相邻移动且无障碍）
        if (this.movementManager.isValidDrag(draggedBlock, startGridPos, endGridPos, this)) {
            // 执行拖动移动
            this.movementManager.dragMove(draggedBlock, startGridPos, endGridPos, this);
        } else {
            console.warn('拖动无效：不能跨过障碍或移动距离过远');
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
                    // 记录拖动的起始位置
                    this.dragStartPos = {x: gridPos.x, y: gridPos.y};
                    this.dragStartScreenPos = {x, y};
                    this.isDragging = true;
                }
            }
        }
    }
    
    /**
     * 处理鼠标移动事件
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    handleMouseMove(x, y) {
        if (this.isDragging && this.dragStartPos) {
            // 可以在这里添加拖动预览效果
            // 比如高亮目标位置或显示移动路径
        }
    }
    
    /**
     * 处理鼠标释放事件
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    handleMouseUp(x, y) {
        if (this.isDragging && this.dragStartPos) {
            const endGridPos = this.screenToGrid(x, y);
            
            // 检查是否移动到了不同的格子
            if (endGridPos.x !== this.dragStartPos.x || endGridPos.y !== this.dragStartPos.y) {
                // 执行拖动移动
                this.handleDrag(
                    this.dragStartScreenPos.x, 
                    this.dragStartScreenPos.y, 
                    x, 
                    y
                );
            }
            
            // 重置拖动状态
            this.isDragging = false;
            this.dragStartPos = null;
            this.dragStartScreenPos = null;
        }
    }


    /**
     * 屏幕坐标转网格坐标
     */
    screenToGrid(screenX, screenY) {
        // 确保坐标是有效数字
        const x = Number(screenX) || 0;
        const y = Number(screenY) || 0;
        
        // 确保偏移量和格子大小是有效数字
        const offsetX = Number(this.gridOffsetX) || 0;
        const offsetY = Number(this.gridOffsetY) || 0;
        const cellSize = Number(this.cellSize) || 45;
        
        const gridX = Math.floor((x - offsetX) / cellSize);
        const gridY = Math.floor((y - offsetY) / cellSize);
        
        return {x: gridX, y: gridY};
    }

    // ==================== 棋盘矩阵系统方法（整合自BoardSystem） ====================

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
                gridSize: this.GRID_SIZE, 
                matrixWidth: matrixWidth, 
                matrixHeight: matrixHeight
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
        // 门(2-9)和墙(1)的渲染只是为了美观，不是真实的碰撞边界
        return value === GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.BOARD;
    }

    /**
     * 检查位置是否是墙
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {boolean} 是否是墙
     */
    isWall(x, y) {
        if (!this.boardMatrix) return false;

        const value = this.getCellValue(x, y);
        return value === GAME_CONFIG.BOARD_SYSTEM.ELEMENT_TYPES.WALL;
    }

    /**
     * 检查位置是否是门
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Object|null} 门信息或null
     */
    getGateAt(x, y) {
        if (!this.boardMatrix) return null;

        const value = this.getCellValue(x, y);
        if (value >= 2 && value <= 9) {
            const color = GAME_CONFIG.BOARD_SYSTEM.GATE_COLOR_MAP[value];
            return {
                x, y, gateType: value, color: color, direction: this.determineGateDirection(x, y)
            };
        }
        return null;
    }

    /**
     * 调试方法：打印所有棋盘元素的位置和层级信息
     */
    debugPrintBoardElements() {
        console.log('=== 棋盘元素调试信息 ===');
        
        // 打印第0层方块
        console.log('\n--- 第0层方块 (可移动) ---');
        const layer0Blocks = this.getBlocksByLayer(0);
        layer0Blocks.forEach(block => {
            const cells = this.collisionDetector.getBlockCells(block);
            console.log(`${block.id} (${block.color}, ${block.type}):`, {
                position: block.position,
                cells: cells,
                movable: block.movable
            });
        });
        
        // 打印第1层及以下方块（冰块）
        console.log('\n--- 第1层及以下方块 (冰块) ---');
        const lowerBlocks = this.getLowerLayerBlocks();
        lowerBlocks.forEach(block => {
            const cells = this.collisionDetector.getBlockCells(block);
            console.log(`${block.id} (${block.color}, ${block.type}):`, {
                position: block.position,
                cells: cells,
                layer: block.layer,
                isIce: block.ice.isIce,
                isRevealed: block.ice.isRevealed
            });
        });
        
        // 打印石块
        console.log('\n--- 石块 ---');
        this.rocks.forEach(rockKey => {
            const [x, y] = rockKey.split(',').map(Number);
            console.log(`rock_${x}_${y}:`, { position: {x, y} });
        });
        
        // 打印门
        console.log('\n--- 门 ---');
        this.gates.forEach((gate, gateId) => {
            console.log(`${gateId}:`, {
                color: gate.color,
                position: gate.position,
                direction: gate.direction,
                length: gate.length
            });
        });
        
        // 打印网格状态
        console.log('\n--- 网格状态 (8x8游戏区域) ---');
        for (let y = 1; y <= 8; y++) {
            let row = '';
            for (let x = 1; x <= 8; x++) {
                const gridValue = this.grid[y] && this.grid[y][x];
                if (gridValue) {
                    row += gridValue.toString().padStart(3);
                } else {
                    row += '  .';
                }
            }
            console.log(`第${y}行: ${row}`);
        }
        
        // 检查重叠
        console.log('\n--- 重叠检查 ---');
        this.checkOverlaps();
        
        console.log('=== 调试信息结束 ===\n');
    }
    
    /**
     * 检查方块重叠
     */
    checkOverlaps() {
        const allBlocks = Array.from(this.blocks.values());
        const occupiedPositions = new Map();
        
        // 检查第0层方块重叠
        const layer0Blocks = allBlocks.filter(block => block.layer === 0);
        layer0Blocks.forEach(block => {
            const cells = this.collisionDetector.getBlockCells(block);
            cells.forEach(cell => {
                const key = `${cell.x},${cell.y}`;
                if (occupiedPositions.has(key)) {
                    console.warn(`⚠️  重叠警告: ${block.id} 与 ${occupiedPositions.get(key)} 在位置 (${cell.x}, ${cell.y}) 重叠`);
                } else {
                    occupiedPositions.set(key, block.id);
                }
            });
        });
        
        // 检查石块与方块重叠
        this.rocks.forEach(rockKey => {
            const [x, y] = rockKey.split(',').map(Number);
            const key = `${x},${y}`;
            if (occupiedPositions.has(key)) {
                console.warn(`⚠️  石块重叠警告: 石块在位置 (${x}, ${y}) 与方块 ${occupiedPositions.get(key)} 重叠`);
            }
        });
        
        if (occupiedPositions.size === 0) {
            console.log('✅ 没有发现重叠问题');
        }
    }
}

// 导出到全局作用域
window.MapEngine = MapEngine;

// 全局调试函数
window.debugMap = function() {
    if (window.mapEngine) {
        window.mapEngine.debugPrintBoardElements();
    } else {
        console.log('MapEngine 未初始化，请先加载地图');
    }
};
