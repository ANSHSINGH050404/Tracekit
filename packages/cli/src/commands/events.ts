import { FsReplayStore } from "@agent-replay/core";

export interface EventsCommandOptions {
  dir?: string;
  json?: boolean;
}

export async function eventsCommand(
  runId: string,
  options: EventsCommandOptions = {}
): Promise<void> {
  const store = new FsReplayStore({ baseDir: options.dir });

  for await (const evt of store.getEvents(runId)) {
    if (options.json) {
      console.log(JSON.stringify(evt));
    } else {
      const time = new Date(evt.timestamp).toISOString();
      console.log(`[${time}] ${evt.type.padEnd(18)} (${evt.id})`);
    }
  }
}
