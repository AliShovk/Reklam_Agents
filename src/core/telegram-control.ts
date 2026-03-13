import type { Context, Telegraf } from "telegraf";
import type { AgentFarm } from "../farm.js";
import { createSubLogger } from "./logger.js";
import { executeServiceCall } from "./service-executor.js";
import { messageQueue } from "./message-queue.js";
import { serviceRegistry } from "./service-registry.js";
import type { AgentRole, TaskPriority, TaskType } from "./types.js";

const log = createSubLogger("telegram-control");

const ALLOWED_TASK_TYPES: TaskType[] = [
  "research",
  "create_strategy",
  "create_product",
  "write_code",
  "create_content",
  "publish_content",
  "outreach",
  "engage",
  "seo_optimize",
  "create_video",
  "analyze_metrics",
  "monitor_health",
  "scale_resources",
  "create_landing",
  "create_bot",
  "create_tool",
  "generate_articles",
  "build_pbn",
  "interlink",
  "telegram_post",
  "telegram_engage",
  "telegram_poll",
];

const ALLOWED_AGENT_ROLES: AgentRole[] = [
  "supervisor",
  "strategy",
  "product",
  "programming",
  "content",
  "posting",
  "outreach",
  "engagement",
  "seo",
  "infrastructure",
  "observability",
];

const ALLOWED_PRIORITIES: TaskPriority[] = ["critical", "high", "medium", "low"];

function getAdminIds(): number[] {
  return String(process.env.TELEGRAM_ADMIN_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function isAuthorized(ctx: Context): boolean {
  const adminIds = getAdminIds();
  if (adminIds.length === 0) return true;
  const fromId = ctx.from?.id;
  return typeof fromId === "number" && adminIds.includes(fromId);
}

async function replyUnauthorized(ctx: Context): Promise<void> {
  await ctx.reply("⛔ У вас нет доступа к командам управления. Добавьте ваш Telegram ID в TELEGRAM_ADMIN_IDS.");
}

function parsePairs(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of input.split("|")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [rawKey, ...rawValue] = trimmed.split("=");
    const key = rawKey?.trim();
    const value = rawValue.join("=").trim();
    if (key && value) result[key] = value;
  }
  return result;
}

function getCommandText(ctx: Context): string {
  return "message" in ctx.update && "text" in ctx.update.message ? ctx.update.message.text : "";
}

export function setupTelegramControl(bot: Telegraf, farm: AgentFarm): void {
  bot.command("help", async (ctx) => {
    if (!isAuthorized(ctx)) return replyUnauthorized(ctx);
    await ctx.reply([
      "🤖 Команды управления фермой:",
      "/status — статус фермы",
      "/goal title | description | metric | targetValue — создать goal",
      "/task role | type | priority | title | description — создать задачу агенту",
      "/service service | key | value | description — сохранить доступ/API",
      "/services — список сохранённых сервисов",
      "/call service | action | key=value | ... — реально вызвать сервис",
      "",
      "Диалоговый режим:",
      "- любое обычное сообщение в личку боту трактуется как запрос к Supervisor",
      "- slash-команды продолжают работать как точный режим управления",
      "",
      "Примеры:",
      "/call wp_main | create_post | title=Тест | content=Привет | status=draft",
      "/call youtube_main | search | q=ремонт кухни | max_results=3",
      "/call discord_main | send_message | content=Тест в Discord",
      "/call reddit_main | list_posts | subreddit=DIY | limit=3",
      "/call api_main | users | method=GET | query.limit=10",
    ].join("\n"));
  });

  bot.command("status", async (ctx) => {
    if (!isAuthorized(ctx)) return replyUnauthorized(ctx);
    const status = farm.getStatus();
    const queueStats = messageQueue.getQueueStats();
    await ctx.reply([
      `✅ Ферма активна`,
      `Агенты: ${status.agents.length}`,
      `В работе: ${status.processing}`,
      `Выполнено: ${status.completed}`,
      `Ошибок: ${status.failed}`,
      `Активных целей: ${status.goals.filter((goal: any) => goal.status === "active").length}`,
      `Очереди: ${Object.entries(queueStats).map(([name, count]) => `${name}=${count}`).join(", ") || "пусто"}`,
    ].join("\n"));
  });

  bot.command("goal", async (ctx) => {
    if (!isAuthorized(ctx)) return replyUnauthorized(ctx);
    const text = getCommandText(ctx);
    const payload = text.replace(/^\/goal(@\w+)?\s*/i, "");
    const parts = payload.split("|").map((item) => item.trim()).filter(Boolean);
    if (parts.length < 4) {
      await ctx.reply("Формат: /goal title | description | metric | targetValue");
      return;
    }
    const [title, description, metric, rawTargetValue] = parts;
    const targetValue = Number(rawTargetValue);
    if (!Number.isFinite(targetValue)) {
      await ctx.reply("targetValue должен быть числом");
      return;
    }
    const goal = farm.addGoal({
      title,
      description,
      targetMetric: metric,
      targetValue,
    });
    await ctx.reply(`🎯 Goal создан: ${goal.title}\nID: ${goal.id}`);
  });

  bot.command("task", async (ctx) => {
    if (!isAuthorized(ctx)) return replyUnauthorized(ctx);
    const text = getCommandText(ctx);
    const payload = text.replace(/^\/task(@\w+)?\s*/i, "");
    const parts = payload.split("|").map((item) => item.trim()).filter(Boolean);
    if (parts.length < 5) {
      await ctx.reply("Формат: /task role | type | priority | title | description");
      return;
    }
    const [role, type, priority, title, description] = parts;
    if (!ALLOWED_AGENT_ROLES.includes(role as AgentRole)) {
      await ctx.reply(`Неизвестная роль. Допустимо: ${ALLOWED_AGENT_ROLES.join(", ")}`);
      return;
    }
    if (!ALLOWED_TASK_TYPES.includes(type as TaskType)) {
      await ctx.reply(`Неизвестный type. Допустимо: ${ALLOWED_TASK_TYPES.join(", ")}`);
      return;
    }
    if (!ALLOWED_PRIORITIES.includes(priority as TaskPriority)) {
      await ctx.reply(`Неизвестный priority. Допустимо: ${ALLOWED_PRIORITIES.join(", ")}`);
      return;
    }
    const task = messageQueue.createTask({
      type: type as TaskType,
      priority: priority as TaskPriority,
      createdBy: "telegram-admin",
      title,
      description,
      assignedTo: role,
      input: { source: "telegram", requestedBy: ctx.from?.username || ctx.from?.id || "unknown" },
    });
    await ctx.reply(`🧩 Задача создана: ${task.title}\nID: ${task.id}\nАгент: ${role}`);
  });

  bot.command("service", async (ctx) => {
    if (!isAuthorized(ctx)) return replyUnauthorized(ctx);
    const text = getCommandText(ctx);
    const payload = text.replace(/^\/service(@\w+)?\s*/i, "");
    const parts = payload.split("|").map((item) => item.trim());
    if (parts.length < 3) {
      await ctx.reply("Формат: /service service | key | value | description");
      return;
    }
    const [service, key, value, description = ""] = parts;
    if (!service || !key || !value) {
      await ctx.reply("service, key и value обязательны");
      return;
    }
    const saved = await serviceRegistry.setCredential(service, key, value, description);
    await ctx.reply(`🔐 Доступ сохранён: ${saved.service}.${saved.key}`);
  });

  bot.command("call", async (ctx) => {
    if (!isAuthorized(ctx)) return replyUnauthorized(ctx);
    const text = getCommandText(ctx);
    const payload = text.replace(/^\/call(@\w+)?\s*/i, "");
    const parts = payload.split("|").map((item) => item.trim()).filter(Boolean);
    if (parts.length < 2) {
      await ctx.reply("Формат: /call service | action | key=value | ...");
      return;
    }
    const [service, action, ...rest] = parts;
    const params = parsePairs(rest.join("|"));
    try {
      const result = await executeServiceCall(service, action, params);
      await ctx.reply([
        `${result.ok ? "✅" : "⚠️"} ${service}.${result.action}`,
        `HTTP: ${result.status}`,
        `Ответ: ${result.summary}`,
      ].join("\n"));
    } catch (err: any) {
      await ctx.reply(`❌ Ошибка вызова ${service}: ${err.message}`);
    }
  });

  bot.command("services", async (ctx) => {
    if (!isAuthorized(ctx)) return replyUnauthorized(ctx);
    const items = await serviceRegistry.listSummary();
    if (items.length === 0) {
      await ctx.reply("Сервисные доступы ещё не сохранены.");
      return;
    }
    await ctx.reply(items.map((item) => `• ${item.service}.${item.key} — ${item.description || "без описания"}`).join("\n"));
  });

  bot.on("text", async (ctx, next) => {
    const text = "message" in ctx.update && "text" in ctx.update.message ? ctx.update.message.text.trim() : "";
    if (text.startsWith("/")) return next();
    if (!isAuthorized(ctx)) return replyUnauthorized(ctx);

    const chat = ctx.chat;
    if (!chat || chat.type !== "private") return next();

    try {
      const result = await farm.getSupervisor().handleTelegramDialog({
        text,
        fromUser: ctx.from?.username || ctx.from?.first_name || String(ctx.from?.id || "unknown"),
        chatId: chat.id,
      });

      const suffix = [
        result.createdGoalId ? `Goal: ${result.createdGoalId}` : "",
        result.createdTaskId ? `Task: ${result.createdTaskId}` : "",
      ].filter(Boolean).join("\n");

      await ctx.reply([result.reply, suffix].filter(Boolean).join("\n\n"));
    } catch (err: any) {
      await ctx.reply(`❌ Не удалось обработать запрос: ${err.message}`);
    }

    return next();
  });

  log.info("Telegram control commands registered");
}
