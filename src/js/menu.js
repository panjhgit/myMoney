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
    this.maxUnlockedLevel = 2; // 解锁前两关用于测试
    this.totalLevels = 500;
    
    // 滚动相关
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.isScrolling = false;
    this.scrollVelocity = 0;
    this.hasDrawn = false; // 标记是否已绘制过
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
    
    // 移除特殊关卡动画，保持界面简洁
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
    
    // 固定4x4网格布局（连续滚动）
    const levelSize = 60; // 关卡大小
    const levelSpacing = 75; // 关卡间距
    const topMargin = 300; // 进一步增加顶部空间，完全避免重叠
    const bottomMargin = 100; // 底部空间给开始游戏按钮
    const gameAreaHeight = this.systemInfo.windowHeight - topMargin - bottomMargin; // 固定的游戏区域高度
    
    // 固定4x4网格（连续滚动）
    const levelsPerRow = 4; // 固定每行4个关卡
    const totalRows = Math.ceil(this.totalLevels / levelsPerRow); // 总行数（500个关卡需要125行）
    
    // 计算网格在屏幕中的位置（居中）
    const gridWidth = (levelsPerRow - 1) * levelSpacing + levelSize;
    const startX = (this.systemInfo.windowWidth - gridWidth) / 2;
    const startY = topMargin; // 从顶部边距开始
    
    // 计算最大滚动距离 - 连续滚动，覆盖所有关卡
    this.maxScrollY = Math.max(0, totalRows * levelSpacing - gameAreaHeight);
    
    // 设置关卡位置（连续排列）
    for (let i = 0; i < this.levels.length; i++) {
      const row = Math.floor(i / levelsPerRow); // 当前关卡在第几行
      const col = i % levelsPerRow; // 在当前行中的列
      
      this.levels[i].x = startX + col * levelSpacing;
      this.levels[i].y = startY + (row * levelSpacing);
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
    // 保存事件处理函数的引用，以便后续移除
    this.boundHandleClick = (e) => this.handleClick(e);
    this.boundHandleTouchStart = (e) => this.handleTouchStart(e);
    this.boundHandleTouchMove = (e) => this.handleTouchMove(e);
    this.boundHandleTouchEnd = (e) => this.handleTouchEnd(e);
    
    this.canvas.addEventListener('click', this.boundHandleClick);
    this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandleTouchEnd, { passive: false });
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
  
  
  handleClick(event) {
    // 检查游戏状态，如果不在菜单状态，则不处理点击事件
    if (typeof window !== 'undefined' && window.gameState && window.gameState !== 'menu') {
      console.log(`[菜单点击] 游戏状态为 ${window.gameState}，忽略菜单点击事件`);
      return;
    }
    
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
    
    console.log(`[菜单点击] 点击坐标: (${clickX}, ${clickY}), 调整后Y: ${adjustedY}`);
    
    // 检查关卡点击
    for (let level of this.levels) {
      if (this.isPointInLevel(clickX, adjustedY, level)) {
        if (level.unlocked) {
          console.log(`[菜单点击] 关卡 ${level.id} 被点击，开始关卡`);
          this.animateLevelClick(level);
          setTimeout(() => this.startLevel(level.id), 300);
        } else {
          console.log(`[菜单点击] 关卡 ${level.id} 被点击，但未解锁`);
          this.animateLockedLevel(level);
        }
        return;
      }
    }
    
    // 检查 Play 按钮点击
    if (this.isPointInPlayButton(clickX, clickY)) {
      console.log(`[菜单点击] Play按钮被点击，开始关卡 ${this.currentLevel}`);
      this.animatePlayButtonClick();
      setTimeout(() => this.startLevel(this.currentLevel), 300);
    } else {
      console.log(`[菜单点击] 点击空白区域，无操作`);
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
    // 考虑绘制时的偏移（-30, -30）
    const drawX = level.x - 30;
    const drawY = level.y - 30;
    const isInLevel = x >= drawX && x <= drawX + 60 && 
                      y >= drawY && y <= drawY + 60;
    
    // 添加调试日志
    if (isInLevel) {
      console.log(`[点击检测] 关卡 ${level.id} 被点击: 点击坐标(${x}, ${y}), 关卡区域(${drawX}, ${drawY}) 到 (${drawX + 60}, ${drawY + 60})`);
    }
    
    return isInLevel;
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
      
      // 滚动时触发重绘
      this.triggerRedraw();
    }
  }
  
  draw() {
    this.update();
    this.drawBackground();
    this.drawTopBar();
    this.drawLevels();
    this.drawPlayButton();
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
    const padding = 100; // 固定在顶部区域，避开关卡
    const topBarY = padding + this.animationState.topBar.y;
    const topBarAlpha = this.animationState.topBar.alpha;
    
    this.ctx.save();
    this.ctx.globalAlpha = topBarAlpha;
    
    // 绘制半透明背景 - 修复背景矩形计算
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.drawRoundedRect(15, topBarY, this.systemInfo.windowWidth - 30, 50, 10);
    
    // 货币显示
    this.drawCoinIcon(25, topBarY + 10);
    this.drawCurrencyText(55, topBarY + 10);
    
    // 生命值显示
    this.drawHeartIcon(this.systemInfo.windowWidth - 100, topBarY + 10);
    this.drawLivesText(this.systemInfo.windowWidth - 60, topBarY + 10);
    
    // 当前关卡显示
    this.drawCurrentLevelText(this.systemInfo.windowWidth / 2, topBarY + 10);
    
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
    // 只绘制可见的关卡
    const visibleLevels = this.levels.filter(level => {
      const screenY = level.y - this.scrollY;
      return screenY >= 280 && screenY < 620; // 扩大显示范围，确保第二关可见
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
    
    this.ctx.save();
    this.ctx.globalAlpha = level.alpha;
    this.ctx.translate(screenX, screenY);
    this.ctx.scale(level.scale, level.scale);
    this.ctx.rotate(level.rotation * Math.PI / 180);
    
    // 绘制关卡方块
    this.ctx.fillStyle = color;
    this.ctx.fillRect(-30, -30, 60, 60);
    
    // 绘制关卡数字
    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(level.id.toString(), 0, 5);
    
    this.ctx.restore();
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

  // 主绘制方法 - 事件驱动
  draw() {
    this.drawBackground();
    this.drawTopBar();
    this.drawLevels();
    this.drawScrollIndicator();
    this.drawPlayButton();
  }

  // 检查是否有活跃的动画
  hasActiveAnimations() {
    return this.isScrolling || this.scrollVelocity !== 0;
  }

  triggerRedraw() {
    this.hasDrawn = false;
    if (typeof window !== 'undefined' && window.markNeedsRedraw) {
      window.markNeedsRedraw();
    }
  }
}

// 确保 MainMenu 类在全局作用域中可用
if (typeof window !== 'undefined') {
  window.MainMenu = MainMenu;
} else if (typeof global !== 'undefined') {
  global.MainMenu = MainMenu;
} else {
  // 在抖音小游戏环境中，直接设置为全局变量
  this.MainMenu = MainMenu;
}