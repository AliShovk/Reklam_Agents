import { BaseAgent } from "../core/base-agent.js";
import type { Task } from "../core/types.js";

export class ExperimentsAgent extends BaseAgent {
  constructor() {
    super({
      role: "experiments",
      name: "Experiments Agent",
      description: "Проектирует growth-гипотезы, A/B тесты и оценивает победителей.",
      model: process.env.STRATEGY_MODEL || "gpt-4o",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    if (task.type === "design_experiments") {
      const plan = await this.thinkJson<{
        hypothesis: string;
        variants: Array<{ name: string; change: string; expectedImpact: string }>;
        successMetric: string;
        decisionRule: string;
      }>(
        `You are an experiments agent for a growth system.
Respond in Russian.
Design compact, measurable experiments.
Focus on headlines, CTA, landing variants, offers, and channel framing.`,
        `Task: ${task.title}
Description: ${task.description}
Input: ${JSON.stringify(task.input)}
Respond in JSON with keys: hypothesis, variants, successMetric, decisionRule`
      );

      return { plan };
    }

    if (task.type === "evaluate_experiments") {
      const evaluation = await this.thinkJson<{
        outcome: string;
        winningVariant: string;
        why: string;
        nextAction: string;
      }>(
        `You are an experiments evaluation agent.
Respond in Russian.
Select the likely winner based on available results and recommend the next step.`,
        `Task: ${task.title}
Description: ${task.description}
Input: ${JSON.stringify(task.input)}
Respond in JSON with keys: outcome, winningVariant, why, nextAction`
      );

      return { evaluation };
    }

    return {
      skipped: true,
      reason: `Unsupported task type: ${task.type}`,
    };
  }
}
