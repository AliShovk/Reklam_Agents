import { messageQueue } from "./message-queue.js";
import { eventBus } from "./event-bus.js";
import { createSubLogger } from "./logger.js";
import type { GrowthCycleState, GrowthPhase } from "./types.js";

const log = createSubLogger("growth-loop");

const PHASE_ORDER: GrowthPhase[] = [
  "research",
  "product_creation",
  "content_creation",
  "publishing",
  "user_acquisition",
  "analysis",
  "strategy_improvement",
];

/**
 * GrowthLoop — автономный цикл роста.
 * 
 * Цикл:
 * 1. Исследование рынка и спроса
 * 2. Создание продуктов-воронок
 * 3. Создание контента
 * 4. Публикация
 * 5. Привлечение пользователей
 * 6. Анализ результатов
 * 7. Улучшение стратегии
 * → Повторить
 */
export class GrowthLoop {
  private state: GrowthCycleState;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(intervalMs = 300_000) {
    this.intervalMs = intervalMs;
    this.state = {
      cycleNumber: 0,
      phase: "research",
      startedAt: new Date(),
      metrics: {
        totalUsers: 0,
        newUsersToday: 0,
        totalContent: 0,
        totalProducts: 0,
        totalTraffic: 0,
        conversionRate: 0,
        growthRate: 0,
        topChannels: [],
      },
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    log.info("Growth loop started");
    this.runCycle();
    this.timer = setInterval(() => this.runCycle(), this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info("Growth loop stopped");
  }

  getState(): GrowthCycleState {
    return { ...this.state };
  }

  private runCycle(): void {
    this.state.cycleNumber++;
    log.info(`=== Growth Cycle #${this.state.cycleNumber} ===`);

    for (const phase of PHASE_ORDER) {
      this.executePhase(phase);
    }
  }

  private executePhase(phase: GrowthPhase): void {
    this.state.phase = phase;
    log.info(`Phase: ${phase}`);

    eventBus.emit({
      type: "cycle:phase_changed",
      phase,
      cycleNumber: this.state.cycleNumber,
    });

    switch (phase) {
      case "research":
        this.phaseResearch();
        break;
      case "product_creation":
        this.phaseProductCreation();
        break;
      case "content_creation":
        this.phaseContentCreation();
        break;
      case "publishing":
        this.phasePublishing();
        break;
      case "user_acquisition":
        this.phaseUserAcquisition();
        break;
      case "analysis":
        this.phaseAnalysis();
        break;
      case "strategy_improvement":
        this.phaseStrategyImprovement();
        break;
    }
  }

  private phaseResearch(): void {
    messageQueue.createTask({
      type: "research",
      priority: "high",
      createdBy: "growth-loop",
      title: `Market research — Cycle #${this.state.cycleNumber}`,
      description: "Research current market trends, search demand, competitor activity, and new opportunities.",
      input: { cycleNumber: this.state.cycleNumber },
      assignedTo: "strategy",
    });
  }

  private phaseProductCreation(): void {
    messageQueue.createTask({
      type: "create_product",
      priority: "high",
      createdBy: "growth-loop",
      title: `Product ideation — Cycle #${this.state.cycleNumber}`,
      description: "Identify search demand gaps and create product ideas that serve as traffic funnels.",
      input: { cycleNumber: this.state.cycleNumber },
      assignedTo: "product",
    });
  }

  private phaseContentCreation(): void {
    messageQueue.createTask({
      type: "create_content",
      priority: "medium",
      createdBy: "growth-loop",
      title: `Promote masterhacks.ru — Content batch #${this.state.cycleNumber}`,
      description: "Create promotional content for masterhacks.ru and its offers across active channels. Focus on benefits, differentiation, and explicit CTAs instead of generic educational advice.",
      input: { cycleNumber: this.state.cycleNumber, targetSite: "masterhacks.ru", offerName: "решения и инструменты masterhacks.ru" },
      assignedTo: "content",
    });
  }

  private phasePublishing(): void {
    messageQueue.createTask({
      type: "publish_content",
      priority: "medium",
      createdBy: "growth-loop",
      title: `Promote masterhacks.ru — Publishing sweep #${this.state.cycleNumber}`,
      description: "Publish promotional content for masterhacks.ru to target channels. Keep the offer, site, and CTA visible in every post.",
      input: { cycleNumber: this.state.cycleNumber, targetSite: "masterhacks.ru", offerName: "решения и инструменты masterhacks.ru" },
      assignedTo: "posting",
    });
  }

  private phaseUserAcquisition(): void {
    messageQueue.createTask({
      type: "outreach",
      priority: "medium",
      createdBy: "growth-loop",
      title: `Outreach campaign — Cycle #${this.state.cycleNumber}`,
      description: "Find new communities and engage with target audience.",
      input: { cycleNumber: this.state.cycleNumber },
      assignedTo: "outreach",
    });
  }

  private phaseAnalysis(): void {
    messageQueue.createTask({
      type: "analyze_metrics",
      priority: "high",
      createdBy: "growth-loop",
      title: `Metrics analysis — Cycle #${this.state.cycleNumber}`,
      description: "Analyze all metrics: traffic, users, conversions, content performance, agent health.",
      input: { cycleNumber: this.state.cycleNumber, metrics: this.state.metrics },
      assignedTo: "supervisor",
    });

    messageQueue.createTask({
      type: "monitor_health",
      priority: "medium",
      createdBy: "growth-loop",
      title: `Health check — Cycle #${this.state.cycleNumber}`,
      description: "Check system health, resource usage, agent status.",
      input: { cycleNumber: this.state.cycleNumber },
      assignedTo: "infrastructure",
    });
  }

  private phaseStrategyImprovement(): void {
    messageQueue.createTask({
      type: "create_strategy",
      priority: "high",
      createdBy: "growth-loop",
      title: `Strategy refinement — Cycle #${this.state.cycleNumber}`,
      description: "Review results from this cycle and refine strategy for next cycle.",
      input: { cycleNumber: this.state.cycleNumber, currentMetrics: this.state.metrics },
      assignedTo: "strategy",
    });
  }
}
