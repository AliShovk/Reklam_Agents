/**
 * Reklam Agents — Entry Point
 * Экспортирует отсюда для совместимости
 */

export { AgentFarm } from "./farm.js";

// Запустить приложение если это main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const { AgentFarm } = await import("./farm.js");
  const farm = new AgentFarm();
  await farm.start();
}
