// Map2 - 测试翅膀动画的空白地图
// 包含一个L形木块用于测试翅膀飞行动画

const map2 = {
  level: 2,
  // 地图基本信息
  name: "翅膀测试地图",
  description: "包含一个L形木块，可以测试翅膀的扇动效果",
  difficulty: "简单",
  
  // 地图背景（空白）
  background: {
    type: "empty", // 空白背景
    color: "#87CEEB" // 天蓝色背景
  },
  
  // 门配置（空，测试关卡不需要门）
  gates: [],
  
  // 俄罗斯方块配置 - L形木块用于测试翅膀
  tetrisBlocks: [
    {
      id: "l_block_1",
      color: "purple",
      position: { x: 3, y: 3 }, // 地图中心位置
      shape: "lshape",
      layer: 0,
      // 设置为飞行模式，使用翅膀
      movementType: "wings",
      // 翅膀配置
      wingConfig: {
        color: "#2C3E50", // 深蓝色翅膀
        size: "medium"
      }
    },
    {
      id: "square_block_1",
      color: "yellow",
      position: { x: 1, y: 1 }, // 左上角位置
      shape: "square",
      layer: 0,
      // 设置为走路模式，使用腿
      movementType: "feet"
    }
  ],
  
  // 石块配置（空）
  rocks: [],
  
  // 游戏规则配置
  rules: {
    maxMoves: 50, // 最大移动次数
    timeLimit: 300, // 时间限制（秒）
    hints: 3 // 提示次数
  },
  
  // 胜利条件
  winCondition: {
    description: "测试翅膀飞行动画和走路动画",
    requiredBlocks: ["l_block_1", "square_block_1"]
  },
  
  // 提示信息
  hints: [
    "这是一个动画测试关卡",
    "L形木块会自动显示翅膀并开始飞行动画",
    "2x2方块会自动显示腿并开始走路动画",
    "观察不同运动类型的动画效果",
    "可以点击方块进行移动测试"
  ]
};

// 导出地图数据
console.log('Map2 正在加载，方块数量:', map2.tetrisBlocks.length);
if (typeof window !== 'undefined') {
  window.map2 = map2;
  console.log('Map2 已导出到 window.map2');
} else if (typeof global !== 'undefined') {
  global.map2 = map2;
  console.log('Map2 已导出到 global.map2');
} else {
  this.map2 = map2;
  console.log('Map2 已导出到 this.map2');
}
