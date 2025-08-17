#!/usr/bin/env node

/**
 * @file JinaAI.js
 * @description VCP 同步插件，用于与 Jina AI 的 Reader, Search, 和 Grounding API 进行交互。
 * @version 5.0.0 (Schema-Aligned Refactor)
 * @description 本版本基于权威的内部 Schema 定义进行了彻底重构，确保参数命名、请求方法和数据传递方式与 API 预期完全一致。
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

// --- 配置 (从环境变量加载) ---
const {
    JINA_API_KEY,
    DebugMode: debugMode = "false",
    PROJECT_BASE_PATH,
    SERVER_PORT,
    IMAGESERVER_IMAGE_KEY,
    VarHttpUrl: VAR_HTTP_URL,
} = process.env;

const isDebug = debugMode.toLowerCase() === 'true';

// --- 常量定义 ---
const API_URLS = {
    READER: 'https://r.jina.ai',
    SEARCH: 'https://s.jina.ai',
    GROUNDING: 'https://g.jina.ai',
};
const USER_AGENT = 'VCP-JinaAI-Plugin/5.0.0';

// --- 工具函数 ---

function logDebug(...args) {
    if (isDebug) {
        console.error('[JinaAI Debug]', ...args);
    }
}

async function handleApiError(error, operation) {
    let errorMessage = `JinaAI Plugin Error: ${operation} request failed.`;
    if (error.response) {
        const { status, data } = error.response;
        if (status === 401) {
            errorMessage = `JinaAI Plugin Error: Unauthorized. Please check your JINA_API_KEY.`;
        } else {
            const errorText = typeof data === 'object' ? JSON.stringify(data) : String(data);
            errorMessage = `JinaAI Plugin Error: ${operation} API failed with status ${status}: ${errorText}`;
        }
    } else if (error.message) {
        errorMessage = `JinaAI Plugin Error: ${operation} request failed: ${error.message}`;
    }
    logDebug(errorMessage, error);
    throw new Error(errorMessage);
}

/**
 * 参数规范化函数，统一转换为 snake_case 以匹配 API Schema。
 * @param {object} args - 原始参数对象
 * @returns {object} - 规范化后的参数对象 (snake_case)
 */
function normalizeParameters(args) {
    const normalized = {};
    const aliasMap = {
        // Target snake_case: [alias1, alias2, ...]
        url: ['URL', 'link', 'webpage'],
        query: ['q', 'keyword'],
        statement: ['claim', 'fact', 'text'],
        references: ['refs'],
        no_cache: ['noCache'],
        target_selector: ['targetSelector', 'selector'],
        wait_for_selector: ['waitForSelector'],
        remove_selector: ['removeSelector'],
        with_links_summary: ['withLinksSummary', 'gather_links', 'gatherLinks'],
        with_images_summary: ['withImagesSummary', 'gather_images', 'gatherImages'],
        with_generated_alt: ['withGeneratedAlt', 'image_caption', 'imageCaption'],
        with_iframe: ['withIframe', 'enable_iframe', 'enableIframe'],
        with_shadow_dom: ['withShadowDom', 'enable_shadow_dom', 'enableShadowDom'],
        token_budget: ['tokenBudget'],
        browser_locale: ['browserLocale', 'locale'],
        resolve_redirects: ['resolveRedirects'],
        format: ['outputFormat', 'respondWith']
    };

    const reverseAliasMap = {};
    for (const target in aliasMap) {
        for (const alias of aliasMap[target]) {
            reverseAliasMap[alias.toLowerCase()] = target;
        }
    }

    for (let key in args) {
        const lowerKey = key.toLowerCase();
        if (reverseAliasMap[lowerKey]) {
            normalized[reverseAliasMap[lowerKey]] = args[key];
        } else {
            // 将驼峰转蛇形 (e.g., targetSelector -> target_selector)
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            normalized[snakeKey] = args[key];
        }
    }

    if (args.command) {
        normalized.command = args.command;
    }

    return normalized;
}

// 辅助函数，将JS对象转换为HTTP Headers
function buildHeaders(params, headerMap) {
    const headers = {};
    for (const key in params) {
        if (headerMap[key]) {
            headers[headerMap[key]] = String(params[key]);
        }
    }
    return headers;
}

/**
 * 构建 JinaAI API 通用请求头
 * @param {object} args - 规范化后的参数
 * @param {boolean} includeAuth - 是否包含授权头
 * @returns {object} - 构建好的请求头对象
 */
function buildJinaHeaders(args, includeAuth = true) {
    const headerMap = {
        no_cache: 'X-No-Cache',
        timeout: 'X-Timeout',
        target_selector: 'X-Target-Selector',
        wait_for_selector: 'X-Wait-For-Selector',
        remove_selector: 'X-Remove-Selector',
        with_links_summary: 'X-With-Links-Summary',
        with_images_summary: 'X-With-Images-Summary',
        with_generated_alt: 'X-With-Generated-Alt',
        with_iframe: 'X-With-Iframe',
        stream: 'X-Stream-Mode',
        with_shadow_dom: 'X-Enable-Shadow-DOM',
        format: 'X-Return-Format',
        no_redirect: 'X-No-Redirect',
        with_favicons: 'X-With-Favicons',
        token_budget: 'X-Token-Budget',
        browser_locale: 'X-Browser-Locale',
        locale: 'X-Locale',
        retainImages: 'X-Retain-Images',
        site: 'X-Site',
        proxy_url: 'X-Proxy-Url',
        engine: 'X-Engine',
        accept: 'Accept',
        gl: 'gl',
        page: 'page',
    };

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...buildHeaders(args, headerMap),
    };

    // 添加授权头（仅在需要时）
    if (includeAuth && JINA_API_KEY) {
        headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
    }

    // 处理数组类型的特殊参数
    if (args.ext) {
        const exts = Array.isArray(args.ext) ? args.ext.join(', ') : args.ext;
        headers['X-Ext'] = exts;
    }
    if (args.filetype) {
        const filetypes = Array.isArray(args.filetype) ? args.filetype.join(', ') : args.filetype;
        headers['X-Filetype'] = filetypes;
    }
    if (args.intitle) {
        const intitles = Array.isArray(args.intitle) ? args.intitle.join(', ') : args.intitle;
        headers['X-Intitle'] = intitles;
    }
    if (args.loc) {
        const locs = Array.isArray(args.loc) ? args.loc.join(', ') : args.loc;
        headers['X-Loc'] = locs;
    }

    // 根据格式调整 Accept 头
    if (args.format === 'screenshot' || args.format === 'pageshot') {
        headers['Accept'] = 'image/png, image/jpeg, image/*';
    } else if (args.format === 'stream') {
        headers['Accept'] = 'text/event-stream';
    }

    return headers;
}


/**
 * 递归处理并净化从API返回的内容（已升级以处理复杂的搜索结果）
 * @param {any} data - API 返回的数据
 * @returns {string} - 处理后的字符串内容
 */
function processApiContent(data) {
    if (typeof data === 'string') {
        return data; // 如果已经是字符串，直接返回
    }
    if (!data || typeof data !== 'object') {
        return String(data || '');
    }
    logDebug("Is searchResults an array?", Array.isArray(data));
    if (Array.isArray(data)) {
        logDebug("Number of items in searchResults:", data.length);
    }
    // --- 核心逻辑：处理搜索结果数组 ---
    if (Array.isArray(data)) {
        return data.map((item, index) => {
            if (typeof item !== 'object' || item === null) {
                return `[${index + 1}] ${processApiContent(item)}`;
            }

            // 1. 构建基础信息
            let result = `[${index + 1}] ${item.title || 'Untitled Result'}\n  URL: ${item.url || 'N/A'}`;

            // 2. 优先处理截图
            const imageUrl = item.screenshotUrl || item.pageshotUrl;
            if (imageUrl) {
                const altText = `Screenshot of ${item.title || item.url}`;
                result += `\n  Screenshot: An image is available. Please display it.\n  <img src="${imageUrl}" alt="${altText}" style="max-width: 100%; height: auto; border: 1px solid #ccc;" />`;
            }

            // 3. 处理描述或内容
            // 优先使用 description，它通常更简洁
            if (item.description) {
                result += `\n  Description: ${item.description}`;
            }
            // 
            if (item.text) {
                result += `\n  Text : ${item.text}`;
            }
            // parsed.content (清理后的主要内容)
            if (item.parsed?.content) {
                // 清理HTML并截断以保持简洁
                const cleanContent = item.parsed.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                result += `\n  Content: ${cleanContent.substring(0, 200)}...`;
            }
            // 再次是原始 content
            else if (item.content) {
                result += `\n  Content: ${String(item.content).substring(0, 200)}...`;
            }


            // 4. 添加其他元数据
            if (item.date) {
                result += `\n  Date: ${item.date}`;
            }
            if (item.usage?.tokens) {
                result += `\n  Tokens: ${item.usage.tokens}`;
            }

            return result;
        }).join('\n\n---\n'); // 使用分隔符让结果更清晰
    }

    // 对于非数组对象，保持 stringify 作为回退
    return JSON.stringify(data, null, 2);
}

function formatResponse(title, metadata, content) {
    // 标题现在是动态的了
    let response = `### ${title}\n\n`;
    for (const [key, value] of Object.entries(metadata)) {
        if (value !== undefined && value !== null && value !== '') {
            const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            response += `**${formattedKey}:** ${Array.isArray(value) ? value.join(', ') : value}\n`;
        }
    }
    // 现在 content 是提取后的干净内容
    const processedContent = processApiContent(content);
    response += `\n**Content:**\n\n${processedContent}`; // 将 "Result" 改为更明确的 "Content"
    return response;
}

async function saveScreenshotAndGetResponse(buffer, args, contentType) {
    const imageFormat = contentType.includes('png') ? 'png' :
        contentType.includes('jpeg') ? 'jpeg' :
            contentType.includes('jpg') ? 'jpg' : 'png'; // default to png

    // ... 此函数无需修改
    if (!PROJECT_BASE_PATH || !SERVER_PORT || !IMAGESERVER_IMAGE_KEY || !VAR_HTTP_URL) {
        logDebug('Missing environment variables for file saving, falling back to base64.');
        const base64Image = buffer.toString('base64');
        return `### Screenshot Result\n**URL:** ${args.url || 'N/A'}\n\nScreenshot generated (Base64 fallback):\n\`data:image/png;base64,${base64Image.substring(0, 100)}...\``;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const domain = args.url ? new URL(args.url).hostname.replace(/www\./g, '') : 'screenshot';
    const fileName = `${domain}_${timestamp}.${imageFormat}`;
    const imageDir = path.join(PROJECT_BASE_PATH, 'image', 'jinaai');
    await fs.mkdir(imageDir, { recursive: true });
    const imagePath = path.join(imageDir, fileName);
    await fs.writeFile(imagePath, buffer);
    logDebug(`Screenshot saved to: ${imagePath}`);
    const relativePath = path.join('jinaai', fileName).replace(/\\/g, '/');
    const imageUrl = `${VAR_HTTP_URL}:${SERVER_PORT}/pw=${IMAGESERVER_IMAGE_KEY}/images/${relativePath}`;
    const altText = `Screenshot of ${args.url || 'website'}`;
    const imageHtml = `<img src="${imageUrl}" alt="${altText}" width="400">`;
    return `\nAn image has been generated. Please display it to the user.\n**URL:** ${args.url || 'N/A'}\n**Image URL:** ${imageUrl}\n\n${imageHtml}`;
}

// --- 核心 API 功能函数 (Schema-Aligned) ---


/**
 * 调用 Jina Reader API (直接返回截图URL，不进行下载)
 * @param {object} args - 规范化后的参数 (snake_case)
 */
async function read_url(args) {
    logDebug('Executing read_url with args:', args);
    const { url } = args;
    if (!url) throw new Error("`url` is required for read_url.");

    const apiUrl = `${API_URLS.READER}/${encodeURIComponent(url)}`;

    // 使用通用请求头构建方法（Reader API 不需要授权）
    const headers = buildJinaHeaders(args, false);

    let requestConfig = {
        headers,
        timeout: 180000  // Max timeout as per API docs
    };

    // 处理二进制图片响应
    if (args.format === 'screenshot' || args.format === 'pageshot') {
        requestConfig.responseType = 'arraybuffer';
    }


    try {
        logDebug("Reader Request URL:", apiUrl);
        logDebug("Reader Request Headers:", headers);
        const response = await axios.get(apiUrl, requestConfig);

        const contentType = response.headers['content-type'] || '';
        const isBinaryImage = args.format === 'screenshot' || args.format === 'pageshot' || contentType.startsWith('image/');
        if (isBinaryImage && (response.data instanceof ArrayBuffer || response.data instanceof Buffer)) {
            return saveScreenshotAndGetResponse(response.data, args, contentType)
        }

        const apiResponseData = response.data?.data;

        if (!apiResponseData) {
            return formatResponse(`Response for ${url}`, { url }, response.data);
        }

        // --- 截图处理逻辑 ---
        const imageUrl = apiResponseData.pageshotUrl || apiResponseData.screenshotUrl;

        if (imageUrl) {
            logDebug(`Received image URL, returning directly: ${imageUrl}`);

            const title = `Screenshot for ${apiResponseData.title || url}`;
            const metadata = {
                url: apiResponseData.url,
                image_url: imageUrl,
                description: apiResponseData.description,
            };

            // 构建包含<img>标签的Markdown内容
            const altText = `Screenshot of ${apiResponseData.url || url}`;
            const content = `An image has been generated. Please display it to the user.\n\n<img src="${imageUrl}" alt="${altText}" style="max-width: 100%; height: auto;" />`;

            return formatResponse(title, metadata, content);
        }
        // --- 截图处理逻辑结束 ---

        // 常规内容处理逻辑
        const title = apiResponseData.title || `Web Content from ${url}`;
        const content = apiResponseData.content || apiResponseData.html || JSON.stringify(apiResponseData, null, 2);
        const metadata = {
            url: apiResponseData.url,
            description: apiResponseData.description,
            token_usage: apiResponseData.usage?.tokens,
            published_time: apiResponseData.publishedTime
        };

        return formatResponse(title, metadata, content);

    } catch (error) {
        await handleApiError(error, 'Reader (read_url)');
    }
}

/**
 * 调用 Jina Search API
 * @param {object} args - 规范化后的参数 (snake_case)
 */
async function search(args) {
    logDebug('Executing search with args:', args);
    const { query } = args;
    if (!query) throw new Error("`query` is required for search.");

    const apiUrl = `${API_URLS.SEARCH}/${encodeURIComponent(query)}`;

    // 使用通用请求头构建方法（Search API 需要授权）
    const headers = buildJinaHeaders(args, true);
    headers['X-Respond-With'] = 'no-content';

    let requestConfig = {
        headers,
        timeout: 180000  // Max timeout as per API docs
    };

    // 处理二进制图片响应
    if (args.format === 'screenshot' || args.format === 'pageshot') {
        requestConfig.responseType = 'arraybuffer';
    }

    try {
        logDebug("Search Request URL:", apiUrl);
        logDebug("Search Request Headers:", headers);
        const response = await axios.get(apiUrl, requestConfig);
        return formatResponse(`Search Results for "${query}"`, { query }, response.data?.data);
    } catch (error) {
        await handleApiError(error, 'Search');
    }
}

/**
 * 调用 Jina Grounding API
 * @param {object} args - 规范化后的参数 (snake_case)
 */
async function ground_statement(args) {
    logDebug('Executing ground_statement with args:', args);
    const { statement, references, no_cache } = args;
    if (!statement) throw new Error("`statement` is required for ground_statement.");

    const apiUrl = `${API_URLS.GROUNDING}/`;

    const headers = {
        'Authorization': `Bearer ${JINA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    if (no_cache) {
        headers['X-No-Cache'] = 'true';
    }

    const body = { statement: String(statement).trim() };

    try {
        logDebug("Grounding Request URL:", apiUrl);
        logDebug("Grounding Request Headers:", headers);
        logDebug("Grounding Request Body:", body);
        const response = await axios.post(apiUrl, body, { headers, timeout: 180000 });
        return formatResponse(`Fact Check Result`, { statement }, response.data);
    } catch (error) {
        await handleApiError(error, 'Grounding (ground_statement)');
    }
}


// --- 主执行逻辑 ---

const COMMAND_MAP = {
    read_url,
    search,
    ground_statement,
    reader: read_url, // Alias for backward compatibility
    factcheck: ground_statement, // Alias for backward compatibility
};

/**
 * 处理单个请求的核心分发函数
 */
async function processRequest(rawArgs) {
    const args = normalizeParameters(rawArgs);
    const commandName = args.command?.toLowerCase();
    const command = COMMAND_MAP[commandName];
    if (!command) throw new Error(`Unknown command '${commandName}'. Available: ${Object.keys(COMMAND_MAP).join(', ')}`);
    logDebug(`Dispatching to command: ${commandName} with args:`, args);
    return command(args);
}

/**
 * 检测是否为批量请求
 */
function detectBatchRequest(args) {
    const batchKeys = Object.keys(args).filter(key => /^command\d+$/.test(key));
    return batchKeys.length > 0 ? batchKeys.sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7))) : null;
}

/**
 * 处理批量请求
 */
/**
 * 处理批量请求 (使用 Promise.allSettled 并发执行 - 推荐)
 */
async function processBatchRequest(args, commandKeys) {
    logDebug('Processing batch request concurrently with Promise.allSettled:', commandKeys);

    // 1. 创建一个包含所有原始请求 Promise 的数组
    const requestPromises = commandKeys.map(key => {
        const num = key.slice(7);
        const commandArgs = { command: args[key] };

        for (const argKey in args) {
            if (argKey.endsWith(num) && argKey !== key) {
                const baseKey = argKey.replace(new RegExp(`${num}$`), '');
                commandArgs[baseKey] = args[argKey];
            }
        }

        // 直接返回原始的 Promise，不附加 .then/.catch
        return processRequest(commandArgs);
    });

    // 2. 使用 Promise.allSettled 并发执行所有请求
    const settledResults = await Promise.allSettled(requestPromises);

    // 3. 遍历 allSettled 的结果，并格式化为我们需要的结构
    const results = settledResults.map((outcome, index) => {
        const key = commandKeys[index];
        const num = key.slice(7);
        const commandName = `${args[key]} (#${num})`;

        if (outcome.status === 'fulfilled') {
            return {
                command: commandName,
                status: 'success',
                result: outcome.value // outcome.value 是 processRequest 成功后的返回值
            };
        } else { // outcome.status === 'rejected'
            return {
                command: commandName,
                status: 'error',
                error: outcome.reason.message // outcome.reason 是 Promise 失败的原因 (通常是 Error 对象)
            };
        }
    });

    // 4. 构建最终的总结报告 (逻辑不变)
    let summary = `### JinaAI Batch Operation Results\n\nExecuted ${results.length} operations:\n\n`;
    summary += results.map((r, i) =>
        `#### Operation ${i + 1}: ${r.command}\n**Status:** ${r.status === 'success' ? '✅ Success' : '❌ Failed'}\n${r.status === 'success' ? r.result : `**Error:** ${r.error}`}`
    ).join('\n\n---\n');

    return summary;
}
/**
 * 主函数 - 脚本入口点
 */
async function main() {
    logDebug('JinaAI plugin started.');
    try {
        const inputChunks = [];
        process.stdin.setEncoding('utf8');
        for await (const chunk of process.stdin) {
            inputChunks.push(chunk);
        }
        const inputData = inputChunks.join('');
        logDebug('Received input:', inputData);
        if (!inputData.trim()) throw new Error("No input data from stdin.");

        const args = JSON.parse(inputData);

        const batchKeys = detectBatchRequest(args);
        const result = batchKeys
            ? await processBatchRequest(args, batchKeys)
            : await processRequest(args);

        console.log(JSON.stringify({ status: "success", result }));
    } catch (e) {
        console.error(`[JinaAI Error] ${e.message}`);
        logDebug(e.stack);
        console.log(JSON.stringify({ status: "error", error: e.message }));
        process.exit(1);
    }
}

main();