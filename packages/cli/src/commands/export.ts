import { promises as fs } from "node:fs";
import { FsReplayStore, type AgentEvent } from "@agent-replay/core";

export interface ExportCommandOptions {
  dir?: string;
  output?: string;
}

export async function exportCommand(
  runId: string,
  options: ExportCommandOptions = {}
): Promise<void> {
  const store = new FsReplayStore({ baseDir: options.dir });
  const run = await store.getRun(runId);

  const events: AgentEvent[] = [];
  for await (const evt of store.getEvents(runId)) {
    events.push(evt);
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    run,
    events,
  };

  const jsonStr = JSON.stringify(exportData, null, 2);

  if (options.output) {
    await fs.writeFile(options.output, jsonStr, "utf8");
    console.log(`Exported run ${runId} to ${options.output}`);
  } else {
    console.log(jsonStr);
  }
}
