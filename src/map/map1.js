/**
 * 地图1：基础多层方块 Puzzle (8x8网格)
 * 难度：简单
 * 目标：让所有方块通过对应颜色的门离开
 */

const map1 = {
  name: "基础多层方块",
  description: "学习多层方块的基本玩法",
  difficulty: "简单",
  
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
  
  // 俄罗斯方块配置
  tetrisBlocks: [
    // 第0层 - 顶层方块
    {
      id: "red_block_1",
      color: "red",
      position: { x: 3, y: 1 },
      shape: "2x2",
      layer: 0
    },
    {
      id: "blue_block_1", 
      color: "blue",
      position: { x: 1, y: 3 },
      shape: "1x3",
      layer: 0
    },
    {
      id: "green_block_1",
      color: "green",
      position: { x: 4, y: 4 },
      shape: "2x1",
      layer: 0
    },
    {
      id: "yellow_block_1",
      color: "yellow", 
      position: { x: 5, y: 1 },
      shape: "1x2",
      layer: 0
    },
    
    // 第1层 - 被冰层覆盖的方块
    {
      id: "red_block_2",
      color: "red",
      position: { x: 0, y: 0 },
      shape: "1x2",
      layer: 1
    },
    {
      id: "blue_block_2",
      color: "blue", 
      position: { x: 5, y: 5 },
      shape: "2x1",
      layer: 1
    }
  ],
  
  // 冰层配置
  iceLayers: [
    // 覆盖第1层方块的冰层
    {
      id: "ice_1",
      position: { x: 0, y: 0 },
      layer: 0,
      meltProgress: 0
    },
    {
      id: "ice_2", 
      position: { x: 0, y: 1 },
      layer: 0,
      meltProgress: 0
    },
    {
      id: "ice_3",
      position: { x: 5, y: 5 },
      layer: 0,
      meltProgress: 0
    },
    {
      id: "ice_4",
      position: { x: 6, y: 5 },
      layer: 0,
      meltProgress: 0
    },
    
    // 第1层的冰层
    {
      id: "ice_5",
      position: { x: 2, y: 2 },
      layer: 1,
      meltProgress: 0
    },
    {
      id: "ice_6",
      position: { x: 3, y: 2 },
      layer: 1,
      meltProgress: 0
    }
  ],
  
  // 石块配置 - 作为障碍物
  rocks: [
    // 第0层石块 - 四个角落
    {
      id: "rock_1",
      position: { x: 0, y: 0 },
      layer: 0
    },
    {
      id: "rock_2", 
      position: { x: 7, y: 0 },
      layer: 0
    },
    {
      id: "rock_3",
      position: { x: 0, y: 7 },
      layer: 0
    },
    {
      id: "rock_4",
      position: { x: 7, y: 7 },
      layer: 0
    },
    
    // 第1层石块
    {
      id: "rock_5",
      position: { x: 1, y: 1 },
      layer: 1
    },
    {
      id: "rock_6",
      position: { x: 6, y: 1 },
      layer: 1
    },
    
    // 第2层石块
    {
      id: "rock_7",
      position: { x: 3, y: 3 },
      layer: 2
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
