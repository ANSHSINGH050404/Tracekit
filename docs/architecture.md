# Tracekit Architecture

Tracekit is a local-first observability and replay infrastructure layer designed for AI coding agents.

## Core Design Principles

1. **Local-First & Database-Free**: All execution traces, runs, and metadata are saved directly to the local filesystem using structured JSON and append-only JSONL files (`.tracekit/`). No external databases, no cloud accounts, and no mandatory network connections.
2. **Two Integration Paths**: Tracekit does not depend on any specific agent implementation. You can either wrap an agent as a subprocess with `tracekit wrap` (no cooperation required), or instrument your own agent loop with the SDK. A standard event protocol and an adapter interface sit underneath both.
3. **Privacy & Redaction by Default**: Secrets, API keys, database credentials, and authentication tokens are automatically detected and redacted *before* any data reaches persistent disk storage.
4. **Append-Only Event Stream**: Events are streamed incrementally. If an agent crashes, gets aborted, or throws an unhandled exception, every event recorded up to that instant remains available and inspectable.
5. **Trace Replay (Not Deterministic LLM Execution)**: Replay means reconstructing and inspecting the exact recorded execution trajectory, timeline, file diffs, command outputs, and token counts.

## High-Level System Architecture

There are two ways a trace gets built, and both end up in the same store.

```text
   ┌───────────────────────────┐        ┌───────────────────────────┐
   │  Path A: tracekit wrap    │        │  Path B: @tracekit/sdk    │
   │  (no cooperation needed)  │        │  (full fidelity)          │
   │                           │        │                           │
   │  spawns the agent as a    │        │  you wrap tool calls,     │
   │  subprocess, tees its     │        │  shell commands, file     │
   │  output, diffs the git    │        │  writes, and model calls  │
   │  worktree before/after    │        │                           │
   └─────────────┬─────────────┘        └─────────────┬─────────────┘
                 │                                   │
                 └───────────────┬───────────────────┘
                                 │
             ┌───────────────────▼───────────────────┐
             │  Worktree differ ──▶ Event Protocol  │
             │  (core/worktree)     (core/events)    │
             └───────────────────┬───────────────────┘
                                 │
             ┌───────────────────▼───────────────────┐
             │        Redaction Engine              │
             │  (Deep secret scrubbing in memory)   │
             └───────────────────┬───────────────────┘
                                 │
             ┌───────────────────▼───────────────────┐
             │             FsReplayStore            │
             │  .tracekit/runs/<run-id>/            │
             │    ├── run.json (atomic)             │
             │    ├── metadata.json (atomic)        │
             │    └── events.jsonl (append-only)    │
             └──────────────┬──────────────┬────────┘
                            │              │
              ┌─────────────▼────┐    ┌────▼─────────────┐
              │ CLI (Terminal)   │    │ Local Web Viewer │
              │ tracekit         │    │ (React + Vite)   │
              │ - wrap            │    │ - Interactive    │
              │ - list            │    │   timeline       │
              │ - inspect         │    │ - File diffs     │
              │ - compare         │    │ - Term output    │
              │ - export          │    │ - Token metrics  │
              │ - events          │    │ - Run comparison │
              │ - ui              │    │                  │
              └──────────────────┘    └──────────────────┘
```

## Monorepo Structure

- `packages/core`: Standard event schemas (Zod), run model, unified diff calculation, SHA-256 content hashing, Git snapshot inspector, redaction engine, worktree capture/diff, run comparison, and `FsReplayStore`.
- `packages/sdk`: Developer-facing SDK (`Replay` / `Tracekit`), wrapping tools, shell commands, file operations, model requests, and run lifecycle.
- `packages/cli`: Command-line interface exposing the `tracekit` binary (`wrap`, `list`, `inspect`, `compare`, `export`, `events`, `ui`). Depends on `@tracekit/viewer` so the UI ships with the CLI.
- `packages/viewer`: Vite + React web interface providing interactive visual timeline, file diff syntax rendering, command logs, and run comparison. Published as static assets, not a JS library.
- `adapters/generic`: Standard `AgentAdapter` interface and `GenericAgentAdapter` bridge.
- `examples/`: End-to-end runnable demonstration of a simulated coding agent workflow.
- `docs/`: Comprehensive technical documentation.

## The Worktree Differ

`tracekit wrap` cannot ask an agent what it changed, so it reconstructs the
answer from git:

1. `listTrackedFiles` runs `git ls-files --cached --others --exclude-standard -z`
   to enumerate candidates, which respects `.gitignore` and skips `node_modules`
   without walking the tree.
2. `captureWorktree` reads and SHA-256 hashes each candidate. Binary files and
   files over `DEFAULT_MAX_FILE_BYTES` (512 KB) are recorded as changed but with
   `content: null`, so a trace never silently swallows a large diff.
3. `diffWorktree` compares the two snapshots and yields `added` / `modified` /
   `deleted` changes, sorted by path for stable output.
4. The CLI turns each change into a `file.write` (with a computed unified diff) or
   a `file.delete` event.

The `.tracekit/` directory itself is always excluded, so recording a run never
reports Tracekit's own writes as agent activity.
