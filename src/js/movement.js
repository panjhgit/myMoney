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
     * 计算A*路径
     */
    calculatePath(block, startPos, targetPos, collisionDetector, grid, blocks, rocks) {
        const openList = [];
        const closedList = new Set();

        const startNode = {
            position: startPos, g: 0, h: this.calculateHeuristic(startPos, targetPos), f: 0, parent: null
        };
        startNode.f = startNode.g + startNode.h;
        openList.push(startNode);

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

            // 检查四个方向
            for (const dir of this.DIRECTIONS) {
                const newX = currentPos.x + dir.dx;
                const newY = currentPos.y + dir.dy;
                const newPos = {x: newX, y: newY};
                const newKey = `${newX},${newY}`;

                if (closedList.has(newKey)) continue;
                if (!collisionDetector.isValidPosition(newX, newY)) continue;

                const collisionResult = collisionDetector.checkCollision(block, newPos, grid, blocks, rocks, block.id);
                if (collisionResult.collision) continue;

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
        
        if (!block.blockElement || !block.blockElement.element) {
            // 如果没有blockElement，直接更新位置
            block.position = {...endPos};
            gameEngine.updateGrid();
            gameEngine.checkIceMelting();
            gameEngine.checkGateExit(block);
            return;
        }
        
        const blockElement = block.blockElement.element;
        block.isMoving = true;
        
        // 创建动画时间线
        const walkTimeline = gsap.timeline({
            onComplete: () => {
                block.isMoving = false;
                gameEngine.updateGrid();
                gameEngine.checkIceMelting();
                gameEngine.checkLayerReveal(block); // 检查层级显露
                gameEngine.checkGateExit(block);
                
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
     * 计算目标位置（处理边界）
     */
    calculateTargetPosition(block, clickPosition, collisionDetector) {
        const bounds = collisionDetector.getBlockBounds(block);
        let targetX = clickPosition.x;
        let targetY = clickPosition.y;

        // 调整到边界内
        if (targetX < 0) targetX = 0;
        if (targetY < 0) targetY = 0;
        if (targetX + bounds.width > this.GRID_SIZE) targetX = this.GRID_SIZE - bounds.width;
        if (targetY + bounds.height > this.GRID_SIZE) targetY = this.GRID_SIZE - bounds.height;

        return {x: targetX, y: targetY};
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
