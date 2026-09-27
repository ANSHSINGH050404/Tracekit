import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, relative, sep } from "node:path";
import { computeHash } from "../diff/unified.js";

const execFileAsync = promisify(execFile);

/** Files larger than this are recorded as changed, but their contents are not stored. */
export const DEFAULT_MAX_FILE_BYTES = 512 * 1024;

export interface WorktreeFile {
  /** Repo-relative path, always with forward slashes. */
  path: string;
  hash: string;
  size: number;
  /** Text content, or null when the file is binary, oversized, or unreadable. */
  content: string | null;
}

export interface WorktreeSnapshot {
  root: string;
  files: Map<string, WorktreeFile>;
  /** Paths that were seen but not captured (binary or over the size cap). */
  skipped: string[];
}

export type WorktreeChangeKind = "added" | "modified" | "deleted";

export interface WorktreeChange {
  path: string;
  kind: WorktreeChangeKind;
  before: string | null;
  after: string | null;
}

export interface CaptureWorktreeOptions {
  cwd?: string;
  maxFileBytes?: number;
  /** Absolute paths (or repo-relative prefixes) to never read. */
  exclude?: string[];
}

/**
 * Lists the files a coding agent could plausibly have touched, using git so that
 * .gitignore rules are respected and `node_modules` is skipped for free.
 *
 * Returns null when git is unavailable or the directory is not a repository,
 * which lets callers degrade to "process output only" recording.
 */
export async function listTrackedFiles(
  cwd: string
): Promise<{ root: string; paths: string[] } | null> {
  try {
    const { stdout: rootOut } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
    });
    const root = rootOut.trim();

    // -z gives NUL-separated output so paths with spaces and quotes survive.
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, maxBuffer: 64 * 1024 * 1024 }
    );

    const paths = stdout
      .split("\0")
      .map((p) => p.trim())
      .filter(Boolean);

    return { root, paths };
  } catch {
    return null;
  }
}

function looksBinary(buffer: Buffer): boolean {
  const probe = buffer.subarray(0, 8000);
  return probe.includes(0);
}

/**
 * Captures the content of every candidate file so a later snapshot can be
 * diffed against it. This is how `tracekit wrap` reconstructs what an agent
 * changed without the agent cooperating.
 */
export async function captureWorktree(
  options: CaptureWorktreeOptions = {}
): Promise<WorktreeSnapshot | null> {
  const cwd = options.cwd ?? process.cwd();
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const exclude = options.exclude ?? [];

  const listed = await listTrackedFiles(cwd);
  if (!listed) {
    return null;
  }

  const files = new Map<string, WorktreeFile>();
  const skipped: string[] = [];

  // Read in batches so a large repo does not exhaust file handles at once.
  const BATCH = 64;

  for (let i = 0; i < listed.paths.length; i += BATCH) {
    const batch = listed.paths.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (relPath) => {
        const normalized = relPath.replace(/\\/g, "/");

        if (exclude.some((ex) => normalized === ex || normalized.startsWith(`${ex}/`))) {
          return;
        }
        if (normalized.startsWith(".tracekit/") || normalized === ".tracekit") {
          return;
        }

        const abs = join(listed.root, relPath);

        try {
          const buffer = await fs.readFile(abs);

          if (buffer.byteLength > maxFileBytes || looksBinary(buffer)) {
            files.set(normalized, {
              path: normalized,
              hash: computeHash(buffer.toString("base64")),
              size: buffer.byteLength,
              content: null,
            });
            skipped.push(normalized);
            return;
          }

          const content = buffer.toString("utf8");
          files.set(normalized, {
            path: normalized,
            hash: computeHash(content),
            size: buffer.byteLength,
            content,
          });
        } catch {
          // Deleted between listing and reading, or a broken symlink.
          return;
        }
      })
    );
  }

  return { root: listed.root, files, skipped };
}

/**
 * Compares two worktree snapshots and reports added, modified, and deleted
 * files along with their before/after contents.
 */
export function diffWorktree(
  before: WorktreeSnapshot,
  after: WorktreeSnapshot
): WorktreeChange[] {
  const changes: WorktreeChange[] = [];
  const paths = new Set([...before.files.keys(), ...after.files.keys()]);

  for (const path of [...paths].sort()) {
    const a = before.files.get(path);
    const b = after.files.get(path);

    if (a && b) {
      if (a.hash === b.hash) continue;
      changes.push({ path, kind: "modified", before: a.content, after: b.content });
    } else if (!a && b) {
      changes.push({ path, kind: "added", before: null, after: b.content });
    } else if (a && !b) {
      changes.push({ path, kind: "deleted", before: a.content, after: null });
    }
  }

  return changes;
}

/** Best-effort human label for the agent being wrapped, e.g. `opencode`. */
export function guessAgentName(command: string): string {
  const base = command.replace(/\\/g, "/").split("/").pop() ?? command;
  return base.replace(/\.(exe|cmd|bat|ps1)$/i, "");
}

export function toPosixRelative(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}
