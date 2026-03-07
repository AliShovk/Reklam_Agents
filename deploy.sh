#!/bin/bash
# ============================================================================
# Reklam Agents — VPS Deployment Script
# Стек: Ubuntu + Apache + Node.js + PostgreSQL + GitLab
# ============================================================================
# Использование:
#   1. Скопировать на VPS: scp deploy.sh root@your-vps:/root/
#   2. Запустить: bash deploy.sh
#
# Или напрямую:
#   ssh root@YOUR_VPS_IP "bash -s" < deploy.sh
# ============================================================================

set -e

APP_DIR="/opt/reklam-agents"
REPO_URL="https://github.com/AliShovk/Reklam_Agents.git"
# Для GitLab замените на:
# REPO_URL="https://your-gitlab.com/your-user/Reklam_Agents.git"
BRANCH="main"
APP_USER="reklam"
LOG_DIR="/var/log/reklam-agents"
NODE_VERSION="22"

echo "╔══════════════════════════════════════════════╗"
echo "║  🤖 Reklam Agents — VPS Deployment            ║"
echo "║  Stack: Apache + Node.js + PostgreSQL         ║"
echo "╚══════════════════════════════════════════════╝"

# --- 1. Системные зависимости ---
echo ""
echo "📦 [1/8] Установка системных зависимостей..."
apt-get update -qq
apt-get install -y -qq curl git build-essential

# --- 2. Node.js 22 ---
echo "📦 [2/8] Установка Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt $NODE_VERSION ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
echo "   Node.js: $(node -v)"
echo "   npm: $(npm -v)"

# --- 3. PostgreSQL ---
echo "📦 [3/8] Настройка PostgreSQL..."
if ! command -v psql &> /dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
fi

# Создать БД (если ещё нет)
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw reklam_agents; then
  echo "   Создаю базу данных reklam_agents..."
  sudo -u postgres psql -c "CREATE USER reklam_user WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE DATABASE reklam_agents OWNER reklam_user;" 2>/dev/null || true
fi

# --- 4. Apache + модули ---
echo "📦 [4/8] Настройка Apache..."
if ! command -v apache2 &> /dev/null; then
  apt-get install -y -qq apache2
fi
a2enmod proxy proxy_http proxy_wstunnel rewrite headers 2>/dev/null
systemctl enable apache2

# --- 5. Создать пользователя приложения ---
echo "📦 [5/8] Создаю пользователя $APP_USER..."
if ! id "$APP_USER" &>/dev/null; then
  useradd -r -m -s /bin/bash "$APP_USER"
fi
mkdir -p "$LOG_DIR"
chown "$APP_USER:$APP_USER" "$LOG_DIR"

# --- 6. Клонирование / обновление ---
echo "📦 [6/8] Загрузка кода..."
if [ -d "$APP_DIR" ]; then
  echo "   Обновляю существующую установку..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/$BRANCH
else
  echo "   Клонирую репозиторий..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# Установка зависимостей
echo "   Устанавливаю npm зависимости..."
cd "$APP_DIR"
npm install

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# --- 7. Конфигурация ---
echo "📦 [7/8] Конфигурация..."

# .env
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  # Добавить PostgreSQL URL в .env
  echo "" >> "$APP_DIR/.env"
  echo "# PostgreSQL" >> "$APP_DIR/.env"
  echo "DATABASE_URL=postgresql://reklam_user:CHANGE_ME_STRONG_PASSWORD@localhost:5432/reklam_agents" >> "$APP_DIR/.env"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi

# PostgreSQL таблицы
if [ -f "$APP_DIR/deploy/setup-postgres.sql" ]; then
  echo "   Создаю таблицы в PostgreSQL..."
  sudo -u postgres psql -d reklam_agents -f "$APP_DIR/deploy/setup-postgres.sql" 2>/dev/null || true
fi

# Apache vhost
echo "   Настраиваю Apache reverse proxy..."
cp "$APP_DIR/deploy/apache-reklam.conf" /etc/apache2/sites-available/reklam.conf
a2ensite reklam.conf 2>/dev/null
a2dissite 000-default.conf 2>/dev/null || true
apache2ctl configtest && systemctl reload apache2

# systemd service
echo "   Устанавливаю systemd service..."
cp "$APP_DIR/deploy/reklam-agents.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable reklam-agents

# --- 8. Запуск ---
echo "📦 [8/8] Запуск..."
systemctl restart reklam-agents

# Подождать 3 секунды и проверить
sleep 3
if systemctl is-active --quiet reklam-agents; then
  STATUS="✅ РАБОТАЕТ"
else
  STATUS="❌ Ошибка (проверьте логи)"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  $STATUS                                         "
echo "║                                                  ║"
echo "║  Dashboard: http://YOUR_VPS_IP                   ║"
echo "║  (Apache проксирует порт 80 → Node.js :3333)    ║"
echo "║                                                  ║"
echo "║  Команды:                                        ║"
echo "║  systemctl status reklam-agents   # статус       ║"
echo "║  systemctl restart reklam-agents  # перезапуск   ║"
echo "║  journalctl -u reklam-agents -f   # логи         ║"
echo "║  tail -f /var/log/reklam-agents/farm.log         ║"
echo "║                                                  ║"
echo "║  ⚠️  ОБЯЗАТЕЛЬНО отредактируйте .env:             ║"
echo "║  nano /opt/reklam-agents/.env                    ║"
echo "║  → OPENAI_API_KEY=sk-ваш-ключ                   ║"
echo "║  → DASHBOARD_AUTH_TOKEN=секретный-токен           ║"
echo "║  → DATABASE_URL=postgresql://...пароль...        ║"
echo "║                                                  ║"
echo "║  Затем: systemctl restart reklam-agents          ║"
echo "╚══════════════════════════════════════════════════╝"
