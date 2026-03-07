import { BaseAgent } from "../core/base-agent.js";
import type { Task, ProductIdea, ProductType } from "../core/types.js";
import { v4 as uuid } from "uuid";

/**
 * Product Agent — создает новые продукты-воронки.
 * 
 * Придумывает и проектирует продукты под реальный поисковый спрос:
 * калькуляторы, каталоги, генераторы, боты.
 * Каждый продукт становится воронкой бесплатного трафика.
 */
export class ProductAgent extends BaseAgent {
  private products: ProductIdea[] = [];

  constructor() {
    super({
      role: "product",
      name: "Product Agent",
      description: "Создает продукты-воронки под реальный поисковый спрос: калькуляторы, инструменты, боты.",
    });
  }

  getProducts(): ProductIdea[] {
    return [...this.products];
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "create_product":
        return this.designProduct(task);
      default:
        return this.ideateProducts(task);
    }
  }

  private async designProduct(task: Task): Promise<Record<string, unknown>> {
    const productInput = task.input.product as any;
    const existingProducts = this.searchKnowledge("product", "product", 10);

    const spec = await this.thinkJson<{
      name: string;
      type: string;
      features: string[];
      techStack: string[];
      pages: Array<{ name: string; description: string }>;
      seoKeywords: string[];
      monetization: string;
      estimatedDevTime: string;
      callToAction: string;
      designNotes: string;
    }>(
      `You are a Product Design Agent for an AI marketing farm.
Your job is to create detailed product specifications that serve as traffic funnels.

Key principle: The product must solve a REAL problem people are searching for.
It should be useful enough that people share it, but also funnel them to the main platform.

Existing products: ${existingProducts.map((p) => p.title).join(", ") || "none"}`,

      `Design this product:
Name: ${productInput?.name || task.title}
Type: ${productInput?.type || "web_tool"}
Description: ${productInput?.description || task.description}
Target audience: ${productInput?.targetAudience || "general"}
Search demand: ${productInput?.searchDemand || "unknown"}

Create a detailed spec. Respond in JSON with keys: name, type, features, techStack, pages, seoKeywords, monetization, estimatedDevTime, callToAction, designNotes`
    );

    const product: ProductIdea = {
      id: uuid(),
      name: spec.name,
      type: (spec.type as ProductType) || "web_tool",
      description: spec.designNotes,
      targetAudience: productInput?.targetAudience || "",
      searchDemand: productInput?.searchDemand || "",
      estimatedTraffic: 0,
      status: "approved",
      createdAt: new Date(),
    };
    this.products.push(product);

    // Save to knowledge base
    this.addKnowledge({
      type: "product",
      title: `Product spec: ${spec.name}`,
      content: JSON.stringify(spec),
      tags: ["product", spec.type, ...spec.seoKeywords.slice(0, 5)],
    });

    // Send to Programming Agent to build
    this.createSubTask({
      type: "write_code",
      priority: "high",
      title: `Build product: ${spec.name}`,
      description: `Build a ${spec.type} with features: ${spec.features.join(", ")}`,
      input: { spec, productId: product.id },
      assignedTo: "programming",
    });

    // Send SEO keywords to SEO Agent
    this.createSubTask({
      type: "seo_optimize",
      priority: "medium",
      title: `SEO for product: ${spec.name}`,
      description: `Optimize for keywords: ${spec.seoKeywords.join(", ")}`,
      input: { productId: product.id, keywords: spec.seoKeywords },
      assignedTo: "seo",
    });

    // Create content about the product
    this.createSubTask({
      type: "create_content",
      priority: "medium",
      title: `Content for product launch: ${spec.name}`,
      description: `Create launch content: article, social posts, tutorial. CTA: ${spec.callToAction}`,
      input: { productId: product.id, spec },
      assignedTo: "content",
    });

    return { product, spec };
  }

  private async ideateProducts(task: Task): Promise<Record<string, unknown>> {
    const ideas = await this.thinkJson<{
      products: Array<{
        name: string;
        type: string;
        description: string;
        targetAudience: string;
        searchDemand: string;
        estimatedTraffic: number;
      }>;
    }>(
      `You are a Product Ideation Agent. Generate product ideas that capture organic search traffic.
Focus on free tools that solve real problems people search for.`,
      `Context: ${task.description}
Input: ${JSON.stringify(task.input)}

Generate 3-5 product ideas. Each should target a specific search query.
Respond in JSON with key: products`
    );

    for (const idea of ideas.products || []) {
      this.createSubTask({
        type: "create_product",
        priority: "medium",
        title: `Design product: ${idea.name}`,
        description: idea.description,
        input: { product: idea },
        assignedTo: "product",
      });
    }

    return { ideas: ideas.products?.length || 0 };
  }
}
