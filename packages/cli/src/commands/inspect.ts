import { FsReplayStore, formatDuration, type AgentEvent } from "@agent-replay/core";

export interface InspectCommandOptions {
  dir?: string;
  json?: boolean;
}

export async function inspectCommand(
  runId: string,
  options: InspectCommandOptions = {}
): Promise<void> {
  const store = new FsReplayStore({ baseDir: options.dir });
  const run = await store.getRun(runId);

  const events: AgentEvent[] = [];
  for await (const evt of store.getEvents(runId)) {
    events.push(evt);
  }

  if (options.json) {
    console.log(JSON.stringify({ run, events }, null, 2));
    return;
  }

  const durationMs =
    run.finishedAt && run.startedAt ? run.finishedAt - run.startedAt : 0;
  const duration = run.finishedAt ? formatDuration(durationMs) : "in progress";

  console.log("Agent Replay\n");
  console.log(`Run:      ${run.id}`);
  console.log(`Project:  ${run.project}`);
  console.log(`Status:   ${run.status}`);
  console.log(`Duration: ${duration}`);

  if (run.repository) {
    console.log(
      `Git:      ${run.repository.branch || "HEAD"} (${run.repository.commit?.slice(0, 7) || "unknown"}) - ${run.repository.dirty ? "dirty" : "clean"}`
    );
  }

  if (run.task) {
    console.log(`\nTask:\n${run.task}`);
  }

  console.log(`\nEvents:`);
  const filesChanged = new Set<string>();

  for (const evt of events) {
    const payload = (evt.payload ?? {}) as any;
    let icon = "✓";
    let detail = "";

    if (evt.type === "error" || payload.isError) {
      icon = "✗";
    }

    if (evt.type === "command.finished" && payload.exitCode !== 0) {
      icon = "✗";
    }

    if (evt.type === "tool.call") {
      detail = payload.tool || "";
    } else if (evt.type === "command.started") {
      detail = payload.command ? payload.command.slice(0, 45) : "";
    } else if (evt.type === "model.request") {
      detail = payload.model || "";
    } else if (evt.type === "model.response" && payload.usage?.totalTokens) {
      detail = `${payload.usage.totalTokens} tokens`;
    } else if (evt.type === "file.write" && payload.path) {
      filesChanged.add(payload.path);
      detail = payload.path;
    } else if (evt.type === "file.delete" && payload.path) {
      filesChanged.add(payload.path);
      detail = payload.path;
    }

    const typeCol = evt.type.padEnd(18);
    console.log(`${icon} ${typeCol} ${detail}`);
  }

  if (filesChanged.size > 0) {
    console.log(`\nFiles changed:`);
    for (const f of filesChanged) {
      console.log(`  ${f}`);
    }
  }
}
