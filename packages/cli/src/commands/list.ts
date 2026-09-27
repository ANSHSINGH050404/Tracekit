import { FsReplayStore, formatDuration } from "@agent-replay/core";

export interface ListCommandOptions {
  dir?: string;
  json?: boolean;
}

export async function listCommand(options: ListCommandOptions = {}): Promise<void> {
  const store = new FsReplayStore({ baseDir: options.dir });
  const runs = await store.listRuns();

  if (options.json) {
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  if (runs.length === 0) {
    console.log("No agent runs found.");
    return;
  }

  const colRunId = 22;
  const colStatus = 14;
  const colDuration = 12;
  const colTask = 40;

  const header = `${"RUN ID".padEnd(colRunId)} ${"STATUS".padEnd(colStatus)} ${"DURATION".padEnd(colDuration)} ${"TASK".padEnd(colTask)}`;
  const divider = "-".repeat(colRunId + colStatus + colDuration + colTask + 3);

  console.log(header);
  console.log(divider);

  for (const run of runs) {
    const durationMs =
      run.finishedAt && run.startedAt ? run.finishedAt - run.startedAt : 0;
    const duration = run.finishedAt ? formatDuration(durationMs) : "running";
    const task = run.task ? (run.task.length > 38 ? run.task.slice(0, 35) + "..." : run.task) : "(no task)";

    const row = `${run.id.padEnd(colRunId)} ${run.status.padEnd(colStatus)} ${duration.padEnd(colDuration)} ${task}`;
    console.log(row);
  }
}
