# Agent Adapters

> **Status: no agent-specific adapters exist yet.** The only adapter in this
> repository is `adapters/generic`, which is a reference implementation and a
> template, not an integration. If you want Tracekit to understand your agent,
> [writing that adapter is the contribution we most want](../CONTRIBUTING.md).

Tracekit's core does not depend on any specific coding agent. There are two ways
to connect an agent to it, and you should pick based on how much detail you need.

## Which path should I use?

| | `tracekit wrap` | `@tracekit/sdk` | An adapter |
| --- | --- | --- | --- |
| Setup | none | instrument your loop | write a module |
| Works with an agent you don't control | yes | no | yes |
| Command output | yes | yes | yes |
| File changes, with diffs | yes (derived from git) | yes (explicit) | yes |
| Git snapshots | yes | yes | yes |
| Model requests / responses | **no** | yes | yes |
| Individual tool calls | **no** | yes | yes |
| Token accounting | **no** | yes | yes |

### Path 1: `tracekit wrap` (start here)

No code changes and no cooperation from the agent. Tracekit runs it as a
subprocess and reconstructs the trace from the outside. See
[wrap.md](wrap.md).

```bash
tracekit wrap -- opencode run "fix the failing auth tests"
```

You get the process transcript, the working-tree diff, git state, and exit code.
You do **not** get model calls or individual tool calls, because Tracekit cannot
see inside the agent.

### Path 2: `@tracekit/sdk` (full fidelity)

If you own the agent loop, instrument it. See [sdk.md](sdk.md).

### Path 3: an adapter (best fidelity, most work)

An adapter translates one agent's native events into Tracekit's event protocol.
Use this when you want model calls and tool calls from an agent you don't own,
and you can hook its event stream or plugin API.

## The `AgentAdapter` Interface

```typescript
export interface AgentAdapter {
  /**
   * Human-readable name of the adapter.
   */
  readonly name: string;

  /**
   * Initializes or connects the adapter to the underlying agent.
   */
  start(): Promise<void>;

  /**
   * Stops the adapter and cleans up any subscriptions.
   */
  stop(): Promise<void>;

  /**
   * Registers a callback for events emitted by the agent adapter.
   */
  onEvent(handler: (event: AgentEvent) => void): void;
}
```

## Reference implementation

`@tracekit/adapter-generic` is a complete, working adapter in about 60 lines. It
owns no agent logic: you call `emitEvent` from your own hooks and Tracekit handles
validation, redaction, and persistence.

```typescript
import { GenericAgentAdapter } from "@tracekit/adapter-generic";
import { Replay } from "@tracekit/sdk";

const adapter = new GenericAgentAdapter("my-agent-adapter");
await adapter.start();

const replay = await Replay.start({
  project: "my-service",
  task: "Refactor database models",
});

// Route adapter events into the active run automatically.
adapter.attachToReplay(replay);

adapter.emitEvent({
  id: "evt_101",
  runId: replay.runId,
  timestamp: Date.now(),
  type: "tool.call",
  payload: {
    callId: "call_1",
    tool: "ripgrep",
    input: { query: "UserSchema" },
  },
});
```

Copy this directory, change the `emitEvent` calls to come from your agent's
hooks, and you have an adapter.

## Writing an adapter for a real agent

The shape every adapter takes:

```text
┌──────────────────────────────────────────────┐
│                  Your Agent                 │
│   - Session lifecycle                        │
│   - Tool execution hooks                     │
│   - Model request/response events            │
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────▼───────────────┐
       │        Your Adapter           │
       │   - Maps tool execution       │
       │     -> tool.call / tool.result│
       │   - Maps command execution    │
       │     -> command.*              │
       │   - Maps file edits           │
       │     -> file.write (with diff) │
       │   - Maps model calls          │
       │     -> model.request/response │
       └───────────────┬───────────────┘
                       │
       ┌───────────────▼───────────────┐
       │ Tracekit Core Event Protocol  │
       └───────────────┬───────────────┘
                       │
       ┌───────────────▼───────────────┐
       │     FsReplayStore (Disk)      │
       └───────────────────────────────┘
```

Suggested mapping:

| Agent event | Tracekit event |
| --- | --- |
| Session / task start | `agent.started` |
| Tool invocation | `tool.call` |
| Tool result | `tool.result` (set `isError`) |
| Shell command | `command.started` → `command.stdout` / `command.stderr` → `command.finished` |
| File patch | `file.write` (pass `before` and `after` so the diff is computed for you) |
| File delete | `file.delete` |
| LLM call | `model.request` / `model.response` (pass `usage` for token counts) |
| Unhandled error | `error` |
| Session end | `agent.finished` |

Two rules:

1. **Don't reimplement redaction.** Route everything through `Replay.event` or
   `attachToReplay`; the redactor runs there, not in the adapter.
2. **Don't guess at an agent's API.** Read its source or docs and verify the event
   shape with a test. An adapter built on guessed internals breaks silently and is
   worse than no adapter.

## Roadmap

Adapters for specific agents are planned, ordered by demand. Open an issue to
claim one — the template above is all you need to start.

