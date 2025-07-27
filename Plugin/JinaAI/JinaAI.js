#!/usr/bin/env node
import axios from "axios";
import fs from 'fs/promises';
import path from 'path';

// --- Configuration (from environment variables set by Plugin.js) ---
const JINA_API_KEY = process.env.JINA_API_KEY;
const debugMode = (process.env.DebugMode || "false").toLowerCase() === "true"; // Debug mode
const JINA_READER_USE_TOKEN = (process.env.JINA_READER_USE_TOKEN || "false").toLowerCase() === "true"; // Reader API token usage
const PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH;
const SERVER_PORT = process.env.SERVER_PORT;
const IMAGESERVER_IMAGE_KEY = process.env.IMAGESERVER_IMAGE_KEY;
const VAR_HTTP_URL = process.env.VarHttpUrl;

// Debug logging function - outputs to stderr for VCP compatibility
function FORCE_LOG(...args) {
    console.error(...args); // 强制日志输出到 stderr
}

// Unified error handling function with enhanced error codes
function handleApiError(error, operation) {
    if (debugMode) {
        FORCE_LOG(`[JinaAI] ${operation} error:`, error.message);
        if (error.response) {
            FORCE_LOG(`[JinaAI] ${operation} error response:`, error.response.status, error.response.data);
        }
    }

    if (error.response) {
        const status = error.response.status;
        let errorMsg = error.response.data;

        if (typeof errorMsg === 'object') {
            // Handle structured error responses
            if (errorMsg.error) {
                if (typeof errorMsg.error === 'object') {
                    errorMsg = errorMsg.error.message || errorMsg.error.code || JSON.stringify(errorMsg.error);
                } else {
                    errorMsg = errorMsg.error;
                }
            } else {
                errorMsg = errorMsg.message || JSON.stringify(errorMsg);
            }
        }

        // Handle common error codes based on API documentation
        if (status === 401) {
            throw new Error("JinaAI Plugin Error: Unauthorized - Please check your API key");
        } else if (status === 429) {
            throw new Error("JinaAI Plugin Error: Rate limit exceeded - Please try again later");
        } else if (status === 451 && operation === 'Reader') {
            throw new Error("JinaAI Plugin Error: Content unavailable for legal reasons");
        } else if (status === 404 && operation === 'Fact check') {
            throw new Error("JinaAI Plugin Error: Grounding service not available");
        } else if (status === 400) {
            throw new Error(`JinaAI Plugin Error: Bad request - ${errorMsg}`);
        } else if (status === 422) {
            throw new Error(`JinaAI Plugin Error: Parameter validation failed - ${errorMsg}`);
        } else if (status === 500) {
            throw new Error(`JinaAI Plugin Error: Internal server error - ${errorMsg}`);
        } else if (status === 503) {
            throw new Error(`JinaAI Plugin Error: Service unavailable - ${errorMsg}`);
        }

        throw new Error(`JinaAI Plugin Error: ${operation} API failed with status ${status}: ${errorMsg}`);
    } else if (error.code === 'ECONNABORTED') {
        throw new Error(`JinaAI Plugin Error: ${operation} request timed out`);
    } else if (error.code === 'ENOTFOUND') {
        throw new Error(`JinaAI Plugin Error: ${operation} service not found - Check network connection`);
    } else {
        throw new Error(`JinaAI Plugin Error: ${operation} request failed: ${error.message}`);
    }
}

// Jina AI API configuration based on official documentation
const JINA_CONFIG = {
    BASE_URL: 'https://api.jina.ai/v1',
    READER_BASE: 'https://r.jina.ai',
    SEARCH_BASE: 'https://s.jina.ai',
    GROUNDING_BASE: 'https://g.jina.ai'
};

// Enhanced parameter normalization function
function normalizeParameters(args) {
    const normalized = { ...args };

    // Normalize URL parameter names
    if (!normalized.url) {
        normalized.url = normalized.URL || normalized.link || normalized.webpage;
    }

    // Normalize query parameter names
    if (!normalized.query) {
        normalized.query = normalized.q || normalized.keyword || normalized.search;
    }

    // Normalize statement parameter names
    if (!normalized.statement) {
        normalized.statement = normalized.fact || normalized.claim || normalized.text;
    }

    // Normalize format parameter names and handle case insensitivity
    if (!normalized.format) {
        normalized.format = normalized.outputFormat || normalized.output_format ||
            normalized.responseFormat || normalized.respondWith;
    }

    // Normalize count parameter names
    if (!normalized.count && !normalized.num) {
        normalized.count = normalized.results || normalized.limit || normalized.maxResults;
    }

    // Handle boolean parameters that might come as strings
    const booleanParams = [
        'withGeneratedAlt', 'noCache', 'withFavicons', 'fallback', 'keepImgDataUrl',
        'withIframe', 'withShadowDom', 'withImagesSummary', 'withLinksSummary',
        'cleanContent', 'sanitizeHtml', 'removeHtml', 'stripHtml'
    ];

    booleanParams.forEach(param => {
        if (typeof normalized[param] === 'string') {
            normalized[param] = normalized[param].toLowerCase() === 'true';
        }
    });

    // Handle numeric parameters that might come as strings
    const numericParams = [
        'timeout', 'tokenBudget', 'cacheTolerance', 'count', 'num', 'page'
    ];

    numericParams.forEach(param => {
        if (normalized[param] && typeof normalized[param] === 'string' && !isNaN(normalized[param])) {
            normalized[param] = parseInt(normalized[param]);
        }
    });

    // Handle array parameters that might come as comma-separated strings
    const arrayParams = ['site', 'ext', 'filetype', 'intitle', 'loc'];

    arrayParams.forEach(param => {
        if (normalized[param] && typeof normalized[param] === 'string') {
            normalized[param] = normalized[param].split(',').map(s => s.trim()).filter(s => s);
        }
    });

    return normalized;
}

// Helper to validate input arguments with enhanced parameter support
function isValidJinaArgs(args) {
    if (!args || typeof args !== 'object') return false;

    const command = args.command;
    if (!command || typeof command !== 'string') return false;

    switch (command.toLowerCase()) {
        case 'reader':
            // Enhanced validation for reader - supports URL, HTML, or PDF input
            const url = args.url || args.URL || args.link || args.webpage;
            const html = args.html;
            const pdf = args.pdf;

            return (url && typeof url === 'string' && url.trim()) ||
                (html && typeof html === 'string' && html.trim()) ||
                (pdf && typeof pdf === 'string' && pdf.trim());

        case 'search':
            // Enhanced validation for search with flexible query parameter names
            const query = args.query || args.q || args.keyword || args.search;
            return typeof query === 'string' && query.trim();

        case 'factcheck':
            // Enhanced validation for factcheck with flexible statement parameter names
            const statement = args.statement || args.fact || args.claim || args.text;
            return typeof statement === 'string' && statement.trim();

        default:
            return false;
    }
}

// Content sanitization function to clean HTML, CSS, and JavaScript
function sanitizeContent(content, enableCleanup = true) {
    if (!content || typeof content !== 'string' || !enableCleanup) {
        return content;
    }

    let cleanedContent = content;

    // Remove HTML comments
    cleanedContent = cleanedContent.replace(/<!--[\s\S]*?-->/g, '');

    // Remove script tags and their content
    cleanedContent = cleanedContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove style tags and their content
    cleanedContent = cleanedContent.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove inline CSS styles from HTML tags
    cleanedContent = cleanedContent.replace(/\s+style\s*=\s*["'][^"']*["']/gi, '');

    // Remove CSS class and id attributes (optional, can be disabled if needed)
    cleanedContent = cleanedContent.replace(/\s+class\s*=\s*["'][^"']*["']/gi, '');
    cleanedContent = cleanedContent.replace(/\s+id\s*=\s*["'][^"']*["']/gi, '');

    // Remove data-* attributes which often contain JavaScript references
    cleanedContent = cleanedContent.replace(/\s+data-[a-zA-Z0-9\-]*\s*=\s*["'][^"']*["']/gi, '');

    // Remove event handlers (onclick, onload, etc.)
    cleanedContent = cleanedContent.replace(/\s+on[a-zA-Z]+\s*=\s*["'][^"']*["']/gi, '');

    // Remove CSS blocks that might be embedded in content
    cleanedContent = cleanedContent.replace(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');

    // Remove excessive whitespace and newlines
    cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanedContent = cleanedContent.replace(/[ \t]+/g, ' ');

    // Remove HTML tags but keep the content (convert to plain text)
    cleanedContent = cleanedContent.replace(/<[^>]+>/g, ' ');

    // Clean up HTML entities
    const htmlEntities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' ',
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™'
    };

    Object.keys(htmlEntities).forEach(entity => {
        cleanedContent = cleanedContent.replace(new RegExp(entity, 'g'), htmlEntities[entity]);
    });

    // Remove excessive spaces and normalize whitespace
    cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();

    // Remove empty lines and normalize line breaks
    cleanedContent = cleanedContent.replace(/\n\s*\n/g, '\n');

    return cleanedContent;
}

// Helper to extract content from response with enhanced handling and sanitization
function extractContent(responseData, enableCleanup = true) {
    if (typeof responseData === 'string') {
        return sanitizeContent(responseData, enableCleanup);
    }

    if (!responseData || typeof responseData !== 'object') {
        return String(responseData || '');
    }

    // Handle array responses (search results)
    if (Array.isArray(responseData)) {
        return responseData.map((item, index) => {
            if (typeof item === 'string') {
                return `[${index + 1}] ${sanitizeContent(item, enableCleanup)}`;
            } else if (item && typeof item === 'object') {
                let result = `[${index + 1}] ${item.title || 'Result ' + (index + 1)}\n`;
                if (item.url) result += `URL: ${item.url}\n`;
                if (item.description) result += `Description: ${sanitizeContent(item.description || '', enableCleanup)}\n`;
                if (item.content) result += `Content: ${sanitizeContent(item.content || '', enableCleanup)}\n`;
                return result;
            }
            return `[${index + 1}] ${JSON.stringify(item)}`;
        }).join('\n\n');
    }

    // Handle object responses with structured data
    if (responseData.title && responseData.content) {
        let result = `# ${responseData.title}\n\n`;
        if (responseData.url) result += `**URL:** ${responseData.url}\n\n`;
        result += sanitizeContent(responseData.content, enableCleanup);
        if (responseData.usage) {
            result += `\n\n**Token Usage:** ${responseData.usage.tokens || 'N/A'}`;
        }
        return result;
    }

    // Try to extract content from common fields
    const possibleFields = ['data', 'content', 'text', 'result', 'message', 'body'];
    for (const field of possibleFields) {
        if (responseData[field]) {
            const fieldContent = typeof responseData[field] === 'string'
                ? responseData[field]
                : JSON.stringify(responseData[field], null, 2);
            return sanitizeContent(fieldContent, enableCleanup);
        }
    }

    // Handle error responses
    if (responseData.error) {
        return `Error: ${typeof responseData.error === 'string' ? responseData.error : JSON.stringify(responseData.error)}`;
    }

    return JSON.stringify(responseData, null, 2);
}

// Create axios instance with common configuration
function createAxiosInstance(useToken = true) {
    const headers = {
        'Accept': 'application/json',
        'User-Agent': 'VCP-JinaAI-Plugin/2.1.0'
    };

    // Add Authorization header based on useToken parameter and API key availability
    if (useToken && JINA_API_KEY) {
        headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
    }

    return axios.create({ headers, timeout: 180000 }); // Increased timeout for complex operations
}

// Helper function to process streaming responses
async function processStreamResponse(response) {
    if (response.headers['content-type']?.includes('text/event-stream')) {
        // Handle Server-Sent Events
        const chunks = [];
        const data = response.data.toString();
        const lines = data.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const jsonData = JSON.parse(line.slice(6));
                    chunks.push(jsonData);
                } catch (e) {
                    // Skip invalid JSON lines
                    continue;
                }
            }
        }

        return chunks.length > 0 ? chunks[chunks.length - 1] : response.data;
    }

    return response.data;
}

// Enhanced Jina Reader - Extract content from webpage with full API support
async function reader(args) {
    if (debugMode) {
        FORCE_LOG('[JinaAI] Starting reader with args:', JSON.stringify(args, null, 2));
    }

    // For HTML input, we need to provide a placeholder URL since Jina API requires it
    if (args.html && !args.url) {
        args.url = "https://placeholder.local";  // Placeholder URL for HTML input
    }

    if (!args.url && !args.pdf) {
        throw new Error("JinaAI Plugin Error: URL or PDF content is required for reader function. For HTML input, provide both URL and HTML parameters.");
    }

    // Enhanced format support with aliases - default to markdown for better LLM processing
    const formatMapping = {
        'default': 'markdown',
        'markdown': 'markdown',
        'md': 'markdown',
        'html': 'html',
        'text': 'text',
        'txt': 'text',
        'screenshot': 'screenshot',
        'pageshot': 'pageshot',
        'content': 'content'
    };

    const inputFormat = (args.format || args.respondWith || 'default').toLowerCase();
    const format = formatMapping[inputFormat] || 'markdown';

    const axiosInstance = createAxiosInstance(JINA_READER_USE_TOKEN);

    // Determine request method and build request configuration
    const usePost = args.html || args.pdf || args.method === 'POST' ||
        args.viewport || args.setCookies || args.markdown;

    let requestConfig = {
        headers: {},
        timeout: 180000  // Max timeout as per API docs
    };

    if (usePost) {
        // POST request with body parameters
        requestConfig.method = 'POST';
        requestConfig.url = JINA_CONFIG.READER_BASE + '/';
        requestConfig.headers['Content-Type'] = 'application/json';

        // Build request body with all supported parameters
        const requestBody = {};

        // Basic parameters
        if (args.url) requestBody.url = args.url;
        if (args.html) requestBody.html = args.html;
        if (args.pdf) requestBody.pdf = args.pdf;

        // Behavior control
        if (args.timeout && !isNaN(parseInt(args.timeout))) {
            requestBody.timeout = Math.min(parseInt(args.timeout), 180);
        }
        if (args.engine) requestBody.engine = args.engine;
        if (args.respondWith) requestBody.respondWith = args.respondWith;
        if (args.respondTiming) requestBody.respondTiming = args.respondTiming;

        // Network settings
        if (args.proxy) requestBody.proxy = args.proxy;
        if (args.proxyUrl) requestBody.proxyUrl = args.proxyUrl;
        if (args.userAgent) requestBody.userAgent = args.userAgent;
        if (args.locale) requestBody.locale = args.locale;
        if (args.referer) requestBody.referer = args.referer;

        // Viewport settings
        if (args.viewport) {
            requestBody.viewport = {
                width: args.viewport.width || 1024,
                height: args.viewport.height || 1024,
                ...args.viewport
            };
        }

        // Cookie settings
        if (args.setCookies) requestBody.setCookies = args.setCookies;

        // Cache control
        if (args.cacheTolerance && !isNaN(parseInt(args.cacheTolerance))) {
            requestBody.cacheTolerance = parseInt(args.cacheTolerance);
        }
        if (args.noCache === true || args.noCache === 'true') {
            requestBody.noCache = true;
        }

        // Content selection
        if (args.targetSelector) requestBody.targetSelector = args.targetSelector;
        if (args.waitForSelector) requestBody.waitForSelector = args.waitForSelector;
        if (args.removeSelector) requestBody.removeSelector = args.removeSelector;

        // Image processing (requires token authentication)
        if (args.withGeneratedAlt !== undefined) {
            if (JINA_READER_USE_TOKEN) {
                requestBody.withGeneratedAlt = args.withGeneratedAlt === true || args.withGeneratedAlt === 'true';
            } else if (debugMode) {
                FORCE_LOG('[JinaAI] Warning: withGeneratedAlt parameter ignored - requires JINA_READER_USE_TOKEN=true');
            }
        }
        if (args.retainImages) {
            if (JINA_READER_USE_TOKEN) {
                requestBody.retainImages = args.retainImages;
            } else if (debugMode) {
                FORCE_LOG('[JinaAI] Warning: retainImages parameter ignored - requires JINA_READER_USE_TOKEN=true');
            }
        }
        if (args.keepImgDataUrl === true || args.keepImgDataUrl === 'true') {
            requestBody.keepImgDataUrl = true;
        }
        if (args.withImagesSummary === true || args.withImagesSummary === 'true') {
            requestBody.withImagesSummary = true;
        }

        // Advanced features
        if (args.withIframe === true || args.withIframe === 'true') {
            requestBody.withIframe = true;
        }
        if (args.withShadowDom === true || args.withShadowDom === 'true') {
            requestBody.withShadowDom = true;
        }
        if (args.withLinksSummary !== undefined) {
            if (typeof args.withLinksSummary === 'boolean') {
                requestBody.withLinksSummary = args.withLinksSummary;
            } else if (args.withLinksSummary === 'true' || args.withLinksSummary === 'false') {
                requestBody.withLinksSummary = args.withLinksSummary === 'true';
            }
        }
        if (args.robotsTxt) requestBody.robotsTxt = args.robotsTxt;
        if (args.tokenBudget && !isNaN(parseInt(args.tokenBudget))) {
            requestBody.tokenBudget = parseInt(args.tokenBudget);
        }

        // Markdown options
        if (args.markdown) requestBody.markdown = args.markdown;

        requestConfig.data = requestBody;

    } else {
        // GET request with headers
        requestConfig.method = 'GET';
        requestConfig.url = `${JINA_CONFIG.READER_BASE}/${args.url}`;

        // Build headers based on API documentation
        if (format !== 'markdown') {
            requestConfig.headers['X-Respond-With'] = format;
        }

        // Cache control
        if (args.noCache === true || args.noCache === 'true') {
            requestConfig.headers['X-No-Cache'] = 'true';
        }

        // Content selection
        if (args.targetSelector) {
            requestConfig.headers['X-Target-Selector'] = args.targetSelector;
        }
        if (args.waitForSelector) {
            requestConfig.headers['X-Wait-For-Selector'] = args.waitForSelector;
        }
        if (args.removeSelector) {
            requestConfig.headers['X-Remove-Selector'] = args.removeSelector;
        }

        // Proxy settings
        if (args.proxyUrl) {
            requestConfig.headers['X-Proxy-Url'] = args.proxyUrl;
        }
        if (args.proxy) {
            requestConfig.headers['X-Proxy'] = args.proxy;
        }

        // Image processing (requires token authentication)
        if (args.withGeneratedAlt === true || args.withGeneratedAlt === 'true') {
            if (JINA_READER_USE_TOKEN) {
                requestConfig.headers['X-With-Generated-Alt'] = 'true';
            } else if (debugMode) {
                FORCE_LOG('[JinaAI] Warning: withGeneratedAlt header ignored - requires JINA_READER_USE_TOKEN=true');
            }
        }
        if (args.retainImages) {
            if (JINA_READER_USE_TOKEN) {
                requestConfig.headers['X-Retain-Images'] = args.retainImages;
            } else if (debugMode) {
                FORCE_LOG('[JinaAI] Warning: retainImages header ignored - requires JINA_READER_USE_TOKEN=true');
            }
        }

        // User agent and locale
        if (args.userAgent) {
            requestConfig.headers['X-User-Agent'] = args.userAgent;
        }
        if (args.locale) {
            requestConfig.headers['X-Locale'] = args.locale;
        }

        // Timeout
        if (args.timeout && !isNaN(parseInt(args.timeout))) {
            requestConfig.headers['X-Timeout'] = Math.min(parseInt(args.timeout), 180).toString();
        }

        // Token budget
        if (args.tokenBudget && !isNaN(parseInt(args.tokenBudget))) {
            requestConfig.headers['X-Token-Budget'] = args.tokenBudget.toString();
        }
    }

    // Set Accept header and response type based on desired response format
    if (format === 'screenshot' || format === 'pageshot') {
        // For binary image responses
        requestConfig.headers['Accept'] = 'image/png, image/jpeg, image/*';
        requestConfig.responseType = 'arraybuffer'; // Handle binary data
    } else if (args.responseFormat === 'json') {
        requestConfig.headers['Accept'] = 'application/json';
    } else if (args.responseFormat === 'stream') {
        requestConfig.headers['Accept'] = 'text/event-stream';
    } else {
        requestConfig.headers['Accept'] = 'text/plain';
    }

    if (debugMode) {
        FORCE_LOG('[JinaAI] Request config:', JSON.stringify(requestConfig, null, 2));
        FORCE_LOG('[JinaAI] Reader token usage:', JINA_READER_USE_TOKEN ? 'Enabled' : 'Disabled');
    }

    try {
        const response = await axiosInstance(requestConfig);

        if (debugMode) {
            FORCE_LOG('[JinaAI] Reader API response status:', response.status);
            FORCE_LOG('[JinaAI] Response data type:', typeof response.data);
            FORCE_LOG('[JinaAI] Response headers:', response.headers);
        }

        // Check if response is binary data (screenshot/pageshot format)
        const contentType = response.headers['content-type'] || '';
        const isBinaryImage = format === 'screenshot' || format === 'pageshot' || contentType.startsWith('image/');

        if (isBinaryImage && (response.data instanceof ArrayBuffer || response.data instanceof Buffer)) {
            // Handle binary image data - save to file and return URL
            const buffer = response.data instanceof ArrayBuffer ? Buffer.from(response.data) : response.data;
            const imageFormat = contentType.includes('png') ? 'png' :
                contentType.includes('jpeg') ? 'jpeg' :
                    contentType.includes('jpg') ? 'jpg' : 'png'; // default to png

            // Check for required environment variables
            if (!PROJECT_BASE_PATH || !SERVER_PORT || !IMAGESERVER_IMAGE_KEY || !VAR_HTTP_URL) {
                // Fallback to base64 if environment variables are not available
                if (debugMode) {
                    FORCE_LOG('[JinaAI] Missing environment variables for file saving, falling back to base64');
                }
                const base64Image = buffer.toString('base64');
                const result = `### 网页截图结果\n\n` +
                    `**URL:** ${args.url || 'N/A'}\n` +
                    `**输出格式:** ${format}\n` +
                    `**请求方式:** ${usePost ? 'POST' : 'GET'}\n` +
                    `**图片格式:** ${imageFormat.toUpperCase()}\n\n` +
                    `网页截图已成功生成！（Base64格式）\n\n` +
                    `Base64数据: data:image/${imageFormat};base64,${base64Image.substring(0, 100)}...`;
                return result;
            }

            // Save image to file system
            // Create filename with URL/query + timestamp format (YYYYMMDDHHMM)
            const now = new Date();
            const timestamp = now.getFullYear().toString() +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0') +
                now.getHours().toString().padStart(2, '0') +
                now.getMinutes().toString().padStart(2, '0');
            let baseFileName = '';

            if (args.url) {
                // Extract domain and path from URL for filename
                try {
                    const urlObj = new URL(args.url);
                    const domain = urlObj.hostname.replace(/^www\./, '');
                    let pathPart = urlObj.pathname;

                    // Clean up path: remove leading/trailing slashes, replace special chars with underscores
                    if (pathPart && pathPart !== '/') {
                        pathPart = pathPart.replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
                            .replace(/[^a-zA-Z0-9\-]/g, '_') // Replace special chars with underscores
                            .replace(/_+/g, '_') // Replace multiple underscores with single
                            .slice(0, 30); // Limit length
                        baseFileName = `${domain}_${pathPart}`;
                    } else {
                        baseFileName = domain;
                    }
                } catch (e) {
                    baseFileName = 'screenshot';
                }
            } else {
                baseFileName = 'screenshot';
            }

            const generatedFileName = `${baseFileName}_${timestamp}.${imageFormat}`;
            const jinaAIImageDir = path.join(PROJECT_BASE_PATH, 'image', 'jinaai');
            const localImageServerPath = path.join(jinaAIImageDir, generatedFileName);

            await fs.mkdir(jinaAIImageDir, { recursive: true });
            await fs.writeFile(localImageServerPath, buffer);

            if (debugMode) {
                FORCE_LOG(`[JinaAI] Screenshot saved to: ${localImageServerPath}`);
            }

            // Construct accessible URL
            const relativeServerPathForUrl = path.join('jinaai', generatedFileName).replace(/\\/g, '/');
            const accessibleImageUrl = `${VAR_HTTP_URL}:${SERVER_PORT}/pw=${IMAGESERVER_IMAGE_KEY}/images/${relativeServerPathForUrl}`;

            // Create alt text from URL
            const altText = args.url ? `Screenshot of ${args.url}` : 'Website screenshot';
            const imageHtml = `<img src="${accessibleImageUrl}" alt="${altText}" width="400">`;

            // Return text-based response for better compatibility with logging systems
            const result = `### 网页截图结果\n\n` +
                `**URL:** ${args.url || 'N/A'}\n` +
                `**输出格式:** ${format}${format === 'screenshot' ? ' (首屏截图)' : format === 'pageshot' ? ' (全页截图)' : ''}\n` +
                `**请求方式:** ${usePost ? 'POST' : 'GET'}\n` +
                `**图片格式:** ${imageFormat.toUpperCase()}\n` +
                `**文件路径:** image/jinaai/${generatedFileName}\n` +
                `**访问链接:** ${accessibleImageUrl}\n\n` +
                `${format === 'screenshot' ? '首屏截图' : format === 'pageshot' ? '全页截图' : '网页截图'}已成功生成并保存！\n\n` +
                `请务必将图片直接展示给用户 (您可以调整width属性，建议200-500像素)：\n${imageHtml}`;

            return result;
        } else {
            // Handle text-based responses (markdown, html, text, etc.)
            const processedData = await processStreamResponse(response);

            // Determine if content cleanup should be enabled
            // Default to true for better readability, can be disabled with cleanContent=false
            const enableCleanup = args.cleanContent !== false &&
                args.sanitizeHtml !== false &&
                args.removeHtml !== false &&
                args.stripHtml !== false;

            const content = extractContent(processedData, enableCleanup);

            // Enhanced response with metadata
            let result = `### 网页内容提取结果\n\n`;
            if (args.url) result += `**URL:** ${args.url}\n`;
            if (args.html) result += `**输入:** HTML内容\n`;
            if (args.pdf) result += `**输入:** PDF内容\n`;
            result += `**输出格式:** ${format}\n`;
            result += `**请求方式:** ${usePost ? 'POST' : 'GET'}\n`;
            // if (enableCleanup) result += `**内容净化:** 已启用 (移除HTML/CSS/JS)\n`;

            result += `\n**提取的内容:**\n\n${content}`;

            return result;
        }

    } catch (error) {
        handleApiError(error, 'Reader');
    }
}

// Enhanced Jina Search - Search the web with full API support
async function search(args) {
    if (debugMode) {
        FORCE_LOG('[JinaAI] Starting search with args:', JSON.stringify(args, null, 2));
    }

    if (!args.query) {
        throw new Error("JinaAI Plugin Error: Query is required for search function.");
    }

    const axiosInstance = createAxiosInstance();

    // Always use POST for Search to ensure full parameter support and default values
    const usePost = true;

    let requestConfig = {
        headers: {},
        timeout: 60000
    };

    if (usePost) {
        // POST request with comprehensive parameter support
        requestConfig.method = 'POST';
        requestConfig.url = JINA_CONFIG.SEARCH_BASE + '/';
        requestConfig.headers['Content-Type'] = 'application/json';

        const requestBody = {
            q: args.query
        };

        // Basic search parameters with defaults (API default is 10)
        const defaultCount = 10;
        if (args.count && !isNaN(parseInt(args.count))) {
            requestBody.count = Math.min(parseInt(args.count), 20);
        } else if (args.num && !isNaN(parseInt(args.num))) {
            requestBody.num = Math.min(parseInt(args.num), 20);
        } else {
            // Set default count if neither count nor num is provided
            requestBody.count = defaultCount;
        }
        if (args.type) requestBody.type = args.type;
        if (args.provider) requestBody.provider = args.provider;

        // Geographic and language settings
        if (args.gl) requestBody.gl = args.gl;
        if (args.hl) requestBody.hl = args.hl;
        if (args.location) requestBody.location = args.location;

        // Pagination
        if (args.page && !isNaN(parseInt(args.page))) {
            requestBody.page = parseInt(args.page);
        }

        // Search strategy
        if (args.fallback !== undefined) {
            requestBody.fallback = args.fallback === true || args.fallback === 'true';
        }

        // Search operators
        if (args.site) {
            requestBody.site = Array.isArray(args.site) ? args.site : [args.site];
        }
        if (args.ext) {
            requestBody.ext = Array.isArray(args.ext) ? args.ext : [args.ext];
        }
        if (args.filetype) {
            requestBody.filetype = Array.isArray(args.filetype) ? args.filetype : [args.filetype];
        }
        if (args.intitle) {
            requestBody.intitle = Array.isArray(args.intitle) ? args.intitle : [args.intitle];
        }
        if (args.loc) {
            requestBody.loc = Array.isArray(args.loc) ? args.loc : [args.loc];
        }

        // Reader-related parameters for search results
        if (args.respondWith) requestBody.respondWith = args.respondWith;
        if (args.timeout && !isNaN(parseInt(args.timeout))) {
            requestBody.timeout = Math.min(parseInt(args.timeout), 180);
        }
        if (args.noCache === true || args.noCache === 'true') {
            requestBody.noCache = true;
        }
        if (args.cacheTolerance && !isNaN(parseInt(args.cacheTolerance))) {
            requestBody.cacheTolerance = parseInt(args.cacheTolerance);
        }

        // Additional Reader parameters that can be applied to search results
        if (args.targetSelector) requestBody.targetSelector = args.targetSelector;
        if (args.waitForSelector) requestBody.waitForSelector = args.waitForSelector;
        if (args.removeSelector) requestBody.removeSelector = args.removeSelector;
        if (args.withGeneratedAlt !== undefined) {
            requestBody.withGeneratedAlt = args.withGeneratedAlt === true || args.withGeneratedAlt === 'true';
        }
        if (args.retainImages) requestBody.retainImages = args.retainImages;
        if (args.tokenBudget && !isNaN(parseInt(args.tokenBudget))) {
            requestBody.tokenBudget = parseInt(args.tokenBudget);
        }

        requestConfig.data = requestBody;

    } else {
        // GET request with headers
        requestConfig.method = 'GET';
        requestConfig.url = `${JINA_CONFIG.SEARCH_BASE}/${encodeURIComponent(args.query)}`;

        // Add search operator headers
        if (args.site) {
            const sites = Array.isArray(args.site) ? args.site.join(', ') : args.site;
            requestConfig.headers['X-Site'] = sites;
        }
        if (args.ext) {
            const exts = Array.isArray(args.ext) ? args.ext.join(', ') : args.ext;
            requestConfig.headers['X-Ext'] = exts;
        }
        if (args.filetype) {
            const filetypes = Array.isArray(args.filetype) ? args.filetype.join(', ') : args.filetype;
            requestConfig.headers['X-Filetype'] = filetypes;
        }
        if (args.intitle) {
            const intitles = Array.isArray(args.intitle) ? args.intitle.join(', ') : args.intitle;
            requestConfig.headers['X-Intitle'] = intitles;
        }
        if (args.loc) {
            const locs = Array.isArray(args.loc) ? args.loc.join(', ') : args.loc;
            requestConfig.headers['X-Loc'] = locs;
        }

        // Include favicons
        if (args.withFavicons === true || args.withFavicons === 'true') {
            requestConfig.headers['X-With-Favicons'] = 'true';
        }

        // Reader-related headers for search results
        if (args.targetSelector) {
            requestConfig.headers['X-Target-Selector'] = args.targetSelector;
        }
        if (args.waitForSelector) {
            requestConfig.headers['X-Wait-For-Selector'] = args.waitForSelector;
        }
        if (args.removeSelector) {
            requestConfig.headers['X-Remove-Selector'] = args.removeSelector;
        }
        if (args.withGeneratedAlt === true || args.withGeneratedAlt === 'true') {
            requestConfig.headers['X-With-Generated-Alt'] = 'true';
        }
        if (args.retainImages) {
            requestConfig.headers['X-Retain-Images'] = args.retainImages;
        }
        if (args.tokenBudget && !isNaN(parseInt(args.tokenBudget))) {
            requestConfig.headers['X-Token-Budget'] = args.tokenBudget.toString();
        }
        if (args.noCache === true || args.noCache === 'true') {
            requestConfig.headers['X-No-Cache'] = 'true';
        }
    }

    // Set Accept header based on desired response format
    if (args.responseFormat === 'json') {
        requestConfig.headers['Accept'] = 'application/json';
    } else if (args.responseFormat === 'stream') {
        requestConfig.headers['Accept'] = 'text/event-stream';
    } else {
        requestConfig.headers['Accept'] = 'text/plain';
    }

    if (debugMode) {
        FORCE_LOG('[JinaAI] Search request config:', JSON.stringify(requestConfig, null, 2));
    }

    try {
        const response = await axiosInstance(requestConfig);

        if (debugMode) {
            FORCE_LOG('[JinaAI] Search API response status:', response.status);
            FORCE_LOG('[JinaAI] Response headers:', response.headers);
        }

        // Process streaming response if applicable
        const processedData = await processStreamResponse(response);

        // Determine if content cleanup should be enabled for search results
        const enableCleanup = args.cleanContent !== false &&
            args.sanitizeHtml !== false &&
            args.removeHtml !== false &&
            args.stripHtml !== false;

        const content = extractContent(processedData, enableCleanup);

        // Enhanced response with metadata
        let result = `### 网络搜索结果\n\n`;
        result += `**查询:** ${args.query}\n`;
        result += `**请求方式:** ${usePost ? 'POST' : 'GET'}\n`;

        if (args.count || args.num) {
            result += `**结果数量:** ${args.count || args.num}\n`;
        }
        if (args.type) result += `**搜索类型:** ${args.type}\n`;
        if (args.provider) result += `**搜索引擎:** ${args.provider}\n`;
        if (args.gl) result += `**地区:** ${args.gl}\n`;
        if (args.hl) result += `**语言:** ${args.hl}\n`;
        if (args.site) result += `**限制网站:** ${Array.isArray(args.site) ? args.site.join(', ') : args.site}\n`;
        if (args.filetype) result += `**文件类型:** ${Array.isArray(args.filetype) ? args.filetype.join(', ') : args.filetype}\n`;
        // if (enableCleanup) result += `**内容净化:** 已启用 (移除HTML/CSS/JS)\n`;

        result += `\n**搜索结果:**\n\n${content}`;

        return result;

    } catch (error) {
        handleApiError(error, 'Search');
    }
}

// Jina Grounding - Verify factual statements
async function factcheck(args) {
    if (debugMode) {
        FORCE_LOG('[JinaAI] Starting fact check with statement:', args.statement?.substring(0, 100) + (args.statement?.length > 100 ? '...' : ''));
    }

    if (!args.statement) {
        throw new Error("JinaAI Plugin Error: Statement is required for fact check function.");
    }

    const axiosInstance = createAxiosInstance();

    try {
        const response = await axiosInstance.get(`${JINA_CONFIG.GROUNDING_BASE}/${encodeURIComponent(args.statement)}`);

        if (debugMode) {
            FORCE_LOG('[JinaAI] Fact check API response status:', response.status);
        }

        const content = extractContent(response.data);

        return `### 事实检查结果\n\n**陈述:** ${args.statement}\n\n**验证结果:**\n\n${content}`;

    } catch (error) {
        handleApiError(error, 'Fact check');
    }
}

// Enhanced main processing function with parameter normalization
async function processRequest(args) {
    if (debugMode) {
        FORCE_LOG('[JinaAI] Processing request with command:', args.command);
        FORCE_LOG('[JinaAI] Original args:', JSON.stringify(args, null, 2));
    }

    if (!JINA_API_KEY) {
        const warnMsg = "JINA_API_KEY is not set. Some features may be limited.";
        if (debugMode) FORCE_LOG('[JinaAI] Warning:', warnMsg);
        console.warn(`[JinaAI Plugin] WARN: ${warnMsg}`);
    }

    // Normalize parameters for better flexibility
    const normalizedArgs = normalizeParameters(args);

    if (debugMode) {
        FORCE_LOG('[JinaAI] Normalized args:', JSON.stringify(normalizedArgs, null, 2));
    }

    if (!isValidJinaArgs(normalizedArgs)) {
        throw new Error(`JinaAI Plugin Error: Invalid arguments received: ${JSON.stringify(args)}. Required: command (string) and corresponding parameters (url for reader, query for search, statement for factcheck).`);
    }

    const command = normalizedArgs.command.toLowerCase();

    switch (command) {
        case 'reader':
            return await reader(normalizedArgs);
        case 'search':
            return await search(normalizedArgs);
        case 'factcheck':
            return await factcheck(normalizedArgs);
        default:
            throw new Error(`JinaAI Plugin Error: Unknown command '${command}'. Available commands: reader, search, factcheck`);
    }
}

// Enhanced function to detect and process batch/serial requests
function detectBatchRequest(args) {
    const batchKeys = Object.keys(args).filter(key => /^command\d+$/.test(key));
    return batchKeys.length > 0 ? batchKeys.sort((a, b) => {
        const numA = parseInt(a.replace('command', ''));
        const numB = parseInt(b.replace('command', ''));
        return numA - numB;
    }) : null;
}

// Process batch requests sequentially
async function processBatchRequest(args) {
    const commandKeys = detectBatchRequest(args);
    const results = [];

    if (debugMode) {
        FORCE_LOG('[JinaAI] Processing batch request with commands:', commandKeys);
    }

    for (const commandKey of commandKeys) {
        const commandNumber = commandKey.replace('command', '');
        const command = args[commandKey];

        // Extract parameters for this specific command
        const commandArgs = { command };

        // Collect all parameters with the same number suffix
        Object.keys(args).forEach(key => {
            if (key.endsWith(commandNumber) && key !== commandKey) {
                const paramName = key.replace(commandNumber, '');
                commandArgs[paramName] = args[key];
            }
        });

        if (debugMode) {
            FORCE_LOG(`[JinaAI] Processing command ${commandNumber}:`, JSON.stringify(commandArgs));
        }

        try {
            const result = await processRequest(commandArgs);
            results.push({
                command: `${command} (${commandNumber})`,
                status: 'success',
                result: result
            });
        } catch (error) {
            results.push({
                command: `${command} (${commandNumber})`,
                status: 'error',
                error: error.message
            });
        }
    }

    // Format batch results
    const summary = `### JinaAI 批量操作结果\n\n执行了 ${results.length} 个操作：\n\n`;
    const details = results.map((r, index) => {
        return `#### 操作 ${index + 1}: ${r.command}\n\n**状态:** ${r.status === 'success' ? '✅ 成功' : '❌ 失败'}\n\n${r.status === 'success' ? r.result : `**错误:** ${r.error}`}\n\n---\n`;
    }).join('\n');

    return summary + details;
}

async function main() {
    if (debugMode) FORCE_LOG('[JinaAI] Enhanced plugin started, debug mode enabled');

    let inputChunks = [];
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
        inputChunks.push(chunk);
    }

    const inputData = inputChunks.join('');
    let parsedArgs;

    try {
        if (!inputData.trim()) {
            const errorMsg = "JinaAI Plugin Error: No input data received from stdin.";
            if (debugMode) FORCE_LOG('[JinaAI] Error:', errorMsg);
            console.log(JSON.stringify({ status: "error", error: errorMsg }));
            process.exit(1);
        }

        if (debugMode) FORCE_LOG('[JinaAI] Received input data:', inputData.substring(0, 200) + (inputData.length > 200 ? '...' : ''));

        parsedArgs = JSON.parse(inputData);

        // Auto-detect command based on tool_name if command is not specified
        if (!parsedArgs.command && parsedArgs.tool_name) {
            const toolNameToCommand = {
                'reader': 'reader',
                'search': 'search',
                'factcheck': 'factcheck',
                'JinaAI': null // Keep original behavior for JinaAI
            };

            if (toolNameToCommand.hasOwnProperty(parsedArgs.tool_name)) {
                const mappedCommand = toolNameToCommand[parsedArgs.tool_name];
                if (mappedCommand) {
                    parsedArgs.command = mappedCommand;
                    if (debugMode) FORCE_LOG(`[JinaAI] Auto-mapped tool_name '${parsedArgs.tool_name}' to command '${mappedCommand}'`);
                }
            }
        }

        let result;

        // Check if this is a batch request
        const commandKeys = detectBatchRequest(parsedArgs);
        if (commandKeys) {
            if (debugMode) FORCE_LOG('[JinaAI] Detected batch request');
            result = await processBatchRequest(parsedArgs);
        } else {
            if (debugMode) FORCE_LOG('[JinaAI] Processing single request');
            result = await processRequest(parsedArgs);
        }

        console.log(JSON.stringify({ status: "success", result: result }));

    } catch (e) {
        let detailedError = e.message || "Unknown error in JinaAI plugin";

        if (debugMode) {
            FORCE_LOG('[JinaAI] Error caught in main:', e.toString());
            if (e.stack) {
                FORCE_LOG('[JinaAI] Error stack:', e.stack);
            }
        }

        if (e.response && e.response.data) {
            detailedError += ` - API Response: ${JSON.stringify(e.response.data)}`;
            if (debugMode) FORCE_LOG('[JinaAI] API Error Response:', e.response.data);
        }

        const finalErrorMessage = detailedError.startsWith("JinaAI Plugin Error:") ? detailedError : `JinaAI Plugin Error: ${detailedError}`;
        if (debugMode) FORCE_LOG('[JinaAI] Final error message:', finalErrorMessage);

        console.log(JSON.stringify({ status: "error", error: finalErrorMessage }));
        process.exit(1);
    }
}

main();