# Tracekit

**Record what your AI coding agent actually did — then look at it.**

[![CI](https://github.com/ANSHSINGH050404/Tracekit/actions/workflows/ci.yml/badge.svg)](https://github.com/ANSHSINGH050404/Tracekit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@tracekit/cli)](https://www.npmjs.com/package/@tracekit/cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## The problem

An agent edits fourteen files, runs the test suite twice, and hands you back a
failure. Now you're debugging a system that left no logs, no diffs, and no
memory of what it did two hundred tool calls ago. You scroll terminal history
and guess.

Tracekit records the run as it happens: every tool call, every shell command
with its output, every file the agent changed with a real unified diff. Then you
open a local UI and read the whole trajectory.

Everything lands in plain files on your machine. No account, no database, no
network calls, no telemetry.

---

## Try it in one command

Tracekit can record **any** command that edits your repo, with no changes to the
agent itself:

```bash
tracekit wrap -- opencode run "fix the failing auth tests"
```

While that runs, Tracekit watches the working tree. Afterwards you have the full
transcript and a diff of every file that changed.

```bash
tracekit ui
```

That opens a local viewer on <http://localhost:4300>.

### From a clone

Nothing is published to npm yet (see [Status](#status)), so run it from source:

```bash
git clone https://github.com/ANSHSINGH050404/Tracekit.git
cd Tracekit
pnpm install
pnpm build

# record any command
pnpm tracekit wrap -- node ./your-agent-command.js

# read the trace
pnpm tracekit ui
```

To record a coding agent, substitute its command. For example:

```bash
pnpm tracekit wrap -- opencode run "fix the failing auth tests"
pnpm tracekit wrap -- aider --message "fix the failing auth tests"
pnpm tracekit wrap -- claude -p "fix the failing auth tests"
```

---

## What you get

- **Zero-instrumentation recording.** `tracekit wrap` runs your agent and derives
  the trace from the process itself. No SDK changes, no plugin API, no cooperation
  required from the agent.
- **Real file diffs.** Tracekit snapshots the working tree before and after, so it
  reports exactly what changed even for an agent that tells you nothing.
- **Secret redaction on the way to disk.** API keys, tokens, private keys, and
  credentialed connection strings are masked before anything is written.
- **A local web viewer.** Chronological timeline, unified diff viewer,
  stdout/stderr panes, token counts, and side-by-side run comparison.
- **Run comparison.** Duration, event counts, tool calls, commands, files changed,
  and token usage, side by side.
- **Crash resilient.** Events stream to disk as they happen. If the agent or your
  machine dies, you still have everything up to that point.
- **Framework-agnostic SDK.** If you own the agent loop, instrument it directly.

---

## Status

**Tracekit is v0.1.0 and early.** It works, but it is not finished. Read this
before forming an opinion:

**Working today**

- `tracekit wrap` — record any command, with before/after worktree diffs
- `tracekit list` / `inspect` / `compare` / `export` / `events`
- `tracekit ui` — local web viewer with timeline, diffs, and comparison
- `@tracekit/sdk` — instrument your own agent loop
- Secret redaction, git snapshots, crash-resilient JSONL storage

**Not built yet**

- **No per-agent adapters.** `wrap` is the integration path today. Tracekit does
  *not* yet parse any agent's internal event stream, so model requests/responses
  and individual tool calls only appear for agents you instrument with the SDK.
  `wrap` records the process, its output, and its file changes. If you want the
  deeper detail for your agent, [write the adapter](CONTRIBUTING.md) — that is the
  contribution we most want.
- **No replay.** Despite the name, Tracekit reconstructs and inspects recorded
  trajectories. It does not re-execute an agent deterministically.
- **No CI assertions.** There is no `tracekit test` for regression-testing agent
  behaviour yet. This is the top item on the roadmap.
- **No npm release.** The release workflow exists but has never run.
- **TUI agents need `--inherit-stdio`.** Full-screen agents take over the
  terminal, so their output cannot be teed. Their file diffs are still recorded.

If you want to steer the roadmap, [open an issue](https://github.com/ANSHSINGH050404/Tracekit/issues).

---

## CLI

```text
tracekit wrap -- <command> [args...]   Record any command and what it changed
tracekit list                          List recorded runs
tracekit inspect <run-id>              Print a run's trajectory and changed files
tracekit compare <run-a> <run-b>       Compare two runs
tracekit ui                            Start the local web viewer
tracekit events <run-id>               Print the raw event stream
tracekit export <run-id> -o out.json   Export a run as JSON
```

Every command accepts `--dir <path>` to read or write traces somewhere other than
`.tracekit/`.

### `tracekit wrap`

```bash
tracekit wrap -- <command> [args...]
```

| Option | Effect |
| --- | --- |
| `-C, --cwd <path>` | Directory to run in and diff (default: current directory) |
| `-t, --task <text>` | Label for the run (default: the command line) |
| `-p, --project <name>` | Project name (default: cwd basename) |
| `--no-git` | Skip the before/after worktree diff |
| `--inherit-stdio` | Give the command the terminal (needed for TUI agents) |
| `--dir <path>` | Where to store the trace |
| `-q, --quiet` | Don't print the summary on exit |

Tracekit's own exit code is the wrapped command's exit code, so `wrap` is safe in
scripts and CI.

### Example output

Real output from `tracekit list`, after recording two runs:

```text
RUN ID                 STATUS         DURATION     TASK
--------------------------------------------------------------------------------------
run_1790525339102_d23ddb completed      31ms         Fix authentication token expiry bug
run_1790525323058_83ac1a completed      36ms         Fix authentication token expiry bug
```

`tracekit inspect <run-id>`:

```text
Tracekit

Run:      run_1790525339102_d23ddb
Project:  auth-service
Status:   completed
Duration: 31ms
Git:      master (75fb394) - dirty

Task:
Fix authentication token expiry bug

Events:
✓ git.snapshot
✓ agent.started
✓ model.request      claude-3-7-sonnet
✓ model.response     505 tokens
✓ file.read
✓ tool.call          read_file
✓ tool.result
✓ command.started    pnpm test:auth
✓ command.stdout
✓ command.stdout
✓ command.stderr
✗ command.finished
✓ file.write         src/auth.ts
✓ tool.call          write_file
✓ tool.result
✓ command.started    pnpm test:auth
✓ command.stdout
✓ command.stdout
✓ command.stdout
✓ command.stdout
✓ command.finished
✓ git.snapshot
✓ agent.finished

Files changed:
  src/auth.ts
```

`tracekit compare <a> <b>` — an SDK-recorded run against a `wrap`-recorded one:

```text
                   Run A (run_179052533910… Run B (run_179052534806…
--------------------------------------------------------------------
Run ID             run_1790525339102_d23ddb run_1790525348066_eca7bc
Status             completed                completed
Task               Fix authentication toke… node -e const fs=requir…
Events             23                       8
Tool calls         2                        0
Commands           2                        1
Duration           31ms                     165ms
Tokens             505                      N/A
Files changed      1                        1
Errors             0                        0
```

---

## SDK

If you own the agent loop, instrument it directly for full-fidelity traces,
including model requests and individual tool calls.

```bash
pnpm add @tracekit/sdk
```

```typescript
import { Replay } from "@tracekit/sdk";

const replay = await Replay.start({
  project: "auth-service",
  task: "Fix authentication token expiry",
  redact: ["JWT_SECRET", "DATABASE_URL"],
});

// Record a tool call and its result, with timing.
const contents = await replay.tool(
  "read_file",
  { path: "src/auth.ts" },
  () => fs.promises.readFile("src/auth.ts", "utf8")
);

// Record a shell command, capturing stdout and stderr as they stream.
// Omit the callback to let Tracekit spawn the command itself.
await replay.command("pnpm test:auth");

// Record a file change with an automatically computed unified diff.
await replay.fileWrite({ path: "src/auth.ts", before: original, after: updated });

// Model calls, for token accounting and prompt inspection.
await replay.modelRequest({ model, provider, messages });
await replay.modelResponse({ model, provider, content, usage });

await replay.finish({ status: "completed", summary: "Fixed token expiry" });
```

Every payload passes through the redactor on the way to disk.

Full reference: [docs/sdk.md](docs/sdk.md) and [docs/event-protocol.md](docs/event-protocol.md).

---

## How it works

```text
.tracekit/
  runs/
    <run-id>/
      run.json        # run metadata, written atomically
      events.jsonl    # append-only event stream
      metadata.json   # extensible config and environment data
```

Human-readable JSON, append-only JSONL, and no database. A trace is a folder you
can read, diff, and commit to `.gitignore` yourself.

- [Architecture](docs/architecture.md) — package layout and data flow
- [Event protocol](docs/event-protocol.md) — every event type and its payload
- [`tracekit wrap`](docs/wrap.md) — recording an agent with no code changes
- [Storage design](docs/storage.md) — file format and crash semantics
- [Redaction engine](docs/redaction.md) — patterns, and their limits
- [Adapters](docs/adapters.md) — the adapter interface and what to build

---

## Roadmap

Roughly, in priority order:

1. `tracekit test` — assert against a recorded run in CI. Files touched, commands
   run, tests green, token budget. The thing that makes agent behaviour
   regression-testable without an API key.
2. Real per-agent adapters, starting with the ones people ask for most.
3. Live tailing — watch a run in `tracekit ui` while the agent is still working.
4. Replay — reconstruct the decision path, not just the event stream.
5. Export adapters to OpenTelemetry, so Tracekit is a source rather than a sink.

---

## Contributing

Adapter contributions are the most wanted thing right now. If you use a coding
agent Tracekit doesn't understand yet, [CONTRIBUTING.md](CONTRIBUTING.md) has a
60-line template.

## Name collision, fair warning

There is an unrelated, older library called `tracekit` on npm (cross-browser
stack traces). **Install Tracekit by its scoped name** —
`@tracekit/sdk`, `@tracekit/cli` — never `npm install tracekit`, which will get
you that other package. The CLI binary is `tracekit` and is only ever installed
as a dependency of `@tracekit/cli`.

## License

MIT © Tracekit Contributors — see [LICENSE](LICENSE).
