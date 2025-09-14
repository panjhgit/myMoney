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
     * 执行移动 - 一格一格地移动
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
        
        // 如果没有blockElement，直接更新位置
        if (!block.blockElement || !block.blockElement.element) {
            block.position = {...endPos};
            gameEngine.updateGrid();
            gameEngine.processIceBlocks(block); // 统一处理冰块
            gameEngine.checkGateExit(block);
            return;
        }
        
        const blockElement = block.blockElement.element;
        block.isMoving = true;
        
        // 创建动画时间线
        const walkTimeline = gsap.timeline({
            onUpdate: () => {
                // 🔧 优化：动画进行时持续重绘
                if (typeof markNeedsRedraw === 'function') {
                    markNeedsRedraw();
                }
            },
            onComplete: () => {
                block.isMoving = false;
                gameEngine.updateGrid();
                gameEngine.processIceBlocks(block); // 统一处理冰块
                gameEngine.checkGateExit(block);
                
                // 🔧 优化：动画完成后触发重绘
                if (typeof markNeedsRedraw === 'function') {
                    markNeedsRedraw();
                }
                
                if (gameEngine.animations) {
                    gameEngine.animations.delete(animationId);
                }
            }
        });
        
        if (gameEngine.animations) {
            gameEngine.animations.set(animationId, walkTimeline);
        }
        
        // 按路径逐步移动
        path.forEach((step, index) => {
            const stepDuration = 0.4; // 每步持续时间
            const delay = index * stepDuration;
            
            // 更新逻辑位置
            walkTimeline.call(() => {
                block.position = {x: step.x, y: step.y};
                gameEngine.updateGrid();
            }, [], delay);
            
            // 更新渲染位置
            walkTimeline.to(blockElement, {
                x: step.x * GAME_CONFIG.CELL_SIZE, 
                y: step.y * GAME_CONFIG.CELL_SIZE, 
                duration: stepDuration, 
                ease: "power2.out"
            }, delay);
        });
    }


    /**
     * 智能移动方块到最佳位置
     */
    smartMoveBlock(block, targetPos, collisionDetector, grid, blocks, rocks, gameEngine) {
        // 1. 找到最近的方块，让那个方块移动到目标位置
        const blockCells = collisionDetector.getBlockCells(block);
        let nearestCell = null;
        let minDistance = Infinity;
        
        // 计算每个方块到目标位置的距离
        for (const cell of blockCells) {
            const distance = Math.abs(cell.x - targetPos.x) + Math.abs(cell.y - targetPos.y);
            if (distance < minDistance) {
                minDistance = distance;
                nearestCell = cell; // 保存绝对位置
            }
        }
        
        // 计算目标位置：让最近方块移动到目标位置
        // nearestCell是绝对位置，需要转换为相对位置
        const relativeX = nearestCell.x - block.position.x;
        const relativeY = nearestCell.y - block.position.y;
        const targetPosition = {
            x: targetPos.x - relativeX,
            y: targetPos.y - relativeY
        };
        
        // 2. 直接尝试移动到目标位置
        // 边界检查 - 允许移动到边界外（出地图）
        if (!collisionDetector.isValidPosition(targetPosition.x, targetPosition.y)) {
            // 如果目标位置超出边界，尝试移动到边界位置
            const boundaryPos = this.getBoundaryPosition(targetPosition, collisionDetector.GRID_SIZE);
            if (boundaryPos) {
                targetPosition.x = boundaryPos.x;
                targetPosition.y = boundaryPos.y;
            } else {
                return false;
            }
        }
        
        // 3. 检查目标位置是否是门的位置，如果是则不允许移动
        if (this.isTargetPositionAGate(targetPosition, gameEngine)) {
            return false;
        }
        
        // 使用路径规划系统
        const startPos = block.position;
        const path = this.calculatePath(block, startPos, targetPosition, collisionDetector, grid, blocks, rocks);
        
        if (path && path.length > 0) {
            this.executeMove(block, path, gameEngine);
            return true;
        } else {
            return false;
        }
    }

    /**
     * 检查目标位置是否是门的位置
     */
    isTargetPositionAGate(targetPos, gameEngine) {
        if (!gameEngine || !gameEngine.mapEngine || !gameEngine.mapEngine.mapData) {
            return false;
        }
        
        const gates = gameEngine.mapEngine.mapData.gates || [];
        
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

}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.MovementManager = MovementManager;
} else if (typeof global !== 'undefined') {
    global.MovementManager = MovementManager;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementManager;
} else {
    this.MovementManager = MovementManager;
}
