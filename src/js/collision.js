/**
 * 碰撞检测模块
 * 负责处理方块与各种元素的碰撞检测
 */

class CollisionDetector {
    constructor(gridSize) {
        this.GRID_SIZE = gridSize;
        this.mapEngine = null; // MapEngine 引用
    }

    /**
     * 设置 MapEngine 引用
     */
    setMapEngine(mapEngine) {
        this.mapEngine = mapEngine;
    }

    /**
     * 检查位置是否在边界内
     */
    isValidPosition(x, y) {
        if (this.mapEngine && this.mapEngine.boardMatrix) {
            return this.mapEngine.isValidBoardPosition(x, y);
        }
        // 如果没有棋盘系统，则认为位置无效
        return false;
    }

    /**
     * 获取方块占据的格子
     */
    getBlockCells(block, position = null) {
        const pos = position || block.position;
        
        // 使用 Block 类的方法获取方块格子
        if (block.getCells && typeof block.getCells === 'function') {
            return block.getCells().map(cell => ({
                x: pos.x + (cell.x - block.position.x),
                y: pos.y + (cell.y - block.position.y)
            }));
        }
        
        // 如果不是 Block 类，返回空数组
        console.warn('getBlockCells: 方块不是 Block 类实例', block);
        return [];
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
        
        // 0. 检查方块的所有格子是否都在有效范围内
        if (!this.areAllBlockCellsValid(blockCells)) {
            return false;
        }
        
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
     * 检查方块的所有格子是否都在有效范围内
     */
    areAllBlockCellsValid(blockCells) {
        return blockCells.every(cell => this.isValidPosition(cell.x, cell.y));
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
        
        // 获取游戏区域的边界
        const gameAreaBounds = this.getGameAreaBounds();
        
        switch (gate.direction) {
            case 'up':
                // 检查是否有格子贴着上边界
                return blockCells.some(cell => cell.y === gameAreaBounds.minY);
                
            case 'down':
                // 检查是否有格子贴着下边界
                return blockCells.some(cell => cell.y === gameAreaBounds.maxY);
                
            case 'left':
                // 检查是否有格子贴着左边界
                return blockCells.some(cell => cell.x === gameAreaBounds.minX);
                
            case 'right':
                // 检查是否有格子贴着右边界
                return blockCells.some(cell => cell.x === gameAreaBounds.maxX);
                
            default:
                return false;
        }
    }
    
    /**
     * 获取游戏区域的边界
     */
    getGameAreaBounds() {
        if (this.mapEngine && this.mapEngine.boardMatrix) {
            // 从boardMatrix中找到值为0的区域边界
            const matrix = this.mapEngine.boardMatrix;
            let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
            
            for (let y = 0; y < matrix.length; y++) {
                for (let x = 0; x < matrix[y].length; x++) {
                    if (matrix[y][x] === 0) { // 0表示游戏区域
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    }
                }
            }
            
            return { minX, maxX, minY, maxY };
        }
        
        // 如果没有boardMatrix，使用默认的8x8区域 (0,0)到(7,7)
        return { minX: 0, maxX: this.GRID_SIZE - 1, minY: 0, maxY: this.GRID_SIZE - 1 };
    }
    
    /**
     * 检查出门路径是否畅通
     */
    isExitPathClear(block, gate, grid, blocks, blockCells = null) {
        if (!blockCells) {
            blockCells = this.getBlockCells(block);
        }
        
        // 获取游戏区域的边界
        const gameAreaBounds = this.getGameAreaBounds();
        
        // 计算方块需要移动多少步才能完全离开网格
        const minX = Math.min(...blockCells.map(cell => cell.x));
        const maxX = Math.max(...blockCells.map(cell => cell.x));
        const minY = Math.min(...blockCells.map(cell => cell.y));
        const maxY = Math.max(...blockCells.map(cell => cell.y));
        
        let stepsToExit = 0;
        switch (gate.direction) {
            case 'up':
                stepsToExit = minY - gameAreaBounds.minY + 1 + (maxY - minY);
                break;
            case 'down':
                stepsToExit = gameAreaBounds.maxY - maxY + 1 + (maxY - minY);
                break;
            case 'left':
                stepsToExit = minX - gameAreaBounds.minX + 1 + (maxX - minX);
                break;
            case 'right':
                stepsToExit = gameAreaBounds.maxX - maxX + 1 + (maxX - minX);
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
        // 使用 Block 类的方法获取方块格子
        if (block.getCells && typeof block.getCells === 'function') {
            const cells = block.getCells();
            if (cells.length === 0) {
                return {width: 1, height: 1};
            }

            const minX = Math.min(...cells.map(c => c.x));
            const maxX = Math.max(...cells.map(c => c.x));
            const minY = Math.min(...cells.map(c => c.y));
            const maxY = Math.max(...cells.map(c => c.y));

            return {
                width: maxX - minX + 1, 
                height: maxY - minY + 1,
                minX, maxX, minY, maxY
            };
        }
        
        // 如果不是 Block 类，返回默认尺寸
        console.warn('getBlockBounds: 方块不是 Block 类实例', block);
        return {width: 1, height: 1};
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
window.CollisionDetector = CollisionDetector;
