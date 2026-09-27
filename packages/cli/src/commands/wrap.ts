import { spawn } from "node:child_process";
import { basename, join } from "node:path";
import {
  captureWorktree,
  diffWorktree,
  guessAgentName,
  formatDuration,
} from "@tracekit/core";
import { Replay } from "@tracekit/sdk";

export interface WrapCommandOptions {
  /** Storage directory for recorded runs. Defaults to `.tracekit`. */
  dir?: string;
  /** Directory the command runs in, and the directory that is diffed. */
  cwd?: string;
  /** Human label for this run. Defaults to the command line. */
  task?: string;
  /** Project name recorded in the run. Defaults to the cwd basename. */
  project?: string;
  /** Skip the before/after worktree diff. */
  noGit?: boolean;
  /**
   * Give the child the terminal directly instead of teeing its output. Required
   * for full-screen TUI agents, but their output is then not recorded.
   */
  inheritStdio?: boolean;
  /** Suppress the summary printed after the command exits. */
  quiet?: boolean;
}

/**
 * Coalesces high-volume child output into a bounded number of trace events so a
 * chatty agent does not produce a 200MB events.jsonl.
 */
class ThrottledSink {
  private buffer = "";
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly emit: (data: string) => Promise<void>,
    private readonly intervalMs = 250
  ) {}

  public push(chunk: string): void {
    this.buffer += chunk;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  public async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.buffer) return;
    const data = this.buffer;
    this.buffer = "";
    await this.emit(data);
  }
}

export async function wrapCommand(
  command: string[],
  options: WrapCommandOptions = {}
): Promise<void> {
  if (command.length === 0) {
    console.error(
      "tracekit wrap: no command given.\nUsage: tracekit wrap [options] -- <command> [args...]"
    );
    process.exitCode = 1;
    return;
  }

  const [bin, ...args] = command;
  const cwd = options.cwd ?? process.cwd();
  const commandLine = command.join(" ");

  const before = options.noGit ? null : await captureWorktree({ cwd });

  const replay = await Replay.start({
    project: options.project ?? basename(cwd),
    task: options.task ?? commandLine,
    cwd,
    // Anchor the trace to the project being recorded, not to wherever
    // `tracekit` happened to be invoked from.
    storageDir: options.dir ?? join(cwd, ".tracekit"),
    agent: { name: guessAgentName(bin) },
    metadata: {
      wrapper: "tracekit-wrap",
      command,
      worktreeDiff: !options.noGit && before !== null,
    },
  });

  // Registered from inside the command callback, which runs before the child
  // can produce any output.
  const flushers: Array<() => Promise<void>> = [];
  let killedBySignal: NodeJS.Signals | null = null;

  const result = await replay.command(commandLine, async (ctx) => {
    const stdoutSink = new ThrottledSink((data) => ctx.stdout(data));
    const stderrSink = new ThrottledSink((data) => ctx.stderr(data));
    flushers.push(() => stdoutSink.flush(), () => stderrSink.flush());

    return await new Promise<number>((resolve) => {
      const child = spawn(bin, args, {
        cwd,
        env: process.env,
        stdio: options.inheritStdio ? "inherit" : ["inherit", "pipe", "pipe"],
        shell: false,
      });

      if (!options.inheritStdio) {
        child.stdout?.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf8");
          process.stdout.write(text);
          stdoutSink.push(text);
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf8");
          process.stderr.write(text);
          stderrSink.push(text);
        });
      }

      // Forward interrupts so Ctrl+C reaches the agent instead of orphaning it.
      const onSigint = () => child.kill("SIGINT");
      const onSigterm = () => child.kill("SIGTERM");
      process.on("SIGINT", onSigint);
      process.on("SIGTERM", onSigterm);

      const cleanup = () => {
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);
      };

      child.on("error", async (err) => {
        cleanup();
        await ctx.stderr(`tracekit wrap: failed to start '${bin}': ${err.message}\n`);
        await stdoutSink.flush();
        await stderrSink.flush();
        resolve(127);
      });

      child.on("close", async (code, signal) => {
        cleanup();
        if (signal) {
          killedBySignal = signal;
        }
        // Flush before resolving: `replay.command` emits command.finished once
        // this returns, and output recorded after that would break the
        // chronological order the viewer and `tracekit events` rely on.
        await stdoutSink.flush();
        await stderrSink.flush();
        resolve(code ?? (signal ? 143 : 1));
      });
    });
  });

  for (const flush of flushers) {
    await flush();
  }

  // Reconstruct what the agent changed, without needing any cooperation from it.
  let changedFiles = 0;
  if (!options.noGit && before) {
    const after = await captureWorktree({ cwd });

    if (after) {
      const changes = diffWorktree(before, after);
      changedFiles = changes.length;

      for (const change of changes) {
        if (change.kind === "deleted") {
          await replay.fileDelete(change.path, change.before ?? undefined);
        } else if (change.after === null) {
          // Binary or over the size cap: record that it changed, not what it holds.
          await replay.event({
            type: "file.write",
            payload: {
              path: change.path,
              contentOmitted: "binary or larger than the capture size limit",
            },
          });
        } else {
          await replay.fileWrite({
            path: change.path,
            before: change.before,
            after: change.after,
          });
        }
      }
    }
  }

  const duration = formatDuration(result.duration);
  const status =
    result.exitCode === 0 ? "completed" : killedBySignal ? "cancelled" : "failed";

  const run = await replay.finish({
    status,
    summary: `${commandLine} -> exit ${result.exitCode} in ${duration}, ${changedFiles} file(s) changed`,
  });

  if (!options.quiet) {
    console.error(
      `\ntracekit: recorded ${run.id} (${status}, ${duration}, ${changedFiles} file(s) changed)`
    );
    console.error(`tracekit: inspect with 'tracekit inspect ${run.id}' or 'tracekit ui'`);
  }

  process.exitCode = result.exitCode ?? 1;
}
