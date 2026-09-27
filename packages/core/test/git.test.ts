import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getGitSnapshot } from "../src/git/snapshot.js";

const execAsync = promisify(execFile);

describe("Git Inspector (getGitSnapshot)", () => {
  let gitRepoDir: string;
  let nonGitDir: string;

  beforeEach(async () => {
    gitRepoDir = join(
      tmpdir(),
      `tracekit-git-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    nonGitDir = join(
      tmpdir(),
      `tracekit-nongit-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(gitRepoDir, { recursive: true });
    await fs.mkdir(nonGitDir, { recursive: true });

    // Initialize git repository
    await execAsync("git", ["init"], { cwd: gitRepoDir });
    await execAsync("git", ["config", "user.name", "Tracekit Tester"], {
      cwd: gitRepoDir,
    });
    await execAsync("git", ["config", "user.email", "tester@tracekit.dev"], {
      cwd: gitRepoDir,
    });
    // Create initial commit
    await fs.writeFile(join(gitRepoDir, "README.md"), "# Test Repo\n");
    await execAsync("git", ["add", "README.md"], { cwd: gitRepoDir });
    await execAsync("git", ["commit", "-m", "Initial commit"], {
      cwd: gitRepoDir,
    });
  });

  afterEach(async () => {
    await fs.rm(gitRepoDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(nonGitDir, { recursive: true, force: true }).catch(() => {});
  });

  it("detects branch and commit on clean repository (clean repository, branch, commit)", async () => {
    const snapshot = await getGitSnapshot({ cwd: gitRepoDir });
    expect(snapshot).not.toBeNull();
    if (snapshot) {
      const realExpected = (await fs.realpath(gitRepoDir)).replace(/\\/g, "/").toLowerCase();
      expect(snapshot.root.toLowerCase()).toBe(realExpected);
      expect(snapshot.dirty).toBe(false);
      expect(snapshot.commit).toBeDefined();
      expect(snapshot.commit?.length).toBe(40);
      expect(snapshot.branch).toBeDefined();
    }
  });

  it("detects dirty repository when files are modified (dirty repository)", async () => {
    await fs.writeFile(
      join(gitRepoDir, "uncommitted.txt"),
      "untracked file content"
    );
    const snapshot = await getGitSnapshot({ cwd: gitRepoDir });
    expect(snapshot).not.toBeNull();
    if (snapshot) {
      expect(snapshot.dirty).toBe(true);
      expect(snapshot.statusSummary).toContain("1 modified/untracked");
    }
  });

  it("returns null gracefully when directory is not inside a git repo", async () => {
    const snapshot = await getGitSnapshot({ cwd: nonGitDir });
    expect(snapshot).toBeNull();
  });
});
