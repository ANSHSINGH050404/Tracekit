---
"@tracekit/cli": minor
"@tracekit/sdk": minor
"@tracekit/core": minor
"@tracekit/viewer": minor
"@tracekit/adapter-generic": minor
---

Rebrand to Tracekit and add `tracekit wrap`

The project is now Tracekit, published under the `@tracekit` scope with a single
`tracekit` binary. Traces live in `.tracekit/` (previously `.agent-replay/`),
which is a breaking change for existing runs. The unscoped `tracekit` re-export
package has been removed — use `@tracekit/sdk`.

New: `tracekit wrap -- <command>` records any coding agent with no
instrumentation. It runs the agent as a subprocess, tees stdout/stderr, and
reconstructs the file diff from a before/after snapshot of the git worktree, so
you get a full trace from an agent that knows nothing about Tracekit. The
child's exit code and terminating signal are propagated, making `wrap` safe in
scripts and CI.

`CommandContext` now exposes `commandId` so callers can correlate output with
the command that produced it. `file.write` events accept an optional
`contentOmitted` field, used when a changed file was binary or over the capture
size limit.

The packages are now publishable: `files`, `publishConfig`, `license`,
`repository`, and `types`-first `exports` maps are set, and `@tracekit/cli`
depends on `@tracekit/viewer` directly so `tracekit ui` works from an install
rather than a monorepo checkout.
