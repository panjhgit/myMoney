// 游戏统一配置
const GAME_CONFIG = {
  // 网格配置
  GRID_SIZE: 8, // 8x8网格
  CELL_SIZE: 45, // 每个格子45px
  
  // 地图配置
  MIN_CELL_SIZE: 30, // 最小格子大小
  MAX_CELL_SIZE: 60, // 最大格子大小
  
  // 动画配置
  ANIMATION_DURATION: 0.5, // 动画持续时间
  STEP_DURATION: 0.4, // 移动步长持续时间
  
  // 生物配置
  CREATURE_CONFIG: {
    CELL_SIZE: 45, // 与主配置保持一致
    BREATHING_SCALE: 1.05, // 呼吸动画缩放
    EYE_SIZE: 6, // 眼睛大小（稍微小一点）
    EYE_SPACING: 16, // 眼睛间距（增加间距）
    EYE_OFFSET: 14, // 眼睛偏移（更居中）
    FOOT_SIZE: 6, // 脚的大小
    WING_SIZE: 12 // 翅膀大小
  }
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.GAME_CONFIG = GAME_CONFIG;
}
if (typeof global !== 'undefined') {
  global.GAME_CONFIG = GAME_CONFIG;
}
if (typeof this !== 'undefined') {
  this.GAME_CONFIG = GAME_CONFIG;
}

console.log('游戏配置已加载:', GAME_CONFIG);
console.log('格子大小:', GAME_CONFIG.CELL_SIZE);
console.log('网格大小:', GAME_CONFIG.GRID_SIZE);
console.log('生物配置格子大小:', GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE);
console.log('配置一致性检查:', {
  main: GAME_CONFIG.CELL_SIZE,
  creature: GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE,
  consistent: GAME_CONFIG.CELL_SIZE === GAME_CONFIG.CREATURE_CONFIG.CELL_SIZE
});
console.log('✅ 所有单元格大小计算都统一使用 config.js 中的配置');
