#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="${1:-$PROJECT_DIR/../1-deploy}"
DEPLOY_DIR="$(cd "$(dirname "$DEPLOY_DIR")" 2>/dev/null && pwd)/$(basename "$DEPLOY_DIR")"

DEPLOY_PORT="${DEPLOY_PORT:-3001}"
PID_FILE="$DEPLOY_DIR/.server.pid"
LOG_FILE="$DEPLOY_DIR/.server.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

stop_service() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid="$(cat "$PID_FILE")"
        if kill -0 "$pid" 2>/dev/null; then
            info "停止部署服务 (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            local waited=0
            while kill -0 "$pid" 2>/dev/null && [ $waited -lt 10 ]; do
                sleep 1
                waited=$((waited + 1))
            done
            if kill -0 "$pid" 2>/dev/null; then
                warn "进程未响应，强制终止..."
                kill -9 "$pid" 2>/dev/null || true
            fi
            ok "服务已停止"
        else
            warn "PID 文件存在但进程已不存在，清理 PID 文件"
        fi
        rm -f "$PID_FILE"
    else
        info "未发现运行中的部署服务"
    fi
}

sync_files() {
    info "同步文件到 $DEPLOY_DIR ..."
    mkdir -p "$DEPLOY_DIR"

    rsync -av --delete \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.env' \
        --exclude='scripts' \
        --exclude='*.md' \
        --exclude='.DS_Store' \
        --exclude='.server.pid' \
        --exclude='.server.log' \
        "$PROJECT_DIR/src/" "$DEPLOY_DIR/src/"

    rsync -av \
        "$PROJECT_DIR/package.json" \
        "$PROJECT_DIR/package-lock.json" \
        "$DEPLOY_DIR/"

    if [ -f "$PROJECT_DIR/.env.production" ]; then
        rsync -av "$PROJECT_DIR/.env.production" "$DEPLOY_DIR/"
    fi

    ok "文件同步完成"
}

install_deps() {
    info "安装生产依赖..."
    cd "$DEPLOY_DIR"
    npm ci --production 2>/dev/null || npm install --production
    ok "依赖安装完成"
}

setup_env() {
    if [ ! -f "$DEPLOY_DIR/.env" ]; then
        if [ -f "$DEPLOY_DIR/.env.production" ]; then
            cp "$DEPLOY_DIR/.env.production" "$DEPLOY_DIR/.env"
            info "从 .env.production 创建 .env"
        else
            cat > "$DEPLOY_DIR/.env" <<EOF
NODE_ENV=production
DB_TYPE=sqlite
PORT=$DEPLOY_PORT
EOF
            info "创建默认 .env (PORT=$DEPLOY_PORT, SQLite)"
        fi
    else
        info "使用现有 .env 配置"
    fi
}

start_service() {
    cd "$DEPLOY_DIR"
    info "启动部署服务 (端口: $DEPLOY_PORT)..."

    PORT="$DEPLOY_PORT" NODE_ENV=production nohup node src/server.js >> "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"

    sleep 2

    if kill -0 "$pid" 2>/dev/null; then
        ok "服务启动成功 (PID: $pid)"
        ok "用户端: http://localhost:$DEPLOY_PORT"
        ok "管理端: http://localhost:$DEPLOY_PORT/admin"
    else
        fail "服务启动失败，查看日志: $LOG_FILE"
    fi
}

health_check() {
    info "健康检查..."
    local max_retries=5
    local retry=0
    while [ $retry -lt $max_retries ]; do
        if curl -s "http://localhost:$DEPLOY_PORT/api/health" > /dev/null 2>&1; then
            ok "健康检查通过"
            local response
            response="$(curl -s "http://localhost:$DEPLOY_PORT/api/health")"
            echo "  $response"
            return 0
        fi
        retry=$((retry + 1))
        sleep 1
    done
    warn "健康检查未通过，服务可能需要更多启动时间"
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║            班车预定系统 - 自动部署                      ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  源码目录: $PROJECT_DIR"
echo "║  部署目录: $DEPLOY_DIR"
echo "║  部署端口: $DEPLOY_PORT"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

stop_service
sync_files
install_deps
setup_env
start_service
health_check

echo ""
ok "部署完成！"
info "日志文件: $LOG_FILE"
info "停止服务: npm run deploy:stop"
info "查看日志: npm run deploy:logs"
