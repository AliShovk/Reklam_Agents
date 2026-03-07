import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { AgentFarm } from "./farm.js";
import { createDashboard } from "./dashboard/server.js";
import { createSubLogger } from "./core/logger.js";

const log = createSubLogger("main");

async function main() {
  log.info("Initializing AI Agent Farm...");

  // Create farm
  const farm = new AgentFarm();

  // Start dashboard
  const dashboardPort = farm.getConfig().dashboard.port;
  const app = createDashboard(farm);

  app.listen(dashboardPort, () => {
    log.info(`Dashboard running at http://localhost:${dashboardPort}`);
  });

  // Start farm
  await farm.start();

  // Add default goal if none exists
  if (farm.getGoals().length === 0) {
    farm.addGoal({
      title: "Launch MVP growth engine",
      description: "Create initial products, content, and growth channels to start organic user acquisition",
      targetMetric: "products",
      targetValue: 5,
    });
  }

  // Graceful shutdown
  const shutdown = async () => {
    log.info("Shutting down...");
    await farm.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log.info("╔══════════════════════════════════════════════╗");
  log.info("║      AI Agent Farm is fully operational      ║");
  log.info(`║  Dashboard: http://localhost:${String(dashboardPort).padEnd(19)}║`);
  log.info("║  Press Ctrl+C to stop                        ║");
  log.info("╚══════════════════════════════════════════════╝");
}

main().catch((err) => {
  log.error(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});

export { AgentFarm } from "./farm.js";
export { createDashboard } from "./dashboard/server.js";
export * from "./core/index.js";
export * from "./agents/index.js";
