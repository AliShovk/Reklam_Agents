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
        rules: string;
        bestContentType: string;
        engagement: string;
        keywordMatch: string[];
      }>;
      strategy: {
        priorityCommunities: string[];
        approachSequence: string;
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

Keep the response compact:
- communities: max 6 items
- rules: short summary only
- omit URLs and verbose adaptation maps

Respond in JSON with keys: communities (array of {name, platform, niche, size, rules, bestContentType, engagement, keywordMatch}), strategy (with priorityCommunities, approachSequence)`
    );

    const communityList = Array.isArray(communities.communities)
      ? communities.communities
          .filter((community): community is NonNullable<typeof communities.communities>[number] => Boolean(community && typeof community === "object"))
          .slice(0, 6)
      : [];
    const priorityCommunities = Array.isArray(communities.strategy?.priorityCommunities)
      ? communities.strategy.priorityCommunities.filter((name): name is string => typeof name === "string" && name.length > 0)
      : [];

    // Save communities to knowledge base
    for (const community of communityList) {
      const communityName = typeof community.name === "string" && community.name.length > 0 ? community.name : "Unknown community";
      const platform = typeof community.platform === "string" && community.platform.length > 0 ? community.platform : "unknown";
      const niche = typeof community.niche === "string" && community.niche.length > 0 ? community.niche : "general";
      const size = typeof community.size === "string" && community.size.length > 0 ? community.size : "unknown";
      const engagement = typeof community.engagement === "string" && community.engagement.length > 0 ? community.engagement : "unknown";
      const keywordMatch = Array.isArray(community.keywordMatch) ? community.keywordMatch.filter((keyword): keyword is string => typeof keyword === "string" && keyword.length > 0) : [];

      this.addKnowledge({
        type: "research",
        title: `Community: ${communityName} (${platform})`,
        content: `Niche: ${niche}. Size: ${size}. Engagement: ${engagement}`,
        tags: [
          "community",
          platform,
          niche,
          ...keywordMatch.slice(0, 3),
        ],
      });
    }

    // Create engagement tasks for priority communities
    for (const communityName of priorityCommunities.slice(0, 5)) {
      const community = communityList.find((c) => c.name === communityName);
      if (community) {
        const platform = typeof community.platform === "string" && community.platform.length > 0 ? community.platform : "unknown";
        const rules = typeof community.rules === "string" && community.rules.length > 0 ? community.rules : "Check community rules before posting.";
        const bestContentType = typeof community.bestContentType === "string" && community.bestContentType.length > 0 ? community.bestContentType : "helpful discussion";

        this.createSubTask({
          type: "engage",
          priority: "medium",
          title: `Engage in: ${communityName} (${platform})`,
          description: `Join and engage. Rules: ${rules}. Best content type: ${bestContentType}`,
          input: { community },
          assignedTo: "engagement",
        });
      }
    }

    this.log.info(`Found ${communityList.length} target communities`);

    return {
      communitiesFound: communityList.length,
      priorityCommunities: priorityCommunities.length,
      strategy: communities.strategy,
    };
  }
}
