# Secret Redaction Engine

AI coding agents often manipulate environment variables, tokens, API keys, and connection strings during execution. If recorded unfiltered to disk, local traces could expose critical credentials.

Tracekit implements a strict **scrub-before-store** policy.

## The Principle

> Redaction MUST occur before any event is persisted to disk. Secrets are never written to disk in plain text and redacted retroactively.

## Built-in Secret Patterns

Tracekit automatically identifies and redacts:

1. **OpenAI API Keys**:
   - `sk-[a-zA-Z0-9_\-]{20,}`
   - `sk-proj-[a-zA-Z0-9_\-]{20,}`
2. **Anthropic API Keys**:
   - `sk-ant-[a-zA-Z0-9_\-]{20,}`
3. **GitHub Access Tokens**:
   - `ghp_...`, `gho_...`, `ghu_...`, `ghs_...`, `ghr_...`
   - Fine-grained tokens (`github_pat_...`)
4. **AWS Access Keys**:
   - `AKIA[0-9A-Z]{16}`
5. **Slack Tokens**:
   - `xoxb-...`, `xoxp-...`
6. **Database Connection Strings**:
   - `postgres://user:password@host/db`
   - `mysql://user:password@host/db`
   - `mongodb+srv://user:password@host/db`
   - (Scrubbed to `postgres://user:[REDACTED]@host/db` preserving host and user)
7. **Private Keys**:
   - `-----BEGIN [A-Z ]*PRIVATE KEY-----`

## Custom Configuration

Configure custom redactions when starting a replay run:

```typescript
import { Replay } from "@tracekit/sdk";

const replay = await Replay.start({
  project: "my-service",
  task: "Fix auth",
  // Specific environment variable names or key names:
  redact: [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GITHUB_TOKEN",
    "DATABASE_URL",
    "JWT_SECRET",
  ],
  // Custom regex patterns:
  patterns: [
    /internal-token-[a-f0-9]{32}/g,
  ],
  // Custom mask string (defaults to "[REDACTED]"):
  mask: "[REDACTED]",
});
```

## Deep Recursive Sanitization

The `Redactor` recursively inspects all fields across arrays, maps, and nested objects. Property keys matching sensitive terms (`token`, `password`, `secret`, `apikey`, `api_key`) are masked automatically even if their values do not match standard regex formats.
