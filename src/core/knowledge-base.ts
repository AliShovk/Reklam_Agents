import { v4 as uuid } from "uuid";
import { createSubLogger } from "./logger.js";

const log = createSubLogger("knowledge-base");

export interface KnowledgeEntry {
  id: string;
  type: "product" | "content" | "strategy" | "research" | "code" | "metric" | "lesson";
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  embedding?: number[];
}

/**
 * In-memory knowledge base with semantic search simulation.
 * In production, swap with ChromaDB / Pinecone / Qdrant for real vector search.
 */
class KnowledgeBase {
  private entries = new Map<string, KnowledgeEntry>();
  private tagIndex = new Map<string, Set<string>>();
  private typeIndex = new Map<string, Set<string>>();

  add(params: {
    type: KnowledgeEntry["type"];
    title: string;
    content: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): KnowledgeEntry {
    const entry: KnowledgeEntry = {
      id: uuid(),
      type: params.type,
      title: params.title,
      content: params.content,
      tags: params.tags || [],
      metadata: params.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.entries.set(entry.id, entry);

    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(entry.id);
    }

    // Update type index
    if (!this.typeIndex.has(entry.type)) this.typeIndex.set(entry.type, new Set());
    this.typeIndex.get(entry.type)!.add(entry.id);

    log.debug(`Knowledge added: [${entry.type}] ${entry.title}`);
    return entry;
  }

  get(id: string): KnowledgeEntry | undefined {
    return this.entries.get(id);
  }

  update(id: string, updates: Partial<Pick<KnowledgeEntry, "title" | "content" | "tags" | "metadata">>): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    Object.assign(entry, updates, { updatedAt: new Date() });
  }

  /** Search by keyword matching (simulates semantic search). */
  search(query: string, options?: {
    type?: KnowledgeEntry["type"];
    tags?: string[];
    limit?: number;
  }): KnowledgeEntry[] {
    const limit = options?.limit || 10;
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    let candidates: KnowledgeEntry[];

    if (options?.type) {
      const ids = this.typeIndex.get(options.type);
      candidates = ids ? Array.from(ids).map((id) => this.entries.get(id)!).filter(Boolean) : [];
    } else {
      candidates = Array.from(this.entries.values());
    }

    if (options?.tags && options.tags.length > 0) {
      const tagIds = new Set<string>();
      for (const tag of options.tags) {
        const ids = this.tagIndex.get(tag);
        if (ids) ids.forEach((id) => tagIds.add(id));
      }
      candidates = candidates.filter((e) => tagIds.has(e.id));
    }

    // Score by keyword relevance
    const scored = candidates.map((entry) => {
      const text = `${entry.title} ${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (text.includes(word)) score++;
      }
      // Boost exact title match
      if (entry.title.toLowerCase().includes(queryLower)) score += 5;
      return { entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  getByType(type: KnowledgeEntry["type"]): KnowledgeEntry[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.entries.get(id)!).filter(Boolean);
  }

  getByTags(tags: string[]): KnowledgeEntry[] {
    const allIds = new Set<string>();
    for (const tag of tags) {
      const ids = this.tagIndex.get(tag);
      if (ids) ids.forEach((id) => allIds.add(id));
    }
    return Array.from(allIds).map((id) => this.entries.get(id)!).filter(Boolean);
  }

  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const [type, ids] of this.typeIndex) {
      byType[type] = ids.size;
    }
    return { total: this.entries.size, byType };
  }

  getAll(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }
}

export const knowledgeBase = new KnowledgeBase();
