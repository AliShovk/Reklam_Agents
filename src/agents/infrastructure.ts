import { BaseAgent } from "../core/base-agent.js";
import { messageQueue } from "../core/message-queue.js";
import { knowledgeBase } from "../core/knowledge-base.js";
import type { Task } from "../core/types.js";
import os from "node:os";

/**
 * Infrastructure Agent — следит за системой.
 * 
 * Мониторит серверы, базы, масштабирование.
 * Отслеживает использование ресурсов.
 */
export class InfrastructureAgent extends BaseAgent {
  constructor() {
    super({
      role: "infrastructure",
      name: "Infrastructure Agent",
      description: "Мониторит серверы, ресурсы, масштабирование. Следит за здоровьем системы.",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "monitor_health":
        return this.monitorHealth();
      case "scale_resources":
        return this.planScaling(task);
      default:
        return this.monitorHealth();
    }
  }

  private async monitorHealth(): Promise<Record<string, unknown>> {
    const memUsage = process.memoryUsage();
    const cpuUsage = os.loadavg();
    const uptime = process.uptime();

    const health = {
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024) + " MB",
        freeMemory: Math.round(os.freemem() / 1024 / 1024) + " MB",
        loadAvg: cpuUsage,
        uptime: Math.round(uptime) + "s",
      },
      process: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB",
        rss: Math.round(memUsage.rss / 1024 / 1024) + " MB",
        external: Math.round(memUsage.external / 1024 / 1024) + " MB",
      },
      queues: messageQueue.getQueueStats(),
      processing: messageQueue.getProcessingCount(),
      completed: messageQueue.getCompletedCount(),
      failed: messageQueue.getFailedCount(),
      knowledge: knowledgeBase.getStats(),
    };

    // Check for issues
    const issues: string[] = [];
    const freeMemPercent = (os.freemem() / os.totalmem()) * 100;
    if (freeMemPercent < 10) issues.push(`Low memory: ${freeMemPercent.toFixed(1)}% free`);
    if (cpuUsage[0] > os.cpus().length * 0.8) issues.push(`High CPU: ${cpuUsage[0].toFixed(2)}`);
    if (messageQueue.getFailedCount() > 50) issues.push(`High failure rate: ${messageQueue.getFailedCount()} failed tasks`);

    if (issues.length > 0) {
      this.log.warn(`Health issues: ${issues.join("; ")}`);
    }

    this.addKnowledge({
      type: "metric",
      title: `Health check — ${new Date().toISOString()}`,
      content: JSON.stringify(health),
      tags: ["health", "infrastructure"],
    });

    return { health, issues };
  }

  private async planScaling(task: Task): Promise<Record<string, unknown>> {
    const currentHealth = await this.monitorHealth();

    const plan = await this.thinkJson<{
      recommendations: Array<{
        resource: string;
        currentUsage: string;
        recommendation: string;
        priority: string;
      }>;
      scalingPlan: {
        agentsToAdd: string[];
        agentsToRemove: string[];
        resourceChanges: string[];
      };
    }>(
      `You are an Infrastructure Planning Agent.
Analyze system health and recommend scaling decisions.`,
      `Current system health: ${JSON.stringify(currentHealth)}
Task: ${task.description}

Provide scaling recommendations.
Respond in JSON with keys: recommendations, scalingPlan`
    );

    return { scalingPlan: plan };
  }
}
