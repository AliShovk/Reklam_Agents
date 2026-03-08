/**
 * Reklam Agents — AI Marketing Farm
 * Главный файл приложения
 */

import { logger, loadFarmConfig, initializeLLM, GrowthLoop, eventBus } from "./core/index.js";
import { createDashboard } from "./dashboard/server.js";
import { messageQueue } from "./core/message-queue.js";
import { knowledgeBase } from "./core/knowledge-base.js";

// Агенты
import { SupervisorAgent } from "./agents/supervisor.js";
import { StrategyAgent } from "./agents/strategy.js";
import { ProductAgent } from "./agents/product.js";
import { ProgrammingAgent } from "./agents/programming.js";
import { ContentAgent } from "./agents/marketing/content.js";
import { PostingAgent } from "./agents/marketing/posting.js";
import { OutreachAgent } from "./agents/marketing/outreach.js";
import { EngagementAgent } from "./agents/marketing/engagement.js";
import { SeoAgent } from "./agents/seo.js";
import { InfrastructureAgent } from "./agents/infrastructure.js";

const log = logger.child({ subsystem: "farm" });

/**
 * AgentFarm — главный класс фермы.
 * Управляет агентами, циклом роста и дашбордом.
 */
export class AgentFarm {
  private agents: Map<string, any> = new Map();
  private supervisor: SupervisorAgent;
  private growthLoop: GrowthLoop;
  private startTime = Date.now();

  constructor() {
    const config = loadFarmConfig();
    this.supervisor = new SupervisorAgent();

    // Создать все агенты
    const agentInstances = [
      new StrategyAgent(),
      new ProductAgent(),
      new ProgrammingAgent(),
      new ContentAgent(),
      new PostingAgent(),
      new OutreachAgent(),
      new EngagementAgent(),
      new SeoAgent(),
      new InfrastructureAgent(),
    ];

    for (const agent of agentInstances) {
      this.agents.set(agent.identity.id, agent);
    }

    this.growthLoop = new GrowthLoop(config.cycleIntervalMs);

    log.info(`✅ AgentFarm initialized with ${this.agents.size + 1} agents`);
  }

  async start(): Promise<void> {
    try {
      // 1. Инициализировать LLM (включая GigaChat если настроен)
      log.info("🚀 Инициализация LLM провайдера...");
      await initializeLLM();
      log.info("✅ LLM провайдер готов");

      // 2. Запустить supervisor
      log.info("🤖 Запуск Supervisor агента...");
      await this.supervisor.start();
      this.agents.set(this.supervisor.identity.id, this.supervisor);

      // 3. Запустить остальные агенты
      log.info("🤖 Запуск всех агентов...");
      for (const agent of this.agents.values()) {
        if (agent.identity.id !== this.supervisor.identity.id) {
          await agent.start();
        }
      }
      log.info(`✅ Все ${this.agents.size} агентов запущены`);

      // 4. Запустить цикл роста
      log.info("📊 Запуск цикла роста...");
      this.growthLoop.start();

      // 5. Запустить дашборд
      const config = loadFarmConfig();
      const dashboardApp = createDashboard(this);
      dashboardApp.listen(config.dashboard.port, () => {
        log.info(`✅ Dashboard доступен: http://localhost:${config.dashboard.port}`);
      });

      log.info("🎉 AgentFarm полностью запущена");
    } catch (err: any) {
      log.error(`❌ Ошибка запуска: ${err.message}`);
      throw err;
    }
  }

  async stop(): Promise<void> {
    log.info("🛑 Остановка AgentFarm...");

    // Остановить цикл роста
    this.growthLoop.stop();

    // Остановить все агенты
    for (const agent of this.agents.values()) {
      try {
        await agent.stop();
      } catch (err: any) {
        log.warn(`Failed to stop agent: ${err.message}`);
      }
    }

    log.info("✅ AgentFarm остановлена");
  }

  // ─── API для дашборда ───────────────────────────────────────────────

  getStatus() {
    const agentsList = Array.from(this.agents.values()).map((a) => a.identity);
    const uptimeMs = Date.now() - this.startTime;
    const state = this.growthLoop.getState();

    return {
      name: "Reklam Farm",
      uptime: uptimeMs,
      agents: agentsList,
      processing: messageQueue.getProcessingCount(),
      completed: messageQueue.getCompletedCount(),
      failed: messageQueue.getFailedCount(),
      knowledge: knowledgeBase.getStats(),
      growthCycle: state,
      goals: this.supervisor.getGoals(),
    };
  }

  getAgents() {
    return Array.from(this.agents.values());
  }

  getGoals() {
    return this.supervisor.getGoals();
  }

  addGoal(goal: any) {
    return this.supervisor.addGoal(goal);
  }

  getSupervisor() {
    return this.supervisor;
  }

  getConfig() {
    return loadFarmConfig();
  }
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const farm = new AgentFarm();

  // Graceful shutdown
  process.on("SIGINT", async () => {
    log.info("Received SIGINT, shutting down...");
    await farm.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    log.info("Received SIGTERM, shutting down...");
    await farm.stop();
    process.exit(0);
  });

  // Запустить ферму
  await farm.start();
}

main().catch((err) => {
  log.error(`Fatal error: ${err.message}`, err);
  process.exit(1);
});
