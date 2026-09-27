# Tracekit SDK Documentation

The Tracekit SDK (`@agent-replay/sdk` / `tracekit`) provides a high-level, developer-friendly interface to record and inspect AI coding agent executions.

## Installation

```bash
pnpm add @agent-replay/sdk
# or
npm install @agent-replay/sdk
```

## Quick Start

```typescript
import { Replay } from "@agent-replay/sdk";

// Initialize a recorded run
const replay = await Replay.start({
  project: "my-service",
  task: "Fix authentication token issue",
  redact: ["OPENAI_API_KEY", "JWT_SECRET"],
});

// Run a tool with automatic start/result recording
const content = await replay.tool(
  "read_file",
  { path: "src/auth.ts" },
  async () => fs.readFile("src/auth.ts", "utf8")
);

// Execute a shell command and capture stdout/stderr
await replay.command("pnpm test", async (ctx) => {
  await ctx.stdout("Running test suite...\n");
  return 0; // exit code
});

// Record a file write with auto diff calculation
await replay.fileWrite({
  path: "src/auth.ts",
  before: oldCode,
  after: newCode,
});

// Finish the run
await replay.finish({
  status: "completed",
  summary: "Fixed token verification bug",
});
```

## API Reference

### `Replay.start(options: ReplayStartOptions): Promise<Replay>`

Starts a new recording session.

#### Options:
- `project: string` (required): Name of the project or service.
- `task?: string`: Natural language task description.
- `runId?: string`: Custom run ID. If omitted, a unique ID is generated.
- `storageDir?: string`: Base directory for storage (defaults to `.agent-replay`).
- `redact?: string[]`: Array of environment variables, secret strings, or object property keys to redact.
- `patterns?: RegExp[]`: Custom regular expressions to detect and scrub secrets.
- `captureGit?: boolean`: Whether to capture initial and final git snapshots (defaults to `true`).
- `metadata?: Record<string, unknown>`: Custom contextual metadata.
- `agent?: { name?: string; version?: string }`: Agent identifier.

### `replay.tool<T>(name: string, input: unknown, fn: () => Promise<T> | T): Promise<T>`

Executes `fn`, automatically recording:
- `tool.call` with arguments and timestamp before execution
- `tool.result` with outputs, duration, and error status after execution

If `fn` throws, `tool.result` records the error details and re-throws the error.

### `replay.command(commandLine: string, fnOrOptions?: ((ctx) => Promise<number | void>) | CommandExecOptions): Promise<CommandResult>`

Supports two modes of command execution:
1. **Interactive streaming callback**:
   ```typescript
   await replay.command("npm test", async (ctx) => {
     await ctx.stdout("Tests running...\n");
     return 0; // return exit code
   });
   ```
2. **Direct child_process execution**:
   ```typescript
   await replay.command("npm test", { cwd: "./backend" });
   ```
   Captures stdout and stderr automatically from the spawned process.

### `replay.fileWrite(params: { path: string; before?: string | null; after?: string; diff?: string }): Promise<AgentEvent>`

Records a file modification.
- Computes SHA-256 hashes of `before` and `after`.
- Computes a standard unified diff between `before` and `after` automatically if `diff` is not explicitly provided.

### `replay.fileRead(path: string, content?: string): Promise<AgentEvent>`

Records a file read with file size and SHA-256 content hash.

### `replay.fileDelete(path: string, previousContent?: string): Promise<AgentEvent>`

Records a file deletion with previous content hash.

### `replay.modelRequest(payload: ModelRequestPayload): Promise<AgentEvent>`

Records LLM prompt, messages, tools, and model configuration.

### `replay.modelResponse(payload: ModelResponsePayload): Promise<AgentEvent>`

Records LLM generated text, tool call requests, duration, and token usage (`promptTokens`, `completionTokens`, `totalTokens`).

### `replay.error(error: unknown, context?: Record<string, unknown>): Promise<AgentEvent>`

Records an error message and stack trace.

### `replay.finish(options?: FinishOptions): Promise<Run>`

Finalizes the run:
- Captures final Git snapshot (detecting changes made during run).
- Emits `agent.finished` event.
- Updates run status (`completed`, `failed`, or `cancelled`) and `finishedAt` timestamp in `run.json`.
