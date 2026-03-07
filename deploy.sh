#!/bin/bash
# ============================================================================
# Reklam Agents — VPS Deployment Script
# ============================================================================
# Использование:
#   1. Скопировать на VPS: scp deploy.sh user@your-vps:/root/
#   2. Запустить: bash deploy.sh
# ============================================================================

set -e

APP_DIR="/opt/reklam-agents"
REPO_URL="https://github.com/AliShovk/Reklam_Agents.git"
BRANCH="main"

echo "╔══════════════════════════════════════════════╗"
echo "║   🤖 Reklam Agents — VPS Deployment          ║"
echo "╚══════════════════════════════════════════════╝"

# --- 1. Установка зависимостей ---
echo "📦 Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq curl git docker.io docker-compose

# Включить Docker
systemctl enable docker
systemctl start docker

# --- 2. Клонирование / обновление репозитория ---
if [ -d "$APP_DIR" ]; then
  echo "🔄 Updating existing installation..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/$BRANCH
else
  echo "📥 Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# --- 3. Конфигурация ---
if [ ! -f "$APP_DIR/.env" ]; then
  echo "⚙️  Creating .env from example..."
  cp .env.example .env
  echo ""
  echo "⚠️  IMPORTANT: Edit .env file with your API keys!"
  echo "   nano $APP_DIR/.env"
  echo ""
  echo "   Minimum required:"
  echo "   - OPENAI_API_KEY=sk-..."
  echo "   - DASHBOARD_AUTH_TOKEN=your-secret-token"
  echo ""
fi

# --- 4. Запуск через Docker Compose ---
echo "🐳 Building and starting containers..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ Deployment complete!                     ║"
echo "║                                              ║"
echo "║   Dashboard: http://YOUR_VPS_IP:3333         ║"
echo "║   Logs:      docker-compose logs -f farm     ║"
echo "║   Stop:      docker-compose down             ║"
echo "║   Restart:   docker-compose restart           ║"
echo "║                                              ║"
echo "║   Don't forget to edit .env:                 ║"
echo "║   nano /opt/reklam-agents/.env               ║"
echo "╚══════════════════════════════════════════════╝"
