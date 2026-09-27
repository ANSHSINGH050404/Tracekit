import { describe, it, expect } from "vitest";
import { computeUnifiedDiff, computeHash } from "../src/diff/unified.js";

describe("Diff & Hash Utilities", () => {
  it("computes SHA-256 hash of content", () => {
    const hash = computeHash("hello world");
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("produces unified diff for created file", () => {
    const diff = computeUnifiedDiff("src/new.ts", null, "console.log('hi');\n");
    expect(diff).toContain("--- /dev/null");
    expect(diff).toContain("+++ b/src/new.ts");
    expect(diff).toContain("+console.log('hi');");
  });

  it("produces unified diff for deleted file", () => {
    const diff = computeUnifiedDiff("src/old.ts", "const x = 1;\n", null);
    expect(diff).toContain("--- a/src/old.ts");
    expect(diff).toContain("+++ /dev/null");
    expect(diff).toContain("-const x = 1;");
  });

  it("produces unified diff with hunks for modified file", () => {
    const before = "line 1\nline 2\nline 3\nline 4";
    const after = "line 1\nline TWO\nline 3\nline 4";
    const diff = computeUnifiedDiff("src/sample.ts", before, after);

    expect(diff).toContain("--- a/src/sample.ts");
    expect(diff).toContain("+++ b/src/sample.ts");
    expect(diff).toContain("-line 2");
    expect(diff).toContain("+line TWO");
  });

  it("returns empty string when before and after are identical", () => {
    const content = "exact same content\n";
    const diff = computeUnifiedDiff("src/same.ts", content, content);
    expect(diff).toBe("");
  });
});
