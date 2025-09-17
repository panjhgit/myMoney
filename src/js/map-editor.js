/**
 * 地图编辑器工具
 * 提供可视化的地图编辑和实时验证功能
 */

class MapEditor {
    constructor() {
        this.validator = new MapLayoutValidator();
        this.currentMap = null;
        this.editMode = false;
        this.selectedElement = null;
        
        // 创建编辑器UI
        this.createEditorUI();
    }
    
    /**
     * 创建编辑器UI
     */
    createEditorUI() {
        // 创建编辑器容器
        const editorContainer = document.createElement('div');
        editorContainer.id = 'map-editor';
        editorContainer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        editorContainer.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #4CAF50;">地图编辑器</h3>
            <div id="editor-controls">
                <button id="toggle-edit" style="margin: 5px; padding: 5px 10px;">切换编辑模式</button>
                <button id="validate-map" style="margin: 5px; padding: 5px 10px;">验证地图</button>
                <button id="export-map" style="margin: 5px; padding: 5px 10px;">导出地图</button>
            </div>
            <div id="editor-info" style="margin-top: 10px;">
                <div>当前地图: <span id="current-map-name">无</span></div>
                <div>编辑模式: <span id="edit-mode-status">关闭</span></div>
            </div>
            <div id="validation-results" style="margin-top: 10px; font-size: 11px;"></div>
        `;
        
        document.body.appendChild(editorContainer);
        
        // 绑定事件
        this.bindEvents();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        document.getElementById('toggle-edit').addEventListener('click', () => {
            this.toggleEditMode();
        });
        
        document.getElementById('validate-map').addEventListener('click', () => {
            this.validateCurrentMap();
        });
        
        document.getElementById('export-map').addEventListener('click', () => {
            this.exportCurrentMap();
        });
    }
    
    /**
     * 切换编辑模式
     */
    toggleEditMode() {
        this.editMode = !this.editMode;
        const statusElement = document.getElementById('edit-mode-status');
        const buttonElement = document.getElementById('toggle-edit');
        
        if (this.editMode) {
            statusElement.textContent = '开启';
            statusElement.style.color = '#4CAF50';
            buttonElement.textContent = '关闭编辑';
            this.enableEditMode();
        } else {
            statusElement.textContent = '关闭';
            statusElement.style.color = '#f44336';
            buttonElement.textContent = '开启编辑';
            this.disableEditMode();
        }
    }
    
    /**
     * 启用编辑模式
     */
    enableEditMode() {
        // 添加编辑模式的样式和功能
        console.log('编辑模式已启用');
    }
    
    /**
     * 禁用编辑模式
     */
    disableEditMode() {
        // 移除编辑模式的样式和功能
        console.log('编辑模式已禁用');
    }
    
    /**
     * 验证当前地图
     */
    validateCurrentMap() {
        if (!this.currentMap) {
            this.showMessage('请先加载地图', 'error');
            return;
        }
        
        const result = this.validator.validateMapLayout(this.currentMap);
        this.displayValidationResults(result);
    }
    
    /**
     * 显示验证结果
     */
    displayValidationResults(result) {
        const resultsContainer = document.getElementById('validation-results');
        
        let html = `<div style="border: 1px solid ${result.isValid ? '#4CAF50' : '#f44336'}; padding: 10px; border-radius: 4px;">`;
        html += `<div style="color: ${result.isValid ? '#4CAF50' : '#f44336'}; font-weight: bold;">`;
        html += `${result.isValid ? '✅ 验证通过' : '❌ 验证失败'}</div>`;
        
        if (result.errors.length > 0) {
            html += '<div style="color: #f44336; margin-top: 5px;"><strong>错误:</strong><ul>';
            result.errors.forEach(error => {
                html += `<li>${error}</li>`;
            });
            html += '</ul></div>';
        }
        
        if (result.warnings.length > 0) {
            html += '<div style="color: #ff9800; margin-top: 5px;"><strong>警告:</strong><ul>';
            result.warnings.forEach(warning => {
                html += `<li>${warning}</li>`;
            });
            html += '</ul></div>';
        }
        
        html += `<div style="margin-top: 10px;"><strong>统计:</strong><br>`;
        html += `方块: ${result.statistics.totalBlocks} | 石块: ${result.statistics.totalRocks}<br>`;
        html += `层级分布: ${JSON.stringify(result.statistics.layerDistribution)}<br>`;
        html += `颜色分布: ${JSON.stringify(result.statistics.colorDistribution)}</div>`;
        
        html += '</div>';
        resultsContainer.innerHTML = html;
    }
    
    /**
     * 导出当前地图
     */
    exportCurrentMap() {
        if (!this.currentMap) {
            this.showMessage('请先加载地图', 'error');
            return;
        }
        
        const layoutData = this.validator.exportLayoutData();
        const exportData = {
            map: this.currentMap,
            layoutValidation: layoutData,
            exportTime: new Date().toISOString()
        };
        
        // 复制到剪贴板
        if (navigator.clipboard) {
            navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
                .then(() => {
                    this.showMessage('地图数据已复制到剪贴板', 'success');
                })
                .catch(() => {
                    this.showMessage('复制失败，请手动复制', 'error');
                });
        }
        
        // 同时输出到控制台
        console.log('导出的地图数据:', exportData);
    }
    
    /**
     * 加载地图
     */
    loadMap(mapData) {
        this.currentMap = mapData;
        document.getElementById('current-map-name').textContent = mapData.name || '未知地图';
        this.validateCurrentMap();
    }
    
    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            padding: 15px 25px;
            border-radius: 4px;
            z-index: 10001;
            font-family: monospace;
        `;
        messageElement.textContent = message;
        
        document.body.appendChild(messageElement);
        
        setTimeout(() => {
            document.body.removeChild(messageElement);
        }, 3000);
    }
}

// 全局地图编辑器实例
window.mapEditor = new MapEditor();

// 自动加载当前地图（如果存在）
if (window.map1) {
    window.mapEditor.loadMap(window.map1);
}

console.log('地图编辑器已加载');
