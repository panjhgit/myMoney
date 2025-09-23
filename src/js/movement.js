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
     * 执行移动 - 真正的格子化移动
     */
    executeMove(block, path, gameEngine) {
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
            this.executeMove(block, path, gameEngine);
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
            this.executeMove(block, path, gameEngine);
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
    



}

// CommonJS 导出（抖音小游戏规范）
module.exports = {
    MovementManager: MovementManager
};
