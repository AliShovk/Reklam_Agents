import { Telegraf, type Context } from "telegraf";
import { createSubLogger } from "./logger.js";

const log = createSubLogger("telegram");

/**
 * TelegramClient — управляет Telegram ботом, каналом и группой.
 *
 * Возможности:
 * - Публикация постов в канал
 * - Отправка сообщений в группу
 * - Ответ на сообщения в группе (engagement)
 * - Получение статистики постов
 * - Управление пинами, опросами
 */
export class TelegramClient {
  private bot: Telegraf;
  private channelId: string | null;
  private groupId: string | null;
  private running = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is required");
    }

    this.bot = new Telegraf(token);
    this.channelId = process.env.TELEGRAM_CHANNEL_ID || null;
    this.groupId = process.env.TELEGRAM_GROUP_ID || null;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;

    // Регистрируем обработчики
    this.registerHandlers();

    // Запускаем бота в фоне (long polling)
    const launchPromise = this.bot.launch({ allowedUpdates: ["message"] });
    launchPromise.catch((err: any) => {
      log.error(`Telegram bot launch error: ${err.message}`);
    });

    const launchCompleted = await this.withTimeout(
      launchPromise.then(() => true),
      5000,
      "bot launch confirmation timed out"
    );

    if (launchCompleted) {
      log.info("Telegram bot launch confirmed");
    } else {
      log.warn("Telegram bot launch confirmation did not complete in time; continuing startup while polling initializes in background");
    }

    this.running = true;
    log.info("Telegram bot started");

    if (this.channelId) log.info(`Channel: ${this.channelId}`);
    if (this.groupId) log.info(`Group: ${this.groupId}`);

    void this.verifyChatAccess();
  }

  private async verifyChatAccess(): Promise<void> {
    const [channelInfo, groupInfo] = await Promise.all([
      this.withTimeout(this.getChannelInfo(), 8000, "channel access check timed out"),
      this.withTimeout(this.getGroupInfo(), 8000, "group access check timed out"),
    ]);

    if (this.channelId) {
      if (channelInfo) {
        log.info(`Channel access confirmed: ${String(channelInfo.title || channelInfo.id)} (${String(channelInfo.type)})`);
      } else {
        log.error(`Channel access check failed for ${this.channelId}. Verify TELEGRAM_CHANNEL_ID and ensure the bot is added to the channel with admin rights.`);
      }
    }

    if (this.groupId) {
      if (groupInfo) {
        log.info(`Group access confirmed: ${String(groupInfo.title || groupInfo.id)} (${String(groupInfo.type)})`);
      } else {
        log.error(`Group access check failed for ${this.groupId}. Verify TELEGRAM_GROUP_ID and ensure the bot is added to the group.`);
      }
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T | null> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race<T | null>([
        promise,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => {
            log.warn(`Telegram ${timeoutLabel}`);
            resolve(null);
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.bot.stop("shutdown");
    this.running = false;
    log.info("Telegram bot stopped");
  }

  get isRunning(): boolean {
    return this.running;
  }

  // ─── Канал: публикация ──────────────────────────────────────────────

  /** Отправить текстовый пост в канал */
  async postToChannel(text: string, options?: {
    parseMode?: "HTML" | "MarkdownV2" | "Markdown";
    disablePreview?: boolean;
    pinMessage?: boolean;
  }): Promise<{ messageId: number; ok: boolean }> {
    if (!this.channelId) {
      log.warn("TELEGRAM_CHANNEL_ID not set, skipping channel post");
      return { messageId: 0, ok: false };
    }

    try {
      const msg = await this.bot.telegram.sendMessage(this.channelId, text, {
        parse_mode: options?.parseMode || "HTML",
        link_preview_options: options?.disablePreview ? { is_disabled: true } : undefined,
      });

      if (options?.pinMessage) {
        await this.bot.telegram.pinChatMessage(this.channelId, msg.message_id).catch(() => {});
      }

      log.info(`Posted to channel: msg_id=${msg.message_id}`);
      return { messageId: msg.message_id, ok: true };
    } catch (err: any) {
      log.error(`Channel post failed: ${err.message}`);
      return { messageId: 0, ok: false };
    }
  }

  /** Отправить фото с подписью в канал */
  async postPhotoToChannel(photoUrl: string, caption: string, options?: {
    parseMode?: "HTML" | "MarkdownV2" | "Markdown";
  }): Promise<{ messageId: number; ok: boolean }> {
    if (!this.channelId) {
      log.warn("TELEGRAM_CHANNEL_ID not set, skipping photo post");
      return { messageId: 0, ok: false };
    }

    try {
      const msg = await this.bot.telegram.sendPhoto(this.channelId, photoUrl, {
        caption,
        parse_mode: options?.parseMode || "HTML",
      });
      log.info(`Photo posted to channel: msg_id=${msg.message_id}`);
      return { messageId: msg.message_id, ok: true };
    } catch (err: any) {
      log.error(`Channel photo post failed: ${err.message}`);
      return { messageId: 0, ok: false };
    }
  }

  /** Создать опрос в канале */
  async postPollToChannel(question: string, pollOptions: string[], options?: {
    isAnonymous?: boolean;
    allowsMultipleAnswers?: boolean;
  }): Promise<{ messageId: number; ok: boolean }> {
    if (!this.channelId) {
      return { messageId: 0, ok: false };
    }

    try {
      const msg = await this.bot.telegram.sendPoll(this.channelId, question, pollOptions, {
        is_anonymous: options?.isAnonymous ?? true,
        allows_multiple_answers: options?.allowsMultipleAnswers ?? false,
      });
      log.info(`Poll posted to channel: msg_id=${msg.message_id}`);
      return { messageId: msg.message_id, ok: true };
    } catch (err: any) {
      log.error(`Channel poll failed: ${err.message}`);
      return { messageId: 0, ok: false };
    }
  }

  // ─── Группа: сообщения и engagement ─────────────────────────────────

  /** Отправить сообщение в группу */
  async sendToGroup(text: string, options?: {
    parseMode?: "HTML" | "MarkdownV2" | "Markdown";
    replyToMessageId?: number;
  }): Promise<{ messageId: number; ok: boolean }> {
    if (!this.groupId) {
      log.warn("TELEGRAM_GROUP_ID not set, skipping group message");
      return { messageId: 0, ok: false };
    }

    try {
      const msg = await this.bot.telegram.sendMessage(this.groupId, text, {
        parse_mode: options?.parseMode || "HTML",
        reply_parameters: options?.replyToMessageId
          ? { message_id: options.replyToMessageId }
          : undefined,
      });
      log.info(`Sent to group: msg_id=${msg.message_id}`);
      return { messageId: msg.message_id, ok: true };
    } catch (err: any) {
      log.error(`Group message failed: ${err.message}`);
      return { messageId: 0, ok: false };
    }
  }

  /** Ответить на сообщение в группе */
  async replyInGroup(replyToMessageId: number, text: string, parseMode?: "HTML" | "MarkdownV2" | "Markdown"): Promise<{ messageId: number; ok: boolean }> {
    return this.sendToGroup(text, { replyToMessageId, parseMode });
  }

  // ─── Утилиты ────────────────────────────────────────────────────────

  /** Получить информацию о канале */
  async getChannelInfo(): Promise<Record<string, unknown> | null> {
    if (!this.channelId) return null;
    try {
      const chat = await this.bot.telegram.getChat(this.channelId);
      const count = await this.bot.telegram.getChatMembersCount(this.channelId);
      return {
        id: chat.id,
        title: "title" in chat ? chat.title : "",
        type: chat.type,
        memberCount: count,
      };
    } catch (err: any) {
      log.error(`getChannelInfo failed: ${err.message}`);
      return null;
    }
  }

  /** Получить информацию о группе */
  async getGroupInfo(): Promise<Record<string, unknown> | null> {
    if (!this.groupId) return null;
    try {
      const chat = await this.bot.telegram.getChat(this.groupId);
      const count = await this.bot.telegram.getChatMembersCount(this.groupId);
      return {
        id: chat.id,
        title: "title" in chat ? chat.title : "",
        type: chat.type,
        memberCount: count,
      };
    } catch (err: any) {
      log.error(`getGroupInfo failed: ${err.message}`);
      return null;
    }
  }

  /** Удалить сообщение */
  async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    try {
      await this.bot.telegram.deleteMessage(chatId, messageId);
      return true;
    } catch {
      return false;
    }
  }

  /** Редактировать сообщение */
  async editMessage(chatId: string | number, messageId: number, newText: string, parseMode?: "HTML" | "MarkdownV2" | "Markdown"): Promise<boolean> {
    try {
      await this.bot.telegram.editMessageText(chatId, messageId, undefined, newText, {
        parse_mode: parseMode || "HTML",
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Обработчики входящих сообщений ─────────────────────────────────

  /** Регистрация callback для входящих сообщений группы */
  private messageHandlers: Array<(msg: {
    chatId: number;
    messageId: number;
    text: string;
    fromUser: string;
    isGroup: boolean;
  }) => void | Promise<void>> = [];

  onGroupMessage(handler: typeof this.messageHandlers[0]): void {
    this.messageHandlers.push(handler);
  }

  private registerHandlers(): void {
    this.bot.catch((err: any, ctx: Context) => {
      const chatId = ctx.chat?.id ? String(ctx.chat.id) : "unknown";
      log.error(`Telegram update handler error in chat ${chatId}: ${err.message}`);
    });

    this.bot.on("text", async (ctx: Context, next) => {
      const chat = ctx.chat;
      const message = ctx.message;
      if (chat && message && "text" in message && typeof message.text === "string") {
        log.info(`Incoming Telegram text: chat=${chat.id} type=${chat.type} from=${message.from?.username || message.from?.first_name || "unknown"} text=${message.text.slice(0, 120)}`);
      }
      return next();
    });

    // Обработка текстовых сообщений в группе
    this.bot.on("text", async (ctx: Context) => {
      const chat = ctx.chat;
      if (!chat) return;
      const isGroup = chat.type === "group" || chat.type === "supergroup";

      if (!isGroup) return;

      const message = ctx.message;
      if (!message) return;
      if (!("text" in message) || typeof message.text !== "string") return;

      const msg = {
        chatId: chat.id,
        messageId: ctx.message.message_id,
        text: message.text,
        fromUser: message.from?.username || message.from?.first_name || "unknown",
        isGroup: true,
      };

      for (const handler of this.messageHandlers) {
        try {
          await handler(msg);
        } catch (err: any) {
          log.error(`Message handler error: ${err.message}`);
        }
      }
    });

    // Обработка команды /start
    this.bot.command("start", (ctx: Context) => {
      ctx.reply("🤖 Reklam Agent Bot активен. Я помогаю управлять каналом и группой.");
    });

    // Обработка команды /status
    this.bot.command("status", (ctx: Context) => {
      ctx.reply(`✅ Бот работает\n📢 Канал: ${this.channelId || "не задан"}\n👥 Группа: ${this.groupId || "не задана"}`);
    });

    // Graceful stop
    process.once("SIGINT", () => this.bot.stop("SIGINT"));
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
  }

  /** Прямой доступ к Telegraf инстансу (для расширенных сценариев) */
  getBotInstance(): Telegraf {
    return this.bot;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

let _telegramClient: TelegramClient | null = null;

export function initTelegram(): TelegramClient | null {
  if (_telegramClient) return _telegramClient;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    log.info("TELEGRAM_BOT_TOKEN not set — Telegram disabled");
    return null;
  }

  try {
    _telegramClient = new TelegramClient();
    log.info("Telegram client created");
    return _telegramClient;
  } catch (err: any) {
    log.error(`Telegram init failed: ${err.message}`);
    return null;
  }
}

export function getTelegramClient(): TelegramClient | null {
  return _telegramClient;
}
