import { BaseAgent } from "../core/base-agent.js";
import type { Task } from "../core/types.js";

export class AcquisitionAgent extends BaseAgent {
  constructor() {
    super({
      role: "acquisition",
      name: "Acquisition Agent",
      description: "Планирует и координирует каналы привлечения, гипотезы роста и playbooks по acquisition.",
      model: process.env.STRATEGY_MODEL || "gpt-4o",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    if (task.type !== "run_acquisition") {
      return {
        skipped: true,
        reason: `Unsupported task type: ${task.type}`,
      };
    }

    const plan = await this.thinkJson<{
      objective: string;
      channels: Array<{ name: string; why: string; effort: string; expectedOutcome: string }>;
      quickWins: string[];
      dependencies: string[];
    }>(
      `You are an acquisition agent inside an autonomous growth farm.
Respond in Russian.
Prioritize channels by leverage, speed, and realistic execution.
Favor free or low-cost channels first unless the task explicitly asks otherwise.`,
      `Task: ${task.title}
Description: ${task.description}
Input: ${JSON.stringify(task.input)}
Respond in JSON with keys: objective, channels, quickWins, dependencies`
    );

    return { plan };
  }
}
