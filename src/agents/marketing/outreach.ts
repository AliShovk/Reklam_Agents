import { BaseAgent } from "../../core/base-agent.js";
import type { Task } from "../../core/types.js";

/**
 * Outreach Agent — ищет сообщества, чаты, форумы.
 * 
 * Находит места, где обитает целевая аудитория.
 * Составляет карту сообществ для Engagement Agent.
 */
export class OutreachAgent extends BaseAgent {
  constructor() {
    super({
      role: "outreach",
      name: "Outreach Agent",
      description: "Ищет сообщества, чаты, форумы с целевой аудиторией. Строит карту присутствия.",
      model: process.env.BULK_MODEL || "gpt-4o-mini",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "outreach":
        return this.findCommunities(task);
      default:
        return this.findCommunities(task);
    }
  }

  private async findCommunities(task: Task): Promise<Record<string, unknown>> {
    const communities = await this.thinkJson<{
      communities: Array<{
        platform: string;
        name: string;
        url: string;
        memberCount: string;
        relevanceScore: number;
        approachStrategy: string;
        rules: string;
        bestContentType: string;
      }>;
      outreachPlan: Array<{
        community: string;
        action: string;
        timeline: string;
        expectedOutcome: string;
      }>;
    }>(
      `You are an Outreach Research Agent.
Your job is to find online communities where the target audience gathers.

Search across:
- Telegram groups/channels
- Reddit subreddits
- Discord servers
- Facebook groups
- Forums (specialized)
- Slack communities
- LinkedIn groups
- Quora spaces

Important rules:
- Each community has RULES. Respect them.
- Never spam. Value-first approach.
- Look for communities with 1K-50K members (sweet spot: engaged, not too noisy)
- Rate relevance 1-10`,

      `Find communities for:
Topic: ${task.title}
Target audience: ${task.description}
Context: ${JSON.stringify(task.input)}

Respond in JSON with keys: communities (array), outreachPlan (array)`
    );

    // Save community map to knowledge base
    this.addKnowledge({
      type: "research",
      title: `Communities: ${task.title}`,
      content: JSON.stringify(communities.communities?.slice(0, 10)),
      tags: ["outreach", "communities"],
    });

    // Create engagement tasks for top communities
    for (const plan of communities.outreachPlan?.slice(0, 5) || []) {
      this.createSubTask({
        type: "engage",
        priority: "medium",
        title: `Engage in: ${plan.community}`,
        description: `Action: ${plan.action}. Expected: ${plan.expectedOutcome}`,
        input: { community: plan, allCommunities: communities.communities },
        assignedTo: "engagement",
      });
    }

    return {
      communitiesFound: communities.communities?.length || 0,
      outreachPlans: communities.outreachPlan?.length || 0,
    };
  }
}
