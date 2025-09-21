console.log('使用抖音开发者工具开发过程中可以参考以下文档:');
console.log(
  'https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction',
);

// 加载必要的库和模块
require('./src/js/utils.js'); // 加载工具函数
require('./src/js/config.js'); // 加载统一配置
require('./src/js/gsap.min.js');
require('./src/js/block.js'); // 需要先加载，因为包含EYE_TYPES等常量
require('./src/js/collision.js'); // 碰撞检测模块
require('./src/js/movement.js'); // 移动逻辑模块
require('./src/js/menu.js');
require('./src/js/map-engine.js');
require('./src/map/map1.js');
require('./src/map/map2.js');

// 验证配置一致性
if (window.ConfigUtils) {
  const validation = ConfigUtils.validateConfig();
  console.log('配置一致性检查:', validation);
}

let systemInfo = tt.getSystemInfoSync();
let canvas = tt.createCanvas(),
  ctx = canvas.getContext('2d');
canvas.width = systemInfo.windowWidth;
canvas.height = systemInfo.windowHeight;

// 游戏状态
let gameState = 'menu'; // 'menu' 或 'game'
let mainMenu = null;
let mapEngine = null;

// 初始化主菜单
function initMainMenu() {
  console.log('初始化主菜单');
  
  // 直接销毁地图引擎实例
  if (mapEngine) {
    mapEngine = null;
  }
  
  gameState = 'menu';
  mainMenu = null;
  
  // 检查 MainMenu 类是否已加载
  if (typeof MainMenu === 'undefined') {
    console.error('MainMenu 类未找到，请检查 menu.js 是否正确加载');
    return;
  }
  
  mainMenu = new MainMenu(canvas, ctx, systemInfo);
  
// 设置关卡开始回调
window.onLevelStart = function(levelId) {
  console.log('开始关卡 ' + levelId);
  startGame(levelId);
};
  
  // 确保菜单能显示，强制重绘
  needsRedraw = true;
  draw();
}

// 开始游戏
function startGame(levelId) {
  console.log(`开始游戏，关卡 ${levelId}`);
  
  // 销毁主菜单实例并移除事件监听器
  if (mainMenu) {
    console.log('[游戏切换] 开始移除菜单事件监听器');
    // 使用事件管理器统一移除事件监听器
    if (mainMenu.canvas && mainMenu.boundHandlers) {
      EventManager.removeCanvasEvents(mainMenu.canvas, mainMenu.boundHandlers);
      console.log('[游戏切换] 菜单事件监听器已移除');
    }
    mainMenu = null;
    console.log('[游戏切换] 菜单实例已销毁');
  }
  
  // 直接销毁旧的地图引擎实例
  if (mapEngine) {
    mapEngine = null;
  }
  
  // 检查 MapEngine 类是否已加载
  if (typeof MapEngine === 'undefined') {
    console.error('MapEngine 类未找到，请检查 map-engine.js 是否正确加载');
    return;
  }
  
  // 检查地图数据是否已加载
  let mapData;
  if (levelId === 1 && typeof map1 !== 'undefined') {
    mapData = map1;
  } else if (levelId === 2 && typeof map2 !== 'undefined') {
    mapData = map2;
  } else {
    console.error(`地图数据未找到，关卡 ${levelId} 不存在`);
    return;
  }
  
  
  // 立即切换到游戏状态
  gameState = 'game';
  console.log(`关卡 ${levelId} 开始，地图：${mapData.name}`);
  
  // 创建地图引擎实例
  mapEngine = new MapEngine(canvas, ctx, systemInfo);
  
  // 设置关卡完成回调
  window.onLevelComplete = function(completedLevelId) {
    console.log('关卡 ' + completedLevelId + ' 完成！');
    
    // 更新主菜单的进度
    if (mainMenu && typeof mainMenu.completeLevel === 'function') {
      mainMenu.completeLevel(completedLevelId);
    }
    
    // 延迟返回主菜单
    setTimeout(function() {
      initMainMenu();
    }, 2000);
  };
  
  // 加载地图数据
  mapEngine.loadMap(mapData);
  
  console.log('游戏状态已切换到:', gameState);
}

// 游戏状态跟踪
let needsRedraw = true; // 是否需要重绘
let lastDrawTime = 0;
const DRAW_THROTTLE = 16; // 限制绘制频率，约60fps

// 标记需要重绘（事件驱动）
function markNeedsRedraw() {
  needsRedraw = true;
}

// 将markNeedsRedraw设置为全局函数
window.markNeedsRedraw = markNeedsRedraw;

// 主绘制函数 - 适配抖音小游戏环境
function draw() {
  if (gameState === 'menu' && mainMenu) {
    mainMenu.draw();
    // 主菜单需要持续重绘来处理交互
    scheduleNextDraw();
  } else if (gameState === 'game' && mapEngine) {
    drawGame();
    // 🔧 修复：游戏状态需要持续循环以支持动画
    scheduleNextDraw();
  } else {
    drawDefault();
    // 只在需要时调度下一次绘制
    if (needsRedraw) {
      scheduleNextDraw();
      needsRedraw = false; // 重置重绘标志
    }
  }
}

// 调度下一次绘制（优化：统一使用抖音小游戏API）
function scheduleNextDraw() {
  // 优先使用抖音小游戏的 requestAnimationFrame
  if (typeof tt !== 'undefined' && tt.requestAnimationFrame) {
    tt.requestAnimationFrame(draw);
  } else if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(draw);
  } else {
    setTimeout(draw, DRAW_THROTTLE);
  }
}


// 游戏绘制函数
function drawGame() {
  // 清空画布
  ctx.fillStyle = '#FFFFFF'; // 改回白色背景
  ctx.fillRect(0, 0, systemInfo.windowWidth, systemInfo.windowHeight);
  
  // 绘制地图状态信息
  drawGameInfo();
  
  // 绘制地图网格和元素
  if (mapEngine) {
    mapEngine.render();
  }
}

// 绘制游戏信息
function drawGameInfo() {
  if (!mapEngine) return;
  
  // 绘制顶部信息栏背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(15, 100, systemInfo.windowWidth - 30, 50);
  
  // 绘制金币
  DrawUtils.drawCoinIcon(ctx, 25, 110);
  DrawUtils.drawCurrencyText(ctx, 55, 110, '1905');
  
  // 绘制爱心
  DrawUtils.drawHeartIcon(ctx, systemInfo.windowWidth - 100, 110);
  DrawUtils.drawLivesText(ctx, systemInfo.windowWidth - 60, 110, '5');
  
  // 绘制当前关卡
  DrawUtils.drawCurrentLevelText(ctx, systemInfo.windowWidth / 2, 110, '1');
}

// 使用公共绘制工具 - 这些方法现在由 DrawUtils 提供

// 默认绘制函数
function drawDefault() {
  ctx.fillStyle = '#E5EBF6';
  ctx.fillRect(0, 0, systemInfo.windowWidth, systemInfo.windowHeight);

  ctx.fillStyle = '#000000';
  ctx.font = `${parseInt(systemInfo.windowWidth / 20)}px Arial`;
  ctx.fillText('抖音小游戏空白模板', 110, 200);
  const image = tt.createImage();
  image.onload = () => {
    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      (systemInfo.windowWidth - 100) / 2,
      60,
      100,
      100,
    );
  };
}

// 设置游戏交互事件 - 使用统一的事件管理器
function setupGameEvents() {
  const eventHandlers = {
    click: function(e) {
      var coords = EventManager.getEventCoordinates(e);
      
      if (gameState === 'game' && mapEngine) {
        mapEngine.handleClick(coords.x, coords.y);
        markNeedsRedraw();
      } else if (gameState === 'menu' && mainMenu) {
        markNeedsRedraw();
      }
    },
    
    mousedown: function(e) {
      var coords = EventManager.getEventCoordinates(e);
      
      if (gameState === 'game' && mapEngine) {
        mapEngine.handleMouseDown(coords.x, coords.y);
      }
    },
    
    mousemove: function(e) {
      var coords = EventManager.getEventCoordinates(e);
      
      if (gameState === 'game' && mapEngine) {
        mapEngine.handleMouseMove(coords.x, coords.y);
      }
    },
    
    mouseup: function(e) {
      var coords = EventManager.getEventCoordinates(e);
      
      if (gameState === 'game' && mapEngine) {
        mapEngine.handleMouseUp(coords.x, coords.y);
        markNeedsRedraw();
      }
    },
    
    touchstart: function(e) {
      var coords = EventManager.getEventCoordinates(e);
      
      if (gameState === 'game' && mapEngine) {
        mapEngine.handleMouseDown(coords.x, coords.y);
      }
    },
    
    touchmove: function(e) {
      var coords = EventManager.getEventCoordinates(e);
      
      if (gameState === 'game' && mapEngine) {
        mapEngine.handleMouseMove(coords.x, coords.y);
      }
    },
    
    touchend: function(e) {
      var coords = EventManager.getEventCoordinates(e);
      
      if (gameState === 'game' && mapEngine) {
        mapEngine.handleMouseUp(coords.x, coords.y);
        markNeedsRedraw();
      }
    }
  };
  
  // 使用事件管理器统一设置事件监听器
  window.gameEventHandlers = EventManager.setupCanvasEvents(canvas, eventHandlers);
}


// 启动游戏 - 添加延迟确保模块加载完成
setTimeout(() => {
  initMainMenu();
  setupGameEvents();
}, 100);
