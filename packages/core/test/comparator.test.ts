import { describe, it, expect } from "vitest";
import {
  extractRunMetrics,
  compareRuns,
  formatComparisonTable,
} from "../src/compare/comparator.js";
import type { Run } from "../src/run/types.js";
import type { AgentEvent } from "../src/events/types.js";

describe("Run Comparator", () => {
  const runA: Run = {
    id: "run_A",
    project: "demo",
    task: "Task A",
    startedAt: 1000,
    finishedAt: 223000, // 3m 42s
    status: "completed",
  };

  const eventsA: AgentEvent[] = [
    {
      id: "e1",
      runId: "run_A",
      timestamp: 1010,
      type: "tool.call",
      payload: { callId: "c1", tool: "read_file", input: {} },
    },
    {
      id: "e2",
      runId: "run_A",
      timestamp: 1020,
      type: "tool.call",
      payload: { callId: "c2", tool: "search", input: {} },
    },
    {
      id: "e3",
      runId: "run_A",
      timestamp: 1030,
      type: "command.started",
      payload: { commandId: "cmd1", command: "pnpm test" },
    },
    {
      id: "e4",
      runId: "run_A",
      timestamp: 1040,
      type: "file.write",
      payload: { path: "src/auth.ts" },
    },
    {
      id: "e5",
      runId: "run_A",
      timestamp: 1050,
      type: "model.response",
      payload: { usage: { totalTokens: 18421, promptTokens: 14000, completionTokens: 4421 } },
    },
  ];

  const runB: Run = {
    id: "run_B",
    project: "demo",
    task: "Task B",
    startedAt: 1000,
    finishedAt: 139000, // 2m 18s
    status: "completed",
  };

  const eventsB: AgentEvent[] = [
    {
      id: "eb1",
      runId: "run_B",
      timestamp: 1010,
      type: "tool.call",
      payload: { callId: "cb1", tool: "read_file", input: {} },
    },
    {
      id: "eb2",
      runId: "run_B",
      timestamp: 1020,
      type: "command.started",
      payload: { commandId: "cmdb1", command: "pnpm test" },
    },
    {
      id: "eb3",
      runId: "run_B",
      timestamp: 1030,
      type: "model.response",
      payload: { usage: { totalTokens: 13921 } },
    },
  ];

  it("extracts factual metrics correctly", () => {
    const metricsA = extractRunMetrics(runA, eventsA);
    expect(metricsA.runId).toBe("run_A");
    expect(metricsA.toolCallsCount).toBe(2);
    expect(metricsA.commandsCount).toBe(1);
    expect(metricsA.filesChangedCount).toBe(1);
    expect(metricsA.totalTokens).toBe(18421);
    expect(metricsA.durationFormatted).toBe("3m 42s");
  });

  it("compares two runs and formats factual comparison table", () => {
    const comparison = compareRuns(runA, eventsA, runB, eventsB);
    expect(comparison.runA.totalTokens).toBe(18421);
    expect(comparison.runB.totalTokens).toBe(13921);

    const table = formatComparisonTable(comparison);
    expect(table).toContain("Run A");
    expect(table).toContain("Run B");
    expect(table).toContain("3m 42s");
    expect(table).toContain("2m 18s");
    expect(table).toContain("18421");
    expect(table).toContain("13921");
  });
});
