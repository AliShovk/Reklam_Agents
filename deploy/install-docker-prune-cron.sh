#!/bin/bash
set -euo pipefail

APP_DIR="/opt/reklam-agents"
PRUNE_SCRIPT="$APP_DIR/deploy/docker-prune.sh"
CRON_SCHEDULE="0 4 * * *"
CRON_LINE="$CRON_SCHEDULE bash $PRUNE_SCRIPT"

chmod +x "$PRUNE_SCRIPT"
mkdir -p /var/log/reklam-agents

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$PRUNE_SCRIPT" > "$TMP_CRON" || true
echo "$CRON_LINE" >> "$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "Installed cron job: $CRON_LINE"
crontab -l | grep "$PRUNE_SCRIPT"
