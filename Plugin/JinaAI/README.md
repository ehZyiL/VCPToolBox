# JinaAI Plugin

一个功能强大的 JinaAI API 插件，支持网页内容提取、网络搜索和事实验证功能。

## 🚀 功能特性

### Reader API
- 📄 网页内容提取和转换
- 🔄 支持 GET/POST 请求方式
- 📝 HTML 内容直接处理
- 🎯 高级参数支持（超时、图片处理、选择器等）
- 🔧 参数别名和自动类型转换

### Search API
- 🔍 智能网络搜索
- 🎛️ 搜索操作符支持（site、filetype、intitle 等）
- 🌍 地理语言设置
- 🔧 搜索引擎选择
- 📊 结果数量控制

### Fact Check API
- ✅ 事实验证和检查
- 📊 可信度评分
- 📚 参考来源提供

### 通用功能
- 🔄 参数规范化和别名支持
- 🛡️ 增强的错误处理
- 📊 流式响应支持
- 🔧 批量请求处理
- 🧹 智能内容净化（自动移除 HTML/CSS/JS）

## 📦 安装和配置

### 1. 配置 API 密钥

```bash
# 复制配置示例文件
cp config.env.example config.env

# 编辑配置文件，填入你的 API 密钥
# 从 https://jina.ai/?sui=apikey 获取免费 API 密钥
```

### 2. 配置文件格式

```env
# config.env
JINA_API_KEY=your_api_key_here

# Reader API Token 使用设置（可选）
# Reader API 不强制使用 token，但使用 token 后获取效率会更高
JINA_READER_USE_TOKEN=false  # 默认为 false，设置为 true 启用 token 认证
```

### 3. Reader API Token 说明

- **默认行为**: `JINA_READER_USE_TOKEN=false` - Reader API 不使用 token 认证
- **高效模式**: `JINA_READER_USE_TOKEN=true` - Reader API 使用 token 认证，获取效率更高
- **其他 API**: Search 和 Fact Check API 始终使用 token 认证（强制要求）

## 🧪 测试

### 快速测试

```bash
# 运行所有测试
node JinaAITest.js

# 快速测试（精选测试）
node JinaAITest.js --quick

# 显示帮助
node JinaAITest.js --help
```

### 分类测试

```bash
# 测试 Reader 功能
node JinaAITest.js --category reader

# 测试 Search 功能
node JinaAITest.js --category search

# 测试 Fact Check 功能
node JinaAITest.js --category factcheck
```

### 调试和报告

```bash
# 调试模式
node JinaAITest.js --debug

# 生成测试报告
node JinaAITest.js --report
```

## 📖 使用示例

### Reader - 基本网页提取

**使用专用命令（推荐）**：
```json
{
  "tool_name": "reader",
  "url": "https://example.com",
  "format": "markdown"
}
```

**使用通用命令**：
```json
{
  "tool_name": "JinaAI",
  "command": "reader",
  "url": "https://example.com",
  "format": "markdown"
}
```

### Reader - 网页截图

#### 首屏截图 (screenshot)
返回网页第一屏的截图：

```json
{
  "tool_name": "reader",
  "url": "https://example.com",
  "format": "screenshot"
}
```

#### 全页截图 (pageshot)
返回完整页面的截图（尽力而为）：

```json
{
  "tool_name": "reader",
  "url": "https://example.com",
  "format": "pageshot"
}
```

**截图功能特性：**
- 将截图文件保存到 `image/jinaai/` 目录
- 文件命名格式：`域名_路径_时间戳.扩展名`（如：`example.com_202507271538.png`）
- 通过 ImageServer 提供访问链接
- 返回多模态结构化响应，包含文本描述、访问链接和 base64 图片数据
- screenshot: 捕获页面首屏内容
- pageshot: 捕获完整页面内容（可能很长）

### Reader - HTML 内容处理

```json
{
  "tool_name": "reader",
  "html": "<html><body><h1>Title</h1><p>Content</p></body></html>",
  "format": "markdown",
  "withGeneratedAlt": true
}
```

### Reader - 高级参数

```json
{
  "tool_name": "reader",
  "url": "https://example.com",
  "timeout": 30,
  "retainImages": "alt",
  "withGeneratedAlt": true,
  "removeSelector": "nav, footer",
  "tokenBudget": 50000,
  "cleanContent": true
}
```

### Reader - 内容净化控制

插件默认启用智能内容净化功能，自动清理 HTML、CSS 和 JavaScript 代码，提供更清洁的文本内容：

```json
{
  "tool_name": "reader",
  "url": "https://example.com",
  "cleanContent": true,     // 启用内容净化（默认）
  "format": "markdown"
}
```

**内容净化功能：**
- 🧹 移除 HTML 标签和属性
- 🎨 清理 CSS 样式和类名
- ⚡ 删除 JavaScript 代码和事件处理器
- 📝 保留纯文本内容和结构
- 🔧 可通过 `cleanContent: false` 禁用

**净化选项：**
- `cleanContent: true/false` - 主开关（默认 true）
- `sanitizeHtml: true/false` - HTML 净化开关
- `removeHtml: true/false` - HTML 移除开关  
- `stripHtml: true/false` - HTML 剥离开关

```json
{
  "tool_name": "reader",
  "url": "https://example.com",
  "cleanContent": false,    // 禁用净化，保留原始 HTML
  "format": "html"
}
```

### Search - 基本搜索

**使用专用命令（推荐）**：
```json
{
  "tool_name": "search",
  "query": "JavaScript tutorials",
  "count": 5
}
```

**使用通用命令**：
```json
{
  "tool_name": "JinaAI",
  "command": "search",
  "query": "JavaScript tutorials",
  "count": 5
}
```

### Search - 高级搜索

```json
{
  "tool_name": "search",
  "query": "Python programming",
  "count": 10,
  "site": ["github.com", "stackoverflow.com"],
  "filetype": ["pdf"],
  "gl": "us",
  "hl": "en",
  "withFavicons": true,
  "cleanContent": true
}
```

### Search - 内容净化

搜索结果同样支持内容净化功能，确保返回的内容描述更加清洁：

```json
{
  "tool_name": "search",
  "query": "web development tutorials",
  "count": 5,
  "cleanContent": true,     // 净化搜索结果内容（默认启用）
  "site": ["developer.mozilla.org"]
}
```

### Fact Check

**使用专用命令（推荐）**：
```json
{
  "tool_name": "factcheck",
  "statement": "The Earth orbits around the Sun."
}
```

**使用通用命令**：
```json
{
  "tool_name": "JinaAI",
  "command": "factcheck",
  "statement": "The Earth orbits around the Sun."
}
```

## 🔄 批量串行调用详细指南

### 批量操作概述

JinaAI 插件支持批量串行调用，允许你在一次请求中执行多个不同的操作。这对于复杂的工作流程非常有用。

### 基本语法规则

1. **使用数字后缀**: 每个命令和参数都需要添加数字后缀来区分
2. **顺序执行**: 操作按照数字顺序依次执行（1, 2, 3...）
3. **独立参数**: 每个操作的参数是独立的，互不影响

### 实用批量操作示例

#### 示例 1: 研究工作流（搜索 + 提取 + 验证）

```json
{
  "tool_name": "JinaAI",
  "command1": "search",
  "query1": "Python机器学习教程",
  "count1": 3,
  "command2": "reader", 
  "url2": "https://python.org",
  "format2": "markdown",
  "cleanContent2": true,
  "command3": "factcheck",
  "statement3": "Python是一种编程语言"
}
```

#### 示例 2: 多网页内容对比

```json
{
  "tool_name": "JinaAI",
  "command1": "reader",
  "url1": "https://site1.com",
  "format1": "text",
  "cleanContent1": true,
  "command2": "reader",
  "url2": "https://site2.com",
  "format2": "text", 
  "cleanContent2": true,
  "command3": "reader",
  "url3": "https://site3.com",
  "format3": "text",
  "cleanContent3": true
}
```

#### 示例 3: 内容净化效果对比

```json
{
  "tool_name": "JinaAI",
  "command1": "reader",
  "url1": "https://example.com",
  "format1": "html",
  "cleanContent1": true,
  "command2": "reader",
  "url2": "https://example.com",
  "format2": "html",
  "cleanContent2": false
}
```

#### 示例 4: 截图 + 内容提取组合

```json
{
  "tool_name": "JinaAI",
  "command1": "reader",
  "url1": "https://example.com",
  "format1": "pageshot",
  "command2": "reader",
  "url2": "https://example.com",
  "format2": "markdown",
  "cleanContent2": true,
  "removeSelector2": "nav, footer, .ads"
}
```

#### 示例 5: HTML 内容处理批量操作

```json
{
  "tool_name": "JinaAI",
  "command1": "reader",
  "html1": "<html><head><style>body{color:red;}</style></head><body><h1>测试1</h1></body></html>",
  "url1": "https://test1.local",
  "format1": "text",
  "cleanContent1": true,
  "command2": "reader",
  "html2": "<html><head><script>alert('test');</script></head><body><h1>测试2</h1></body></html>",
  "url2": "https://test2.local",
  "format2": "text",
  "cleanContent2": false
}
```

### 批量操作结果格式

批量操作的结果会以结构化格式返回：

```
### JinaAI 批量操作结果

执行了 N 个操作：

#### 操作 1: 操作类型 (1)
**状态:** ✅ 成功 / ❌ 失败
**结果内容或错误信息**

---

#### 操作 2: 操作类型 (2)
**状态:** ✅ 成功 / ❌ 失败
**结果内容或错误信息**

---
```

### 批量操作最佳实践

1. **合理规划**: 将相关的操作组合在一起
2. **错误预期**: 某些操作可能失败，其他操作仍会继续
3. **参数优化**: 为每个操作设置合适的参数
4. **资源考虑**: 批量操作会消耗更多时间和资源

### 高级技巧

- **参数复用**: 同一个URL可以用不同参数多次处理
- **混合操作**: 可以自由组合 reader、search、factcheck
- **错误隔离**: 一个操作失败不影响其他操作
- **调试友好**: 每个操作的结果都清晰标识

## 📁 文件结构

```
Plugin/JinaAI/
├── JinaAI.js                    # 主插件文件
├── JinaAITest.js              # 统一测试套件
├── config.env                   # 配置文件（需要创建）
├── config.env.example           # 配置示例
├── README.md                    # 本文档
├── TEST_GUIDE.md                # 详细测试指南
├── API_DOCUMENTATION.md         # API 文档
├── OPTIMIZATION_CHANGELOG.md    # 优化更新日志
└── plugin-manifest.json         # 插件清单
```

## 🔧 参数支持

### 参数别名

- `url` ← `URL`, `link`, `webpage`
- `query` ← `q`, `keyword`, `search`
- `format` ← `outputFormat`, `responseFormat`, `respondWith`
- `count` ← `results`, `limit`, `maxResults`

### 自动类型转换

- 字符串布尔值：`"true"` → `true`
- 字符串数字：`"30"` → `30`
- 逗号分隔字符串：`"a,b,c"` → `["a","b","c"]`

## 📊 测试覆盖

- ✅ 基本功能测试
- ✅ 高级参数测试
- ✅ 参数规范化测试
- ✅ 错误处理测试
- ✅ 响应格式测试
- ✅ 批量请求测试

## 🔄 版本历史

### v2.1.0 - 全面优化版本
- 基于 API_DOCUMENTATION.md 的完整功能实现
- 支持所有 Reader、Search、Fact Check API 参数
- 增强的参数处理和错误处理
- 统一的测试套件

详细更新日志请查看 `OPTIMIZATION_CHANGELOG.md`

## 📞 支持

- 📖 查看 `TEST_GUIDE.md` 了解详细测试说明
- 📋 查看 `API_DOCUMENTATION.md` 了解 API 详情
- 🔧 使用 `--debug` 模式获取详细错误信息

## 📄 许可证

本项目遵循相应的开源许可证。