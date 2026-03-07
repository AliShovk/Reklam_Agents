import { config as dotenvConfig } from "dotenv";
import { FarmConfigSchema, type FarmConfig } from "./types.js";
import { createSubLogger } from "./logger.js";

const log = createSubLogger("config");

let _config: FarmConfig | null = null;

export function loadFarmConfig(): FarmConfig {
  if (_config) return _config;

  dotenvConfig();

  const raw = {
    name: process.env.FARM_NAME,
    maxConcurrentAgents: process.env.FARM_MAX_CONCURRENT_AGENTS
      ? parseInt(process.env.FARM_MAX_CONCURRENT_AGENTS, 10)
      : undefined,
    cycleIntervalMs: process.env.FARM_CYCLE_INTERVAL_MS
      ? parseInt(process.env.FARM_CYCLE_INTERVAL_MS, 10)
      : undefined,
    logLevel: process.env.FARM_LOG_LEVEL,
    models: {
      default: process.env.DEFAULT_MODEL,
      bulk: process.env.BULK_MODEL,
      strategy: process.env.STRATEGY_MODEL,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    chroma: {
      url: process.env.CHROMA_URL,
      collection: process.env.CHROMA_COLLECTION,
    },
    sandbox: {
      enabled: process.env.SANDBOX_ENABLED !== "false",
      timeoutMs: process.env.SANDBOX_TIMEOUT_MS
        ? parseInt(process.env.SANDBOX_TIMEOUT_MS, 10)
        : undefined,
      maxMemoryMb: process.env.SANDBOX_MAX_MEMORY_MB
        ? parseInt(process.env.SANDBOX_MAX_MEMORY_MB, 10)
        : undefined,
    },
    dashboard: {
      port: process.env.DASHBOARD_PORT
        ? parseInt(process.env.DASHBOARD_PORT, 10)
        : undefined,
      authToken: process.env.DASHBOARD_AUTH_TOKEN,
    },
  };

  const result = FarmConfigSchema.safeParse(raw);
  if (!result.success) {
    log.error(`Config validation failed: ${result.error.message}`);
    throw new Error(`Invalid farm config: ${result.error.message}`);
  }

  _config = result.data;
  log.info(`Farm config loaded: ${_config.name}`);
  return _config;
}

export function getConfig(): FarmConfig {
  if (!_config) return loadFarmConfig();
  return _config;
}
