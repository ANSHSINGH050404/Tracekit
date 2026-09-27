# Security Policy

## Supported versions

Tracekit is pre-1.0. Security fixes are applied to the latest published minor
version only.

| Version | Supported |
| --- | --- |
| 0.1.x | ✅ |
| < 0.1 | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Email **114014895+ANSHSINGH050404@users.noreply.github.com** with:

- a description of the issue and its impact,
- steps to reproduce,
- the affected Tracekit version and your OS.

You can expect an acknowledgement within 72 hours and a decision on whether to
proceed within 7 days. Please give us reasonable time to release a fix before
disclosing publicly.

## Threat model

Tracekit records AI coding agent activity: prompts, tool calls, file contents,
command output, and diffs. That data is frequently sensitive, so here is what
Tracekit does and does not do.

**By design:**

- Everything is stored locally, under `.tracekit/` in your repository. There is
  no server component, no account, and no telemetry.
- Tracekit makes **no network requests**. The viewer binds to `localhost` only.
- Recorded payloads pass through a redaction engine
  ([docs/redaction.md](docs/redaction.md)) before being written to disk, masking
  common API keys, tokens, and credentialed connection strings.

**Not guaranteed:**

- The built-in redaction patterns are a backstop, not a guarantee. They will
  not catch every secret, and they cannot see secrets that are split across
  multiple events or encoded.
- File contents recorded by `file.write` are stored in full.
- The `ui` server serves whatever `.tracekit/` contains to any local process.
  On a shared or multi-user machine, other local users may be able to reach it.

**Your responsibility:**

- Review `.tracekit/` before committing it. It is gitignored by default in this
  repository, but that is not true of every project.
- Pass explicit `redact` values for project-specific secrets.
- Do not run `tracekit ui` on an untrusted machine.
- If a trace is genuinely compromised, delete the run directory and rotate the
  exposed credential. Redaction prevents accidents; it is not a control for
  hostile local processes.
