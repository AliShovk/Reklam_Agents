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
        priority: number;
        tactics: string[];
        estimatedReach: number;
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

      `Create a detailed growth strategy. Focus on:
1. Which channels to prioritize and why
2. What products to create to capture organic traffic
3. Content plan for each channel

The key insight: create products that match existing search demand (e.g. "renovation calculator"), 
so each product becomes a traffic funnel with near-zero acquisition cost.

Respond in JSON with keys: channels, productIdeas, contentPlan, reasoning`
    );

    const channels = Array.isArray(strategy.channels)
      ? strategy.channels.filter((item): item is NonNullable<typeof strategy.channels>[number] => Boolean(item && typeof item === "object"))
      : [];
    const productIdeas = Array.isArray(strategy.productIdeas)
      ? strategy.productIdeas.filter((item): item is NonNullable<typeof strategy.productIdeas>[number] => Boolean(item && typeof item === "object"))
      : [];
    const contentPlan = Array.isArray(strategy.contentPlan)
      ? strategy.contentPlan.filter((item): item is NonNullable<typeof strategy.contentPlan>[number] => Boolean(item && typeof item === "object"))
      : [];

    // Save strategy to knowledge base
    this.addKnowledge({
      type: "strategy",
      title: `Strategy: ${task.title}`,
      content: strategy.reasoning,
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
        description: `Channel: ${contentChannel}. Frequency: ${contentFrequency}`,
        input: { content },
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

    return { strategy };
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

Provide: findings, opportunities, threats, recommendations.
Respond in JSON.`
    );

    this.addKnowledge({
      type: "research",
      title: `Research: ${task.title}`,
      content: JSON.stringify(research),
      tags: ["research"],
    });

    return { research };
  }

  private async generalAnalysis(task: Task): Promise<Record<string, unknown>> {
    const result = await this.think(
      "You are a Strategy Agent. Analyze the given task and provide actionable insights.",
      `Task: ${task.title}\nDescription: ${task.description}\nInput: ${JSON.stringify(task.input)}`
    );
    return { analysis: result };
  }
}
