/**
 * 方块元素系统 - 适配抖音小游戏Canvas环境
 * 重新设计的俄罗斯方块风格实现，支持8种方块类型
 * 使用面向对象设计，提供更好的封装性和扩展性
 */

// 方块状态常量
const BlockStates = {
    idle: 'idle', 
    moving: 'moving', 
    selected: 'selected', 
    exiting: 'exiting', 
    eliminating: 'eliminating',  // 消除中状态
    eliminated: 'eliminated'
};

// 颜色配置 - 随机分配的颜色
const BLOCK_COLORS = {
    red: {
        name: 'red',
        gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
        glowColor: 'rgba(255, 107, 107, 0.6)',
        hex: '#FF6B6B'
    },
    blue: {
        name: 'blue',
        gradient: 'linear-gradient(135deg, #45B7D1, #6BC5D8)',
        glowColor: 'rgba(69, 183, 209, 0.6)',
        hex: '#45B7D1'
    },
    green: {
        name: 'green',
        gradient: 'linear-gradient(135deg, #96CEB4, #A8E6CF)',
        glowColor: 'rgba(150, 206, 180, 0.6)',
        hex: '#96CEB4'
    },
    yellow: {
        name: 'yellow',
        gradient: 'linear-gradient(135deg, #FFEAA7, #FFF3CD)',
        glowColor: 'rgba(255, 234, 167, 0.6)',
        hex: '#FFEAA7'
    },
    purple: {
        name: 'purple',
        gradient: 'linear-gradient(135deg, #DDA0DD, #E6B3E6)',
        glowColor: 'rgba(221, 160, 221, 0.6)',
        hex: '#DDA0DD'
    },
    orange: {
        name: 'orange',
        gradient: 'linear-gradient(135deg, #FFA500, #FFB347)',
        glowColor: 'rgba(255, 165, 0, 0.6)',
        hex: '#FFA500'
    },
    pink: {
        name: 'pink',
        gradient: 'linear-gradient(135deg, #FFB6C1, #FFC0CB)',
        glowColor: 'rgba(255, 182, 193, 0.6)',
        hex: '#FFB6C1'
    },
    cyan: {
        name: 'cyan',
        gradient: 'linear-gradient(135deg, #40E0D0, #87CEEB)',
        glowColor: 'rgba(64, 224, 208, 0.6)',
        hex: '#40E0D0'
    }
};

// 方块类型定义
const BLOCK_TYPES = {
    // 1. 单个方块 (Single)
    single: {
        name: 'single',
        description: '单个方块',
        blocks: [[0, 0]],
        width: 1,
        height: 1
    },
    
    // 2. 两格方块 (Line2) - 水平
    line2_h: {
        name: 'line2_h',
        description: '两格方块(水平)',
        blocks: [[0, 0], [1, 0]],
        width: 2,
        height: 1
    },
    
    // 2. 两格方块 (Line2) - 垂直
    line2_v: {
        name: 'line2_v',
        description: '两格方块(垂直)',
        blocks: [[0, 0], [0, 1]],
        width: 1,
        height: 2
    },
    
    // 3. 三格方块 (Line3) - 水平
    line3_h: {
        name: 'line3_h',
        description: '三格方块(水平)',
        blocks: [[0, 0], [1, 0], [2, 0]],
        width: 3,
        height: 1
    },
    
    // 3. 三格方块 (Line3) - 垂直
    line3_v: {
        name: 'line3_v',
        description: '三格方块(垂直)',
        blocks: [[0, 0], [0, 1], [0, 2]],
        width: 1,
        height: 3
    },
    
    // 4. 正方形方块 (Square)
    square: {
        name: 'square',
        description: '正方形方块',
        blocks: [[0, 0], [1, 0], [0, 1], [1, 1]],
        width: 2,
        height: 2
    },
    
    // 5. L形方块 (L-Shape) - 向上
    lshape_up: {
        name: 'lshape_up',
        description: 'L形方块(向上)',
        blocks: [[0, 0], [0, 1], [0, 2], [1, 2]],
        width: 2,
        height: 3
    },
    
    // 5. L形方块 (L-Shape) - 向右
    lshape_right: {
        name: 'lshape_right',
        description: 'L形方块(向右)',
        blocks: [[0, 0], [1, 0], [2, 0], [0, 1]],
        width: 3,
        height: 2
    },
    
    // 5. L形方块 (L-Shape) - 向下
    lshape_down: {
        name: 'lshape_down',
        description: 'L形方块(向下)',
        blocks: [[0, 0], [1, 0], [1, 1], [1, 2]],
        width: 2,
        height: 3
    },
    
    // 5. L形方块 (L-Shape) - 向左
    lshape_left: {
        name: 'lshape_left',
        description: 'L形方块(向左)',
        blocks: [[2, 0], [0, 1], [1, 1], [2, 1]],
        width: 3,
        height: 2
    },
    
    // 6. T形方块 (T-Shape) - 向上
    tshape_up: {
        name: 'tshape_up',
        description: 'T形方块(向上)',
        blocks: [[1, 0], [0, 1], [1, 1], [2, 1]],
        width: 3,
        height: 2
    },
    
    // 6. T形方块 (T-Shape) - 向右
    tshape_right: {
        name: 'tshape_right',
        description: 'T形方块(向右)',
        blocks: [[0, 0], [0, 1], [1, 1], [0, 2]],
        width: 2,
        height: 3
    },
    
    // 6. T形方块 (T-Shape) - 向下
    tshape_down: {
        name: 'tshape_down',
        description: 'T形方块(向下)',
        blocks: [[0, 0], [1, 0], [2, 0], [1, 1]],
        width: 3,
        height: 2
    },
    
    // 6. T形方块 (T-Shape) - 向左
    tshape_left: {
        name: 'tshape_left',
        description: 'T形方块(向左)',
        blocks: [[1, 0], [0, 1], [1, 1], [1, 2]],
        width: 2,
        height: 3
    },
    
    // 7. H形方块 (H-Shape) - 向上
    hshape_up: {
        name: 'hshape_up',
        description: 'H形方块(向上)',
        blocks: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [2, 2]],
        width: 3,
        height: 3
    },
    
    // 7. H形方块 (H-Shape) - 向右
    hshape_right: {
        name: 'hshape_right',
        description: 'H形方块(向右)',
        blocks: [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]],
        width: 3,
        height: 3
    },
    
    // 7. H形方块 (H-Shape) - 向下
    hshape_down: {
        name: 'hshape_down',
        description: 'H形方块(向下)',
        blocks: [[0, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]],
        width: 3,
        height: 3
    },
    
    // 7. H形方块 (H-Shape) - 向左
    hshape_left: {
        name: 'hshape_left',
        description: 'H形方块(向左)',
        blocks: [[1, 0], [0, 1], [2, 1], [1, 2]],
        width: 3,
        height: 3
    },
    
    // 8. 三角形方块 (Triangle) - 向上
    triangle_up: {
        name: 'triangle_up',
        description: '三角形方块(向上)',
        blocks: [[1, 0], [0, 1], [1, 1], [2, 1]],
        width: 3,
        height: 2
    },
    
    // 8. 三角形方块 (Triangle) - 向右
    triangle_right: {
        name: 'triangle_right',
        description: '三角形方块(向右)',
        blocks: [[0, 0], [1, 0], [1, 1], [1, 2]],
        width: 2,
        height: 3
    },
    
    // 8. 三角形方块 (Triangle) - 向下
    triangle_down: {
        name: 'triangle_down',
        description: '三角形方块(向下)',
        blocks: [[0, 1], [1, 1], [2, 1], [1, 2]],
        width: 3,
        height: 2
    },
    
    // 8. 三角形方块 (Triangle) - 向左
    triangle_left: {
        name: 'triangle_left',
        description: '三角形方块(向左)',
        blocks: [[0, 0], [0, 1], [0, 2], [1, 1]],
        width: 2,
        height: 3
    }
};

/**
 * 方块类 - 封装所有方块相关的逻辑和行为
 */
class Block {
    constructor(id, blockType, color, position, layer = 0, options = {}) {
        // 基本属性
        this.id = id;
        this.type = blockType;
        this.position = { ...position };
        this.initialPosition = { ...position };
        this.layer = layer;
        this.color = color;
        
        // 状态管理
        this.state = BlockStates.idle;
        this.isSelected = false;
        
        // 样式属性
        this.alpha = options.alpha || 1;
        this.scale = options.scale || 1;
        
        // 冰块属性 - 作为对象属性
        this.ice = {
            isIce: options.isIce || false,
            isRevealed: layer === 0, // 第0层默认显露
            meltProgress: 0, // 融化进度 0-1
            isMelting: false
        };
        
        // 可移动性：只有第0层且不是冰块的方块才能移动
        this.movable = (this.layer === 0 && !this.ice.isIce);
        
        // 动画相关
        this.animations = {};
        this.animationQueue = [];
        
        // 验证和初始化
        this._validateAndInitialize();
    }
    
    /**
     * 验证和初始化方块数据
     * @private
     */
    _validateAndInitialize() {
    // 如果没有指定颜色，随机分配
        if (!this.color) {
            this.color = this.getRandomColor();
        }
        
        // 如果没有指定方块类型，随机分配
        if (!this.type) {
            this.type = this.getRandomBlockType();
        }
        
        // 获取颜色和类型数据
        this.colorData = BLOCK_COLORS[this.color];
        this.typeData = BLOCK_TYPES[this.type];
        
        if (!this.colorData) {
            console.error('无效的颜色: ' + this.color);
            this.color = 'red'; // 默认颜色
            this.colorData = BLOCK_COLORS.red;
        }
        
        if (!this.typeData) {
            console.error('无效的方块类型: ' + this.type);
            this.type = 'single'; // 默认类型
            this.typeData = BLOCK_TYPES.single;
        }
        
        // shapeData 已移除，直接使用 typeData
    }
    
    /**
     * 获取方块占据的所有格子位置
     * @returns {Array} 格子位置数组
     */
    getCells() {
        return this.typeData.blocks.map(block => ({
            x: this.position.x + block[0],
            y: this.position.y + block[1]
        }));
    }
    
    /**
     * 移动方块到新位置 - 格子化移动
     * @param {Object} newPosition - 新位置 {x, y}
     * @param {boolean} snapToGrid - 是否对齐到格子中心
     */
    moveTo(newPosition, snapToGrid = true) {
        if (snapToGrid) {
            // 格子化移动：确保位置是整数
            this.position.x = Math.round(newPosition.x);
            this.position.y = Math.round(newPosition.y);
        } else {
            // 连续移动：允许小数位置
            this.position.x = newPosition.x;
            this.position.y = newPosition.y;
        }
        
        // 更新状态
        this.state = BlockStates.moving;
    }
    
    /**
     * 移动到下一个格子（用于格子化移动）
     * @param {Object} nextPosition - 下一个格子位置 {x, y}
     */
    moveToNextGrid(nextPosition) {
        // 确保位置是整数（格子化）
        this.position.x = Math.round(nextPosition.x);
        this.position.y = Math.round(nextPosition.y);
        
        // 更新状态
        this.state = BlockStates.moving;
    }
    
    /**
     * 完成移动
     */
    finishMove() {
        this.state = BlockStates.idle;
        this.isMoving = false;
    }
    
    /**
     * 旋转方块
     * @param {number} direction - 旋转方向，1为顺时针，-1为逆时针
     * @returns {string} 新的方块类型
     */
    rotate(direction = 1) {
        const newType = Block.getRotatedBlockType(this.type, direction);
        if (newType !== this.type) {
            this.type = newType;
            this.typeData = BLOCK_TYPES[newType];
            // typeData 已经更新，不需要重新设置 shapeData
        }
        return newType;
    }
    
    /**
     * 检查方块是否可以移动
     * @returns {boolean} 是否可以移动
     */
    canMove() {
        return this.movable && 
               this.state !== BlockStates.exiting && 
               this.state !== BlockStates.eliminating && 
               this.state !== BlockStates.eliminated;
    }
    
    /**
     * 显露冰块
     */
    revealIce() {
        if (this.ice.isIce && !this.ice.isRevealed) {
            this.ice.isRevealed = true;
            this.ice.isIce = false; // 显露后不再是冰块
            this.layer = 0;
            this.movable = true; // 冰块显露后变成可移动
            this.state = BlockStates.idle;
            console.log(`冰块方块 ${this.id} 已显露`);
        }
    }
    
    /**
     * 开始融化冰块
     */
    startMelting() {
        if (this.ice.isIce && this.ice.isRevealed) {
            this.ice.isMelting = true;
            this.ice.meltProgress = 0;
            console.log(`冰块方块 ${this.id} 开始融化`);
        }
    }
    
    /**
     * 更新融化进度
     * @param {number} progress - 融化进度 0-1
     */
    updateMeltProgress(progress) {
        if (this.ice.isMelting) {
            this.ice.meltProgress = Math.max(0, Math.min(1, progress));
            if (this.ice.meltProgress >= 1) {
                this.completeMelting();
            }
        }
    }
    
    /**
     * 完成融化
     */
    completeMelting() {
        if (this.ice.isMelting) {
            this.ice.isIce = false;
            this.ice.isMelting = false;
            this.ice.meltProgress = 1;
            console.log(`冰块方块 ${this.id} 融化完成`);
        }
    }
    
    /**
     * 绘制方块
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} cellSize - 格子大小
     * @param {number} offsetX - X偏移
     * @param {number} offsetY - Y偏移
     */
    draw(ctx, cellSize, offsetX = 0, offsetY = 0) {
        if (this.state === BlockStates.eliminated) return;
        
        const startX = offsetX + this.position.x * cellSize;
        const startY = offsetY + this.position.y * cellSize;
        
        // 设置透明度
        ctx.globalAlpha = this.alpha * (this.ice.isIce ? 0.7 : 1);
        
        // 如果正在消除，应用缩放效果
        if (this.state === BlockStates.eliminating) {
            ctx.save();
            const centerX = startX + (this.typeData.width * cellSize) / 2;
            const centerY = startY + (this.typeData.height * cellSize) / 2;
            ctx.translate(centerX, centerY);
            ctx.scale(this.scale || 1, this.scale || 1);
            ctx.translate(-centerX, -centerY);
        }
        
        // 绘制每个方块格子
        this.typeData.blocks.forEach(block => {
            const cellX = startX + block[0] * cellSize;
            const cellY = startY + block[1] * cellSize;
            
            // 绘制方块主体
            this._drawBlockCell(ctx, cellX, cellY, cellSize);
            
            // 绘制冰块效果
            if (this.ice.isIce) {
                this._drawIceEffect(ctx, cellX, cellY, cellSize);
            }
        });
        
        // 选中效果现在在_drawBlockCell中处理，这里不需要额外绘制
        
        // 恢复变换（如果应用了缩放）
        if (this.state === BlockStates.eliminating) {
            ctx.restore();
        }
        
        ctx.globalAlpha = 1; // 重置透明度
    }
    
    /**
     * 绘制方块格子
     * @private
     */
    _drawBlockCell(ctx, x, y, size) {
        // 检查是否是选中状态
        const isSelected = this.isSelected;
        
        // 选中状态：变大5px并悬浮
        if (isSelected) {
            const scaleFactor = 1.1; // 变大10%（约5px）
            const hoverOffset = 3; // 悬浮高度3px
            const scaledSize = size * scaleFactor;
            const offsetX = (size - scaledSize) / 2;
            const offsetY = (size - scaledSize) / 2 - hoverOffset;
            
            // 绘制阴影（悬浮效果）
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(x + offsetX + 2, y + offsetY + 2, scaledSize, scaledSize);
            
            // 绘制放大的方块（移除边框）
            ctx.fillStyle = this.colorData.hex;
            ctx.fillRect(x + offsetX, y + offsetY, scaledSize, scaledSize);
            
            // 绘制高光效果（增强选中视觉效果）
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(x + offsetX, y + offsetY, scaledSize * 0.4, scaledSize * 0.4);
        } else {
            // 正常状态（移除边框绘制）
            ctx.fillStyle = this.colorData.hex;
            ctx.fillRect(x, y, size, size);
            
            // 绘制高光效果（保留，增加立体感）
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(x, y, size * 0.3, size * 0.3);
        }
    }
    
    /**
     * 绘制冰块效果
     * @private
     */
    _drawIceEffect(ctx, x, y, size) {
        if (!this.ice.isRevealed) return;
        
        // 冰块覆盖层（移除边框）
        ctx.fillStyle = `rgba(173, 216, 230, ${0.3 + this.ice.meltProgress * 0.4})`;
        ctx.fillRect(x, y, size, size);
        
        // 融化效果
        if (this.ice.isMelting) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.ice.meltProgress * 0.5})`;
            ctx.fillRect(x, y, size * this.ice.meltProgress, size);
        }
    }
    
    /**
     * 绘制选择效果
     * @private
     */
    _drawSelectionEffect(ctx, startX, startY, cellSize) {
        ctx.strokeStyle = this.colorData.glowColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        
        this.typeData.blocks.forEach(block => {
            const cellX = startX + block[0] * cellSize;
            const cellY = startY + block[1] * cellSize;
            ctx.strokeRect(cellX, cellY, cellSize, cellSize);
        });
        
        ctx.setLineDash([]);
    }
    
    /**
     * 克隆方块
     * @returns {Block} 克隆的方块
     */
    clone() {
        return new Block(
            this.id + '_clone',
            this.type,
            this.color,
            { ...this.position },
            this.layer,
            {
                isIce: this.ice.isIce,
                alpha: this.alpha,
                scale: this.scale
            }
        );
    }
    
    /**
     * 转换为JSON格式
     * @returns {Object} JSON对象
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            color: this.color,
            position: { ...this.position },
            layer: this.layer,
            ice: { ...this.ice },
            alpha: this.alpha,
            scale: this.scale,
            state: this.state,
            isSelected: this.isSelected,
            movable: this.movable
        };
    }
    
    /**
     * 从JSON创建方块
     * @param {Object} data - JSON数据
     * @returns {Block} 方块实例
     */
    static fromJSON(data) {
        const block = new Block(
            data.id,
            data.type,
            data.color,
            data.position,
            data.layer,
            {
                isIce: data.ice?.isIce || false,
                alpha: data.alpha || 1,
                scale: data.scale || 1
            }
        );
        
        // 恢复状态
        if (data.ice) {
            block.ice = { ...data.ice };
        }
        if (data.state) {
            block.state = data.state;
        }
        if (data.isSelected !== undefined) {
            block.isSelected = data.isSelected;
        }
        if (data.movable !== undefined) {
            block.movable = data.movable;
        }
        
        return block;
    }
    
    // 静态工具方法
    static getRandomColor() {
        const colors = Object.keys(BLOCK_COLORS);
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    static getRandomBlockType() {
        const types = Object.keys(BLOCK_TYPES);
        return types[Math.floor(Math.random() * types.length)];
    }
    
    static getRotatedBlockType(blockType, direction = 1) {
        direction = direction || 1;
        
        const rotationMap = {
        // Line2 旋转
        'line2_h': 'line2_v',
        'line2_v': 'line2_h',
        
        // Line3 旋转
        'line3_h': 'line3_v',
        'line3_v': 'line3_h',
        
        // L-Shape 旋转
        'lshape_up': 'lshape_right',
        'lshape_right': 'lshape_down',
        'lshape_down': 'lshape_left',
        'lshape_left': 'lshape_up',
        
        // T-Shape 旋转
        'tshape_up': 'tshape_right',
        'tshape_right': 'tshape_down',
        'tshape_down': 'tshape_left',
        'tshape_left': 'tshape_up',
        
        // H-Shape 旋转
        'hshape_up': 'hshape_right',
        'hshape_right': 'hshape_down',
        'hshape_down': 'hshape_left',
        'hshape_left': 'hshape_up',
        
        // Triangle 旋转
        'triangle_up': 'triangle_right',
        'triangle_right': 'triangle_down',
        'triangle_down': 'triangle_left',
        'triangle_left': 'triangle_up'
    };
    
    if (direction === -1) {
        // 逆时针旋转，需要反转映射
            const reverseMap = {};
            for (const key in rotationMap) {
            reverseMap[rotationMap[key]] = key;
        }
        return reverseMap[blockType] || blockType;
    }
    
    return rotationMap[blockType] || blockType;
    }
}

// 便捷函数已移除，直接使用 Block 类

// ES6 导出
export { BlockStates, BLOCK_COLORS, BLOCK_TYPES, Block };