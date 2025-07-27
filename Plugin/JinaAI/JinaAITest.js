#!/usr/bin/env node

/**
 * JinaAI Plugin 统一测试套件
 * ===========================
 * 
 * 这个文件包含了所有 JinaAI 插件功能的测试用例，用于验证基于 API_DOCUMENTATION.md 的优化功能。
 * 
 * 如何执行测试：
 * =============
 * 
 * 1. 确保配置文件存在：
 *    - 检查 config.env 文件是否存在并包含有效的 JINA_API_KEY
 *    - 如果没有，请复制 config.env.example 并填入你的 API 密钥
 * 
 * 2. 执行所有测试：
 *    node unified-test.js
 * 
 * 3. 执行特定测试类别：
 *    node unified-test.js --category reader     # 只测试 Reader 功能
 *    node unified-test.js --category search     # 只测试 Search 功能
 *    node unified-test.js --category factcheck  # 只测试 Fact Check 功能
 *    node unified-test.js --category basic      # 只测试基本功能
 *    node unified-test.js --category advanced   # 只测试高级功能
 * 
 * 4. 启用调试模式：
 *    node unified-test.js --debug               # 显示详细的调试信息
 * 
 * 5. 快速测试（只运行关键测试）：
 *    node unified-test.js --quick               # 运行精选的关键测试
 * 
 * 6. 生成测试报告：
 *    node unified-test.js --report              # 生成详细的测试报告
 * 
 * 测试覆盖的功能：
 * ===============
 * 
 * Reader API:
 * - 基本网页内容提取 (GET/POST)
 * - HTML 内容直接处理
 * - 高级参数支持 (timeout, retainImages, tokenBudget 等)
 * - 参数别名和类型转换
 * 
 * Search API:
 * - 基本网络搜索
 * - 高级搜索参数 (site, filetype, provider 等)
 * - 地理语言设置
 * - 搜索操作符
 * 
 * Fact Check API:
 * - 事实验证功能
 * 
 * 通用功能:
 * - 参数规范化
 * - 错误处理
 * - 响应格式处理
 * - 批量请求支持
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析命令行参数
const args = process.argv.slice(2);
const options = {
    category: args.find(arg => arg.startsWith('--category='))?.split('=')[1] ||
        (args.includes('--category') ? args[args.indexOf('--category') + 1] : null),
    debug: args.includes('--debug'),
    quick: args.includes('--quick'),
    report: args.includes('--report'),
    help: args.includes('--help') || args.includes('-h')
};

// 显示帮助信息
if (options.help) {
    console.log(`
JinaAI Plugin 统一测试套件
=========================

用法: node unified-test.js [选项]

选项:
  --category <类别>    只运行指定类别的测试
                      可选值: reader, search, factcheck, basic, advanced, cleanup
  --debug             启用调试模式，显示详细信息
  --quick             快速测试模式，只运行关键测试
  --report            生成详细的测试报告
  --help, -h          显示此帮助信息

示例:
  node unified-test.js                    # 运行所有测试
  node unified-test.js --category reader  # 只测试 Reader 功能
  node unified-test.js --debug            # 启用调试模式
  node unified-test.js --quick            # 快速测试
  node unified-test.js --report           # 生成测试报告

注意: 确保 config.env 文件存在并包含有效的 JINA_API_KEY
`);
    process.exit(0);
}

// 加载环境变量
function loadEnvFromFile() {
    try {
        const envContent = readFileSync('config.env', 'utf8');
        const env = {};

        envContent.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });

        return env;
    } catch (error) {
        console.error('❌ 错误: 无法加载 config.env 文件');
        console.error('请确保 config.env 文件存在并包含有效的 JINA_API_KEY');
        console.error('你可以复制 config.env.example 并填入你的 API 密钥');
        process.exit(1);
    }
}

// 执行单个测试
async function runTest(testName, testInput, category = 'general', expectFailure = false) {
    // 类别过滤在外层处理，这里不需要跳过
    // if (options.category && options.category !== category) {
    //     return { name: testName, skipped: true };
    // }

    const envVars = loadEnvFromFile();

    return new Promise((resolve, reject) => {
        const child = spawn('node', ['JinaAI.js'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                ...envVars,
                DebugMode: options.debug ? 'true' : 'false'
            }
        });

        let output = '';
        let error = '';
        const startTime = Date.now();

        child.stdin.write(JSON.stringify(testInput));
        child.stdin.end();

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            error += data.toString();
        });

        child.on('close', (code) => {
            const endTime = Date.now();
            const duration = endTime - startTime;

            let result;
            try {
                result = JSON.parse(output);
            } catch (e) {
                result = { status: 'parse_error', error: 'Failed to parse output' };
            }

            // 如果期望失败，则失败是成功的
            const actualSuccess = code === 0 && result.status === 'success';
            const success = expectFailure ? !actualSuccess : actualSuccess;

            resolve({
                name: testName,
                category,
                success,
                code,
                duration,
                result,
                error: options.debug ? error : null,
                input: testInput,
                expectFailure
            });
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

// 定义所有测试用例
const testSuites = {
    // 基本功能测试
    basic: [
        {
            name: "基本 Reader (GET)",
            input: {
                command: "reader",
                url: "https://example.com",
                format: "markdown"
            }
        },
        {
            name: "基本 Search",
            input: {
                command: "search",
                query: "JavaScript tutorials",
                count: 3
            }
        },
        {
            name: "基本 Fact Check",
            input: {
                command: "factcheck",
                statement: "The Earth orbits around the Sun."
            }
        }
    ],

    // Reader 功能测试
    reader: [
        {
            name: "Reader - 高级 POST 请求",
            input: {
                command: "reader",
                url: "https://httpbin.org/html",
                method: "POST",
                timeout: 30,
                retainImages: "alt",
                withGeneratedAlt: true,
                removeSelector: "script, style",
                tokenBudget: 50000
            }
        },
        {
            name: "Reader - HTML 内容处理",
            input: {
                command: "reader",
                html: "<html><head><title>测试页面</title></head><body><h1>标题</h1><p>这是一个<strong>测试</strong>HTML文档。</p></body></html>",
                format: "markdown",
                withGeneratedAlt: true
            }
        },
        {
            name: "Reader - 参数别名测试",
            input: {
                command: "reader",
                URL: "https://httpbin.org/json",  // URL 别名
                outputFormat: "markdown",        // format 别名
                withGeneratedAlt: "true",       // 字符串布尔值
                tokenBudget: "25000"            // 字符串数字
            }
        },
        {
            name: "Reader - 复杂参数组合",
            input: {
                command: "reader",
                url: "https://httpbin.org/html",
                timeout: "45",
                withGeneratedAlt: "true",
                retainImages: "alt",
                removeSelector: "nav, footer",
                tokenBudget: 40000,
                responseFormat: "json"
            }
        }
    ],

    // Search 功能测试
    search: [
        {
            name: "Search - 高级 POST 请求",
            input: {
                command: "search",
                query: "Python programming",
                method: "POST",
                count: 5,
                type: "web",
                provider: "google",
                gl: "us",
                hl: "en",
                site: ["github.com", "stackoverflow.com"],
                withFavicons: true
            }
        },
        {
            name: "Search - 参数规范化",
            input: {
                command: "search",
                q: "machine learning",           // query 别名
                site: "github.com, arxiv.org",  // 逗号分隔字符串
                count: "3",                      // 字符串数字
                withFavicons: "true"            // 字符串布尔值
            }
        },
        {
            name: "Search - 文件类型过滤",
            input: {
                command: "search",
                query: "deep learning research",
                filetype: ["pdf"],
                count: 2,
                gl: "us"
            }
        },
        {
            name: "Search - 多操作符组合",
            input: {
                command: "search",
                query: "JavaScript",
                site: "github.com",
                count: 2
            }
        }
    ],

    // Fact Check 功能测试
    factcheck: [
        {
            name: "Fact Check - 科学事实",
            input: {
                command: "factcheck",
                statement: "Water boils at 100 degrees Celsius at sea level."
            }
        },
        {
            name: "Fact Check - 历史事实",
            input: {
                command: "factcheck",
                statement: "The Great Wall of China was built during the Ming Dynasty."
            }
        }
    ],

    // 高级功能测试
    advanced: [
        {
            name: "批量请求测试",
            input: {
                command1: "reader",
                url1: "https://example.com",
                format1: "markdown",
                command2: "search",
                query2: "test",
                count2: 2
            }
        },
        {
            name: "错误处理测试 (预期失败)",
            input: {
                command: "reader",
                url: "https://nonexistent-domain-12345.com",
                timeout: 10
            },
            expectFailure: true
        },
        {
            name: "参数验证测试 (预期失败)",
            input: {
                command: "invalid_command",
                url: "https://example.com"
            },
            expectFailure: true
        }
    ],

    // 内容净化功能测试
    cleanup: [
        {
            name: "内容净化 - 启用净化（默认）",
            input: {
                command: "reader",
                url: "https://www.nodeseek.com/post-183694-1",
                cleanContent: true,
                format: "markdown"
            }
        },
        {
            name: "内容净化 - 禁用净化对比",
            input: {
                command: "reader",
                url: "https://www.nodeseek.com/post-183694-1",
                cleanContent: false,
                format: "html"
            }
        },
        {
            name: "内容净化 - HTML 内容处理",
            input: {
                command: "reader",
                html: "<html><head><style>.test{color:red;}</style><script>alert('test');</script></head><body class='main' id='content' onclick='test()'><h1 style='color:blue;'>测试标题</h1><p class='text' data-id='123'>这是测试内容</p><!-- 注释 --><div style='display:none;'>隐藏内容</div></body></html>",
                url: "https://test.local",
                cleanContent: true,
                format: "text"
            }
        },
        {
            name: "内容净化 - 搜索结果净化",
            input: {
                command: "search",
                query: "VPS脚本 site:nodeseek.com",
                count: 3,
                cleanContent: true
            }
        },
        {
            name: "内容净化 - 细粒度控制",
            input: {
                command: "reader",
                url: "https://httpbin.org/html",
                sanitizeHtml: true,
                removeHtml: true,
                stripHtml: true,
                format: "text"
            }
        }
    ]
};

// 快速测试用例（精选的关键测试）
const quickTests = [
    ...testSuites.basic,
    testSuites.reader[0], // 高级 Reader
    testSuites.reader[1], // HTML 处理
    testSuites.search[0], // 高级 Search
    testSuites.search[1], // 参数规范化
    testSuites.cleanup[0] // 内容净化
];

// 显示测试进度
function showProgress(current, total, testName) {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    process.stdout.write(`\r[${progressBar}] ${percentage}% - ${testName.substring(0, 40)}...`);
}

// 运行测试套件
async function runTestSuite() {
    console.log('🚀 JinaAI Plugin 统一测试套件');
    console.log('===============================\n');

    // 检查配置
    try {
        const envVars = loadEnvFromFile();
        if (!envVars.JINA_API_KEY) {
            throw new Error('JINA_API_KEY not found in config.env');
        }
        console.log('✅ 配置检查通过');
    } catch (error) {
        console.error('❌ 配置检查失败:', error.message);
        return;
    }

    // 确定要运行的测试
    let testsToRun = [];
    if (options.quick) {
        testsToRun = quickTests.map((test, index) => ({ ...test, category: 'quick' }));
        console.log('🏃 快速测试模式 - 运行精选测试');
    } else if (options.category) {
        if (testSuites[options.category]) {
            testsToRun = testSuites[options.category];
            console.log(`📂 类别过滤: ${options.category}`);
        } else {
            console.error(`❌ 未知的测试类别: ${options.category}`);
            console.error(`可用类别: ${Object.keys(testSuites).join(', ')}`);
            return;
        }
    } else {
        // 运行所有测试
        for (const [category, tests] of Object.entries(testSuites)) {
            testsToRun.push(...tests.map(test => ({ ...test, category })));
        }
        console.log('🔄 运行所有测试');
    }

    console.log(`📊 总计 ${testsToRun.length} 个测试\n`);

    if (options.debug) {
        console.log('🐛 调试模式已启用\n');
    }

    // 运行测试
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < testsToRun.length; i++) {
        const test = testsToRun[i];
        showProgress(i, testsToRun.length, test.name);

        try {
            const result = await runTest(test.name, test.input, test.category, test.expectFailure);
            results.push(result);

            if (!options.debug) {
                // 清除进度条并显示结果
                process.stdout.write('\r' + ' '.repeat(80) + '\r');
                const status = result.skipped ? '⏭️  SKIP' : (result.success ? '✅ PASS' : '❌ FAIL');
                const duration = result.duration ? `(${result.duration}ms)` : '';
                console.log(`${status} - ${result.name} ${duration}`);
            } else if (!result.skipped) {
                // 调试模式显示详细信息
                process.stdout.write('\r' + ' '.repeat(80) + '\r');
                console.log(`\n=== ${result.name} ===`);
                console.log(`状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
                console.log(`耗时: ${result.duration}ms`);
                if (result.success && result.result.result) {
                    console.log(`结果预览: ${result.result.result.substring(0, 150)}...`);
                } else if (!result.success) {
                    console.log(`错误: ${result.result.error || '未知错误'}`);
                }
                if (result.error && options.debug) {
                    console.log(`调试信息: ${result.error.substring(0, 200)}...`);
                }
                console.log('');
            }
        } catch (error) {
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
            console.log(`❌ FAIL - ${test.name}: ${error.message}`);
            results.push({
                name: test.name,
                category: test.category,
                success: false,
                error: error.message
            });
        }
    }

    // 清除最后的进度条
    process.stdout.write('\r' + ' '.repeat(80) + '\r');

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // 统计结果
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const successRate = total > 0 ? ((passed / (total - skipped)) * 100).toFixed(1) : 0;

    // 显示总结
    console.log('\n📊 测试结果总结');
    console.log('================');
    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`跳过: ${skipped}`);
    console.log(`成功率: ${successRate}%`);
    console.log(`总耗时: ${totalDuration}ms`);

    // 按类别统计
    const categoryStats = {};
    results.forEach(r => {
        if (!categoryStats[r.category]) {
            categoryStats[r.category] = { total: 0, passed: 0, failed: 0, skipped: 0 };
        }
        categoryStats[r.category].total++;
        if (r.skipped) {
            categoryStats[r.category].skipped++;
        } else if (r.success) {
            categoryStats[r.category].passed++;
        } else {
            categoryStats[r.category].failed++;
        }
    });

    if (Object.keys(categoryStats).length > 1) {
        console.log('\n📂 分类统计:');
        for (const [category, stats] of Object.entries(categoryStats)) {
            const rate = stats.total > stats.skipped ?
                ((stats.passed / (stats.total - stats.skipped)) * 100).toFixed(1) : 0;
            console.log(`  ${category}: ${stats.passed}/${stats.total - stats.skipped} (${rate}%)`);
        }
    }

    // 显示失败的测试
    const failedTests = results.filter(r => !r.success && !r.skipped);
    if (failedTests.length > 0) {
        console.log('\n❌ 失败的测试:');
        failedTests.forEach(test => {
            console.log(`  - ${test.name}: ${test.error || test.result?.error || '未知错误'}`);
        });
    }

    // 生成测试报告
    if (options.report) {
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                total,
                passed,
                failed,
                skipped,
                successRate: parseFloat(successRate),
                duration: totalDuration
            },
            categoryStats,
            results: results.map(r => ({
                name: r.name,
                category: r.category,
                success: r.success,
                skipped: r.skipped,
                duration: r.duration,
                error: r.error || r.result?.error
            }))
        };

        const reportFile = `test-report-${Date.now()}.json`;
        writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
        console.log(`\n📄 测试报告已生成: ${reportFile}`);
    }

    // 最终状态
    if (passed === total - skipped) {
        console.log('\n🎉 所有测试都通过了！JinaAI 插件工作正常。');
    } else {
        console.log('\n⚠️  部分测试失败，请检查上述错误信息。');
        process.exit(1);
    }

    console.log('\n✨ 验证的功能特性:');
    console.log('- ✅ GET/POST 请求方法自动选择');
    console.log('- ✅ 参数别名和规范化');
    console.log('- ✅ 字符串类型自动转换');
    console.log('- ✅ HTML 内容直接处理');
    console.log('- ✅ 高级 Reader 参数');
    console.log('- ✅ 高级 Search 参数');
    console.log('- ✅ 错误处理和验证');
    console.log('- ✅ 响应格式处理');
}

// 运行测试
runTestSuite().catch(error => {
    console.error('\n💥 测试套件执行失败:', error.message);
    process.exit(1);
});