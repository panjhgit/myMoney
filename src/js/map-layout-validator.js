/**
 * 地图布局验证工具
 * 使用高级数据结构（Map、位图）来精确跟踪和验证地图布局
 * 支持多层方块、石块、门等元素的占用检测
 */

class MapLayoutValidator {
    constructor(gridSize = 8) {
        this.GRID_SIZE = gridSize;
        this.MAX_LAYERS = 10;
        
        // 使用Map存储每层的占用情况
        this.layerOccupancy = new Map(); // layer -> Map<position, elementInfo>
        this.elementRegistry = new Map(); // elementId -> elementInfo
        
        // 位图表示（可选，用于快速查询）
        this.bitmapLayers = new Map(); // layer -> Uint8Array
        
        this.initializeDataStructures();
    }
    
    /**
     * 初始化数据结构
     */
    initializeDataStructures() {
        // 初始化每层的占用Map
        for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
            this.layerOccupancy.set(layer, new Map());
        }
        
        // 初始化位图（如果需要）
        this.initializeBitmaps();
    }
    
    /**
     * 初始化位图
     */
    initializeBitmaps() {
        const bitmapSize = this.GRID_SIZE * this.GRID_SIZE;
        for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
            this.bitmapLayers.set(layer, new Uint8Array(bitmapSize));
        }
    }
    
    /**
     * 位置转索引（用于位图）
     */
    positionToIndex(x, y) {
        return y * this.GRID_SIZE + x;
    }
    
    /**
     * 索引转位置（用于位图）
     */
    indexToPosition(index) {
        return {
            x: index % this.GRID_SIZE,
            y: Math.floor(index / this.GRID_SIZE)
        };
    }
    
    /**
     * 注册方块元素
     */
    registerBlock(block) {
        const elementInfo = {
            id: block.id,
            type: 'block',
            color: block.color,
            blockType: block.blockType,
            layer: block.layer,
            position: { ...block.position },
            cells: this.getBlockCells(block),
            isIce: block.isIce || false,
            movable: block.movable !== false
        };
        
        this.elementRegistry.set(block.id, elementInfo);
        this.markOccupied(elementInfo);
        
        return elementInfo;
    }
    
    /**
     * 注册石块元素
     */
    registerRock(rock) {
        const elementInfo = {
            id: rock.id,
            type: 'rock',
            layer: rock.layer || 0,
            position: { ...rock.position },
            cells: [{ x: rock.position.x, y: rock.position.y }]
        };
        
        this.elementRegistry.set(rock.id, elementInfo);
        this.markOccupied(elementInfo);
        
        return elementInfo;
    }
    
    /**
     * 标记位置被占用
     */
    markOccupied(elementInfo) {
        const layer = elementInfo.layer;
        const layerMap = this.layerOccupancy.get(layer);
        const bitmap = this.bitmapLayers.get(layer);
        
        elementInfo.cells.forEach(cell => {
            const key = `${cell.x},${cell.y}`;
            const index = this.positionToIndex(cell.x, cell.y);
            
            // 检查是否已被占用
            if (layerMap.has(key)) {
                const existingElement = layerMap.get(key);
                console.warn(`⚠️  重叠检测: ${elementInfo.id} 与 ${existingElement.id} 在位置 (${cell.x}, ${cell.y}) 第${layer}层重叠`);
            }
            
            // 标记占用
            layerMap.set(key, elementInfo);
            bitmap[index] = 1;
        });
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
     * 验证地图布局
     */
    validateMapLayout(mapData) {
        console.log('=== 地图布局验证开始 ===');
        console.log(`地图: ${mapData.name} (${mapData.level}级)`);
        
        // 清空之前的数据
        this.clearAll();
        
        const validationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: {
                totalBlocks: 0,
                totalRocks: 0,
                layerDistribution: {},
                colorDistribution: {}
            }
        };
        
        // 验证方块
        if (mapData.tetrisBlocks) {
            mapData.tetrisBlocks.forEach(block => {
                try {
                    const elementInfo = this.registerBlock(block);
                    validationResult.statistics.totalBlocks++;
                    
                    // 统计层级分布
                    const layer = elementInfo.layer;
                    validationResult.statistics.layerDistribution[layer] = 
                        (validationResult.statistics.layerDistribution[layer] || 0) + 1;
                    
                    // 统计颜色分布
                    const color = elementInfo.color;
                    validationResult.statistics.colorDistribution[color] = 
                        (validationResult.statistics.colorDistribution[color] || 0) + 1;
                        
                } catch (error) {
                    validationResult.errors.push(`方块 ${block.id} 验证失败: ${error.message}`);
                    validationResult.isValid = false;
                }
            });
        }
        
        // 验证石块
        if (mapData.rocks) {
            mapData.rocks.forEach(rock => {
                try {
                    const elementInfo = this.registerRock(rock);
                    validationResult.statistics.totalRocks++;
                } catch (error) {
                    validationResult.errors.push(`石块 ${rock.id} 验证失败: ${error.message}`);
                    validationResult.isValid = false;
                }
            });
        }
        
        // 验证门系统
        this.validateGateSystem(mapData, validationResult);
        
        // 生成详细报告
        this.generateValidationReport(validationResult);
        
        console.log('=== 地图布局验证结束 ===');
        return validationResult;
    }
    
    /**
     * 验证门系统
     */
    validateGateSystem(mapData, validationResult) {
        if (!mapData.boardMatrix) {
            validationResult.warnings.push('缺少棋盘矩阵数据');
            return;
        }
        
        const gateCount = new Map();
        const boardMatrix = mapData.boardMatrix;
        
        // 统计门
        for (let y = 0; y < boardMatrix.length; y++) {
            for (let x = 0; x < boardMatrix[y].length; x++) {
                const value = boardMatrix[y][x];
                if (value >= 2 && value <= 9) {
                    const color = window.GAME_CONFIG?.BOARD_SYSTEM?.GATE_COLOR_MAP?.[value] || `color_${value}`;
                    gateCount.set(color, (gateCount.get(color) || 0) + 1);
                }
            }
        }
        
        // 检查方块颜色与门的匹配
        const blockColors = new Set();
        this.elementRegistry.forEach(element => {
            if (element.type === 'block' && element.layer === 0) {
                blockColors.add(element.color);
            }
        });
        
        gateCount.forEach((count, color) => {
            if (!blockColors.has(color)) {
                validationResult.warnings.push(`门颜色 ${color} 没有对应的方块`);
            }
        });
        
        blockColors.forEach(color => {
            if (!gateCount.has(color)) {
                validationResult.warnings.push(`方块颜色 ${color} 没有对应的门`);
            }
        });
    }
    
    /**
     * 生成验证报告
     */
    generateValidationReport(result) {
        console.log('\n--- 验证结果 ---');
        console.log(`总体状态: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);
        
        if (result.errors.length > 0) {
            console.log('\n❌ 错误:');
            result.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        if (result.warnings.length > 0) {
            console.log('\n⚠️  警告:');
            result.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        console.log('\n📊 统计信息:');
        console.log(`  总方块数: ${result.statistics.totalBlocks}`);
        console.log(`  总石块数: ${result.statistics.totalRocks}`);
        console.log(`  层级分布:`, result.statistics.layerDistribution);
        console.log(`  颜色分布:`, result.statistics.colorDistribution);
        
        // 打印每层的占用情况
        this.printLayerOccupancy();
    }
    
    /**
     * 打印每层的占用情况
     */
    printLayerOccupancy() {
        console.log('\n--- 层级占用情况 ---');
        
        for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
            const layerMap = this.layerOccupancy.get(layer);
            if (layerMap.size > 0) {
                console.log(`\n第${layer}层 (${layerMap.size}个位置):`);
                
                // 按位置排序显示
                const sortedPositions = Array.from(layerMap.entries())
                    .sort(([a], [b]) => {
                        const [ax, ay] = a.split(',').map(Number);
                        const [bx, by] = b.split(',').map(Number);
                        return ay - by || ax - bx;
                    });
                
                sortedPositions.forEach(([position, element]) => {
                    console.log(`  (${position}): ${element.id} [${element.type}] ${element.color || ''}`);
                });
            }
        }
    }
    
    /**
     * 检查位置是否被占用
     */
    isPositionOccupied(x, y, layer = 0) {
        const layerMap = this.layerOccupancy.get(layer);
        const key = `${x},${y}`;
        return layerMap.has(key);
    }
    
    /**
     * 获取位置上的元素
     */
    getElementAt(x, y, layer = 0) {
        const layerMap = this.layerOccupancy.get(layer);
        const key = `${x},${y}`;
        return layerMap.get(key) || null;
    }
    
    /**
     * 查找可用位置
     */
    findAvailablePositions(layer = 0, blockType = 'single') {
        const availablePositions = [];
        const layerMap = this.layerOccupancy.get(layer);
        
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                const key = `${x},${y}`;
                if (!layerMap.has(key)) {
                    availablePositions.push({ x, y });
                }
            }
        }
        
        return availablePositions;
    }
    
    /**
     * 清空所有数据
     */
    clearAll() {
        this.elementRegistry.clear();
        
        for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
            this.layerOccupancy.get(layer).clear();
            const bitmap = this.bitmapLayers.get(layer);
            bitmap.fill(0);
        }
    }
    
    /**
     * 导出布局数据
     */
    exportLayoutData() {
        const layoutData = {
            gridSize: this.GRID_SIZE,
            maxLayers: this.MAX_LAYERS,
            elements: Array.from(this.elementRegistry.values()),
            layerOccupancy: {},
            statistics: {
                totalElements: this.elementRegistry.size,
                layerDistribution: {}
            }
        };
        
        // 导出每层的占用情况
        for (let layer = 0; layer < this.MAX_LAYERS; layer++) {
            const layerMap = this.layerOccupancy.get(layer);
            if (layerMap.size > 0) {
                layoutData.layerOccupancy[layer] = Array.from(layerMap.entries());
                layoutData.statistics.layerDistribution[layer] = layerMap.size;
            }
        }
        
        return layoutData;
    }
}

// 全局验证函数
window.validateMapLayout = function(mapData) {
    const validator = new MapLayoutValidator();
    return validator.validateMapLayout(mapData);
};

// 导出到全局作用域
window.MapLayoutValidator = MapLayoutValidator;

console.log('地图布局验证工具已加载');
