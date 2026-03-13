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
    const promotionTarget = typeof task.input.targetSite === "string" && task.input.targetSite.length > 0
      ? task.input.targetSite
      : typeof contentInput?.targetSite === "string" && contentInput.targetSite.length > 0
        ? contentInput.targetSite
        : "masterhacks.ru";
    const offerName = typeof spec?.name === "string" && spec.name.length > 0
      ? spec.name
      : typeof contentInput?.offerName === "string" && contentInput.offerName.length > 0
        ? contentInput.offerName
        : "полезные видео для дома и хозяйства на masterhacks.ru";

    const content = await this.thinkJson<{
      title: string;
      body: string;
      callToAction: string;
      variations: Array<{
        platform: string;
        text: string;
      }>;
    }>(
      `You are a Content Creation Agent specialized in ${channel} content.
Write all human-facing content in Russian.

Content style guide by platform:
- telegram: Short, punchy, with emojis. Max 4096 chars. Use formatting (**bold**, __italic__).
- reddit: Informative, value-first. No self-promotion in title. Add value before links.
- medium: Long-form, well-structured. Headers, code blocks, images placeholders.
- twitter: Thread format. Hook in first tweet. Max 280 chars per tweet.
- youtube: Script format with timestamps. Hook in first 5 seconds.
- linkedin: Professional tone. Personal stories + insights.
- tiktok: Hook + problem + solution + CTA. Under 60 seconds.

Important:
- The primary goal is direct promotion of the target site/product, not generic education.
- masterhacks.ru is a site with useful videos for home, household tasks, DIY, repairs, and everyday practical problems.
- Mention the promoted product, offer, or site naturally and explicitly.
- Every piece must explain why the audience should visit, watch, save, or subscribe now.
- Always include a clear CTA to ${promotionTarget} or the promoted offer.
- Avoid describing masterhacks.ru as a marketing tool, promo-material service, or business automation product.
- Do not write about content creation, content adaptation, content publishing, social media planning, audience growth, promotion tools, or marketing workflows unless the topic is explicitly about a household or DIY task.
- If the input topic is abstract or marketing-related, reinterpret it into a concrete home, repair, household, cleaning, organization, or DIY use case.
- Avoid generic tips that could fit any business if they do not support promotion.`,

      `Create ${contentType} for ${channel}:
Topic: ${task.title}
Details: ${task.description}
Product context: ${spec ? JSON.stringify({ name: spec.name, features: spec.features }) : "N/A"}
Promoted site: ${promotionTarget}
Promoted offer: ${offerName}

Make this content promotional-first:
- position masterhacks.ru as a practical source of helpful videos for home and household needs
- focus on the practical benefit, relevance for everyday life, and next action
- reference the promoted site or product directly
- do not produce abstract creator or marketing advice unless it directly supports the promoted site category
- prefer topics like cleaning, storage, repairs, tools at home, kitchen, bathroom, wiring basics, furniture fixes, seasonal chores, and household hacks
- never frame the content as a guide to creating content, publishing content, or promoting channels

Keep the response compact:
- body should be concise and publishable, usually under 1200 characters unless channel requires more
- variations: max 2 items
- each variation text under 280 characters
Respond in JSON with keys: title, body, callToAction, variations (adaptations for other platforms)
`,

    );

    const normalizedTitle = typeof content.title === "string" && content.title.length > 0 ? content.title : task.title;
    const normalizedBody = typeof content.body === "string" && content.body.length > 0 ? content.body : task.description;
    const normalizedCallToAction = typeof content.callToAction === "string" && content.callToAction.length > 0 ? content.callToAction : "Узнать больше";
    const variations = Array.isArray(content.variations)
      ? content.variations
          .filter((variation): variation is NonNullable<typeof content.variations>[number] => Boolean(variation && typeof variation === "object"))
          .filter((variation) => typeof variation.platform === "string" && variation.platform.length > 0 && typeof variation.text === "string" && variation.text.length > 0)
          .slice(0, 2)
      : [];

    this.addKnowledge({
      type: "content",
      title: normalizedTitle,
      content: normalizedBody.slice(0, 2000),
      tags: ["content", contentType, channel],
    });

    // Create posting task
    this.createSubTask({
      type: "publish_content",
      priority: "medium",
      title: `Publish: ${normalizedTitle}`,
      description: `Publish to ${channel}. CTA: ${normalizedCallToAction}`,
      input: { content: { ...content, title: normalizedTitle, body: normalizedBody, callToAction: normalizedCallToAction, variations }, channel },
      assignedTo: "posting",
    });

    // Create variations for other platforms
    for (const variation of variations) {
      if (variation.platform !== channel) {
        this.createSubTask({
          type: "publish_content",
          priority: "low",
          title: `Cross-post: ${normalizedTitle} → ${variation.platform}`,
          description: variation.text.slice(0, 200),
          input: { content: { ...content, title: normalizedTitle, body: variation.text, callToAction: normalizedCallToAction, variations: [] }, channel: variation.platform },
          assignedTo: "posting",
        });
      }
    }

    return { content };
  }

  private async generateArticles(task: Task): Promise<Record<string, unknown>> {
    const keywords = (task.input.keywords as string[]) || [];
    const count = Math.min((task.input.count as number) || 5, 2);

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
Write all articles and meta descriptions in Russian.
Generate high-quality, SEO-optimized articles.

Requirements:
- 500-700 words per article
- Natural keyword placement (2-3% density)
- Structured with H2, H3 headers
- Include practical examples
- One short FAQ section at the end
- Internal linking placeholders [INTERNAL_LINK: topic]
- External authority links placeholders [EXTERNAL_LINK: topic]`,

      `Generate ${count} SEO articles for keywords: ${keywords.join(", ")}
Topic area: ${task.description}

The articles should attract search traffic that can be converted into visits to masterhacks.ru as a source of useful home and household videos.
Include a natural promotional bridge and CTA where appropriate.

Respond in JSON with key: articles (array of {title, slug, body, metaDescription, keywords, wordCount})`
    );

    const normalizedArticles = Array.isArray(articles.articles)
      ? articles.articles.filter((article): article is NonNullable<typeof articles.articles>[number] => Boolean(article && typeof article === "object"))
      : [];

    for (const article of normalizedArticles) {
      this.addKnowledge({
        type: "content",
        title: article.title,
        content: article.body.slice(0, 3000),
        tags: ["article", "seo", ...article.keywords.slice(0, 5)],
      });
    }

    return { articlesGenerated: normalizedArticles.length };
  }
}
