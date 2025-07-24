#!/bin/bash
# VCP 更新脚本 - 合并版本
# 包含：Git 更新、依赖更新、问题修复

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

# Git 更新
update_code() {
    log_info "更新代码..."
    if [ -d ".git" ]; then
        git pull
        log_success "代码更新完成"
    else
        log_warning "不是 Git 仓库，跳过代码更新"
    fi
}

# 修复 npm 安装问题
fix_npm_issues() {
    log_info "修复 npm 安装问题..."
    
    # 清理环境
    rm -rf node_modules/ package-lock.json 2>/dev/null || true
    npm cache clean --force 2>/dev/null || true
    
    # 优化配置
    npm config set maxsockets 5
    
    log_success "npm 环境清理完成"
}

# 更新 Node.js 依赖
update_node_deps() {
    log_info "更新 Node.js 依赖..."
    
    if [ ! -f "package.json" ]; then
        log_warning "package.json 不存在，跳过 Node.js 依赖更新"
        return
    fi
    
    # 尝试多个镜像源
    npm config set registry https://registry.npmmirror.com
    
    if ! npm install --no-audit --no-fund; then
        log_warning "淘宝镜像失败，尝试官方源..."
        npm config set registry https://registry.npmjs.org
        
        if ! npm install --no-audit --no-fund; then
            log_error "Node.js 依赖更新失败"
            return 1
        fi
    fi
    
    log_success "Node.js 依赖更新完成"
}

# 更新 Python 依赖
update_python_deps() {
    log_info "更新 Python 依赖..."
    
    # 检查 Python 3.11
    if ! command -v python3.11 &> /dev/null; then
        log_warning "Python 3.11 未安装，跳过 Python 依赖更新"
        return
    fi
    
    # 主要依赖
    if [ -f "requirements.txt" ]; then
        python3.11 -m pip install -U -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    fi
    
    # 插件依赖
    for plugin in SciCalculator VideoGenerator; do
        if [ -f "Plugin/$plugin/requirements.txt" ]; then
            log_info "更新 $plugin 依赖..."
            python3.11 -m pip install -U -r "Plugin/$plugin/requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple
        fi
    done
    
    log_success "Python 依赖更新完成"
}

# 验证安装
verify_installation() {
    log_info "验证安装..."
    
    # 检查关键 Node.js 模块
    MISSING_MODULES=()
    for module in ws express cors dotenv axios; do
        if [ -d "node_modules/$module" ]; then
            log_info "✓ $module"
        else
            log_warning "× $module 缺失"
            MISSING_MODULES+=("$module")
        fi
    done
    
    # 安装缺失模块
    if [ ${#MISSING_MODULES[@]} -gt 0 ]; then
        log_warning "安装缺失的模块..."
        for module in "${MISSING_MODULES[@]}"; do
            npm install "$module" || log_error "$module 安装失败"
        done
    fi
    
    # 检查服务器文件
    if [ -f "server.js" ]; then
        log_success "server.js 存在"
    else
        log_error "server.js 不存在"
    fi
    
    log_success "验证完成"
}

# 主菜单
main_menu() {
    echo ""
    echo "=== VCP 更新脚本 ==="
    echo ""
    echo "1) 完整更新 (代码 + 所有依赖)"
    echo "2) 仅更新代码"
    echo "3) 仅更新依赖"
    echo "4) 修复 npm 问题"
    echo "5) 验证安装"
    echo "6) 退出"
    echo ""
    read -p "请选择 (1-6): " choice
    
    case $choice in
        1)
            update_code
            fix_npm_issues
            update_node_deps
            update_python_deps
            verify_installation
            log_success "完整更新完成！"
            ;;
        2)
            update_code
            log_success "代码更新完成！"
            ;;
        3)
            fix_npm_issues
            update_node_deps
            update_python_deps
            verify_installation
            log_success "依赖更新完成！"
            ;;
        4)
            fix_npm_issues
            update_node_deps
            log_success "npm 问题修复完成！"
            ;;
        5)
            verify_installation
            ;;
        6)
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
        "full")
            update_code
            fix_npm_issues
            update_node_deps
            update_python_deps
            verify_installation
            ;;
        "code")
            update_code
            ;;
        "deps")
            fix_npm_issues
            update_node_deps
            update_python_deps
            ;;
        "fix")
            fix_npm_issues
            update_node_deps
            ;;
        *)
            echo "用法: $0 [full|code|deps|fix]"
            exit 1
            ;;
    esac
else
    main_menu
fi