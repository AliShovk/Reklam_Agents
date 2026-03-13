import { BaseAgent } from "../core/base-agent.js";
import type { Task, ChannelStrategy, GrowthChannel } from "../core/types.js";

/**
 * Strategy Agent — строит маркетинговую стратегию.
 * 
 * Анализирует цели, выбирает каналы, определяет приоритеты,
 * решает куда направлять усилия: Telegram, SEO, Reddit, YouTube и т.д.
 */
export class StrategyAgent extends BaseAgent {
  constructor() {
    super({
      role: "strategy",
      name: "Strategy Agent",
      description: "Строит маркетинговые стратегии, выбирает каналы роста, определяет приоритеты.",
      model: process.env.STRATEGY_MODEL || "gpt-4o",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "create_strategy":
        return this.createStrategy(task);
      case "research":
        return this.research(task);
      default:
        return this.generalAnalysis(task);
    }
  }

  private async createStrategy(task: Task): Promise<Record<string, unknown>> {
    const existingProducts = this.searchKnowledge("products launched", "product", 10);
    const existingContent = this.searchKnowledge("content published", "content", 10);
    const pastStrategies = this.searchKnowledge("strategy", "strategy", 5);

    const strategy = await this.thinkJson<{
      channels: Array<{
        channel: string;
        priority: string | number;
        tactics: string[];
        reasoning?: string;
      }>;
      productIdeas: Array<{
        name: string;
        type: string;
        description: string;
        targetAudience: string;
        searchDemand: string;
      }>;
      contentPlan: Array<{
        type: string;
        topic: string;
        channel: string;
        frequency: string;
      }>;
      reasoning: string;
    }>(
      `You are a Growth Strategy Agent for an AI-powered marketing farm.
Your job is to create a comprehensive growth strategy.

Context:
- Goal: ${task.description}
- Existing products: ${existingProducts.map((p) => p.title).join(", ") || "none yet"}
- Existing content: ${existingContent.length} pieces
- Past strategies: ${pastStrategies.map((s) => s.title).join(", ") || "none"}

Available growth channels: telegram, discord, reddit, youtube, tiktok, medium, twitter, linkedin, seo, email, forums, communities

Available product types: calculator, landing_page, telegram_bot, web_tool, api_service, catalog, generator, comparison_tool, checker, aggregator`,

      `Create a very compact growth strategy. Focus on:
1. Which channels to prioritize and why
2. What products to create to capture organic traffic
3. Content plan for each channel

The key insight: create products that match existing search demand (e.g. "renovation calculator"), 
so each product becomes a traffic funnel with near-zero acquisition cost.

Prioritize direct promotion of the active goal, target site, and concrete offers over generic educational content.
Every content idea should help drive visits, signups, or usage, not just engagement.
For masterhacks.ru, content topics must stay in the domain of home, household tasks, repairs, DIY, practical everyday fixes, and useful video guides.
Do not suggest topics about content creation, social media publishing, creator workflows, marketing tactics, or promotion tools.

Keep the response compact:
- channels: max 4 items
- tactics: max 3 short items per channel
- productIdeas: max 2 items
- contentPlan: max 3 items
- reasoning: under 400 characters

Respond in JSON with keys: channels, productIdeas, contentPlan, reasoning`
    );

    const channels = Array.isArray(strategy.channels)
      ? strategy.channels
          .filter((item): item is NonNullable<typeof strategy.channels>[number] => Boolean(item && typeof item === "object"))
          .map((item) => ({
            channel: typeof item.channel === "string" && item.channel.length > 0 ? item.channel : "general",
            priority: typeof item.priority === "string"
              ? item.priority
              : typeof item.priority === "number"
                ? String(item.priority)
                : "medium",
            tactics: Array.isArray(item.tactics)
              ? item.tactics.filter((tactic): tactic is string => typeof tactic === "string" && tactic.length > 0).slice(0, 3)
              : [],
          }))
          .slice(0, 4)
      : [];
    const productIdeas = Array.isArray(strategy.productIdeas)
      ? strategy.productIdeas
          .filter((item): item is NonNullable<typeof strategy.productIdeas>[number] => Boolean(item && typeof item === "object"))
          .map((item) => ({
            name: typeof item.name === "string" && item.name.length > 0 ? item.name : "Untitled product",
            type: typeof item.type === "string" && item.type.length > 0 ? item.type : "web_tool",
            description: typeof item.description === "string" && item.description.length > 0 ? item.description : task.description,
            targetAudience: typeof item.targetAudience === "string" && item.targetAudience.length > 0 ? item.targetAudience : "general audience",
            searchDemand: typeof item.searchDemand === "string" && item.searchDemand.length > 0 ? item.searchDemand : task.title,
          }))
          .slice(0, 2)
      : [];
    const contentPlan = Array.isArray(strategy.contentPlan)
      ? strategy.contentPlan
          .filter((item): item is NonNullable<typeof strategy.contentPlan>[number] => Boolean(item && typeof item === "object"))
          .map((item) => ({
            type: typeof item.type === "string" && item.type.length > 0 ? item.type : "post",
            topic: typeof item.topic === "string" && item.topic.length > 0 ? item.topic : task.title,
            channel: typeof item.channel === "string" && item.channel.length > 0 ? item.channel : "general",
            frequency: typeof item.frequency === "string" && item.frequency.length > 0 ? item.frequency : "weekly",
          }))
          .slice(0, 3)
      : [];
    const reasoning = typeof strategy.reasoning === "string" && strategy.reasoning.length > 0 ? strategy.reasoning : task.description;

    // Save strategy to knowledge base
    this.addKnowledge({
      type: "strategy",
      title: `Strategy: ${task.title}`,
      content: reasoning,
      tags: ["strategy", ...channels.map((c) => c.channel).filter((channel): channel is string => typeof channel === "string" && channel.length > 0)],
    });

    // Create tasks for Product Agents
    for (const product of productIdeas) {
      const productName = typeof product.name === "string" && product.name.length > 0 ? product.name : "Untitled product";
      const productDescription = typeof product.description === "string" && product.description.length > 0 ? product.description : task.description;
      const targetAudience = typeof product.targetAudience === "string" && product.targetAudience.length > 0 ? product.targetAudience : "general audience";
      const searchDemand = typeof product.searchDemand === "string" && product.searchDemand.length > 0 ? product.searchDemand : "unknown";

      this.createSubTask({
        type: "create_product",
        priority: "high",
        title: `Create product: ${productName}`,
        description: `${productDescription}. Target: ${targetAudience}. Search demand: ${searchDemand}`,
        input: { product },
        assignedTo: "product",
      });
    }

    // Create tasks for Content Agents
    for (const content of contentPlan) {
      const contentType = typeof content.type === "string" && content.type.length > 0 ? content.type : "content";
      const contentTopic = typeof content.topic === "string" && content.topic.length > 0 ? content.topic : task.title;
      const contentChannel = typeof content.channel === "string" && content.channel.length > 0 ? content.channel : "general";
      const contentFrequency = typeof content.frequency === "string" && content.frequency.length > 0 ? content.frequency : "as needed";

      this.createSubTask({
        type: "create_content",
        priority: "medium",
        title: `Create ${contentType}: ${contentTopic}`,
        description: `Channel: ${contentChannel}. Frequency: ${contentFrequency}. Make it directly promote masterhacks.ru as a source of useful videos for home and household needs with a clear CTA.`,
        input: { content: { ...content, targetSite: "masterhacks.ru", offerName: "полезные видео для дома и хозяйства на masterhacks.ru" }, targetSite: "masterhacks.ru" },
        assignedTo: "content",
      });
    }

    // Create SEO tasks if SEO is in channels
    const seoChannel = channels.find((c) => c.channel === "seo");
    if (seoChannel) {
      const seoTactics = Array.isArray(seoChannel.tactics) ? seoChannel.tactics.filter((tactic): tactic is string => typeof tactic === "string" && tactic.length > 0) : [];

      this.createSubTask({
        type: "seo_optimize",
        priority: "high",
        title: "Launch SEO campaign",
        description: `SEO tactics: ${seoTactics.join(", ") || "Define SEO tactics"}`,
        input: { seoStrategy: seoChannel },
        assignedTo: "seo",
      });
    }

    return { strategy: { channels, productIdeas, contentPlan, reasoning } };
  }

  private async research(task: Task): Promise<Record<string, unknown>> {
    const research = await this.thinkJson<{
      findings: string[];
      opportunities: string[];
      threats: string[];
      recommendations: string[];
    }>(
      `You are a Market Research Agent. Analyze the given topic and provide insights.`,
      `Research topic: ${task.title}
Details: ${task.description}
Input: ${JSON.stringify(task.input)}

Keep each list compact with max 5 short items.
Provide: findings, opportunities, threats, recommendations.
Respond in JSON.`
    );

    const normalizedResearch = {
      findings: Array.isArray(research.findings) ? research.findings.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5) : [],
      opportunities: Array.isArray(research.opportunities) ? research.opportunities.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5) : [],
      threats: Array.isArray(research.threats) ? research.threats.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5) : [],
      recommendations: Array.isArray(research.recommendations) ? research.recommendations.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5) : [],
    };

    this.addKnowledge({
      type: "research",
      title: `Research: ${task.title}`,
      content: JSON.stringify(normalizedResearch),
      tags: ["research"],
    });

    return { research: normalizedResearch };
  }

  private async generalAnalysis(task: Task): Promise<Record<string, unknown>> {
    const result = await this.think(
      "You are a Strategy Agent. Analyze the given task and provide actionable insights.",
      `Task: ${task.title}\nDescription: ${task.description}\nInput: ${JSON.stringify(task.input)}`
    );
    return { analysis: result };
  }
}
