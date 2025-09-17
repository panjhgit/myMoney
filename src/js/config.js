// 游戏统一配置
const GAME_CONFIG = {
  // 核心尺寸配置 - 10x10矩阵包含墙和门，实际游戏区域最大8x8
  CORE_SIZES: {
    BOARD_MATRIX_SIZE: 10,  // 棋盘矩阵尺寸（10x10，最外层给墙和门预留）
    MAX_GAME_AREA: 8,       // 最大游戏区域尺寸（8x8）
    CELL_SIZE: 45,          // 标准格子大小
    FIXED_CELL_SIZE: 45     // 固定格子大小（不缩放）
  },
  
  // 兼容性别名 - 保持向后兼容
  GRID_SIZE: 8, // 8x8网格
  CELL_SIZE: 45, // 每个格子45px
  FIXED_CELL_SIZE: 45, // 固定格子大小，不缩放
  
  // 渲染颜色常量
  RENDER_COLORS: {
    PIPE_BACKGROUND: 'rgba(80, 80, 80, 1.0)',  // 管道背景色（纯色深灰色）
    GAME_AREA_BACKGROUND: 'rgba(200, 200, 200, 0.3)',  // 游戏区域背景色
    GAME_AREA_BORDER: 'rgba(128, 128, 128, 0.5)',  // 游戏区域边框色
  },
  ANIMATION_DURATION: 0.5, // 动画持续时间
  STEP_DURATION: 0.3, // 移动步长持续时间（格子化移动）
  
  // 移动系统配置
  MOVEMENT: {
    GRID_BASED: true,        // 是否使用格子化移动
    STEP_DURATION: 0.3,      // 每格移动时间
    SNAP_TO_GRID: true,      // 是否对齐到格子中心
    CONTINUOUS_MOVEMENT: false // 是否允许连续移动
  },
  
  // 新棋盘系统配置
  BOARD_SYSTEM: {
    // 棋盘元素类型定义
    ELEMENT_TYPES: {
      EMPTY: -1,      // 无意义，仅填充
      WALL: 1,        // 墙边界
      BOARD: 0,       // 棋盘区域
      // 门类型 (2-9 对应不同颜色)
      GATE_RED: 2,    // 红色门
      GATE_BLUE: 3,   // 蓝色门
      GATE_GREEN: 4,  // 绿色门
      GATE_YELLOW: 5, // 黄色门
      GATE_PURPLE: 6, // 紫色门
      GATE_ORANGE: 7, // 橙色门
      GATE_PINK: 8,   // 粉色门
      GATE_CYAN: 9    // 青色门
    },
    
    // 门颜色映射
    GATE_COLOR_MAP: {
      2: 'red',
      3: 'blue', 
      4: 'green',
      5: 'yellow',
      6: 'purple',
      7: 'orange',
      8: 'pink',
      9: 'cyan'
    },
    
    // 方块颜色到门类型的映射
    COLOR_TO_GATE_TYPE: {
      'red': 2,
      'blue': 3,
      'green': 4,
      'yellow': 5,
      'purple': 6,
      'orange': 7,
      'pink': 8,
      'cyan': 9
    }
  },
  
  // 生物配置 - 使用统一的格子大小
  CREATURE_CONFIG: {
    CELL_SIZE: 45, // 使用 CORE_SIZES.CELL_SIZE
    BREATHING_SCALE: 1.05, // 呼吸动画缩放
    EYE_SIZE: 6, // 眼睛大小（稍微小一点）
    EYE_SPACING: 16, // 眼睛间距（增加间距）
    EYE_OFFSET: 14, // 眼睛偏移（更居中）
    FOOT_SIZE: 6, // 脚的大小
    WING_SIZE: 12 // 翅膀大小
  },
  
  // 颜色配置
  COLORS: {
    WHITE: 'rgba(255, 255, 255, ',
    BLACK: 'rgba(0, 0, 0, ',
    BOARD: '#F5F5F5',
    WALL: '#808080',
    ICE_BLUE: 'rgba(173, 216, 230, ',
    ICE_BORDER: 'rgba(100, 149, 237, ',
    ROCK: '#404040',
    ROCK_BORDER: '#2A2A2A'
  },
  
  // 样式配置
  STYLES: {
    LINE_WIDTH_THIN: 1,
    LINE_WIDTH_THICK: 2,
    FONT_SIZE_SMALL: 12,
    FONT_SIZE_MEDIUM: 14,
    FONT_SIZE_LARGE: 16
  }
};

// 配置访问工具函数
const ConfigUtils = {
  // 获取格子大小
  getCellSize: function() {
    return GAME_CONFIG.CORE_SIZES.CELL_SIZE;
  },
  
  // 获取最大游戏区域尺寸（8x8）
  getGridSize: function() {
    return GAME_CONFIG.CORE_SIZES.MAX_GAME_AREA;
  },
  
  // 获取棋盘矩阵尺寸（10x10，包含墙和门）
  getBoardMatrixSize: function() {
    return GAME_CONFIG.CORE_SIZES.BOARD_MATRIX_SIZE;
  },
  
  // 获取固定格子大小
  getFixedCellSize: function() {
    return GAME_CONFIG.CORE_SIZES.FIXED_CELL_SIZE;
  },
  
  // 检查配置一致性
  validateConfig: function() {
    const core = GAME_CONFIG.CORE_SIZES;
    const creature = GAME_CONFIG.CREATURE_CONFIG;
    
    return {
      cellSizeConsistent: core.CELL_SIZE === creature.CELL_SIZE,
      maxGameAreaConsistent: core.MAX_GAME_AREA === this.getGridSize(),
      boardMatrixSizeConsistent: core.BOARD_MATRIX_SIZE === this.getBoardMatrixSize(),
      fixedSizeConsistent: core.FIXED_CELL_SIZE === GAME_CONFIG.FIXED_CELL_SIZE,
      // 设计说明：10x10矩阵最外层给墙和门预留，实际游戏区域最大8x8
      designNote: "10x10矩阵最外层给墙和门预留，实际游戏区域由墙(1)和门(2-9)围成，最大8x8"
    };
  }
};

// 导出到全局作用域
window.GAME_CONFIG = GAME_CONFIG;
window.ConfigUtils = ConfigUtils;
