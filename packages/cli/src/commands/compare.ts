import {
  FsReplayStore,
  compareRuns,
  formatComparisonTable,
  type AgentEvent,
} from "@tracekit/core";

export interface CompareCommandOptions {
  dir?: string;
  json?: boolean;
}

export async function compareCommand(
  runAId: string,
  runBId: string,
  options: CompareCommandOptions = {}
): Promise<void> {
  const store = new FsReplayStore({ baseDir: options.dir });

  const runA = await store.getRun(runAId);
  const runB = await store.getRun(runBId);

  const eventsA: AgentEvent[] = [];
  for await (const evt of store.getEvents(runAId)) {
    eventsA.push(evt);
  }

  const eventsB: AgentEvent[] = [];
  for await (const evt of store.getEvents(runBId)) {
    eventsB.push(evt);
  }

  const comparison = compareRuns(runA, eventsA, runB, eventsB);

  if (options.json) {
    console.log(JSON.stringify(comparison, null, 2));
    return;
  }

  console.log(formatComparisonTable(comparison));
}
