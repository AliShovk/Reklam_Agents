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
        intent: string;
        primaryKeyword?: string;
        secondaryKeywords?: string[];
      }>;
      siteStructure: Array<{
        page: string;
        targetKeyword: string;
        pageType: string;
      }>;
      technicalSeo: {
        priorities: string[];
        schema: string;
      };
      linkBuildingPlan: Array<{
        source: string;
        anchor: string;
        tactic: string;
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

Keep the response compact:
- keywordClusters: max 3 items
- each cluster.secondary: max 3 items
- siteStructure: max 4 pages
- technicalSeo: short priorities only
- linkBuildingPlan: max 3 items
- contentCalendar: max 3 weeks

Respond in JSON with keys: keywordClusters, siteStructure, technicalSeo, linkBuildingPlan, contentCalendar`
    );

    const keywordClusters = Array.isArray(plan.keywordClusters)
      ? plan.keywordClusters
          .filter((cluster): cluster is NonNullable<typeof plan.keywordClusters>[number] => Boolean(cluster && typeof cluster === "object"))
          .map((cluster) => ({
            primary: typeof cluster.primary === "string" && cluster.primary.length > 0
              ? cluster.primary
              : typeof cluster.primaryKeyword === "string" && cluster.primaryKeyword.length > 0
                ? cluster.primaryKeyword
                : task.title,
            secondary: Array.isArray(cluster.secondary)
              ? cluster.secondary.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 3)
              : Array.isArray(cluster.secondaryKeywords)
                ? cluster.secondaryKeywords.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 3)
                : [],
            intent: typeof cluster.intent === "string" && cluster.intent.length > 0 ? cluster.intent : "informational",
          }))
          .slice(0, 3)
      : [];
    const siteStructure = Array.isArray(plan.siteStructure)
      ? plan.siteStructure
          .filter((page): page is NonNullable<typeof plan.siteStructure>[number] => Boolean(page && typeof page === "object"))
          .map((page) => ({
            page: typeof page.page === "string" && page.page.length > 0 ? page.page : "landing-page",
            targetKeyword: typeof page.targetKeyword === "string" && page.targetKeyword.length > 0 ? page.targetKeyword : task.title,
            pageType: typeof page.pageType === "string" && page.pageType.length > 0 ? page.pageType : "article",
          }))
          .slice(0, 4)
      : [];
    const technicalSeo = {
      priorities: Array.isArray(plan.technicalSeo?.priorities)
        ? plan.technicalSeo.priorities.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5)
        : [],
      schema: typeof plan.technicalSeo?.schema === "string" && plan.technicalSeo.schema.length > 0
        ? plan.technicalSeo.schema
        : "Article",
    };
    const linkBuildingPlan = Array.isArray(plan.linkBuildingPlan)
      ? plan.linkBuildingPlan
          .filter((item): item is NonNullable<typeof plan.linkBuildingPlan>[number] => Boolean(item && typeof item === "object"))
          .map((item) => ({
            source: typeof item.source === "string" && item.source.length > 0 ? item.source : "guest post",
            anchor: typeof item.anchor === "string" && item.anchor.length > 0 ? item.anchor : task.title,
            tactic: typeof item.tactic === "string" && item.tactic.length > 0 ? item.tactic : "manual outreach",
          }))
          .slice(0, 3)
      : [];
    const contentCalendar = Array.isArray(plan.contentCalendar)
      ? plan.contentCalendar
          .filter((item): item is NonNullable<typeof plan.contentCalendar>[number] => Boolean(item && typeof item === "object"))
          .map((item, index) => ({
            week: typeof item.week === "number" ? item.week : index + 1,
            topic: typeof item.topic === "string" && item.topic.length > 0 ? item.topic : task.title,
            keyword: typeof item.keyword === "string" && item.keyword.length > 0 ? item.keyword : task.title,
            type: typeof item.type === "string" && item.type.length > 0 ? item.type : "article",
          }))
          .slice(0, 3)
      : [];
    const normalizedPlan = {
      keywordClusters,
      siteStructure,
      technicalSeo,
      linkBuildingPlan,
      contentCalendar,
    };

    // Create article generation tasks
    for (const cluster of keywordClusters) {
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
        clusters: keywordClusters.length,
        pages: siteStructure.length,
        calendar: contentCalendar.length,
      }),
      tags: ["seo", "strategy", ...keywords.slice(0, 5)],
    });

    return { plan: normalizedPlan };
  }

  private async generateSeoArticles(task: Task): Promise<Record<string, unknown>> {
    const keywords = (task.input.keywords as string[]) || [];

    const articles = await this.thinkJson<{
      articles: Array<{
        title: string;
        slug: string;
        metaTitle: string;
        metaDescription: string;
        outline: string[];
        summary: string;
        keywords: string[];
        faq: string[];
      }>;
    }>(
      `You are an SEO Content Generator.
Generate articles that rank and provide real value.

Requirements:
- Produce compact article briefs, not full long-form articles
- outline: max 6 bullet headings
- summary: under 600 characters
- faq: max 4 short questions
- Meta title (50-60 chars) and description (150-160 chars)`,

      `Generate SEO articles for: ${keywords.join(", ")}
Context: ${task.description}

Respond in JSON with key: articles`
    );

    const articleList = Array.isArray(articles.articles)
      ? articles.articles
          .filter((article): article is NonNullable<typeof articles.articles>[number] => Boolean(article && typeof article === "object"))
          .map((article, index) => ({
            title: typeof article.title === "string" && article.title.length > 0 ? article.title : `SEO article ${index + 1}`,
            slug: typeof article.slug === "string" && article.slug.length > 0 ? article.slug : `seo-article-${index + 1}`,
            metaTitle: typeof article.metaTitle === "string" && article.metaTitle.length > 0 ? article.metaTitle : `SEO article ${index + 1}`,
            metaDescription: typeof article.metaDescription === "string" && article.metaDescription.length > 0 ? article.metaDescription : task.description,
            outline: Array.isArray(article.outline)
              ? article.outline.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 6)
              : [],
            summary: typeof article.summary === "string" && article.summary.length > 0 ? article.summary : task.description,
            keywords: Array.isArray(article.keywords)
              ? article.keywords.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 6)
              : keywords.slice(0, 6),
            faq: Array.isArray(article.faq)
              ? article.faq.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 4)
              : [],
          }))
      : [];

    for (const article of articleList) {
      this.addKnowledge({
        type: "content",
        title: article.title,
        content: article.summary,
        tags: ["seo", "article", ...article.keywords.slice(0, 5)],
      });
    }

    return { articlesGenerated: articleList.length };
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
