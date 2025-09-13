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
            console.log(`[通过门] 颜色不匹配: 方块${block.color} vs 门${gate.color}`);
            return {canExit: false, reason: 'color_mismatch'};
        }

        // 检查尺寸：门的大小必须大于方块的最大宽度或高度
        const blockBounds = this.getBlockBounds(block);
        let gateSize = 0;
        switch (gate.direction) {
            case 'up':
            case 'down':
                gateSize = gate.length;
                if (blockBounds.width > gateSize) {
                    console.log(`[通过门] 尺寸不匹配: 方块宽度(${blockBounds.width}) vs 门长度(${gateSize})`);
                    return {canExit: false, reason: 'size_mismatch'};
                }
                break;
            case 'left':
            case 'right':
                gateSize = gate.length;
                if (blockBounds.height > gateSize) {
                    console.log(`[通过门] 尺寸不匹配: 方块高度(${blockBounds.height}) vs 门长度(${gateSize})`);
                    return {canExit: false, reason: 'size_mismatch'};
                }
                break;
        }

        // 检查方块是否在门附近（根据门的方向）
        if (!this.isBlockNearGate(block, gate, grid, blocks)) {
            console.log(`[通过门] 方块不在门附近: 方块${block.id}不在门${gate.id}附近`);
            return {canExit: false, reason: 'not_near_gate'};
        }

        console.log(`[通过门] 检查通过: 方块${block.id}可以通过门${gate.id}`);
        return {canExit: true, reason: 'success'};
    }

    /**
     * 检查方块是否可以通过门
     */
    isBlockNearGate(block, gate, grid, blocks) {
        const blockCells = this.getBlockCells(block);
        console.log(`[门检测] 方块 ${block.id} 的格子:`, blockCells);
        console.log(`[门检测] 门 ${gate.id} 的位置:`, gate.position, '长度:', gate.length, '方向:', gate.direction);

        // 检查门的尺寸是否足够让方块通过
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

        if (!sizeCheckPassed) {
            console.log(`[门检测] 门的尺寸不够: 门长度${gate.length} vs 方块尺寸${gate.direction === 'up' || gate.direction === 'down' ? blockBounds.width : blockBounds.height}`);
            return false;
        }

        // 检查方块是否能够"滑出"门
        let canSlideOut = false;
        switch (gate.direction) {
            case 'up':
                // 检查方块是否贴着上边界且能够向上滑出
                canSlideOut = blockCells.some(cell => {
                    const isAtGatePosition = cell.y === 0; // 棋盘上边界是 y=0
                    const isInGateX = cell.x >= gate.position.x && cell.x < gate.position.x + gate.length;
                    return isAtGatePosition && isInGateX;
                });
                break;
            case 'down':
                // 检查方块是否贴着下边界且能够向下滑出
                canSlideOut = blockCells.some(cell => {
                    const isAtGatePosition = cell.y === 7; // 棋盘下边界是 y=7
                    const isInGateX = cell.x >= gate.position.x && cell.x < gate.position.x + gate.length;
                    return isAtGatePosition && isInGateX;
                });
                break;
            case 'left':
                // 检查方块是否贴着左边界且能够向左滑出
                canSlideOut = blockCells.some(cell => {
                    const isAtGatePosition = cell.x === 0; // 棋盘左边界是 x=0
                    const isInGateY = cell.y >= gate.position.y && cell.y < gate.position.y + gate.length;
                    return isAtGatePosition && isInGateY;
                });
                break;
            case 'right':
                // 检查方块是否贴着右边界且能够向右滑出
                canSlideOut = blockCells.some(cell => {
                    const isAtGatePosition = cell.x === 7; // 棋盘右边界是 x=7
                    const isInGateY = cell.y >= gate.position.y && cell.y < gate.position.y + gate.length;
                    return isAtGatePosition && isInGateY;
                });
                break;
            default:
                return false;
        }

        if (!canSlideOut) {
            console.log(`[门检测] 方块不能滑出门`);
            return false;
        }

        // 检查路径上是否有障碍物
        return this.checkPathClear(block, gate, grid, blocks);
    }

    /**
     * 检查方块到门的路径是否畅通
     */
    checkPathClear(block, gate, grid, blocks) {
        const blockCells = this.getBlockCells(block);
        
        // 检查方块当前位置是否有其他方块
        for (const cell of blockCells) {
            if (grid && grid[cell.y] && grid[cell.y][cell.x]) {
                const gridValue = grid[cell.y][cell.x];
                if (gridValue && gridValue !== block.id) {
                    console.log(`[路径检查] 位置 (${cell.x}, ${cell.y}) 被 ${gridValue} 阻挡`);
                    return false;
                }
            }
        }
        
        // 检查门的位置是否有其他方块阻挡
        const gateCells = this.getGateCells(gate);
        for (const cell of gateCells) {
            if (grid && grid[cell.y] && grid[cell.y][cell.x]) {
                const gridValue = grid[cell.y][cell.x];
                if (gridValue && gridValue !== block.id) {
                    console.log(`[路径检查] 门位置 (${cell.x}, ${cell.y}) 被 ${gridValue} 阻挡`);
                    return false;
                }
            }
        }
        
        console.log(`[路径检查] 路径畅通，方块可以通过门`);
        return true;
    }
    
    /**
     * 获取门占据的格子
     */
    getGateCells(gate) {
        const cells = [];
        
        switch (gate.direction) {
            case 'up':
                // 门在上边界，y=0
                for (let x = gate.position.x; x < gate.position.x + gate.length; x++) {
                    cells.push({x, y: 0});
                }
                break;
            case 'down':
                // 门在下边界，y=7
                for (let x = gate.position.x; x < gate.position.x + gate.length; x++) {
                    cells.push({x, y: 7});
                }
                break;
            case 'left':
                // 门在左边界，x=0
                for (let y = gate.position.y; y < gate.position.y + gate.length; y++) {
                    cells.push({x: 0, y});
                }
                break;
            case 'right':
                // 门在右边界，x=7
                for (let y = gate.position.y; y < gate.position.y + gate.length; y++) {
                    cells.push({x: 7, y});
                }
                break;
        }
        
        return cells;
    }

    /**
     * 获取网格值
     */
    getGridValue(x, y) {
        // 这里需要访问游戏引擎的网格数据
        // 暂时返回null，需要从外部传入
        return null;
    }

    /**
     * 获取方块的边界尺寸
     */
    getBlockBounds(block) {
        if (!block.shapeData || !block.shapeData.blocks) {
            return {width: 1, height: 1};
        }

        const blocks = block.shapeData.blocks;
        const minX = Math.min(...blocks.map(b => b[0]));
        const maxX = Math.max(...blocks.map(b => b[0]));
        const minY = Math.min(...blocks.map(b => b[1]));
        const maxY = Math.max(...blocks.map(b => b[1]));

        return {
            width: maxX - minX + 1, height: maxY - minY + 1
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
