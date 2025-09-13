/**
 * 多层方块 Puzzle 游戏引擎 - 模块化版
 * 核心特性：8*8网格 + 多层结构 + 智能路径规划 + 颜色通关
 */

class MapEngine {
    constructor() {
        // 基础配置
        this.GRID_SIZE = GAME_CONFIG.GRID_SIZE;
        this.MAX_LAYERS = 10;

        // 核心数据结构
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(null));
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
        this.cellSize = GAME_CONFIG.CELL_SIZE;
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;

        // 模块
        this.collisionDetector = new CollisionDetector(this.GRID_SIZE);
        this.movementManager = new MovementManager(this.GRID_SIZE);

        // 动画管理
        this.animations = new Map();

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

        // 调试开关
        this.debugMode = true;

        /**
         * 调试日志方法
         */
        this.debugLog = (...args) => {
            if (this.debugMode) {
                console.log(...args);
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

        // 加载门
        if (mapData.gates) {
            mapData.gates.forEach(gate => this.addGate(gate));
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
        this.grid.forEach(row => row.fill(null));
        this.blocks.clear();
        this.gates.clear();
        this.rocks.clear();
        this.selectedBlock = null;
        this.animations.clear();
    }

    /**
     * 添加门
     */
    addGate(gate) {
        const gateElement = {
            id: gate.id,
            color: gate.color,
            position: gate.position,
            size: gate.size,
            direction: gate.direction,
            layer: 0
        };
        this.gates.set(gate.id, gateElement);
    }

    /**
     * 添加方块
     */
    addBlock(block) {
        console.log(`[添加方块] ${block.id}: layer=${block.layer}, color=${block.color}`);

        if (typeof createCreature === 'undefined') {
            console.error('createCreature 函数未找到');
            return;
        }

        let colorData = block.colorData;
        if (!colorData && typeof BLOCK_COLORS !== 'undefined') {
            colorData = BLOCK_COLORS[block.color];
        }

        if (!colorData) {
            console.error('无法找到颜色数据:', block.color);
            return;
        }

        const blockElement = createCreature(block.position.y, block.position.x, colorData);
        if (!blockElement) {
            console.error('方块创建失败:', block);
            return;
        }

        const element = {
            id: blockElement.id,
            type: 'tetris',
            color: blockElement.color,
            position: block.position,
            initialPosition: {...block.position},
            shapeData: blockElement.shapeData,
            layer: block.layer || 0,
            movable: (block.layer || 0) === 0, // 只有第0层才能移动
            blockElement: blockElement
        };

        console.log(`[添加方块] 创建的元素: id=${element.id}, layer=${element.layer}, movable=${element.movable}`);
        console.log(`[添加方块] 原始方块ID: ${block.id}, 新生成ID: ${blockElement.id}`);
        this.blocks.set(element.id, element);
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
     * 更新网格数据
     */
    updateGrid() {
        console.log(`[更新网格] 开始更新网格，方块数量: ${this.blocks.size}`);

        // 清空网格
        this.grid.forEach(row => row.fill(null));

        // 按层级顺序填充网格
        for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
            let layerBlockCount = 0;
            // 添加方块
            this.blocks.forEach(block => {
                if (block.layer === layer) {
                    layerBlockCount++;
                    const cells = this.collisionDetector.getBlockCells(block);
                    cells.forEach(cell => {
                        if (this.collisionDetector.isValidPosition(cell.x, cell.y)) {
                            this.grid[cell.y][cell.x] = block.id;
                        }
                    });
                }
            });

            if (layerBlockCount > 0) {
                console.log(`[更新网格] 第${layer}层: ${layerBlockCount}个方块`);
            }

            // 添加石块
            if (layer === 0) {
                this.rocks.forEach(rockKey => {
                    const [x, y] = rockKey.split(',').map(Number);
                    if (this.collisionDetector.isValidPosition(x, y)) {
                        this.grid[y][x] = 'rock';
                    }
                });
            }
        }

        console.log(`[更新网格] 网格更新完成`);
    }

    /**
     * 选择方块
     */
    selectBlock(blockId) {
        console.log(`[选择] 尝试选择方块: ${blockId}`);
        const block = this.blocks.get(blockId);
        if (!block) {
            console.log(`[选择] 方块不存在: ${blockId}`);
            return false;
        }

        console.log(`[选择] 方块属性: layer=${block.layer}, movable=${block.movable}`);
        if (!block.movable) {
            console.log(`[选择] 方块不可移动: ${blockId}`);
            return false;
        }

        this.selectedBlock = block;
        console.log(`[选择] 成功选择方块: ${blockId}`);
        return true;
    }

    /**
     * 移动方块到指定位置
     */
    moveBlock(blockId, targetX, targetY) {
        const block = this.blocks.get(blockId);
        if (!block) return false;

        const startPos = {...block.position};
        const targetPos = this.movementManager.calculateTargetPosition(block, {
            x: targetX, y: targetY
        }, this.collisionDetector);

        // 使用A*算法计算路径
        const path = this.movementManager.calculatePath(block, startPos, targetPos, this.collisionDetector, this.grid, this.blocks, this.rocks);

        if (path.length === 0) {
            console.log('无法找到路径');
        return false;
    }

        // 执行移动
        this.movementManager.executeMove(block, path, this);
        return true;
    }

    /**
     * 检查冰块融化
     */
    checkIceMelting() {
        // 检查所有下层方块（冰块）
        for (let layer = 1; layer < this.MAX_LAYERS; layer++) {
            this.blocks.forEach(block => {
                if (block.layer === layer) {
                    // 检查方块是否被覆盖
                    const isCovered = !this.collisionDetector.isBlockFullyRevealed(block, this.grid, this.blocks);

                    if (!isCovered && block.meltProgress < 100) {
                        // 开始融化
                        if (!block.meltProgress) {
                            block.meltProgress = 0;
                        }
                        block.meltProgress += 2; // 每帧融化2%

                        if (block.meltProgress >= 100) {
                            this.completeIceMelting(block);
                        }
                    }
                }
            });
        }
    }

    /**
     * 完成冰块融化
     */
    completeIceMelting(block) {
        console.log(`冰块 ${block.id} 融化完成`);
        this.revealBlock(block);
    }

    /**
     * 检查层级显露（移动后调用）
     */
    checkLayerReveal(movedBlock) {
        console.log(`[层级显露] 检查方块 ${movedBlock.id} 移动后的下层显露`);

        // 检查所有下层方块，看是否有完全显露的
        for (let layer = 1; layer < this.MAX_LAYERS; layer++) {
            this.blocks.forEach(block => {
                if (block.layer === layer && block.id !== movedBlock.id) {
                    // 检查这个下层方块是否完全显露
                    const isFullyRevealed = this.collisionDetector.isBlockFullyRevealed(block, this.grid, this.blocks);

                    if (isFullyRevealed) {
                        console.log(`[层级显露] 方块 ${block.id} 完全显露，开始融化`);
                        this.revealBlock(block);
                    }
                }
            });
        }
    }

    /**
     * 显露方块
     */
    revealBlock(block) {
        console.log(`显露方块: ${block.id}`);
        block.layer = 0;
        block.movable = true;
        this.updateGrid();
    }

    /**
     * 检查出门条件
     */
    checkGateExit(block) {
        this.gates.forEach(gate => {
            const exitResult = this.collisionDetector.canExitThroughGate(block, gate);
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

        // 移除方块
        this.blocks.delete(block.id);
        this.selectedBlock = null;
        this.updateGrid();

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
     */
    isBlockAtGate(block, gate) {
        const blockCells = this.collisionDetector.getBlockCells(block);

        // 检查方块的任何一格是否在门的位置
        return blockCells.some(cell => {
            switch (gate.direction) {
                case 'up':
                    // 门在上方，检查方块是否在门下方
                    return cell.x >= gate.position.x && cell.x < gate.position.x + gate.size.width && cell.y === gate.position.y + gate.size.height;
                case 'down':
                    // 门在下方，检查方块是否在门上方
                    return cell.x >= gate.position.x && cell.x < gate.position.x + gate.size.width && cell.y === gate.position.y - 1;
                case 'left':
                    // 门在左侧，检查方块是否在门右侧
                    return cell.y >= gate.position.y && cell.y < gate.position.y + gate.size.height && cell.x === gate.position.x + gate.size.width;
                case 'right':
                    // 门在右侧，检查方块是否在门左侧
                    return cell.y >= gate.position.y && cell.y < gate.position.y + gate.size.height && cell.x === gate.position.x - 1;
                default:
                    return false;
            }
        });
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
            windowWidth,
            windowHeight,
            cellSize: this.cellSize,
            gridSize: this.gridSize,
            gridOffsetX: this.gridOffsetX,
            gridOffsetY: this.gridOffsetY
        });
    }

    /**
     * 渲染游戏
     */
    render() {
        if (!this.ctx) return;

        // 绘制背景
        this.drawBackground();

        // 绘制地图网格和边框
        this.drawMapGrid();

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

        // 渐变背景
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.systemInfo.windowHeight);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#4682B4');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.systemInfo.windowWidth, this.systemInfo.windowHeight);
    }

    /**
     * 绘制地图网格和边框
     */
    drawMapGrid() {
        if (!this.ctx) return;

        const borderWidth = 3;
        const borderAlpha = 0.8;
        const ctx = this.ctx;

        // 绘制边框
        const boardWidth = this.GRID_SIZE * this.cellSize;
        const boardHeight = this.GRID_SIZE * this.cellSize;
        const startX = this.gridOffsetX;
        const startY = this.gridOffsetY;

        // 绘制外边框
        ctx.strokeStyle = `rgba(255, 255, 255, ${borderAlpha})`;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(startX - borderWidth / 2, startY - borderWidth / 2, boardWidth + borderWidth, boardHeight + borderWidth);

        // 绘制门在边框上
        this.drawGatesOnBorder(ctx, borderWidth, borderAlpha);

        // 绘制坐标标签
        this.drawCoordinateLabels(ctx);
    }

    /**
     * 绘制坐标标签
     */
    drawCoordinateLabels(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        // 绘制行标签 (Y坐标)
        for (let i = 0; i < this.GRID_SIZE; i++) {
            const y = this.gridOffsetY + i * this.cellSize + this.cellSize / 2;
            ctx.fillText(i.toString(), this.gridOffsetX - 15, y + 4);
        }

        // 绘制列标签 (X坐标)
        for (let i = 0; i < this.GRID_SIZE; i++) {
            const x = this.gridOffsetX + i * this.cellSize + this.cellSize / 2;
            ctx.fillText(i.toString(), x, this.gridOffsetY - 8);
        }
    }

    /**
     * 绘制门在边框上
     */
    drawGatesOnBorder(ctx, borderWidth, borderAlpha) {
        this.gates.forEach(gate => {
            const color = this.getBlockColor(gate.color);
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
     * 绘制棋盘
     */
    drawBoard() {
        if (!this.ctx) return;

        // 使用与drawMapGrid相同的坐标系统
        const boardWidth = this.GRID_SIZE * this.cellSize;
        const boardHeight = this.GRID_SIZE * this.cellSize;
        const startX = this.gridOffsetX;
        const startY = this.gridOffsetY;

        // 绘制棋盘背景 - 灰色
        this.ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
        this.ctx.fillRect(startX, startY, boardWidth, boardHeight);

        // 绘制网格线 - 深灰色
        this.ctx.strokeStyle = 'rgba(64, 64, 64, 0.6)';
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
     * 获取方块颜色
     */
    getBlockColor(colorName) {
        // 首先尝试从 BLOCK_COLORS 获取颜色数据
        if (typeof BLOCK_COLORS !== 'undefined' && BLOCK_COLORS[colorName]) {
            const colorData = BLOCK_COLORS[colorName];
            // 从渐变字符串中提取基础颜色
            if (colorData.gradient) {
                const gradientMatch = colorData.gradient.match(/#[0-9A-Fa-f]{6}/);
                if (gradientMatch) {
                    return gradientMatch[0];
                }
            }
        }

        // 备用颜色定义
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
     * 绘制石块
     */
    drawRocks() {
        this.rocks.forEach(rockKey => {
            const [x, y] = rockKey.split(',').map(Number);
            const screenX = this.gridOffsetX + x * this.cellSize;
            const screenY = this.gridOffsetY + y * this.cellSize;

            // 石块主体 - 棕色
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(screenX, screenY, this.cellSize, this.cellSize);

            // 石块边框
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(screenX, screenY, this.cellSize, this.cellSize);

            // 石块纹理
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillRect(screenX + 2, screenY + 2, this.cellSize - 4, this.cellSize - 4);

            // 石块高光
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.fillRect(screenX + 4, screenY + 4, this.cellSize - 8, this.cellSize - 8);
        });
    }

    /**
     * 绘制冰块（淡色渲染）
     */
    drawIceBlocks() {
        this.blocks.forEach(block => {
            if (block.layer > 0 && !this.collisionDetector.isBlockFullyRevealed(block, this.grid, this.blocks)) {
                const cells = this.collisionDetector.getBlockCells(block);

                // 根据融化进度调整透明度
                const meltProgress = block.meltProgress || 0;
                const iceAlpha = 0.8 - (meltProgress / 100) * 0.5; // 融化时变透明

                // 冰块效果 - 淡蓝色半透明
                this.ctx.fillStyle = `rgba(173, 216, 230, ${iceAlpha})`;

                // 冰块是一个格子一个格子的（有网格线分隔）
                cells.forEach(cell => {
                    const x = this.gridOffsetX + cell.x * this.cellSize;
                    const y = this.gridOffsetY + cell.y * this.cellSize;

                    // 绘制冰块主体
                    this.ctx.fillStyle = `rgba(173, 216, 230, ${iceAlpha})`;
                    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

                    // 绘制格子边框（冰块应该是一个格子一个格子中间组成的）
                    this.ctx.strokeStyle = `rgba(135, 206, 235, ${iceAlpha + 0.2})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);

                    // 绘制格子高光
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${iceAlpha * 0.3})`;
                    this.ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);

                    // 绘制格子纹理
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${iceAlpha * 0.15})`;
                    this.ctx.fillRect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8);
                });

                // 显示融化进度（在第一个格子上显示）
                if (meltProgress > 0 && cells.length > 0) {
                    const firstCell = cells[0];
                    const x = this.gridOffsetX + firstCell.x * this.cellSize;
                    const y = this.gridOffsetY + firstCell.y * this.cellSize;

                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
                    this.ctx.fillText(`${meltProgress}%`, x + this.cellSize / 2, y + this.cellSize / 2 + 3);
                }
            }
        });
    }

    /**
     * 绘制冰层
     */
    drawIceLayers() {
        // 绘制冰层效果，显示被遮挡的方块
        this.blocks.forEach(block => {
            if (block.layer > 0) {
                const cells = this.collisionDetector.getBlockCells(block);
                cells.forEach(cell => {
                    const x = this.gridOffsetX + cell.x * this.cellSize;
                    const y = this.gridOffsetY + cell.y * this.cellSize;

                    // 冰层效果 - 更淡的蓝色
                    this.ctx.fillStyle = 'rgba(173, 216, 230, 0.3)';
                    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

                    // 冰层边框
                    this.ctx.strokeStyle = 'rgba(135, 206, 235, 0.5)';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
                });
            }
        });
    }

    /**
     * 绘制俄罗斯方块（包括被冰块包裹的方块）
     */
    drawTetrisBlocks() {
        this.blocks.forEach(block => {
            if (block.layer === 0) {
                this.drawTetrisBlock(block);
            }
        });
    }

    /**
     * 绘制单个俄罗斯方块
     */
    drawTetrisBlock(block) {
        const cells = this.collisionDetector.getBlockCells(block);
        const color = this.getBlockColor(block.color);

        // 绘制方块主体和边框
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.lineWidth = 2;
        
        cells.forEach(cell => {
            const x = this.gridOffsetX + cell.x * this.cellSize;
            const y = this.gridOffsetY + cell.y * this.cellSize;

            // 绘制方块主体
            this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

            // 检查每个格子的四个边，只绘制外边框
            const hasTop = cells.some(c => c.x === cell.x && c.y === cell.y - 1);
            const hasBottom = cells.some(c => c.x === cell.x && c.y === cell.y + 1);
            const hasLeft = cells.some(c => c.x === cell.x - 1 && c.y === cell.y);
            const hasRight = cells.some(c => c.x === cell.x + 1 && c.y === cell.y);
            
            // 绘制外边框
            if (!hasTop) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + this.cellSize, y);
                this.ctx.stroke();
            }
            if (!hasBottom) {
            this.ctx.beginPath();
                this.ctx.moveTo(x, y + this.cellSize);
                this.ctx.lineTo(x + this.cellSize, y + this.cellSize);
            this.ctx.stroke();
            }
            if (!hasLeft) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x, y + this.cellSize);
                this.ctx.stroke();
            }
            if (!hasRight) {
                this.ctx.beginPath();
                this.ctx.moveTo(x + this.cellSize, y);
                this.ctx.lineTo(x + this.cellSize, y + this.cellSize);
                this.ctx.stroke();
            }
        });
    }

    /**
     * 绘制UI
     */
    drawUI() {
        if (!this.ctx) return;

        // 绘制游戏状态信息
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';

        const infoY = 30;
        this.ctx.fillText(`关卡: ${this.currentLevel}`, 20, infoY);
        this.ctx.fillText(`状态: ${this.gameState}`, 20, infoY + 25);

        if (this.selectedBlock) {
            this.ctx.fillText(`选中: ${this.selectedBlock.id}`, 20, infoY + 50);
        }

        // 绘制移动提示
        if (this.selectedBlock) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
            this.ctx.font = '14px Arial';
            this.ctx.fillText('点击目标位置移动方块', 20, this.systemInfo.windowHeight - 20);
        }
    }

    /**
     * 绘制弹窗
     */
    drawDialog() {
        // 暂时为空，可以后续添加弹窗功能
    }

    /**
     * 处理点击事件
     */
    handleClick(x, y) {
        console.log(`[点击] 屏幕坐标: (${x}, ${y})`);
        const gridPos = this.screenToGrid(x, y);
        console.log(`[点击] 网格坐标: (${gridPos.x}, ${gridPos.y})`);

        if (!this.collisionDetector.isValidPosition(gridPos.x, gridPos.y)) {
            console.log(`[点击] 位置无效`);
            return;
        }

        const gridValue = this.grid[gridPos.y][gridPos.x];
        console.log(`[点击] 网格值: ${gridValue}`);

        if (gridValue && this.blocks.has(gridValue)) {
            // 点击了方块
            console.log(`[点击] 点击了方块: ${gridValue}`);
            this.selectBlock(gridValue);
        } else if (this.selectedBlock) {
            // 点击了空白位置，尝试移动
            console.log(`[点击] 尝试移动方块: ${this.selectedBlock.id} 到 (${gridPos.x}, ${gridPos.y})`);
            this.moveBlock(this.selectedBlock.id, gridPos.x, gridPos.y);
            } else {
            console.log(`[点击] 没有选中方块`);
        }
    }

    /**
     * 屏幕坐标转网格坐标
     */
    screenToGrid(screenX, screenY) {
        const gridX = Math.floor((screenX - this.gridOffsetX) / this.cellSize);
        const gridY = Math.floor((screenY - this.gridOffsetY) / this.cellSize);
        return {x: gridX, y: gridY};
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.MapEngine = MapEngine;
} else if (typeof global !== 'undefined') {
    global.MapEngine = MapEngine;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapEngine;
} else {
    this.MapEngine = MapEngine;
}
