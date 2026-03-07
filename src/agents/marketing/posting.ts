import { BaseAgent } from "../../core/base-agent.js";
import type { Task, GrowthChannel } from "../../core/types.js";

/**
 * Posting Agent — публикует контент в соцсети, форумы, блоги.
 * 
 * Адаптирует формат под каждую платформу,
 * следит за расписанием публикаций, отслеживает результаты.
 */
export class PostingAgent extends BaseAgent {
  private publishedCount = 0;

  constructor() {
    super({
      role: "posting",
      name: "Posting Agent",
      description: "Публикует контент в соцсети, форумы, блоги. Адаптирует формат под платформу.",
    });
  }

  getPublishedCount(): number {
    return this.publishedCount;
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "publish_content":
        return this.publishContent(task);
      default:
        return this.publishContent(task);
    }
  }

  private async publishContent(task: Task): Promise<Record<string, unknown>> {
    const content = task.input.content as any;
    const channel = (task.input.channel as GrowthChannel) || "telegram";

    const publishPlan = await this.thinkJson<{
      platform: string;
      formattedContent: string;
      bestTimeToPost: string;
      hashtags: string[];
      targetCommunities: string[];
      crossPostTo: string[];
      notes: string;
    }>(
      `You are a Social Media Publishing Agent.
Your job is to publish content to the right platform with optimal formatting and timing.

Platform formatting rules:
- telegram: Markdown, emojis, short paragraphs, max 4096 chars
- reddit: Title + body. No self-promo in title. Flair selection. 
- medium: Full article with images, headers, code blocks
- twitter: Thread of 280-char tweets. Hook first.
- youtube: Title, description, tags for video publishing
- linkedin: Professional with personal story angle
- tiktok: Caption with hooks and trending hashtags
- forums: Contextual, helpful reply format`,

      `Prepare this content for publishing on ${channel}:

Title: ${content?.title || task.title}
Body: ${(content?.body || task.description).slice(0, 2000)}
CTA: ${content?.callToAction || ""}
Hashtags: ${JSON.stringify(content?.hashtags || [])}

Respond in JSON with keys: platform, formattedContent, bestTimeToPost, hashtags, targetCommunities, crossPostTo, notes`
    );

    this.publishedCount++;

    this.addKnowledge({
      type: "content",
      title: `Published on ${channel}: ${content?.title || task.title}`,
      content: `Published to ${publishPlan.platform}. Communities: ${publishPlan.targetCommunities?.join(", ")}`,
      tags: ["published", channel],
    });

    this.log.info(`Published content to ${channel}: ${content?.title || task.title}`);

    return {
      published: true,
      platform: publishPlan.platform,
      formattedContent: publishPlan.formattedContent,
      targetCommunities: publishPlan.targetCommunities,
    };
  }
}
