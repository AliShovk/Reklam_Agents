import { BaseAgent } from "../../core/base-agent.js";
import { getTelegramClient } from "../../core/telegram-client.js";
import { eventBus } from "../../core/event-bus.js";
import type { Task } from "../../core/types.js";

/**
 * Engagement Agent — общается с людьми в сообществах.
 * 
 * Ключевой принцип: СНАЧАЛА помоги человеку решить проблему бесплатно.
 * Только если спросят "где?" — дай ссылку.
 * Эмуляция эмпатии и естественной коммуникации.
 * Поддерживает реальное взаимодействие в Telegram группе.
 */
export class EngagementAgent extends BaseAgent {
  private telegramHandlerRegistered = false;

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
      case "telegram_engage":
        return this.telegramEngage(task);
      default:
        return this.engageInCommunity(task);
    }
  }

  // ─── Telegram: реальное взаимодействие в группе ──────────────────────

  private async telegramEngage(task: Task): Promise<Record<string, unknown>> {
    const tg = getTelegramClient();
    if (!tg) {
      this.log.warn("Telegram client not available, generating templates only");
      return this.engageInCommunity(task);
    }

    // Регистрируем обработчик входящих сообщений (один раз)
    if (!this.telegramHandlerRegistered) {
      tg.onGroupMessage(async (msg) => {
        await this.handleIncomingGroupMessage(msg);
      });
      this.telegramHandlerRegistered = true;
      this.log.info("Telegram group message handler registered");
    }

    // Если задача содержит конкретное сообщение для ответа
    if (task.input.replyToMessageId && task.input.groupId) {
      const response = await this.generateGroupResponse(task);
      if (response.text) {
        const result = await tg.replyInGroup(
          task.input.replyToMessageId as number,
          response.text,
          "HTML"
        );
        return { replied: result.ok, messageId: result.messageId };
      }
    }

    // Иначе — генерируем стартовые сообщения
    const starters = await this.generateConversationStarters(task);
    for (const starter of starters.slice(0, 2)) {
      await tg.sendToGroup(starter.message, { parseMode: "HTML" });
      await new Promise((r) => setTimeout(r, 2000)); // задержка между сообщениями
    }

    return { started: true, starters: starters.length };
  }

  private async handleIncomingGroupMessage(msg: {
    chatId: number;
    messageId: number;
    text: string;
    fromUser: string;
    isGroup: boolean;
  }): Promise<void> {
    // Логируем входящее сообщение
    eventBus.emit({
      type: "telegram:group_message",
      groupId: msg.chatId.toString(),
      messageId: msg.messageId,
      text: msg.text,
    });

    // Анализируем, нужно ли отвечать
    const shouldReply = await this.shouldReplyToMessage(msg.text);
    if (!shouldReply) return;

    // Генерируем ответ
    const response = await this.generateReply(msg.text, msg.fromUser);
    if (!response.text) return;

    const tg = getTelegramClient();
    if (!tg) return;

    await tg.replyInGroup(msg.messageId, response.text, "HTML");
    this.log.info(`Replied to group message ${msg.messageId} from ${msg.fromUser}`);
  }

  private async shouldReplyToMessage(text: string): Promise<boolean> {
    const analysis = await this.thinkJson<{
      shouldReply: boolean;
      reason: string;
      urgency: "low" | "medium" | "high";
    }>(
      `You are an Engagement Agent deciding whether to reply to a Telegram group message.
Make all human-readable reasoning values Russian.
Rules:
- Reply if someone asks a question related to our topics (tech, tools, marketing, growth)
- Reply if someone expresses frustration or needs help
- Reply if someone mentions our product or similar tools
- Do NOT reply to off‑topic chit‑chat, memes, greetings
- Do NOT reply if someone else already answered adequately
- Do NOT spam — max 1 reply per thread`,
      `Message: "${text.slice(0, 500)}"
Should we reply? Respond in JSON: { shouldReply, reason, urgency }`,
    );
    return analysis.shouldReply && analysis.urgency !== "low";
  }

  private async generateReply(message: string, fromUser: string): Promise<{ text: string }> {
    return this.thinkJson<{ text: string }>(
      `You are a helpful community member in a Telegram group.
Reply in Russian.
Reply to the user's message genuinely and helpfully.

CRITICAL RULES:
1. Be friendly and personal ("Hey ${fromUser}, ...")
2. Provide value first — answer their question or offer help
3. Only mention our tools if relevant AND after providing value
4. Use HTML formatting: <b>bold</b>, <i>italic</i>, <code>code</code>
5. Keep it concise (2-3 sentences max)
6. End with a question to continue conversation
7. NEVER sound like a bot or advertisement`,
      `Reply to this message from ${fromUser}:
"${message.slice(0, 1000)}"

Generate a natural, helpful reply. Respond in JSON: { text }`,
    );
  }

  private async generateGroupResponse(task: Task): Promise<{ text: string }> {
    const context = task.input.context as string;
    const originalMessage = task.input.originalMessage as string;

    return this.thinkJson<{ text: string }>(
      `You are replying to a specific message in a Telegram group.
Reply in Russian.
Context: ${context}
Original message: "${originalMessage}"`,
      `Generate a helpful reply. Use HTML formatting. Respond in JSON: { text }`,
    );
  }

  private async generateConversationStarters(task: Task): Promise<Array<{ topic: string; message: string }>> {
    const community = task.input.community as any;

    const starters = await this.thinkJson<{
      starters: Array<{ topic: string; message: string }>;
    }>(
      `You are an Engagement Agent starting conversations in a Telegram group.
Write all conversation starters in Russian.
Create 3-5 conversation starters that are:
- Open-ended questions
- Related to ${community?.topic || "tech/marketing"}
- Encourage discussion
- Not promotional`,
      `Group topic: ${community?.topic || "general"}
Generate conversation starters. Respond in JSON: { starters }`,
    );

    return starters.starters || [];
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
Write all template responses, conversation starters, helpful answers, and guidelines in Russian.

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
