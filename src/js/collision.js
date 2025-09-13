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
    canExitThroughGate(block, gate) {
        // 检查颜色匹配
        if (block.color !== gate.color) {
            console.log(`[通过门] 颜色不匹配: 方块${block.color} vs 门${gate.color}`);
            return {canExit: false, reason: 'color_mismatch'};
        }

        // 检查尺寸：门的大小必须大于方块的最大宽度或高度
        const blockBounds = this.getBlockBounds(block);
        if (blockBounds.width > gate.size.width || blockBounds.height > gate.size.height) {
            console.log(`[通过门] 尺寸不匹配: 方块(${blockBounds.width}x${blockBounds.height}) vs 门(${gate.size.width}x${gate.size.height})`);
            return {canExit: false, reason: 'size_mismatch'};
        }

        // 检查方块是否在门附近（根据门的方向）
        if (!this.isBlockNearGate(block, gate)) {
            console.log(`[通过门] 方块不在门附近: 方块${block.id}不在门${gate.id}附近`);
            return {canExit: false, reason: 'not_near_gate'};
        }

        console.log(`[通过门] 检查通过: 方块${block.id}可以通过门${gate.id}`);
        return {canExit: true, reason: 'success'};
    }

    /**
     * 检查方块是否在门附近
     */
    isBlockNearGate(block, gate) {
        const blockCells = this.getBlockCells(block);

        switch (gate.direction) {
            case 'up':
                // 门在上方，检查方块是否在门下方
                return blockCells.some(cell => {
                    return cell.x >= gate.position.x && cell.x < gate.position.x + gate.size.width && cell.y === gate.position.y + gate.size.height;
                });
            case 'down':
                // 门在下方，检查方块是否在门上方
                return blockCells.some(cell => {
                    return cell.x >= gate.position.x && cell.x < gate.position.x + gate.size.width && cell.y === gate.position.y - 1;
                });
            case 'left':
                // 门在左侧，检查方块是否在门右侧
                return blockCells.some(cell => {
                    return cell.y >= gate.position.y && cell.y < gate.position.y + gate.size.height && cell.x === gate.position.x + gate.size.width;
                });
            case 'right':
                // 门在右侧，检查方块是否在门左侧
                return blockCells.some(cell => {
                    return cell.y >= gate.position.y && cell.y < gate.position.y + gate.size.height && cell.x === gate.position.x - 1;
                });
            default:
                return false;
        }
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
