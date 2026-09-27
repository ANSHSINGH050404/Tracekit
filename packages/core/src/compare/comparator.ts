import type { AgentEvent } from "../events/types.js";
import type { Run } from "../run/types.js";

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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function extractRunMetrics(run: Run, events: AgentEvent[]): RunMetrics {
  const durationMs =
    run.finishedAt && run.startedAt ? Math.max(0, run.finishedAt - run.startedAt) : 0;

  let toolCallsCount = 0;
  let commandsCount = 0;
  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let errorCount = 0;
  const filesChangedSet = new Set<string>();

  for (const event of events) {
    if (event.type === "tool.call") {
      toolCallsCount++;
    } else if (event.type === "command.started") {
      commandsCount++;
    } else if (event.type === "file.write") {
      const payload = event.payload as { path?: string };
      if (payload?.path) filesChangedSet.add(payload.path);
    } else if (event.type === "file.delete") {
      const payload = event.payload as { path?: string };
      if (payload?.path) filesChangedSet.add(payload.path);
    } else if (event.type === "model.response") {
      const payload = event.payload as {
        usage?: {
          totalTokens?: number;
          promptTokens?: number;
          completionTokens?: number;
        };
      };
      if (payload?.usage) {
        if (payload.usage.totalTokens) totalTokens += payload.usage.totalTokens;
        if (payload.usage.promptTokens) promptTokens += payload.usage.promptTokens;
        if (payload.usage.completionTokens) completionTokens += payload.usage.completionTokens;
      }
    } else if (event.type === "error") {
      errorCount++;
    }
  }

  return {
    runId: run.id,
    project: run.project,
    task: run.task,
    status: run.status,
    durationMs,
    durationFormatted: formatDuration(durationMs),
    eventCount: events.length,
    toolCallsCount,
    commandsCount,
    filesChangedCount: filesChangedSet.size,
    filesChanged: Array.from(filesChangedSet),
    totalTokens,
    promptTokens,
    completionTokens,
    errorCount,
  };
}

export function compareRuns(
  runA: Run,
  eventsA: AgentEvent[],
  runB: Run,
  eventsB: AgentEvent[]
): RunComparison {
  return {
    runA: extractRunMetrics(runA, eventsA),
    runB: extractRunMetrics(runB, eventsB),
  };
}

/**
 * Generates an ASCII comparison table.
 */
export function formatComparisonTable(comparison: RunComparison): string {
  const { runA, runB } = comparison;

  const rows: [string, string, string][] = [
    ["Run ID", runA.runId, runB.runId],
    ["Status", runA.status, runB.status],
    ["Task", runA.task ?? "(none)", runB.task ?? "(none)"],
    ["Events", String(runA.eventCount), String(runB.eventCount)],
    ["Tool calls", String(runA.toolCallsCount), String(runB.toolCallsCount)],
    ["Commands", String(runA.commandsCount), String(runB.commandsCount)],
    ["Duration", runA.durationFormatted, runB.durationFormatted],
    ["Tokens", runA.totalTokens > 0 ? String(runA.totalTokens) : "N/A", runB.totalTokens > 0 ? String(runB.totalTokens) : "N/A"],
    ["Files changed", String(runA.filesChangedCount), String(runB.filesChangedCount)],
    ["Errors", String(runA.errorCount), String(runB.errorCount)],
  ];

  const colWidths = [18, 24, 24];
  const formatRow = (col1: string, col2: string, col3: string) => {
    return `${col1.padEnd(colWidths[0])} ${col2.padEnd(colWidths[1])} ${col3.padEnd(colWidths[2])}`;
  };

  const header = formatRow("", `Run A (${runA.runId})`, `Run B (${runB.runId})`);
  const divider = "-".repeat(colWidths[0] + colWidths[1] + colWidths[2] + 2);
  const dataRows = rows.map(([name, valA, valB]) => formatRow(name, valA, valB));

  return [header, divider, ...dataRows].join("\n");
}
