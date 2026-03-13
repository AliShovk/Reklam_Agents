import express from "express";
import { createSubLogger } from "../core/logger.js";
import { AgentFarm } from "../farm.js";
import { eventBus } from "../core/event-bus.js";
import { messageQueue } from "../core/message-queue.js";
import { knowledgeBase } from "../core/knowledge-base.js";

const log = createSubLogger("dashboard");

/**
 * Dashboard — веб-панель мониторинга фермы.
 * 
 * Эндпоинты:
 * GET  /api/status       — общий статус фермы
 * GET  /api/agents        — список агентов и их метрики
 * GET  /api/tasks         — задачи (pending, completed, failed)
 * GET  /api/knowledge     — база знаний
 * GET  /api/goals         — цели и прогресс
 * GET  /api/events        — последние события
 * POST /api/goals         — добавить цель
 * POST /api/trigger-cycle — запустить цикл анализа
 * GET  /                  — UI дашборд
 */
export function createDashboard(farm: AgentFarm) {
  const app = express();
  app.use(express.json());

  // Auth middleware
  const authToken = farm.getConfig().dashboard.authToken;
  if (authToken) {
    app.use("/api", (req, res, next) => {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (token !== authToken) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    });
  }

  // ─── API Routes ─────────────────────────────────────────────────────

  app.get("/api/status", (_req, res) => {
    res.json(farm.getStatus());
  });

  app.get("/api/agents", (_req, res) => {
    const agents = farm.getAgents().map((a) => ({
      id: a.identity.id,
      role: a.identity.role,
      name: a.identity.name,
      description: a.identity.description,
      status: a.identity.status,
      model: a.identity.model,
      metrics: a.identity.metrics,
      lastActiveAt: a.identity.lastActiveAt,
    }));
    res.json({ agents });
  });

  app.get("/api/tasks", (req, res) => {
    const type = req.query.type as string;
    res.json({
      pending: messageQueue.getPendingTasks(),
      recentCompleted: messageQueue.getRecentCompleted(20),
      recentFailed: messageQueue.getRecentFailed(20),
      stats: {
        queues: messageQueue.getQueueStats(),
        processing: messageQueue.getProcessingCount(),
        completed: messageQueue.getCompletedCount(),
        failed: messageQueue.getFailedCount(),
      },
    });
  });

  app.get("/api/knowledge", (req, res) => {
    const query = req.query.q as string;
    const type = req.query.type as string;

    if (query) {
      res.json({ results: knowledgeBase.search(query, { type: type as any, limit: 20 }) });
    } else {
      res.json({
        stats: knowledgeBase.getStats(),
        recent: knowledgeBase.getAll().slice(-20),
      });
    }
  });

  app.get("/api/goals", (_req, res) => {
    res.json({ goals: farm.getGoals() });
  });

  app.get("/api/events", (req, res) => {
    const type = req.query.type as string;
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ events: eventBus.getHistory(type as any, limit) });
  });

  app.post("/api/goals", (req, res) => {
    try {
      const goal = farm.addGoal(req.body);
      res.json({ goal });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/trigger-cycle", async (_req, res) => {
    try {
      await farm.getSupervisor().triggerAnalysis();
      res.json({ ok: true, message: "Analysis cycle triggered" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── UI Dashboard ───────────────────────────────────────────────────

  app.get("/", (_req, res) => {
    res.send(getDashboardHtml());
  });

  return app;
}

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Agent Farm — Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { background: #0f172a; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; }
    .glow { box-shadow: 0 0 20px rgba(59, 130, 246, 0.1); }
    .status-idle { color: #94a3b8; }
    .status-working { color: #22d3ee; animation: pulse 2s infinite; }
    .status-error { color: #f87171; }
    .status-disabled { color: #475569; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .agent-card:hover { transform: translateY(-2px); transition: all 0.2s; }
  </style>
</head>
<body class="min-h-screen p-6">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white flex items-center gap-3">
          <span class="text-4xl">🤖</span> AI Agent Farm
        </h1>
        <p class="text-slate-400 mt-1" id="farm-name">Loading...</p>
      </div>
      <div class="flex gap-3">
        <button onclick="triggerCycle()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">
          ⚡ Trigger Cycle
        </button>
        <button onclick="loadData()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8" id="stats-row">
    </div>

    <!-- Agents Grid -->
    <h2 class="text-xl font-semibold mb-4 text-white">🤖 Agents</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8" id="agents-grid">
    </div>

    <!-- Goals -->
    <h2 class="text-xl font-semibold mb-4 text-white">🎯 Goals</h2>
    <div class="card p-6 mb-8" id="goals-section">
      <p class="text-slate-400">No goals set</p>
    </div>

    <!-- Add Goal Form -->
    <div class="card p-6 mb-8">
      <h3 class="text-lg font-semibold mb-4">➕ Add Goal</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input id="goal-title" placeholder="Goal title" class="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white">
        <input id="goal-description" placeholder="Description" class="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white">
        <input id="goal-metric" placeholder="Metric (e.g. users)" class="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white">
        <input id="goal-target" type="number" placeholder="Target value" class="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white">
      </div>
      <button onclick="addGoal()" class="mt-4 px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">
        Add Goal
      </button>
    </div>

    <!-- Tasks -->
    <h2 class="text-xl font-semibold mb-4 text-white">📋 Recent Tasks</h2>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
      <div class="card p-6">
        <h3 class="text-green-400 font-semibold mb-3">✅ Completed</h3>
        <div id="completed-tasks" class="space-y-2 max-h-64 overflow-y-auto"></div>
      </div>
      <div class="card p-6">
        <h3 class="text-red-400 font-semibold mb-3">❌ Failed</h3>
        <div id="failed-tasks" class="space-y-2 max-h-64 overflow-y-auto"></div>
      </div>
    </div>

    <!-- Events -->
    <h2 class="text-xl font-semibold mb-4 text-white">📡 Recent Events</h2>
    <div class="card p-6" id="events-section">
    </div>
  </div>

  <script>
    const API = '';

    let AUTH_TOKEN = localStorage.getItem('dashboard_auth_token') || '';

    async function apiFetch(path, options) {
      const opts = options ? { ...options } : {};
      opts.headers = opts.headers ? { ...opts.headers } : {};
      if (AUTH_TOKEN) {
        opts.headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
      }
      let res = await fetch(API + path, opts);

      if (res.status === 401) {
        const nextToken = prompt('Dashboard token (Bearer):', AUTH_TOKEN || '');
        if (nextToken) {
          AUTH_TOKEN = nextToken.trim();
          localStorage.setItem('dashboard_auth_token', AUTH_TOKEN);
          opts.headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
          res = await fetch(API + path, opts);
        }
      }
      return res;
    }

    async function loadData() {
      try {
        const [status, tasks, events] = await Promise.all([
          apiFetch('/api/status').then(r => r.json()),
          apiFetch('/api/tasks').then(r => r.json()),
          apiFetch('/api/events?limit=20').then(r => r.json()),
        ]);
        renderStatus(status);
        renderTasks(tasks);
        renderEvents(events);
      } catch(e) { console.error('Failed to load:', e); }
    }

    function renderStatus(s) {
      document.getElementById('farm-name').textContent = s.name + ' — Uptime: ' + Math.round(s.uptime/1000) + 's | Cycle #' + s.growthCycle.cycleNumber + ' (' + s.growthCycle.phase + ')';

      document.getElementById('stats-row').innerHTML = [
        stat('Agents', s.agents.length, '🤖'),
        stat('Completed', s.completed, '✅'),
        stat('Failed', s.failed, '❌'),
        stat('Processing', s.processing, '⚙️'),
        stat('Knowledge', s.knowledge.total, '🧠'),
        stat('Goals', s.goals.length, '🎯'),
      ].join('');

      document.getElementById('agents-grid').innerHTML = s.agents.map(a =>
        '<div class="card glow p-4 agent-card">' +
          '<div class="flex items-center justify-between mb-2">' +
            '<span class="font-semibold text-white">' + a.name + '</span>' +
            '<span class="status-' + a.status + ' text-xs font-mono">' + a.status.toUpperCase() + '</span>' +
          '</div>' +
          '<p class="text-xs text-slate-400 mb-3">' + a.role + '</p>' +
          '<div class="grid grid-cols-3 gap-2 text-center text-xs">' +
            '<div><div class="text-green-400 font-bold">' + a.tasksCompleted + '</div><div class="text-slate-500">done</div></div>' +
            '<div><div class="text-red-400 font-bold">' + a.tasksFailed + '</div><div class="text-slate-500">fail</div></div>' +
            '<div><div class="text-blue-400 font-bold">' + (a.tokensUsed > 1000 ? Math.round(a.tokensUsed/1000) + 'k' : a.tokensUsed) + '</div><div class="text-slate-500">tokens</div></div>' +
          '</div>' +
        '</div>'
      ).join('');

      if (s.goals.length > 0) {
        document.getElementById('goals-section').innerHTML = s.goals.map(g => {
          const pct = g.targetValue > 0 ? Math.min(100, Math.round(g.currentValue / g.targetValue * 100)) : 0;
          return '<div class="mb-4">' +
            '<div class="flex justify-between mb-1"><span class="font-medium">' + g.title + '</span><span class="text-sm text-slate-400">' + pct + '%</span></div>' +
            '<div class="w-full bg-slate-700 rounded-full h-2"><div class="bg-blue-500 h-2 rounded-full" style="width:' + pct + '%"></div></div>' +
            '<p class="text-xs text-slate-500 mt-1">' + g.currentValue + ' / ' + g.targetValue + ' ' + g.targetMetric + '</p>' +
          '</div>';
        }).join('');
      }
    }

    function stat(label, value, icon) {
      return '<div class="card p-4 text-center"><div class="text-2xl mb-1">' + icon + '</div><div class="text-2xl font-bold text-white">' + value + '</div><div class="text-xs text-slate-400">' + label + '</div></div>';
    }

    function renderTasks(t) {
      document.getElementById('completed-tasks').innerHTML = (t.recentCompleted || []).slice(-10).reverse().map(task =>
        '<div class="text-xs p-2 bg-slate-800 rounded"><span class="text-green-400">[' + task.type + ']</span> ' + task.title + '</div>'
      ).join('') || '<p class="text-slate-500 text-sm">No tasks yet</p>';

      document.getElementById('failed-tasks').innerHTML = (t.recentFailed || []).slice(-10).reverse().map(task =>
        '<div class="text-xs p-2 bg-slate-800 rounded"><span class="text-red-400">[' + task.type + ']</span> ' + task.title + '<br><span class="text-red-300">' + (task.error || '') + '</span></div>'
      ).join('') || '<p class="text-slate-500 text-sm">No failures</p>';
    }

    function renderEvents(e) {
      document.getElementById('events-section').innerHTML = '<div class="space-y-1 max-h-48 overflow-y-auto">' +
        (e.events || []).slice(-15).reverse().map(ev =>
          '<div class="text-xs p-1 font-mono text-slate-400">' + ev.type + '</div>'
        ).join('') +
      '</div>' || '<p class="text-slate-500 text-sm">No events</p>';
    }

    async function addGoal() {
      const body = {
        title: document.getElementById('goal-title').value,
        description: document.getElementById('goal-description').value,
        targetMetric: document.getElementById('goal-metric').value,
        targetValue: parseInt(document.getElementById('goal-target').value) || 0,
      };
      if (!body.title) return alert('Title required');
      await apiFetch('/api/goals', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      loadData();
    }

    async function triggerCycle() {
      await apiFetch('/api/trigger-cycle', { method: 'POST' });
      setTimeout(loadData, 1000);
    }

    loadData();
    setInterval(loadData, 5000);
  </script>
</body>
</html>`;
}
