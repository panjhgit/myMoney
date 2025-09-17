/**
 * 游戏工具函数
 * 提供公共的工具方法，减少代码重复
 */

// 坐标获取工具
var GameUtils = {
    /**
     * 从事件对象获取坐标
     * @param {Event} event - 事件对象
     * @returns {Object} 包含x, y坐标的对象
     */
    getEventCoordinates: function(event) {
        var x = event.clientX || event.pageX || event.x || 0;
        var y = event.clientY || event.pageY || event.y || 0;
        return {x: x, y: y};
    },

    /**
     * 从触摸事件获取坐标
     * @param {TouchEvent} event - 触摸事件对象
     * @returns {Object} 包含x, y坐标的对象
     */
    getTouchCoordinates: function(event) {
        var touch = event.touches[0] || event.changedTouches[0];
        if (!touch) return {x: 0, y: 0};
        
        var x = touch.clientX || touch.pageX || touch.x || 0;
        var y = touch.clientY || touch.pageY || touch.y || 0;
        return {x: x, y: y};
    },

    /**
     * 安全的数值转换
     * @param {*} value - 要转换的值
     * @param {number} defaultValue - 默认值
     * @returns {number} 转换后的数值
     */
    safeNumber: function(value, defaultValue) {
        var num = Number(value);
        return isNaN(num) ? defaultValue : num;
    },

    /**
     * 检查值是否有效
     * @param {*} value - 要检查的值
     * @returns {boolean} 是否有效
     */
    isValid: function(value) {
        return value !== null && value !== undefined && value !== '';
    },

    /**
     * 格式化日志信息
     * @param {string} module - 模块名
     * @param {string} message - 消息
     * @returns {string} 格式化后的日志
     */
    formatLog: function(module, message) {
        return '[' + module + '] ' + message;
    }
};

// 导出到全局作用域
window.GameUtils = GameUtils;
