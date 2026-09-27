import type { AgentEvent } from "@agent-replay/core";
import type { Replay } from "@agent-replay/sdk";
import type { AgentAdapter } from "./types.js";

export class GenericAgentAdapter implements AgentAdapter {
  public readonly name: string;
  private readonly handlers: Set<(event: AgentEvent) => void> = new Set();
  private isRunning = false;
  private attachedReplay?: Replay;

  constructor(name = "generic") {
    this.name = name;
  }

  public async start(): Promise<void> {
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.handlers.clear();
    this.attachedReplay = undefined;
  }

  public onEvent(handler: (event: AgentEvent) => void): void {
    this.handlers.add(handler);
  }

  public offEvent(handler: (event: AgentEvent) => void): void {
    this.handlers.delete(handler);
  }

  /**
   * Attaches this adapter directly to an active Replay instance,
   * automatically routing all emitted events into the replay run.
   */
  public attachToReplay(replay: Replay): void {
    this.attachedReplay = replay;
    this.onEvent((event) => {
      void replay.event(event);
    });
  }

  /**
   * Emits an AgentEvent to all registered listeners and any attached Replay session.
   */
  public emitEvent(event: AgentEvent): void {
    if (!this.isRunning) {
      return;
    }
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[GenericAgentAdapter] Handler error:`, err);
      }
    }
  }
}
