import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FsReplayStore } from "@agent-replay/core";
import { listCommand } from "../src/commands/list.js";
import { inspectCommand } from "../src/commands/inspect.js";
import { exportCommand } from "../src/commands/export.js";
import { compareCommand } from "../src/commands/compare.js";

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
