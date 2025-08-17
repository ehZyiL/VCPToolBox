# JinaAI Plugin

基于 Schema 重构的 Jina AI 多功能插件，提供网页内容提取、智能搜索和事实验证功能。支持截图、多格式输出、高级参数配置和批量处理。

## 🚀 核心功能

### 📖 Reader API - 智能网页内容提取
- **网页内容提取**: 支持任意网页 URL 的内容提取和格式转换
- **网页截图**: 支持首屏截图 (screenshot) 和全页截图 (pageshot)
- **智能选择器**: 支持 CSS 选择器精确提取和过滤特定内容
- **多格式输出**: markdown、html、text、json 等多种格式
- **高级浏览器控制**: 超时设置、等待元素加载、移除特定元素等
- **内容优化**: 自动清理和格式化网页内容，提供结构化输出

### 🔍 Search API - 智能网络搜索
- **高级搜索**: 支持复杂搜索查询和操作符
- **精确过滤**: 按域名、文件类型、标题关键词等过滤
- **地理定位**: 支持国家/地区和语言设置
- **搜索结果截图**: 可获取搜索结果页面截图
- **多引擎支持**: 支持不同搜索引擎选择

### ✅ Grounding API - 事实验证
- **智能验证**: 基于权威数据源验证事实陈述
- **可信度评分**: 提供详细的验证结果和置信度
- **参考来源**: 提供支持验证结果的参考资料

### 🔧 高级特性
- **参数规范化**: 智能参数别名和类型转换
- **批量串行调用**: 支持一次请求执行多个操作
- **错误隔离**: 批量操作中单个失败不影响其他操作
- **智能内容处理**: 自动清理和格式化返回内容
- **调试支持**: 完整的调试模式和错误追踪

## ⚠️ 功能说明

本插件专注于处理网页 URL，通过 Jina AI 的 Reader、Search 和 Grounding API 提供以下核心功能：

- **Reader API**: 仅支持网页 URL 的内容提取，不支持直接处理 HTML 字符串
- **Search API**: 提供智能网络搜索功能
- **Grounding API**: 提供事实验证功能

如需处理本地 HTML 内容或字符串，请考虑使用其他专门的 HTML 处理工具。

## ⚙️ 配置和安装

### 1. API 密钥配置

```bash
# 复制配置示例文件
cp config.env.example config.env

# 编辑配置文件，填入你的 API 密钥
# 从 https://jina.ai/?sui=apikey 获取免费 API 密钥
```

### 2. 配置文件说明

```env
# config.env - 主要配置
JINA_API_KEY=your_api_key_here

# 调试模式（可选）
DebugMode=false  # 设置为 true 启用详细调试日志

# 图片服务器配置（用于截图功能，可选）
PROJECT_BASE_PATH=/path/to/project
SERVER_PORT=3000
IMAGESERVER_IMAGE_KEY=your_image_key
VarHttpUrl=http://localhost
```

### 3. API 认证说明

- **Reader API**: 不强制要求 API 密钥，但使用密钥可获得更高的请求限制和性能
- **Search API**: 必须提供有效的 API 密钥
- **Grounding API**: 必须提供有效的 API 密钥

## 🧪 测试套件

JinaAITest.js 提供了完整的测试套件，覆盖所有功能和参数组合。

### 快速测试

```bash
# 运行所有测试
node JinaAITest.js

# 快速测试模式（精选关键测试）
node JinaAITest.js --quick

# 显示帮助信息
node JinaAITest.js --help
```

### 分类测试

```bash
# 基本功能测试
node JinaAITest.js --category basic

# Reader API 功能测试
node JinaAITest.js --category reader

# Search API 功能测试
node JinaAITest.js --category search

# 事实验证功能测试
node JinaAITest.js --category factcheck

# 高级功能测试（批量调用、错误处理等）
node JinaAITest.js --category advanced
```

### 调试和报告

```bash
# 启用调试模式（显示详细信息）
node JinaAITest.js --debug

# 生成详细测试报告
node JinaAITest.js --report
```

### 测试覆盖范围

- ✅ **基本功能**: Reader、Search、Grounding 基础调用
- ✅ **高级参数**: 所有 API 的高级参数组合测试
- ✅ **参数规范化**: 别名转换、类型转换测试
- ✅ **网页处理**: URL 内容提取和选择器过滤测试
- ✅ **批量调用**: 多操作串行执行测试
- ✅ **错误处理**: 异常情况和错误恢复测试
- ✅ **截图功能**: 网页截图和图片处理测试

## 📖 使用示例

### 📄 Reader API - 网页内容提取

#### 基本网页提取
```json
{
  "command": "read_url",
  "url": "https://example.com",
  "format": "markdown"
}
```

#### 网页截图功能
```json
{
  "command": "read_url",
  "url": "https://example.com",
  "format": "screenshot"    // 首屏截图
}
```

```json
{
  "command": "read_url", 
  "url": "https://example.com",
  "format": "pageshot"     // 全页截图
}
```



#### 高级选择器和过滤
```json
{
  "command": "read_url",
  "url": "https://example.com",
  "target_selector": ".main-content",     // 只提取主要内容
  "remove_selector": "nav, footer, .ads", // 移除导航、页脚和广告
  "wait_for_selector": ".dynamic-content", // 等待动态内容加载
  "timeout": 30,
  "token_budget": 50000
}
```

### 🔍 Search API - 智能搜索

#### 基本搜索
```json
{
  "command": "search",
  "query": "Python机器学习教程"
}
```

#### 高级搜索过滤
```json
{
  "command": "search",
  "query": "深度学习研究",
  "site": ["github.com", "arxiv.org"],    // 限制搜索域名
  "filetype": ["pdf"],                    // 只搜索PDF文件
  "gl": "us",                            // 美国地区结果
  "hl": "en"                             // 英语界面
}
```

#### 搜索结果截图
```json
{
  "command": "search",
  "query": "JavaScript框架对比",
  "format": "screenshot"                  // 获取搜索结果页截图
}
```

### ✅ Grounding API - 事实验证

#### 基本事实验证
```json
{
  "command": "ground_statement",
  "statement": "地球围绕太阳公转，一年约365.25天"
}
```

#### 带缓存控制的验证
```json
{
  "command": "ground_statement", 
  "statement": "人工智能概念首次提出于1956年达特茅斯会议",
  "no_cache": true                       // 强制获取最新验证结果
}
```

## 🔄 批量串行调用

JinaAI 插件支持在一次请求中执行多个操作，使用 Promise.allSettled 实现并发执行，提高处理效率。

### 批量调用语法

使用数字后缀区分不同的命令和参数：
- 命令格式：`command1`, `command2`, `command3`...
- 参数格式：`url1`, `query2`, `statement3`...
- 执行方式：并发执行，错误隔离

### 实用批量操作示例

#### 研究工作流（搜索 + 提取 + 验证）
```json
{
  "command1": "search",
  "query1": "人工智能发展历史",
  "site1": "wikipedia.org",
  "command2": "read_url", 
  "url2": "https://en.wikipedia.org/wiki/Artificial_intelligence",
  "format2": "markdown",
  "command3": "ground_statement",
  "statement3": "人工智能概念首次提出于1956年达特茅斯会议"
}
```

#### 多网页内容对比分析
```json
{
  "command1": "read_url",
  "url1": "https://site1.com/article",
  "target_selector1": ".content",
  "format1": "text",
  "command2": "read_url",
  "url2": "https://site2.com/article", 
  "target_selector2": ".main",
  "format2": "text",
  "command3": "read_url",
  "url3": "https://site3.com/article",
  "target_selector3": "article",
  "format3": "text"
}
```

#### 截图 + 内容提取组合
```json
{
  "command1": "read_url",
  "url1": "https://example.com",
  "format1": "pageshot",
  "command2": "read_url",
  "url2": "https://example.com",
  "format2": "markdown",
  "remove_selector2": "nav, footer, .ads",
  "token_budget2": 30000
}
```

#### 多网页内容聚合分析
```json
{
  "command1": "read_url",
  "url1": "https://news.site1.com/article",
  "target_selector1": ".article-content",
  "format1": "text",
  "command2": "read_url",
  "url2": "https://blog.site2.com/post",
  "target_selector2": ".post-body",
  "format2": "text",
  "command3": "ground_statement",
  "statement3": "基于上述内容的关键事实陈述"
}
```



### 批量操作特性

- **并发执行**: 使用 Promise.allSettled 提高执行效率
- **错误隔离**: 单个操作失败不影响其他操作
- **结果汇总**: 统一格式返回所有操作结果
- **状态标识**: 清晰标识每个操作的成功/失败状态
- **调试友好**: 详细的错误信息和执行状态

## 🔧 参数系统

### 智能参数规范化

插件内置智能参数规范化系统，支持多种参数别名和自动类型转换：

#### 参数别名映射
```javascript
// URL 相关
url ← URL, link, webpage

// 查询相关  
query ← q, keyword
statement ← claim, fact, text

// 格式相关
format ← outputFormat, respondWith
no_cache ← noCache

// 选择器相关
target_selector ← targetSelector, selector
wait_for_selector ← waitForSelector
remove_selector ← removeSelector

// 高级功能
with_links_summary ← withLinksSummary, gather_links, gatherLinks
with_images_summary ← withImagesSummary, gather_images, gatherImages
with_generated_alt ← withGeneratedAlt, image_caption, imageCaption
token_budget ← tokenBudget
browser_locale ← browserLocale, locale
```

#### 自动类型转换
- **字符串布尔值**: `"true"` → `true`, `"false"` → `false`
- **字符串数字**: `"30"` → `30`, `"50000"` → `50000`
- **逗号分隔字符串**: `"a,b,c"` → `["a","b","c"]`
- **驼峰转蛇形**: `targetSelector` → `target_selector`

### 支持的主要参数

#### Reader API 参数
- `url` (string): 目标网页URL
- `format` (string): 输出格式 (markdown, html, text, screenshot, pageshot)
- `target_selector` (string): CSS选择器，提取特定内容
- `remove_selector` (string): CSS选择器，移除特定元素
- `wait_for_selector` (string): 等待特定元素加载
- `with_generated_alt` (boolean): 生成图片alt描述
- `token_budget` (number): Token预算限制
- `timeout` (number): 超时时间（秒）
- `no_cache` (boolean): 禁用缓存

#### Search API 参数
- `query` (string): 搜索查询词
- `site` (string/array): 限制搜索域名
- `filetype` (string/array): 文件类型过滤
- `gl` (string): 国家代码 (us, cn, uk等)
- `hl` (string): 界面语言 (en, zh, ja等)
- `format` (string): 输出格式 (default, screenshot)

#### Grounding API 参数
- `statement` (string): 需要验证的陈述
- `no_cache` (boolean): 禁用缓存

## 📁 项目结构

```
Plugin/JinaAI/
├── JinaAI.js                 # 主插件文件 (v5.0.0)
├── JinaAITest.js            # 统一测试套件
├── plugin-manifest.json     # 插件清单配置
├── config.env.example       # 配置文件示例
├── config.env              # 实际配置文件（需创建）
├── package.json            # Node.js 依赖配置
├── debug-input.json        # 调试输入示例
└── README.md               # 本文档
```

## 🚀 版本信息

**当前版本**: v5.0.0 (Schema-Aligned Refactor)

### 主要特性
- 基于权威内部 Schema 定义的彻底重构
- 参数命名、请求方法和数据传递方式与 API 完全一致
- 使用 Promise.allSettled 实现高效并发批量处理
- 智能参数规范化和别名支持系统
- 增强的错误处理和调试支持
- 完整的截图功能和图片处理
- 统一的响应格式处理

### 技术亮点
- **Schema 对齐**: 确保与 Jina AI API 规范完全一致
- **并发处理**: 批量操作使用并发执行提高效率
- **智能转换**: 自动处理参数别名和类型转换
- **错误隔离**: 批量操作中的错误不会影响其他操作
- **调试友好**: 完整的调试模式和错误追踪

## 📞 技术支持

- 🐛 **调试模式**: 设置 `DebugMode=true` 获取详细日志
- 🧪 **测试套件**: 使用 `node JinaAITest.js` 验证功能
- 📊 **测试报告**: 使用 `--report` 参数生成详细报告
- 🔍 **问题排查**: 检查 config.env 配置和 API 密钥有效性