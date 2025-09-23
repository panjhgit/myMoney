/**
 * 游戏工具函数
 * 提供公共的工具方法，减少代码重复
 */

// 坐标获取工具
export const GameUtils = {
    /**
     * 从事件对象获取坐标
     * @param {Event} event - 事件对象
     * @returns {Object} 包含x, y坐标的对象
     */
    getEventCoordinates(event) {
        const x = event.clientX || event.pageX || event.x || 0;
        const y = event.clientY || event.pageY || event.y || 0;
        return {x: x, y: y};
    },

    /**
     * 从触摸事件获取坐标
     * @param {TouchEvent} event - 触摸事件对象
     * @returns {Object} 包含x, y坐标的对象
     */
    getTouchCoordinates(event) {
        const touch = event.touches[0] || event.changedTouches[0];
        if (!touch) return {x: 0, y: 0};
        
        const x = touch.clientX || touch.pageX || touch.x || 0;
        const y = touch.clientY || touch.pageY || touch.y || 0;
        return {x: x, y: y};
    },

    /**
     * 安全的数值转换
     * @param {*} value - 要转换的值
     * @param {number} defaultValue - 默认值
     * @returns {number} 转换后的数值
     */
    safeNumber(value, defaultValue) {
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
    },

    /**
     * 检查值是否有效
     * @param {*} value - 要检查的值
     * @returns {boolean} 是否有效
     */
    isValid(value) {
        return value !== null && value !== undefined && value !== '';
    },

    /**
     * 格式化日志信息
     * @param {string} module - 模块名
     * @param {string} message - 消息
     * @returns {string} 格式化后的日志
     */
    formatLog(module, message) {
        return `[${module}] ${message}`;
    }
};

// 公共绘制工具类
export const DrawUtils = {
    /**
     * 绘制金币图标
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {string} coinColor - 金币颜色，默认为金色
     */
    drawCoinIcon(ctx, x, y, coinColor = '#FFD700') {
        ctx.fillStyle = coinColor;
        ctx.beginPath();
        ctx.arc(x + 15, y + 15, 15, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('$', x + 15, y + 20);
    },

    /**
     * 绘制金币数量文本
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number|string} amount - 金币数量
     * @param {string} textColor - 文字颜色，默认为白色
     */
    drawCurrencyText(ctx, x, y, amount, textColor = '#FFFFFF') {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(amount.toString(), x, y + 15);
        
        // 加号按钮
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(x + 40, y + 15, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = textColor;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('+', x + 40, y + 19);
    },

    /**
     * 绘制爱心图标
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {string} heartColor - 爱心颜色，默认为红色
     */
    drawHeartIcon(ctx, x, y, heartColor = '#FF6B6B') {
        ctx.fillStyle = heartColor;
        ctx.beginPath();
        ctx.moveTo(x + 15, y + 5);
        ctx.bezierCurveTo(x + 5, y - 5, x - 5, y - 5, x - 5, y + 10);
        ctx.bezierCurveTo(x - 5, y + 20, x + 15, y + 30, x + 15, y + 30);
        ctx.bezierCurveTo(x + 15, y + 30, x + 35, y + 20, x + 35, y + 10);
        ctx.bezierCurveTo(x + 35, y - 5, x + 25, y - 5, x + 15, y + 5);
        ctx.fill();
    },

    /**
     * 绘制生命值文本
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number|string} lives - 生命值数量
     * @param {string} textColor - 文字颜色，默认为白色
     */
    drawLivesText(ctx, x, y, lives, textColor = '#FFFFFF') {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(lives.toString(), x, y + 15);
        
        // 加号按钮
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(x + 20, y + 15, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = textColor;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('+', x + 20, y + 19);
    },

    /**
     * 绘制当前关卡文本
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number|string} level - 关卡数
     * @param {string} textColor - 文字颜色，默认为白色
     */
    drawCurrentLevelText(ctx, x, y, level, textColor = '#FFFFFF') {
        ctx.fillStyle = textColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`关卡 ${level}`, x, y + 15);
    },

    /**
     * 绘制圆角矩形
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {number} radius - 圆角半径
     */
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }
};

// 事件管理器 - 统一事件处理（抖音小游戏优化版）
export const EventManager = {
    /**
     * 设置画布事件监听器 - 优先使用抖音小游戏API
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Object} handlers - 事件处理函数对象
     * @returns {Object} 绑定的事件处理函数引用
     */
    setupCanvasEvents(canvas, handlers) {
        const boundHandlers = {};
        
        // 检查是否在抖音小游戏环境中
        const isDouYinMiniGame = typeof tt !== 'undefined';
        
        if (isDouYinMiniGame) {
            console.log('[EventManager] 检测到抖音小游戏环境，使用tt API');
            
            // 使用抖音小游戏官方API - 根据官方文档优化
            console.log('[EventManager] 使用抖音小游戏官方触摸事件API');
            
            // 监听开始触摸事件 tt.onTouchStart
            if (handlers.touchstart) {
                boundHandlers.boundHandleTouchStart = (e) => {
                    console.log('[EventManager] onTouchStart 触发');
                    // 抖音小游戏环境中的事件对象可能没有preventDefault方法
                    if (e.preventDefault && typeof e.preventDefault === 'function') {
                        e.preventDefault();
                    }
                    handlers.touchstart(e);
                };
                tt.onTouchStart(boundHandlers.boundHandleTouchStart);
            }
            
            // 监听触点移动事件 tt.onTouchMove
            if (handlers.touchmove) {
                boundHandlers.boundHandleTouchMove = (e) => {
                    console.log('[EventManager] onTouchMove 触发');
                    // 抖音小游戏环境中的事件对象可能没有preventDefault方法
                    if (e.preventDefault && typeof e.preventDefault === 'function') {
                        e.preventDefault();
                    }
                    handlers.touchmove(e);
                };
                tt.onTouchMove(boundHandlers.boundHandleTouchMove);
            }
            
            // 监听触摸结束事件 tt.onTouchEnd
            if (handlers.touchend) {
                boundHandlers.boundHandleTouchEnd = (e) => {
                    console.log('[EventManager] onTouchEnd 触发');
                    // 抖音小游戏环境中的事件对象可能没有preventDefault方法
                    if (e.preventDefault && typeof e.preventDefault === 'function') {
                        e.preventDefault();
                    }
                    handlers.touchend(e);
                };
                tt.onTouchEnd(boundHandlers.boundHandleTouchEnd);
            }
            
            // 监听触点失效事件 tt.onTouchCancel - 官方文档新增支持
            if (handlers.touchcancel) {
                boundHandlers.boundHandleTouchCancel = (e) => {
                    console.log('[EventManager] onTouchCancel 触发');
                    // 抖音小游戏环境中的事件对象可能没有preventDefault方法
                    if (e.preventDefault && typeof e.preventDefault === 'function') {
                        e.preventDefault();
                    }
                    handlers.touchcancel(e);
                };
                tt.onTouchCancel(boundHandlers.boundHandleTouchCancel);
            }
            
            // 在抖音小游戏中，点击事件通常通过touchend处理
            if (handlers.click && !handlers.touchend) {
                boundHandlers.boundHandleClick = (e) => {
                    console.log('[EventManager] click事件通过onTouchEnd处理');
                    // 抖音小游戏环境中的事件对象可能没有preventDefault方法
                    if (e.preventDefault && typeof e.preventDefault === 'function') {
                        e.preventDefault();
                    }
                    handlers.click(e);
                };
                tt.onTouchEnd(boundHandlers.boundHandleClick);
            }
            
        } else {
            console.log('[EventManager] 使用标准Web API');
            
            // 标准Web环境 - 鼠标事件
            if (handlers.click) {
                boundHandlers.boundHandleClick = (e) => handlers.click(e);
                canvas.addEventListener('click', boundHandlers.boundHandleClick);
            }
            
            if (handlers.mousedown) {
                boundHandlers.boundHandleMouseDown = (e) => handlers.mousedown(e);
                canvas.addEventListener('mousedown', boundHandlers.boundHandleMouseDown);
            }
            
            if (handlers.mousemove) {
                boundHandlers.boundHandleMouseMove = (e) => handlers.mousemove(e);
                canvas.addEventListener('mousemove', boundHandlers.boundHandleMouseMove);
            }
            
            if (handlers.mouseup) {
                boundHandlers.boundHandleMouseUp = (e) => handlers.mouseup(e);
                canvas.addEventListener('mouseup', boundHandlers.boundHandleMouseUp);
            }
            
            // 触摸事件
            if (handlers.touchstart) {
                boundHandlers.boundHandleTouchStart = (e) => {
                    e.preventDefault();
                    handlers.touchstart(e);
                };
                canvas.addEventListener('touchstart', boundHandlers.boundHandleTouchStart, { passive: false });
            }
            
            if (handlers.touchmove) {
                boundHandlers.boundHandleTouchMove = (e) => {
                    e.preventDefault();
                    handlers.touchmove(e);
                };
                canvas.addEventListener('touchmove', boundHandlers.boundHandleTouchMove, { passive: false });
            }
            
            if (handlers.touchend) {
                boundHandlers.boundHandleTouchEnd = (e) => {
                    e.preventDefault();
                    handlers.touchend(e);
                };
                canvas.addEventListener('touchend', boundHandlers.boundHandleTouchEnd, { passive: false });
            }
        }
        
        return boundHandlers;
    },
    
    /**
     * 移除画布事件监听器 - 支持抖音小游戏环境
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Object} boundHandlers - 绑定的事件处理函数引用
     */
    removeCanvasEvents(canvas, boundHandlers) {
        if (!canvas || !boundHandlers) return;
        
        // 检查是否在抖音小游戏环境中
        const isDouYinMiniGame = typeof tt !== 'undefined';
        
        if (isDouYinMiniGame) {
            console.log('[EventManager] 移除抖音小游戏事件监听器');
            
            // 抖音小游戏环境 - 使用tt API移除事件
            if (boundHandlers.boundHandleTouchStart) {
                tt.offTouchStart(boundHandlers.boundHandleTouchStart);
            }
            if (boundHandlers.boundHandleTouchMove) {
                tt.offTouchMove(boundHandlers.boundHandleTouchMove);
            }
            if (boundHandlers.boundHandleTouchEnd) {
                tt.offTouchEnd(boundHandlers.boundHandleTouchEnd);
            }
            if (boundHandlers.boundHandleTouchCancel) {
                tt.offTouchCancel(boundHandlers.boundHandleTouchCancel);
            }
            if (boundHandlers.boundHandleClick) {
                tt.offTouchEnd(boundHandlers.boundHandleClick);
            }
            
        } else {
            console.log('[EventManager] 移除标准Web事件监听器');
            
            // 标准Web环境 - 移除鼠标事件
            if (boundHandlers.boundHandleClick) {
                canvas.removeEventListener('click', boundHandlers.boundHandleClick);
            }
            if (boundHandlers.boundHandleMouseDown) {
                canvas.removeEventListener('mousedown', boundHandlers.boundHandleMouseDown);
            }
            if (boundHandlers.boundHandleMouseMove) {
                canvas.removeEventListener('mousemove', boundHandlers.boundHandleMouseMove);
            }
            if (boundHandlers.boundHandleMouseUp) {
                canvas.removeEventListener('mouseup', boundHandlers.boundHandleMouseUp);
            }
            
            // 移除触摸事件
            if (boundHandlers.boundHandleTouchStart) {
                canvas.removeEventListener('touchstart', boundHandlers.boundHandleTouchStart);
            }
            if (boundHandlers.boundHandleTouchMove) {
                canvas.removeEventListener('touchmove', boundHandlers.boundHandleTouchMove);
            }
            if (boundHandlers.boundHandleTouchEnd) {
                canvas.removeEventListener('touchend', boundHandlers.boundHandleTouchEnd);
            }
            if (boundHandlers.boundHandleTouchCancel) {
                canvas.removeEventListener('touchcancel', boundHandlers.boundHandleTouchCancel);
            }
        }
    },
    
    /**
     * 获取事件坐标（统一处理鼠标和触摸事件）
     * @param {Event} event - 事件对象
     * @returns {Object} 包含x, y坐标的对象
     */
    getEventCoordinates(event) {
        if (event.touches && event.touches.length > 0) {
            // 触摸事件
            return GameUtils.getTouchCoordinates(event);
        } else {
            // 鼠标事件
            return GameUtils.getEventCoordinates(event);
        }
    }
};

// 动画管理器 - 统一动画处理
export const AnimationManager = {
    /**
     * 检查GSAP是否可用
     * @returns {boolean} GSAP是否可用
     */
    isGSAPAvailable() {
        return typeof gsap !== 'undefined';
    },
    
    /**
     * 创建备用动画（当GSAP不可用时）
     * @param {Object} target - 动画目标对象
     * @param {Object} properties - 动画属性
     * @param {number} duration - 动画持续时间（毫秒）
     * @param {Function} onComplete - 完成回调
     */
    createFallbackAnimation(target, properties, duration, onComplete) {
        const startTime = Date.now();
        const startValues = {};
        
        // 记录起始值
        for (const key in properties) {
            if (key !== 'duration' && key !== 'ease' && key !== 'onComplete') {
                startValues[key] = target[key] || 0;
            }
        }
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 简单的缓动函数
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // 更新属性值
            for (const key in properties) {
                if (key !== 'duration' && key !== 'ease' && key !== 'onComplete') {
                    const startValue = startValues[key];
                    const endValue = properties[key];
                    target[key] = startValue + (endValue - startValue) * easeProgress;
                }
            }
            
            if (progress < 1) {
                // 优先使用抖音小游戏的 requestAnimationFrame
                if (typeof tt !== 'undefined' && tt.requestAnimationFrame) {
                    tt.requestAnimationFrame(animate);
                } else if (typeof requestAnimationFrame !== 'undefined') {
                    requestAnimationFrame(animate);
                } else {
                    setTimeout(animate, 16); // 约60fps
                }
            } else {
                if (onComplete) {
                    onComplete();
                }
            }
        };
        
        animate();
    },
    
    /**
     * 创建动画（自动选择GSAP或备用方案）
     * @param {Object} target - 动画目标对象
     * @param {Object} properties - 动画属性
     * @param {Object} options - 动画选项
     * @returns {Object} 动画对象
     */
    createAnimation(target, properties, options = {}) {
        if (this.isGSAPAvailable()) {
            // 使用GSAP
            return gsap.to(target, {
                ...properties,
                ...options
            });
        } else {
            // 使用备用动画
            const duration = (options.duration || 0.3) * 1000; // 转换为毫秒
            this.createFallbackAnimation(target, properties, duration, options.onComplete);
            return { kill: () => {} }; // 返回一个兼容的对象
        }
    },
    
    /**
     * 创建时间线动画
     * @param {Object} options - 时间线选项
     * @returns {Object} 时间线对象
     */
    createTimeline(options = {}) {
        if (this.isGSAPAvailable()) {
            return gsap.timeline(options);
        } else {
            // 返回一个简化的时间线对象
            return {
                to: (target, properties) => {
                    const duration = (properties.duration || 0.3) * 1000;
                    this.createFallbackAnimation(target, properties, duration, properties.onComplete);
                    return this;
                },
                call: (callback, params, delay) => {
                    setTimeout(() => {
                        if (callback) callback(...(params || []));
                    }, (delay || 0) * 1000);
                    return this;
                },
                kill: () => {}
            };
        }
    },
    
    /**
     * 创建粒子效果动画
     * @param {Object} particle - 粒子对象
     * @param {Object} properties - 动画属性
     * @param {Function} onUpdate - 更新回调
     * @param {Function} onComplete - 完成回调
     */
    createParticleAnimation(particle, properties, onUpdate, onComplete) {
        if (this.isGSAPAvailable()) {
            return gsap.to(particle, {
                ...properties,
                onUpdate: onUpdate,
                onComplete: onComplete
            });
        } else {
            const duration = (properties.duration || 0.5) * 1000;
            this.createFallbackAnimation(particle, properties, duration, onComplete);
            return { kill: () => {} };
        }
    },

    /**
     * 检查GSAP是否可用
     * @returns {boolean} GSAP是否可用
     */
    isGSAPAvailable: function() {
        return typeof gsap !== 'undefined' && gsap !== null;
    }
};
