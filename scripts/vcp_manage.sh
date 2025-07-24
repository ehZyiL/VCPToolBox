#!/bin/bash
# VCP 管理脚本 - 合并版本
# 包含：启动、停止、状态检查、诊断

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

# 启动服务器
start_server() {
    log_info "启动 VCP 服务器..."
    
    if [ ! -f "server.js" ]; then
        log_error "server.js 不存在"
        exit 1
    fi
    
    # 检查是否已经在运行
    if pgrep -f "node.*server.js" >/dev/null; then
        log_warning "VCP 服务器已在运行"
        ps aux | grep "node.*server.js" | grep -v grep
        return 0
    fi
    
    # 检查端口是否被占用
    if command -v netstat >/dev/null 2>&1; then
        if netstat -tlnp 2>/dev/null | grep ":6005 " >/dev/null; then
            log_error "端口 6005 已被占用"
            netstat -tlnp 2>/dev/null | grep ":6005 "
            exit 1
        fi
    fi
    
    # 检查关键依赖
    if [ ! -d "node_modules" ]; then
        log_error "node_modules 不存在，请先安装依赖"
        log_info "运行: ./scripts/vcp_setup.sh deps"
        exit 1
    fi
    
    # 创建日志目录
    mkdir -p DebugLog
    
    # 后台启动服务器
    log_info "在后台启动服务器..."
    nohup node server.js > DebugLog/server_output.log 2>&1 &
    SERVER_PID=$!
    
    # 等待服务器启动
    sleep 3
    
    # 检查服务器是否成功启动
    if kill -0 $SERVER_PID 2>/dev/null; then
        log_success "VCP 服务器已启动 (PID: $SERVER_PID)"
        log_info "服务器日志: DebugLog/server_output.log"
        log_info "使用 './scripts/vcp_manage.sh stop' 停止服务器"
        log_info "使用 './scripts/vcp_manage.sh logs' 查看实时日志"
    else
        log_error "服务器启动失败"
        log_info "查看日志: cat DebugLog/server_output.log"
        exit 1
    fi
}

# 检查服务器状态
check_status() {
    log_info "检查服务器状态..."
    
    echo ""
    echo "=== 进程状态 ==="
    
    # 检查进程
    if pgrep -f "node.*server.js" >/dev/null; then
        log_success "VCP 服务器正在运行"
        
        # 获取进程详细信息
        SERVER_PID=$(pgrep -f "node.*server.js" | head -1)
        echo "进程 ID: $SERVER_PID"
        
        # 显示进程信息（CPU、内存使用率）
        if command -v ps >/dev/null 2>&1; then
            echo ""
            echo "进程详细信息:"
            ps -p "$SERVER_PID" -o pid,ppid,user,%cpu,%mem,vsz,rss,tty,stat,start,time,cmd --no-headers 2>/dev/null || \
            ps aux | grep "node.*server.js" | grep -v grep | head -1
        fi
        
        # 显示进程运行时间
        if [ -f "/proc/$SERVER_PID/stat" ]; then
            START_TIME=$(stat -c %Y /proc/$SERVER_PID 2>/dev/null)
            if [ -n "$START_TIME" ]; then
                CURRENT_TIME=$(date +%s)
                UPTIME=$((CURRENT_TIME - START_TIME))
                UPTIME_FORMATTED=$(date -u -d @$UPTIME +"%H:%M:%S" 2>/dev/null || echo "${UPTIME}秒")
                echo "运行时间: $UPTIME_FORMATTED"
            fi
        fi
        
    else
        log_warning "VCP 服务器未运行"
    fi
    
    echo ""
    echo "=== 端口状态 ==="
    
    # 检查端口
    if command -v netstat >/dev/null 2>&1; then
        if netstat -tlnp 2>/dev/null | grep ":6005 " >/dev/null; then
            log_success "端口 6005 正在监听"
            netstat -tlnp 2>/dev/null | grep ":6005 "
        else
            log_warning "端口 6005 未监听"
        fi
    elif command -v ss >/dev/null 2>&1; then
        if ss -tlnp 2>/dev/null | grep ":6005 " >/dev/null; then
            log_success "端口 6005 正在监听"
            ss -tlnp 2>/dev/null | grep ":6005 "
        else
            log_warning "端口 6005 未监听"
        fi
    else
        log_warning "无法检查端口状态（netstat 和 ss 命令都不可用）"
    fi
    
    echo ""
    echo "=== 系统资源占用 ==="
    
    # 系统整体资源使用情况
    echo "系统负载: $(uptime | awk -F'load average:' '{print $2}' | xargs)"
    
    # CPU 使用率
    if command -v top >/dev/null 2>&1; then
        CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
        echo "CPU 使用率: ${CPU_USAGE}%"
    fi
    
    # 内存使用情况
    if command -v free >/dev/null 2>&1; then
        MEMORY_INFO=$(free -h | grep "Mem:")
        TOTAL_MEM=$(echo $MEMORY_INFO | awk '{print $2}')
        USED_MEM=$(echo $MEMORY_INFO | awk '{print $3}')
        FREE_MEM=$(echo $MEMORY_INFO | awk '{print $4}')
        USAGE_PERCENT=$(free | grep "Mem:" | awk '{printf "%.1f", $3/$2 * 100.0}')
        
        echo "内存使用: $USED_MEM / $TOTAL_MEM (${USAGE_PERCENT}%)"
        echo "可用内存: $FREE_MEM"
    fi
    
    # 磁盘使用情况
    if command -v df >/dev/null 2>&1; then
        DISK_INFO=$(df -h . | tail -1)
        DISK_USAGE=$(echo $DISK_INFO | awk '{print $5}')
        DISK_USED=$(echo $DISK_INFO | awk '{print $3}')
        DISK_TOTAL=$(echo $DISK_INFO | awk '{print $2}')
        
        echo "磁盘使用: $DISK_USED / $DISK_TOTAL ($DISK_USAGE)"
    fi
    
    # 如果服务器在运行，显示其资源占用
    if [ -n "$SERVER_PID" ]; then
        echo ""
        echo "=== VCP 服务器资源占用 ==="
        
        # Node.js 进程的详细资源使用
        if command -v ps >/dev/null 2>&1; then
            NODE_CPU=$(ps -p "$SERVER_PID" -o %cpu --no-headers 2>/dev/null | xargs)
            NODE_MEM=$(ps -p "$SERVER_PID" -o %mem --no-headers 2>/dev/null | xargs)
            NODE_VSZ=$(ps -p "$SERVER_PID" -o vsz --no-headers 2>/dev/null | xargs)
            NODE_RSS=$(ps -p "$SERVER_PID" -o rss --no-headers 2>/dev/null | xargs)
            
            if [ -n "$NODE_CPU" ]; then
                echo "CPU 使用率: ${NODE_CPU}%"
            fi
            if [ -n "$NODE_MEM" ]; then
                echo "内存使用率: ${NODE_MEM}%"
            fi
            if [ -n "$NODE_VSZ" ]; then
                NODE_VSZ_MB=$((NODE_VSZ / 1024))
                echo "虚拟内存: ${NODE_VSZ_MB} MB"
            fi
            if [ -n "$NODE_RSS" ]; then
                NODE_RSS_MB=$((NODE_RSS / 1024))
                echo "物理内存: ${NODE_RSS_MB} MB"
            fi
        fi
        
        # 文件描述符使用情况
        if [ -d "/proc/$SERVER_PID/fd" ]; then
            FD_COUNT=$(ls /proc/$SERVER_PID/fd 2>/dev/null | wc -l)
            echo "打开的文件描述符: $FD_COUNT"
        fi
        
        # 网络连接数
        if command -v netstat >/dev/null 2>&1; then
            CONN_COUNT=$(netstat -an 2>/dev/null | grep ":6005 " | wc -l)
            echo "网络连接数: $CONN_COUNT"
        elif command -v ss >/dev/null 2>&1; then
            CONN_COUNT=$(ss -an 2>/dev/null | grep ":6005 " | wc -l)
            echo "网络连接数: $CONN_COUNT"
        fi
    fi
    
    echo ""
    echo "=== 日志文件状态 ==="
    
    # 检查日志文件
    if [ -f "DebugLog/server_output.log" ]; then
        LOG_SIZE=$(du -h DebugLog/server_output.log 2>/dev/null | cut -f1)
        LOG_LINES=$(wc -l < DebugLog/server_output.log 2>/dev/null || echo "0")
        LOG_MODIFIED=$(stat -c %y DebugLog/server_output.log 2>/dev/null | cut -d'.' -f1)
        
        log_success "输出日志文件存在"
        echo "文件大小: $LOG_SIZE"
        echo "行数: $LOG_LINES"
        echo "最后修改: $LOG_MODIFIED"
    else
        log_warning "输出日志文件不存在"
    fi
    
    # 检查应用内部日志
    if [ -d "DebugLog" ]; then
        LATEST_APP_LOG=$(ls -t DebugLog/ServerLog-*.txt 2>/dev/null | head -1)
        if [ -n "$LATEST_APP_LOG" ]; then
            APP_LOG_SIZE=$(du -h "$LATEST_APP_LOG" 2>/dev/null | cut -f1)
            APP_LOG_MODIFIED=$(stat -c %y "$LATEST_APP_LOG" 2>/dev/null | cut -d'.' -f1)
            
            log_success "应用日志文件存在"
            echo "最新日志: $(basename "$LATEST_APP_LOG")"
            echo "文件大小: $APP_LOG_SIZE"
            echo "最后修改: $APP_LOG_MODIFIED"
        else
            log_warning "未找到应用日志文件"
        fi
    fi
    
    echo ""
    log_success "状态检查完成"
}

# 停止服务器
stop_server() {
    log_info "停止 VCP 服务器..."
    
    if pgrep -f "node.*server.js" >/dev/null; then
        pkill -f "node.*server.js"
        sleep 2
        
        if pgrep -f "node.*server.js" >/dev/null; then
            log_warning "强制停止服务器..."
            pkill -9 -f "node.*server.js"
        fi
        
        log_success "服务器已停止"
    else
        log_warning "服务器未运行"
    fi
}

# 重启服务器
restart_server() {
    log_info "重启 VCP 服务器..."
    stop_server
    sleep 1
    start_server
}

# 系统诊断
diagnose_system() {
    log_info "=== 系统诊断 ==="
    
    # 系统信息
    echo ""
    log_info "系统信息:"
    echo "操作系统: $(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
    echo "内核: $(uname -r)"
    echo "架构: $(uname -m)"
    echo "内存: $(free -h | grep Mem | awk '{print $3"/"$2}')"
    echo "磁盘: $(df -h . | tail -1 | awk '{print $3"/"$2" ("$5" 已使用)"}')"
    
    # 软件版本
    echo ""
    log_info "软件版本:"
    echo "Node.js: $(node -v 2>/dev/null || echo '未安装')"
    echo "npm: $(npm -v 2>/dev/null || echo '未安装')"
    echo "Python3: $(python3 --version 2>/dev/null || echo '未安装')"
    echo "Python3.11: $(python3.11 --version 2>/dev/null || echo '未安装')"
    echo "Git: $(git --version 2>/dev/null || echo '未安装')"
    
    # 网络连接
    echo ""
    log_info "网络连接测试:"
    URLS=("https://registry.npmmirror.com" "https://pypi.tuna.tsinghua.edu.cn" "https://github.com")
    for url in "${URLS[@]}"; do
        if curl -s --connect-timeout 5 "$url" >/dev/null 2>&1; then
            log_success "✓ $url"
        else
            log_error "× $url"
        fi
    done
    
    # 文件检查
    echo ""
    log_info "项目文件检查:"
    FILES=("package.json" "server.js" "requirements.txt" "WebSocketServer.js")
    for file in "${FILES[@]}"; do
        if [ -f "$file" ]; then
            log_success "✓ $file"
        else
            log_warning "× $file"
        fi
    done
    
    # 依赖检查
    echo ""
    log_info "关键依赖检查:"
    if [ -d "node_modules" ]; then
        MODULES=("ws" "express" "cors" "dotenv" "axios")
        for module in "${MODULES[@]}"; do
            if [ -d "node_modules/$module" ]; then
                log_success "✓ $module"
            else
                log_warning "× $module"
            fi
        done
    else
        log_warning "node_modules 目录不存在"
    fi
    
    echo ""
    log_success "诊断完成"
}

# 前台启动服务器
start_server_foreground() {
    log_info "在前台启动 VCP 服务器..."
    log_warning "使用 Ctrl+C 将停止服务器"
    
    if [ ! -f "server.js" ]; then
        log_error "server.js 不存在"
        exit 1
    fi
    
    # 检查是否已经在运行
    if pgrep -f "node.*server.js" >/dev/null; then
        log_error "VCP 服务器已在运行，请先停止"
        exit 1
    fi
    
    # 检查关键依赖
    if [ ! -d "node_modules" ]; then
        log_error "node_modules 不存在，请先安装依赖"
        log_info "运行: ./scripts/vcp_setup.sh deps"
        exit 1
    fi
    
    log_success "启动服务器（前台模式）..."
    node server.js
}

# 查看日志
view_logs() {
    log_info "查看服务器日志..."
    
    echo ""
    echo "可用的日志文件："
    echo "1) 实时输出日志 (server_output.log)"
    echo "2) 应用内部日志 (ServerLog-*.txt)"
    echo "3) 实时跟踪日志"
    echo ""
    read -p "请选择 (1-3): " log_choice
    
    case $log_choice in
        1)
            if [ -f "DebugLog/server_output.log" ]; then
                log_info "显示服务器输出日志:"
                tail -50 DebugLog/server_output.log
            else
                log_warning "server_output.log 不存在"
            fi
            ;;
        2)
            if [ -d "DebugLog" ]; then
                LATEST_LOG=$(ls -t DebugLog/ServerLog-*.txt 2>/dev/null | head -1)
                if [ -n "$LATEST_LOG" ]; then
                    log_info "显示最新应用日志: $LATEST_LOG"
                    tail -50 "$LATEST_LOG"
                else
                    log_warning "未找到 ServerLog 文件"
                fi
            else
                log_warning "DebugLog 目录不存在"
            fi
            ;;
        3)
            log_info "实时跟踪日志 (按 Ctrl+C 退出)..."
            if [ -f "DebugLog/server_output.log" ]; then
                tail -f DebugLog/server_output.log
            else
                log_warning "server_output.log 不存在"
            fi
            ;;
        *)
            log_error "无效选择"
            ;;
    esac
}

# 主菜单
main_menu() {
    echo ""
    echo "=== VCP 管理脚本 ==="
    echo ""
    echo "1) 启动服务器 (后台)"
    echo "2) 启动服务器 (前台)"
    echo "3) 停止服务器"
    echo "4) 重启服务器"
    echo "5) 检查状态"
    echo "6) 系统诊断"
    echo "7) 查看日志"
    echo "8) 退出"
    echo ""
    read -p "请选择 (1-8): " choice
    
    case $choice in
        1) start_server ;;
        2) start_server_foreground ;;
        3) stop_server ;;
        4) restart_server ;;
        5) check_status ;;
        6) diagnose_system ;;
        7) view_logs ;;
        8) log_info "退出"; exit 0 ;;
        *) log_error "无效选择"; main_menu ;;
    esac
}

# 如果有参数，直接执行对应功能
if [ $# -gt 0 ]; then
    case $1 in
        "start") start_server ;;
        "foreground") start_server_foreground ;;
        "stop") stop_server ;;
        "restart") restart_server ;;
        "status") check_status ;;
        "diagnose") diagnose_system ;;
        "logs") view_logs ;;
        *) echo "用法: $0 [start|foreground|stop|restart|status|diagnose|logs]"; exit 1 ;;
    esac
else
    main_menu
fi