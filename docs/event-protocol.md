# Tracekit Event Protocol Specification

The Tracekit Event Protocol defines a typed, JSON-serializable event stream designed to capture the trajectory of autonomous and semi-autonomous AI coding agents.

## Base Event Schema

Every event MUST adhere to the following base structure:

```typescript
interface BaseEvent {
  id: string;        // Unique event ID (e.g. evt_1790522886481_c90d84)
  runId: string;     // Unique identifier of the associated Run
  timestamp: number; // Unix epoch millisecond timestamp
  type: string;      // Canonical event type discriminator
}
```

## Core Event Types

### 1. `agent.started`
Recorded when an agent starts a task.

```typescript
interface AgentStartedEvent extends BaseEvent {
  type: "agent.started";
  payload: {
    task?: string;
    project?: string;
    agent?: {
      name?: string;
      version?: string;
    };
    metadata?: Record<string, unknown>;
  };
}
```

### 2. `agent.finished`
Recorded when an agent concludes or terminates a task.

```typescript
interface AgentFinishedEvent extends BaseEvent {
  type: "agent.finished";
  payload: {
    status: "completed" | "failed" | "cancelled";
    duration?: number; // In milliseconds
    summary?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  };
}
```

### 3. `model.request`
Captured when the agent invokes an LLM.

```typescript
interface ModelRequestEvent extends BaseEvent {
  type: "model.request";
  payload: {
    callId?: string;
    model?: string;
    provider?: string;
    messages?: unknown[];
    systemPrompt?: string;
    tools?: unknown[];
    parameters?: Record<string, unknown>;
  };
}
```

### 4. `model.response`
Captured when the LLM returns an answer or tool call invitations.

```typescript
interface ModelResponseEvent extends BaseEvent {
  type: "model.response";
  payload: {
    callId?: string;
    model?: string;
    provider?: string;
    content?: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments?: unknown;
    }>;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      cost?: number;
    };
    duration?: number;
  };
}
```

### 5. `tool.call` & `tool.result`
Recorded around any tool invocation.

```typescript
interface ToolCallEvent extends BaseEvent {
  type: "tool.call";
  payload: {
    callId: string;
    tool: string;
    input: unknown;
  };
}

interface ToolResultEvent extends BaseEvent {
  type: "tool.result";
  payload: {
    callId: string;
    tool: string;
    output: unknown;
    isError?: boolean;
    duration?: number;
  };
}
```

### 6. Shell Commands (`command.*`)
Streams command execution, output, and termination.

```typescript
interface CommandStartedEvent extends BaseEvent {
  type: "command.started";
  payload: {
    commandId: string;
    command: string;
    cwd?: string;
    env?: Record<string, string>;
  };
}

interface CommandStdoutEvent extends BaseEvent {
  type: "command.stdout";
  payload: {
    commandId: string;
    data: string;
  };
}

interface CommandStderrEvent extends BaseEvent {
  type: "command.stderr";
  payload: {
    commandId: string;
    data: string;
  };
}

interface CommandFinishedEvent extends BaseEvent {
  type: "command.finished";
  payload: {
    commandId: string;
    command?: string;
    exitCode: number | null;
    duration?: number;
  };
}
```

### 7. Filesystem Events (`file.*`)
Captures modifications, reads, and deletions. For file writes, unified diffs and SHA-256 hashes are preserved without duplicating huge files unnecessarily.

```typescript
interface FileReadEvent extends BaseEvent {
  type: "file.read";
  payload: {
    path: string;
    content?: string;
    hash?: string;
    size?: number;
  };
}

interface FileWriteEvent extends BaseEvent {
  type: "file.write";
  payload: {
    path: string;
    before?: string | null;
    after?: string;
    diff?: string;
    beforeHash?: string | null;
    afterHash?: string;
  };
}

interface FileDeleteEvent extends BaseEvent {
  type: "file.delete";
  payload: {
    path: string;
    previousHash?: string;
  };
}
```

### 8. `git.snapshot`
Captures repository state safely using read-only Git commands.

```typescript
interface GitSnapshotEvent extends BaseEvent {
  type: "git.snapshot";
  payload: {
    root: string;
    branch?: string;
    commit?: string;
    dirty: boolean;
    statusSummary?: string;
    phase?: "start" | "end" | "checkpoint";
  };
}
```

### 9. `error`
Captures unexpected exceptions and stack traces.

```typescript
interface ErrorEvent extends BaseEvent {
  type: "error";
  payload: {
    message: string;
    name?: string;
    stack?: string;
    context?: Record<string, unknown>;
  };
}
```

## Schema Validation

Tracekit validates incoming and stored events using Zod schemas via `validateEvent(data)` and `safeValidateEvent(data)`. Extensible custom events conforming to `BaseEvent` are accepted and preserved under generic payloads.
