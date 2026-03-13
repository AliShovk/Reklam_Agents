import { BaseAgent } from "../core/base-agent.js";
import { messageQueue } from "../core/message-queue.js";
import { knowledgeBase } from "../core/knowledge-base.js";
import { eventBus } from "../core/event-bus.js";
import type { Goal, GrowthMetrics, Task, Strategy } from "../core/types.js";
import { v4 as uuid } from "uuid";

/**
 * Supervisor AI — главный мозг фермы.
 * 
 * Получает глобальную цель (OKR) и дробит её на проекты.
 * Распределяет задачи между агентами.
 * Отслеживает прогресс и корректирует стратегию.
 */
export class SupervisorAgent extends BaseAgent {
  private goals: Goal[] = [];
  private currentStrategy: Strategy | null = null;
  private metrics: GrowthMetrics = {
    totalUsers: 0,
    newUsersToday: 0,
    totalContent: 0,
    totalProducts: 0,
    totalTraffic: 0,
    conversionRate: 0,
    growthRate: 0,
    topChannels: [],
  };

  constructor() {
    super({
      role: "supervisor",
      name: "Supervisor AI",
      description: "Главный оркестратор фермы. Принимает цели, строит стратегии, распределяет задачи.",
      model: process.env.STRATEGY_MODEL || "gpt-4o",
    });
  }

  protected async onStart(): Promise<void> {
    // Listen for completed tasks to track progress
    eventBus.on("task:completed", (event) => {
      if (event.type === "task:completed") {
        this.onTaskCompleted(event.task);
      }
    });

    eventBus.on("task:failed", (event) => {
      if (event.type === "task:failed") {
        this.log.warn(`Task failed: ${event.error}`);
      }
    });

    eventBus.on("alert:agent_error", (event) => {
      if (event.type === "alert:agent_error") {
        this.log.error(`Agent ${event.agentId} error: ${event.error}`);
      }
    });
  }

  // ─── Goal Management ─────────────────────────────────────────────────

  addGoal(goal: Omit<Goal, "id" | "status" | "currentValue" | "subGoals" | "createdAt">): Goal {
    const newGoal: Goal = {
      id: uuid(),
      ...goal,
      currentValue: 0,
      status: "active",
      subGoals: [],
      createdAt: new Date(),
    };
    this.goals.push(newGoal);
    this.log.info(`New goal added: ${newGoal.title} (target: ${newGoal.targetValue} ${newGoal.targetMetric})`);

    // Create strategy task
    this.createSubTask({
      type: "create_strategy",
      priority: "critical",
      title: `Create strategy for: ${newGoal.title}`,
      description: `Goal: ${newGoal.description}. Target: ${newGoal.targetValue} ${newGoal.targetMetric}`,
      input: { goalId: newGoal.id, goal: newGoal },
      assignedTo: "strategy",
    });

    return newGoal;
  }

  getGoals(): Goal[] {
    return this.goals;
  }

  updateMetrics(partial: Partial<GrowthMetrics>): void {
    Object.assign(this.metrics, partial);
  }

  getMetrics(): GrowthMetrics {
    return { ...this.metrics };
  }

  // ─── Task Execution ──────────────────────────────────────────────────

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "analyze_metrics":
        return this.analyzeAndReplan(task);
      default:
        return this.delegateTask(task);
    }
  }

  private async analyzeAndReplan(task: Task): Promise<Record<string, unknown>> {
    const kbStats = knowledgeBase.getStats();
    const queueStats = messageQueue.getQueueStats();

    const analysis = await this.thinkJson<{
      assessment: string;
      adjustments: Array<{
        action: string;
        target: string;
        priority: string;
        reason: string;
      }>;
      newTasks: Array<{
        type: string;
        title: string;
        description: string;
        assignTo: string;
        priority: string;
      }>;
    }>(
      `You are the Supervisor AI of an autonomous marketing agent farm.
Your job is to analyze current progress, identify bottlenecks, and create new tasks.

Current metrics:
- Total users: ${this.metrics.totalUsers}
- New users today: ${this.metrics.newUsersToday}
- Total content pieces: ${this.metrics.totalContent}
- Total products: ${this.metrics.totalProducts}
- Conversion rate: ${this.metrics.conversionRate}%
- Growth rate: ${this.metrics.growthRate}%

Knowledge base: ${JSON.stringify(kbStats)}
Queue stats: ${JSON.stringify(queueStats)}
Active goals: ${JSON.stringify(this.goals.filter((g) => g.status === "active"))}`,

      `Analyze the current state and provide:
1. Brief assessment of progress
2. Adjustments to make (if any)
3. New tasks to create for agents

Respond in JSON with keys: assessment, adjustments, newTasks`
    );

    const newTasks = Array.isArray(analysis.newTasks)
      ? analysis.newTasks.filter((item): item is NonNullable<typeof analysis.newTasks>[number] => Boolean(item && typeof item === "object"))
      : [];

    // Create new tasks from AI analysis
    for (const t of newTasks) {
      const title = typeof t.title === "string" && t.title.length > 0 ? t.title : `Follow-up task from ${task.title}`;
      const description = typeof t.description === "string" && t.description.length > 0 ? t.description : "Review analysis output and execute the recommended next step.";
      const assignedTo = typeof t.assignTo === "string" && t.assignTo.length > 0 ? t.assignTo : "supervisor";

      this.createSubTask({
        type: t.type as any,
        priority: (t.priority as any) || "medium",
        title,
        description,
        assignedTo,
      });
    }

    this.addKnowledge({
      type: "metric",
      title: `Analysis cycle — ${new Date().toISOString()}`,
      content: analysis.assessment,
      tags: ["analysis", "metrics"],
    });

    return { analysis };
  }

  private async delegateTask(task: Task): Promise<Record<string, unknown>> {
    const delegation = await this.thinkJson<{
      subtasks: Array<{
        type: string;
        title: string;
        description: string;
        assignTo: string;
        priority: string;
      }>;
    }>(
      `You are the Supervisor AI. Break down this task into subtasks for specialized agents.

Available agent roles:
- strategy: builds marketing strategies
- product: creates product ideas (calculators, tools, catalogs)
- programming: writes code, creates sites, bots, APIs
- content: creates articles, posts, videos, memes
- posting: publishes content to social media
- outreach: finds communities, chats, forums
- engagement: communicates with people
- seo: SEO optimization, article generation, PBN
- infrastructure: monitors servers, scaling
- observability: monitors other agents`,

      `Task: ${task.title}
Description: ${task.description}
Input: ${JSON.stringify(task.input)}

Break this into subtasks. Respond in JSON with key: subtasks (array of {type, title, description, assignTo, priority})`
    );

    const subtasks = Array.isArray(delegation.subtasks)
      ? delegation.subtasks.filter((item): item is NonNullable<typeof delegation.subtasks>[number] => Boolean(item && typeof item === "object"))
      : [];

    for (const sub of subtasks) {
      const title = typeof sub.title === "string" && sub.title.length > 0 ? sub.title : `Subtask from ${task.title}`;
      const description = typeof sub.description === "string" && sub.description.length > 0 ? sub.description : task.description;
      const assignedTo = typeof sub.assignTo === "string" && sub.assignTo.length > 0 ? sub.assignTo : "supervisor";

      this.createSubTask({
        type: sub.type as any,
        priority: (sub.priority as any) || "medium",
        title,
        description,
        assignedTo,
        input: { parentTaskId: task.id },
      });
    }

    return { delegated: subtasks.length };
  }

  // ─── Event Handlers ──────────────────────────────────────────────────

  private onTaskCompleted(task: Task): void {
    // Update metrics based on task type
    switch (task.type) {
      case "create_content":
      case "generate_articles":
        this.metrics.totalContent++;
        break;
      case "create_product":
      case "create_landing":
      case "create_tool":
      case "create_bot":
        this.metrics.totalProducts++;
        break;
    }

    // Check goal progress
    for (const goal of this.goals) {
      if (goal.status !== "active") continue;
      if (goal.targetMetric === "users") {
        goal.currentValue = this.metrics.totalUsers;
      } else if (goal.targetMetric === "content") {
        goal.currentValue = this.metrics.totalContent;
      } else if (goal.targetMetric === "products") {
        goal.currentValue = this.metrics.totalProducts;
      }

      if (goal.currentValue >= goal.targetValue) {
        goal.status = "achieved";
        this.log.info(`🎯 Goal achieved: ${goal.title}`);
        eventBus.emit({ type: "goal:achieved", goal });
      } else {
        eventBus.emit({ type: "goal:progress", goal });
      }
    }
  }

  /** Trigger a manual analysis cycle. */
  async triggerAnalysis(): Promise<void> {
    this.createSubTask({
      type: "analyze_metrics",
      priority: "high",
      title: "Periodic analysis cycle",
      description: "Analyze metrics, identify bottlenecks, create new tasks",
      assignedTo: this.identity.id,
    });
  }
}
