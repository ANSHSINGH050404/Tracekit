import type { Run, AgentEvent, RunComparison } from "./types.js";

export async function fetchRuns(): Promise<Run[]> {
  const res = await fetch("/api/runs");
  if (!res.ok) {
    throw new Error(`Failed to fetch runs: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRun(id: string): Promise<Run> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch run ${id}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRunEvents(id: string): Promise<AgentEvent[]> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}/events`);
  if (!res.ok) {
    throw new Error(`Failed to fetch events for run ${id}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchComparison(
  runAId: string,
  runBId: string
): Promise<RunComparison> {
  const res = await fetch(
    `/api/compare?a=${encodeURIComponent(runAId)}&b=${encodeURIComponent(runBId)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to compare runs: ${res.statusText}`);
  }
  return res.json();
}
