export interface Run {
  id: string;
  project: string;
  task?: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "completed" | "failed" | "cancelled";
  repository?: {
    root: string;
    branch?: string;
    commit?: string;
    dirty?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface AgentEvent {
  id: string;
  runId: string;
  timestamp: number;
  type: string;
  payload?: any;
}

export interface RunMetrics {
  runId: string;
  project: string;
  task?: string;
  status: string;
  durationMs: number;
  durationFormatted: string;
  eventCount: number;
  toolCallsCount: number;
  commandsCount: number;
  filesChangedCount: number;
  filesChanged: string[];
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  errorCount: number;
}

export interface RunComparison {
  runA: RunMetrics;
  runB: RunMetrics;
}
