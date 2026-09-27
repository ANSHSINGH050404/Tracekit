import { Replay } from "@agent-replay/sdk";

async function main() {
  console.log("⚡ Starting simulated AI coding agent run with Tracekit recording...\n");

  const replay = await Replay.start({
    project: "auth-service",
    task: "Fix authentication token expiry bug",
    redact: [
      "OPENAI_API_KEY",
      "JWT_SECRET",
      "DATABASE_URL",
    ],
    agent: {
      name: "AutoCoder",
      version: "1.2.0",
    },
  });

  console.log(`Run started: ${replay.runId}`);

  // 1. LLM Model Request & Response
  console.log("-> Recording model call (with secret redaction test)...");
  await replay.modelRequest({
    model: "claude-3-7-sonnet",
    provider: "anthropic",
    messages: [
      {
        role: "user",
        content:
          "Please fix the token expiry bug in src/auth.ts. Use apiKey: sk-ant-secret12345678901234567890 and DB postgres://admin:superSecretPass123@localhost:5432/auth_db",
      },
    ],
  });

  await replay.modelResponse({
    model: "claude-3-7-sonnet",
    provider: "anthropic",
    content: "I'll inspect src/auth.ts and run the test suite to locate the expiry issue.",
    usage: {
      promptTokens: 420,
      completionTokens: 85,
      totalTokens: 505,
    },
    duration: 1250,
  });

  // 2. Read File Tool
  console.log("-> Inspecting file src/auth.ts...");
  const originalAuthCode = `export function isTokenExpired(expiresAt: number): boolean {
  // BUG: inverted comparison
  return Date.now() < expiresAt;
}
`;

  await replay.fileRead("src/auth.ts", originalAuthCode);

  await replay.tool(
    "read_file",
    { path: "src/auth.ts" },
    async () => originalAuthCode
  );

  // 3. Command run: Test fails first
  console.log("-> Executing test command (simulating failure)...");
  await replay.command("pnpm test:auth", async (ctx) => {
    await ctx.stdout("Running Authentication unit tests...\n");
    await ctx.stdout("FAIL src/auth.test.ts\n");
    await ctx.stderr("AssertionError: expected isTokenExpired(pastDate) to be true, got false\n");
    return 1; // exit code 1
  });

  // 4. File Write with automatic diff calculation
  console.log("-> Applying bugfix to src/auth.ts...");
  const fixedAuthCode = `export function isTokenExpired(expiresAt: number): boolean {
  // Corrected token expiration check
  return Date.now() >= expiresAt;
}
`;

  await replay.fileWrite({
    path: "src/auth.ts",
    before: originalAuthCode,
    after: fixedAuthCode,
  });

  await replay.tool(
    "write_file",
    {
      path: "src/auth.ts",
      content: fixedAuthCode,
    },
    async () => ({ success: true, bytesWritten: fixedAuthCode.length })
  );

  // 5. Command run: Test passes
  console.log("-> Re-running test command (simulating success)...");
  await replay.command("pnpm test:auth", async (ctx) => {
    await ctx.stdout("Running Authentication unit tests...\n");
    await ctx.stdout("PASS src/auth.test.ts (2 passed, 2 total)\n");
    await ctx.stdout("✓ isTokenExpired should return true for expired tokens\n");
    await ctx.stdout("✓ isTokenExpired should return false for active tokens\n");
    return 0; // exit code 0
  });

  // 6. Finish run
  console.log("-> Finalizing run trajectory...");
  const finishedRun = await replay.finish({
    status: "completed",
    summary: "Fixed inverted condition in isTokenExpired helper and verified with unit tests.",
  });

  console.log(`\n✓ Run recorded successfully!`);
  console.log(`Run ID:   ${finishedRun.id}`);
  console.log(`Duration: ${finishedRun.finishedAt! - finishedRun.startedAt}ms`);
  console.log(`Inspect with: pnpm --filter @agent-replay/cli exec node ./dist/bin.js inspect ${finishedRun.id}`);
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
