import { loadFarmConfig } from "./core/config.js";
import { createSubLogger } from "./core/logger.js";
import { eventBus } from "./core/event-bus.js";
import { messageQueue } from "./core/message-queue.js";
import { knowledgeBase } from "./core/knowledge-base.js";
import { GrowthLoop } from "./core/growth-loop.js";
import { BaseAgent } from "./core/base-agent.js";
import {
  SupervisorAgent,
  StrategyAgent,
  ProductAgent,
  ProgrammingAgent,
  ContentAgent,
  PostingAgent,
  OutreachAgent,
  EngagementAgent,
  SeoAgent,
  InfrastructureAgent,
  ObservabilityAgent,
} from "./agents/index.js";
import type { Goal, FarmConfig, GrowthMetrics } from "./core/types.js";

const log = createSubLogger("farm");

/**
 * AgentFarm — оркестратор всей фермы AI-агентов.
 * 
 * Запускает всех агентов, управляет циклом роста,
 * предоставляет API для мониторинга и управления.
 * 
 * Архитектура:
 * 
 *                 SUPERVISOR AI
 *                      │
 *               Goal Engine
 *                      │
 *               Strategy Agent
 *                      │
 *               Task Distribution
 *                      │
 *         ┌────────────┼────────────┐
 *         │            │            │
 *    Product Agents  Marketing   Infrastructure
 *         │          Agents        Agents
 *         │            │            │
 *    Programming    Content      Observability
 *      Agent        Posting
 *                   Outreach
 *                   Engagement
 *                   SEO
 */
export class AgentFarm {
  private config: FarmConfig;
  private agents: BaseAgent[] = [];
  private supervisor: SupervisorAgent;
  private growthLoop: GrowthLoop;
  private startedAt: Date | null = null;

  constructor() {
    this.config = loadFarmConfig();

    // Initialize supervisor
    this.supervisor = new SupervisorAgent();

    // Initialize growth loop
    this.growthLoop = new GrowthLoop(this.config.cycleIntervalMs);

    // Initialize all agents
    this.agents = [
      this.supervisor,
      new StrategyAgent(),
      new ProductAgent(),
      new ProgrammingAgent(),
      new ContentAgent(),
      new PostingAgent(),
      new OutreachAgent(),
      new EngagementAgent(),
      new SeoAgent(),
      new InfrastructureAgent(),
      new ObservabilityAgent(),
    ];

    log.info(`Farm "${this.config.name}" initialized with ${this.agents.length} agents`);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  async start(): Promise<void> {
    log.info("╔══════════════════════════════════════════════╗");
    log.info("║        🚀 AI AGENT FARM STARTING 🚀         ║");
    log.info(`║  Name: ${this.config.name.padEnd(37)}║`);
    log.info(`║  Agents: ${String(this.agents.length).padEnd(35)}║`);
    log.info(`║  Cycle interval: ${String(this.config.cycleIntervalMs / 1000 + "s").padEnd(27)}║`);
    log.info("╚══════════════════════════════════════════════╝");

    this.startedAt = new Date();

    // Start all agents
    for (const agent of this.agents) {
      try {
        await agent.start();
      } catch (err: any) {
        log.error(`Failed to start agent ${agent.identity.id}: ${err.message}`);
      }
    }

    // Start growth loop
    this.growthLoop.start();

    log.info("All agents started. Farm is operational.");
  }

  async stop(): Promise<void> {
    log.info("Stopping AI Agent Farm...");

    this.growthLoop.stop();

    for (const agent of this.agents) {
      try {
        await agent.stop();
      } catch (err: any) {
        log.error(`Error stopping agent ${agent.identity.id}: ${err.message}`);
      }
    }

    log.info("Farm stopped.");
  }

  // ─── Goal Management ─────────────────────────────────────────────────

  addGoal(goal: {
    title: string;
    description: string;
    targetMetric: string;
    targetValue: number;
    deadline?: Date;
  }): Goal {
    return this.supervisor.addGoal(goal);
  }

  getGoals(): Goal[] {
    return this.supervisor.getGoals();
  }

  // ─── Monitoring ──────────────────────────────────────────────────────

  getStatus(): {
    name: string;
    uptime: number;
    agents: Array<{
      id: string;
      role: string;
      name: string;
      status: string;
      tasksCompleted: number;
      tasksFailed: number;
      tokensUsed: number;
    }>;
    queues: Record<string, number>;
    processing: number;
    completed: number;
    failed: number;
    knowledge: { total: number; byType: Record<string, number> };
    growthCycle: ReturnType<GrowthLoop["getState"]>;
    goals: Goal[];
    metrics: GrowthMetrics;
  } {
    return {
      name: this.config.name,
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      agents: this.agents.map((a) => ({
        id: a.identity.id,
        role: a.identity.role,
        name: a.identity.name,
        status: a.identity.status,
        tasksCompleted: a.identity.metrics.tasksCompleted,
        tasksFailed: a.identity.metrics.tasksFailed,
        tokensUsed: a.identity.metrics.tokensUsed,
      })),
      queues: messageQueue.getQueueStats(),
      processing: messageQueue.getProcessingCount(),
      completed: messageQueue.getCompletedCount(),
      failed: messageQueue.getFailedCount(),
      knowledge: knowledgeBase.getStats(),
      growthCycle: this.growthLoop.getState(),
      goals: this.supervisor.getGoals(),
      metrics: this.supervisor.getMetrics(),
    };
  }

  getAgents(): BaseAgent[] {
    return [...this.agents];
  }

  getSupervisor(): SupervisorAgent {
    return this.supervisor;
  }

  getGrowthLoop(): GrowthLoop {
    return this.growthLoop;
  }

  getConfig(): FarmConfig {
    return this.config;
  }
}
