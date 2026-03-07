import { BaseAgent } from "../core/base-agent.js";
import { eventBus } from "../core/event-bus.js";
import type { Task, AgentStatus } from "../core/types.js";

/**
 * Observability Agent — наблюдатель за другими агентами.
 * 
 * Следит за здоровьем агентов, отключает глючных,
 * отправляет отчеты Supervisor-у.
 * Критически важный элемент для стабильности фермы.
 */
export class ObservabilityAgent extends BaseAgent {
  private agentErrors = new Map<string, { count: number; lastError: string; firstSeen: Date }>();
  private agentStatuses = new Map<string, AgentStatus>();
  private errorThreshold = 5;
  private alertsSent = 0;

  constructor() {
    super({
      role: "observability",
      name: "Observability Agent",
      description: "Наблюдает за другими агентами. Детектирует аномалии, отключает нестабильных.",
    });
  }

  protected async onStart(): Promise<void> {
    // Track all agent errors
    eventBus.on("alert:agent_error", (event) => {
      if (event.type === "alert:agent_error") {
        this.trackError(event.agentId, event.error);
      }
    });

    // Track agent status changes
    eventBus.on("agent:status_changed", (event) => {
      if (event.type === "agent:status_changed") {
        this.agentStatuses.set(event.agentId, event.status);
      }
    });

    // Track task failures
    eventBus.on("task:failed", (event) => {
      if (event.type === "task:failed" && event.task.assignedTo) {
        this.trackError(event.task.assignedTo, event.error);
      }
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    return this.generateReport();
  }

  private trackError(agentId: string, error: string): void {
    const existing = this.agentErrors.get(agentId);
    if (existing) {
      existing.count++;
      existing.lastError = error;
    } else {
      this.agentErrors.set(agentId, { count: 1, lastError: error, firstSeen: new Date() });
    }

    const errorData = this.agentErrors.get(agentId)!;
    if (errorData.count >= this.errorThreshold) {
      this.log.error(
        `ALERT: Agent ${agentId} has ${errorData.count} errors. Last: ${error}. Recommending disable.`
      );
      this.alertsSent++;

      // Notify supervisor
      this.createSubTask({
        type: "analyze_metrics",
        priority: "critical",
        title: `Agent ${agentId} is unstable — ${errorData.count} errors`,
        description: `Agent ${agentId} has exceeded error threshold (${this.errorThreshold}). Last error: ${error}. First seen: ${errorData.firstSeen.toISOString()}. Recommend disabling and investigating.`,
        input: { agentId, errors: errorData },
        assignedTo: "supervisor",
      });

      // Reset counter after alert
      errorData.count = 0;
    }
  }

  private async generateReport(): Promise<Record<string, unknown>> {
    const report = {
      timestamp: new Date().toISOString(),
      agentStatuses: Object.fromEntries(this.agentStatuses),
      agentErrors: Object.fromEntries(
        Array.from(this.agentErrors.entries()).map(([id, data]) => [id, data])
      ),
      alertsSent: this.alertsSent,
      recentEvents: eventBus.getHistory(undefined, 20).map((e) => ({
        type: e.type,
        timestamp: new Date().toISOString(),
      })),
    };

    this.addKnowledge({
      type: "metric",
      title: `Observability report — ${report.timestamp}`,
      content: JSON.stringify(report),
      tags: ["observability", "report"],
    });

    return { report };
  }

  getAlertCount(): number {
    return this.alertsSent;
  }

  getAgentErrorMap(): Map<string, { count: number; lastError: string }> {
    return this.agentErrors;
  }
}
