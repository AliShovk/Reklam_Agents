import { createSubLogger } from "./logger.js";

const log = createSubLogger("gigachat");

interface GigaChatTokenResponse {
  access_token: string;
  expires_at: number;
}

/**
 * GigaChatClient — управляет доступом к GigaChat API.
 * 
 * GigaChat требует получения Access Token каждые 30 минут.
 * Этот класс обновляет токен автоматически.
 */
export class GigaChatClient {
  private authKey: string;
  private token: string | null = null;
  private tokenExpiresAt: number = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private baseURL = "https://gigachat.devices.sberbank.ru";

  constructor(authKey: string) {
    if (!authKey) {
      throw new Error("GigaChat: GIGACHAT_AUTH_KEY is required");
    }
    this.authKey = authKey;
  }

  async initialize(): Promise<void> {
    await this.refreshAccessToken();
    // Обновляем токен каждые 25 минут (действует 30 минут)
    this.refreshTimer = setInterval(() => {
      this.refreshAccessToken().catch((err) => {
        log.error(`Failed to refresh GigaChat token: ${err.message}`);
      });
    }, 25 * 60 * 1000);
  }

  async shutdown(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/api/v2/oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          RqUID: this.generateUUID(),
          Authorization: `Basic ${this.authKey}`,
        },
        body: "scope=GIGACHAT_API_PERS",
      });

      if (!response.ok) {
        throw new Error(`GigaChat OAuth error: ${response.status} ${response.statusText}`);
      }

      const data: GigaChatTokenResponse = await response.json();
      this.token = data.access_token;
      this.tokenExpiresAt = data.expires_at;

      log.info(`GigaChat token refreshed. Expires at: ${new Date(this.tokenExpiresAt).toISOString()}`);
    } catch (error: any) {
      log.error(`Failed to get GigaChat access token: ${error.message}`);
      throw error;
    }
  }

  getAccessToken(): string {
    if (!this.token || Date.now() > this.tokenExpiresAt - 60000) {
      throw new Error("GigaChat token not available. Call initialize() first.");
    }
    return this.token;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

let _gigachatInstance: GigaChatClient | null = null;

export async function initGigaChat(): Promise<GigaChatClient | null> {
  const authKey = process.env.GIGACHAT_AUTH_KEY;
  if (!authKey) return null;

  if (_gigachatInstance) return _gigachatInstance;

  try {
    _gigachatInstance = new GigaChatClient(authKey);
    await _gigachatInstance.initialize();
    return _gigachatInstance;
  } catch (error: any) {
    log.error(`GigaChat initialization failed: ${error.message}`);
    _gigachatInstance = null;
    return null;
  }
}

export function getGigaChatClient(): GigaChatClient | null {
  return _gigachatInstance;
}
