#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)/../1-deploy"
LOG_FILE="$DEPLOY_DIR/.server.log"

if [ -f "$LOG_FILE" ]; then
    tail -f "$LOG_FILE"
else
    echo "日志文件不存在: $LOG_FILE"
fi
