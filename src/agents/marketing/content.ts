import { BaseAgent } from "../../core/base-agent.js";
import type { Task, ContentType, GrowthChannel } from "../../core/types.js";

/**
 * Content Agent — создает контент.
 * 
 * Генерирует посты, статьи, видео-скрипты, мемы, кейсы, туториалы.
 * Адаптирует стиль под целевой канал.
 */
export class ContentAgent extends BaseAgent {
  constructor() {
    super({
      role: "content",
      name: "Content Agent",
      description: "Создает контент: статьи, посты, видео-скрипты, мемы, кейсы, туториалы.",
      model: process.env.BULK_MODEL || "gpt-4o-mini",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "create_content":
        return this.createContent(task);
      case "generate_articles":
        return this.generateArticles(task);
      default:
        return this.createContent(task);
    }
  }

  private async createContent(task: Task): Promise<Record<string, unknown>> {
    const contentInput = task.input.content as any;
    const spec = task.input.spec as any;
    const channel = contentInput?.channel || "medium";
    const contentType = contentInput?.type || "article";

    const content = await this.thinkJson<{
      title: string;
      body: string;
      summary: string;
      hashtags: string[];
      keywords: string[];
      callToAction: string;
      variations: Array<{
        platform: string;
        text: string;
      }>;
    }>(
      `You are a Content Creation Agent specialized in ${channel} content.

Content style guide by platform:
- telegram: Short, punchy, with emojis. Max 4096 chars. Use formatting (**bold**, __italic__).
- reddit: Informative, value-first. No self-promotion in title. Add value before links.
- medium: Long-form, well-structured. Headers, code blocks, images placeholders.
- twitter: Thread format. Hook in first tweet. Max 280 chars per tweet.
- youtube: Script format with timestamps. Hook in first 5 seconds.
- linkedin: Professional tone. Personal stories + insights.
- tiktok: Hook + problem + solution + CTA. Under 60 seconds.

Important: Content must provide REAL value first. Promotion is subtle — embedded in useful content.`,

      `Create ${contentType} for ${channel}:
Topic: ${task.title}
Details: ${task.description}
Product context: ${spec ? JSON.stringify({ name: spec.name, features: spec.features }) : "N/A"}

Respond in JSON with keys: title, body, summary, hashtags, keywords, callToAction, variations (adaptations for other platforms)`
    );

    this.addKnowledge({
      type: "content",
      title: content.title,
      content: content.body.slice(0, 2000),
      tags: ["content", contentType, channel, ...content.keywords.slice(0, 5)],
    });

    // Create posting task
    this.createSubTask({
      type: "publish_content",
      priority: "medium",
      title: `Publish: ${content.title}`,
      description: `Publish to ${channel}. CTA: ${content.callToAction}`,
      input: { content, channel },
      assignedTo: "posting",
    });

    // Create variations for other platforms
    for (const variation of content.variations || []) {
      if (variation.platform !== channel) {
        this.createSubTask({
          type: "publish_content",
          priority: "low",
          title: `Cross-post: ${content.title} → ${variation.platform}`,
          description: variation.text.slice(0, 200),
          input: { content: { ...content, body: variation.text }, channel: variation.platform },
          assignedTo: "posting",
        });
      }
    }

    return { content };
  }

  private async generateArticles(task: Task): Promise<Record<string, unknown>> {
    const keywords = (task.input.keywords as string[]) || [];
    const count = (task.input.count as number) || 5;

    const articles = await this.thinkJson<{
      articles: Array<{
        title: string;
        slug: string;
        body: string;
        metaDescription: string;
        keywords: string[];
        wordCount: number;
      }>;
    }>(
      `You are an SEO Content Writer Agent.
Generate high-quality, SEO-optimized articles.

Requirements:
- Minimum 800 words per article
- Natural keyword placement (2-3% density)
- Structured with H2, H3 headers
- Include practical examples
- FAQ section at the end
- Internal linking placeholders [INTERNAL_LINK: topic]
- External authority links placeholders [EXTERNAL_LINK: topic]`,

      `Generate ${count} SEO articles for keywords: ${keywords.join(", ")}
Topic area: ${task.description}

Respond in JSON with key: articles (array of {title, slug, body, metaDescription, keywords, wordCount})`
    );

    for (const article of articles.articles || []) {
      this.addKnowledge({
        type: "content",
        title: article.title,
        content: article.body.slice(0, 3000),
        tags: ["article", "seo", ...article.keywords.slice(0, 5)],
      });
    }

    return { articlesGenerated: articles.articles?.length || 0 };
  }
}
