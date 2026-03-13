import { v4 as uuid } from "uuid";
import type { AgentIdentity, AgentMetrics, AgentRole, AgentStatus, Task } from "./types.js";
import { messageQueue } from "./message-queue.js";
import { knowledgeBase } from "./knowledge-base.js";
import { eventBus } from "./event-bus.js";
import { llmChat, llmJson, type LLMRequest } from "./llm.js";
import { getConfig } from "./config.js";
import { createAgentLogger } from "./logger.js";
import type { Logger } from "winston";

export abstract class BaseAgent {
  readonly identity: AgentIdentity;
  protected log: Logger;
  private _running = false;
  private _pollIntervalMs = 2000;
  private _pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(params: {
    role: AgentRole;
    name: string;
    description: string;
    model?: string;
  }) {
    const config = getConfig();
    this.identity = {
      id: `${params.role}-${uuid().slice(0, 8)}`,
      role: params.role,
      name: params.name,
      description: params.description,
      model: params.model || config.models.default,
      status: "idle",
      createdAt: new Date(),
      lastActiveAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        tokensUsed: 0,
        avgResponseTimeMs: 0,
        uptime: 0,
      },
    };
    this.log = createAgentLogger(this.identity.id);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this._running = true;
    this.setStatus("idle");
    this.log.info(`Agent started: ${this.identity.name} (${this.identity.role})`);
    await this.onStart();
    this.pollLoop();
  }

  async stop(): Promise<void> {
    this._running = false;
    if (this._pollTimer) clearTimeout(this._pollTimer);
    this.setStatus("disabled");
    this.log.info(`Agent stopped: ${this.identity.name}`);
    await this.onStop();
  }

  get isRunning(): boolean {
    return this._running;
  }

  // ─── Task Processing ─────────────────────────────────────────────────

  private async pollLoop(): Promise<void> {
    if (!this._running) return;

    try {
      const task = this.pickNextTask();
      if (task) {
        await this.processTask(task);
      }
    } catch (err: any) {
      this.log.error(`Poll loop error: ${err.message}`);
    }

    this._pollTimer = setTimeout(() => this.pollLoop(), this._pollIntervalMs);
  }

  protected pickNextTask(): Task | null {
    // Try agent-specific queue first, then role queue
    return (
      messageQueue.pickTask(this.identity.id) ||
      messageQueue.pickTask(this.identity.role)
    );
  }

  private async processTask(task: Task): Promise<void> {
    this.setStatus("working");
    this.identity.lastActiveAt = new Date();
    const startTime = Date.now();

    try {
      this.log.info(`Processing task: [${task.id.slice(0, 8)}] ${task.title}`);
      const output = await this.executeTask(task);
      messageQueue.completeTask(task.id, output);
      this.identity.metrics.tasksCompleted++;

      // Store result in knowledge base if meaningful
      if (output && Object.keys(output).length > 0) {
        await this.storeResult(task, output);
      }
    } catch (err: any) {
      this.log.error(`Task execution failed: ${err.message}`);
      messageQueue.failTask(task.id, err.message);
      this.identity.metrics.tasksFailed++;
      eventBus.emit({
        type: "alert:agent_error",
        agentId: this.identity.id,
        error: err.message,
      });
    } finally {
      const duration = Date.now() - startTime;
      this.updateAvgResponseTime(duration);
      this.setStatus("idle");
    }
  }

  // ─── Abstract Methods (implement in each agent) ───────────────────────

  /** Execute a task. Return output data. */
  protected abstract executeTask(task: Task): Promise<Record<string, unknown>>;

  /** Called when agent starts. */
  protected async onStart(): Promise<void> {}

  /** Called when agent stops. */
  protected async onStop(): Promise<void> {}

  // ─── LLM Helpers ─────────────────────────────────────────────────────

  private withDefaultLanguageInstruction(systemPrompt: string): string {
    return `${systemPrompt.trim()}

Default language policy:
- Respond in Russian by default.
- Write user-facing content, posts, strategies, replies, titles, and explanations in natural Russian.
- Keep JSON keys and technical identifiers in the requested format, but all human-readable values should be in Russian unless the task explicitly requires another language.`;
  }

  protected async think(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await llmChat({
      model: this.identity.model,
      systemPrompt: this.withDefaultLanguageInstruction(systemPrompt),
      userMessage,
    });
    this.identity.metrics.tokensUsed += response.tokensUsed;
    return response.content;
  }

  protected async thinkJson<T = unknown>(systemPrompt: string, userMessage: string): Promise<T> {
    const response = await llmJson<T>({
      model: this.identity.model,
      systemPrompt: this.withDefaultLanguageInstruction(systemPrompt),
      userMessage,
    });
    this.identity.metrics.tokensUsed += response.tokensUsed;
    return response.data;
  }

  // ─── Knowledge Base Helpers ───────────────────────────────────────────

  protected searchKnowledge(query: string, type?: string, limit = 5) {
    return knowledgeBase.search(query, { type: type as any, limit });
  }

  protected addKnowledge(params: {
    type: "product" | "content" | "strategy" | "research" | "code" | "metric" | "lesson";
    title: string;
    content: string;
    tags?: string[];
  }) {
    return knowledgeBase.add({
      ...params,
      metadata: { createdBy: this.identity.id },
    });
  }

  // ─── Task Creation Helper ────────────────────────────────────────────

  protected createSubTask(params: {
    type: Task["type"];
    priority: Task["priority"];
    title: string;
    description: string;
    input?: Record<string, unknown>;
    assignedTo?: string;
  }): Task {
    return messageQueue.createTask({
      ...params,
      createdBy: this.identity.id,
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private setStatus(status: AgentStatus): void {
    this.identity.status = status;
    eventBus.emit({
      type: "agent:status_changed",
      agentId: this.identity.id,
      status,
    });
  }

  private updateAvgResponseTime(durationMs: number): void {
    const m = this.identity.metrics;
    const totalTasks = m.tasksCompleted + m.tasksFailed;
    m.avgResponseTimeMs =
      totalTasks === 0
        ? durationMs
        : (m.avgResponseTimeMs * (totalTasks - 1) + durationMs) / totalTasks;
  }

  private async storeResult(task: Task, output: Record<string, unknown>): Promise<void> {
    const resultStr = typeof output.result === "string" ? output.result : JSON.stringify(output);
    if (resultStr.length > 50) {
      knowledgeBase.add({
        type: this.getKnowledgeType(),
        title: `${task.type}: ${task.title}`,
        content: resultStr.slice(0, 5000),
        tags: [task.type, this.identity.role],
        metadata: { taskId: task.id, agentId: this.identity.id },
      });
    }
  }

  private getKnowledgeType(): "product" | "content" | "strategy" | "research" | "code" | "metric" | "lesson" {
    const map: Record<string, any> = {
      supervisor: "strategy",
      strategy: "strategy",
      product: "product",
      programming: "code",
      content: "content",
      posting: "content",
      outreach: "content",
      engagement: "content",
      seo: "content",
      video: "content",
      infrastructure: "metric",
      observability: "metric",
    };
    return map[this.identity.role] || "research";
  }
}
