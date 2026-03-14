import { v4 as uuid } from "uuid";
import type { Task, TaskPriority, TaskStatus, TaskType } from "./types.js";
import { eventBus } from "./event-bus.js";
import { createSubLogger } from "./logger.js";

const log = createSubLogger("message-queue");

/**
 * In-memory message queue for agent task distribution.
 * In production, replace with BullMQ + Redis for persistence and scaling.
 */
class MessageQueue {
  private queues = new Map<string, Task[]>();
  private processing = new Map<string, Task>();
  private completed: Task[] = [];
  private failed: Task[] = [];

  createTask(params: {
    type: TaskType;
    priority: TaskPriority;
    createdBy: string;
    title: string;
    description: string;
    input?: Record<string, unknown>;
    parentTaskId?: string;
    assignedTo?: string;
    deadline?: Date;
    maxRetries?: number;
  }): Task {
    const task: Task = {
      id: uuid(),
      type: params.type,
      priority: params.priority,
      status: "pending",
      assignedTo: params.assignedTo,
      createdBy: params.createdBy,
      title: params.title,
      description: params.description,
      input: params.input || {},
      childTaskIds: [],
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: params.maxRetries ?? 3,
      parentTaskId: params.parentTaskId,
      metadata: {},
    };

    const queueName = params.assignedTo || task.type;
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    this.queues.get(queueName)!.push(task);
    this.sortQueue(queueName);

    log.info(`Task created: [${task.id.slice(0, 8)}] ${task.title} → ${queueName}`);
    eventBus.emit({ type: "task:created", task });

    return task;
  }

  /** Pick next task from a queue (by agent role or task type). */
  pickTask(queueName: string): Task | null {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) return null;

    const task = queue.shift()!;
    task.status = "in_progress";
    task.startedAt = new Date();
    this.processing.set(task.id, task);

    log.info(`Task picked: [${task.id.slice(0, 8)}] ${task.title} by ${queueName}`);
    return task;
  }

  /** Complete a task with output. */
  completeTask(taskId: string, output: Record<string, unknown>): void {
    const task = this.processing.get(taskId);
    if (!task) {
      log.warn(`Task ${taskId} not found in processing`);
      return;
    }

    task.status = "completed";
    task.output = output;
    task.completedAt = new Date();
    this.processing.delete(taskId);
    this.completed.push(task);

    log.info(`Task completed: [${task.id.slice(0, 8)}] ${task.title}`);
    eventBus.emit({ type: "task:completed", task });
  }

  /** Fail a task, optionally retry. */
  failTask(taskId: string, error: string): void {
    const task = this.processing.get(taskId);
    if (!task) {
      log.warn(`Task ${taskId} not found in processing`);
      return;
    }

    task.retryCount++;
    if (task.retryCount < task.maxRetries) {
      log.warn(`Task retry ${task.retryCount}/${task.maxRetries}: [${task.id.slice(0, 8)}] ${error}`);
      task.status = "pending";
      this.processing.delete(taskId);
      const queueName = task.assignedTo || task.type;
      if (!this.queues.has(queueName)) this.queues.set(queueName, []);
      this.queues.get(queueName)!.push(task);
      this.sortQueue(queueName);
    } else {
      task.status = "failed";
      task.error = error;
      task.completedAt = new Date();
      this.processing.delete(taskId);
      this.failed.push(task);
      log.error(`Task failed: [${task.id.slice(0, 8)}] ${task.title} — ${error}`);
      eventBus.emit({ type: "task:failed", task, error });
    }
  }

  /** Get pending tasks count per queue. */
  getQueueStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [name, queue] of this.queues) {
      stats[name] = queue.length;
    }
    return stats;
  }

  getProcessingCount(): number {
    return this.processing.size;
  }

  getCompletedCount(): number {
    return this.completed.length;
  }

  getFailedCount(): number {
    return this.failed.length;
  }

  getPendingTasks(queueName?: string): Task[] {
    if (queueName) {
      return this.queues.get(queueName) || [];
    }
    return Array.from(this.queues.values()).flat();
  }

  getPendingCount(queueName?: string): number {
    if (queueName) {
      return (this.queues.get(queueName) || []).length;
    }
    return Array.from(this.queues.values()).reduce((sum, queue) => sum + queue.length, 0);
  }

  getRecentCompleted(limit = 20): Task[] {
    return this.completed.slice(-limit);
  }

  getRecentFailed(limit = 20): Task[] {
    return this.failed.slice(-limit);
  }

  private sortQueue(queueName: string): void {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }
}

export const messageQueue = new MessageQueue();
