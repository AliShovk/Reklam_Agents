import { createLogger, format, transports } from "winston";

const { combine, timestamp, colorize, printf, errors } = format;

const logFormat = printf(({ level, message, timestamp, subsystem, agentId, ...meta }) => {
  const prefix = agentId ? `[${agentId}]` : subsystem ? `[${subsystem}]` : "";
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} ${level} ${prefix} ${message}${metaStr}`;
});

export const logger = createLogger({
  level: process.env.FARM_LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    colorize(),
    logFormat,
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: "logs/farm-error.log",
      level: "error",
      maxsize: 10_000_000,
      maxFiles: 5,
    }),
    new transports.File({
      filename: "logs/farm.log",
      maxsize: 50_000_000,
      maxFiles: 10,
    }),
  ],
});

export function createAgentLogger(agentId: string) {
  return logger.child({ agentId });
}

export function createSubLogger(subsystem: string) {
  return logger.child({ subsystem });
}
