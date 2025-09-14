/**
 * 碰撞检测模块
 * 负责处理方块与各种元素的碰撞检测
 */

class CollisionDetector {
    constructor(gridSize) {
        this.GRID_SIZE = gridSize;
    }

    /**
     * 检查位置是否在边界内
     */
    isValidPosition(x, y) {
        return x >= 0 && x < this.GRID_SIZE && y >= 0 && y < this.GRID_SIZE;
    }

    /**
     * 获取方块占据的格子
     */
    getBlockCells(block, position = null) {
        const pos = position || block.position;
        const cells = [];

        if (block.shapeData && block.shapeData.blocks) {
            block.shapeData.blocks.forEach(blockCell => {
                cells.push({
                    x: pos.x + blockCell[0], y: pos.y + blockCell[1]
                });
            });
        }
        return cells;
    }

    /**
     * 检查方块在指定位置是否碰撞
     */
    checkCollision(block, position, grid, blocks, rocks, excludeId = null) {
        const cells = this.getBlockCells(block, position);

        for (const cell of cells) {
            // 检查边界
            if (!this.isValidPosition(cell.x, cell.y)) {
                return {collision: true, reason: 'out_of_bounds', cell};
            }

            // 检查石块
            const rockKey = `${cell.x},${cell.y}`;
            if (rocks.has(rockKey)) {
                return {collision: true, reason: 'rock', cell};
            }

            // 检查其他方块
            const gridValue = grid[cell.y][cell.x];
            if (gridValue && gridValue !== excludeId) {
                const otherBlock = blocks.get(gridValue);
                if (otherBlock && otherBlock.layer === 0) {
                    return {collision: true, reason: 'block', cell, otherBlock};
                }
            }
        }

        return {collision: false, reason: 'none'};
    }

    /**
     * 检查方块是否可以出门
     */
    canExitThroughGate(block, gate, grid, blocks) {
        // 检查颜色匹配
        if (block.color !== gate.color) {
            return {canExit: false, reason: 'color_mismatch'};
        }

        // 检查方块是否可以完全离开网格（统一的门检测逻辑）
        if (!this.canBlockFullyExitGrid(block, gate, grid, blocks)) {
            return {canExit: false, reason: 'cannot_exit'};
        }

        return {canExit: true, reason: 'success'};
    }
    
    /**
     * 检查方块是否可以完全离开网格（模拟移动到门外）
     */
    canBlockFullyExitGrid(block, gate, grid, blocks) {
        // 缓存 blockCells 计算结果，避免重复计算
        const blockCells = this.getBlockCells(block);
        
        // 1. 检查门的尺寸是否足够让方块通过
        if (!this.isGateSizeSufficient(block, gate)) {
            return false;
        }
        
        // 2. 检查方块是否在门的覆盖范围内（传递缓存的 blockCells）
        if (!this.isBlockInGateRange(block, gate, blockCells)) {
            return false;
        }
        
        // 3. 检查方块是否贴着门（传递缓存的 blockCells）
        if (!this.isBlockTouchingGate(block, gate, blockCells)) {
            return false;
        }
        
        // 4. 检查出门路径是否畅通（传递缓存的 blockCells）
        if (!this.isExitPathClear(block, gate, grid, blocks, blockCells)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 检查门的尺寸是否足够让方块通过
     */
    isGateSizeSufficient(block, gate) {
        const blockBounds = this.getBlockBounds(block);
        let sizeCheckPassed = false;

        switch (gate.direction) {
            case 'up':
            case 'down':
                // 上下方向的门，检查宽度是否足够
                sizeCheckPassed = gate.length >= blockBounds.width;
                break;
            case 'left':
            case 'right':
                // 左右方向的门，检查高度是否足够
                sizeCheckPassed = gate.length >= blockBounds.height;
                break;
        }

        return sizeCheckPassed;
    }
    
    /**
     * 检查方块是否在门的覆盖范围内
     */
    isBlockInGateRange(block, gate, blockCells = null) {
        if (!blockCells) {
            blockCells = this.getBlockCells(block);
        }
        
        switch (gate.direction) {
            case 'up':
            case 'down':
                // 上下方向的门，检查方块的x坐标是否完全在门的x范围内
                const minX = Math.min(...blockCells.map(cell => cell.x));
                const maxX = Math.max(...blockCells.map(cell => cell.x));
                const gateMinX = gate.position.x;
                const gateMaxX = gate.position.x + gate.length - 1;
                
                const xInRange = minX >= gateMinX && maxX <= gateMaxX;
                return xInRange;
                
            case 'left':
            case 'right':
                // 左右方向的门，检查方块的y坐标是否完全在门的y范围内
                const minY = Math.min(...blockCells.map(cell => cell.y));
                const maxY = Math.max(...blockCells.map(cell => cell.y));
                const gateMinY = gate.position.y;
                const gateMaxY = gate.position.y + gate.length - 1;
                
                const yInRange = minY >= gateMinY && maxY <= gateMaxY;
                return yInRange;
                
            default:
                return false;
        }
    }
    
    /**
     * 检查方块是否贴着门
     */
    isBlockTouchingGate(block, gate, blockCells = null) {
        if (!blockCells) {
            blockCells = this.getBlockCells(block);
        }
        
        switch (gate.direction) {
            case 'up':
                // 检查是否有格子贴着上边界 (y=0)
                return blockCells.some(cell => cell.y === 0);
                
            case 'down':
                // 检查是否有格子贴着下边界 (y=7)
                return blockCells.some(cell => cell.y === this.GRID_SIZE - 1);
                
            case 'left':
                // 检查是否有格子贴着左边界 (x=0)
                return blockCells.some(cell => cell.x === 0);
                
            case 'right':
                // 检查是否有格子贴着右边界 (x=7)
                return blockCells.some(cell => cell.x === this.GRID_SIZE - 1);
                
            default:
                return false;
        }
    }
    
    /**
     * 检查出门路径是否畅通
     */
    isExitPathClear(block, gate, grid, blocks, blockCells = null) {
        if (!blockCells) {
            blockCells = this.getBlockCells(block);
        }
        
        // 计算方块需要移动多少步才能完全离开网格
        const minX = Math.min(...blockCells.map(cell => cell.x));
        const maxX = Math.max(...blockCells.map(cell => cell.x));
        const minY = Math.min(...blockCells.map(cell => cell.y));
        const maxY = Math.max(...blockCells.map(cell => cell.y));
        
        let stepsToExit = 0;
        switch (gate.direction) {
            case 'up':
                stepsToExit = minY + 1 + (maxY - minY);
                break;
            case 'down':
                stepsToExit = (this.GRID_SIZE - maxY) + (maxY - minY);
                break;
            case 'left':
                stepsToExit = minX + 1 + (maxX - minX);
                break;
            case 'right':
                stepsToExit = (this.GRID_SIZE - maxX) + (maxX - minX);
                break;
        }
        
        // 检查每一步移动路径上是否有障碍物
        for (let step = 1; step <= stepsToExit; step++) {
            let pathCells = [];
            
            switch (gate.direction) {
                case 'up':
                    pathCells = blockCells.map(cell => ({x: cell.x, y: cell.y - step}));
                    break;
                case 'down':
                    pathCells = blockCells.map(cell => ({x: cell.x, y: cell.y + step}));
                    break;
                case 'left':
                    pathCells = blockCells.map(cell => ({x: cell.x - step, y: cell.y}));
                    break;
                case 'right':
                    pathCells = blockCells.map(cell => ({x: cell.x + step, y: cell.y}));
                    break;
            }
            
            // 检查这一步路径上的每个格子
            for (const pathCell of pathCells) {
                // 如果格子还在网格内，检查是否有障碍物
                if (this.isValidPosition(pathCell.x, pathCell.y)) {
                    if (grid && grid[pathCell.y] && grid[pathCell.y][pathCell.x]) {
                        const gridValue = grid[pathCell.y][pathCell.x];
                        if (gridValue && gridValue !== block.id) {
                            return false;
                        }
                    }
                }
            }
        }
        
        return true;
    }

    /**
     * 获取方块的边界尺寸
     */
    getBlockBounds(block) {
        if (!block.shapeData || !block.shapeData.blocks) {
            return {width: 1, height: 1};
        }

        const blocks = block.shapeData.blocks;
        if (blocks.length === 0) {
            return {width: 1, height: 1};
        }

        const minX = Math.min(...blocks.map(b => b[0]));
        const maxX = Math.max(...blocks.map(b => b[0]));
        const minY = Math.min(...blocks.map(b => b[1]));
        const maxY = Math.max(...blocks.map(b => b[1]));

        return {
            width: maxX - minX + 1, 
            height: maxY - minY + 1,
            minX, maxX, minY, maxY
        };
    }

    /**
     * 检查方块是否完全显露
     */
    isBlockFullyRevealed(block, grid, blocks) {
        const cells = this.getBlockCells(block);

        return cells.every(cell => {
            const gridValue = grid[cell.y][cell.x];
            return !gridValue || gridValue === block.id;
        });
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.CollisionDetector = CollisionDetector;
} else if (typeof global !== 'undefined') {
    global.CollisionDetector = CollisionDetector;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollisionDetector;
} else {
    this.CollisionDetector = CollisionDetector;
}
