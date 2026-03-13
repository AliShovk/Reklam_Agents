import { EventEmitter } from "eventemitter3";
import type { FarmEvent } from "./types.js";
import { createSubLogger } from "./logger.js";

const log = createSubLogger("event-bus");

type EventHandler = (event: FarmEvent) => void | Promise<void>;

class FarmEventBus {
  private emitter = new EventEmitter();
  private history: FarmEvent[] = [];
  private maxHistory = 1000;

  emit(event: FarmEvent): void {
    log.debug(`Event: ${event.type}`);
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    this.emitter.emit(event.type, event);
    this.emitter.emit("*", event);
  }

  on(eventType: FarmEvent["type"] | "*", handler: EventHandler): void {
    this.emitter.on(eventType, handler);
  }

  off(eventType: FarmEvent["type"] | "*", handler: EventHandler): void {
    this.emitter.off(eventType, handler);
  }

  once(eventType: FarmEvent["type"], handler: EventHandler): void {
    this.emitter.once(eventType, handler);
  }

  getHistory(type?: FarmEvent["type"], limit = 50): FarmEvent[] {
    const filtered = type ? this.history.filter((e) => e.type === type) : this.history;
    return filtered.slice(-limit);
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const eventBus = new FarmEventBus();
