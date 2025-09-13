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

        // 如果无法到达目标，返回能到达的最远位置的路径
        if (bestNode && bestNode !== startNode) {
            console.log(`[路径规划] 无法到达目标，返回最接近位置的路径`);
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
     * 智能移动方块到最佳位置
     */
    smartMoveBlock(block, targetPos, collisionDetector, grid, blocks, rocks, gameEngine) {
        console.log(`[智能移动] 方块 ${block.id} 尝试移动到 (${targetPos.x}, ${targetPos.y})`);
        
        // 1. 分析移动方向
        const directions = this.analyzeMovementDirection(block.position, targetPos);
        console.log(`[智能移动] 移动方向: ${directions.join(', ')}`);
        
        // 2. 计算最佳对齐位置
        const bestPositions = this.calculateBestAlignmentPositions(block, targetPos, directions, collisionDetector);
        console.log(`[智能移动] 找到 ${bestPositions.length} 个候选位置`);
        
        // 3. 尝试每个候选位置，找到第一个可达的位置
        for (const candidatePos of bestPositions) {
            console.log(`[智能移动] 尝试位置: (${candidatePos.x}, ${candidatePos.y})`);
            
            // 边界检查
            if (!collisionDetector.isValidPosition(candidatePos.x, candidatePos.y)) {
                console.log(`[智能移动] 位置超出边界，跳过`);
                continue;
            }
            
            // 使用路径规划系统
            const startPos = block.position;
            const path = this.calculatePath(block, startPos, candidatePos, collisionDetector, grid, blocks, rocks);
            
            if (path && path.length > 0) {
                console.log(`[智能移动] 找到路径，长度: ${path.length}`);
                this.executeMove(block, path, gameEngine);
                return true;
            } else {
                console.log(`[智能移动] 无法到达位置: (${candidatePos.x}, ${candidatePos.y})`);
            }
        }
        
        console.log(`[智能移动] 无法移动方块 ${block.id}`);
        return false;
    }

    /**
     * 分析移动方向 - 返回所有相关方向
     */
    analyzeMovementDirection(currentPos, targetPos) {
        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        
        const directions = [];
        
        // 添加水平方向
        if (dx > 0) {
            directions.push('right');
        } else if (dx < 0) {
            directions.push('left');
        }
        
        // 添加垂直方向
        if (dy > 0) {
            directions.push('down');
        } else if (dy < 0) {
            directions.push('up');
        }
        
        // 如果没有移动，返回空数组
        return directions;
    }

    /**
     * 计算最佳对齐位置 - 支持多方向移动
     */
    calculateBestAlignmentPositions(block, targetPos, directions, collisionDetector) {
        const blockBounds = collisionDetector.getBlockBounds(block);
        const positions = [];
        
        // 首先尝试直接对齐到目标位置
        positions.push({
            x: targetPos.x,
            y: targetPos.y
        });
        
        // 根据每个方向计算对齐策略
        directions.forEach(direction => {
            switch (direction) {
                case 'up':
                    // 向上移动：让方块的顶部边缘对齐到目标位置
                    positions.push({
                        x: targetPos.x,
                        y: targetPos.y
                    });
                    break;
                    
                case 'down':
                    // 向下移动：直接移动到目标位置
                    positions.push({
                        x: targetPos.x,
                        y: targetPos.y
                    });
                    break;
                    
                case 'left':
                    // 向左移动：让方块的左边缘对齐到目标位置
                    positions.push({
                        x: targetPos.x,
                        y: targetPos.y
                    });
                    break;
                    
                case 'right':
                    // 向右移动：直接移动到目标位置
                    positions.push({
                        x: targetPos.x,
                        y: targetPos.y
                    });
                    break;
            }
        });
        
        // 添加一些偏移位置，尝试找到缺口
        const offsets = [
            {x: -1, y: 0}, {x: 1, y: 0}, {x: 0, y: -1}, {x: 0, y: 1},
            {x: -1, y: -1}, {x: 1, y: -1}, {x: -1, y: 1}, {x: 1, y: 1}
        ];
        
        offsets.forEach(offset => {
            positions.push({
                x: targetPos.x + offset.x,
                y: targetPos.y + offset.y
            });
        });
        
        // 去重
        const uniquePositions = [];
        const seen = new Set();
        positions.forEach(pos => {
            const key = `${pos.x},${pos.y}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePositions.push(pos);
            }
        });
        
        return uniquePositions;
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
