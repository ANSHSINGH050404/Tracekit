import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  type AgentEvent,
  type Run,
  type RunStatus,
  type ReplayStore,
  type ModelRequestPayload,
  type ModelResponsePayload,
  FsReplayStore,
  Redactor,
  type RedactionOptions,
  getGitSnapshot,
  computeUnifiedDiff,
  computeHash,
} from "@tracekit/core";

export interface ReplayStartOptions extends RedactionOptions {
  project: string;
  task?: string;
  runId?: string;
  store?: ReplayStore;
  storageDir?: string;
  cwd?: string;
  metadata?: Record<string, unknown>;
  agent?: {
    name?: string;
    version?: string;
  };
  captureGit?: boolean;
}

export interface CommandContext {
  /** Identifier shared by this command's started/stdout/stderr/finished events. */
  commandId: string;
  stdout: (data: string) => Promise<void>;
  stderr: (data: string) => Promise<void>;
}

export interface CommandExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
}

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface FinishOptions {
  status?: RunStatus;
  summary?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export class Replay {
  private _run: Run;
  private readonly store: ReplayStore;
  private readonly redactor: Redactor;
  private readonly cwd: string;
  private readonly captureGit: boolean;
  private isFinished = false;

  private constructor(
    run: Run,
    store: ReplayStore,
    redactor: Redactor,
    cwd: string,
    captureGit: boolean
  ) {
    this._run = run;
    this.store = store;
    this.redactor = redactor;
    this.cwd = cwd;
    this.captureGit = captureGit;
  }

  public get run(): Run {
    return this._run;
  }

  public get runId(): string {
    return this._run.id;
  }

  public get project(): string {
    return this._run.project;
  }

  public get task(): string | undefined {
    return this._run.task;
  }

  /**
   * Initializes and starts a new recorded run.
   */
  public static async start(options: ReplayStartOptions): Promise<Replay> {
    const cwd = options.cwd ?? process.cwd();
    const captureGit = options.captureGit !== false;
    const store = options.store ?? new FsReplayStore({ baseDir: options.storageDir });

    const redactor = new Redactor({
      redact: options.redact,
      patterns: options.patterns,
      mask: options.mask,
      includeDefaults: options.includeDefaults,
    });

    // Capture initial git snapshot if enabled
    let gitInfo = undefined;
    if (captureGit) {
      const snapshot = await getGitSnapshot({ cwd, phase: "start" });
      if (snapshot) {
        gitInfo = {
          root: snapshot.root,
          branch: snapshot.branch,
          commit: snapshot.commit,
          dirty: snapshot.dirty,
        };
      }
    }

    const run = await store.createRun({
      id: options.runId,
      project: options.project,
      task: options.task,
      startedAt: Date.now(),
      repository: gitInfo,
      metadata: options.metadata,
    });

    const replay = new Replay(run, store, redactor, cwd, captureGit);

    // Emit initial git snapshot event if git repo exists
    if (gitInfo) {
      await replay.event({
        type: "git.snapshot",
        payload: {
          ...gitInfo,
          phase: "start",
        },
      });
    }

    // Emit agent.started event
    await replay.event({
      type: "agent.started",
      payload: {
        task: options.task,
        project: options.project,
        agent: options.agent,
        metadata: options.metadata,
      },
    });

    return replay;
  }

  /**
   * Records a raw or custom event. Redaction is applied before persisting.
   */
  public async event(
    rawEvent:
      | AgentEvent
      | {
          type: string;
          id?: string;
          timestamp?: number;
          payload?: unknown;
          [key: string]: unknown;
        }
  ): Promise<AgentEvent> {
    const eventId = rawEvent.id ?? `evt_${Date.now()}_${randomBytes(3).toString("hex")}`;
    const timestamp = rawEvent.timestamp ?? Date.now();

    // Support both { type, payload } and { type, ...fields }
    let payload: unknown;
    if ("payload" in rawEvent) {
      payload = rawEvent.payload;
    } else {
      const { type, id, timestamp: ts, ...rest } = rawEvent;
      payload = rest;
    }

    // Apply redaction prior to storing
    const redactedPayload = this.redactor.redactDeep(payload);

    const fullEvent = {
      id: eventId,
      runId: this._run.id,
      timestamp,
      type: rawEvent.type,
      payload: redactedPayload,
    } as AgentEvent;

    await this.store.appendEvent(fullEvent);
    return fullEvent;
  }

  /**
   * Executes a tool and records `tool.call` before and `tool.result` after.
   */
  public async tool<T>(
    name: string,
    input: unknown,
    fn: () => Promise<T> | T
  ): Promise<T> {
    const callId = `call_${Date.now()}_${randomBytes(3).toString("hex")}`;
    const startTime = Date.now();

    await this.event({
      type: "tool.call",
      payload: {
        callId,
        tool: name,
        input,
      },
    });

    try {
      const output = await fn();
      const duration = Date.now() - startTime;

      await this.event({
        type: "tool.result",
        payload: {
          callId,
          tool: name,
          output,
          isError: false,
          duration,
        },
      });

      return output;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      await this.event({
        type: "tool.result",
        payload: {
          callId,
          tool: name,
          output: {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
          isError: true,
          duration,
        },
      });
      throw err;
    }
  }

  /**
   * Executes a shell command or executes custom logic while recording
   * `command.started`, `command.stdout`, `command.stderr`, and `command.finished`.
   */
  public async command(
    commandLine: string,
    fnOrOptions?:
      | ((ctx: CommandContext) => Promise<number | void>)
      | CommandExecOptions
  ): Promise<CommandResult> {
    const commandId = `cmd_${Date.now()}_${randomBytes(3).toString("hex")}`;
    const startTime = Date.now();

    await this.event({
      type: "command.started",
      payload: {
        commandId,
        command: commandLine,
        cwd: typeof fnOrOptions === "object" ? fnOrOptions.cwd : this.cwd,
      },
    });

    let totalStdout = "";
    let totalStderr = "";

    const ctx: CommandContext = {
      commandId,
      stdout: async (data: string) => {
        totalStdout += data;
        await this.event({
          type: "command.stdout",
          payload: { commandId, data },
        });
      },
      stderr: async (data: string) => {
        totalStderr += data;
        await this.event({
          type: "command.stderr",
          payload: { commandId, data },
        });
      },
    };

    let exitCode: number | null = 0;

    if (typeof fnOrOptions === "function") {
      try {
        const result = await fnOrOptions(ctx);
        if (typeof result === "number") {
          exitCode = result;
        }
      } catch (err: any) {
        exitCode = 1;
        await ctx.stderr(err instanceof Error ? err.message : String(err));
      }
    } else {
      // Direct shell command execution
      const opts = fnOrOptions ?? {};
      const execCwd = opts.cwd ?? this.cwd;
      const shell = opts.shell !== false;

      exitCode = await new Promise<number | null>((resolve) => {
        const child = spawn(commandLine, {
          cwd: execCwd,
          env: { ...process.env, ...opts.env },
          shell,
        });

        child.stdout?.on("data", (chunk: Buffer) => {
          void ctx.stdout(chunk.toString("utf8"));
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          void ctx.stderr(chunk.toString("utf8"));
        });

        child.on("close", (code) => {
          resolve(code);
        });

        child.on("error", (err) => {
          void ctx.stderr(`Failed to start command: ${err.message}\n`);
          resolve(1);
        });
      });
    }

    const duration = Date.now() - startTime;
    await this.event({
      type: "command.finished",
      payload: {
        commandId,
        command: commandLine,
        exitCode,
        duration,
      },
    });

    return {
      exitCode,
      stdout: totalStdout,
      stderr: totalStderr,
      duration,
    };
  }

  /**
   * Records a file read event with optional content hash and size.
   */
  public async fileRead(path: string, content?: string): Promise<AgentEvent> {
    const hash = content !== undefined ? computeHash(content) : undefined;
    const size = content !== undefined ? Buffer.byteLength(content, "utf8") : undefined;

    return this.event({
      type: "file.read",
      payload: {
        path,
        content,
        hash,
        size,
      },
    });
  }

  /**
   * Records a file write event with calculated unified diff and hashes.
   */
  public async fileWrite(params: {
    path: string;
    before?: string | null;
    after?: string;
    diff?: string;
  }): Promise<AgentEvent> {
    const beforeHash = params.before !== undefined && params.before !== null ? computeHash(params.before) : null;
    const afterHash = params.after !== undefined ? computeHash(params.after) : undefined;
    const diff = params.diff ?? computeUnifiedDiff(params.path, params.before, params.after);

    return this.event({
      type: "file.write",
      payload: {
        path: params.path,
        before: params.before,
        after: params.after,
        diff,
        beforeHash,
        afterHash,
      },
    });
  }

  /**
   * Records a file delete event.
   */
  public async fileDelete(path: string, previousContent?: string): Promise<AgentEvent> {
    const previousHash = previousContent ? computeHash(previousContent) : undefined;
    return this.event({
      type: "file.delete",
      payload: {
        path,
        previousHash,
      },
    });
  }

  /**
   * Records an LLM model request.
   */
  public async modelRequest(payload: ModelRequestPayload): Promise<AgentEvent> {
    return this.event({
      type: "model.request",
      payload,
    });
  }

  /**
   * Records an LLM model response.
   */
  public async modelResponse(payload: ModelResponsePayload): Promise<AgentEvent> {
    return this.event({
      type: "model.response",
      payload,
    });
  }

  /**
   * Records an error.
   */
  public async error(
    err: unknown,
    context?: Record<string, unknown>
  ): Promise<AgentEvent> {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const name = err instanceof Error ? err.name : undefined;

    return this.event({
      type: "error",
      payload: {
        message,
        name,
        stack,
        context,
      },
    });
  }

  /**
   * Finalizes the run, captures the final git snapshot, emits agent.finished,
   * and updates run status in store.
   */
  public async finish(options: FinishOptions = {}): Promise<Run> {
    if (this.isFinished) {
      return this._run;
    }
    this.isFinished = true;

    const finishedAt = Date.now();
    const duration = finishedAt - this._run.startedAt;
    const finalStatus: RunStatus = options.status ?? "completed";

    // Capture final git snapshot if enabled
    if (this.captureGit) {
      const endSnapshot = await getGitSnapshot({ cwd: this.cwd, phase: "end" });
      if (endSnapshot) {
        await this.event({
          type: "git.snapshot",
          payload: {
            ...endSnapshot,
            phase: "end",
          },
        });
      }
    }

    // Emit agent.finished event
    await this.event({
      type: "agent.finished",
      payload: {
        status: finalStatus,
        duration,
        summary: options.summary,
        error: options.error,
        metadata: options.metadata,
      },
    });

    // Update run in store
    this._run = await this.store.updateRun(this._run.id, {
      status: finalStatus,
      finishedAt,
      metadata: options.metadata,
    });

    return this._run;
  }
}

export const Tracekit = Replay;
