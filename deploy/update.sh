#!/bin/bash
# ============================================================================
# Reklam Agents — Quick Update Script (запускать на VPS)
# ============================================================================
# Использование: bash /opt/reklam-agents/deploy/update.sh
# ============================================================================

set -e

APP_DIR="/opt/reklam-agents"

echo "🔄 Обновление Reklam Agents..."

cd "$APP_DIR"
git pull origin main
npm install
chown -R reklam:reklam "$APP_DIR"
systemctl restart reklam-agents

sleep 2
if systemctl is-active --quiet reklam-agents; then
  echo "✅ Обновлено и запущено!"
else
  echo "❌ Ошибка. Логи: journalctl -u reklam-agents -n 50"
fi
