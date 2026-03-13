import { BaseAgent } from "../core/base-agent.js";
import type { Task } from "../core/types.js";

interface DiscoveryItem {
  kind: string;
  name: string;
  description: string;
  url: string;
  source: string;
  freeTier: string;
  apiKeyRequired: boolean;
  usageNotes: string;
  tags: string[];
}

export class DiscoveryAgent extends BaseAgent {
  constructor() {
    super({
      role: "discovery",
      name: "Discovery Agent",
      description: "Ищет во внешнем интернете открытые API, библиотеки, SaaS, генераторы изображений, инструменты для кода и бесплатные сервисы.",
      model: process.env.RESEARCH_MODEL || process.env.STRATEGY_MODEL || "gpt-4o",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    if (task.type !== "discover_tools" && task.type !== "research") {
      return { skipped: true, reason: `Unsupported task type: ${task.type}` };
    }

    const rawQuery = this.getTaskQuery(task);
    const githubResults = await this.searchGithub(rawQuery);
    const npmResults = await this.searchNpm(rawQuery);
    const merged = [...githubResults, ...npmResults].slice(0, 12);

    const summary = await this.thinkJson<{
      overview: string;
      recommendations: Array<{
        name: string;
        reason: string;
        bestFor: string;
        caution: string;
      }>;
      integrationPlan: string[];
    }>(
      `You are a technical discovery agent.
Your job is to evaluate public developer tools, APIs, libraries, SDKs, open-source projects, image generation services, code tools, and related internet resources.

Rules:
- Respond in Russian.
- Prefer free, freemium, open-source, or no-cost entry options.
- Explicitly mention if an API key is required.
- Keep recommendations practical for integration into an AI agent farm.
- Do not invent capabilities not present in the source descriptions.
- Keep the response compact and operational.`,
      `Research query: ${rawQuery}
Task title: ${task.title}
Task description: ${task.description}

Collected candidates:
${JSON.stringify(merged)}

Respond in JSON with keys: overview, recommendations, integrationPlan`
    );

    return {
      query: rawQuery,
      findings: merged,
      summary,
      result: `${summary.overview}\nНайдено вариантов: ${merged.length}`,
    };
  }

  private getTaskQuery(task: Task): string {
    const inputQuery = typeof task.input.query === "string" ? task.input.query : "";
    const inputNeed = typeof task.input.need === "string" ? task.input.need : "";
    return inputQuery || inputNeed || task.description || task.title;
  }

  private async searchGithub(query: string): Promise<DiscoveryItem[]> {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=6`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "reklam-agents-discovery",
      },
    });
    if (!response.ok) {
      this.log.warn(`GitHub search failed: ${response.status}`);
      return [];
    }
    const data = await response.json() as { items?: Array<Record<string, any>> };
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((item) => ({
      kind: this.detectKind(`${item.name || ""} ${item.description || ""} ${query}`),
      name: String(item.full_name || item.name || "unknown"),
      description: String(item.description || "Без описания"),
      url: String(item.html_url || ""),
      source: "github",
      freeTier: item.private ? "unknown" : "open-source",
      apiKeyRequired: false,
      usageNotes: `⭐ ${Number(item.stargazers_count || 0)} stars, язык: ${String(item.language || "unknown")}`,
      tags: [String(item.language || "").toLowerCase(), "github", "opensource", this.detectKind(`${item.name || ""} ${item.description || ""}`)].filter(Boolean),
    }));
  }

  private async searchNpm(query: string): Promise<DiscoveryItem[]> {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=6`;
    const response = await fetch(url, {
      headers: { "User-Agent": "reklam-agents-discovery" },
    });
    if (!response.ok) {
      this.log.warn(`npm search failed: ${response.status}`);
      return [];
    }
    const data = await response.json() as { objects?: Array<{ package?: Record<string, any> }> };
    const objects = Array.isArray(data.objects) ? data.objects : [];
    return objects.map((entry) => {
      const pkg = entry.package || {};
      return {
        kind: this.detectKind(`${pkg.name || ""} ${pkg.description || ""} ${query}`),
        name: String(pkg.name || "unknown"),
        description: String(pkg.description || "Без описания"),
        url: String(pkg.links?.npm || pkg.links?.homepage || ""),
        source: "npm",
        freeTier: "free package",
        apiKeyRequired: false,
        usageNotes: `Версия: ${String(pkg.version || "unknown")}`,
        tags: ["npm", this.detectKind(`${pkg.name || ""} ${pkg.description || ""}`)].filter(Boolean),
      } as DiscoveryItem;
    });
  }

  private detectKind(text: string): string {
    const value = text.toLowerCase();
    if (value.includes("image") || value.includes("diffusion") || value.includes("photo") || value.includes("png") || value.includes("svg")) return "image_tool";
    if (value.includes("api") || value.includes("rest") || value.includes("sdk")) return "api_or_sdk";
    if (value.includes("code") || value.includes("typescript") || value.includes("javascript") || value.includes("python") || value.includes("library")) return "code_library";
    if (value.includes("bot") || value.includes("agent")) return "automation_tool";
    return "tool";
  }
}
