#!/bin/bash
# VCP 实时监控脚本

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

# 清屏函数
clear_screen() {
    clear
    echo "=== VCP 服务器实时监控 ==="
    echo "按 Ctrl+C 退出监控"
    echo "更新间隔: ${INTERVAL}秒"
    echo ""
}

# 获取服务器状态
get_server_status() {
    if pgrep -f "node.*server.js" >/dev/null; then
        SERVER_PID=$(pgrep -f "node.*server.js" | head -1)
        echo -e "${GREEN}● 运行中${NC} (PID: $SERVER_PID)"
        
        # 运行时间
        if [ -f "/proc/$SERVER_PID/stat" ]; then
            START_TIME=$(stat -c %Y /proc/$SERVER_PID 2>/dev/null)
            if [ -n "$START_TIME" ]; then
                CURRENT_TIME=$(date +%s)
                UPTIME=$((CURRENT_TIME - START_TIME))
                UPTIME_FORMATTED=$(date -u -d @$UPTIME +"%H:%M:%S" 2>/dev/null || echo "${UPTIME}秒")
                echo "运行时间: $UPTIME_FORMATTED"
            fi
        fi
        
        return 0
    else
        echo -e "${RED}● 已停止${NC}"
        return 1
    fi
}

# 获取资源使用情况
get_resource_usage() {
    if [ -n "$SERVER_PID" ]; then
        # CPU 和内存使用率
        if command -v ps >/dev/null 2>&1; then
            RESOURCE_INFO=$(ps -p "$SERVER_PID" -o %cpu,%mem,vsz,rss --no-headers 2>/dev/null)
            if [ -n "$RESOURCE_INFO" ]; then
                CPU=$(echo $RESOURCE_INFO | awk '{print $1}')
                MEM=$(echo $RESOURCE_INFO | awk '{print $2}')
                VSZ=$(echo $RESOURCE_INFO | awk '{print $3}')
                RSS=$(echo $RESOURCE_INFO | awk '{print $4}')
                
                VSZ_MB=$((VSZ / 1024))
                RSS_MB=$((RSS / 1024))
                
                echo "CPU: ${CPU}% | 内存: ${MEM}% | 虚拟内存: ${VSZ_MB}MB | 物理内存: ${RSS_MB}MB"
            fi
        fi
        
        # 文件描述符
        if [ -d "/proc/$SERVER_PID/fd" ]; then
            FD_COUNT=$(ls /proc/$SERVER_PID/fd 2>/dev/null | wc -l)
            echo "文件描述符: $FD_COUNT"
        fi
        
        # 网络连接
        if command -v netstat >/dev/null 2>&1; then
            CONN_COUNT=$(netstat -an 2>/dev/null | grep ":6005 " | wc -l)
            ESTABLISHED_COUNT=$(netstat -an 2>/dev/null | grep ":6005.*ESTABLISHED" | wc -l)
            echo "网络连接: $CONN_COUNT (活跃: $ESTABLISHED_COUNT)"
        fi
    fi
}

# 获取系统资源
get_system_resources() {
    # 系统负载
    LOAD=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    echo "系统负载: $LOAD"
    
    # 内存使用
    if command -v free >/dev/null 2>&1; then
        MEMORY_INFO=$(free -h | grep "Mem:")
        USED_MEM=$(echo $MEMORY_INFO | awk '{print $3}')
        TOTAL_MEM=$(echo $MEMORY_INFO | awk '{print $2}')
        USAGE_PERCENT=$(free | grep "Mem:" | awk '{printf "%.1f", $3/$2 * 100.0}')
        echo "系统内存: $USED_MEM / $TOTAL_MEM (${USAGE_PERCENT}%)"
    fi
    
    # 磁盘使用
    if command -v df >/dev/null 2>&1; then
        DISK_INFO=$(df -h . | tail -1)
        DISK_USAGE=$(echo $DISK_INFO | awk '{print $5}')
        echo "磁盘使用: $DISK_USAGE"
    fi
}

# 获取日志信息
get_log_info() {
    if [ -f "DebugLog/server_output.log" ]; then
        LOG_SIZE=$(du -h DebugLog/server_output.log 2>/dev/null | cut -f1)
        LOG_LINES=$(wc -l < DebugLog/server_output.log 2>/dev/null || echo "0")
        echo "输出日志: $LOG_SIZE ($LOG_LINES 行)"
        
        # 显示最后几行日志
        echo ""
        echo "最近日志 (最后5行):"
        tail -5 DebugLog/server_output.log 2>/dev/null | while read line; do
            echo "  $line"
        done
    else
        echo "输出日志: 不存在"
    fi
}

# 主监控循环
monitor_loop() {
    while true; do
        clear_screen
        
        echo "=== 服务器状态 ==="
        get_server_status
        SERVER_RUNNING=$?
        
        echo ""
        echo "=== 资源使用 ==="
        if [ $SERVER_RUNNING -eq 0 ]; then
            get_resource_usage
        else
            echo "服务器未运行"
        fi
        
        echo ""
        echo "=== 系统资源 ==="
        get_system_resources
        
        echo ""
        echo "=== 日志信息 ==="
        get_log_info
        
        echo ""
        echo "$(date '+%Y-%m-%d %H:%M:%S') - 下次更新: ${INTERVAL}秒后"
        
        sleep $INTERVAL
    done
}

# 信号处理
cleanup() {
    echo ""
    log_info "监控已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 参数处理
INTERVAL=${1:-3}  # 默认3秒更新一次

# 验证间隔参数
if ! [[ "$INTERVAL" =~ ^[0-9]+$ ]] || [ "$INTERVAL" -lt 1 ]; then
    log_error "无效的更新间隔: $INTERVAL"
    echo "用法: $0 [更新间隔秒数]"
    echo "示例: $0 5  # 每5秒更新一次"
    exit 1
fi

# 检查是否有服务器进程
if ! pgrep -f "node.*server.js" >/dev/null; then
    log_warning "VCP 服务器当前未运行"
    echo "您仍然可以监控系统资源，或者先启动服务器："
    echo "  ./scripts/vcp_manage.sh start"
    echo ""
    read -p "是否继续监控? (y/n): " continue_monitor
    if [[ "$continue_monitor" != "y" && "$continue_monitor" != "Y" ]]; then
        exit 0
    fi
fi

log_info "开始监控 VCP 服务器..."
log_info "更新间隔: ${INTERVAL}秒"

# 开始监控
monitor_loop