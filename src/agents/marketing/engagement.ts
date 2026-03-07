import { BaseAgent } from "../../core/base-agent.js";
import type { Task } from "../../core/types.js";

/**
 * Engagement Agent — общается с людьми в сообществах.
 * 
 * Ключевой принцип: СНАЧАЛА помоги человеку решить проблему бесплатно.
 * Только если спросят "где?" — дай ссылку.
 * Эмуляция эмпатии и естественной коммуникации.
 */
export class EngagementAgent extends BaseAgent {
  constructor() {
    super({
      role: "engagement",
      name: "Engagement Agent",
      description: "Общается с людьми в сообществах. Помогает бесплатно, строит доверие.",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "engage":
        return this.engageInCommunity(task);
      default:
        return this.engageInCommunity(task);
    }
  }

  private async engageInCommunity(task: Task): Promise<Record<string, unknown>> {
    const community = task.input.community as any;

    const engagement = await this.thinkJson<{
      responses: Array<{
        context: string;
        response: string;
        tone: string;
        includesLink: boolean;
        linkJustification: string;
      }>;
      conversationStarters: Array<{
        topic: string;
        message: string;
        expectedEngagement: string;
      }>;
      helpfulAnswers: Array<{
        question: string;
        answer: string;
        subtlePromotion: string;
      }>;
      guidelines: string[];
    }>(
      `You are a Community Engagement Agent.

CRITICAL RULES:
1. NEVER spam. NEVER drop links without context.
2. ALWAYS provide genuine value FIRST.
3. Be a helpful community member. Answer questions thoroughly.
4. Only mention products/links when someone ASKS or when it naturally fits.
5. Match the community's tone and culture.
6. Use personal language: "I found this useful...", "In my experience..."
7. Ask follow-up questions to show genuine interest.
8. Share experiences, not advertisements.

ANTI-PATTERNS (NEVER do these):
- "Check out our amazing tool at..."
- "We just launched..."
- "Use code PROMO20 for..."
- Any message that reads like an ad

GOOD PATTERNS:
- Answer a question in detail, then "btw I used [tool] for this, worked well"
- Share a genuine tip, naturally mention the tool if relevant
- Ask what they've tried, share what worked for you`,

      `Engage in community:
Name: ${community?.name || task.title}
Platform: ${community?.platform || "unknown"}
Rules: ${community?.rules || "standard community rules"}
Best content type: ${community?.bestContentType || "helpful answers"}
Approach: ${community?.approachStrategy || "value-first"}

Generate:
1. Template responses for common questions
2. Conversation starters
3. Helpful answers that subtly build awareness

Respond in JSON with keys: responses, conversationStarters, helpfulAnswers, guidelines`
    );

    this.addKnowledge({
      type: "content",
      title: `Engagement templates: ${community?.name || task.title}`,
      content: JSON.stringify({
        starters: engagement.conversationStarters?.length || 0,
        answers: engagement.helpfulAnswers?.length || 0,
      }),
      tags: ["engagement", "community", community?.platform || "unknown"],
    });

    return {
      templates: engagement.responses?.length || 0,
      starters: engagement.conversationStarters?.length || 0,
      answers: engagement.helpfulAnswers?.length || 0,
    };
  }
}
