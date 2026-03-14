import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { createSubLogger } from "./logger.js";

const log = createSubLogger("runtime-settings");

export interface RuntimeSettings {
  telegramMinPostIntervalMs: number;
  contentQueueSoftLimit: number;
  postingQueueSoftLimit: number;
  outreachQueueSoftLimit: number;
}

const defaultSettings: RuntimeSettings = {
  telegramMinPostIntervalMs: Math.max(5, Number.parseInt(process.env.TELEGRAM_MIN_POST_INTERVAL_MINUTES || "30", 10) || 30) * 60_000,
  contentQueueSoftLimit: Math.max(5, Number.parseInt(process.env.CONTENT_QUEUE_SOFT_LIMIT || "40", 10) || 40),
  postingQueueSoftLimit: Math.max(3, Number.parseInt(process.env.POSTING_QUEUE_SOFT_LIMIT || "20", 10) || 20),
  outreachQueueSoftLimit: Math.max(1, Number.parseInt(process.env.OUTREACH_QUEUE_SOFT_LIMIT || "10", 10) || 10),
};

const settingsFile = resolve(process.env.RUNTIME_SETTINGS_FILE || "data/runtime-settings.json");

class RuntimeSettingsStore {
  private settings: RuntimeSettings = { ...defaultSettings };
  private loaded = false;

  get(): RuntimeSettings {
    if (!this.loaded) this.load();
    return { ...this.settings };
  }

  update(patch: Partial<RuntimeSettings>): RuntimeSettings {
    if (!this.loaded) this.load();
    this.settings = {
      ...this.settings,
      ...patch,
    };
    this.persist();
    return this.get();
  }

  private load(): void {
    this.loaded = true;
    try {
      if (!existsSync(settingsFile)) {
        this.persist();
        return;
      }
      const raw = JSON.parse(readFileSync(settingsFile, "utf8")) as Partial<RuntimeSettings>;
      this.settings = {
        ...defaultSettings,
        ...raw,
      };
    } catch (err: any) {
      log.warn(`Failed to load runtime settings: ${err.message}`);
      this.settings = { ...defaultSettings };
      this.persist();
    }
  }

  private persist(): void {
    try {
      mkdirSync(dirname(settingsFile), { recursive: true });
      writeFileSync(settingsFile, JSON.stringify(this.settings, null, 2), "utf8");
    } catch (err: any) {
      log.error(`Failed to persist runtime settings: ${err.message}`);
    }
  }
}

export const runtimeSettings = new RuntimeSettingsStore();
