#!/bin/bash
set -euo pipefail

LOG_FILE="/var/log/reklam-agents/docker-prune.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date -Is)] Starting Docker cleanup" >> "$LOG_FILE"
docker image prune -af >> "$LOG_FILE" 2>&1
echo "[$(date -Is)] Docker cleanup finished" >> "$LOG_FILE"
