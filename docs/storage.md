# Tracekit Local Storage Specification

Tracekit adheres to a strictly local-first, zero-database persistence architecture.

## Directory Structure

By default, Tracekit stores runs in `.tracekit/` relative to the current working directory (or a custom path passed via `--dir` / `storageDir`):

```text
.tracekit/
  runs/
    <run-id>/
      run.json
      events.jsonl
      metadata.json
```

### 1. `run.json`
Contains run state metadata:
```json
{
  "id": "run_1790522886475_3feb55",
  "project": "auth-service",
  "task": "Fix authentication token expiry bug",
  "startedAt": 1790522886475,
  "finishedAt": 1790522886513,
  "status": "completed",
  "repository": {
    "root": "D:/open-source/Tracekit",
    "dirty": true
  },
  "metadata": {}
}
```
Updated atomically via temporary file writes (`run.json.tmp.<ts>.<hex>`) and atomic replacement to prevent partial writes.

### 2. `events.jsonl`
Append-only JSON Lines file containing the raw event stream.

Each line is a single JSON-encoded `AgentEvent`:
```jsonl
{"id":"evt_1","runId":"run_100","timestamp":1790522886481,"type":"git.snapshot","payload":{...}}
{"id":"evt_2","runId":"run_100","timestamp":1790522886482,"type":"agent.started","payload":{...}}
```

#### Crash Resilience & Incremental Persistence
Events are appended immediately as they occur. If an agent process terminates unexpectedly, loses power, or crashes:
- All events written up to that point remain intact on disk.
- Memory buffering is avoided; events are not held in memory.
- `getEvents(runId)` streams events using async iterables (`AsyncIterable<AgentEvent>`), allowing processing of large traces without high memory consumption.

#### Fault Tolerance & Corrupted Lines
If a line in `events.jsonl` becomes truncated or corrupted due to an abnormal process termination:
- The parser safely skips the invalid line.
- Remaining valid events are yielded without throwing an unrecoverable exception.

### 3. `metadata.json`
Stores additional user-defined context, agent hyperparameters, environment flags, and configuration snapshots.

## `ReplayStore` Interface

```typescript
interface ReplayStore {
  createRun(params: CreateRunParams): Promise<Run>;
  updateRun(runId: string, updates: Partial<Run>): Promise<Run>;
  appendEvent(event: AgentEvent): Promise<void>;
  getRun(runId: string): Promise<Run>;
  getEvents(runId: string): AsyncIterable<AgentEvent>;
  listRuns(): Promise<Run[]>;
}
```
