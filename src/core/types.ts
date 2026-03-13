import { z } from "zod";

// ============================================================================
// Agent Types
// ============================================================================

export type AgentRole =
  | "supervisor"
  | "strategy"
  | "product"
  | "discovery"
  | "programming"
  | "content"
  | "posting"
  | "outreach"
  | "engagement"
  | "seo"
  | "video"
  | "infrastructure"
  | "observability";

export type AgentStatus = "idle" | "working" | "error" | "disabled" | "cooldown";

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface AgentIdentity {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  model: string;
  status: AgentStatus;
  createdAt: Date;
  lastActiveAt: Date;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  tokensUsed: number;
  avgResponseTimeMs: number;
  uptime: number;
}

// ============================================================================
// Task Types
// ============================================================================

export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  createdBy: string;
  title: string;
  description: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  parentTaskId?: string;
  childTaskIds: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  deadline?: Date;
  retryCount: number;
  maxRetries: number;
  metadata: Record<string, unknown>;
}

export type TaskType =
  | "research"
  | "discover_tools"
  | "create_strategy"
  | "create_product"
  | "write_code"
  | "create_content"
  | "publish_content"
  | "outreach"
  | "engage"
  | "seo_optimize"
  | "create_video"
  | "analyze_metrics"
  | "monitor_health"
  | "scale_resources"
  | "create_landing"
  | "create_bot"
  | "create_tool"
  | "generate_articles"
  | "build_pbn"
  | "interlink"
  | "telegram_post"
  | "telegram_engage"
  | "telegram_poll";

// ============================================================================
// Goal & Strategy Types
// ============================================================================

export interface Goal {
  id: string;
  title: string;
  description: string;
  targetMetric: string;
  targetValue: number;
  currentValue: number;
  deadline?: Date;
  status: "active" | "achieved" | "abandoned";
  subGoals: Goal[];
  createdAt: Date;
}

export interface Strategy {
  id: string;
  goalId: string;
  channels: ChannelStrategy[];
  products: ProductIdea[];
  contentPlan: ContentPlan;
  budget: ResourceBudget;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelStrategy {
  channel: GrowthChannel;
  priority: number;
  estimatedReach: number;
  estimatedCost: number;
  tactics: string[];
}

export type GrowthChannel =
  | "telegram"
  | "discord"
  | "reddit"
  | "youtube"
  | "tiktok"
  | "medium"
  | "twitter"
  | "linkedin"
  | "seo"
  | "email"
  | "forums"
  | "communities";

// ============================================================================
// Product Types
// ============================================================================

export interface ProductIdea {
  id: string;
  name: string;
  type: ProductType;
  description: string;
  targetAudience: string;
  searchDemand: string;
  estimatedTraffic: number;
  status: "idea" | "approved" | "in_development" | "launched" | "archived";
  url?: string;
  createdAt: Date;
}

export type ProductType =
  | "calculator"
  | "landing_page"
  | "telegram_bot"
  | "web_tool"
  | "api_service"
  | "catalog"
  | "generator"
  | "comparison_tool"
  | "checker"
  | "aggregator";

// ============================================================================
// Content Types
// ============================================================================

export interface ContentPlan {
  id: string;
  strategyId: string;
  items: ContentItem[];
  schedule: ContentSchedule[];
}

export interface ContentItem {
  id: string;
  type: ContentType;
  title: string;
  body: string;
  keywords: string[];
  targetChannel: GrowthChannel;
  status: "draft" | "ready" | "published" | "archived";
  publishedAt?: Date;
  metrics?: ContentMetrics;
}

export type ContentType =
  | "article"
  | "post"
  | "video_script"
  | "meme"
  | "infographic"
  | "thread"
  | "comment"
  | "review"
  | "case_study"
  | "tutorial";

export interface ContentMetrics {
  views: number;
  clicks: number;
  shares: number;
  conversions: number;
  engagement: number;
}

export interface ContentSchedule {
  contentId: string;
  channel: GrowthChannel;
  scheduledAt: Date;
  publishedAt?: Date;
}

// ============================================================================
// Resource & Budget
// ============================================================================

export interface ResourceBudget {
  maxTokensPerDay: number;
  maxAgentsActive: number;
  maxContentPerDay: number;
  maxApiCallsPerHour: number;
}

// ============================================================================
// Growth Cycle
// ============================================================================

export interface GrowthCycleState {
  cycleNumber: number;
  phase: GrowthPhase;
  startedAt: Date;
  metrics: GrowthMetrics;
}

export type GrowthPhase =
  | "research"
  | "product_creation"
  | "content_creation"
  | "publishing"
  | "user_acquisition"
  | "analysis"
  | "strategy_improvement";

export interface GrowthMetrics {
  totalUsers: number;
  newUsersToday: number;
  totalContent: number;
  totalProducts: number;
  totalTraffic: number;
  conversionRate: number;
  growthRate: number;
  topChannels: { channel: GrowthChannel; users: number }[];
}

// ============================================================================
// Events
// ============================================================================

export type FarmEvent =
  | { type: "task:created"; task: Task }
  | { type: "task:completed"; task: Task }
  | { type: "task:failed"; task: Task; error: string }
  | { type: "agent:status_changed"; agentId: string; status: AgentStatus }
  | { type: "goal:progress"; goal: Goal }
  | { type: "goal:achieved"; goal: Goal }
  | { type: "cycle:phase_changed"; phase: GrowthPhase; cycleNumber: number }
  | { type: "product:launched"; product: ProductIdea }
  | { type: "content:published"; content: ContentItem }
  | { type: "alert:agent_error"; agentId: string; error: string }
  | { type: "alert:rate_limit"; agentId: string; provider: string }
  | { type: "telegram:posted"; channelId: string; messageId: number }
  | { type: "telegram:group_message"; groupId: string; messageId: number; text: string };

// ============================================================================
// Config Schema
// ============================================================================

export const FarmConfigSchema = z.object({
  name: z.string().default("ReklamFarm"),
  maxConcurrentAgents: z.number().default(20),
  cycleIntervalMs: z.number().default(300_000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  models: z.object({
    default: z.string().default("gpt-4o"),
    bulk: z.string().default("gpt-4o-mini"),
    strategy: z.string().default("gpt-4o"),
  }),
  redis: z.object({
    url: z.string().default("redis://localhost:6379"),
  }),
  chroma: z.object({
    url: z.string().default("http://localhost:8000"),
    collection: z.string().default("reklam_knowledge"),
  }),
  sandbox: z.object({
    enabled: z.boolean().default(true),
    timeoutMs: z.number().default(30_000),
    maxMemoryMb: z.number().default(512),
  }),
  dashboard: z.object({
    port: z.number().default(3333),
    authToken: z.string().optional(),
  }),
});

export type FarmConfig = z.infer<typeof FarmConfigSchema>;
