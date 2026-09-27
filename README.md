# Agent Replay

Record, inspect and replay AI coding-agent runs locally.

AI coding agents are increasingly capable of modifying entire repositories,
but debugging their behavior is difficult.

Agent Replay records the trajectory of a coding-agent run so developers can
inspect exactly what happened.

---

## Highlights

- ⚡ **Local-First & Database-Free**: Everything is stored in human-readable JSON and append-only JSONL files directly on your machine (`.agent-replay/`).
- 🛡️ **Privacy & Secret Redaction**: Automatically detects and redacts OpenAI, Anthropic, GitHub tokens, AWS keys, and database passwords *before* saving to disk.
- 🔍 **Interactive Visual Timeline**: Local React web viewer displays chronological agent steps, unified file diffs, terminal stdout/stderr logs, and token usage.
- 📊 **Run Comparison**: Compare two runs side-by-side on duration, event count, tool calls, commands, files changed, and token efficiency.
- 🔌 **Framework-Agnostic**: Works with custom agents, Aider, OpenCode, Claude Code, and more through standard event protocols and adapters.
- 💾 **Crash Resilient**: Events stream incrementally to disk. If your agent or machine crashes midway, earlier events remain available.

---

## Installation

```bash
pnpm add @agent-replay/sdk
# or npm install @agent-replay/sdk
```

Install the CLI globally or run it via `pnpm dlx`:

```bash
pnpm add -g @agent-replay/cli
# or execute directly:
npx agent-replay list
```

---

## Quick Start (SDK)

Instrument your agent loop in minutes using `@agent-replay/sdk`:

```typescript
import { Replay } from "@agent-replay/sdk";

// 1. Start a recorded run
const replay = await Replay.start({
  project: "my-service",
  task: "Fix authentication token expiry",
  redact: ["OPENAI_API_KEY", "DATABASE_URL"],
});

// 2. Instrument tools
const code = await replay.tool(
  "read_file",
  { path: "src/auth.ts" },
  async () => fs.promises.readFile("src/auth.ts", "utf8")
);

// 3. Instrument shell commands (captures stdout/stderr)
await replay.command("pnpm test", async (ctx) => {
  await ctx.stdout("Running test suite...\n");
  return 0; // exit code
});

// 4. Record file modifications with unified diffs
await replay.fileWrite({
  path: "src/auth.ts",
  before: originalCode,
  after: modifiedCode,
});

// 5. Finalize the run
await replay.finish({
  status: "completed",
  summary: "Fixed token expiry condition",
});
```

---

## CLI Usage

### List Runs
View all recorded agent sessions:
```bash
agent-replay list
```
```text
RUN ID                 STATUS         DURATION     TASK                                    
-------------------------------------------------------------------------------------------
run_1790522886475_3feb completed      38ms         Fix authentication token expiry bug
run_1790522930903_99ae completed      17ms         Add OAuth2 flow
```

### Inspect a Run
Print the detailed execution trajectory and modified files:
```bash
agent-replay inspect <run-id>
```
```text
Agent Replay

Run:      run_1790522886475_3feb55
Project:  auth-service
Status:   completed
Duration: 3m 42s
Git:      main (c4b2a19) - clean

Task:
Fix authentication token expiry bug

Events:
✓ git.snapshot       
✓ agent.started      
✓ model.request      claude-3-7-sonnet
✓ model.response     505 tokens
✓ file.read          src/auth.ts
✓ tool.call          read_file
✓ tool.result        
✓ command.started    pnpm test
✗ command.finished   (exit 1)
✓ file.write         src/auth.ts
✓ tool.call          write_file
✓ tool.result        
✓ command.started    pnpm test
✓ command.finished   (exit 0)
✓ agent.finished     

Files changed:
  src/auth.ts
```

### Compare Runs
Compare two agent runs on factual execution metrics:
```bash
agent-replay compare <run-a> <run-b>
```
```text
                   Run A (run_1790522886475) Run B (run_1790522930903)
--------------------------------------------------------------------
Run ID             run_1790522886475_3feb55  run_1790522930903_99ae78
Status             completed                 completed               
Task               Fix auth token bug        Add OAuth2 flow         
Events             23                        10                      
Tool calls         2                         1                       
Commands           2                         1                       
Duration           38ms                      17ms                    
Tokens             505                       N/A                     
Files changed      1                         1                       
Errors             0                         0                       
```

### Export Run
Export a run with its full event stream to JSON:
```bash
agent-replay export <run-id> -o export.json
```

### Stream Events
Stream events directly to stdout (supports JSONL with `--json`):
```bash
agent-replay events <run-id> --json
```

### Web UI Viewer
Start the local web viewer to explore runs interactively:
```bash
agent-replay ui
```
Opens `http://localhost:4300` in your default browser.

---

## Local Viewer Features

- 📜 **Interactive Timeline**: Click through every step taken by the agent.
- 🎨 **Unified Diff Viewer**: Review before-and-after file changes with additions and deletions highlighted.
- 💻 **Terminal Log Viewer**: Inspect command execution outputs with stdout and stderr formatting.
- 🤖 **Model Inspection**: View prompts, system messages, model settings, and token metrics.
- ⚖️ **Visual Comparison**: Side-by-side run comparison modal.

---

## Architecture & Storage

Tracekit uses a clean, local-first storage layout:

```text
.agent-replay/
  runs/
    <run-id>/
      run.json        # Atomic run metadata
      events.jsonl    # Append-only incremental event stream
      metadata.json   # Extensible configuration and environment data
```

Read more in our documentation:
- [System Architecture](docs/architecture.md)
- [Event Protocol Specification](docs/event-protocol.md)
- [SDK Guide](docs/sdk.md)
- [Local Storage Design](docs/storage.md)
- [Adapters & OpenCode Integration](docs/adapters.md)
- [Redaction Engine](docs/redaction.md)
- [Contributing](docs/contributing.md)

---

## License

MIT © 2026 Tracekit Contributors
