# 🤖 Reklam Agents — AI Agent Farm

**Саморастущая экосистема AI-агентов** для автономного маркетинга, создания продуктов и органического роста.

> Ферма AI-агентов, которая создает сервисы, контент, инструменты, приводит пользователей и анализирует рост — всё автономно.

---

## 🏗 Архитектура

```
                    SUPERVISOR AI
                         │
                   Goal Engine
                         │
                  Strategy Agent
                         │
                  Task Distribution
                         │
           ┌─────────────┼─────────────┐
           │             │             │
      Product        Marketing    Infrastructure
      Agents          Agents         Agents
           │             │             │
      Programming    Content       Observability
        Agent        Posting
                     Outreach
                     Engagement
                     SEO
```

## 🧠 Агенты

| Агент | Роль | Описание |
|-------|------|----------|
| **Supervisor AI** | `supervisor` | Главный мозг. Принимает цели (OKR), дробит на проекты, распределяет задачи |
| **Strategy Agent** | `strategy` | Строит маркетинговую стратегию, выбирает каналы роста |
| **Product Agent** | `product` | Создает продукты-воронки под реальный поисковый спрос |
| **Discovery Agent** | `discovery` | Ищет открытые API, библиотеки, внешние сервисы и growth-инструменты |
| **Analytics Agent** | `analytics` | Сводит метрики, атрибуцию, bottlenecks и сигналы роста |
| **Experiments Agent** | `experiments` | Проектирует и оценивает growth-гипотезы и A/B тесты |
| **Acquisition Agent** | `acquisition` | Планирует каналы привлечения и playbooks роста |
| **Programming Agent** | `programming` | Пишет код: сайты, лендинги, боты, API, инструменты |
| **Content Agent** | `content` | Создает контент: статьи, посты, видео-скрипты, мемы |
| **Posting Agent** | `posting` | Публикует контент в соцсети, форумы, блоги |
| **Outreach Agent** | `outreach` | Ищет сообщества, чаты, форумы с целевой аудиторией |
| **Engagement Agent** | `engagement` | Общается с людьми. Помогает бесплатно, строит доверие |
| **SEO Agent** | `seo` | SEO-ферма: статьи, PBN, перелинковка, оптимизация |
| **Infrastructure Agent** | `infrastructure` | Мониторит серверы, ресурсы, масштабирование |
| **Observability Agent** | `observability` | Наблюдает за агентами, детектирует аномалии |

## 🔁 Автономный цикл роста

```
исследование рынка
        ↓
создание продукта-воронки
        ↓
создание контента
        ↓
публикация
        ↓
привлечение пользователей
        ↓
анализ метрик
        ↓
улучшение стратегии
        ↓
(повторить)
```

Каждый цикл запускается автоматически с настраиваемым интервалом.

## 🚀 Быстрый старт

### Требования

- **Node.js ≥ 22**
- **OpenAI API Key** (или другой LLM-провайдер)

### Установка

```bash
cd Reklam_Agents
npm install
```

### Конфигурация

```bash
cp .env.example .env
# Отредактируйте .env — минимум нужен OPENAI_API_KEY
```

### Запуск

```bash
# Режим разработки (с hot-reload)
npm run dev

# Или напрямую
npm run farm:start
```

Dashboard откроется на `http://localhost:3333`

## 📊 Dashboard

Веб-панель мониторинга с real-time обновлением:

- **Статус агентов** — роль, состояние, метрики
- **Очередь задач** — pending, completed, failed
- **Цели** — прогресс бары по каждой цели
- **База знаний** — поиск по всем артефактам
- **События** — лента событий фермы

### API эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/status` | Общий статус фермы |
| `GET` | `/api/agents` | Список агентов и метрики |
| `GET` | `/api/tasks` | Задачи |
| `GET` | `/api/knowledge?q=query` | Поиск по базе знаний |
| `GET` | `/api/goals` | Цели и прогресс |
| `GET` | `/api/events` | Последние события |
| `POST` | `/api/goals` | Добавить цель |
| `POST` | `/api/trigger-cycle` | Запустить цикл анализа |

## 🏛 Ключевые компоненты

### Message Queue (`src/core/message-queue.ts`)
In-memory очередь задач с приоритетами. Supervisor не дергает агентов напрямую — кидает задачи в очередь. Агенты забирают задачи по одной.

### Knowledge Base (`src/core/knowledge-base.ts`)
Векторная база знаний (in-memory с keyword search). Хранит все созданные продукты, статьи, стратегии. Агенты не изобретают велосипед — ищут в базе.

### Event Bus (`src/core/event-bus.ts`)
Шина событий для межагентной коммуникации. Observability Agent слушает все события для мониторинга.

### Growth Loop (`src/core/growth-loop.ts`)
Автономный цикл из 7 фаз. Запускается по таймеру, создает задачи для каждой фазы.

## 📁 Структура проекта

```
src/
├── index.ts                    # Точка входа
├── farm.ts                     # AgentFarm оркестратор
├── core/
│   ├── types.ts                # Все типы и схемы
│   ├── config.ts               # Загрузка конфигурации
│   ├── logger.ts               # Winston логгер
│   ├── event-bus.ts            # Шина событий
│   ├── message-queue.ts        # Очередь задач
│   ├── knowledge-base.ts       # База знаний
│   ├── llm.ts                  # OpenAI клиент
│   ├── base-agent.ts           # Базовый класс агента
│   └── growth-loop.ts          # Автономный цикл роста
├── agents/
│   ├── supervisor.ts           # Supervisor AI
│   ├── strategy.ts             # Strategy Agent
│   ├── product.ts              # Product Agent
│   ├── programming.ts          # Programming Agent
│   ├── seo.ts                  # SEO Agent
│   ├── infrastructure.ts       # Infrastructure Agent
│   ├── observability.ts        # Observability Agent
│   └── marketing/
│       ├── content.ts          # Content Agent
│       ├── posting.ts          # Posting Agent
│       ├── outreach.ts         # Outreach Agent
│       └── engagement.ts       # Engagement Agent
└── dashboard/
    └── server.ts               # Express dashboard + UI
```

## 💡 Убийственная фича

**Само-генерируемые воронки**: система создает продукты под существующий поисковый спрос.

Обычный маркетинг ищет каналы для существующего продукта.
Эта система **создает продукты под существующий спрос** (калькуляторы, генераторы).

Это позволяет захватывать трафик на стадии «как посчитать...», где:
- Стоимость лида → **0**
- Конкуренция → **минимальная**

## 🧭 Следующий слой роста

В ветке `feature/growth-layer-foundation` заложен foundation для следующего слоя роста:

- `analytics` — measurement и attribution summaries
- `experiments` — A/B и growth hypothesis engine
- `acquisition` — channel prioritization и acquisition playbooks

Подробный roadmap: `docs/growth-layer-roadmap.md`

## 📈 Масштабирование

| Конфигурация | Агентов | Задач/час |
|---|---|---|
| 1 сервер | 11–20 | ~100 |
| Кластер (3 сервера) | 50–100 | ~500 |
| Кластер (10 серверов) | 200–500 | ~2000 |

Для production масштабирования замените:
- `MessageQueue` → **BullMQ + Redis**
- `KnowledgeBase` → **ChromaDB / Qdrant / Pinecone**
- Добавьте **Docker + Kubernetes** для оркестрации

## ⚙️ Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `OPENAI_API_KEY` | API ключ OpenAI | обязательно |
| `DEFAULT_MODEL` | Модель по умолчанию | `gpt-4o` |
| `BULK_MODEL` | Модель для массовых задач | `gpt-4o-mini` |
| `STRATEGY_MODEL` | Модель для стратегии | `gpt-4o` |
| `FARM_NAME` | Название фермы | `ReklamFarm` |
| `FARM_MAX_CONCURRENT_AGENTS` | Макс. агентов | `20` |
| `FARM_CYCLE_INTERVAL_MS` | Интервал цикла (мс) | `300000` |
| `DASHBOARD_PORT` | Порт дашборда | `3333` |
| `DASHBOARD_AUTH_TOKEN` | Токен авторизации | — |

## 🛡 Безопасность

- Programming Agent работает в **sandbox** с ограничением памяти и таймаутом
- Engagement Agent следует строгим правилам **анти-спама**
- Observability Agent **отключает** нестабильных агентов
- Dashboard защищен **Bearer token** авторизацией
- Все LLM-запросы логируются для аудита

## License

MIT
