/**
 * 移动逻辑模块
 * 负责处理方块的移动、路径规划和动画
 */

// CommonJS 导入依赖
const { GAME_CONFIG } = require('./config.js');

class MovementManager {
    constructor(gridSize) {
        this.GRID_SIZE = gridSize;
        this.DIRECTIONS = [{dx: 0, dy: -1}, // 上
            {dx: 0, dy: 1},  // 下
            {dx: -1, dy: 0}, // 左
            {dx: 1, dy: 0}   // 右
        ];
        
        // 实时移动相关状态
        this.lastMoveTime = 0;
        this.lastAStarTime = 0;
        this.cachedOptimalPosition = null;
        this.cachedTargetPosition = null;
    }

    /**
     * 计算A*路径 - 返回能到达的最远位置
     */
    calculatePath(block, startPos, targetPos, collisionDetector, grid, blocks, rocks) {
        // 边界检查：验证起始和目标位置
        if (!collisionDetector.isValidPosition(startPos.x, startPos.y)) {
            console.warn(`[A*路径] 起始位置无效: (${startPos.x}, ${startPos.y})`);
            return [];
        }
        
        if (!collisionDetector.isValidPosition(targetPos.x, targetPos.y)) {
            console.warn(`[A*路径] 目标位置无效: (${targetPos.x}, ${targetPos.y})`);
            return [];
        }

        const openList = [];
        const closedList = new Set();
        let bestNode = null; // 记录最接近目标的节点

        const startNode = {
            position: startPos, g: 0, h: this.calculateHeuristic(startPos, targetPos), f: 0, parent: null
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
            if (currentPos.x === targetPos.x && currentPos.y === targetPos.y) {
                return this.reconstructPath(currentNode);
            }

            // 修复最佳节点选择逻辑：根据移动方向选择最佳对齐的节点
            if (this.isBetterNode(currentNode, bestNode, startPos, targetPos)) {
                bestNode = currentNode;
            }

            // 检查四个方向
            for (const dir of this.DIRECTIONS) {
                const newX = currentPos.x + dir.dx;
                const newY = currentPos.y + dir.dy;
                const newPos = {x: newX, y: newY};
                const newKey = `${newX},${newY}`;

                if (closedList.has(newKey)) continue;
                if (!collisionDetector.isValidPosition(newX, newY)) continue;

                const collisionResult = collisionDetector.checkCollision(block, newPos, grid, blocks, rocks, block.id);
                if (collisionResult.collision) {
                    continue;
                }

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
                        h: this.calculateHeuristic(newPos, targetPos),
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
            return this.reconstructPath(bestNode);
        }

        return [];
    }

    /**
     * 计算启发式函数（曼哈顿距离）
     */
    calculateHeuristic(pos1, pos2) {
        const key = `${pos1.x},${pos1.y},${pos2.x},${pos2.y}`;
        if (this._mathCache && this._mathCache.has(key)) {
            return this._mathCache.get(key);
        }
        
        const distance = Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
        if (!this._mathCache) {
            this._mathCache = new Map();
        }
        this._mathCache.set(key, distance);
        return distance;
    }

    /**
     * 清理数学计算缓存
     */
    clearMathCache() {
        if (this._mathCache) {
            this._mathCache.clear();
        }
    }

    /**
     * 判断节点是否更好（用于最佳节点选择）
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
     * 获取主要移动方向
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
     * 计算基于方向的节点得分
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
     * 重构路径
     */
    reconstructPath(targetNode) {
        const path = [];
        let current = targetNode;
        while (current) {
            path.unshift(current.position);
            current = current.parent;
        }
        return path;
    }

    /**
     * 执行路径移动 - 真正的格子化移动
     */
    executePathMove(block, path, gameEngine) {
        if (path.length < 2) return;
        
        const startPos = path[0];
        const endPos = path[path.length - 1];
        
        // 检查是否已有动画在运行
        const animationId = `block_move_${block.id}`;
        if (gameEngine.animations && gameEngine.animations.has(animationId)) {
            gameEngine.animations.get(animationId).kill();
        }
        
        // 设置移动状态
        block.isMoving = true;
        block.state = 'moving';
        
        // 抖音小游戏环境使用原生动画
        console.log('使用原生动画播放移动效果');
        
        // 创建格子化移动动画
        this.createGridBasedAnimation(block, path, gameEngine, animationId);
    }
    
    /**
     * 创建基于格子的移动动画
     */
    createGridBasedAnimation(block, path, gameEngine, animationId) {
        // 使用原生动画实现移动效果
        let currentStep = 0;
        const stepDuration = 200; // 每步200ms
        
        const animateStep = () => {
            if (currentStep < path.length) {
                const nextPos = path[currentStep];
                block.position.x = nextPos.x;
                block.position.y = nextPos.y;
                
                // 🔧 修复：在每一步移动时都更新网格和处理冰块显露
                gameEngine.updateGrid();
                gameEngine.processIceBlocks(block);
                
                // 触发重绘
                if (typeof globalThis.markNeedsRedraw === 'function') {
                    globalThis.markNeedsRedraw();
                }
                
                currentStep++;
                setTimeout(animateStep, stepDuration);
            } else {
                // 动画完成
                block.isMoving = false;
                block.state = 'idle';
                
                // 动画完成后清除选中状态
                if (block.isSelected) {
                    block.isSelected = false;
                    gameEngine.selectedBlock = null;
                }
                
                // 🔧 修复：动画完成后再次确保网格和冰块状态正确
                gameEngine.updateGrid();
                gameEngine.processIceBlocks(block);
                gameEngine.checkGateExit(block);
                
                // 动画完成后触发重绘
                if (typeof globalThis.markNeedsRedraw === 'function') {
                    globalThis.markNeedsRedraw();
                }
                
                if (gameEngine.animations) {
                    gameEngine.animations.delete(animationId);
                }
            }
        };
        
        animateStep();
    }
    
    /**
     * 移动到指定格子位置
     */
    moveToGridPosition(block, gridPos, gameEngine) {
        // 使用格子化移动方法
        if (block.moveToNextGrid && typeof block.moveToNextGrid === 'function') {
            block.moveToNextGrid({x: gridPos.x, y: gridPos.y});
        } else if (block.moveTo && typeof block.moveTo === 'function') {
            block.moveTo({x: gridPos.x, y: gridPos.y}, true); // 强制格子化
        } else {
            block.position = {x: Math.round(gridPos.x), y: Math.round(gridPos.y)};
        }
        
        // 更新游戏网格
        gameEngine.updateGrid();
        
        // 检查碰撞和特殊效果
        this.checkGridEffects(block, gridPos, gameEngine);
    }
    
    /**
     * 检查格子效果（冰块融化、门检测等）
     */
    checkGridEffects(block, gridPos, gameEngine) {
        // 检查冰块融化
        gameEngine.processIceBlocks(block);
        
        // 检查是否到达门
        gameEngine.checkGateExit(block);
        
        // 可以在这里添加其他格子效果
        // 比如：特殊格子、陷阱、奖励等
    }
    
    /**
     * 直接移动到最终位置（无动画）
     */
    moveToFinalPosition(block, endPos, gameEngine) {
        // 使用格子化移动方法
        if (block.moveTo && typeof block.moveTo === 'function') {
            block.moveTo({x: endPos.x, y: endPos.y}, true); // 强制格子化
        } else {
            block.position = {x: Math.round(endPos.x), y: Math.round(endPos.y)};
        }
        
        // 更新状态
        block.isMoving = false;
        block.state = 'idle';
        
        // 移动完成后清除选中状态
        if (block.isSelected) {
            block.isSelected = false;
            gameEngine.selectedBlock = null;
        }
        
        // 更新游戏状态
        gameEngine.updateGrid();
        gameEngine.processIceBlocks(block);
        gameEngine.checkGateExit(block);
    }


    /**
     * 点击移动 - 点击目标位置移动方块
     * @param {Block} block - 要移动的方块
     * @param {Object} targetPos - 目标位置 {x, y}
     * @param {Object} gameEngine - 游戏引擎
     * @returns {boolean} 是否成功开始移动
     */
    clickMove(block, targetPos, gameEngine) {
        const currentCells = block.getCells();
        
        // 检查点击的目标位置是否在方块当前占用的格子中
        const isClickingOwnCell = currentCells.some(cell => {
            const cellX = block.position.x + cell.x;
            const cellY = block.position.y + cell.y;
            return cellX === targetPos.x && cellY === targetPos.y;
        });
        if (isClickingOwnCell) {
            return false;
        }
        
        // 计算最优的方块目标位置（不是点击位置，而是方块锚点应该移动到的位置）
        const optimalTargetPos = this.calculateOptimalBlockPosition(block, targetPos);
        
        
        if (!block || !block.canMove()) {
            return false;
        }
        
        // 检查目标位置是否有效
        if (!gameEngine.collisionDetector.isValidPosition(targetPos.x, targetPos.y)) {
            console.warn(`[移动调试] 目标位置无效: (${targetPos.x}, ${targetPos.y})`);
            return false;
        }
        
        // 计算移动路径（使用最优目标位置）
        const startPos = block.position;
        const path = this.calculatePath(block, startPos, optimalTargetPos, 
            gameEngine.collisionDetector, gameEngine.grid, 
            gameEngine.blocks, 
            gameEngine.rocks);
        
        if (path && path.length > 1) {
            this.executePathMove(block, path, gameEngine);
            return true;
        } else {
            return false;
        }
    }
    
    /**
     * 计算最优的方块位置
     * 根据点击的目标位置，计算方块锚点应该移动到的最优位置
     * @param {Block} block - 方块
     * @param {Object} clickedPos - 点击的位置
     * @returns {Object} 最优的方块锚点位置
     */
    calculateOptimalBlockPosition(block, clickedPos) {
        const currentCells = block.getCells();
        const blockPos = block.position;
        
        // 找到点击位置最近的方块格子
        let nearestCell = currentCells[0];
        let minDistance = Infinity;
        
        currentCells.forEach(cell => {
            const cellX = blockPos.x + cell.x;
            const cellY = blockPos.y + cell.y;
            const distance = Math.abs(cellX - clickedPos.x) + Math.abs(cellY - clickedPos.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearestCell = { x: cellX, y: cellY };
            }
        });
        
        // 计算从最近格子到点击位置的偏移
        const offsetX = clickedPos.x - nearestCell.x;
        const offsetY = clickedPos.y - nearestCell.y;
        
        // 应用偏移到方块锚点位置
        const newBlockPos = {
            x: blockPos.x + offsetX,
            y: blockPos.y + offsetY
        };
        
        return newBlockPos;
    }

    /**
     * 拖动移动 - 拖动方块到目标位置
     * @param {Block} block - 要移动的方块
     * @param {Object} startPos - 起始位置 {x, y}
     * @param {Object} endPos - 结束位置 {x, y}
     * @param {Object} gameEngine - 游戏引擎
     * @returns {boolean} 是否成功开始移动
     */
    dragMove(block, startPos, endPos, gameEngine) {
        if (!block || !block.canMove() || !gameEngine.collisionDetector.isValidPosition(endPos.x, endPos.y)) {
            return false;
        }
        
        const path = this.calculatePath(block, startPos, endPos, 
            gameEngine.collisionDetector, gameEngine.grid, 
            gameEngine.blocks, gameEngine.rocks);
        
        if (path && path.length > 1) {
            this.executePathMove(block, path, gameEngine);
            return true;
        }
        return false;
    }
    
    
    
    /**
     * 检查拖动是否有效（不能跨过障碍）
     * @param {Block} block - 要移动的方块
     * @param {Object} startPos - 起始位置
     * @param {Object} endPos - 结束位置
     * @param {Object} gameEngine - 游戏引擎
     * @returns {boolean} 是否有效
     */
    isValidDrag(block, startPos, endPos, gameEngine) {
        // 检查目标位置是否在游戏区域内
        if (!gameEngine.collisionDetector.isValidPosition(endPos.x, endPos.y)) {
            return false;
        }
        
        // 检查目标位置是否在值为0的区域（游戏区域）
        if (!gameEngine.boardMatrix) {
            return false;
        }
        
        // 检查目标位置在boardMatrix中是否为0（游戏区域）
        const boardValue = gameEngine.getCellValue(endPos.x, endPos.y);
        if (boardValue !== 0) {
            return false; // 不能在非0区域（墙、门、砖块等）
        }
        
        // 检查目标位置是否有其他方块
        const targetGridValue = gameEngine.grid[endPos.y][endPos.x];
        if (targetGridValue && targetGridValue !== block.id) {
            return false;
        }
        
        return true;
    }
    
    // ==================== 实时移动系统 ====================
    
    /**
     * 处理鼠标移动（实时移动）
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {Object} gameEngine - 游戏引擎
     * @param {Block} selectedBlock - 选中的方块
     * @param {boolean} isDragging - 是否正在拖动
     */
    handleMouseMove(x, y, gameEngine, selectedBlock, isDragging) {
        if (!isDragging || !selectedBlock) {
            return;
        }

        const now = Date.now();
        
        // 频率限制：避免过于频繁的移动
        if (this.lastMoveTime && (now - this.lastMoveTime) < 100) {
            return;
        }

        const gridPos = gameEngine.screenToGrid(x, y);
        const currentPos = selectedBlock.position;

        // 如果触摸位置没有变化，跳过处理
        if (gridPos.x === currentPos.x && gridPos.y === currentPos.y) {
            return;
        }

        // 计算下一步最佳移动
        const nextMove = this.calculateBestMove(currentPos, gridPos, now, gameEngine, selectedBlock);
        
        if (nextMove && this.executeInstantMove(currentPos, nextMove, gameEngine, selectedBlock)) {
            this.lastMoveTime = now;
        }
    }
    
    /**
     * 计算最佳移动方向（实时移动）
     * @param {Object} currentPos - 当前位置
     * @param {Object} targetPos - 目标位置
     * @param {number} timestamp - 时间戳
     * @param {Object} gameEngine - 游戏引擎
     * @param {Block} selectedBlock - 选中的方块
     * @returns {Object|null} 下一步移动位置
     */
    calculateBestMove(currentPos, targetPos, timestamp, gameEngine, selectedBlock) {
        // 1. 简单情况：检查直接移动
        const directMove = this.getDirectMove(currentPos, targetPos);
        if (directMove && gameEngine.isValidMovePosition(directMove.x, directMove.y, selectedBlock)) {
            return directMove;
        }

        // 2. 复杂情况：使用智能路径规划
        const optimalPos = this.getOptimalPosition(currentPos, targetPos, timestamp, gameEngine, selectedBlock);
        if (!optimalPos) {
            return null;
        }

        // 3. 计算朝向最优位置的一步移动
        return this.getStepTowardsTarget(currentPos, optimalPos, gameEngine, selectedBlock);
    }
    
    /**
     * 获取直接移动（优先级最高）
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
     * 获取最优位置（使用缓存和A*）
     * @param {Object} current - 当前位置
     * @param {Object} target - 目标位置
     * @param {number} timestamp - 时间戳
     * @param {Object} gameEngine - 游戏引擎
     * @param {Block} selectedBlock - 选中的方块
     * @returns {Object|null} 最优位置
     */
    getOptimalPosition(current, target, timestamp, gameEngine, selectedBlock) {
        // 检查是否需要重新计算
        if (this.shouldRecalculateOptimalPosition(target, timestamp)) {
            const optimal = this.findOptimalPosition(current, target, selectedBlock, gameEngine);
            this.updateOptimalPositionCache(target, optimal, timestamp);
            return optimal;
        }

        return this.cachedOptimalPosition;
    }
    
    /**
     * 判断是否需要重新计算最优位置
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
     * 更新最优位置缓存
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
     * 计算朝向目标的一步移动
     * @param {Object} current - 当前位置
     * @param {Object} target - 目标位置
     * @param {Object} gameEngine - 游戏引擎
     * @param {Block} selectedBlock - 选中的方块
     * @returns {Object|null} 下一步位置
     */
    getStepTowardsTarget(current, target, gameEngine, selectedBlock) {
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
        for (const dir of this.DIRECTIONS) {
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
            if (gameEngine.isValidMovePosition(candidate.x, candidate.y, selectedBlock)) {
                return { x: candidate.x, y: candidate.y };
            }
        }

        return null;
    }
    
    /**
     * 执行即时移动操作（实时移动）
     * @param {Object} currentPos - 当前位置
     * @param {Object} nextPos - 下一步位置
     * @param {Object} gameEngine - 游戏引擎
     * @param {Block} selectedBlock - 选中的方块
     * @returns {boolean} 移动是否成功
     */
    executeInstantMove(currentPos, nextPos, gameEngine, selectedBlock) {
        // 最终安全检查
        if (!gameEngine.isValidMovePosition(nextPos.x, nextPos.y, selectedBlock)) {
            return false;
        }

        // 执行移动
        try {
            // 使用通用方法更新网格
            gameEngine.updateBlockGridState(selectedBlock, currentPos, 0); // 清除旧位置
            selectedBlock.position.x = nextPos.x;
            selectedBlock.position.y = nextPos.y;
            gameEngine.updateBlockGridState(selectedBlock, nextPos, selectedBlock.id); // 设置新位置
            
            // 验证移动结果
            if (!this.validateMoveResult(nextPos.x, nextPos.y, gameEngine, selectedBlock)) {
                this.rollbackMove(currentPos, nextPos.x, nextPos.y, gameEngine, selectedBlock);
                return false;
            }
            
            // 在移动过程中处理冰块显露
            gameEngine.processIceBlocks(selectedBlock);
            
            // 触发重绘
            gameEngine.triggerRedraw();
            return true;
            
        } catch (error) {
            console.error('[移动] 执行移动时发生错误:', error);
            this.rollbackMove(currentPos, nextPos.x, nextPos.y, gameEngine, selectedBlock);
            return false;
        }
    }
    
    /**
     * 验证移动结果
     * @param {number} x - 移动后的X坐标
     * @param {number} y - 移动后的Y坐标
     * @param {Object} gameEngine - 游戏引擎
     * @param {Block} selectedBlock - 选中的方块
     * @returns {boolean} 移动结果是否有效
     */
    validateMoveResult(x, y, gameEngine, selectedBlock) {
        if (!selectedBlock) return false;
        
        const cells = selectedBlock.getCells();
        for (const cell of cells) {
            const cellX = x + cell.x;
            const cellY = y + cell.y;
            
            // 检查网格状态是否一致
            if (gameEngine.grid[cellY][cellX] !== selectedBlock.id) {
                console.error('[移动验证] 网格状态不一致:', {
                    position: { cellX, cellY },
                    expected: selectedBlock.id,
                    actual: gameEngine.grid[cellY][cellX]
                });
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 回滚移动操作
     * @param {Object} originalPos - 原始位置
     * @param {number} failedX - 失败的X坐标
     * @param {number} failedY - 失败的Y坐标
     * @param {Object} gameEngine - 游戏引擎
     * @param {Block} selectedBlock - 选中的方块
     */
    rollbackMove(originalPos, failedX, failedY, gameEngine, selectedBlock) {
        if (!selectedBlock) return;
        
        try {
            // 使用通用方法清除失败位置
            gameEngine.updateBlockGridState(selectedBlock, selectedBlock.position, 0);
            
            // 恢复原始位置
            selectedBlock.position.x = originalPos.x;
            selectedBlock.position.y = originalPos.y;
            
            // 使用通用方法恢复原始位置
            gameEngine.updateBlockGridState(selectedBlock, originalPos, selectedBlock.id);
            
            console.log('[回滚] 已恢复到原始位置:', originalPos);
        } catch (error) {
            console.error('[回滚] 回滚操作失败:', error);
        }
    }
    
    /**
     * 使用A*算法找到最优位置
     * @param {Object} start - 起始位置
     * @param {Object} target - 目标位置
     * @param {Block} block - 要移动的方块
     * @param {Object} gameEngine - 游戏引擎
     * @returns {Object|null} 最优位置
     */
    findOptimalPosition(start, target, block, gameEngine) {
        // 使用现有的A*算法
        const path = this.calculatePath(block, start, target, 
            gameEngine.collisionDetector, gameEngine.grid, 
            gameEngine.blocks, gameEngine.rocks);
        
        if (path && path.length > 1) {
            return path[path.length - 1]; // 返回路径的最后一个位置
        }
        
        return null;
    }

}

// CommonJS 导出（抖音小游戏规范）
module.exports = {
    MovementManager: MovementManager
};
