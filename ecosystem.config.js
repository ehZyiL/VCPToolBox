module.exports = {
    apps: [{
        name: 'cherry-var',
        script: 'server.js',
        instances: 1,
        watch: false,
        max_memory_restart: '1G',
        autorestart: true,
        env: {
            NODE_ENV: 'development'
        },
        env_production: {
            NODE_ENV: 'production'
        },
        log_date_format: 'YYYY-MM-DD HH:mm Z',
        error_file: './debug/logs/err.log',
        out_file: './debug/logs/out.log',
        log_file: './debug/logs/combined.log',
        time: true,
        exec_mode: 'fork'
    }, {
        name: 'cherry-var-debug',
        script: 'server.js',
        instances: 1,
        autorestart: false,
        watch: true,
        node_args: '--inspect=0.0.0.0:9229',
        env: {
            NODE_ENV: 'development',
            DEBUG: '*'
        },
        log_date_format: 'YYYY-MM-DD HH:mm Z',
        error_file: './debug/logs/debug-err.log',
        out_file: './debug/logs/debug-out.log',
        log_file: './debug/logs/debug-combined.log',
        time: true,
        exec_mode: 'fork'
    }]
};