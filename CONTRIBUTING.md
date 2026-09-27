# Contributing to Tracekit

Thanks for your interest. Tracekit is small and early, and the most valuable
contributions right now are **adapters** — glue code that records a coding agent
you already use.

## The one contribution we most want

**Write an adapter for your agent.** If you use Claude Code, OpenCode, Aider,
Codex, Cursor, Cline, Goose, or anything else that edits a repo, we want
`tracekit wrap` to understand it.

The bar is deliberately low. A useful adapter is a small module that translates
one agent's native events into [Tracekit's event protocol](docs/event-protocol.md).
It does not need to be exhaustive on day one — recording tool calls, shell
commands, and file writes is already more than anyone gets today.

Start from [`adapters/generic`](adapters/generic), which is a complete working
example in about 60 lines.

## Setup

Requires Node.js >= 20 and pnpm.

```bash
git clone https://github.com/ANSHSINGH050404/Tracekit.git
cd Tracekit
pnpm install
pnpm build
pnpm test
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm build` | Build every workspace package |
| `pnpm test` | Run the Vitest suite across all packages |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm --filter @tracekit/viewer dev` | Vite dev server for the viewer |
| `pnpm changeset` | Record a changeset for your change |

## Adding a changeset

This repo publishes with [changesets](https://github.com/changesets/changesets).
Any change that should appear in a release needs a changeset:

```bash
pnpm changeset
```

Pick the affected packages, choose `patch`/`minor`/`major`, and write a sentence
describing the change **from a user's perspective**. Merging the PR opens a
"Version Packages" PR; merging that publishes to npm.

Skip the changeset for docs-only and CI-only changes.

## Engineering standards

- **Strict TypeScript.** Avoid `any` except where genuinely unavoidable for
  arbitrary JSON payloads.
- **Local-first, no database, no network.** A change that makes Tracekit phone
  home or require a hosted service is out of scope, permanently.
- **Never bypass redaction.** Anything persisted to disk goes through the
  redactor. If you add a new event field, confirm it is redacted.
- **Cross-platform.** Code must work on Windows, macOS, and Linux. Avoid
  `rm -rf` in scripts and shell-specific path handling.
- **Test public behaviour.** New public API needs tests. Bug fixes need a test
  that fails before the fix.
- **No telemetry.** None. Please don't add any.

## Pull requests

1. Open an issue first for anything non-trivial, so we don't disagree on
   direction after you've written the code.
2. Keep PRs focused. One adapter or one fix per PR.
3. Make sure `pnpm typecheck && pnpm test && pnpm build` all pass.
4. Add a changeset if the change is user-facing.

## Reporting bugs

Open an issue with: your OS, Node version, Tracekit version, what you ran, and
what happened instead. If the trace is relevant, a redacted excerpt from
`.tracekit/runs/<run-id>/events.jsonl` is gold.

For security issues, do not open a public issue — see [SECURITY.md](SECURITY.md).

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](LICENSE).
