import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  captureWorktree,
  diffWorktree,
  guessAgentName,
  listTrackedFiles,
} from "../src/worktree/index.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

describe("worktree capture", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = join(
      tmpdir(),
      `tracekit-worktree-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(repoDir, { recursive: true });
    await git(repoDir, "init", "-q");
    await git(repoDir, "config", "user.email", "test@example.com");
    await git(repoDir, "config", "user.name", "Test");
  });

  afterEach(async () => {
    await fs.rm(repoDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns null outside a git repository", async () => {
    const plain = join(tmpdir(), `tracekit-nogit-${Date.now()}`);
    await fs.mkdir(plain, { recursive: true });
    try {
      expect(await listTrackedFiles(plain)).toBeNull();
      expect(await captureWorktree({ cwd: plain })).toBeNull();
    } finally {
      await fs.rm(plain, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("lists tracked and untracked files but respects .gitignore", async () => {
    await fs.writeFile(join(repoDir, ".gitignore"), "ignored.txt\n");
    await fs.writeFile(join(repoDir, "tracked.txt"), "hello\n");
    await fs.writeFile(join(repoDir, "ignored.txt"), "should not appear\n");

    const listed = await listTrackedFiles(repoDir);
    expect(listed).not.toBeNull();

    const paths = listed!.paths.map((p) => p.replace(/\\/g, "/"));
    expect(paths).toContain("tracked.txt");
    expect(paths).not.toContain("ignored.txt");
  });

  it("handles paths containing spaces", async () => {
    await fs.writeFile(join(repoDir, "my file.txt"), "spaces\n");
    const listed = await listTrackedFiles(repoDir);
    const paths = listed!.paths.map((p) => p.replace(/\\/g, "/"));
    expect(paths).toContain("my file.txt");
  });

  it("never captures its own .tracekit directory", async () => {
    await fs.mkdir(join(repoDir, ".tracekit", "runs"), { recursive: true });
    await fs.writeFile(join(repoDir, ".tracekit", "runs", "x.json"), "{}");

    const snap = await captureWorktree({ cwd: repoDir });
    expect(snap).not.toBeNull();
    for (const path of snap!.files.keys()) {
      expect(path.startsWith(".tracekit/")).toBe(false);
    }
  });

  it("marks binary and oversized files as skipped with null content", async () => {
    await fs.writeFile(join(repoDir, "small.txt"), "tiny\n");
    await fs.writeFile(join(repoDir, "blob.bin"), Buffer.from([0x00, 0x01, 0x02, 0x00]));
    await fs.writeFile(join(repoDir, "big.txt"), "x".repeat(5000));

    const snap = await captureWorktree({ cwd: repoDir, maxFileBytes: 1000 });
    expect(snap).not.toBeNull();

    const files = snap!.files;
    expect(files.get("small.txt")?.content).toBe("tiny\n");

    expect(files.get("blob.bin")?.content).toBeNull();
    expect(files.get("big.txt")?.content).toBeNull();
    expect(snap!.skipped).toContain("blob.bin");
    expect(snap!.skipped).toContain("big.txt");
  });
});

describe("diffWorktree", () => {
  const makeSnapshot = (entries: Record<string, string | null>) => ({
    root: "/repo",
    skipped: [],
    files: new Map(
      Object.entries(entries).map(([path, content]) => [
        path,
        {
          path,
          hash: content ?? "",
          size: content?.length ?? 0,
          content,
        },
      ])
    ),
  });

  it("reports nothing when nothing changed", () => {
    const a = makeSnapshot({ "a.txt": "same" });
    const b = makeSnapshot({ "a.txt": "same" });
    expect(diffWorktree(a, b)).toEqual([]);
  });

  it("detects modifications, additions, and deletions", () => {
    const before = makeSnapshot({ "keep.txt": "k", "edit.txt": "old", "gone.txt": "bye" });
    const after = makeSnapshot({ "keep.txt": "k", "edit.txt": "new", "added.txt": "hi" });

    const changes = diffWorktree(before, after);

    expect(changes).toEqual([
      { path: "added.txt", kind: "added", before: null, after: "hi" },
      { path: "edit.txt", kind: "modified", before: "old", after: "new" },
      { path: "gone.txt", kind: "deleted", before: "bye", after: null },
    ]);
  });

  it("returns changes in a stable sorted order", () => {
    const before = makeSnapshot({});
    const after = makeSnapshot({ "z.txt": "1", "a.txt": "2", "m.txt": "3" });

    expect(diffWorktree(before, after).map((c) => c.path)).toEqual([
      "a.txt",
      "m.txt",
      "z.txt",
    ]);
  });

  it("carries null content through for skipped files", () => {
    const before = makeSnapshot({ "img.bin": null });
    const after = makeSnapshot({ "img.bin": null });

    // Different hashes, so it must be reported, but with no content to diff.
    const beforeMutated = {
      ...before,
      files: new Map([["img.bin", { path: "img.bin", hash: "aaa", size: 1, content: null }]]),
    };
    const afterMutated = {
      ...after,
      files: new Map([["img.bin", { path: "img.bin", hash: "bbb", size: 2, content: null }]]),
    };

    const changes = diffWorktree(beforeMutated, afterMutated);
    expect(changes).toEqual([
      { path: "img.bin", kind: "modified", before: null, after: null },
    ]);
  });
});

describe("guessAgentName", () => {
  it("extracts a bare binary name", () => {
    expect(guessAgentName("opencode")).toBe("opencode");
    expect(guessAgentName("/usr/local/bin/opencode")).toBe("opencode");
  });

  it("strips Windows executable extensions", () => {
    expect(guessAgentName("aider.exe")).toBe("aider");
    expect(guessAgentName("claude.cmd")).toBe("claude");
  });
});
