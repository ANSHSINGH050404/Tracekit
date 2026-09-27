import type { AgentEvent } from "../events/types.js";
import type { Run, CreateRunParams } from "../run/types.js";

export interface ReplayStore {
  createRun(params: CreateRunParams): Promise<Run>;
  updateRun(runId: string, updates: Partial<Run>): Promise<Run>;
  appendEvent(event: AgentEvent): Promise<void>;
  getRun(runId: string): Promise<Run>;
  getEvents(runId: string): AsyncIterable<AgentEvent>;
  listRuns(): Promise<Run[]>;
}

export interface FsReplayStoreOptions {
  /**
   * Base directory for storing runs. Defaults to ".tracekit".
   */
  baseDir?: string;
}
