// debug-helper.js - 调试辅助工具
const fs = require('fs');
const path = require('path');

class DebugHelper {
    constructor() {
        this.debugPoints = new Map();
        this.requestTracker = new Map();
        this.performanceMarks = new Map();
    }

    // 添加调试断点标记
    addBreakpoint(name, data = {}) {
        const timestamp = new Date().toISOString();
        const stackTrace = new Error().stack;

        this.debugPoints.set(name, {
            timestamp,
            data,
            stackTrace,
            count: (this.debugPoints.get(name)?.count || 0) + 1
        });

        console.log(`🔍 [DEBUG-${name}]`, {
            timestamp,
            data,
            count: this.debugPoints.get(name).count
        });

        // 在这里设置断点，调试器会在此处停止
        debugger; // VS Code 调试器会在这里暂停
    }

    // 跟踪请求
    trackRequest(requestId, phase, data = {}) {
        if (!this.requestTracker.has(requestId)) {
            this.requestTracker.set(requestId, []);
        }

        const entry = {
            phase,
            timestamp: Date.now(),
            data
        };

        this.requestTracker.get(requestId).push(entry);
        console.log(`📊 [REQ-${requestId}] ${phase}:`, data);
    }

    // 性能标记
    markPerformance(name) {
        this.performanceMarks.set(name, Date.now());
        console.log(`⏱️ [PERF] ${name} marked at ${Date.now()}`);
    }

    // 计算性能差异
    measurePerformance(startMark, endMark) {
        const start = this.performanceMarks.get(startMark);
        const end = this.performanceMarks.get(endMark);

        if (start && end) {
            const duration = end - start;
            console.log(`⏱️ [PERF] ${startMark} → ${endMark}: ${duration}ms`);
            return duration;
        }
        return null;
    }

    // 导出调试报告
    exportDebugReport() {
        const report = {
            timestamp: new Date().toISOString(),
            debugPoints: Object.fromEntries(this.debugPoints),
            requests: Object.fromEntries(this.requestTracker),
            performance: Object.fromEntries(this.performanceMarks)
        };

        const filename = `debug-report-${Date.now()}.json`;
        const filepath = path.join(__dirname, 'logs', filename);

        fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
        console.log(`📋 调试报告已保存: ${filepath}`);

        return filepath;
    }

    // 清理调试数据
    clear() {
        this.debugPoints.clear();
        this.requestTracker.clear();
        this.performanceMarks.clear();
        console.log('🧹 调试数据已清理');
    }
}

// 创建全局调试实例
global.debugHelper = new DebugHelper();

// 导出便捷函数
module.exports = {
    debug: (name, data) => global.debugHelper.addBreakpoint(name, data),
    track: (id, phase, data) => global.debugHelper.trackRequest(id, phase, data),
    mark: (name) => global.debugHelper.markPerformance(name),
    measure: (start, end) => global.debugHelper.measurePerformance(start, end),
    report: () => global.debugHelper.exportDebugReport(),
    clear: () => global.debugHelper.clear()
};