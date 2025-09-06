console.log('使用抖音开发者工具开发过程中可以参考以下文档:');
console.log(
  'https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction',
);

// 加载 GSAP 库
require('./src/js/gsap.min.js');

let systemInfo = tt.getSystemInfoSync();
let canvas = tt.createCanvas(),
  ctx = canvas.getContext('2d');
canvas.width = systemInfo.windowWidth;
canvas.height = systemInfo.windowHeight;

// 主菜单类
class MainMenu {
  constructor(canvas, ctx, systemInfo) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.systemInfo = systemInfo;
    
    // 游戏数据
    this.coins = 1905;
    this.lives = 5;
    this.maxLives = 5;
    this.currentLevel = 1;
    this.maxUnlockedLevel = 1;
    this.totalLevels = 500;
    
    // 滚动相关
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.isScrolling = false;
    this.scrollVelocity = 0;
    this.scrollFriction = 0.95;
    
    // UI 配置
    this.colors = {
      background: {
        top: '#87CEEB',
        bottom: '#4682B4'
      },
      level: {
        unlocked: '#9370DB',
        locked: '#B0C4DE',
        current: '#FFD700',
        completed: '#4CAF50'
      },
      button: '#9370DB',
      text: '#FFFFFF',
      coin: '#FFD700',
      heart: '#FF6B6B'
    };
    
    // 关卡配置 - 生成500个关卡
    this.levels = [];
    for (let i = 1; i <= this.totalLevels; i++) {
      this.levels.push({
        id: i,
        unlocked: i <= this.maxUnlockedLevel,
        completed: i < this.currentLevel,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        alpha: 1
      });
    }
    
    // 动画状态
    this.animationState = {
      topBar: { y: -100, alpha: 0 },
      levels: { y: 0, alpha: 0 },
      playButton: { y: 100, alpha: 0, scale: 0.8 },
      backgroundShapes: { scale: 0, rotation: 0 }
    };
    
    this.init();
  }
  
  init() {
    this.loadProgress();
    this.calculatePositions();
    this.setupEventListeners();
    this.startEntranceAnimation();
  }
  
  // 开始进入动画
  startEntranceAnimation() {
    // 检查 GSAP 是否可用
    if (typeof gsap === 'undefined') {
      console.log('GSAP 未加载，使用备用动画');
      this.startFallbackAnimation();
      return;
    }
    
    // 背景装饰形状动画
    gsap.to(this.animationState.backgroundShapes, {
      scale: 1,
      rotation: 360,
      duration: 2,
      ease: "elastic.out(1, 0.3)"
    });
    
    // 顶部信息栏动画
    gsap.to(this.animationState.topBar, {
      y: 0,
      alpha: 1,
      duration: 1,
      ease: "back.out(1.7)",
      delay: 0.2
    });
    
    // 关卡动画（依次出现）
    this.levels.forEach((level, index) => {
      gsap.fromTo(level, {
        scale: 0,
        rotation: -180,
        alpha: 0
      }, {
        scale: 1,
        rotation: 0,
        alpha: 1,
        duration: 0.8,
        ease: "back.out(1.7)",
        delay: 0.5 + index * 0.2
      });
    });
    
    // Play按钮动画
    gsap.to(this.animationState.playButton, {
      y: 0,
      alpha: 1,
      scale: 1,
      duration: 1,
      ease: "elastic.out(1, 0.3)",
      delay: 1.2
    });
    
    // 关卡21的礼品盒特殊动画
    gsap.to(this.levels[2], {
      scale: 1.1,
      duration: 0.3,
      ease: "power2.out",
      delay: 1.5,
      yoyo: true,
      repeat: 2
    });
  }
  
  // 备用动画（当 GSAP 不可用时）
  startFallbackAnimation() {
    // 直接设置最终状态
    this.animationState.backgroundShapes.scale = 1;
    this.animationState.backgroundShapes.rotation = 0;
    this.animationState.topBar.y = 0;
    this.animationState.topBar.alpha = 1;
    this.animationState.playButton.y = 0;
    this.animationState.playButton.alpha = 1;
    this.animationState.playButton.scale = 1;
    
    this.levels.forEach(level => {
      level.scale = 1;
      level.rotation = 0;
      level.alpha = 1;
    });
  }
  
  calculatePositions() {
    const centerX = this.systemInfo.windowWidth / 2;
    
    // 手机优化：更小的关卡和更紧凑的布局
    const levelSize = 60; // 减小关卡大小
    const levelSpacing = 75; // 减小间距
    const topMargin = 120; // 顶部留出更多空间给UI
    const bottomMargin = 100; // 底部留出空间
    const startY = this.systemInfo.windowHeight - bottomMargin; // 从底部开始
    
    // 计算每行关卡数（手机屏幕通常较窄）
    const levelsPerRow = Math.floor((this.systemInfo.windowWidth - 40) / levelSpacing);
    const totalRows = Math.ceil(this.totalLevels / levelsPerRow);
    
    // 计算最大滚动距离
    this.maxScrollY = Math.max(0, totalRows * levelSpacing - (this.systemInfo.windowHeight - topMargin - bottomMargin));
    
    // 设置关卡位置（从下到上，从左到右）
    for (let i = 0; i < this.levels.length; i++) {
      const row = Math.floor(i / levelsPerRow);
      const col = i % levelsPerRow;
      
      // 居中排列 - 简化计算
      const totalContentWidth = (levelsPerRow - 1) * levelSpacing + levelSize;
      const startX = (this.systemInfo.windowWidth - totalContentWidth) / 2;
      
      this.levels[i].x = startX + col * levelSpacing;
      this.levels[i].y = startY - (row * levelSpacing);
    }
    
    // 初始滚动到当前关卡附近
    this.scrollToCurrentLevel();
  }
  
  scrollToCurrentLevel() {
    const currentLevelIndex = this.currentLevel - 1;
    const targetY = this.levels[currentLevelIndex].y - this.systemInfo.windowHeight / 2;
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, targetY));
  }
  
  setupEventListeners() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }
  
  handleTouchStart(event) {
    event.preventDefault();
    this.touchStartY = event.touches[0].clientY;
    this.touchStartTime = Date.now();
    this.isScrolling = false;
    this.scrollVelocity = 0;
  }
  
  handleTouchMove(event) {
    event.preventDefault();
    if (!this.touchStartY) return;
    
    const touchY = event.touches[0].clientY;
    const deltaY = this.touchStartY - touchY;
    
    // 更新滚动位置
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + deltaY));
    this.touchStartY = touchY;
    this.isScrolling = true;
  }
  
  handleTouchEnd(event) {
    event.preventDefault();
    if (!this.touchStartY) return;
    
    const touchDuration = Date.now() - this.touchStartTime;
    const touchY = event.changedTouches[0].clientY;
    const deltaY = this.touchStartY - touchY;
    
    // 计算滚动速度
    if (touchDuration < 200 && Math.abs(deltaY) > 10) {
      this.scrollVelocity = deltaY / touchDuration * 10;
    }
    
    this.touchStartY = null;
    
    // 如果没有滚动，则检查点击
    if (!this.isScrolling) {
      this.handleClick(event);
    }
  }
  
  // 双击处理（用于调试功能）
  handleDoubleClick(event) {
    event.preventDefault();
    console.log('双击检测到 - 解锁更多关卡');
    this.unlockMoreLevels(20);
  }
  
  handleClick(event) {
    // 在抖音小游戏中，直接使用事件坐标
    let clickX, clickY;
    
    if (event.touches && event.touches.length > 0) {
      // 触摸事件
      clickX = event.touches[0].clientX;
      clickY = event.touches[0].clientY;
    } else {
      // 鼠标事件
      clickX = event.clientX;
      clickY = event.clientY;
    }
    
    // 调整坐标以考虑滚动
    const adjustedY = clickY + this.scrollY;
    
    // 检查关卡点击
    for (let level of this.levels) {
      if (this.isPointInLevel(clickX, adjustedY, level)) {
        if (level.unlocked) {
          this.animateLevelClick(level);
          setTimeout(() => this.startLevel(level.id), 300);
        } else {
          this.animateLockedLevel(level);
        }
        return;
      }
    }
    
    // 检查 Play 按钮点击
    if (this.isPointInPlayButton(clickX, clickY)) {
      this.animatePlayButtonClick();
      setTimeout(() => this.startLevel(this.currentLevel), 300);
    }
  }
  
  // 关卡点击动画
  animateLevelClick(level) {
    if (typeof gsap !== 'undefined') {
      gsap.to(level, {
        scale: 0.9,
        duration: 0.1,
        ease: "power2.out",
        yoyo: true,
        repeat: 1
      });
    } else {
      // 备用动画
      level.scale = 0.9;
      setTimeout(() => { level.scale = 1; }, 100);
    }
    
    // 添加粒子效果
    this.createClickParticles(level.x + 60, level.y + 60);
  }
  
  // 锁定关卡动画
  animateLockedLevel(level) {
    if (typeof gsap !== 'undefined') {
      gsap.to(level, {
        rotation: 5,
        duration: 0.1,
        ease: "power2.out",
        yoyo: true,
        repeat: 3
      });
    } else {
      // 备用动画
      level.rotation = 5;
      setTimeout(() => { level.rotation = 0; }, 300);
    }
  }
  
  // Play按钮点击动画
  animatePlayButtonClick() {
    if (typeof gsap !== 'undefined') {
      gsap.to(this.animationState.playButton, {
        scale: 0.9,
        duration: 0.1,
        ease: "power2.out",
        yoyo: true,
        repeat: 1
      });
    } else {
      // 备用动画
      this.animationState.playButton.scale = 0.9;
      setTimeout(() => { this.animationState.playButton.scale = 1; }, 100);
    }
  }
  
  // 创建点击粒子效果
  createClickParticles(x, y) {
    if (typeof gsap === 'undefined') {
      // 如果没有 GSAP，跳过粒子效果
      return;
    }
    
    for (let i = 0; i < 8; i++) {
      const particle = {
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 1,
        size: Math.random() * 4 + 2
      };
      
      gsap.to(particle, {
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        life: 0,
        size: 0,
        duration: 0.5,
        ease: "power2.out",
        onUpdate: () => {
          this.drawParticle(particle);
        }
      });
    }
  }
  
  // 绘制粒子
  drawParticle(particle) {
    this.ctx.save();
    this.ctx.globalAlpha = particle.life;
    this.ctx.fillStyle = '#FFD700';
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.restore();
  }
  
  isPointInLevel(x, y, level) {
    return x >= level.x && x <= level.x + 60 && 
           y >= level.y && y <= level.y + 60;
  }
  
  isPointInPlayButton(x, y) {
    const centerX = this.systemInfo.windowWidth / 2;
    const buttonY = this.systemInfo.windowHeight - 80;
    return x >= centerX - 60 && x <= centerX + 60 && 
           y >= buttonY - 20 && y <= buttonY + 20;
  }
  
  startLevel(levelId) {
    console.log(`开始关卡 ${levelId}`);
    // 更新当前关卡
    this.currentLevel = levelId;
    // 这里可以触发游戏开始事件
    if (window.onLevelStart) {
      window.onLevelStart(levelId);
    }
  }
  
  // 完成关卡
  completeLevel(levelId) {
    const levelIndex = levelId - 1;
    if (levelIndex >= 0 && levelIndex < this.levels.length) {
      this.levels[levelIndex].completed = true;
      
      // 解锁下一关
      if (levelId < this.totalLevels) {
        this.levels[levelIndex + 1].unlocked = true;
        this.maxUnlockedLevel = Math.max(this.maxUnlockedLevel, levelId + 1);
      }
      
      // 更新当前关卡
      if (levelId === this.currentLevel) {
        this.currentLevel = Math.min(this.currentLevel + 1, this.totalLevels);
      }
      
      // 保存进度
      this.saveProgress();
    }
  }
  
  // 保存游戏进度
  saveProgress() {
    const progress = {
      currentLevel: this.currentLevel,
      maxUnlockedLevel: this.maxUnlockedLevel,
      coins: this.coins,
      lives: this.lives,
      completedLevels: this.levels.filter(level => level.completed).map(level => level.id)
    };
    
    try {
      tt.setStorageSync('gameProgress', progress);
      console.log('游戏进度已保存');
    } catch (error) {
      console.log('保存进度失败:', error);
    }
  }
  
  // 加载游戏进度
  loadProgress() {
    try {
      const progress = tt.getStorageSync('gameProgress');
      if (progress) {
        this.currentLevel = progress.currentLevel || 1;
        this.maxUnlockedLevel = progress.maxUnlockedLevel || 1;
        this.coins = progress.coins || 1905;
        this.lives = progress.lives || 5;
        
        // 更新关卡状态
        this.levels.forEach(level => {
          level.unlocked = level.id <= this.maxUnlockedLevel;
          level.completed = progress.completedLevels && progress.completedLevels.includes(level.id);
        });
        
        console.log('游戏进度已加载');
      }
    } catch (error) {
      console.log('加载进度失败:', error);
    }
  }
  
  // 重置游戏进度（用于测试）
  resetProgress() {
    this.currentLevel = 1;
    this.maxUnlockedLevel = 1;
    this.coins = 1905;
    this.lives = 5;
    
    this.levels.forEach(level => {
      level.unlocked = level.id <= this.maxUnlockedLevel;
      level.completed = false;
    });
    
    try {
      tt.removeStorageSync('gameProgress');
      console.log('游戏进度已重置');
    } catch (error) {
      console.log('重置进度失败:', error);
    }
  }
  
  // 解锁更多关卡（用于测试）
  unlockMoreLevels(count = 10) {
    this.maxUnlockedLevel = Math.min(this.maxUnlockedLevel + count, this.totalLevels);
    this.levels.forEach(level => {
      level.unlocked = level.id <= this.maxUnlockedLevel;
    });
    this.saveProgress();
    console.log(`已解锁到第 ${this.maxUnlockedLevel} 关`);
  }
  
  update() {
    // 更新滚动惯性
    if (this.scrollVelocity !== 0) {
      this.scrollY += this.scrollVelocity;
      this.scrollVelocity *= this.scrollFriction;
      
      // 边界检查
      if (this.scrollY < 0) {
        this.scrollY = 0;
        this.scrollVelocity = 0;
      } else if (this.scrollY > this.maxScrollY) {
        this.scrollY = this.maxScrollY;
        this.scrollVelocity = 0;
      }
      
      // 停止条件
      if (Math.abs(this.scrollVelocity) < 0.1) {
        this.scrollVelocity = 0;
      }
    }
  }
  
  draw() {
    this.update();
    this.drawBackground();
    this.drawTopBar();
    this.drawLevels();
    this.drawPlayButton();
    this.drawScrollIndicator();
  }
  
  drawBackground() {
    // 渐变背景
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.systemInfo.windowHeight);
    gradient.addColorStop(0, this.colors.background.top);
    gradient.addColorStop(1, this.colors.background.bottom);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.systemInfo.windowWidth, this.systemInfo.windowHeight);
    
    // 装饰性形状
    this.drawDecorativeShapes();
  }
  
  drawDecorativeShapes() {
    const scale = this.animationState.backgroundShapes.scale;
    const rotation = this.animationState.backgroundShapes.rotation;
    
    this.ctx.save();
    this.ctx.scale(scale, scale);
    this.ctx.rotate(rotation * Math.PI / 180);
    
    // 左下角红色形状
    this.ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(50, this.systemInfo.windowHeight - 100, 60, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // 右下角黄色形状
    this.ctx.fillStyle = 'rgba(255, 255, 100, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(this.systemInfo.windowWidth - 50, this.systemInfo.windowHeight - 80, 40, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // 右上角绿色形状
    this.ctx.fillStyle = 'rgba(100, 255, 100, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(this.systemInfo.windowWidth - 80, 80, 50, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.restore();
  }
  
  drawTopBar() {
    const padding = 15; // 减小边距
    const topBarY = padding + this.animationState.topBar.y;
    const topBarAlpha = this.animationState.topBar.alpha;
    
    this.ctx.save();
    this.ctx.globalAlpha = topBarAlpha;
    
    // 绘制半透明背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.drawRoundedRect(padding, topBarY, this.systemInfo.windowWidth - padding * 2, 50, 10);
    
    // 货币显示
    this.drawCoinIcon(padding + 10, topBarY + 10);
    this.drawCurrencyText(padding + 40, topBarY + 10);
    
    // 生命值显示
    this.drawHeartIcon(this.systemInfo.windowWidth - 100, topBarY + 10);
    this.drawLivesText(this.systemInfo.windowWidth - 60, topBarY + 10);
    
    // 当前关卡显示
    this.drawCurrentLevelText(this.systemInfo.windowWidth / 2, topBarY + 10);
    
    this.ctx.restore();
  }
  
  drawCoinIcon(x, y) {
    this.ctx.fillStyle = this.colors.coin;
    this.ctx.beginPath();
    this.ctx.arc(x + 15, y + 15, 15, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('$', x + 15, y + 20);
  }
  
  drawCurrencyText(x, y) {
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(this.coins.toString(), x, y + 15);
    
    // 加号按钮
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.beginPath();
    this.ctx.arc(x + 40, y + 15, 8, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('+', x + 40, y + 19);
  }
  
  drawHeartIcon(x, y) {
    this.ctx.fillStyle = this.colors.heart;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 15, y + 5);
    this.ctx.bezierCurveTo(x + 5, y - 5, x - 5, y - 5, x - 5, y + 10);
    this.ctx.bezierCurveTo(x - 5, y + 20, x + 15, y + 30, x + 15, y + 30);
    this.ctx.bezierCurveTo(x + 15, y + 30, x + 35, y + 20, x + 35, y + 10);
    this.ctx.bezierCurveTo(x + 35, y - 5, x + 25, y - 5, x + 15, y + 5);
    this.ctx.fill();
  }
  
  drawLivesText(x, y) {
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${this.lives}`, x, y + 15);
    
    // 加号按钮
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.beginPath();
    this.ctx.arc(x + 25, y + 15, 8, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('+', x + 25, y + 19);
  }
  
  drawCurrentLevelText(x, y) {
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`关卡 ${this.currentLevel}`, x, y + 15);
  }
  
  
  drawLevels() {
    // 只绘制可见的关卡（性能优化）
    const visibleLevels = this.levels.filter(level => {
      const screenY = level.y - this.scrollY;
      return screenY > -100 && screenY < this.systemInfo.windowHeight + 100;
    });
    
    for (let level of visibleLevels) {
      this.drawLevelBlock(level);
    }
  }
  
  drawLevelBlock(level) {
    const isCurrentLevel = level.id === this.currentLevel;
    let color;
    
    if (!level.unlocked) {
      color = this.colors.level.locked;
    } else if (level.completed) {
      color = this.colors.level.completed;
    } else if (isCurrentLevel) {
      color = this.colors.level.current;
    } else {
      color = this.colors.level.unlocked;
    }
    
    // 计算屏幕坐标
    const screenX = level.x;
    const screenY = level.y - this.scrollY;
    
    // 如果不在屏幕范围内，跳过绘制
    if (screenY < -60 || screenY > this.systemInfo.windowHeight + 60) {
      return;
    }
    
    this.ctx.save();
    this.ctx.globalAlpha = level.alpha;
    
    // 应用变换
    this.ctx.translate(screenX + 30, screenY + 30);
    this.ctx.scale(level.scale, level.scale);
    this.ctx.rotate(level.rotation * Math.PI / 180);
    this.ctx.translate(-30, -30);
    
    // 关卡方块 - 圆角矩形更适合手机
    this.ctx.fillStyle = color;
    this.drawRoundedRect(0, 0, 60, 60, 8);
    
    // 方块内部装饰
    this.drawLevelDecorations({ x: 0, y: 0 });
    
    // 关卡数字 - 调整字体大小
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(level.id.toString(), 30, 38);
    
    // 特殊关卡标记
    if (level.id % 50 === 0) {
      this.drawBossLevelMark(30, 8);
    }
    
    // 锁定图标
    if (!level.unlocked) {
      this.drawLockIcon(50, 8);
    }
    
    // 完成标记
    if (level.completed) {
      this.drawCompletedMark(8, 8);
    }
    
    this.ctx.restore();
  }
  
  // 绘制圆角矩形
  drawRoundedRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  drawLevelDecorations(level) {
    // 四个半透明圆形 - 调整位置适应新尺寸
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    const positions = [
      { x: level.x + 12, y: level.y + 12 },
      { x: level.x + 48, y: level.y + 12 },
      { x: level.x + 12, y: level.y + 48 },
      { x: level.x + 48, y: level.y + 48 }
    ];
    
    positions.forEach(pos => {
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }
  
  drawGiftBox(x, y) {
    // 礼品盒
    this.ctx.fillStyle = this.colors.level.unlocked;
    this.ctx.fillRect(x - 15, y, 30, 20);
    
    // 蝴蝶结
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(x - 3, y - 5, 6, 15);
    this.ctx.fillRect(x - 8, y + 2, 16, 6);
  }
  
  drawLockIcon(x, y) {
    this.ctx.fillStyle = '#FFD700';
    
    // 锁身
    this.ctx.fillRect(x, y, 12, 15);
    
    // 锁环
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x + 6, y - 3, 5, 0, Math.PI);
    this.ctx.stroke();
  }
  
  drawBossLevelMark(x, y) {
    // Boss关卡标记 - 皇冠
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('👑', x, y);
  }
  
  drawCompletedMark(x, y) {
    // 完成标记 - 对勾
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('✓', x, y);
  }
  
  drawScrollIndicator() {
    if (this.maxScrollY <= 0) return;
    
    const indicatorWidth = 4; // 更细的指示器
    const indicatorHeight = this.systemInfo.windowHeight - 200; // 适应屏幕高度
    const indicatorX = this.systemInfo.windowWidth - 15;
    const indicatorY = 100;
    
    // 背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.drawRoundedRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight, 2);
    
    // 滚动条
    const scrollRatio = this.scrollY / this.maxScrollY;
    const scrollBarHeight = Math.max(30, indicatorHeight * 0.2);
    const scrollBarY = indicatorY + (indicatorHeight - scrollBarHeight) * scrollRatio;
    
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.drawRoundedRect(indicatorX, scrollBarY, indicatorWidth, scrollBarHeight, 2);
  }
  
  drawPlayButton() {
    const centerX = this.systemInfo.windowWidth / 2;
    const buttonY = this.systemInfo.windowHeight - 80 + this.animationState.playButton.y;
    const buttonScale = this.animationState.playButton.scale;
    const buttonAlpha = this.animationState.playButton.alpha;
    
    this.ctx.save();
    this.ctx.globalAlpha = buttonAlpha;
    this.ctx.translate(centerX, buttonY);
    this.ctx.scale(buttonScale, buttonScale);
    this.ctx.translate(-centerX, -buttonY);
    
    // 按钮阴影
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.drawRoundedRect(centerX - 60, buttonY + 3, 120, 40, 8);
    
    // 按钮主体
    this.ctx.fillStyle = this.colors.button;
    this.drawRoundedRect(centerX - 60, buttonY - 20, 120, 40, 8);
    
    // 按钮文字
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 18px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('开始游戏', centerX, buttonY + 5);
    
    this.ctx.restore();
  }
}

// 游戏状态
let gameState = 'menu'; // 'menu' 或 'game'
let mainMenu = null;

// 初始化主菜单
function initMainMenu() {
  mainMenu = new MainMenu(canvas, ctx, systemInfo);
  
  // 设置关卡开始回调
  window.onLevelStart = (levelId) => {
    console.log(`开始关卡 ${levelId}`);
    // 这里可以切换到游戏状态
    // gameState = 'game';
    // startGame(levelId);
  };
  
  draw();
}

// 主绘制函数
function draw() {
  if (gameState === 'menu' && mainMenu) {
    mainMenu.draw();
  } else {
    // 游戏绘制逻辑
    drawGame();
  }
  
  // 请求下一帧
  requestAnimationFrame(draw);
}

// 游戏绘制函数（保留原有逻辑）
function drawGame() {
  ctx.fillStyle = '#E5EBF6';
  ctx.fillRect(0, 0, systemInfo.windowWidth, systemInfo.windowHeight);

  ctx.fillStyle = '#000000';
  ctx.font = `${parseInt(systemInfo.windowWidth / 20)}px Arial`;
  ctx.fillText('抖音小游戏空白模板', 110, 200);
  const image = tt.createImage();
  image.src = 'icon.png';
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

// 启动游戏
initMainMenu();
