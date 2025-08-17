# VS Code 调试完整指南

## 🎯 调试原理详解

### 1. Node.js Inspector 协议
```
应用启动 → Node.js Inspector → WebSocket 服务器 → VS Code Debug Adapter
```

当你使用 `--inspect` 参数启动 Node.js 应用时：
- Node.js 启动内置的 Inspector 模块
- 在指定端口（默认 9229）开启 WebSocket 服务器
- 暴露 Chrome DevTools Protocol API
- VS Code 通过 Debug Adapter 连接到这个端口

### 2. 调试器通信流程
```
VS Code UI → Debug Extension → Debug Adapter → Inspector Protocol → Node.js Runtime
```

## 🚀 调试方式对比

### 方式一：直接启动调试（推荐开发时使用）
```bash
# 命令行启动
npm run debug

# 或者直接
node --inspect=9229 server.js
```

**优点：**
- 启动快速
- 完全控制应用生命周期
- 适合开发阶段调试

**缺点：**
- 没有进程管理
- 崩溃后需要手动重启

### 方式二：PM2 调试模式
```bash
# 启动 PM2 调试实例
npm run pm2:debug

# 然后在 VS Code 中 attach
```

**优点：**
- 进程管理和监控
- 文件变化自动重启
- 日志管理
- 更接近生产环境

**缺点：**
- 启动稍慢
- 需要额外的 attach 步骤

### 方式三：VS Code 直接启动
在 VS Code 中按 `F5` 选择配置

**优点：**
- 一键启动调试
- 集成度最高
- 断点设置方便

## 🔧 调试配置详解

### launch.json 配置说明

```json
{
    "name": "🚀 Launch Server (Direct)",
    "type": "node",                    // 调试器类型
    "request": "launch",               // 启动模式（launch/attach）
    "program": "${workspaceFolder}/server.js",  // 入口文件
    "env": {                          // 环境变量
        "NODE_ENV": "development",
        "DEBUG": "*",                 // 启用所有调试输出
        "DebugMode": "true"          // 你的应用调试模式
    },
    "console": "integratedTerminal",  // 输出到集成终端
    "restart": true,                  // 崩溃后自动重启
    "runtimeArgs": ["--nolazy"],     // Node.js 运行参数
    "skipFiles": [                   // 跳过的文件（不进入调试）
        "<node_internals>/**",       // Node.js 内部文件
        "node_modules/**"            // 第三方模块
    ],
    "stopOnEntry": false,            // 是否在入口处停止
    "cwd": "${workspaceFolder}",     // 工作目录
    "outputCapture": "console"       // 捕获控制台输出
}
```

### Attach 配置说明

```json
{
    "name": "🔗 Attach to PM2 Debug",
    "type": "node",
    "request": "attach",              // 附加模式
    "port": 9229,                    // Inspector 端口
    "restart": true,                 // 重启时重新连接
    "localRoot": "${workspaceFolder}",   // 本地代码根目录
    "remoteRoot": "${workspaceFolder}",  // 远程代码根目录
    "trace": true                    // 启用跟踪日志
}
```

## 🤖 自动化任务详解 (tasks.json)

`.tasks.json` 文件定义了可以在 VS Code 中自动执行的脚本和命令。你可以通过 `Ctrl+Shift+P` 打开命令面板，然后选择 "Tasks: Run Task" 来运行它们。

### `Start PM2 Debug Mode`
- **功能**: 启动 `cherry-var-debug` 应用的 PM2 进程。
- **命令**: `npm run pm2:debug`
- **用途**: 准备一个由 PM2 管理的应用实例，以便后续使用 "🔗 Attach to PM2 Debug" 配置进行附加调试。

### `Stop PM2 Debug`
- **功能**: 停止 `cherry-var-debug` 应用的 PM2 进程。
- **命令**: `pm2 stop cherry-var-debug`
- **用途**: 关闭用于调试的 PM2 进程。

### `View PM2 Debug Logs`
- **功能**: 查看 `cherry-var-debug` 应用的日志。
- **命令**: `npm run pm2:debug-logs`
- **用途**: 在一个新的终端面板中实时查看调试应用的日志输出，方便追踪问题。

### `Clean Debug Logs`
- **功能**: 清理特定的调试日志文件。
- **命令**: `powershell -Command "..."`
- **用途**: 删除由调试会话产生的日志文件 (`debug-*.log`, `ServerLog-*.txt`)，保持日志目录的整洁。这个任务在 `Debug Plugin (Standalone)` 配置执行前会被自动调用。

### `Clean All Logs`
- **功能**: 清理所有日志文件。
- **命令**: `powershell -Command "..."`
- **用途**: 强制删除 `debug/logs/` 目录下的所有文件，用于完全重置日志状态。

## 🔬 高级调试工具与独立插件调试

除了 VS Code 的标准调试功能，项目还集成了一套强大的自定义调试工具 (`debug/debug-helper.js`) 和一个用于独立测试插件的脚本 (`debug-plugin.js`)。

### 深入 `debug-helper.js`

你可以在代码中引入这些辅助函数，以增强调试能力：
```javascript
const { debug, track, mark, measure, report } = require('./debug-helper');
```

- **`debug(name, data)`**: 在代码中设置一个命名的调试点。当代码执行到此处时，它会：
  1.  在控制台打印带有时间戳和数据快照的详细信息。
  2.  触发 `debugger;` 语句，如果 VS Code 调试器已附加，程序会在此处暂停。
- **`track(id, phase, data)`**: 跟踪一个长时间运行的任务或请求的生命周期。你可以用它来记录一个请求经过的各个阶段（如 `validation`, `processing`, `response`）。
- **`mark(name)`** 和 **`measure(startMark, endMark)`**: 用于精确测量代码块的执行时间。
  - `mark('start_processing')` 在代码块开始处设置一个时间戳标记。
  - `measure('start_processing', 'end_processing')` 计算两个标记之间的时间差（毫秒）。
- **`report()`**: 将当前调试会话中收集的所有 `debug` 点、`track` 记录和性能数据导出到一个 JSON 文件中，存放在 `debug/logs/` 目录下。
- **`clear()`**: 清空所有已记录的调试数据。

### 独立插件调试工作流 (`debug-plugin.js`)

这是一个 CLI 脚本，用于在隔离环境中运行和调试单个插件，它与 VS Code 中的 `🔧 Debug Plugin (Standalone)` 配置协同工作。

- **工作流程**:
  1.  **启动**: 当你运行 `🔧 Debug Plugin (Standalone)` 配置时，VS Code 会调用此脚本，并提示你输入要调试的插件名称。
  2.  **读取配置**: 脚本会读取该插件的 `plugin-manifest.json` 来确定其入口文件和类型。
  3.  **加载输入**: 如果插件不是 `static` 类型，脚本会查找并读取插件目录下的 `debug-input.json` 文件作为输入。
  4.  **执行**: 脚本会像主服务器一样，通过 `spawn` 启动插件进程，并将 `debug-input.json` 的内容通过 `stdin` 传递给它。
  5.  **跟踪与报告**: 在整个过程中，脚本使用 `debug-helper` 记录详细的执行步骤和性能数据，并在最后生成一份完整的 JSON 调试报告。

- **如何使用**:
  1.  在需要调试的插件目录下，创建一个 `debug-input.json` 文件，模拟从主服务器接收到的输入。
  2.  在 VS Code 中，选择 `🔧 Debug Plugin (Standalone)` 配置并按 F5。
  3.  在弹出的输入框中，输入插件的名称（例如 `JinaAI`）。
  4.  调试器将启动，并在 `debug-plugin.js` 中设置的 `debug()` 调用处暂停，你可以单步调试插件的完整生命周期。
  5.  执行结束后，检查终端输出和 `debug/logs` 目录中生成的调试报告。

## 🛠️ 实际调试步骤

### 步骤 1：设置断点
1. 在 VS Code 中打开 `server.js`
2. 点击行号左侧设置断点（红色圆点）
3. 或者在代码中添加 `debugger;` 语句

### 步骤 2：启动调试
选择以下任一方式：

**方式 A：直接启动**
1. 按 `F5` 或 `Ctrl+F5`
2. 选择 "🚀 Launch Server (Direct)"
3. 应用启动，遇到断点时会暂停

**方式 B：PM2 + Attach**
1. 运行 `npm run pm2:debug`
2. 按 `F5`，选择 "🔗 Attach to PM2 Debug"
3. VS Code 连接到运行中的进程

### 步骤 3：调试操作
- **继续执行**: `F5`
- **单步执行**: `F10`
- **进入函数**: `F11`
- **跳出函数**: `Shift+F11`
- **重启调试**: `Ctrl+Shift+F5`
- **停止调试**: `Shift+F5`

## 🔍 调试技巧

### 1. 使用调试辅助工具
```javascript
// 在你的代码中引入调试助手
const { debug, track, mark, measure } = require('./debug-helper');

// 设置调试点
debug('API_REQUEST_START', { url: req.url, method: req.method });

// 跟踪请求
track(requestId, 'validation', { valid: true });

// 性能标记
mark('process_start');
// ... 处理逻辑
mark('process_end');
measure('process_start', 'process_end');
```

### 2. 条件断点
右键断点 → "编辑断点" → 设置条件
```javascript
// 只在特定条件下暂停
req.url.includes('/api/chat')
```

### 3. 日志断点
右键断点 → "编辑断点" → 勾选"日志消息"
```javascript
// 不暂停，只输出日志
Request URL: {req.url}, Method: {req.method}
```

### 4. 监视表达式
在调试面板的"监视"区域添加表达式：
```javascript
req.body
process.env.NODE_ENV
pluginManager.plugins.size
```

## 🐛 常见问题解决

### 问题 1：无法连接到调试端口
```bash
# 检查端口是否被占用
netstat -ano | findstr :9229

# 杀死占用进程
taskkill /PID <PID> /F
```

### 问题 2：断点不生效
- 确保源码映射正确
- 检查 `skipFiles` 配置
- 重启调试会话

### 问题 3：性能调试
```javascript
// 使用 Node.js 内置性能 API
const { performance } = require('perf_hooks');

const start = performance.now();
// 你的代码
const end = performance.now();
console.log(`执行时间: ${end - start}ms`);
```

## 📊 调试最佳实践

### 1. 分层调试
- **应用层**: 路由、中间件
- **业务层**: 插件、处理逻辑  
- **数据层**: 数据库、缓存

### 2. 日志策略
```javascript
// 结构化日志
console.log(JSON.stringify({
    level: 'debug',
    module: 'plugin-manager',
    action: 'load-plugin',
    plugin: pluginName,
    timestamp: new Date().toISOString()
}));
```

### 3. 错误处理调试
```javascript
try {
    // 业务逻辑
} catch (error) {
    console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        context: { /* 相关上下文 */ }
    });
    debugger; // 在错误处设置断点
    throw error;
}
```

## 🎮 快捷键总结

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| 开始调试 | `F5` | 启动调试会话 |
| 继续执行 | `F5` | 从断点继续 |
| 单步执行 | `F10` | 逐行执行 |
| 进入函数 | `F11` | 进入函数内部 |
| 跳出函数 | `Shift+F11` | 跳出当前函数 |
| 重启调试 | `Ctrl+Shift+F5` | 重启调试会话 |
| 停止调试 | `Shift+F5` | 停止调试 |
| 切换断点 | `F9` | 设置/取消断点 |

现在你可以开始高效的调试之旅了！🚀