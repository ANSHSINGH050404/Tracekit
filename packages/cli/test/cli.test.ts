import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FsReplayStore } from "@tracekit/core";
import { listCommand } from "../src/commands/list.js";
import { inspectCommand } from "../src/commands/inspect.js";
import { exportCommand } from "../src/commands/export.js";
import { compareCommand } from "../src/commands/compare.js";
import { wrapCommand } from "../src/commands/wrap.js";

const execFileAsync = promisify(execFile);

describe("CLI Commands", () => {
  let testDir: string;
  let store: FsReplayStore;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `tracekit-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(testDir, { recursive: true });
    store = new FsReplayStore({ baseDir: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("lists runs without crashing", async () => {
    await store.createRun({ id: "run_test_1", project: "app-1", task: "Task 1" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await listCommand({ dir: testDir });
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("inspects a run and prints trajectory", async () => {
    const run = await store.createRun({
      id: "run_test_2",
      project: "app-2",
      task: "Task 2",
    });
    await store.appendEvent({
      id: "e1",
      runId: run.id,
      timestamp: Date.now(),
      type: "agent.started",
      payload: { task: "Task 2" },
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await inspectCommand(run.id, { dir: testDir });
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("exports a run to a JSON file", async () => {
    const run = await store.createRun({ id: "run_test_export", project: "app" });
    const exportFile = join(testDir, "exported.json");

    await exportCommand(run.id, { dir: testDir, output: exportFile });

    const content = await fs.readFile(exportFile, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.run.id).toBe("run_test_export");
    expect(Array.isArray(parsed.events)).toBe(true);
  });

  it("compares two runs and prints table", async () => {
    const runA = await store.createRun({ id: "run_A", project: "app" });
    const runB = await store.createRun({ id: "run_B", project: "app" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await compareCommand(runA.id, runB.id, { dir: testDir });
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe("wrap command", () => {
  let repoDir: string;
  let originalExitCode: typeof process.exitCode;

  beforeEach(async () => {
    originalExitCode = process.exitCode;
    repoDir = join(
      tmpdir(),
      `tracekit-wrap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(repoDir, { recursive: true });
    await execFileAsync("git", ["init", "-q"], { cwd: repoDir });
    await execFileAsync("git", ["config", "user.email", "t@example.com"], { cwd: repoDir });
    await execFileAsync("git", ["config", "user.name", "T"], { cwd: repoDir });
    await fs.writeFile(join(repoDir, "app.js"), "const a = 1;\nconst b = 2;\n");
    await execFileAsync("git", ["add", "-A"], { cwd: repoDir });
    await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: repoDir });

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = originalExitCode;
    await fs.rm(repoDir, { recursive: true, force: true }).catch(() => {});
  });

  const readEvents = async (dir: string) => {
    const store = new FsReplayStore({ baseDir: dir });
    const runs = await store.listRuns();
    const events = [];
    for await (const event of runs[0] ? store.getEvents(runs[0].id) : []) {
      events.push(event);
    }
    return { run: runs[0], events };
  };

  it("records a command, its output, and the files it changed", async () => {
    await wrapCommand(
      [
        process.execPath,
        "-e",
        "const fs=require('fs');fs.writeFileSync('app.js','const a = 1;\\nconst b = 99;\\n');console.log('did the thing');",
      ],
      { cwd: repoDir, quiet: true }
    );

    const { run, events } = await readEvents(join(repoDir, ".tracekit"));
    expect(run).toBeDefined();
    expect(run!.status).toBe("completed");

    const types = events.map((e) => e.type);
    expect(types).toContain("agent.started");
    expect(types).toContain("command.started");
    expect(types).toContain("command.stdout");
    expect(types).toContain("command.finished");
    expect(types).toContain("file.write");
    expect(types).toContain("agent.finished");

    const write = events.find((e) => e.type === "file.write") as any;
    expect(write.payload.path).toBe("app.js");
    expect(write.payload.diff).toContain("-const b = 2;");
    expect(write.payload.diff).toContain("+const b = 99;");
  });

  it("stores output before command.finished so the timeline stays ordered", async () => {
    await wrapCommand(
      [process.execPath, "-e", "console.log('ordered output');"],
      { cwd: repoDir, quiet: true }
    );

    const { events } = await readEvents(join(repoDir, ".tracekit"));
    const stdoutIdx = events.findIndex((e) => e.type === "command.stdout");
    const finishedIdx = events.findIndex((e) => e.type === "command.finished");

    expect(stdoutIdx).toBeGreaterThanOrEqual(0);
    expect(finishedIdx).toBeGreaterThan(stdoutIdx);
  });

  it("propagates a non-zero exit code and marks the run failed", async () => {
    await wrapCommand(
      [process.execPath, "-e", "process.stderr.write('boom');process.exit(3);"],
      { cwd: repoDir, quiet: true }
    );

    expect(process.exitCode).toBe(3);

    const { run, events } = await readEvents(join(repoDir, ".tracekit"));
    expect(run!.status).toBe("failed");

    const stderr = events.find((e) => e.type === "command.stderr") as any;
    expect(stderr.payload.data).toContain("boom");
  });

  it("records the agent name inferred from the command", async () => {
    await wrapCommand([process.execPath, "-e", "0"], { cwd: repoDir, quiet: true });

    const { events } = await readEvents(join(repoDir, ".tracekit"));
    const started = events.find((e) => e.type === "agent.started") as any;

    // process.execPath is an absolute path to node, so the basename is the agent.
    expect(started.payload.agent.name).toMatch(/^node/i);
  });

  it("honours an explicit --dir over the cwd default", async () => {
    const customDir = join(repoDir, "custom-traces");
    await wrapCommand([process.execPath, "-e", "0"], {
      cwd: repoDir,
      dir: customDir,
      quiet: true,
    });

    const { run } = await readEvents(customDir);
    expect(run).toBeDefined();
  });

  it("rejects an empty command", async () => {
    await wrapCommand([], { cwd: repoDir, quiet: true });
    expect(process.exitCode).toBe(1);
  });
});
