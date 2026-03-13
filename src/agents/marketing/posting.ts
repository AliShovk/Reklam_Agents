import { BaseAgent } from "../../core/base-agent.js";
import { getTelegramClient } from "../../core/telegram-client.js";
import { eventBus } from "../../core/event-bus.js";
import type { Task, GrowthChannel } from "../../core/types.js";

/**
 * Posting Agent — публикует контент в соцсети, форумы, блоги.
 * 
 * Адаптирует формат под каждую платформу,
 * следит за расписанием публикаций, отслеживает результаты.
 * Поддерживает реальную публикацию в Telegram канал.
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
      case "telegram_post":
        return this.telegramPost(task);
      case "telegram_poll":
        return this.telegramPoll(task);
      default:
        return this.publishContent(task);
    }
  }

  // ─── Telegram: реальная публикация ──────────────────────────────────

  private async telegramPost(task: Task): Promise<Record<string, unknown>> {
    const tg = getTelegramClient();
    if (!tg) {
      this.log.warn("Telegram client not available, generating content only");
      return this.publishContent(task);
    }

    const content = task.input.content as any;

    // Генерируем пост через LLM
    const post = await this.thinkJson<{
      text: string;
      pinMessage: boolean;
      hasImage: boolean;
      imagePrompt: string;
    }>(
      `You are a Telegram Channel Content Manager.
Create an engaging post for a Telegram channel.

Rules:
- Use HTML formatting: <b>bold</b>, <i>italic</i>, <a href="url">link</a>, <code>code</code>
- Use emojis strategically (not too many)
- Short paragraphs (2-3 sentences max)
- End with a call-to-action or question
- Max 4096 characters
- No Markdown — only HTML tags`,

      `Create a Telegram post about:
Title: ${content?.title || task.title}
Body: ${(content?.body || task.description).slice(0, 2000)}
Tone: professional but friendly
Target: ${content?.targetAudience || "tech-savvy audience"}

Respond in JSON: { text, pinMessage (bool), hasImage (bool), imagePrompt }`,
    );

    // Публикуем в канал
    const result = await tg.postToChannel(post.text, {
      parseMode: "HTML",
      pinMessage: post.pinMessage,
    });

    if (result.ok) {
      this.publishedCount++;
      eventBus.emit({
        type: "telegram:posted",
        channelId: process.env.TELEGRAM_CHANNEL_ID || "",
        messageId: result.messageId,
      });

      this.addKnowledge({
        type: "content",
        title: `TG Post: ${content?.title || task.title}`,
        content: post.text.slice(0, 500),
        tags: ["telegram", "published", "channel"],
      });
    }

    return { published: result.ok, messageId: result.messageId, platform: "telegram" };
  }

  private async telegramPoll(task: Task): Promise<Record<string, unknown>> {
    const tg = getTelegramClient();
    if (!tg) {
      return { published: false, reason: "Telegram client not available" };
    }

    const poll = await this.thinkJson<{
      question: string;
      options: string[];
      isAnonymous: boolean;
    }>(
      `You are a Telegram engagement specialist. Create an engaging poll.`,
      `Topic: ${task.title}
Context: ${task.description}

Create a poll with 2-8 options. Respond in JSON: { question, options, isAnonymous }`,
    );

    const result = await tg.postPollToChannel(poll.question, poll.options, {
      isAnonymous: poll.isAnonymous,
    });

    if (result.ok) this.publishedCount++;

    return { published: result.ok, messageId: result.messageId, platform: "telegram_poll" };
  }

  private async publishContent(task: Task): Promise<Record<string, unknown>> {
    const content = task.input.content as any;
    const channel = (task.input.channel as GrowthChannel) || "telegram";

    // Если канал — Telegram и клиент доступен, публикуем реально
    if (channel === "telegram" && getTelegramClient()) {
      return this.telegramPost(task);
    }

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

Keep the response compact:
- formattedContent: under 900 characters
- plain text only, no markdown image syntax, no code blocks, no long lists
- hashtags: max 8 items
- targetCommunities: max 5 short names
- crossPostTo: max 3 platforms
- notes: under 200 characters

Respond in JSON with keys: platform, formattedContent, bestTimeToPost, hashtags, targetCommunities, crossPostTo, notes`
    );

    const platform = typeof publishPlan.platform === "string" && publishPlan.platform.length > 0 ? publishPlan.platform : channel;
    const formattedContent = typeof publishPlan.formattedContent === "string" && publishPlan.formattedContent.length > 0
      ? publishPlan.formattedContent.slice(0, 900)
      : String(content?.body || task.description).slice(0, 900);
    const singleTargetCommunity = typeof publishPlan.targetCommunities === "string" ? publishPlan.targetCommunities : "";
    const targetCommunities = Array.isArray(publishPlan.targetCommunities)
      ? publishPlan.targetCommunities.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5)
      : singleTargetCommunity.length > 0
        ? [singleTargetCommunity]
        : [];
    const hashtags = Array.isArray(publishPlan.hashtags)
      ? publishPlan.hashtags.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 8)
      : [];
    const bestTimeToPost = typeof publishPlan.bestTimeToPost === "string" && publishPlan.bestTimeToPost.length > 0
      ? publishPlan.bestTimeToPost
      : "next peak engagement window";

    this.publishedCount++;

    this.addKnowledge({
      type: "content",
      title: `Published on ${channel}: ${content?.title || task.title}`,
      content: `Published to ${platform}. Communities: ${targetCommunities.join(", ")}`,
      tags: ["published", channel],
    });

    this.log.info(`Published content to ${channel}: ${content?.title || task.title}`);

    return {
      published: true,
      platform,
      formattedContent,
      bestTimeToPost,
      hashtags,
      targetCommunities,
    };
  }
}
