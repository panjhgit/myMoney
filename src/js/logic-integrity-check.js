/**
 * 地图系统逻辑完整性检查
 * 检查所有关键逻辑是否正确实现
 */

console.log('=== 地图系统逻辑完整性检查 ===');

// 检查1: 冰块系统逻辑
console.log('\n1. 冰块系统逻辑检查:');

// 检查冰块显露逻辑
if (typeof window.Block !== 'undefined') {
    console.log('✅ Block类已加载');
    
    // 测试冰块方块创建
    const testIceBlock = new window.Block('test_ice', 'single', 'red', {x: 1, y: 1}, 1, {isIce: true});
    console.log('冰块方块创建成功:', testIceBlock.ice.isIce);
    console.log('冰块是否显露:', testIceBlock.ice.isRevealed);
    console.log('冰块是否可移动:', testIceBlock.movable);
    
    // 测试冰块显露
    testIceBlock.revealIce();
    console.log('冰块显露后状态:', {
        isRevealed: testIceBlock.ice.isRevealed,
        layer: testIceBlock.layer,
        movable: testIceBlock.movable
    });
    
    // 测试冰块融化
    testIceBlock.startMelting();
    console.log('冰块开始融化:', testIceBlock.ice.isMelting);
    
    testIceBlock.updateMeltProgress(0.5);
    console.log('冰块融化进度:', testIceBlock.ice.meltProgress);
    
    testIceBlock.updateMeltProgress(1.0);
    console.log('冰块融化完成:', !testIceBlock.ice.isIce);
    
} else {
    console.log('❌ Block类未加载');
}

// 检查2: 碰撞检测逻辑
console.log('\n2. 碰撞检测逻辑检查:');

if (typeof window.CollisionDetector !== 'undefined') {
    console.log('✅ CollisionDetector已加载');
    
    const collisionDetector = new window.CollisionDetector(8);
    
    // 测试方块格子获取
    if (window.BLOCK_TYPES) {
        const testBlock = {
            position: {x: 1, y: 1},
            blockType: 'square'
        };
        
        const cells = collisionDetector.getBlockCells(testBlock);
        console.log('方块格子获取测试:', cells);
        
        // 测试方块边界
        const bounds = collisionDetector.getBlockBounds(testBlock);
        console.log('方块边界测试:', bounds);
    }
    
} else {
    console.log('❌ CollisionDetector未加载');
}

// 检查3: 移动系统逻辑
console.log('\n3. 移动系统逻辑检查:');

if (typeof window.MovementManager !== 'undefined') {
    console.log('✅ MovementManager已加载');
    
    const movementManager = new window.MovementManager(8);
    
    // 测试路径计算
    const startPos = {x: 1, y: 1};
    const targetPos = {x: 3, y: 3};
    
    // 创建模拟的碰撞检测器
    const mockCollisionDetector = {
        isValidPosition: (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8,
        checkCollision: () => ({collision: false})
    };
    
    const mockGrid = Array(8).fill().map(() => Array(8).fill(null));
    const mockBlocks = new Map();
    const mockRocks = new Set();
    
    const mockBlock = {
        id: 'test_block',
        position: startPos,
        blockType: 'single'
    };
    
    try {
        const path = movementManager.calculatePath(
            mockBlock, startPos, targetPos, 
            mockCollisionDetector, mockGrid, mockBlocks, mockRocks
        );
        console.log('路径计算测试:', path.length > 0 ? '✅ 成功' : '❌ 失败');
        console.log('路径长度:', path.length);
    } catch (error) {
        console.log('路径计算测试失败:', error.message);
    }
    
} else {
    console.log('❌ MovementManager未加载');
}

// 检查4: 地图验证逻辑
console.log('\n4. 地图验证逻辑检查:');

if (typeof window.MapLayoutValidator !== 'undefined') {
    console.log('✅ MapLayoutValidator已加载');
    
    const validator = new window.MapLayoutValidator(8);
    
    // 测试方块注册
    const testBlock = {
        id: 'test_block',
        color: 'red',
        blockType: 'single',
        layer: 0,
        position: {x: 1, y: 1},
        movable: true
    };
    
    try {
        const elementInfo = validator.registerBlock(testBlock);
        console.log('方块注册测试:', elementInfo ? '✅ 成功' : '❌ 失败');
        
        // 测试位置查询
        const isOccupied = validator.isPositionOccupied(1, 1, 0);
        console.log('位置查询测试:', isOccupied ? '✅ 正确' : '❌ 错误');
        
        // 测试重叠检测
        const overlappingBlock = {
            id: 'overlapping_block',
            color: 'blue',
            blockType: 'single',
            layer: 0,
            position: {x: 1, y: 1}, // 相同位置
            movable: true
        };
        
        validator.registerBlock(overlappingBlock);
        console.log('重叠检测测试: 应该检测到重叠');
        
    } catch (error) {
        console.log('地图验证测试失败:', error.message);
    }
    
} else {
    console.log('❌ MapLayoutValidator未加载');
}

// 检查5: 地图生成逻辑
console.log('\n5. 地图生成逻辑检查:');

if (typeof window.mapGenerator !== 'undefined') {
    console.log('✅ MapGenerator已加载');
    
    // 测试棋盘矩阵生成
    const boardMatrix = window.mapGenerator.generateBoardMatrix();
    console.log('棋盘矩阵生成测试:', boardMatrix ? '✅ 成功' : '❌ 失败');
    console.log('棋盘矩阵尺寸:', boardMatrix.length, 'x', boardMatrix[0].length);
    
    // 测试方块布局生成
    try {
        const blocks = window.mapGenerator.generateBlockLayout(boardMatrix);
        console.log('方块布局生成测试:', blocks.length > 0 ? '✅ 成功' : '❌ 失败');
        console.log('生成方块数量:', blocks.length);
        
        // 检查冰块和顶层方块分布
        const layer0Blocks = blocks.filter(b => b.layer === 0);
        const iceBlocks = blocks.filter(b => b.layer > 0);
        console.log('第0层方块:', layer0Blocks.length);
        console.log('冰块方块:', iceBlocks.length);
        
    } catch (error) {
        console.log('方块布局生成测试失败:', error.message);
    }
    
} else {
    console.log('❌ MapGenerator未加载');
}

// 检查6: 配置系统逻辑
console.log('\n6. 配置系统逻辑检查:');

if (typeof window.GAME_CONFIG !== 'undefined' && typeof window.ConfigUtils !== 'undefined') {
    console.log('✅ 配置系统已加载');
    
    // 测试配置一致性
    const validation = window.ConfigUtils.validateConfig();
    console.log('配置一致性检查:', validation);
    
    // 测试配置访问
    const gridSize = window.ConfigUtils.getGridSize();
    const cellSize = window.ConfigUtils.getCellSize();
    const fixedCellSize = window.ConfigUtils.getFixedCellSize();
    
    console.log('配置访问测试:', {
        gridSize: gridSize,
        cellSize: cellSize,
        fixedCellSize: fixedCellSize,
        consistent: gridSize === 8 && cellSize === 45 && fixedCellSize === 45
    });
    
} else {
    console.log('❌ 配置系统未加载');
}

// 检查7: 方块类型系统逻辑
console.log('\n7. 方块类型系统逻辑检查:');

if (typeof window.BLOCK_TYPES !== 'undefined' && typeof window.Block !== 'undefined') {
    console.log('✅ 方块类型系统已加载');
    
    // 测试方块类型
    const testTypes = ['single', 'line2_h', 'square', 'lshape_up'];
    testTypes.forEach(type => {
        if (window.BLOCK_TYPES[type]) {
            const typeData = window.BLOCK_TYPES[type];
            console.log(`✅ ${type}: ${typeData.description} (${typeData.blocks.length}个格子)`);
            
            // 测试方块创建
            try {
                const block = new window.Block(`test_${type}`, type, 'red', {x: 0, y: 0});
                const cells = block.getCells();
                console.log(`  - 方块创建成功，格子数: ${cells.length}`);
            } catch (error) {
                console.log(`  - 方块创建失败: ${error.message}`);
            }
        } else {
            console.log(`❌ ${type}: 未找到`);
        }
    });
    
    // 测试方块旋转
    if (window.Block.getRotatedBlockType) {
        const rotatedType = window.Block.getRotatedBlockType('line2_h', 1);
        console.log('方块旋转测试:', rotatedType === 'line2_v' ? '✅ 正确' : '❌ 错误');
    }
    
} else {
    console.log('❌ 方块类型系统未加载');
}

// 检查8: 门系统逻辑
console.log('\n8. 门系统逻辑检查:');

if (typeof window.GAME_CONFIG !== 'undefined' && window.GAME_CONFIG.BOARD_SYSTEM) {
    console.log('✅ 门系统配置已加载');
    
    const boardSystem = window.GAME_CONFIG.BOARD_SYSTEM;
    console.log('门类型数量:', Object.keys(boardSystem.GATE_COLOR_MAP).length);
    console.log('门颜色映射:', boardSystem.GATE_COLOR_MAP);
    
    // 测试门颜色匹配
    const testColors = ['red', 'blue', 'green', 'yellow'];
    testColors.forEach(color => {
        const gateType = boardSystem.COLOR_TO_GATE_TYPE[color];
        const gateColor = boardSystem.GATE_COLOR_MAP[gateType];
        console.log(`颜色 ${color} -> 门类型 ${gateType} -> 门颜色 ${gateColor}`);
    });
    
} else {
    console.log('❌ 门系统配置未加载');
}

// 检查9: 动画系统逻辑
console.log('\n9. 动画系统逻辑检查:');

if (typeof gsap !== 'undefined') {
    console.log('✅ GSAP动画系统已加载');
    
    // 测试基本动画功能
    try {
        const testElement = {x: 0, y: 0};
        const tween = gsap.to(testElement, {
            x: 100,
            y: 100,
            duration: 1,
            paused: true
        });
        console.log('GSAP动画创建测试:', tween ? '✅ 成功' : '❌ 失败');
    } catch (error) {
        console.log('GSAP动画测试失败:', error.message);
    }
    
} else {
    console.log('❌ GSAP动画系统未加载');
}

// 检查10: 整体系统集成
console.log('\n10. 整体系统集成检查:');

// 检查所有关键组件是否都已加载
const systemComponents = {
    'Block类': typeof window.Block !== 'undefined',
    'CollisionDetector': typeof window.CollisionDetector !== 'undefined',
    'MovementManager': typeof window.MovementManager !== 'undefined',
    'MapEngine': typeof window.MapEngine !== 'undefined',
    'MapLayoutValidator': typeof window.MapLayoutValidator !== 'undefined',
    'MapGenerator': typeof window.mapGenerator !== 'undefined',
    'MapEditor': typeof window.mapEditor !== 'undefined',
    'GAME_CONFIG': typeof window.GAME_CONFIG !== 'undefined',
    'BLOCK_TYPES': typeof window.BLOCK_TYPES !== 'undefined',
    'BLOCK_COLORS': typeof window.BLOCK_COLORS !== 'undefined',
    'GSAP': typeof gsap !== 'undefined'
};

const loadedComponents = Object.values(systemComponents).filter(loaded => loaded).length;
const totalComponents = Object.keys(systemComponents).length;

console.log('系统组件加载情况:');
Object.entries(systemComponents).forEach(([name, loaded]) => {
    console.log(`  ${loaded ? '✅' : '❌'} ${name}`);
});

console.log(`\n总体加载情况: ${loadedComponents}/${totalComponents} 组件已加载`);

if (loadedComponents === totalComponents) {
    console.log('🎉 所有系统组件都已加载！');
} else {
    console.log('⚠️  部分系统组件未加载，需要检查');
}

// 总结
console.log('\n=== 逻辑完整性检查总结 ===');

const criticalSystems = [
    'Block类',
    'CollisionDetector', 
    'MovementManager',
    'MapEngine',
    'MapLayoutValidator',
    'MapGenerator'
];

const criticalLoaded = criticalSystems.filter(system => systemComponents[system]).length;

console.log(`关键系统加载: ${criticalLoaded}/${criticalSystems.length}`);

if (criticalLoaded === criticalSystems.length) {
    console.log('✅ 所有关键系统都已加载，逻辑完整性良好');
} else {
    console.log('❌ 部分关键系统未加载，需要修复');
}

console.log('\n=== 检查完成 ===');
