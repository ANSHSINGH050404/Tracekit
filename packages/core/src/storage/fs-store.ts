import { promises as fs, createReadStream } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import type { AgentEvent } from "../events/types.js";
import { safeValidateEvent } from "../events/schemas.js";
import type { Run, CreateRunParams } from "../run/types.js";
import { RunSchema } from "../run/schemas.js";
import type { ReplayStore, FsReplayStoreOptions } from "./types.js";

export class RunNotFoundError extends Error {
  constructor(public readonly runId: string) {
    super(`Run not found: ${runId}`);
    this.name = "RunNotFoundError";
  }
}

export class FsReplayStore implements ReplayStore {
  private readonly baseDir: string;
  private readonly appendLocks: Map<string, Promise<void>> = new Map();

  constructor(options: FsReplayStoreOptions = {}) {
    this.baseDir = resolve(options.baseDir ?? ".agent-replay");
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  private getRunsDir(): string {
    return join(this.baseDir, "runs");
  }

  private getRunDir(runId: string): string {
    return join(this.getRunsDir(), runId);
  }

  private async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  private async writeAtomicJson(filePath: string, data: unknown): Promise<void> {
    const jsonStr = JSON.stringify(data, null, 2);
    const tempPath = `${filePath}.tmp.${Date.now()}.${randomBytes(4).toString("hex")}`;
    await fs.writeFile(tempPath, jsonStr, "utf8");
    try {
      await fs.rename(tempPath, filePath);
    } catch {
      // Windows retry or overwrite fallback
      await fs.copyFile(tempPath, filePath);
      await fs.unlink(tempPath).catch(() => {});
    }
  }

  public async createRun(params: CreateRunParams): Promise<Run> {
    const runId = params.id ?? `run_${Date.now()}_${randomBytes(3).toString("hex")}`;
    const runDir = this.getRunDir(runId);
    await this.ensureDir(runDir);

    const now = Date.now();
    const run: Run = {
      id: runId,
      project: params.project,
      task: params.task,
      startedAt: params.startedAt ?? now,
      status: "running",
      repository: params.repository,
      metadata: params.metadata ?? {},
    };

    // Validate run structure
    const validated = RunSchema.parse(run);

    const runJsonPath = join(runDir, "run.json");
    const metaJsonPath = join(runDir, "metadata.json");
    const eventsPath = join(runDir, "events.jsonl");

    await this.writeAtomicJson(runJsonPath, validated);
    await this.writeAtomicJson(metaJsonPath, validated.metadata ?? {});

    // Ensure events.jsonl exists
    await fs.writeFile(eventsPath, "", { flag: "a" });

    return validated;
  }

  public async updateRun(runId: string, updates: Partial<Run>): Promise<Run> {
    const current = await this.getRun(runId);
    const updated: Run = {
      ...current,
      ...updates,
      id: runId, // Run ID cannot be altered
      metadata: {
        ...current.metadata,
        ...updates.metadata,
      },
    };

    const validated = RunSchema.parse(updated);
    const runDir = this.getRunDir(runId);
    const runJsonPath = join(runDir, "run.json");
    const metaJsonPath = join(runDir, "metadata.json");

    await this.writeAtomicJson(runJsonPath, validated);
    if (validated.metadata) {
      await this.writeAtomicJson(metaJsonPath, validated.metadata);
    }

    return validated;
  }

  public async appendEvent(event: AgentEvent): Promise<void> {
    const runDir = this.getRunDir(event.runId);
    await this.ensureDir(runDir);
    const eventsPath = join(runDir, "events.jsonl");

    // Queue appends per run to prevent interleaved lines
    const line = JSON.stringify(event) + "\n";
    const currentLock = this.appendLocks.get(event.runId) ?? Promise.resolve();

    const nextLock = currentLock
      .catch(() => {})
      .then(async () => {
        await fs.appendFile(eventsPath, line, "utf8");
      });

    this.appendLocks.set(event.runId, nextLock);
    await nextLock;
  }

  public async getRun(runId: string): Promise<Run> {
    const runDir = this.getRunDir(runId);
    const runJsonPath = join(runDir, "run.json");

    try {
      const content = await fs.readFile(runJsonPath, "utf8");
      const parsed = JSON.parse(content);
      return RunSchema.parse(parsed);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new RunNotFoundError(runId);
      }
      throw err;
    }
  }

  public async *getEvents(runId: string): AsyncIterable<AgentEvent> {
    const runDir = this.getRunDir(runId);
    const eventsPath = join(runDir, "events.jsonl");

    try {
      await fs.access(eventsPath);
    } catch {
      return;
    }

    const stream = createReadStream(eventsPath, { encoding: "utf8" });
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        const result = safeValidateEvent(parsed);
        if (result.success) {
          yield result.data;
        }
      } catch {
        // Corrupted JSON line is skipped gracefully
        continue;
      }
    }
  }

  public async listRuns(): Promise<Run[]> {
    const runsDir = this.getRunsDir();
    try {
      const entries = await fs.readdir(runsDir, { withFileTypes: true });
      const runs: Run[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const run = await this.getRun(entry.name);
          runs.push(run);
        } catch {
          // If directory is incomplete or unreadable, ignore it
          continue;
        }
      }

      // Sort descending by startedAt
      runs.sort((a, b) => b.startedAt - a.startedAt);
      return runs;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }
}
