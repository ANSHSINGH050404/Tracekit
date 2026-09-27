/**
 * Built-in regex patterns for detecting common sensitive secrets and credentials.
 */
export const DEFAULT_SECRET_PATTERNS: RegExp[] = [
  // OpenAI API keys (legacy and project-scoped)
  /\bsk-[a-zA-Z0-9_\-]{20,}\b/g,
  /\bsk-proj-[a-zA-Z0-9_\-]{20,}\b/g,

  // Anthropic API keys
  /\bsk-ant-[a-zA-Z0-9_\-]{20,}\b/g,

  // GitHub tokens (personal access tokens, OAuth, app, fine-grained)
  /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/g,
  /\bgithub_pat_[a-zA-Z0-9_]{40,}\b/g,

  // AWS Access Key ID & Secret Key
  /\bAKIA[0-9A-Z]{16}\b/g,

  // Slack tokens
  /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,

  // Database URLs with credentials: postgres://user:password@host/db, mysql://..., mongodb://...
  /(postgres|postgresql|mysql|mongodb|mongodb\+srv|redis):\/\/([^:]+):([^@\s]+)@/g,

  // Generic Private Keys header
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
