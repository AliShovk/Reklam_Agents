import { BaseAgent } from "../core/base-agent.js";
import { knowledgeBase } from "../core/knowledge-base.js";
import { messageQueue } from "../core/message-queue.js";
import type { Task } from "../core/types.js";

export class AnalyticsAgent extends BaseAgent {
  constructor() {
    super({
      role: "analytics",
      name: "Analytics Agent",
      description: "Собирает сводки по метрикам, атрибуции, каналам и конверсиям для роста.",
      model: process.env.STRATEGY_MODEL || "gpt-4o",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    const queueStats = messageQueue.getQueueStats();
    const kbStats = knowledgeBase.getStats();
    const goals = Array.isArray(task.input.goals) ? task.input.goals : [];

    if (task.type === "track_metrics" || task.type === "analyze_attribution") {
      const summary = await this.thinkJson<{
        overview: string;
        bottlenecks: string[];
        nextActions: string[];
        topChannels: Array<{ channel: string; reason: string }>;
      }>(
        `You are an analytics agent for an autonomous growth system.
Respond in Russian.
Summarize available signals, identify bottlenecks, and recommend next actions.
Keep output compact and operational.`,
        `Task: ${task.title}
Description: ${task.description}
Queue stats: ${JSON.stringify(queueStats)}
Knowledge stats: ${JSON.stringify(kbStats)}
Goals snapshot: ${JSON.stringify(goals)}
Respond in JSON with keys: overview, bottlenecks, nextActions, topChannels`
      );

      return {
        summary,
        queueStats,
        knowledgeStats: kbStats,
      };
    }

    return {
      skipped: true,
      reason: `Unsupported task type: ${task.type}`,
    };
  }
}
