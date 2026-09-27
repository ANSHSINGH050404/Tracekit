import type { AgentEvent } from "@agent-replay/core";

/**
 * Standard interface that any agent adapter must implement.
 */
export interface AgentAdapter {
  /**
   * Human-readable name of the adapter (e.g. "generic", "opencode", "aider").
   */
  readonly name: string;

  /**
   * Initializes or connects the adapter to the underlying agent.
   */
  start(): Promise<void>;

  /**
   * Stops the adapter and cleans up any subscriptions or watchers.
   */
  stop(): Promise<void>;

  /**
   * Registers a callback for events emitted by the agent adapter.
   */
  onEvent(handler: (event: AgentEvent) => void): void;
}
