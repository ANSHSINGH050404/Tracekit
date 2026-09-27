export type RunStatus = "running" | "completed" | "failed" | "cancelled";

export interface RepositoryInfo {
  root: string;
  branch?: string;
  commit?: string;
  dirty?: boolean;
}

export interface Run {
  id: string;
  project: string;
  task?: string;
  startedAt: number;
  finishedAt?: number;
  status: RunStatus;
  repository?: RepositoryInfo;
  metadata?: Record<string, unknown>;
}

export interface CreateRunParams {
  id?: string;
  project: string;
  task?: string;
  startedAt?: number;
  repository?: RepositoryInfo;
  metadata?: Record<string, unknown>;
}
