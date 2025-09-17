/**
 * 生物系统模块
 * 提供方块动画和行为支持
 */

// 生物状态常量
const CreatureStates = {
    idle: 'idle',
    moving: 'moving',
    animating: 'animating'
};

// 生物动画管理器
class CreatureManager {
    constructor() {
        this.creatures = new Map();
        this.animationQueue = [];
    }

    // 添加生物
    addCreature(id, creature) {
        this.creatures.set(id, creature);
    }

    // 移除生物
    removeCreature(id) {
        this.creatures.delete(id);
    }

    // 更新生物状态
    updateCreature(id, newState) {
        const creature = this.creatures.get(id);
        if (creature) {
            creature.state = newState;
        }
    }

    // 播放动画
    playAnimation(id, animationType, duration = 300) {
        const creature = this.creatures.get(id);
        if (creature) {
            creature.state = CreatureStates.animating;
            // 这里可以添加具体的动画逻辑
            setTimeout(() => {
                creature.state = CreatureStates.idle;
            }, duration);
        }
    }
}

// 创建全局实例
const creatureManager = new CreatureManager();

// 导出到全局作用域
window.CreatureStates = CreatureStates;
window.CreatureManager = CreatureManager;
window.creatureManager = creatureManager;

console.log('Creature 系统已加载，支持方块动画和行为');
