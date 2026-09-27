# Agent Adapters

Tracekit is designed from the ground up to be framework-agnostic. The core library does not depend on any specific coding agent (such as OpenCode, Aider, Claude Code, or Codex).

Instead, Tracekit provides an extensible adapter architecture.

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

## Generic Adapter Example

The `@agent-replay/adapter-generic` package provides a generic adapter that can be connected to any custom agent loop or event bus:

```typescript
import { GenericAgentAdapter } from "@agent-replay/adapter-generic";
import { Replay } from "@agent-replay/sdk";

const adapter = new GenericAgentAdapter("my-agent-adapter");
await adapter.start();

const replay = await Replay.start({
  project: "my-service",
  task: "Refactor database models",
});

// Automatically route adapter events into the active Replay run
adapter.attachToReplay(replay);

// Agent hooks can now emit events directly
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

## OpenCode Integration Architecture

OpenCode executes coding tasks by dispatching tools and managing LLM context. To integrate OpenCode into Tracekit in future versions, an `OpenCodeAdapter` will translate OpenCode session and tool lifecycle hooks into Tracekit's standard event protocol:

```text
┌──────────────────────────────────────────────┐
│                  OpenCode                    │
│   - Session lifecycle                        │
│   - Tool execution hooks                     │
│   - Model request/response events            │
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────▼───────────────┐
       │       OpenCode Adapter        │
       │   - Maps tool execution       │
       │     -> tool.call / tool.result│
       │   - Maps command execution    │
       │     -> command.*              │
       │   - Maps file edits           │
       │     -> file.write (with diff) │
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

### Planned OpenCode Mapping:
- OpenCode task start -> `agent.started`
- OpenCode tool invocation -> `tool.call` & `tool.result`
- OpenCode terminal run -> `command.started`, `command.stdout`, `command.stderr`, `command.finished`
- OpenCode file patching -> `file.write` with unified diff
- OpenCode session completion -> `agent.finished`

This decouples the storage and visualization layers from the evolving internals of external agent frameworks.
