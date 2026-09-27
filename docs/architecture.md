# Tracekit Architecture

**Tracekit** (Agent Replay) is a local-first observability and replay infrastructure layer designed for AI coding agents.

## Core Design Principles

1. **Local-First & Database-Free**: All execution traces, runs, and metadata are saved directly to the local filesystem using structured JSON and append-only JSONL files (`.agent-replay/`). No external databases, no cloud accounts, and no mandatory network connections.
2. **Framework-Agnostic**: Tracekit does not depend on any specific agent implementation (Aider, OpenCode, Claude Code, custom agent loops). Instead, it defines a standard event protocol and adapter interface.
3. **Privacy & Redaction by Default**: Secrets, API keys, database credentials, and authentication tokens are automatically detected and redacted *before* any data reaches persistent disk storage.
4. **Append-Only Event Stream**: Events are streamed incrementally. If an agent crashes, gets aborted, or throws an unhandled exception, every event recorded up to that instant remains available and inspectable.
5. **Trace Replay (Not Deterministic LLM Execution)**: Replay means reconstructing and inspecting the exact recorded execution trajectory, timeline, file diffs, command outputs, and token counts.

## High-Level System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      Coding Agent                           │
│       (OpenCode, Aider, Claude Code, Custom Loop)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │  Tracekit SDK / Generic Adapter     │
            │  - Tool instrumentation             │
            │  - Shell command stream capture     │
            │  - Filesystem diff & hash engine    │
            │  - Git snapshot inspector           │
            └──────────────────┬──────────────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │        Redaction Engine             │
            │  (Deep secret scrubbing in memory)  │
            └──────────────────┬──────────────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │        FsReplayStore                │
            │  .agent-replay/runs/<run-id>/       │
            │    ├── run.json (atomic)            │
            │    ├── metadata.json (atomic)       │
            │    └── events.jsonl (append-only)   │
            └──────────────┬──────────────┬───────┘
                           │              │
             ┌─────────────▼────┐    ┌────▼─────────────┐
             │ CLI (Terminal)   │    │ Local Web Viewer │
             │ agent-replay     │    │ (React + Vite)   │
             │ - list           │    │ - Interactive    │
             │ - inspect        │    │   timeline       │
             │ - compare        │    │ - File diffs     │
             │ - export         │    │ - Term output    │
             │ - events         │    │ - Token metrics  │
             └──────────────────┘    └──────────────────┘
```

## Monorepo Structure

- `packages/core`: Standard event schemas (Zod), run model, unified diff calculation, SHA-256 content hashing, Git snapshot inspector, redaction engine, and `FsReplayStore`.
- `packages/sdk`: Developer-facing SDK (`Replay` / `Tracekit`), wrapping tools, shell commands, file operations, model requests, and run lifecycle.
- `packages/cli`: Command-line interface with `agent-replay` and `tracekit` binaries (`list`, `inspect`, `export`, `events`, `compare`, `ui`).
- `packages/viewer`: Vite + React web interface providing interactive visual timeline, file diff syntax rendering, command logs, and run comparison.
- `adapters/generic`: Standard `AgentAdapter` interface and `GenericAgentAdapter` bridge.
- `examples/`: End-to-end runnable demonstration of a simulated coding agent workflow.
- `docs/`: Comprehensive technical documentation.
