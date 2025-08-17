#!/bin/bash
# VCP 卸载脚本 - 移除所有依赖和相关文件

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

# 停止服务器
stop_server() {
    log_info "停止 VCP 服务器..."
    
    if pgrep -f "node.*server.js" >/dev/null; then
        pkill -f "node.*server.js" || true
        sleep 2
        
        if pgrep -f "node.*server.js" >/dev/null; then
            log_warning "强制停止服务器..."
            pkill -9 -f "node.*server.js" || true
        fi
        
        log_success "服务器已停止"
    else
        log_info "服务器未运行"
    fi
}

# 清理 Node.js 依赖
cleanup_node_deps() {
    log_info "清理 Node.js 依赖..."
    
    # 删除 node_modules 和相关文件
    rm -rf node_modules/ 2>/dev/null || true
    rm -f package-lock.json 2>/dev/null || true
    
    # 清理 npm 缓存
    if command -v npm >/dev/null 2>&1; then
        npm cache clean --force 2>/dev/null || true
        log_success "npm 缓存已清理"
    fi
    
    log_success "Node.js 依赖已清理"
}

# 清理 Python 依赖
cleanup_python_deps() {
    log_info "清理 Python 依赖..."
    
    # 获取已安装的 Python 包列表
    if command -v python3.11 >/dev/null 2>&1; then
        log_info "卸载通过 requirements.txt 安装的包..."
        
        # 主要依赖
        if [ -f "requirements.txt" ]; then
            python3.11 -m pip uninstall -y -r requirements.txt 2>/dev/null || true
        fi
        
        # 插件依赖
        for plugin in SciCalculator VideoGenerator; do
            if [ -f "Plugin/$plugin/requirements.txt" ]; then
                log_info "卸载 $plugin 依赖..."
                python3.11 -m pip uninstall -y -r "Plugin/$plugin/requirements.txt" 2>/dev/null || true
            fi
        done
        
        # 清理 pip 缓存
        python3.11 -m pip cache purge 2>/dev/null || true
        
        log_success "Python 依赖已清理"
    else
        log_info "Python 3.11 未安装，跳过 Python 依赖清理"
    fi
}

# 移除 Python 3.11.9
remove_python3119() {
    log_info "移除 Python 3.11.9..."
    
    if command -v python3.11 >/dev/null 2>&1; then
        # 检查是否通过 PPA 安装
        if dpkg -l | grep -q python3.11; then
            log_info "通过 APT 卸载 Python 3.11..."
            sudo apt-get remove --purge -y python3.11 python3.11-dev python3.11-venv python3.11-distutils 2>/dev/null || true
            sudo apt-get autoremove -y 2>/dev/null || true
        fi
        
        # 检查是否从源码安装（在 /usr/local）
        if [ -f "/usr/local/bin/python3.11" ]; then
            log_info "移除从源码编译的 Python 3.11..."
            sudo rm -f /usr/local/bin/python3.11 2>/dev/null || true
            sudo rm -f /usr/local/bin/pip3.11 2>/dev/null || true
            sudo rm -rf /usr/local/lib/python3.11 2>/dev/null || true
            sudo rm -rf /usr/local/include/python3.11 2>/dev/null || true
            sudo rm -f /usr/local/bin/python3 2>/dev/null || true
            sudo rm -f /usr/local/bin/pip3 2>/dev/null || true
        fi
        
        log_success "Python 3.11.9 已移除"
    else
        log_info "Python 3.11 未安装，跳过"
    fi
}

# 移除 Node.js
remove_nodejs() {
    log_info "移除 Node.js..."
    
    if command -v node >/dev/null 2>&1; then
        # 检查是否通过 NodeSource 仓库安装
        if dpkg -l | grep -q nodejs; then
            log_info "通过 APT 卸载 Node.js..."
            sudo apt-get remove --purge -y nodejs npm 2>/dev/null || true
            sudo apt-get autoremove -y 2>/dev/null || true
            
            # 移除 NodeSource 仓库
            sudo rm -f /etc/apt/sources.list.d/nodesource.list 2>/dev/null || true
            sudo rm -f /usr/share/keyrings/nodesource.gpg 2>/dev/null || true
        fi
        
        # 清理全局 npm 目录
        sudo rm -rf /usr/local/lib/node_modules 2>/dev/null || true
        sudo rm -rf ~/.npm 2>/dev/null || true
        
        log_success "Node.js 已移除"
    else
        log_info "Node.js 未安装，跳过"
    fi
}

# 移除系统依赖
remove_system_deps() {
    log_info "移除系统依赖..."
    
    # 询问是否移除系统依赖（这些可能被其他程序使用）
    read -p "是否移除系统依赖包？这些包可能被其他程序使用 (y/n) [默认: n]: " remove_sys
    
    if [[ "$remove_sys" == "y" || "$remove_sys" == "Y" ]]; then
        log_warning "移除系统依赖包..."
        
        sudo apt-get remove --purge -y \
            build-essential \
            python3-dev \
            gfortran \
            liblapack-dev \
            libopenblas-dev \
            libjpeg-dev \
            zlib1g-dev \
            libfreetype6-dev \
            libssl-dev \
            libffi-dev \
            libsqlite3-dev \
            libbz2-dev \
            libreadline-dev \
            libncurses5-dev \
            libncursesw5-dev \
            xz-utils \
            tk-dev 2>/dev/null || true

        sudo apt-get remove --purge -y     libnss3     libfreetype6     libharfbuzz0b     ca-certificates     fonts-liberation     libappindicator3-1     libasound2     libatk-bridge2.0-0     libdrm2     libxcomposite1     libxdamage1     libxrandr2     libgbm1     libxss1     libgconf-2-4     libxkbcommon0     libgtk-3-0
        # 中文字体
        sudo apt-get remove --purge -y fonts-wqy-microhei 
        
        sudo apt-get autoremove -y 2>/dev/null || true
        
        log_success "系统依赖包已移除"
    else
        log_info "保留系统依赖包"
    fi
}

# 移除 PPA 仓库
remove_ppas() {
    log_info "移除 PPA 仓库..."
    
    # 移除 deadsnakes PPA
    if [ -f "/etc/apt/sources.list.d/deadsnakes-ubuntu-ppa-*.list" ]; then
        sudo add-apt-repository --remove ppa:deadsnakes/ppa -y 2>/dev/null || true
        log_success "deadsnakes PPA 已移除"
    fi
    
    # 更新包列表
    sudo apt-get update 2>/dev/null || true
}

# 清理项目文件
cleanup_project_files() {
    log_info "清理项目文件..."
    
    read -p "是否删除生成的数据文件？(dailynote, image, debug 等) (y/n) [默认: n]: " remove_data
    
    if [[ "$remove_data" == "y" || "$remove_data" == "Y" ]]; then
        log_warning "删除数据文件..."
        rm -rf dailynote/ 2>/dev/null || true
        rm -rf image/ 2>/dev/null || true
        rm -rf debug/ 2>/dev/null || true
        rm -rf TVStxt/ 2>/dev/null || true
        log_success "数据文件已删除"
    else
        log_info "保留数据文件"
    fi
    
    # 清理临时文件
    rm -f *.log 2>/dev/null || true
    rm -f .env 2>/dev/null || true
    
    log_success "项目文件清理完成"
}

# 显示卸载摘要
show_summary() {
    echo ""
    log_info "=== 卸载摘要 ==="
    echo ""
    
    # 检查剩余组件
    echo "剩余组件检查："
    
    if command -v node >/dev/null 2>&1; then
        log_warning "× Node.js 仍然存在: $(node -v)"
    else
        log_success "✓ Node.js 已移除"
    fi
    
    if command -v python3.11 >/dev/null 2>&1; then
        log_warning "× Python 3.11 仍然存在: $(python3.11 --version)"
    else
        log_success "✓ Python 3.11 已移除"
    fi
    
    if [ -d "node_modules" ]; then
        log_warning "× node_modules 目录仍然存在"
    else
        log_success "✓ node_modules 已清理"
    fi
    
    echo ""
    log_info "如果需要完全清理系统，建议运行："
    echo "  sudo apt-get autoremove"
    echo "  sudo apt-get autoclean"
    echo ""
}

# 主菜单
main_menu() {
    echo ""
    log_warning "=== VCP 卸载脚本 ==="
    log_warning "此操作将移除 VCP 应用及其依赖"
    echo ""
    echo "卸载选项："
    echo "1) 完全卸载 (移除所有组件和依赖)"
    echo "2) 仅清理应用依赖 (保留 Node.js 和 Python)"
    echo "3) 仅清理项目文件"
    echo "4) 自定义卸载"
    echo "5) 取消"
    echo ""
    read -p "请选择 (1-5): " choice
    
    case $choice in
        1)
            log_warning "执行完全卸载..."
            stop_server
            cleanup_node_deps
            cleanup_python_deps
            remove_python3119
            remove_nodejs
            remove_system_deps
            remove_ppas
            cleanup_project_files
            show_summary
            log_success "完全卸载完成！"
            ;;
        2)
            log_info "清理应用依赖..."
            stop_server
            cleanup_node_deps
            cleanup_python_deps
            cleanup_project_files
            log_success "应用依赖清理完成！"
            ;;
        3)
            log_info "清理项目文件..."
            stop_server
            cleanup_node_deps
            cleanup_project_files
            log_success "项目文件清理完成！"
            ;;
        4)
            log_info "自定义卸载..."
            echo ""
            echo "请选择要执行的操作："
            
            read -p "停止服务器? (y/n): " do_stop
            [[ "$do_stop" == "y" ]] && stop_server
            
            read -p "清理 Node.js 依赖? (y/n): " do_node
            [[ "$do_node" == "y" ]] && cleanup_node_deps
            
            read -p "清理 Python 依赖? (y/n): " do_python
            [[ "$do_python" == "y" ]] && cleanup_python_deps
            
            read -p "移除 Python 3.11.9? (y/n): " do_remove_python
            [[ "$do_remove_python" == "y" ]] && remove_python3119
            
            read -p "移除 Node.js? (y/n): " do_remove_node
            [[ "$do_remove_node" == "y" ]] && remove_nodejs
            
            read -p "移除系统依赖? (y/n): " do_remove_sys
            [[ "$do_remove_sys" == "y" ]] && remove_system_deps
            
            read -p "清理项目文件? (y/n): " do_cleanup
            [[ "$do_cleanup" == "y" ]] && cleanup_project_files
            
            show_summary
            log_success "自定义卸载完成！"
            ;;
        5)
            log_info "取消卸载"
            exit 0
            ;;
        *)
            log_error "无效选择"
            main_menu
            ;;
    esac
}

# 安全检查
safety_check() {
    echo ""
    log_warning "⚠️  警告：此操作将移除 VCP 应用及其依赖"
    log_warning "⚠️  请确保您已备份重要数据"
    echo ""
    read -p "确认继续卸载? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "卸载已取消"
        exit 0
    fi
}

# 如果有参数，直接执行对应功能
if [ $# -gt 0 ]; then
    case $1 in
        "full")
            safety_check
            stop_server
            cleanup_node_deps
            cleanup_python_deps
            remove_python3119
            remove_nodejs
            remove_system_deps
            remove_ppas
            cleanup_project_files
            show_summary
            ;;
        "deps")
            stop_server
            cleanup_node_deps
            cleanup_python_deps
            cleanup_project_files
            ;;
        "clean")
            stop_server
            cleanup_node_deps
            cleanup_project_files
            ;;
        *)
            echo "用法: $0 [full|deps|clean]"
            echo "  full  - 完全卸载"
            echo "  deps  - 仅清理依赖"
            echo "  clean - 仅清理项目文件"
            exit 1
            ;;
    esac
else
    safety_check
    main_menu
fi