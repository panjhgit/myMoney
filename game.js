console.log('使用抖音开发者工具开发过程中可以参考以下文档:');
console.log(
  'https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction',
);

// 加载必要的库和模块
require('./src/js/config.js'); // 加载统一配置
require('./src/js/gsap.min.js');
require('./src/js/creature.js');
require('./src/js/menu.js');
require('./src/js/map-engine.js');
require('./src/js/block.js');
require('./src/map/map1.js');

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
  window.onLevelStart = (levelId) => {
    console.log(`开始关卡 ${levelId}`);
    startGame(levelId);
  };
  
  draw();
}

// 开始游戏
function startGame(levelId) {
  console.log(`开始游戏，关卡 ${levelId}`);
  
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
  if (typeof map1 === 'undefined') {
    console.error('地图数据未找到，请检查 map1.js 是否正确加载');
    return;
  }
  
  // 检查 Block 系统是否已加载
  if (typeof createBlock === 'undefined') {
    console.error('Block 系统未找到，请检查 block.js 是否正确加载');
    return;
  }
  
  // 创建地图引擎实例
  mapEngine = new MapEngine();
  
  // 设置渲染上下文
  mapEngine.setRenderContext(ctx, systemInfo);
  
  // 加载地图数据
  mapEngine.loadMap(map1);
  
  // 在抖音小游戏环境中，方块已经通过Canvas绘制，无需DOM操作
  // 方块元素已经在地图引擎中管理，通过Canvas API绘制
  
  // 延迟切换到游戏状态，确保清理完成
  setTimeout(() => {
    gameState = 'game';
    console.log(`关卡 ${levelId} 开始，地图：${map1.name}`);
    console.log('Block 系统已加载，支持方块动画和行为');
    console.log('游戏状态已切换到:', gameState);
  }, 150);
}

// 游戏状态跟踪
let needsRedraw = true; // 是否需要重绘
let lastDrawTime = 0;
const DRAW_THROTTLE = 16; // 限制绘制频率，约60fps

// 主绘制函数 - 适配抖音小游戏环境
function draw() {
  const currentTime = Date.now();
  
  // 只有在需要重绘时才绘制
  if (!needsRedraw && (currentTime - lastDrawTime) < DRAW_THROTTLE) {
    // 继续循环，但不绘制
    scheduleNextDraw();
    return;
  }
  
  // 调试信息（减少频率）
  if (Math.random() < 0.001) { // 每1000帧打印一次
    console.log('当前状态:', { 
      gameState, 
      hasMainMenu: !!mainMenu, 
      hasMapEngine: !!mapEngine,
      mapEngineType: mapEngine ? mapEngine.constructor.name : 'null',
      needsRedraw: needsRedraw
    });
  }
  
  if (gameState === 'menu' && mainMenu) {
    mainMenu.draw();
    needsRedraw = false; // 菜单绘制完成后标记不需要重绘
  } else if (gameState === 'game' && mapEngine) {
    // 游戏绘制逻辑
    drawGame();
    // 更新地图引擎
    mapEngine.update();
    needsRedraw = false; // 游戏绘制完成后标记不需要重绘
  } else {
    // 默认绘制 - 确保在菜单状态下不会调用游戏绘制
    if (gameState === 'menu') {
      // 强制清理 mapEngine，防止残留
      if (mapEngine) {
        console.warn('菜单状态下发现残留的 mapEngine，强制清理');
        mapEngine = null;
      }
    }
    drawDefault();
    needsRedraw = false; // 默认绘制完成后标记不需要重绘
  }
  
  lastDrawTime = currentTime;
  scheduleNextDraw();
}

// 调度下一次绘制
function scheduleNextDraw() {
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(draw);
  } else if (typeof wx !== 'undefined' && wx.requestAnimationFrame) {
    wx.requestAnimationFrame(draw);
  } else if (typeof tt !== 'undefined' && tt.requestAnimationFrame) {
    tt.requestAnimationFrame(draw);
  } else {
    setTimeout(draw, DRAW_THROTTLE);
  }
}

// 标记需要重绘（在用户交互或动画时调用）
function markNeedsRedraw() {
  needsRedraw = true;
}

// 游戏绘制函数
function drawGame() {
  // 清空画布
  ctx.fillStyle = '#FFFFFF'; // 改为白色背景
  ctx.fillRect(0, 0, systemInfo.windowWidth, systemInfo.windowHeight);
  
  // 绘制地图状态信息
  drawGameInfo();
  
  // 绘制地图网格和元素
  if (mapEngine) {
    mapEngine.drawMapGrid();
    mapEngine.drawMapElements();
  }
}

// 绘制游戏信息
function drawGameInfo() {
  if (!mapEngine) return;
  
  // 绘制顶部信息栏背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(15, 100, systemInfo.windowWidth - 30, 50);
  
  // 绘制金币
  drawCoinIcon(25, 110);
  drawCurrencyText(55, 110);
  
  // 绘制爱心
  drawHeartIcon(systemInfo.windowWidth - 100, 110);
  drawLivesText(systemInfo.windowWidth - 60, 110);
  
  // 绘制当前关卡
  drawCurrentLevelText(systemInfo.windowWidth / 2, 110);
}

// 绘制金币图标
function drawCoinIcon(x, y) {
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + 15, y + 15, 15, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('$', x + 15, y + 20);
}

// 绘制金币数量
function drawCurrencyText(x, y) {
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('1905', x, y + 15);
  
  // 加号按钮
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(x + 40, y + 15, 8, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('+', x + 40, y + 19);
}

// 绘制爱心图标
function drawHeartIcon(x, y) {
  ctx.fillStyle = '#FF6B6B';
  ctx.beginPath();
  ctx.moveTo(x + 15, y + 5);
  ctx.bezierCurveTo(x + 5, y - 5, x - 5, y - 5, x - 5, y + 10);
  ctx.bezierCurveTo(x - 5, y + 20, x + 15, y + 30, x + 15, y + 30);
  ctx.bezierCurveTo(x + 15, y + 30, x + 35, y + 20, x + 35, y + 10);
  ctx.bezierCurveTo(x + 35, y - 5, x + 25, y - 5, x + 15, y + 5);
  ctx.fill();
}

// 绘制生命值
function drawLivesText(x, y) {
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('5', x, y + 15);
  
  // 加号按钮
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(x + 20, y + 15, 8, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('+', x + 20, y + 19);
}

// 绘制当前关卡
function drawCurrentLevelText(x, y) {
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('关卡 1', x, y + 15);
}

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

// 设置游戏交互事件
function setupGameEvents() {
  // 鼠标点击事件
  canvas.addEventListener('click', (e) => {
    if (gameState === 'game' && mapEngine) {
      let x, y;
      
      // 抖音小游戏环境兼容处理
      if (typeof canvas.getBoundingClientRect === 'function') {
        // 浏览器环境
        const rect = canvas.getBoundingClientRect();
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      } else {
        // 抖音小游戏环境 - 直接使用触摸坐标
        x = e.clientX || e.x || 0;
        y = e.clientY || e.y || 0;
      }
      
      mapEngine.handleClick(x, y);
      markNeedsRedraw(); // 游戏交互后需要重绘
    }
  });
  
  
  // 抖音小游戏不支持键盘事件，移除键盘监听
  // 可以通过触摸手势或其他方式实现返回功能
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.markNeedsRedraw = markNeedsRedraw;
}
if (typeof global !== 'undefined') {
  global.markNeedsRedraw = markNeedsRedraw;
}
if (typeof this !== 'undefined') {
  this.markNeedsRedraw = markNeedsRedraw;
}

// 启动游戏 - 添加延迟确保模块加载完成
setTimeout(() => {
  initMainMenu();
  setupGameEvents();
}, 100);
