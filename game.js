console.log('使用抖音开发者工具开发过程中可以参考以下文档:');
console.log(
  'https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction',
);

// 加载必要的库和模块
require('./src/js/gsap.min.js');
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
  // 强制清理所有游戏状态，确保从干净的状态开始
  console.log('初始化主菜单，清理所有游戏状态');
  gameState = 'menu';
  mapEngine = null;
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
  
  // 强制清理所有状态，确保从干净的状态开始
  console.log('清理所有游戏状态');
  gameState = 'menu'; // 先设置为菜单状态
  mapEngine = null;
  
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
  
  // 将方块元素添加到画布中
  setTimeout(() => {
    const tetrisBlocks = mapEngine.getAllElementsByType('tetris');
    tetrisBlocks.forEach(block => {
      if (block.blockElement && block.blockElement.element) {
        canvas.appendChild(block.blockElement.element);
      }
    });
  }, 100);
  
  // 延迟切换到游戏状态，确保清理完成
  setTimeout(() => {
    gameState = 'game';
    console.log(`关卡 ${levelId} 开始，地图：${map1.name}`);
    console.log('Block 系统已加载，支持方块动画和行为');
    console.log('游戏状态已切换到:', gameState);
  }, 150);
}

// 主绘制函数 - 适配抖音小游戏环境
function draw() {
  // 调试信息
  if (Math.random() < 0.01) { // 每100帧打印一次，避免刷屏
    console.log('当前状态:', { 
      gameState, 
      hasMainMenu: !!mainMenu, 
      hasMapEngine: !!mapEngine,
      mapEngineType: mapEngine ? mapEngine.constructor.name : 'null'
    });
  }
  
  if (gameState === 'menu' && mainMenu) {
    mainMenu.draw();
  } else if (gameState === 'game' && mapEngine) {
    // 游戏绘制逻辑
    drawGame();
    // 更新地图引擎
    mapEngine.update();
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
  }
  
  // 抖音小游戏环境下的循环处理
  if (typeof requestAnimationFrame !== 'undefined') {
    // 浏览器环境
    requestAnimationFrame(draw);
  } else if (typeof wx !== 'undefined' && wx.requestAnimationFrame) {
    // 微信小游戏环境
    wx.requestAnimationFrame(draw);
  } else if (typeof tt !== 'undefined' && tt.requestAnimationFrame) {
    // 抖音小游戏环境
    tt.requestAnimationFrame(draw);
  } else {
    // 使用定时器作为备选方案
    setTimeout(draw, 16); // 约60fps
  }
}

// 游戏绘制函数
function drawGame() {
  // 清空画布
  ctx.fillStyle = '#2C3E50';
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
  
  const mapState = mapEngine.getMapState();
  
  // 绘制游戏标题
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('多层方块 Puzzle', systemInfo.windowWidth / 2, 40);
  
  // 绘制地图名称
  ctx.font = '16px Arial';
  ctx.fillText(map1.name, systemInfo.windowWidth / 2, 70);
  
  // 绘制游戏状态
  ctx.font = '14px Arial';
  ctx.fillText(`状态: ${mapState.gameState}`, systemInfo.windowWidth / 2, 100);
  
  // 绘制选中的元素
  if (mapState.selectedElement) {
    ctx.fillText(`选中: ${mapState.selectedElement.id}`, systemInfo.windowWidth / 2, 120);
  }
  
  // 绘制操作提示
  ctx.font = '12px Arial';
  ctx.fillText('点击方块选择，使用方向键移动', systemInfo.windowWidth / 2, systemInfo.windowHeight - 60);
  ctx.fillText('按 ESC 返回主菜单', systemInfo.windowWidth / 2, systemInfo.windowHeight - 40);
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
    }
  });
  
  // 键盘事件
  document.addEventListener('keydown', (e) => {
    if (gameState === 'game' && mapEngine) {
      mapEngine.handleKeyPress(e.key);
    }
    
    // ESC键返回主菜单
    if (e.key === 'Escape' && gameState === 'game') {
      console.log('ESC键被按下，准备返回主菜单');
      console.log('按键详情:', { key: e.key, code: e.code, keyCode: e.keyCode });
      
      // 彻底清理游戏状态
      gameState = 'menu';
      mapEngine = null;
      
      // 延迟确认清理完成
      setTimeout(() => {
        console.log('返回主菜单完成，当前状态:', { gameState, hasMapEngine: !!mapEngine });
      }, 50);
    }
  });
}

// 启动游戏 - 添加延迟确保模块加载完成
setTimeout(() => {
  initMainMenu();
  setupGameEvents();
}, 100);
