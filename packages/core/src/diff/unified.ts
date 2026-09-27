import { createHash } from "node:crypto";

/**
 * Computes SHA-256 hash of a text string.
 */
export function computeHash(content: string | null | undefined): string {
  if (content === null || content === undefined) {
    return "";
  }
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

/**
 * Computes a standard unified diff string between two text strings.
 */
export function computeUnifiedDiff(
  filePath: string,
  before: string | null | undefined,
  after: string | null | undefined
): string {
  const normBefore = before ?? null;
  const normAfter = after ?? null;

  if (normBefore === normAfter) {
    return "";
  }

  const cleanPath = filePath.replace(/\\/g, "/");

  // Newly created file
  if (normBefore === null) {
    const lines = (normAfter ?? "").split(/\r?\n/);
    const header = `--- /dev/null\n+++ b/${cleanPath}\n@@ -0,0 +1,${lines.length} @@`;
    const body = lines.map((l) => `+${l}`).join("\n");
    return `${header}\n${body}`;
  }

  // Deleted file
  if (normAfter === null) {
    const lines = normBefore.split(/\r?\n/);
    const header = `--- a/${cleanPath}\n+++ /dev/null\n@@ -1,${lines.length} +0,0 @@`;
    const body = lines.map((l) => `-${l}`).join("\n");
    return `${header}\n${body}`;
  }

  const beforeLines = normBefore.split(/\r?\n/);
  const afterLines = normAfter.split(/\r?\n/);

  const hunks = generateDiffHunks(beforeLines, afterLines);
  if (hunks.length === 0) {
    return "";
  }

  const header = `--- a/${cleanPath}\n+++ b/${cleanPath}`;
  const hunkStrings = hunks.map((hunk) => {
    const hunkHeader = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
    const lines = hunk.lines.map((l) => {
      const prefix = l.type === "add" ? "+" : l.type === "delete" ? "-" : " ";
      return `${prefix}${l.content}`;
    });
    return `${hunkHeader}\n${lines.join("\n")}`;
  });

  return `${header}\n${hunkStrings.join("\n")}`;
}

/**
 * Generates unified diff hunks using LCS algorithm with context.
 */
export function generateDiffHunks(
  oldLines: string[],
  newLines: string[],
  contextLines = 3
): DiffHunk[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS matrix (bounded for performance)
  // For extremely large files (> 2500 lines), fall back to chunk diff to stay fast
  if (m * n > 10_000_000) {
    return [
      {
        oldStart: 1,
        oldLines: m,
        newStart: 1,
        newLines: n,
        lines: [
          ...oldLines.map((l, i) => ({ type: "delete" as const, content: l, oldLineNumber: i + 1 })),
          ...newLines.map((l, i) => ({ type: "add" as const, content: l, newLineNumber: i + 1 })),
        ],
      },
    ];
  }

  // Standard LCS dynamic programming table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff edits
  let i = m;
  let j = n;
  const rawDiff: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawDiff.push({
        type: "context",
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({
        type: "add",
        content: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({
        type: "delete",
        content: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  rawDiff.reverse();

  // If no additions or deletions, return empty
  const hasChanges = rawDiff.some((l) => l.type !== "context");
  if (!hasChanges) {
    return [];
  }

  // Group diff lines into hunks with contextLines
  const hunks: DiffHunk[] = [];
  let currentLines: DiffLine[] = [];
  let hunkOldStart = 1;
  let hunkNewStart = 1;
  let oldLineCount = 0;
  let newLineCount = 0;

  for (let idx = 0; idx < rawDiff.length; idx++) {
    const line = rawDiff[idx];

    // Check if line is a change or within context of a change
    const isChangeNearby = rawDiff
      .slice(Math.max(0, idx - contextLines), Math.min(rawDiff.length, idx + contextLines + 1))
      .some((l) => l.type !== "context");

    if (isChangeNearby) {
      if (currentLines.length === 0) {
        hunkOldStart = line.oldLineNumber ?? 1;
        hunkNewStart = line.newLineNumber ?? 1;
        oldLineCount = 0;
        newLineCount = 0;
      }
      currentLines.push(line);
      if (line.type === "delete" || line.type === "context") oldLineCount++;
      if (line.type === "add" || line.type === "context") newLineCount++;
    } else if (currentLines.length > 0) {
      hunks.push({
        oldStart: hunkOldStart,
        oldLines: oldLineCount,
        newStart: hunkNewStart,
        newLines: newLineCount,
        lines: [...currentLines],
      });
      currentLines = [];
    }
  }

  if (currentLines.length > 0) {
    hunks.push({
      oldStart: hunkOldStart,
      oldLines: oldLineCount,
      newStart: hunkNewStart,
      newLines: newLineCount,
      lines: [...currentLines],
    });
  }

  return hunks;
}
