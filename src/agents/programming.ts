import { BaseAgent } from "../core/base-agent.js";
import type { Task } from "../core/types.js";

/**
 * Programming Agent — агент-программист.
 * 
 * Пишет код, создает сайты, API, ботов.
 * Работает в sandbox для безопасности.
 * Генерирует готовые к деплою проекты.
 */
export class ProgrammingAgent extends BaseAgent {
  constructor() {
    super({
      role: "programming",
      name: "Programming Agent",
      description: "Пишет код, создает сайты, лендинги, ботов, API. Работает в sandbox.",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "write_code":
        return this.writeCode(task);
      case "create_landing":
        return this.createLanding(task);
      case "create_bot":
        return this.createBot(task);
      case "create_tool":
        return this.createTool(task);
      default:
        return this.generalCode(task);
    }
  }

  private async writeCode(task: Task): Promise<Record<string, unknown>> {
    const spec = task.input.spec as any;

    const code = await this.thinkJson<{
      projectName: string;
      architecture: string;
      files: string[];
      starterFiles: Array<{
        path: string;
        summary: string;
      }>;
      buildInstructions: string;
      deployInstructions: string;
      environmentVars: string[];
    }>(
      `You are an expert Full-Stack Developer Agent.
Your job is to generate complete, production-ready code for web products.

Tech stack preferences:
- Frontend: React + TailwindCSS + Vite
- Backend: Express.js or Next.js API routes
- Database: SQLite for simple, PostgreSQL for complex
- Deployment: Vercel / Netlify / Docker

Code quality requirements:
- TypeScript only
- Responsive design (mobile-first)
- SEO-optimized HTML (meta tags, structured data)
- Fast loading (lazy load, minimal JS)
- Accessible (ARIA labels, semantic HTML)
- Clear call-to-action placement`,

      `Build this product:
Name: ${spec?.name || task.title}
Type: ${spec?.type || "web_tool"}
Features: ${JSON.stringify(spec?.features || [])}
Tech stack: ${JSON.stringify(spec?.techStack || [])}
Pages: ${JSON.stringify(spec?.pages || [])}
SEO Keywords: ${JSON.stringify(spec?.seoKeywords || [])}

Return a very compact MVP scaffold, not a full production codebase:
- architecture: one short paragraph under 300 chars
- files: max 8 file paths only
- starterFiles: at most 2 items with path + summary only
- environmentVars: max 6 items
- buildInstructions/deployInstructions: one short sentence each

Respond in JSON with keys: projectName, architecture, files, starterFiles, buildInstructions, deployInstructions, environmentVars`
    );

    const projectName = typeof code.projectName === "string" && code.projectName.length > 0 ? code.projectName : (spec?.name || task.title);
    const files = Array.isArray(code.files)
      ? code.files.filter((file): file is string => typeof file === "string" && file.length > 0).slice(0, 8)
      : [];
    const starterFiles = Array.isArray(code.starterFiles)
      ? code.starterFiles
          .filter((file): file is NonNullable<typeof code.starterFiles>[number] => Boolean(file && typeof file === "object" && typeof file.path === "string" && file.path.length > 0))
          .map((file) => ({
            path: file.path,
            summary: typeof file.summary === "string" && file.summary.length > 0 ? file.summary : "Implement this file based on the scaffold.",
          }))
          .slice(0, 2)
      : [];
    const architecture = typeof code.architecture === "string" && code.architecture.length > 0 ? code.architecture : "Frontend + backend MVP scaffold.";
    const buildInstructions = typeof code.buildInstructions === "string" && code.buildInstructions.length > 0 ? code.buildInstructions : "Review the scaffold and implement the remaining files.";
    const deployInstructions = typeof code.deployInstructions === "string" && code.deployInstructions.length > 0 ? code.deployInstructions : "Deploy after implementing the missing files.";
    const environmentVars = Array.isArray(code.environmentVars)
      ? code.environmentVars.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 6)
      : [];

    // Save generated code to knowledge base
    this.addKnowledge({
      type: "code",
      title: `Code: ${projectName}`,
      content: `Architecture: ${architecture}. Files: ${files.join(", ")}. Build: ${buildInstructions}`,
      tags: ["code", projectName],
    });

    this.log.info(`Generated project scaffold: ${projectName} with ${files.length} files`);

    return {
      code: {
        projectName,
        architecture,
        files,
        starterFiles,
        buildInstructions,
        deployInstructions,
        environmentVars,
      },
    };
  }

  private async createLanding(task: Task): Promise<Record<string, unknown>> {
    const landing = await this.thinkJson<{
      html: string;
      css: string;
      js: string;
      meta: {
        title: string;
        description: string;
        keywords: string[];
        ogImage: string;
      };
    }>(
      `You are a Landing Page Developer Agent.
Create a high-converting, SEO-optimized landing page.

Requirements:
- Single-page, fast-loading HTML
- Modern design with TailwindCSS CDN
- Mobile-responsive
- Clear hero section with CTA
- Benefits/features section
- Social proof section
- FAQ section
- Footer with links
- Google Analytics placeholder
- Open Graph meta tags`,

      `Create landing page for:
Title: ${task.title}
Description: ${task.description}
Input: ${JSON.stringify(task.input)}

Respond in JSON with keys: html, css, js, meta`
    );

    this.addKnowledge({
      type: "code",
      title: `Landing: ${landing.meta?.title || task.title}`,
      content: `Landing page created. Meta: ${JSON.stringify(landing.meta)}`,
      tags: ["landing", "code"],
    });

    return { landing };
  }

  private async createBot(task: Task): Promise<Record<string, unknown>> {
    const bot = await this.thinkJson<{
      platform: string;
      files: Array<{ path: string; content: string }>;
      commands: Array<{ command: string; description: string }>;
      setupInstructions: string;
    }>(
      `You are a Bot Developer Agent.
Create a Telegram/Discord bot with useful functionality.

Requirements:
- TypeScript with telegraf (Telegram) or discord.js (Discord)
- Command handler architecture
- Error handling
- Rate limiting
- Logging
- Environment variable configuration`,

      `Create bot:
Title: ${task.title}
Description: ${task.description}
Platform: ${(task.input as any).platform || "telegram"}

Respond in JSON with keys: platform, files, commands, setupInstructions`
    );

    this.addKnowledge({
      type: "code",
      title: `Bot: ${task.title}`,
      content: `${bot.platform} bot with commands: ${bot.commands?.map((c) => c.command).join(", ")}`,
      tags: ["bot", bot.platform, "code"],
    });

    return { bot };
  }

  private async createTool(task: Task): Promise<Record<string, unknown>> {
    const tool = await this.thinkJson<{
      name: string;
      files: Array<{ path: string; content: string }>;
      apiEndpoints: Array<{ method: string; path: string; description: string }>;
      buildCommand: string;
    }>(
      `You are a Web Tool Developer Agent.
Create a useful web tool/calculator/generator.

Requirements:
- Interactive frontend with instant results
- No page reload (SPA-like)
- Shareable results via URL params
- SEO-friendly
- Embed-ready (iframe support)`,

      `Create tool:
Title: ${task.title}
Description: ${task.description}

Respond in JSON with keys: name, files, apiEndpoints, buildCommand`
    );

    this.addKnowledge({
      type: "code",
      title: `Tool: ${tool.name}`,
      content: JSON.stringify(tool.apiEndpoints || []),
      tags: ["tool", "code"],
    });

    return { tool };
  }

  private async generalCode(task: Task): Promise<Record<string, unknown>> {
    const result = await this.think(
      "You are a Programming Agent. Write clean, production-ready TypeScript code.",
      `Task: ${task.title}\nDescription: ${task.description}\nInput: ${JSON.stringify(task.input)}`
    );
    return { code: result };
  }
}
