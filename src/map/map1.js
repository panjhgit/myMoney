/**
 * 地图1：完整俄罗斯方块 Puzzle (8x8网格)
 * 难度：中等
 * 目标：让所有方块通过对应颜色的门离开
 * 包含：所有俄罗斯方块形状、水泥砖、冰块
 */

const map1 = {
  name: "完整俄罗斯方块",
  description: "包含所有俄罗斯方块形状的挑战关卡",
  difficulty: "中等",
  
  // 门配置 - 四边各有一个门
  gates: [
    {
      id: "gate_up_red",
      color: "red",
      position: { x: 2, y: 0 },
      size: { width: 3, height: 2 },
      direction: "up"
    },
    {
      id: "gate_right_blue", 
      color: "blue",
      position: { x: 7, y: 2 },
      size: { width: 2, height: 3 },
      direction: "right"
    },
    {
      id: "gate_down_green",
      color: "green", 
      position: { x: 2, y: 7 },
      size: { width: 3, height: 2 },
      direction: "down"
    },
    {
      id: "gate_left_yellow",
      color: "yellow",
      position: { x: 0, y: 2 },
      size: { width: 2, height: 3 },
      direction: "left"
    }
  ],
  
  // 俄罗斯方块配置 - 每种形状一个代表性方块，8x8布局
  tetrisBlocks: [
    // 第0层 - 顶层方块（可见，可移动）
    {
      id: "single_1x1",
      color: "red",
      position: { x: 0, y: 0 },
      shape: "1x1",
      layer: 0
    },
    {
      id: "line_1x2",
      color: "blue",
      position: { x: 2, y: 0 },
      shape: "1x2",
      layer: 0
    },
    {
      id: "line_1x3",
      color: "green",
      position: { x: 4, y: 0 },
      shape: "1x3",
      layer: 0
    },
    {
      id: "line_2x1",
      color: "yellow",
      position: { x: 6, y: 0 },
      shape: "2x1",
      layer: 0
    },
    {
      id: "line_3x1",
      color: "purple",
      position: { x: 0, y: 2 },
      shape: "3x1",
      layer: 0
    },
    {
      id: "line_4x1",
      color: "orange",
      position: { x: 4, y: 2 },
      shape: "line4",
      layer: 0
    },
    
    // O形 - 2x2正方形
    {
      id: "square_2x2",
      color: "cyan",
      position: { x: 0, y: 4 },
      shape: "2x2",
      layer: 0
    },
    
    // I形 - 4个方块竖直线（调整位置确保不超出边界）
    {
      id: "I_shape",
      color: "magenta",
      position: { x: 3, y: 3 },
      shape: "I-shape",
      layer: 0
    },
    
    // T形 - T字形（调整位置确保不超出边界）
    {
      id: "T_shape",
      color: "red",
      position: { x: 5, y: 4 },
      shape: "T-shape",
      layer: 0
    },
    
    // L形 - L字形（调整位置确保不超出边界）
    {
      id: "L_shape",
      color: "blue",
      position: { x: 0, y: 5 },
      shape: "L-shape",
      layer: 0
    },
    
    // J形 - 反L形（调整位置确保不超出边界）
    {
      id: "J_shape",
      color: "green",
      position: { x: 3, y: 5 },
      shape: "J-shape",
      layer: 0
    },
    
    // S形 - S字形（调整位置确保不超出边界）
    {
      id: "S_shape",
      color: "yellow",
      position: { x: 5, y: 6 },
      shape: "S-shape",
      layer: 0
    },
    
    // Z形 - Z字形（调整位置确保不超出边界）
    {
      id: "Z_shape",
      color: "purple",
      position: { x: 0, y: 6 },
      shape: "Z-shape",
      layer: 0
    },
    
    // 第2层 - 被冰层覆盖的方块（当冰层融化后才会露出来）
    {
      id: "big_L",
      color: "orange",
      position: { x: 1, y: 4 },
      shape: "bigL",
      layer: 2
    },
    {
      id: "cross_shape",
      color: "cyan",
      position: { x: 4, y: 4 },
      shape: "cross",
      layer: 2
    }
  ],
  
  // 冰层配置 - 第1层冰层，覆盖第2层方块
  iceLayers: [
    // 覆盖大L形的冰层
    {
      id: "ice_bigL_1",
      position: { x: 1, y: 4 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_bigL_2",
      position: { x: 1, y: 5 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_bigL_3",
      position: { x: 1, y: 6 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_bigL_4",
      position: { x: 2, y: 6 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_bigL_5",
      position: { x: 3, y: 6 },
      layer: 1,
      meltProgress: 0
    },
    
    // 覆盖十字形的冰层
    {
      id: "ice_cross_1",
      position: { x: 4, y: 4 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_cross_2",
      position: { x: 5, y: 4 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_cross_3",
      position: { x: 6, y: 4 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_cross_4",
      position: { x: 5, y: 5 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_cross_5",
      position: { x: 5, y: 6 },
      layer: 1,
      meltProgress: 0
    }
  ],
  
  // 石块配置 - 只有一个岩石作为障碍物
  rocks: [
    {
      id: "rock_1",
      position: { x: 1, y: 1 },
      layer: 0
    }
  ],
  
  // 游戏规则配置
  rules: {
    maxMoves: 50, // 最大移动次数
    timeLimit: 300, // 时间限制（秒）
    hints: 3 // 提示次数
  },
  
  // 胜利条件
  winCondition: {
    description: "所有方块通过对应颜色的门离开",
    requiredBlocks: ["red_block_1", "red_block_2", "blue_block_1", "blue_block_2", "green_block_1", "yellow_block_1"]
  },
  
  // 提示信息
  hints: [
    "点击方块选择，然后使用方向键移动",
    "方块必须通过对应颜色的门才能离开",
    "方块的尺寸必须小于门的尺寸",
    "冰层会在上方方块移走后开始融化",
    "石块是不可移动的障碍物"
  ]
};

// 导出地图数据
if (typeof window !== 'undefined') {
  window.map1 = map1;
} else if (typeof global !== 'undefined') {
  global.map1 = map1;
} else {
  this.map1 = map1;
}
