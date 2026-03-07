import { BaseAgent } from "../core/base-agent.js";
import type { Task } from "../core/types.js";

/**
 * SEO Agent — создает SEO-инфраструктуру.
 * 
 * Генерирует SEO-статьи, строит PBN (Private Blog Network),
 * создает перелинковку, оптимизирует мета-теги.
 * 
 * Важно: контент должен быть ПОЛЕЗНЫМ, а не дорвейным.
 * Каждый сайт имеет уникальный дизайн и микросервис.
 */
export class SeoAgent extends BaseAgent {
  constructor() {
    super({
      role: "seo",
      name: "SEO Agent",
      description: "SEO-ферма: статьи, PBN, перелинковка, оптимизация. Создает бесплатный органический трафик.",
      model: process.env.BULK_MODEL || "gpt-4o-mini",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "seo_optimize":
        return this.optimizeSeo(task);
      case "generate_articles":
        return this.generateSeoArticles(task);
      case "build_pbn":
        return this.buildPbn(task);
      case "interlink":
        return this.createInterlinking(task);
      default:
        return this.optimizeSeo(task);
    }
  }

  private async optimizeSeo(task: Task): Promise<Record<string, unknown>> {
    const keywords = (task.input.keywords as string[]) || [];
    const seoStrategy = task.input.seoStrategy as any;

    const plan = await this.thinkJson<{
      keywordClusters: Array<{
        primary: string;
        secondary: string[];
        searchVolume: string;
        difficulty: string;
        contentType: string;
      }>;
      siteStructure: Array<{
        page: string;
        targetKeyword: string;
        metaTitle: string;
        metaDescription: string;
        h1: string;
        internalLinks: string[];
      }>;
      technicalSeo: {
        robots: string;
        sitemap: string;
        schema: string;
        canonicals: string[];
      };
      linkBuildingPlan: Array<{
        source: string;
        anchor: string;
        strategy: string;
      }>;
      contentCalendar: Array<{
        week: number;
        topic: string;
        keyword: string;
        type: string;
      }>;
    }>(
      `You are an SEO Strategy Agent.
      
IMPORTANT: Google penalizes pure doorway pages. Every page must provide REAL value.

Strategy principles:
1. Create genuinely useful content that ranks naturally
2. Target long-tail keywords with low competition
3. Build topical authority with content clusters
4. Use programmatic SEO for scalable pages (but each must be unique and useful)
5. Schema markup for rich snippets
6. Internal linking for topical relevance signals

Anti-spam rules:
- No keyword stuffing
- No duplicate content across sites
- No link schemes
- Every page must pass the "would a human bookmark this?" test`,

      `Create SEO strategy for:
Topic: ${task.title}
Keywords: ${keywords.join(", ")}
Strategy context: ${JSON.stringify(seoStrategy || {})}
Description: ${task.description}

Respond in JSON with keys: keywordClusters, siteStructure, technicalSeo, linkBuildingPlan, contentCalendar`
    );

    // Create article generation tasks
    for (const cluster of plan.keywordClusters?.slice(0, 5) || []) {
      this.createSubTask({
        type: "generate_articles",
        priority: "medium",
        title: `SEO articles: ${cluster.primary}`,
        description: `Generate articles for keyword cluster: ${cluster.primary}, ${cluster.secondary.join(", ")}`,
        input: { keywords: [cluster.primary, ...cluster.secondary], count: 3 },
        assignedTo: "content",
      });
    }

    this.addKnowledge({
      type: "strategy",
      title: `SEO plan: ${task.title}`,
      content: JSON.stringify({
        clusters: plan.keywordClusters?.length || 0,
        pages: plan.siteStructure?.length || 0,
        calendar: plan.contentCalendar?.length || 0,
      }),
      tags: ["seo", "strategy", ...keywords.slice(0, 5)],
    });

    return { plan };
  }

  private async generateSeoArticles(task: Task): Promise<Record<string, unknown>> {
    const keywords = (task.input.keywords as string[]) || [];

    const articles = await this.thinkJson<{
      articles: Array<{
        title: string;
        slug: string;
        metaTitle: string;
        metaDescription: string;
        body: string;
        keywords: string[];
        schemaMarkup: string;
        faq: Array<{ question: string; answer: string }>;
      }>;
    }>(
      `You are an SEO Content Generator.
Generate articles that rank and provide real value.

Requirements:
- 1000+ words, well-structured
- H2/H3 headings with keywords
- Natural keyword density (1.5-2.5%)
- FAQ schema section (5+ questions)
- Meta title (50-60 chars) and description (150-160 chars)
- Engaging intro that hooks readers
- Practical examples and actionable advice
- Schema.org Article markup`,

      `Generate SEO articles for: ${keywords.join(", ")}
Context: ${task.description}

Respond in JSON with key: articles`
    );

    for (const article of articles.articles || []) {
      this.addKnowledge({
        type: "content",
        title: article.title,
        content: article.body.slice(0, 3000),
        tags: ["seo", "article", ...article.keywords.slice(0, 5)],
      });
    }

    return { articlesGenerated: articles.articles?.length || 0 };
  }

  private async buildPbn(task: Task): Promise<Record<string, unknown>> {
    const pbn = await this.thinkJson<{
      sites: Array<{
        domain: string;
        niche: string;
        design: string;
        microservice: string;
        contentTopics: string[];
        linkStrategy: string;
      }>;
      networkStructure: string;
      riskMitigation: string[];
    }>(
      `You are a PBN Architecture Agent.
Design a Private Blog Network where each site is a REAL, useful micro-site.

Key principle: Each PBN site must look and function like a legitimate niche site.
- Unique design/template per site
- Real useful microservice or tool on each
- Original content, not spun
- Different hosting providers
- Different WHOIS info
- Natural link profiles`,

      `Design PBN for: ${task.title}
Details: ${task.description}

Respond in JSON with keys: sites, networkStructure, riskMitigation`
    );

    this.addKnowledge({
      type: "strategy",
      title: `PBN plan: ${task.title}`,
      content: JSON.stringify(pbn),
      tags: ["pbn", "seo", "network"],
    });

    return { sitesPlanned: pbn.sites?.length || 0 };
  }

  private async createInterlinking(task: Task): Promise<Record<string, unknown>> {
    const existingContent = this.searchKnowledge("article", "content", 20);

    const linkMap = await this.thinkJson<{
      links: Array<{
        from: string;
        to: string;
        anchor: string;
        context: string;
      }>;
      siloPlan: Array<{
        pillar: string;
        clusters: string[];
        linkFlow: string;
      }>;
    }>(
      `You are an Internal Linking Agent.
Create a silo structure with strategic internal links.

Existing content:
${existingContent.map((c) => `- ${c.title} [tags: ${c.tags.join(", ")}]`).join("\n")}`,

      `Create an internal linking plan.
Respond in JSON with keys: links, siloPlan`
    );

    return { linksCreated: linkMap.links?.length || 0, silos: linkMap.siloPlan?.length || 0 };
  }
}
