# `tracekit wrap`

`wrap` records any coding agent as a subprocess. It needs no changes to the
agent, no plugin API, and no cooperation — Tracekit watches from the outside.

```bash
tracekit wrap -- <command> [args...]
```

This is the fastest way to get a trace, and the right default unless you need
model calls or per-tool-call detail. For those, use the [SDK](sdk.md) or
[write an adapter](adapters.md).

## Usage

```bash
# OpenCode
tracekit wrap -- opencode run "fix the failing auth tests"

# Aider
tracekit wrap -- aider --message "fix the failing auth tests"

# Claude Code in print mode
tracekit wrap -- claude -p "fix the failing auth tests"

# Anything at all
tracekit wrap -- make test
tracekit wrap -- ./scripts/ci.sh
```

The `--` matters. Everything after it is passed to the child untouched, so the
child's own flags are never parsed by Tracekit.

## Options

| Option | Effect |
| --- | --- |
| `-C, --cwd <path>` | Directory to run in and diff. Default: current directory. |
| `-t, --task <text>` | Label for the run. Default: the full command line. |
| `-p, --project <name>` | Project name. Default: the cwd basename. |
| `--no-git` | Skip the before/after worktree diff entirely. |
| `--inherit-stdio` | Give the child the terminal directly. See limitations below. |
| `--dir <path>` | Where to write the trace. Default: `<cwd>/.tracekit`. |
| `-q, --quiet` | Don't print the run summary when the command exits. |

## What gets recorded

```text
git.snapshot      working tree state before the run
agent.started     project, task, and the agent name inferred from the command
command.started   the full command line
command.stdout    child stdout, coalesced into ~250ms chunks
command.stderr    child stderr, same
command.finished  exit code, duration, and terminating signal
file.write        one per added or modified file, with a computed unified diff
file.delete       one per deleted file
git.snapshot      working tree state after the run
agent.finished    status and a one-line summary
```

Output is deliberately **not** recorded one event per chunk. A chatty agent can
emit thousands of writes per second, so Tracekit batches into 250 ms windows and
flushes before `command.finished` — otherwise the timeline would show output
arriving after the command ended.

## Exit codes

Tracekit exits with the wrapped command's exit code, so `wrap` composes with
`&&`, `||`, and CI steps:

```bash
tracekit wrap -q -- pnpm test || echo "tests failed, trace is in .tracekit/"
```

The run's `status` is derived from the outcome:

| Outcome | `status` |
| --- | --- |
| exit 0 | `completed` |
| non-zero exit | `failed` |
| killed by a signal | `cancelled` |
| command could not be spawned | `failed` (exit 127) |

## How the file diff is derived

Tracekit cannot ask the agent what it changed, so it reconstructs the answer:

1. Before the run, `git ls-files --cached --others --exclude-standard -z`
   enumerates candidate files. This respects `.gitignore` and skips
   `node_modules` without walking the tree.
2. Each candidate is read and SHA-256 hashed.
3. The same happens after the run, and the two maps are compared.
4. Differences become `file.write` or `file.delete` events, and Tracekit computes
   the unified diff from the before/after contents.

The `.tracekit/` directory is always excluded, so recording a run never reports
Tracekit's own writes as agent activity.

**Binary and oversized files.** Files containing NUL bytes, and files over 512 KB,
are recorded as changed but with no content stored. They get a `file.write` event
with `contentOmitted` set instead of a diff. Raise or lower the threshold in
`captureWorktree({ maxFileBytes })` if you need to.

**Pre-existing uncommitted changes.** The diff is against the state at the moment
`wrap` started, not against `HEAD`. If your tree was already dirty, those
pre-existing edits appear in the before-image of any file the agent also touched.
Commit or stash first if that matters.

**Not a git repository.** `wrap` still records the process, its output, and its
exit code — it just cannot compute file changes, and the run's metadata records
`worktreeDiff: false`.

## Limitations

Be aware of these before you rely on it:

- **No model calls, no per-tool-call detail.** Tracekit sees the process, not the
  agent's internals. For that you need the SDK or an adapter.
- **TUI agents need `--inherit-stdio`.** A full-screen agent writes control
  sequences directly to the terminal and will corrupt Tracekit's teed pipe. Pass
  `--inherit-stdio` and Tracekit records the file diff, git state, and exit code,
  but not the output. Note that Tracekit then cannot see the output at all, so
  this is a debugging aid rather than a full trace.
- **No shell interpretation.** The command and its arguments are passed to
  `spawn` directly, with `shell: false`. Pipes, redirects, and globs are your
  shell's job before `wrap` sees them, or invoke them explicitly:
  `tracekit wrap -- bash -lc "pnpm test | tee out.log"`.
- **Terminal input is inherited**, so an interactive agent can prompt you
  normally, but its TUI output is not capturable (see above).
- **Diffing a very large repository costs time and memory**, because every
  candidate file's contents are held in memory twice. `--no-git` skips it.

## Where the trace goes

`<cwd>/.tracekit/runs/<run-id>/` by default — anchored to the project being
recorded, not to wherever you happened to run `tracekit` from. Override with
`--dir`.

Read it back with:

```bash
tracekit inspect <run-id>
tracekit ui
```
