#!/bin/bash
# VCP PM2 管理脚本
# 基于 ecosystem.config.js 配置管理 PM2 应用

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 切换到项目根目录
cd "$(dirname "$0")/.."

# 检查 PM2 是否安装
check_pm2() {
    if ! command -v pm2 >/dev/null 2>&1; then
        log_error "PM2 未安装"
        log_info "安装 PM2: npm install -g pm2"
        exit 1
    fi
}

# 检查配置文件
check_config() {
    if [ ! -f "ecosystem.config.js" ]; then
        log_error "ecosystem.config.js 配置文件不存在"
        exit 1
    fi
    
    if [ ! -f "server.js" ]; then
        log_error "server.js 入口文件不存在"
        exit 1
    fi
}

# 确保日志目录存在
ensure_log_dir() {
    mkdir -p debug/logs
    log_info "日志目录已准备: debug/logs/"
}

# 启动应用
start_app() {
    log_info "启动 VCP 应用..."
    
    check_pm2
    check_config
    ensure_log_dir
    
    if [ "$1" == "--prod" ]; then
        log_info "以生产模式启动 'cherry-var'..."
        pm2 start ecosystem.config.js --only cherry-var --env production
    else
        log_info "启动所有 VCP 应用 (开发模式)..."
        pm2 start ecosystem.config.js
    fi
    
    sleep 2
    log_success "VCP 应用已启动"
    pm2 list
}

# 停止应用
stop_app() {
    log_info "停止所有 VCP 应用..."
    pm2 stop all 2>/dev/null || true
    log_success "所有 VCP 应用已停止"
}

# 重启应用
restart_app() {
    log_info "重启所有 VCP 应用..."
    pm2 restart all 2>/dev/null || true
    log_success "所有 VCP 应用已重启"
}

# 删除应用
delete_app() {
    log_info "删除所有 VCP 应用..."
    pm2 delete all 2>/dev/null || true
    log_success "所有 VCP 应用已删除"
}

# 查看状态
show_status() {
    log_info "VCP 应用状态:"
    
    if ! command -v pm2 >/dev/null 2>&1; then
        log_warning "PM2 未安装"
        return 1
    fi
    
    echo ""
    pm2 list
    
    # 显示所有应用的详情
    APP_NAMES=$(pm2 jlist | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    if [ -n "$APP_NAMES" ]; then
        echo ""
        echo "=== VCP 应用详情 ==="
        for app_name in $APP_NAMES; do
            pm2 show "$app_name"
        done
    else
        echo ""
        log_warning "没有正在运行的 VCP 应用"
    fi
}

# 查看日志
show_logs() {
    local lines=${1:-50}
    
    log_info "显示所有 VCP 应用日志 (最近 $lines 行):"
    pm2 logs all --lines "$lines"
}

# 实时日志
follow_logs() {
    log_info "实时跟踪所有 VCP 应用日志 (按 Ctrl+C 退出)..."
    pm2 logs all
}

# 监控面板
monitor() {
    log_info "启动 PM2 监控面板..."
    log_info "按 Ctrl+C 退出监控"
    pm2 monit
}

# 保存 PM2 配置
save_config() {
    log_info "保存 PM2 配置..."
    pm2 save
    log_success "PM2 配置已保存"
}

# 设置开机自启
setup_startup() {
    log_info "设置 PM2 开机自启..."
    
    # 生成启动脚本
    STARTUP_CMD=$(pm2 startup | tail -1)
    
    if [[ "$STARTUP_CMD" == sudo* ]]; then
        log_info "执行启动脚本设置..."
        eval "$STARTUP_CMD"
        
        # 保存当前应用列表
        pm2 save
        
        log_success "开机自启设置完成"
        log_info "当前运行的应用将在系统重启后自动启动"
    else
        log_error "无法获取启动脚本"
    fi
}

# 移除开机自启
remove_startup() {
    log_info "移除 PM2 开机自启..."
    pm2 unstartup
    log_success "开机自启已移除"
}

# 重载配置
reload_config() {
    log_info "重载 ecosystem.config.js 配置..."
    
    check_config
    
    # 使用 reload, 它会平滑重启
    pm2 reload ecosystem.config.js
    
    log_success "配置重载完成"
    pm2 list
}

# 清理日志
clean_logs() {
    log_info "清理 PM2 日志..."
    pm2 flush
    log_success "PM2 日志已清理"
    
    # 清理应用日志目录
    if [ -d "debug/logs" ]; then
        read -p "是否清理应用日志目录 debug/logs/? (y/n): " clean_app_logs
        if [[ "$clean_app_logs" == "y" || "$clean_app_logs" == "Y" ]]; then
            rm -f debug/logs/*.log 2>/dev/null || true
            log_success "应用日志已清理"
        fi
    fi
}

# 主菜单
main_menu() {
    echo ""
    echo "=== VCP PM2 管理脚本 ==="
    echo ""
    echo "应用管理:"
    echo "1) 启动应用"
    echo "2) 停止应用"
    echo "3) 重启应用"
    echo "4) 删除应用"
    echo "5) 查看状态"
    echo ""
    echo "日志管理:"
    echo "6) 查看日志"
    echo "7) 实时日志"
    echo "8) 清理日志"
    echo ""
    echo "系统管理:"
    echo "9) 监控面板"
    echo "10) 重载配置"
    echo "11) 设置开机自启"
    echo "12) 移除开机自启"
    echo "13) 保存配置"
    echo ""
    echo "14) 退出"
    echo ""
    read -p "请选择 (1-14): " choice
    
    case $choice in
        1)
            read -p "是否以生产模式启动? (y/n) [默认 n]: " prod_choice
            if [[ "$prod_choice" == "y" || "$prod_choice" == "Y" ]]; then
                start_app "--prod"
            else
                start_app
            fi
            ;;
        2) stop_app ;;
        3) restart_app ;;
        4) delete_app ;;
        5) show_status ;;
        6)
            read -p "显示行数 [默认50]: " lines
            lines=${lines:-50}
            show_logs "$lines"
            ;;
        7) follow_logs ;;
        8) clean_logs ;;
        9) monitor ;;
        10) reload_config ;;
        11) setup_startup ;;
        12) remove_startup ;;
        13) save_config ;;
        14) log_info "退出"; exit 0 ;;
        *) log_error "无效选择"; main_menu ;;
    esac
}

# 如果有参数，直接执行对应功能
if [ $# -gt 0 ]; then
    case $1 in
        "start")
            start_app "$2"
            ;;
        "stop")
            stop_app
            ;;
        "restart")
            restart_app
            ;;
        "delete")
            delete_app
            ;;
        "status")
            show_status
            ;;
        "logs")
            if [ "$2" == "follow" ]; then
                follow_logs
            else
                show_logs "$2"
            fi
            ;;
        "monitor")
            monitor
            ;;
        "reload")
            reload_config
            ;;
        "save")
            save_config
            ;;
        "startup")
            setup_startup
            ;;
        "clean")
            clean_logs
            ;;
        *)
            echo "用法: $0 [start|stop|restart|delete|status|logs|monitor|reload|save|startup|clean] [参数]"
            echo ""
            echo "示例:"
            echo "  $0 start              # 启动 VCP 应用 (开发模式)"
            echo "  $0 start --prod       # 启动 VCP 应用 (生产模式)"
            echo "  $0 stop               # 停止 VCP 应用"
            echo "  $0 restart            # 重启 VCP 应用"
            echo "  $0 status             # 查看应用状态"
            echo "  $0 logs               # 查看应用日志"
            echo "  $0 logs follow        # 实时跟踪日志"
            echo "  $0 monitor            # 启动监控面板"
            exit 1
            ;;
    esac
else
    main_menu
fi