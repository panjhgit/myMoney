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

        // 颜色常量
        this.COLORS = {
            WHITE: 'rgba(255, 255, 255, ',
            BLACK: 'rgba(0, 0, 0, ',
            ICE_BLUE: 'rgba(173, 216, 230, ',
            ICE_BORDER: 'rgba(135, 206, 235, ',
            ROCK_GRAY: 'rgba(128, 128, 128, 0.3)',
            SHADOW: 'rgba(0, 0, 0, 0.6)'
        };

        // 样式常量
        this.STYLES = {
            LINE_WIDTH_THIN: 1,
            LINE_WIDTH_THICK: 2,
            FONT_SMALL: '12px Arial',
            TEXT_ALIGN_CENTER: 'center'
        };

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
            length: gate.length,
            direction: gate.direction,
            layer: 0
        };
        this.gates.set(gate.id, gateElement);
    }

    /**
     * 添加方块
     */
    addBlock(block) {
        if (typeof createBlock === 'undefined') {
            console.error('createBlock 函数未找到');
            return;
        }

        // 使用新的方块创建系统
        const blockElement = createBlock(
            block.id,
            block.blockType || block.shape, // 支持旧的shape参数
            block.color,
            block.position,
            block.layer || 0,
            {
                isIce: block.isIce || false,
                alpha: block.alpha || 1,
                scale: block.scale || 1
            }
        );

        if (!blockElement) {
            console.error('方块创建失败:', block);
            return;
        }

        // 使用新的方块结构
        const element = {
            id: block.id,
            type: 'tetris',
            color: blockElement.color,
            position: block.position,
            initialPosition: {...block.position},
            typeData: blockElement.typeData,
            shapeData: {
                blocks: blockElement.typeData.blocks,
                description: blockElement.typeData.description
            },
            layer: block.layer || 0,
            movable: (block.layer || 0) === 0, // 只有第0层才能移动
            blockElement: blockElement,
            isIce: blockElement.isIce || false
        };

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
        this.grid.forEach(row => row.fill(null));

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
        const block = this.blocks.get(blockId);
        if (!block) {
            return false;
        }

        if (!block.movable) {
            return false;
        }

        this.selectedBlock = block;
        
        // 🔧 优化：选择方块后触发重绘
        if (typeof markNeedsRedraw === 'function') {
            markNeedsRedraw();
        }
        
        return true;
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
        block.layer = 0;
        block.movable = true;
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
     */
    isBlockAtGate(block, gate) {
        const blockCells = this.collisionDetector.getBlockCells(block);

        // 检查方块的任何一格是否在门的位置
        return blockCells.some(cell => {
            switch (gate.direction) {
                case 'up':
                    // 门在上方，检查方块是否在门下方
                    return cell.x >= gate.position.x && cell.x < gate.position.x + gate.length && cell.y === gate.position.y + 1;
                case 'down':
                    // 门在下方，检查方块是否在门上方
                    return cell.x >= gate.position.x && cell.x < gate.position.x + gate.length && cell.y === gate.position.y - 1;
                case 'left':
                    // 门在左侧，检查方块是否在门右侧
                    return cell.y >= gate.position.y && cell.y < gate.position.y + gate.length && cell.x === gate.position.x + 1;
                case 'right':
                    // 门在右侧，检查方块是否在门左侧
                    return cell.y >= gate.position.y && cell.y < gate.position.y + gate.length && cell.x === gate.position.x - 1;
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
                    endX = this.gridOffsetX + (gate.position.x + gate.length) * this.cellSize;
                    endY = this.gridOffsetY - borderWidth / 2;
                    break;

                case 'down':
                    // 下方的门
                    startX = this.gridOffsetX + gate.position.x * this.cellSize;
                    startY = this.gridOffsetY + this.gridSize + borderWidth / 2;
                    endX = this.gridOffsetX + (gate.position.x + gate.length) * this.cellSize;
                    endY = this.gridOffsetY + this.gridSize + borderWidth / 2;
                    break;

                case 'left':
                    // 左侧的门
                    startX = this.gridOffsetX - borderWidth / 2;
                    startY = this.gridOffsetY + gate.position.y * this.cellSize;
                    endX = this.gridOffsetX - borderWidth / 2;
                    endY = this.gridOffsetY + (gate.position.y + gate.length) * this.cellSize;
                    break;

                case 'right':
                    // 右侧的门
                    startX = this.gridOffsetX + this.gridSize + borderWidth / 2;
                    startY = this.gridOffsetY + gate.position.y * this.cellSize;
                    endX = this.gridOffsetX + this.gridSize + borderWidth / 2;
                    endY = this.gridOffsetY + (gate.position.y + gate.length) * this.cellSize;
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
        this.ctx.lineWidth = this.STYLES.LINE_WIDTH_THIN;

        for (let row = 0; row <= this.GRID_SIZE; row++) {
            const y = startY + row * this.cellSize;
            this.drawLine(startX, y, startX + boardWidth, y);
        }

        for (let col = 0; col <= this.GRID_SIZE; col++) {
            const x = startX + col * this.cellSize;
            this.drawLine(x, startY, x, startY + boardHeight);
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
            orange: '#FFA500'
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
            this.drawRect(screenX, screenY, this.cellSize, this.cellSize);

            // 石块边框
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = this.STYLES.LINE_WIDTH_THICK;
            this.drawRect(screenX, screenY, this.cellSize, this.cellSize, false, true);

            // 石块纹理
            this.ctx.fillStyle = this.COLORS.BLACK + '0.3)';
            this.drawRectWithOffset(screenX, screenY, this.cellSize, this.cellSize, 2);

            // 石块高光
            this.ctx.fillStyle = this.COLORS.WHITE + '0.2)';
            this.drawRectWithOffset(screenX, screenY, this.cellSize, this.cellSize, 4);
        });
    }

    /**
     * 绘制冰块（淡色渲染）
     */
    drawIceBlocks() {
        const lowerBlocks = this.getLowerLayerBlocks();
        
        lowerBlocks.forEach(block => {
            if (!this.collisionDetector.isBlockFullyRevealed(block, this.grid, this.blocks)) {
                const cells = this.collisionDetector.getBlockCells(block);

                // 冰块保持固定颜色，不显示融化进度
                const meltProgress = block.meltProgress || 0; // 保留判断逻辑，但不用于UI

                // 设置冰块样式（固定颜色）
                this.ctx.fillStyle = this.COLORS.ICE_BLUE + '0.8)';
                this.ctx.strokeStyle = this.COLORS.ICE_BORDER + '1.0)';
                this.ctx.lineWidth = this.STYLES.LINE_WIDTH_THIN;

                // 冰块是一个格子一个格子的（有网格线分隔）
                cells.forEach(cell => {
                    const pos = this.getCellScreenPosition(cell);

                    // 绘制冰块主体
                    this.drawRect(pos.x, pos.y, this.cellSize, this.cellSize);

                    // 绘制格子边框
                    this.drawRect(pos.x, pos.y, this.cellSize, this.cellSize, false, true);

                    // 绘制格子高光（固定颜色）
                    this.ctx.fillStyle = this.COLORS.WHITE + '0.3)';
                    this.drawRectWithOffset(pos.x, pos.y, this.cellSize, this.cellSize, 2);

                    // 绘制格子纹理（固定颜色）
                    this.ctx.fillStyle = this.COLORS.WHITE + '0.15)';
                    this.drawRectWithOffset(pos.x, pos.y, this.cellSize, this.cellSize, 4);
                });

                // 融化进度不显示给用户，避免暴露游戏信息
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

                // 冰层效果 - 使用相同的冰块颜色
                this.ctx.fillStyle = this.COLORS.ICE_BLUE + '0.8)';
                this.drawRect(pos.x, pos.y, this.cellSize, this.cellSize);

                // 冰层边框
                this.ctx.strokeStyle = this.COLORS.ICE_BORDER + '1.0)';
                this.ctx.lineWidth = this.STYLES.LINE_WIDTH_THIN;
                this.drawRect(pos.x, pos.y, this.cellSize, this.cellSize, false, true);
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

    setTextStyle(font, align = 'left') {
        this.ctx.font = font;
        this.ctx.textAlign = align;
    }

    /**
     * 绘制单个俄罗斯方块
     */
    drawTetrisBlock(block) {
        const cells = this.collisionDetector.getBlockCells(block);
        const color = this.getBlockColor(block.color);

        // 绘制方块主体和边框
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = this.COLORS.SHADOW;
        this.ctx.lineWidth = this.STYLES.LINE_WIDTH_THICK;
        
        // 先绘制所有格子的填充（不绘制边框）
        cells.forEach(cell => {
            const pos = this.getCellScreenPosition(cell);
            this.drawRect(pos.x, pos.y, this.cellSize, this.cellSize, true, false);
        });
        
        // 然后绘制外边框（整体边框）
        cells.forEach(cell => {
            const pos = this.getCellScreenPosition(cell);
            
            // 检查每个格子的四个边，只绘制外边框
            const hasTop = cells.some(c => c.x === cell.x && c.y === cell.y - 1);
            const hasBottom = cells.some(c => c.x === cell.x && c.y === cell.y + 1);
            const hasLeft = cells.some(c => c.x === cell.x - 1 && c.y === cell.y);
            const hasRight = cells.some(c => c.x === cell.x + 1 && c.y === cell.y);
            
            // 绘制外边框
            if (!hasTop) {
                this.drawLine(pos.x, pos.y, pos.x + this.cellSize, pos.y);
            }
            if (!hasBottom) {
                this.drawLine(pos.x, pos.y + this.cellSize, pos.x + this.cellSize, pos.y + this.cellSize);
            }
            if (!hasLeft) {
                this.drawLine(pos.x, pos.y, pos.x, pos.y + this.cellSize);
            }
            if (!hasRight) {
                this.drawLine(pos.x + this.cellSize, pos.y, pos.x + this.cellSize, pos.y + this.cellSize);
            }
        });
    }

    /**
     * 绘制UI
     */
    drawUI() {
        if (!this.ctx) return;

        // 绘制游戏状态信息
        this.ctx.fillStyle = this.COLORS.WHITE + '0.9)';
        this.setTextStyle('16px Arial', 'left');

        const infoY = 30;
        this.ctx.fillText(`关卡: ${this.currentLevel}`, 20, infoY);
        this.ctx.fillText(`状态: ${this.gameState}`, 20, infoY + 25);

        if (this.selectedBlock) {
            this.ctx.fillText(`选中: ${this.selectedBlock.id}`, 20, infoY + 50);
        }

        // 绘制移动提示
        if (this.selectedBlock) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
            this.setTextStyle('14px Arial', 'left');
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
     * 检查是否有方块正在移动
     */
    isAnyBlockMoving() {
        return Array.from(this.blocks.values()).some(block => block.isMoving);
    }


    /**
     * 处理点击事件
     */
    handleClick(x, y) {
        // 🔧 优化：触发重绘
        if (typeof markNeedsRedraw === 'function') {
            markNeedsRedraw();
        }
        
        // 检查是否有方块正在移动
        if (this.isAnyBlockMoving()) {
            return;
        }
        
        const gridPos = this.screenToGrid(x, y);

        if (!this.collisionDetector.isValidPosition(gridPos.x, gridPos.y)) {
            return;
        }

        const gridValue = this.grid[gridPos.y][gridPos.x];

        if (gridValue && this.blocks.has(gridValue)) {
            // 点击了方块
            const clickedBlock = this.blocks.get(gridValue);
            
            if (clickedBlock.movable) {
                // 如果点击的是可移动方块，选择它
                this.selectBlock(gridValue);
            } else if (this.selectedBlock) {
                // 如果点击的是不可移动方块（如冰块），但已有选中方块，尝试移动
                this.movementManager.smartMoveBlock(this.selectedBlock, gridPos, this.collisionDetector, this.grid, this.blocks, this.rocks, this);
            }
        } else if (this.selectedBlock) {
            // 点击了空白位置，尝试智能移动
            this.movementManager.smartMoveBlock(this.selectedBlock, gridPos, this.collisionDetector, this.grid, this.blocks, this.rocks, this);
        }
    }

    /**
     * 直接移动方块到目标位置
     */
    moveBlockDirectly(block, targetPos) {
        // 计算移动路径（直接路径）
        const startPos = block.position;
        const path = [{x: startPos.x, y: startPos.y}, {x: targetPos.x, y: targetPos.y}];
        
        // 执行移动
        this.movementManager.executeMove(block, path, this);
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
