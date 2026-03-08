import { BaseAgent } from "../../core/base-agent.js";
import type { Task, GrowthChannel } from "../../core/types.js";

/**
 * Outreach Agent — находит сообщества и каналы для продвижения.
 * 
 * Ищет подходящие чаты, форумы, дискорд-серверы, сабреддиты.
 * Готовит список целевых сообществ с синтаксисом и правилами.
 */
export class OutreachAgent extends BaseAgent {
  constructor() {
    super({
      role: "outreach",
      name: "Outreach Agent",
      description: "Находит целевые сообщества, чаты, форумы для продвижения контента.",
    });
  }

  protected async executeTask(task: Task): Promise<Record<string, unknown>> {
    switch (task.type) {
      case "outreach":
        return this.findCommunities(task);
      default:
        return this.findCommunities(task);
    }
  }

  private async findCommunities(task: Task): Promise<Record<string, unknown>> {
    const keywords = (task.input.keywords as string[]) || [];
    const targetChannels = (task.input.channels as GrowthChannel[]) || [
      "telegram",
      "discord",
      "reddit",
    ];

    const communities = await this.thinkJson<{
      communities: Array<{
        name: string;
        platform: string;
        niche: string;
        size: string;
        language: string;
        joinUrl: string;
        rules: string;
        bestContentType: string;
        engagement: string;
        keyword_match: string[];
      }>;
      strategy: {
        priorityCommunities: string[];
        approachSequence: string;
        contentAdaptations: Record<string, string>;
      };
    }>(
      `You are a Community Discovery Agent.
Your job is to find high-quality, engaged communities where our content will resonate.

Key principles:
1. Target communities with 500-50k members (sweet spot for engagement)
2. Check if community actively discusses our topic areas
3. Identify communities that DON'T have competitor saturation
4. Read rules carefully before suggesting outreach
5. Note required content format for each community`,

      `Find communities for:
Keywords: ${keywords.join(", ")}
Target platforms: ${targetChannels.join(", ")}
Goal: ${task.description}

Respond in JSON with keys: communities (array of {name, platform, niche, size, language, joinUrl, rules, bestContentType, engagement, keyword_match}), strategy (with priorityCommunities, approachSequence, contentAdaptations)`
    );

    // Save communities to knowledge base
    for (const community of communities.communities || []) {
      this.addKnowledge({
        type: "research",
        title: `Community: ${community.name} (${community.platform})`,
        content: `Niche: ${community.niche}. Size: ${community.size}. Language: ${community.language}. Engagement: ${community.engagement}`,
        tags: [
          "community",
          community.platform,
          community.niche,
          ...community.keyword_match.slice(0, 3),
        ],
      });
    }

    // Create engagement tasks for priority communities
    const priorityCommunities = communities.strategy?.priorityCommunities || [];
    for (const communityName of priorityCommunities.slice(0, 5)) {
      const community = communities.communities?.find((c) => c.name === communityName);
      if (community) {
        this.createSubTask({
          type: "engage",
          priority: "medium",
          title: `Engage in: ${community.name} (${community.platform})`,
          description: `Join and engage. Rules: ${community.rules}. Best content type: ${community.bestContentType}`,
          input: { community },
          assignedTo: "engagement",
        });
      }
    }

    this.log.info(`Found ${communities.communities?.length || 0} target communities`);

    return {
      communitiesFound: communities.communities?.length || 0,
      priorityCommunities: priorityCommunities.length,
      strategy: communities.strategy,
    };
  }
}
