import { describe, it, expect } from "vitest";
import { Redactor } from "../src/redaction/redactor.js";

describe("Redaction Engine", () => {
  const redactor = new Redactor({
    redact: ["CUSTOM_SECRET_KEY", "secret_token_123456"],
    patterns: [/internal-token-[a-z0-9]{8}/g],
  });

  it("redacts common OpenAI and Anthropic API keys (API key)", () => {
    const text =
      "Using key sk-1234567890abcdef1234567890 and anthropic sk-ant-abcdef1234567890abcdef1234";
    const redacted = redactor.redactString(text);
    expect(redacted).not.toContain("sk-1234567890abcdef1234567890");
    expect(redacted).not.toContain("sk-ant-abcdef1234567890abcdef1234");
    expect(redacted).toBe("Using key [REDACTED] and anthropic [REDACTED]");
  });

  it("redacts GitHub personal access tokens (GitHub token)", () => {
    const text =
      "Cloning repo with https://ghp_123456789012345678901234567890123456@github.com/org/repo";
    const redacted = redactor.redactString(text);
    expect(redacted).not.toContain("ghp_123456789012345678901234567890123456");
    expect(redacted).toContain("[REDACTED]");
  });

  it("applies custom regex patterns (custom regex)", () => {
    const text = "Connecting to agent with token internal-token-abc12345";
    const redacted = redactor.redactString(text);
    expect(redacted).toBe("Connecting to agent with token [REDACTED]");
  });

  it("redacts secrets inside nested objects deeply (nested objects)", () => {
    const nested = {
      config: {
        server: "api.example.com",
        credentials: {
          apiKey: "sk-proj-1234567890abcdef1234567890",
          databaseUrl: "postgres://user:superSecretPassword@db.host.com:5432/main",
        },
      },
      tags: ["prod", "auth"],
    };

    const redacted = redactor.redactDeep(nested);
    expect(redacted.config.credentials.apiKey).toBe("[REDACTED]");
    expect(redacted.config.credentials.databaseUrl).toBe(
      "postgres://user:[REDACTED]@db.host.com:5432/main"
    );
    expect(redacted.tags).toEqual(["prod", "auth"]);
  });

  it("redacts command stdout/stderr streams (stdout)", () => {
    const stdout =
      "Exporting GITHUB_TOKEN=ghp_abcdef1234567890abcdef1234567890abcdef\nRunning build step...";
    const redacted = redactor.redactString(stdout);
    expect(redacted).not.toContain("ghp_");
    expect(redacted).toContain("Exporting GITHUB_TOKEN=[REDACTED]");
  });

  it("redacts model messages (model messages)", () => {
    const messages = [
      {
        role: "user",
        content: "Here is my secret key: sk-ant-api03-abcdef12345678901234567890",
      },
      {
        role: "assistant",
        content: "I acknowledge receipt of your secret key: sk-ant-api03-abcdef12345678901234567890",
      },
    ];

    const redacted = redactor.redactDeep(messages);
    expect(redacted[0].content).toBe("Here is my secret key: [REDACTED]");
    expect(redacted[1].content).toBe(
      "I acknowledge receipt of your secret key: [REDACTED]"
    );
  });
});
