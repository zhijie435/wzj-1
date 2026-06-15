#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)/../1-deploy"
PID_FILE="$DEPLOY_DIR/.server.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }

if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
        info "停止部署服务 (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        waited=0
        while kill -0 "$pid" 2>/dev/null && [ $waited -lt 10 ]; do
            sleep 1
            waited=$((waited + 1))
        done
        if kill -0 "$pid" 2>/dev/null; then
            warn "强制终止..."
            kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
        ok "服务已停止"
    else
        warn "PID 文件存在但进程已不存在"
        rm -f "$PID_FILE"
    fi
else
    warn "未发现运行中的部署服务"
fi
