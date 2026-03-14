import { BaseAgent } from "../../core/base-agent.js";
import { getTelegramClient } from "../../core/telegram-client.js";
import { eventBus } from "../../core/event-bus.js";
import { runtimeSettings } from "../../core/runtime-settings.js";
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
  private lastTelegramPostAt = 0;

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

    const settings = runtimeSettings.get();
    const now = Date.now();
    const nextAllowedAt = this.lastTelegramPostAt + settings.telegramMinPostIntervalMs;
    if (this.lastTelegramPostAt > 0 && now < nextAllowedAt) {
      const waitMs = nextAllowedAt - now;
      this.log.warn(`Skipping Telegram post due to min interval. Wait ${Math.ceil(waitMs / 60000)} min`);
      return {
        published: false,
        skipped: true,
        reason: "telegram_rate_limited",
        waitMs,
        platform: "telegram",
      };
    }

    const content = task.input.content as any;
    const promotionTarget = typeof content?.targetSite === "string" && content.targetSite.length > 0
      ? content.targetSite
      : "masterhacks.ru";
    const offerName = typeof content?.offerName === "string" && content.offerName.length > 0
      ? content.offerName
      : "полезные видео для дома и хозяйства на masterhacks.ru";

    // Генерируем пост через LLM
    const post = await this.thinkJson<{
      text: string;
      pinMessage: boolean;
      hasImage: boolean;
      imagePrompt: string;
    }>(
      `You are a Telegram Channel Content Manager.
Write the post in Russian.
Create an engaging post for a Telegram channel.

Rules:
- Use HTML formatting: <b>bold</b>, <i>italic</i>, <a href="url">link</a>, <code>code</code>
- Use emojis strategically (not too many)
- Short paragraphs (2-3 sentences max)
- End with a call-to-action or question
- Max 4096 characters
- No Markdown — only HTML tags
- The post should directly promote the target site or offer, not give generic creator advice
- masterhacks.ru is a site with useful videos for home, household tasks, DIY, repairs, and everyday practical problems
- Mention ${promotionTarget} or ${offerName} explicitly and make the next step obvious`,

      `Create a Telegram post about:
Title: ${content?.title || task.title}
Body: ${(content?.body || task.description).slice(0, 2000)}
Tone: professional but friendly
Target: ${content?.targetAudience || "tech-savvy audience"}
Promoted site: ${promotionTarget}
Promoted offer: ${offerName}

Make it promotional-first with a clear reason to click, watch, save, or subscribe now.

Respond in JSON: { text, pinMessage (bool), hasImage (bool), imagePrompt }`,
    );

    // Публикуем в канал
    const result = await tg.postToChannel(post.text, {
      parseMode: "HTML",
      pinMessage: post.pinMessage,
    });

    if (result.ok) {
      this.lastTelegramPostAt = Date.now();
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
      `You are a Telegram engagement specialist. Create an engaging poll in Russian.`,
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

    this.log.warn(`No real publisher configured for channel ${channel}. Skipping live publication for task: ${task.title}`);

    return {
      published: false,
      skipped: true,
      reason: "publisher_not_configured",
      platform: channel,
      title: task.title,
    };
  }
}
