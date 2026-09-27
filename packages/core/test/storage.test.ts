import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FsReplayStore, RunNotFoundError } from "../src/storage/fs-store.js";
import type { AgentEvent } from "../src/events/types.js";

describe("Filesystem Storage (FsReplayStore)", () => {
  let testDir: string;
  let store: FsReplayStore;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `tracekit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(testDir, { recursive: true });
    store = new FsReplayStore({ baseDir: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("creates a new run and stores run.json and metadata.json (create run)", async () => {
    const run = await store.createRun({
      project: "test-project",
      task: "Fix tests",
      metadata: { env: "testing" },
    });

    expect(run.id).toBeDefined();
    expect(run.project).toBe("test-project");
    expect(run.status).toBe("running");

    const fetched = await store.getRun(run.id);
    expect(fetched.id).toBe(run.id);
    expect(fetched.project).toBe("test-project");
    expect(fetched.metadata).toEqual({ env: "testing" });
  });

  it("appends events incrementally without holding full state in memory (append event)", async () => {
    const run = await store.createRun({ project: "test-project" });

    const event1: AgentEvent = {
      id: "evt_1",
      runId: run.id,
      timestamp: Date.now(),
      type: "agent.started",
      payload: { project: "test-project" },
    };

    const event2: AgentEvent = {
      id: "evt_2",
      runId: run.id,
      timestamp: Date.now() + 10,
      type: "tool.call",
      payload: { callId: "c1", tool: "test_tool", input: {} },
    };

    await store.appendEvent(event1);
    await store.appendEvent(event2);

    const events: AgentEvent[] = [];
    for await (const evt of store.getEvents(run.id)) {
      events.push(evt);
    }

    expect(events.length).toBe(2);
    expect(events[0].id).toBe("evt_1");
    expect(events[1].id).toBe("evt_2");
  });

  it("lists all stored runs sorted by startedAt descending (list runs)", async () => {
    const run1 = await store.createRun({
      id: "run_alpha",
      project: "proj-1",
      startedAt: 1000,
    });
    const run2 = await store.createRun({
      id: "run_beta",
      project: "proj-2",
      startedAt: 2000,
    });

    const runs = await store.listRuns();
    expect(runs.length).toBe(2);
    expect(runs[0].id).toBe("run_beta"); // most recent first
    expect(runs[1].id).toBe("run_alpha");
  });

  it("handles corrupted JSONL lines gracefully without crashing (corrupted JSONL)", async () => {
    const run = await store.createRun({ project: "test-corrupted" });
    const eventsPath = join(testDir, "runs", run.id, "events.jsonl");

    const validEvent1 = JSON.stringify({
      id: "evt_valid_1",
      runId: run.id,
      timestamp: 100,
      type: "agent.started",
      payload: {},
    });

    const corruptedLine1 = "THIS IS NOT VALID JSON {{{}}";
    const corruptedLine2 = '{"id":"broken","missingRunId":true}'; // invalid schema

    const validEvent2 = JSON.stringify({
      id: "evt_valid_2",
      runId: run.id,
      timestamp: 200,
      type: "file.read",
      payload: { path: "index.ts" },
    });

    const lines = [
      validEvent1,
      corruptedLine1,
      "",
      corruptedLine2,
      validEvent2,
    ].join("\n");

    await fs.writeFile(eventsPath, lines, "utf8");

    const readEvents: AgentEvent[] = [];
    for await (const evt of store.getEvents(run.id)) {
      readEvents.push(evt);
    }

    // Should gracefully skip the 2 corrupted lines and yield the 2 valid events
    expect(readEvents.length).toBe(2);
    expect(readEvents[0].id).toBe("evt_valid_1");
    expect(readEvents[1].id).toBe("evt_valid_2");
  });

  it("throws RunNotFoundError when run does not exist", async () => {
    await expect(store.getRun("non_existent_run")).rejects.toThrow(
      RunNotFoundError
    );
  });
});
