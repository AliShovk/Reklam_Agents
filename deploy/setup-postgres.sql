-- ============================================================================
-- Reklam Agents — PostgreSQL Database Setup
-- ============================================================================
-- Выполнить: sudo -u postgres psql -f setup-postgres.sql
-- ============================================================================

-- Создать пользователя
CREATE USER reklam_user WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

-- Создать базу данных
CREATE DATABASE reklam_agents OWNER reklam_user;

-- Подключиться к базе
\c reklam_agents

-- Таблица задач
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    assigned_to VARCHAR(100),
    created_by VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    input JSONB DEFAULT '{}',
    output JSONB,
    error TEXT,
    parent_task_id UUID REFERENCES tasks(id),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Таблица знаний (Knowledge Base)
CREATE TABLE knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица целей
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    target_metric VARCHAR(100) NOT NULL,
    target_value NUMERIC NOT NULL,
    current_value NUMERIC DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица метрик агентов
CREATE TABLE agent_metrics (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(100) NOT NULL,
    agent_role VARCHAR(50) NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    tokens_used BIGINT DEFAULT 0,
    avg_response_time_ms NUMERIC DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица событий
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица контента
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    channel VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft',
    keywords TEXT[] DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица продуктов
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    target_audience TEXT,
    search_demand TEXT,
    estimated_traffic INTEGER DEFAULT 0,
    status VARCHAR(30) DEFAULT 'idea',
    url TEXT,
    spec JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_knowledge_type ON knowledge(type);
CREATE INDEX idx_knowledge_tags ON knowledge USING GIN(tags);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_content_channel ON content(channel);
CREATE INDEX idx_products_status ON products(status);

-- Права
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO reklam_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO reklam_user;
