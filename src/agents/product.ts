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
      pages: string[];
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

Keep the response compact:
- features: max 6 short items
- techStack: max 5 items
- pages: max 5 short page names only
- designNotes: under 500 characters

Respond in JSON with keys: name, type, features, techStack, pages, seoKeywords, monetization, estimatedDevTime, callToAction, designNotes`
    );

    const specName = typeof spec.name === "string" && spec.name.length > 0 ? spec.name : (productInput?.name || task.title);
    const specType = typeof spec.type === "string" && spec.type.length > 0 ? spec.type : (productInput?.type || "web_tool");
    const features = Array.isArray(spec.features) ? spec.features.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 6) : [];
    const techStack = Array.isArray(spec.techStack) ? spec.techStack.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5) : [];
    const pages = Array.isArray(spec.pages) ? spec.pages.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5) : [];
    const seoKeywords = Array.isArray(spec.seoKeywords) ? spec.seoKeywords.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 8) : [];
    const monetization = typeof spec.monetization === "string" && spec.monetization.length > 0 ? spec.monetization : "lead generation";
    const estimatedDevTime = typeof spec.estimatedDevTime === "string" && spec.estimatedDevTime.length > 0 ? spec.estimatedDevTime : "1-2 weeks";
    const callToAction = typeof spec.callToAction === "string" && spec.callToAction.length > 0 ? spec.callToAction : "Try the tool";
    const designNotes = typeof spec.designNotes === "string" && spec.designNotes.length > 0 ? spec.designNotes : (productInput?.description || task.description);

    const normalizedSpec = {
      ...spec,
      name: specName,
      type: specType,
      features,
      techStack,
      pages,
      seoKeywords,
      monetization,
      estimatedDevTime,
      callToAction,
      designNotes,
    };

    const product: ProductIdea = {
      id: uuid(),
      name: specName,
      type: (specType as ProductType) || "web_tool",
      description: designNotes,
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
      title: `Product spec: ${specName}`,
      content: JSON.stringify(normalizedSpec),
      tags: ["product", specType, ...seoKeywords.slice(0, 5)],
    });

    // Send to Programming Agent to build
    this.createSubTask({
      type: "write_code",
      priority: "high",
      title: `Build product: ${specName}`,
      description: `Build a ${specType} with features: ${features.join(", ") || "core MVP features"}`,
      input: { spec: normalizedSpec, productId: product.id },
      assignedTo: "programming",
    });

    // Send SEO keywords to SEO Agent
    this.createSubTask({
      type: "seo_optimize",
      priority: "medium",
      title: `SEO for product: ${specName}`,
      description: `Optimize for keywords: ${seoKeywords.join(", ") || specName}`,
      input: { productId: product.id, keywords: seoKeywords },
      assignedTo: "seo",
    });

    // Create content about the product
    this.createSubTask({
      type: "create_content",
      priority: "medium",
      title: `Content for product launch: ${specName}`,
      description: `Create launch content: article, social posts, tutorial. CTA: ${callToAction}`,
      input: { productId: product.id, spec: normalizedSpec },
      assignedTo: "content",
    });

    return { product, spec: normalizedSpec };
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

Generate 2-3 product ideas. Keep each item compact and concrete.
Respond in JSON with key: products`
    );

    const products = Array.isArray(ideas.products)
      ? ideas.products.filter((idea): idea is NonNullable<typeof ideas.products>[number] => Boolean(idea && typeof idea === "object"))
      : [];

    for (const idea of products) {
      const ideaName = typeof idea.name === "string" && idea.name.length > 0 ? idea.name : "Untitled product";
      const ideaDescription = typeof idea.description === "string" && idea.description.length > 0 ? idea.description : task.description;

      this.createSubTask({
        type: "create_product",
        priority: "medium",
        title: `Design product: ${ideaName}`,
        description: ideaDescription,
        input: { product: idea },
        assignedTo: "product",
      });
    }

    return { ideas: products.length };
  }
}
