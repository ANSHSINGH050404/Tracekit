import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitSnapshotPayload } from "../events/types.js";

const execFileAsync = promisify(execFile);

export interface GitSnapshotOptions {
  cwd?: string;
  phase?: "start" | "end" | "checkpoint";
}

/**
 * Inspects git status in the specified directory without modifying anything.
 * Returns null if not inside a git repository or git is unavailable.
 */
export async function getGitSnapshot(
  options: GitSnapshotOptions = {}
): Promise<GitSnapshotPayload | null> {
  const cwd = options.cwd ?? process.cwd();

  try {
    // 1. Get repository root
    const { stdout: rootOut } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      { cwd }
    );
    const root = rootOut.trim().replace(/\\/g, "/");

    // 2. Get current branch name
    let branch: string | undefined;
    try {
      const { stdout: branchOut } = await execFileAsync(
        "git",
        ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: root }
      );
      const trimmedBranch = branchOut.trim();
      branch = trimmedBranch === "HEAD" ? "HEAD (detached)" : trimmedBranch;
    } catch {
      branch = undefined;
    }

    // 3. Get HEAD commit hash
    let commit: string | undefined;
    try {
      const { stdout: commitOut } = await execFileAsync(
        "git",
        ["rev-parse", "HEAD"],
        { cwd: root }
      );
      commit = commitOut.trim();
    } catch {
      commit = undefined;
    }

    // 4. Check dirty state via git status --porcelain
    let dirty = false;
    let statusSummary: string | undefined;
    try {
      const { stdout: statusOut } = await execFileAsync(
        "git",
        ["status", "--porcelain"],
        { cwd: root }
      );
      const lines = statusOut
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      dirty = lines.length > 0;
      if (dirty) {
        statusSummary = `${lines.length} modified/untracked file(s)`;
      } else {
        statusSummary = "clean";
      }
    } catch {
      dirty = false;
      statusSummary = "unknown";
    }

    return {
      root,
      branch,
      commit,
      dirty,
      statusSummary,
      phase: options.phase,
    };
  } catch {
    // Not a git repository or git command missing
    return null;
  }
}
