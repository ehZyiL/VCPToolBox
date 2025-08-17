#!/usr/bin/env node

/**
 * Generic Plugin Debug Script
 * Runs any plugin in a Node.js environment for debugging purposes
 */

require('dotenv').config({path: 'debug/.env.debug'});

const {spawn} = require('child_process');
const {readFileSync, existsSync} = require('fs');
const path = require('path');
const {debug, track, mark, measure, report} = require('./debug-helper');

// Get plugin name from command line arguments
const pluginName = process.argv[2];
if (!pluginName) {
    console.error('❌ Error: Please provide a plugin name as an argument.');
    console.log('Usage: node debug/debug-plugin.js <PluginName> [input-file.json]');
    process.exit(1);
}

// Construct plugin paths by reading the manifest
const pluginDir = path.join('Plugin', pluginName);
const manifestPath = path.join(pluginDir, 'plugin-manifest.json');

if (!existsSync(manifestPath)) {
    console.error(`❌ Error: plugin-manifest.json not found for ${pluginName}`);
    process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const commandParts = manifest.entryPoint.command.split(' ');
const executor = commandParts.shift(); // e.g., 'node'
const entryScript = commandParts.join(' '); // e.g., 'daily-hot.js'
const pluginPath = path.join(pluginDir, entryScript);

if (!existsSync(pluginPath)) {
    console.error(`❌ Error: Plugin script not found at ${pluginPath}`);
    process.exit(1);
}

let debugInput = '';
let debugInputPath = '';

// Only look for input file if the plugin is not static
if (manifest.pluginType !== 'static') {
    const inputFile = process.argv[3] || 'debug-input.json';
    debugInputPath = path.join(pluginDir, inputFile);

    if (!existsSync(debugInputPath)) {
        console.error(`❌ Error: Debug input file not found at ${debugInputPath}`);
        process.exit(1);
    }
    debugInput = readFileSync(debugInputPath, 'utf8');
}

const executionId = `${pluginName}-debug-${Date.now()}`;
track(executionId, 'start');
mark('total_execution_start');

console.log(`🚀 Starting ${pluginName} Plugin Debug...`);
debug('INIT', {pluginName, executionId, timestamp: new Date().toISOString()});
debug('ENVIRONMENT_SETUP', {
    JINA_API_KEY: process.env.JINA_API_KEY ? process.env.JINA_API_KEY.substring(0, 20) + '...' : '[NOT SET]',
    PROJECT_BASE_PATH: process.env.PROJECT_BASE_PATH,
    SERVER_PORT: process.env.SERVER_PORT
});
console.log('Environment variables loaded from .env.debug');
console.log('');

if (manifest.pluginType !== 'static') {
    debug('INPUT_READ', {path: debugInputPath, size: debugInput.length});

    console.log('📝 Debug input:');
    console.log(debugInput);
    console.log('');
} else {
    console.log('ℹ️ Static plugin detected. No input file required.');
    debug('STATIC_PLUGIN_SKIP_INPUT');
}

// Spawn the plugin process
track(executionId, 'spawn_plugin');
mark('spawn_start');
const child = spawn('node', [pluginPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env
});

// Send input data if it exists for non-static plugins
if (debugInput) {
    child.stdin.write(debugInput);
}
child.stdin.end();

// 处理输出
let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
    stdout += data.toString();
});

child.stderr.on('data', (data) => {
    stderr += data.toString();
    // 实时显示调试信息
    console.log('🔍 Debug:', data.toString().trim());
});

child.on('close', (code) => {
    mark('spawn_end');
    const spawnDuration = measure('spawn_start', 'spawn_end');
    debug('PLUGIN_PROCESS_CLOSED', {code, spawnDuration});

    console.log('\n' + '='.repeat(50));
    console.log('🏁 Plugin execution completed');
    console.log(`Exit code: ${code}`);

    if (stdout) {
        console.log('\n📤 Plugin output (stdout):');
        try {
            const result = JSON.parse(stdout);
            debug('PLUGIN_OUTPUT_PARSED', {
                status: result.status,
                resultLength: result.result ? result.result.length : 0
            });
            console.log(`Status: ${result.status}`);
            if (result.status === 'success') {
                console.log(`Result length: ${result.result.length} characters`);
                console.log('Result preview:');
                console.log(result.result.substring(0, 30000) + '...');
            } else {
                console.log('Error:', result.error);
            }
        } catch (e) {
            console.log('Raw output:', stdout);
        }
    }

    if (stderr && !stderr.includes('[JinaAI Debug]')) {
        debug('PLUGIN_STDERR', {stderr});
        console.log('\n❌ Errors (stderr):');
        console.log(stderr);
    }

    mark('total_execution_end');
    const totalDuration = measure('total_execution_start', 'total_execution_end');
    track(executionId, 'end', {code, totalDuration});

    // 生成调试报告
    const reportPath = report();
    console.log(`\n📋 调试报告已生成: ${reportPath}`);
});

child.on('error', (error) => {
    track(executionId, 'error', {message: error.message, stack: error.stack});
    console.error('❌ Failed to start plugin process:', error);
});