#!/bin/bash
# VCP 一键安装脚本 - 合并版本
# 包含：系统依赖安装、Python 3.11.9、Node.js 依赖、启动功能

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

# 检查系统
check_system() {
    if [ ! -f /etc/debian_version ]; then
        log_error "此脚本仅适用于 Debian/Ubuntu 系统"
        exit 1
    fi
    log_info "检测到 Debian/Ubuntu 系统: $(cat /etc/debian_version)"
}

# 安装系统依赖
install_system_deps() {
    log_info "安装系统依赖..."
    
    if ! sudo -n true 2>/dev/null; then
        log_warning "需要 sudo 权限来安装系统依赖"
    fi
    
    sudo apt-get update
    sudo apt-get install -y \
        curl wget git build-essential \
        python3 python3-pip python3-dev \
        gfortran liblapack-dev libopenblas-dev \
        libjpeg-dev zlib1g-dev libfreetype6-dev \
        software-properties-common libssl-dev libffi-dev \
        libsqlite3-dev libbz2-dev libreadline-dev \
        libncurses5-dev libncursesw5-dev xz-utils tk-dev
    
    # UrlFetch插件puppeteer需要的依赖
    sudo apt-get install -y     libnss3     libfreetype6     libharfbuzz0b     ca-certificates     fonts-liberation     libappindicator3-1     libasound2     libatk-bridge2.0-0     libdrm2     libxcomposite1     libxdamage1     libxrandr2     libgbm1     libxss1     libgconf-2-4     libxkbcommon0     libgtk-3-0
    # 中文字体
    sudo apt-get install -y fonts-wqy-microhei 

    log_success "系统依赖安装完成"
}

# 安装 Python 3.11.9
install_python3119() {
    log_info "检查 Python 3.11.9..."
    
    if command -v python3.11 &> /dev/null; then
        VERSION=$(python3.11 --version 2>&1 | cut -d' ' -f2)
        if [[ "$VERSION" == "3.11.9" ]]; then
            log_success "Python 3.11.9 已安装"
            return 0
        fi
    fi
    
    log_info "安装 Python 3.11.9..."
    
    # 尝试 PPA
    if grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
        sudo apt-get install -y software-properties-common
        sudo add-apt-repository ppa:deadsnakes/ppa -y
        sudo apt-get update
        
        if sudo apt-get install -y python3.11 python3.11-dev python3.11-venv; then
            curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11
            log_success "通过 PPA 安装 Python 3.11 完成"
            return 0
        fi
    fi
    
    # 从源码编译
    log_info "从源码编译 Python 3.11.9..."
    TEMP_DIR=$(mktemp -d)
    ORIGINAL_DIR=$(pwd)
    cd "$TEMP_DIR"
    
    wget https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz
    tar -xzf Python-3.11.9.tgz
    cd Python-3.11.9
    
    ./configure --enable-optimizations --with-ensurepip=install --prefix=/usr/local
    make -j$(nproc)
    sudo make altinstall
    
    cd "$ORIGINAL_DIR"
    rm -rf "$TEMP_DIR"
    
    if command -v python3.11 &> /dev/null; then
        log_success "Python 3.11.9 编译安装完成"
    else
        log_error "Python 3.11.9 安装失败"
        exit 1
    fi
}

# 安装 Node.js
install_nodejs() {
    log_info "检查 Node.js..."
    
    if command -v node &> /dev/null; then
        VERSION=$(node -v | sed 's/v\([0-9]*\).*/\1/')
        if [ "$VERSION" -ge 18 ]; then
            log_success "Node.js 版本满足要求: $(node -v)"
            return 0
        fi
    fi
    
    log_info "安装 Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    log_success "Node.js 安装完成: $(node -v)"
}

# 安装 Node.js 依赖
install_node_deps() {
    log_info "安装 Node.js 依赖..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json 不存在"
        exit 1
    fi
    
    # 清理环境
    rm -rf node_modules/ package-lock.json 2>/dev/null || true
    npm cache clean --force 2>/dev/null || true
    
    # 配置 npm
    npm config set registry https://registry.npmmirror.com
    
    # 安装依赖
    if ! npm install --no-audit --no-fund; then
        log_warning "淘宝镜像失败，尝试官方源..."
        npm config set registry https://registry.npmjs.org
        npm install --no-audit --no-fund || {
            log_error "依赖安装失败"
            exit 1
        }
    fi
    
    # 验证关键模块
    for module in ws express cors dotenv axios; do
        if [ -d "node_modules/$module" ]; then
            log_info "✓ $module"
        else
            log_warning "× $module 缺失，尝试单独安装..."
            npm install "$module"
        fi
    done
    
    log_success "Node.js 依赖安装完成"
}

# 安装 Python 依赖
install_python_deps() {
    log_info "安装 Python 依赖..."
    requirements
    # 主要依赖
    if [ -f "requirements.txt" ]; then
        python3.11 -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    fi
    
    # 插件依赖
    for plugin in SciCalculator VideoGenerator; do
        if [ -f "Plugin/$plugin/requirements.txt" ]; then
            log_info "安装 $plugin 依赖..."
            python3.11 -m pip install -r "Plugin/$plugin/requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple
        fi
    done

    log_success "Python 依赖安装完成"
}

# 创建目录结构
create_directories() {
    log_info "创建目录结构..."
    mkdir -p Plugin dailynote image TVStxt Agent DebugLog
    log_success "目录结构创建完成"
}

# 启动服务器
start_server() {
    log_info "启动 VCP 服务器..."
    if [ -f "server.js" ]; then
        node server.js
    else
        log_error "server.js 不存在"
        exit 1
    fi
}

# 主菜单
main_menu() {
    echo ""
    echo "=== VCP 安装和管理脚本 ==="
    echo ""
    echo "1) 全新安装 (系统依赖 + Python 3.11.9 + Node.js + 应用依赖)"
    echo "2) 仅安装应用依赖 (Node.js + Python 依赖)"
    echo "3) 启动服务器"
    echo "4) 退出"
    echo ""
    read -p "请选择 (1-4): " choice
    
    case $choice in
        1)
            check_system
            install_system_deps
            install_python3119
            install_nodejs
            install_node_deps
            install_python_deps
            create_directories
            log_success "全新安装完成！"
            read -p "是否立即启动服务器? (y/n): " start
            if [[ "$start" == "y" || "$start" == "Y" ]]; then
                start_server
            fi
            ;;
        2)
            install_node_deps
            install_python_deps
            log_success "应用依赖安装完成！"
            read -p "是否立即启动服务器? (y/n): " start
            if [[ "$start" == "y" || "$start" == "Y" ]]; then
                start_server
            fi
            ;;
        3)
            start_server
            ;;
        4)
            log_info "退出"
            exit 0
            ;;
        *)
            log_error "无效选择"
            main_menu
            ;;
    esac
}

# 如果有参数，直接执行对应功能
if [ $# -gt 0 ]; then
    case $1 in
        "install")
            check_system
            install_system_deps
            install_python3119
            install_nodejs
            install_node_deps
            install_python_deps
            create_directories
            ;;
        "deps")
            install_node_deps
            install_python_deps
            ;;
        "start")
            start_server
            ;;
        *)
            echo "用法: $0 [install|deps|start]"
            exit 1
            ;;
    esac
else
    main_menu
fi