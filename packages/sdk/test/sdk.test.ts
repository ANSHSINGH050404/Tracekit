import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Replay } from "../src/replay.js";
import { FsReplayStore } from "@agent-replay/core";

describe("Replay SDK", () => {
  let testDir: string;
  let store: FsReplayStore;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `tracekit-sdk-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(testDir, { recursive: true });
    store = new FsReplayStore({ baseDir: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("initializes a run with Replay.start() and records agent.started", async () => {
    const replay = await Replay.start({
      project: "my-agent",
      task: "Fix authentication",
      store,
      captureGit: false,
    });

    expect(replay.runId).toBeDefined();
    expect(replay.project).toBe("my-agent");
    expect(replay.task).toBe("Fix authentication");

    const events = [];
    for await (const evt of store.getEvents(replay.runId)) {
      events.push(evt);
    }

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("agent.started");
  });

  it("records arbitrary events with Replay.event() and applies redaction", async () => {
    const replay = await Replay.start({
      project: "my-agent",
      store,
      captureGit: false,
      redact: ["SECRET_KEY"],
    });

    await replay.event({
      type: "custom.metric",
      payload: {
        token: "sk-proj-supersecrettoken123456789012345",
        status: "ok",
      },
    });

    const events = [];
    for await (const evt of store.getEvents(replay.runId)) {
      events.push(evt);
    }

    const customEvt = events.find((e) => e.type === "custom.metric");
    expect(customEvt).toBeDefined();
    expect((customEvt?.payload as any).token).toBe("[REDACTED]");
  });

  it("wraps tool execution with tool.call and tool.result (Replay.tool)", async () => {
    const replay = await Replay.start({
      project: "my-agent",
      store,
      captureGit: false,
    });

    const result = await replay.tool(
      "calculator",
      { a: 5, b: 7 },
      () => 5 + 7
    );

    expect(result).toBe(12);

    const events = [];
    for await (const evt of store.getEvents(replay.runId)) {
      events.push(evt);
    }

    const callEvt = events.find((e) => e.type === "tool.call");
    const resultEvt = events.find((e) => e.type === "tool.result");

    expect(callEvt).toBeDefined();
    expect((callEvt?.payload as any).tool).toBe("calculator");
    expect(resultEvt).toBeDefined();
    expect((resultEvt?.payload as any).output).toBe(12);
    expect((resultEvt?.payload as any).isError).toBe(false);
  });

  it("captures tool error in tool.result when tool function throws", async () => {
    const replay = await Replay.start({
      project: "my-agent",
      store,
      captureGit: false,
    });

    await expect(
      replay.tool("failing_tool", {}, () => {
        throw new Error("Disk full");
      })
    ).rejects.toThrow("Disk full");

    const events = [];
    for await (const evt of store.getEvents(replay.runId)) {
      events.push(evt);
    }

    const resultEvt = events.find((e) => e.type === "tool.result");
    expect(resultEvt).toBeDefined();
    expect((resultEvt?.payload as any).isError).toBe(true);
    expect((resultEvt?.payload as any).output.error).toBe("Disk full");
  });

  it("records command start, stdout, stderr, and finish with Replay.command()", async () => {
    const replay = await Replay.start({
      project: "my-agent",
      store,
      captureGit: false,
    });

    const cmdResult = await replay.command("pnpm test", async (ctx) => {
      await ctx.stdout("Tests started...\n");
      await ctx.stderr("Warning: test deprecated\n");
      return 0;
    });

    expect(cmdResult.exitCode).toBe(0);
    expect(cmdResult.stdout).toContain("Tests started");
    expect(cmdResult.stderr).toContain("Warning");

    const events = [];
    for await (const evt of store.getEvents(replay.runId)) {
      events.push(evt);
    }

    expect(events.some((e) => e.type === "command.started")).toBe(true);
    expect(events.some((e) => e.type === "command.stdout")).toBe(true);
    expect(events.some((e) => e.type === "command.stderr")).toBe(true);
    expect(events.some((e) => e.type === "command.finished")).toBe(true);
  });

  it("handles filesystem instrumentation (fileRead, fileWrite, fileDelete)", async () => {
    const replay = await Replay.start({
      project: "my-agent",
      store,
      captureGit: false,
    });

    await replay.fileRead("src/index.ts", "const x = 1;");
    await replay.fileWrite({
      path: "src/index.ts",
      before: "const x = 1;",
      after: "const x = 2;",
    });
    await replay.fileDelete("src/old.ts", "content");

    const events = [];
    for await (const evt of store.getEvents(replay.runId)) {
      events.push(evt);
    }

    const readEvt = events.find((e) => e.type === "file.read");
    const writeEvt = events.find((e) => e.type === "file.write");
    const delEvt = events.find((e) => e.type === "file.delete");

    expect(readEvt).toBeDefined();
    expect(writeEvt).toBeDefined();
    expect((writeEvt?.payload as any).diff).toContain("-const x = 1;");
    expect((writeEvt?.payload as any).diff).toContain("+const x = 2;");
    expect(delEvt).toBeDefined();
  });

  it("finalizes run with Replay.finish() and updates status in store", async () => {
    const replay = await Replay.start({
      project: "my-agent",
      store,
      captureGit: false,
    });

    const finished = await replay.finish({
      status: "completed",
      summary: "All tasks completed",
    });

    expect(finished.status).toBe("completed");
    expect(finished.finishedAt).toBeDefined();

    const fromStore = await store.getRun(replay.runId);
    expect(fromStore.status).toBe("completed");
    expect(fromStore.finishedAt).toBeDefined();
  });
});
