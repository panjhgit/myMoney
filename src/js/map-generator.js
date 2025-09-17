/**
 * 地图生成器工具
 * 自动生成无重叠的地图布局，使用高级算法确保布局合理性
 */

class MapGenerator {
    constructor(gridSize = 8) {
        this.GRID_SIZE = gridSize;
        this.validator = new MapLayoutValidator(gridSize);
        this.availableBlockTypes = Object.keys(window.BLOCK_TYPES || {});
        this.availableColors = Object.keys(window.BLOCK_COLORS || {});
        
        // 生成策略配置
        this.generationConfig = {
            maxBlocksPerLayer: 6,
            maxLayers: 3,
            minBlocksPerColor: 1,
            maxBlocksPerColor: 3,
            preferComplexShapes: true,
            ensureSolvability: true
        };
    }
    
    /**
     * 生成完整地图
     */
    generateMap(level = 1, difficulty = 'medium') {
        console.log(`开始生成地图 - 等级: ${level}, 难度: ${difficulty}`);
        
        // 根据难度调整配置
        this.adjustConfigForDifficulty(difficulty);
        
        // 生成棋盘矩阵
        const boardMatrix = this.generateBoardMatrix();
        
        // 生成方块布局
        const tetrisBlocks = this.generateBlockLayout(boardMatrix);
        
        // 生成石块
        const rocks = this.generateRocks(boardMatrix);
        
        // 组装地图数据
        const mapData = {
            level: level,
            name: `自动生成地图 ${level}`,
            description: `难度: ${difficulty}, 自动生成`,
            difficulty: difficulty,
            boardMatrix: boardMatrix,
            tetrisBlocks: tetrisBlocks,
            rocks: rocks
        };
        
        // 验证生成的地图
        const validationResult = this.validator.validateMapLayout(mapData);
        
        if (!validationResult.isValid) {
            console.warn('生成的地图验证失败，尝试修复...');
            return this.fixMapLayout(mapData, validationResult);
        }
        
        console.log('地图生成完成 ✅');
        return mapData;
    }
    
    /**
     * 根据难度调整配置
     */
    adjustConfigForDifficulty(difficulty) {
        switch (difficulty) {
            case 'easy':
                this.generationConfig.maxBlocksPerLayer = 4;
                this.generationConfig.maxLayers = 2;
                this.generationConfig.preferComplexShapes = false;
                break;
            case 'medium':
                this.generationConfig.maxBlocksPerLayer = 6;
                this.generationConfig.maxLayers = 3;
                this.generationConfig.preferComplexShapes = true;
                break;
            case 'hard':
                this.generationConfig.maxBlocksPerLayer = 8;
                this.generationConfig.maxLayers = 4;
                this.generationConfig.preferComplexShapes = true;
                break;
        }
    }
    
    /**
     * 生成棋盘矩阵
     */
    generateBoardMatrix() {
        const matrix = [];
        
        // 创建10x10矩阵
        for (let y = 0; y < 10; y++) {
            matrix[y] = [];
            for (let x = 0; x < 10; x++) {
                if (y === 0 || y === 9 || x === 0 || x === 9) {
                    // 边界处理
                    if ((y === 0 && x >= 1 && x <= 3) || (y === 0 && x >= 6 && x <= 8)) {
                        matrix[y][x] = y === 0 ? (x <= 3 ? 2 : 3) : 1; // 门或墙
                    } else if ((y === 9 && x >= 1 && x <= 3) || (y === 9 && x >= 6 && x <= 8)) {
                        matrix[y][x] = y === 9 ? (x <= 3 ? 4 : 5) : 1;
                    } else if ((x === 0 && y >= 1 && y <= 3) || (x === 0 && y >= 6 && y <= 8)) {
                        matrix[y][x] = x === 0 ? (y <= 3 ? 6 : 7) : 1;
                    } else if ((x === 9 && y >= 1 && y <= 3) || (x === 9 && y >= 6 && y <= 8)) {
                        matrix[y][x] = x === 9 ? (y <= 3 ? 8 : 9) : 1;
                    } else {
                        matrix[y][x] = 1; // 墙
                    }
                } else {
                    matrix[y][x] = 0; // 游戏区域
                }
            }
        }
        
        return matrix;
    }
    
    /**
     * 生成方块布局 - 从第0层开始向下生成
     */
    generateBlockLayout(boardMatrix = null) {
        const blocks = [];
        const colorUsage = new Map();
        let blockId = 1;
        
        // 为每种颜色分配方块
        this.availableColors.forEach(color => {
            colorUsage.set(color, 0);
        });
        
        // 先生成第0层（可移动方块），确保有解
        console.log('正在生成第0层（可移动）方块...');
        const layer0Blocks = this.generateLayerBlocks(0, colorUsage, blockId, false, [], boardMatrix);
        blocks.push(...layer0Blocks);
        blockId += layer0Blocks.length;
        console.log(`第0层生成了${layer0Blocks.length}个方块`);
        
        // 从第1层开始逐层向下生成冰块
        for (let layer = 1; layer < this.generationConfig.maxLayers; layer++) {
            console.log(`正在生成第${layer}层方块...`);
            
            // 获取当前层以上的所有方块（用于覆盖检查）
            const upperLayerBlocks = blocks.filter(block => block.layer < layer);
            
            // 生成当前层方块，确保被上层覆盖
            const layerBlocks = this.generateLayerBlocks(
                layer, 
                colorUsage, 
                blockId, 
                true, // 第1层及以上都是冰块
                upperLayerBlocks, 
                boardMatrix
            );
            
            // 验证当前层被上层正确覆盖
            if (upperLayerBlocks.length > 0) {
                const coverageResult = this.validateLayerCoverage(upperLayerBlocks, layerBlocks);
                if (!coverageResult.allCovered) {
                    console.warn(`第${layer}层未被上层完全覆盖，尝试修复...`);
                    // 尝试修复覆盖问题
                    const fixedBlocks = this.fixLayerCoverage(upperLayerBlocks, layerBlocks, boardMatrix);
                    blocks.push(...fixedBlocks);
                } else {
                    blocks.push(...layerBlocks);
                }
            } else {
                blocks.push(...layerBlocks);
            }
            
            blockId += layerBlocks.length;
            console.log(`第${layer}层生成了${layerBlocks.length}个方块`);
        }
        
        console.log(`总共生成了${blocks.length}个方块`);
        
        return blocks;
    }
    
    /**
     * 生成指定层的方块 - 优化版本，避免重叠
     */
    generateLayerBlocks(layer, colorUsage, startId, isIceLayer = false, existingIceBlocks = [], boardMatrix = null) {
        const blocks = [];
        const maxBlocks = Math.min(
            this.generationConfig.maxBlocksPerLayer,
            Math.floor(this.GRID_SIZE * this.GRID_SIZE / 4) // 最多占用1/4的空间
        );
        
        // 创建当前层的占用地图
        const layerOccupancy = new Map();
        
        let attempts = 0;
        const maxAttempts = 500; // 增加尝试次数
        
        while (blocks.length < maxBlocks && attempts < maxAttempts) {
            attempts++;
            
            // 选择颜色
            const color = this.selectColor(colorUsage);
            if (!color) break;
            
            // 选择方块类型
            const blockType = this.selectBlockType(layer);
            
            // 寻找可用位置
            const position = this.findAvailablePosition(blockType, layer, isIceLayer, existingIceBlocks, boardMatrix, layerOccupancy);
            if (!position) continue;
            
            // 创建方块
            const block = {
                id: `block_${startId + blocks.length}`,
                color: color,
                position: position,
                blockType: blockType,
                layer: layer,
                isIce: layer > 0
            };
            
            // 验证方块不会造成重叠
            if (this.validateBlockPlacement(block, isIceLayer, existingIceBlocks, boardMatrix, layerOccupancy)) {
                blocks.push(block);
                colorUsage.set(color, colorUsage.get(color) + 1);
                
                // 标记当前层的位置被占用
                this.markLayerPositionOccupied(block, layerOccupancy);
            }
        }
        
        return blocks;
    }
    
    /**
     * 选择颜色
     */
    selectColor(colorUsage) {
        // 优先选择使用较少的颜色
        const sortedColors = Array.from(colorUsage.entries())
            .sort((a, b) => a[1] - b[1])
            .map(([color]) => color);
        
        // 随机选择，但偏向使用较少的颜色
        const weights = sortedColors.map((_, index) => Math.pow(2, sortedColors.length - index));
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        const random = Math.random() * totalWeight;
        
        let currentWeight = 0;
        for (let i = 0; i < sortedColors.length; i++) {
            currentWeight += weights[i];
            if (random <= currentWeight) {
                return sortedColors[i];
            }
        }
        
        return sortedColors[0];
    }
    
    /**
     * 选择方块类型
     */
    selectBlockType(layer) {
        if (this.generationConfig.preferComplexShapes && layer === 0) {
            // 顶层优先选择复杂形状
            const complexShapes = ['square', 'lshape_up', 'tshape_up', 'hshape_up'];
            return complexShapes[Math.floor(Math.random() * complexShapes.length)];
        } else {
            // 其他层随机选择
            return this.availableBlockTypes[Math.floor(Math.random() * this.availableBlockTypes.length)];
        }
    }
    
    /**
     * 寻找可用位置 - 优化版本
     */
    findAvailablePosition(blockType, layer, isIceLayer = false, existingIceBlocks = [], boardMatrix = null, layerOccupancy = null) {
        const typeData = window.BLOCK_TYPES[blockType];
        if (!typeData) return null;
        
        let attempts = 0;
        const maxAttempts = 300;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            // 在棋盘矩阵中寻找可用位置
            const position = this.findRandomValidPosition(boardMatrix, typeData);
            if (!position) continue;
            
            // 检查位置是否可用
            if (this.isPositionAvailable(position.x, position.y, blockType, layer, isIceLayer, existingIceBlocks, boardMatrix, layerOccupancy)) {
                return position;
            }
        }
        
        return null;
    }
    
    /**
     * 在棋盘矩阵中寻找随机有效位置
     */
    findRandomValidPosition(boardMatrix, typeData) {
        if (!boardMatrix) {
            // 如果没有棋盘矩阵，使用默认的8x8区域
            const x = Math.floor(Math.random() * (this.GRID_SIZE - typeData.width + 1)) + 1;
            const y = Math.floor(Math.random() * (this.GRID_SIZE - typeData.height + 1)) + 1;
            return { x, y };
        }
        
        // 在棋盘矩阵中寻找值为0的位置（游戏区域）
        const validPositions = [];
        
        for (let y = 0; y < boardMatrix.length; y++) {
            for (let x = 0; x < boardMatrix[y].length; x++) {
                if (boardMatrix[y][x] === 0) {
                    // 检查这个位置是否能放下方块
                    let canFit = true;
                    for (const blockCell of typeData.blocks) {
                        const cellX = x + blockCell[0];
                        const cellY = y + blockCell[1];
                        
                        // 检查是否超出边界或不是游戏区域
                        if (cellY < 0 || cellY >= boardMatrix.length || 
                            cellX < 0 || cellX >= boardMatrix[cellY].length ||
                            boardMatrix[cellY][cellX] !== 0) {
                            canFit = false;
                            break;
                        }
                    }
                    
                    if (canFit) {
                        validPositions.push({ x, y });
                    }
                }
            }
        }
        
        if (validPositions.length === 0) {
            return null;
        }
        
        // 随机选择一个有效位置
        const randomIndex = Math.floor(Math.random() * validPositions.length);
        return validPositions[randomIndex];
    }
    
    /**
     * 检查位置是否可用 - 优化版本
     */
    isPositionAvailable(x, y, blockType, layer, isIceLayer = false, existingIceBlocks = [], boardMatrix = null, layerOccupancy = null) {
        const typeData = window.BLOCK_TYPES[blockType];
        if (!typeData) return false;
        
        // 检查每个格子是否可用
        for (const blockCell of typeData.blocks) {
            const cellX = x + blockCell[0];
            const cellY = y + blockCell[1];
            
            // 检查是否在棋盘矩阵的有效区域内
            if (boardMatrix) {
                if (cellY < 0 || cellY >= boardMatrix.length || 
                    cellX < 0 || cellX >= boardMatrix[cellY].length ||
                    boardMatrix[cellY][cellX] !== 0) {
                    return false;
                }
            } else {
                // 如果没有棋盘矩阵，使用默认的8x8区域
                if (cellX < 1 || cellX > this.GRID_SIZE || cellY < 1 || cellY > this.GRID_SIZE) {
                    return false;
                }
            }
            
            // 检查当前层是否被占用
            if (layerOccupancy) {
                const key = `${cellX},${cellY}`;
                if (layerOccupancy.has(key)) {
                    return false;
                }
            }
            
            // 检查是否被其他方块占用
            if (this.validator.isPositionOccupied(cellX, cellY, layer)) {
                return false;
            }
            
            // 如果是冰块层，需要确保上面有方块覆盖
            if (isIceLayer) {
                if (!this.hasBlockAbove(cellX, cellY, existingIceBlocks)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * 检查冰块上方是否有方块覆盖
     */
    hasBlockAbove(x, y, upperLayerBlocks) {
        // 检查上层方块是否覆盖这个位置
        for (const upperBlock of upperLayerBlocks) {
            const upperCells = this.getBlockCells(upperBlock);
            if (upperCells.some(cell => cell.x === x && cell.y === y)) {
                return true; // 被上层方块覆盖
            }
        }
        
        return false; // 没有被上层方块覆盖
    }
    
    /**
     * 检查是否与上层方块重叠
     */
    isOverlappingWithUpperLayer(x, y, upperLayerBlocks) {
        // 检查上层方块是否占据这个位置
        for (const upperBlock of upperLayerBlocks) {
            const upperCells = this.getBlockCells(upperBlock);
            if (upperCells.some(cell => cell.x === x && cell.y === y)) {
                return true; // 与上层方块重叠
            }
        }
        
        return false; // 不与上层方块重叠
    }
    
    /**
     * 验证方块放置
     */
    validateBlockPlacement(block, isIceLayer = false, existingIceBlocks = [], boardMatrix = null) {
        // 检查方块是否在有效区域内
        const typeData = window.BLOCK_TYPES[block.blockType];
        if (!typeData) return false;
        
        for (const blockCell of typeData.blocks) {
            const cellX = block.position.x + blockCell[0];
            const cellY = block.position.y + blockCell[1];
            
            // 检查是否在棋盘矩阵的有效区域内
            if (boardMatrix) {
                if (cellY < 0 || cellY >= boardMatrix.length || 
                    cellX < 0 || cellX >= boardMatrix[cellY].length ||
                    boardMatrix[cellY][cellX] !== 0) {
                    return false;
                }
            } else {
                // 如果没有棋盘矩阵，使用默认的8x8区域
                if (cellX < 1 || cellX > this.GRID_SIZE || cellY < 1 || cellY > this.GRID_SIZE) {
                    return false;
                }
            }
        }
        
        // 如果是第0层方块，需要确保覆盖冰块
        if (block.layer === 0 && existingIceBlocks.length > 0) {
            return this.ensuresIceCoverage(block, existingIceBlocks);
        }
        
        return true;
    }
    
    /**
     * 确保第0层方块覆盖冰块
     */
    ensuresIceCoverage(block, existingIceBlocks) {
        const blockCells = this.getBlockCells(block);
        
        // 检查是否至少覆盖一个冰块
        for (const blockCell of blockCells) {
            for (const iceBlock of existingIceBlocks) {
                const iceCells = this.getBlockCells(iceBlock);
                if (iceCells.some(iceCell => iceCell.x === blockCell.x && iceCell.y === blockCell.y)) {
                    return true; // 至少覆盖一个冰块
                }
            }
        }
        
        return false; // 没有覆盖任何冰块
    }
    
    /**
     * 验证层级覆盖关系
     */
    validateLayerCoverage(upperBlocks, lowerBlocks) {
        const uncoveredBlocks = [];
        
        lowerBlocks.forEach(lowerBlock => {
            const lowerCells = this.getBlockCells(lowerBlock);
            const isCovered = lowerCells.some(lowerCell => {
                return upperBlocks.some(upperBlock => {
                    const upperCells = this.getBlockCells(upperBlock);
                    return upperCells.some(upperCell => 
                        upperCell.x === lowerCell.x && upperCell.y === lowerCell.y
                    );
                });
            });
            
            if (!isCovered) {
                uncoveredBlocks.push(lowerBlock);
            }
        });
        
        return {
            allCovered: uncoveredBlocks.length === 0,
            uncoveredBlocks: uncoveredBlocks
        };
    }
    
    /**
     * 修复层级覆盖问题
     */
    fixLayerCoverage(upperBlocks, lowerBlocks, boardMatrix) {
        const uncoveredBlocks = this.validateLayerCoverage(upperBlocks, lowerBlocks).uncoveredBlocks;
        
        if (uncoveredBlocks.length === 0) {
            return upperBlocks;
        }
        
        console.log(`尝试修复${uncoveredBlocks.length}个未覆盖的方块...`);
        
        // 为每个未覆盖的方块尝试添加覆盖方块
        const additionalBlocks = [];
        
        uncoveredBlocks.forEach(uncoveredBlock => {
            const uncoveredCells = this.getBlockCells(uncoveredBlock);
            
            // 尝试在未覆盖的方块上方添加一个简单的方块
            for (const cell of uncoveredCells) {
                const coveringBlock = {
                    id: `fix_${Date.now()}_${Math.random()}`,
                    color: this.selectColor(new Map()),
                    position: { x: cell.x, y: cell.y },
                    blockType: 'single',
                    layer: upperBlocks[0]?.layer || 0,
                    isIce: false
                };
                
                // 检查这个覆盖方块是否有效
                if (this.validateBlockPlacement(coveringBlock, false, [], boardMatrix)) {
                    additionalBlocks.push(coveringBlock);
                    break; // 找到一个覆盖方块就够了
                }
            }
        });
        
        return [...upperBlocks, ...additionalBlocks];
    }
    
    /**
     * 验证所有冰块都被覆盖（保留向后兼容）
     */
    validateAllIceCovered(iceBlocks, topBlocks) {
        return this.validateLayerCoverage(topBlocks, iceBlocks);
    }
    
    /**
     * 获取方块的格子位置
     */
    getBlockCells(block) {
        if (!block.blockType || !window.BLOCK_TYPES) {
            return [{ x: block.position.x, y: block.position.y }];
        }
        
        const typeData = window.BLOCK_TYPES[block.blockType];
        if (!typeData) {
            return [{ x: block.position.x, y: block.position.y }];
        }
        
        return typeData.blocks.map(blockCell => ({
            x: block.position.x + blockCell[0],
            y: block.position.y + blockCell[1]
        }));
    }
    
    /**
     * 标记位置被占用
     */
    markPositionOccupied(block) {
        // 临时标记，用于生成过程中的冲突检测
        // 实际验证会由validator处理
    }
    
    /**
     * 标记层级位置被占用
     */
    markLayerPositionOccupied(block, layerOccupancy) {
        const cells = this.getBlockCells(block);
        cells.forEach(cell => {
            const key = `${cell.x},${cell.y}`;
            layerOccupancy.set(key, block.id);
        });
    }
    
    /**
     * 生成石块
     */
    generateRocks(boardMatrix = null) {
        const rocks = [];
        const maxRocks = Math.floor(this.GRID_SIZE * this.GRID_SIZE * 0.1); // 最多10%的空间
        const rockCount = Math.floor(Math.random() * maxRocks) + 1;
        
        for (let i = 0; i < rockCount; i++) {
            const position = this.findRandomEmptyPosition(boardMatrix);
            if (position) {
                rocks.push({
                    id: `rock_${i + 1}`,
                    position: position,
                    layer: 0
                });
            }
        }
        
        return rocks;
    }
    
    /**
     * 寻找随机空位置
     */
    findRandomEmptyPosition(boardMatrix = null) {
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            let x, y;
            
            if (boardMatrix) {
                // 在棋盘矩阵中寻找值为0的位置
                const validPositions = [];
                for (let row = 0; row < boardMatrix.length; row++) {
                    for (let col = 0; col < boardMatrix[row].length; col++) {
                        if (boardMatrix[row][col] === 0) {
                            validPositions.push({ x: col, y: row });
                        }
                    }
                }
                
                if (validPositions.length === 0) {
                    return null;
                }
                
                const randomPos = validPositions[Math.floor(Math.random() * validPositions.length)];
                x = randomPos.x;
                y = randomPos.y;
            } else {
                // 如果没有棋盘矩阵，使用默认的8x8区域
                x = Math.floor(Math.random() * this.GRID_SIZE) + 1;
                y = Math.floor(Math.random() * this.GRID_SIZE) + 1;
            }
            
            if (!this.validator.isPositionOccupied(x, y, 0)) {
                return { x, y };
            }
        }
        
        return null;
    }
    
    /**
     * 修复地图布局
     */
    fixMapLayout(mapData, validationResult) {
        console.log('尝试修复地图布局...');
        
        // 这里可以实现自动修复逻辑
        // 比如移除重叠的方块，调整位置等
        
        return mapData;
    }
}

// 全局地图生成器
window.mapGenerator = new MapGenerator();

// 便捷函数
window.generateMap = function(level = 1, difficulty = 'medium') {
    return window.mapGenerator.generateMap(level, difficulty);
};

console.log('地图生成器已加载');
