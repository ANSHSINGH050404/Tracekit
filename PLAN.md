# Tracekit Implementation Plan

## Architecture Overview
A modular TypeScript monorepo using pnpm workspaces:
- `packages/core`: Event schema (Zod), Run model, Git snapshot utilities, Diff generator, Redaction engine, Storage interface & FsReplayStore.
- `packages/sdk`: High-level developer SDK (`Replay` / `Tracekit`), tool wrappers, command executor/streamer, filesystem helpers, lifecycle management.
- `packages/cli`: `agent-replay` and `tracekit` command-line tools (`list`, `inspect`, `export`, `events`, `compare`, `ui`), tabular formatters, diff rendering.
- `packages/viewer`: Vite + React + Tailwind/CSS modern dark-themed local UI for exploring runs, visual timelines, diff viewer, stdout/stderr logs, token usage.
- `adapters/generic`: AgentAdapter interface and GenericAgentAdapter implementation.
- `examples/`: Runnable agent simulation example showing how to record an agent task.
- `docs/`: Comprehensive documentation suite.

## Phase 1: Workspace & Build Configuration
1. Initialize Git repository in `Tracekit`.
2. Root `package.json`, `pnpm-workspace.yaml`, root `tsconfig.json`.
3. Configure Vitest and TypeScript build configs with ESM.

## Phase 2: Core Package (`@agent-replay/core` / `@tracekit/core`)
1. Event Protocol: Zod schemas & TypeScript types for:
   - BaseEvent
   - agent.started, agent.finished
   - model.request, model.response
   - tool.call, tool.result
   - command.started, command.stdout, command.stderr, command.finished
   - file.read, file.write, file.delete
   - git.snapshot
   - error
2. Redaction engine:
   - Default secret regexes (OpenAI, Anthropic, GitHub, DB URLs, Slack, generic keys)
   - Custom regex support and explicit secret string/key redaction
   - Deep object redactor that transforms payloads recursively
3. Git inspector:
   - Extract root, branch, commit, dirty state safely using Node child_process
   - Graceful fallback when not in a git repo
4. Diff utility:
   - Unified line diff computation for before/after file content
   - Hash calculations (SHA-256)
5. Storage:
   - `ReplayStore` interface
   - `FsReplayStore`: Directory structure `.agent-replay/runs/<run-id>/`
   - Atomic file writes for `run.json`
   - Incremental streaming append for `events.jsonl`
   - Corrupted JSONL line handling (skips malformed lines gracefully)
   - `listRuns`, `getRun`, `getEvents`, `updateRun`
6. Run comparison engine:
   - Statistical comparator calculating duration, event counts, tool calls, commands, files modified, token usage.

## Phase 3: SDK Package (`@agent-replay/sdk`)
1. `Replay` / `Tracekit` class:
   - `Replay.start(options)`: initializes store, captures initial git snapshot, starts run, emits `agent.started`.
   - `replay.event(type, payload)`: validates, redacts, writes to store.
   - `replay.tool(name, input, fn)`: executes function, measures duration, records `tool.call` and `tool.result` or `error`.
   - `replay.command(commandLine, execOrFn, options)`: supports wrapping child_process or custom callback, captures stdout/stderr chunks and exit code.
   - `replay.fileRead(path, content)`
   - `replay.fileWrite({ path, before, after })`
   - `replay.fileDelete(path)`
   - `replay.modelRequest(payload)`
   - `replay.modelResponse(payload)`
   - `replay.error(err, context)`
   - `replay.finish(status, metadata)`: captures final git snapshot, updates run status, emits `agent.finished`.

## Phase 4: Generic Adapter (`adapters/generic`)
1. `AgentAdapter` interface.
2. `GenericAgentAdapter` implementation.
3. Event normalization and bridge into ReplayStore.

## Phase 5: Viewer Package (`packages/viewer`)
1. React + Vite setup.
2. Clean, high-density modern developer UI:
   - Runs sidebar/list with search, status filters, duration, timestamps.
   - Detail view with run summary, tokens, repository status, git commits.
   - Chronological interactive timeline with distinct icon/color for each event category.
   - Diff view with line additions/deletions.
   - Terminal stdout/stderr log viewer for command events.
   - Raw JSON inspector modal/tab for any event.
   - Run comparison view.
3. Build Vite bundle to static dist assets.

## Phase 6: CLI Package (`@agent-replay/cli`)
1. Commander-based CLI with aliases `agent-replay` and `tracekit`.
2. Commands:
   - `list`: formatted table of runs.
   - `inspect <run-id>`: pretty summary with event tree and files changed.
   - `export <run-id>`: JSON export of run + events.
   - `events <run-id>`: formatted or raw event stream.
   - `compare <run-a> <run-b>`: comparison table.
   - `ui`: starts local embedded HTTP server hosting viewer static files + API endpoints (`/api/runs`, `/api/runs/:id`, `/api/runs/:id/events`), opens browser.

## Phase 7: Examples & Documentation
1. `examples/demo-agent.ts`: runnable script recording a realistic agent debugging task.
2. Documentation:
   - `docs/architecture.md`
   - `docs/event-protocol.md`
   - `docs/sdk.md`
   - `docs/storage.md`
   - `docs/adapters.md`
   - `docs/redaction.md`
   - `docs/contributing.md`
3. Comprehensive `README.md` and `LICENSE`.

## Phase 8: Testing & Verification
1. Comprehensive Vitest suite for:
   - Event validation (Zod schemas, edge cases)
   - Redaction (deep objects, regex, API keys, tokens)
   - Git inspector (clean, dirty, non-git)
   - Filesystem storage (concurrency, corrupted JSONL, atomic updates)
   - SDK lifecycle, tool execution, command execution
   - Comparison engine
   - CLI commands
2. Build verification: `pnpm build` across all packages.
3. End-to-end test with example run and CLI verification.
