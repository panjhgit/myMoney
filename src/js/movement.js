/**
 * 移动逻辑模块
 * 负责处理方块的移动、路径规划和动画
 */

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

            closedList.add(currentKey);

            // 如果到达目标
            if (currentPos.x === targetPos.x && currentPos.y === targetPos.y) {
                return this.reconstructPath(currentNode);
            }

            // 更新最佳节点（距离目标最近的节点）
            if (currentNode.h < bestNode.h) {
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
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
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
        
        // 检查是否有动画系统
        if (typeof gsap === 'undefined') {
            // 没有动画系统，直接移动到最终位置
            this.moveToFinalPosition(block, endPos, gameEngine);
            return;
        }
        
        // 创建格子化移动动画
        this.createGridBasedAnimation(block, path, gameEngine, animationId);
    }
    
    /**
     * 创建基于格子的移动动画
     */
    createGridBasedAnimation(block, path, gameEngine, animationId) {
        const timeline = gsap.timeline({
            onUpdate: () => {
                // 动画进行时持续重绘
                if (typeof markNeedsRedraw === 'function') {
                    markNeedsRedraw();
                }
            },
            onComplete: () => {
                block.isMoving = false;
                block.state = 'idle';
                gameEngine.updateGrid();
                gameEngine.processIceBlocks(block);
                gameEngine.checkGateExit(block);
                
                // 动画完成后触发重绘
                if (typeof markNeedsRedraw === 'function') {
                    markNeedsRedraw();
                }
                
                if (gameEngine.animations) {
                    gameEngine.animations.delete(animationId);
                }
            }
        });
        
        if (gameEngine.animations) {
            gameEngine.animations.set(animationId, timeline);
        }
        
        // 格子化移动：每个格子都有明确的移动步骤
        path.forEach((step, index) => {
            if (index === 0) return; // 跳过起始位置
            
            const stepDuration = GAME_CONFIG.MOVEMENT.STEP_DURATION || 0.3; // 每格移动时间
            const delay = index * stepDuration;
            
            // 移动到下一个格子
            timeline.call(() => {
                this.moveToGridPosition(block, step, gameEngine);
            }, [], delay);
        });
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
        if (!block || !block.canMove()) {
            console.warn('方块无法移动');
            return false;
        }
        
        // 检查目标位置是否有效
        if (!this.isValidTargetPosition(targetPos, gameEngine)) {
            console.warn('目标位置无效');
            return false;
        }
        
        // 计算移动路径
        const startPos = block.position;
        const path = this.calculatePath(block, startPos, targetPos, 
            gameEngine.collisionDetector, gameEngine.grid, 
            gameEngine.blocks, 
            gameEngine.rocks);
        
        if (path && path.length > 1) {
            this.executeMove(block, path, gameEngine);
            return true;
        } else {
            console.warn('无法找到有效路径');
            return false;
        }
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
        if (!block || !block.canMove()) {
            console.warn('方块无法移动');
            return false;
        }
        
        // 检查结束位置是否有效
        if (!this.isValidTargetPosition(endPos, gameEngine)) {
            console.warn('拖动目标位置无效');
            return false;
        }
        
        // 计算移动路径
        const path = this.calculatePath(block, startPos, endPos, 
            gameEngine.collisionDetector, gameEngine.grid, 
            gameEngine.blocks, 
            gameEngine.rocks);
        
        if (path && path.length > 1) {
            this.executeMove(block, path, gameEngine);
            return true;
        } else {
            console.warn('拖动路径无效');
            return false;
        }
    }
    
    /**
     * 检查目标位置是否有效
     * @param {Object} targetPos - 目标位置 {x, y}
     * @param {Object} gameEngine - 游戏引擎
     * @returns {boolean} 是否有效
     */
    isValidTargetPosition(targetPos, gameEngine) {
        // 检查是否在边界内
        if (targetPos.x < 0 || targetPos.x >= this.GRID_SIZE || 
            targetPos.y < 0 || targetPos.y >= this.GRID_SIZE) {
            return false;
        }
        
        // 检查是否是门的位置（门是特殊区域，需要特殊处理）
        if (this.isTargetPositionAGate(targetPos, gameEngine)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 获取屏幕坐标对应的格子位置
     * @param {number} screenX - 屏幕X坐标
     * @param {number} screenY - 屏幕Y坐标
     * @param {Object} gameEngine - 游戏引擎
     * @returns {Object} 格子位置 {x, y}
     */
    screenToGrid(screenX, screenY, gameEngine) {
        if (!gameEngine || !gameEngine.mapEngine) {
            return null;
        }
        
        const mapEngine = gameEngine.mapEngine;
        const cellSize = mapEngine.cellSize;
        const offsetX = mapEngine.gridOffsetX;
        const offsetY = mapEngine.gridOffsetY;
        
        // 计算相对于游戏区域的坐标
        const relativeX = screenX - offsetX;
        const relativeY = screenY - offsetY;
        
        // 转换为格子坐标
        const gridX = Math.floor(relativeX / cellSize);
        const gridY = Math.floor(relativeY / cellSize);
        
        return {x: gridX, y: gridY};
    }
    
    /**
     * 获取格子位置对应的屏幕坐标
     * @param {Object} gridPos - 格子位置 {x, y}
     * @param {Object} gameEngine - 游戏引擎
     * @returns {Object} 屏幕坐标 {x, y}
     */
    gridToScreen(gridPos, gameEngine) {
        if (!gameEngine || !gameEngine.mapEngine) {
            return null;
        }
        
        const mapEngine = gameEngine.mapEngine;
        const cellSize = mapEngine.cellSize;
        const offsetX = mapEngine.gridOffsetX;
        const offsetY = mapEngine.gridOffsetY;
        
        // 计算屏幕坐标
        const screenX = offsetX + gridPos.x * cellSize;
        const screenY = offsetY + gridPos.y * cellSize;
        
        return {x: screenX, y: screenY};
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
        // 检查起始和结束位置是否相邻（拖动应该是相邻移动）
        const dx = Math.abs(endPos.x - startPos.x);
        const dy = Math.abs(endPos.y - startPos.y);
        
        // 只允许相邻移动（上下左右）
        if (dx + dy !== 1) {
            return false;
        }
        
        // 检查目标位置是否有障碍
        const collisionResult = gameEngine.collisionDetector.checkCollision(
            block, endPos, gameEngine.grid, 
            gameEngine.blocks, 
            gameEngine.rocks, 
            block.id
        );
        
        return !collisionResult.collision;
    }

    /**
     * 检查目标位置是否是门的位置
     */
    isTargetPositionAGate(targetPos, gameEngine) {
        if (!gameEngine || !gameEngine.mapEngine) {
            return false;
        }
        
        const gates = Array.from(gameEngine.mapEngine.gates.values());
        
        for (const gate of gates) {
            // 检查目标位置是否在门的范围内
            let isInGate = false;
            switch (gate.direction) {
                case 'up':
                case 'down':
                    isInGate = targetPos.x >= gate.position.x && targetPos.x < gate.position.x + gate.length;
                    break;
                case 'left':
                case 'right':
                    isInGate = targetPos.y >= gate.position.y && targetPos.y < gate.position.y + gate.length;
                    break;
            }
            
            if (isInGate) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 获取边界位置（当目标位置超出边界时）
     */
    getBoundaryPosition(targetPos, gridSize) {
        let x = targetPos.x;
        let y = targetPos.y;
        
        // 调整到边界内
        if (x < 0) x = 0;
        if (x >= gridSize) x = gridSize - 1;
        if (y < 0) y = 0;
        if (y >= gridSize) y = gridSize - 1;
        
        return {x, y};
    }
    
    /**
     * 切换移动模式
     * @param {boolean} gridBased - 是否使用格子化移动
     */
    setMovementMode(gridBased) {
        if (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.MOVEMENT) {
            GAME_CONFIG.MOVEMENT.GRID_BASED = gridBased;
            console.log(`移动模式已切换为: ${gridBased ? '格子化移动' : '连续移动'}`);
        }
    }
    
    /**
     * 获取当前移动模式
     * @returns {boolean} 是否使用格子化移动
     */
    isGridBasedMovement() {
        return typeof GAME_CONFIG !== 'undefined' && 
               GAME_CONFIG.MOVEMENT && 
               GAME_CONFIG.MOVEMENT.GRID_BASED;
    }

}

// 导出到全局作用域
window.MovementManager = MovementManager;
