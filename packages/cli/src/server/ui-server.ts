import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { promises as fs, statSync } from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  FsReplayStore,
  compareRuns,
  type AgentEvent,
} from "@tracekit/core";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

export interface UiServerOptions {
  port?: number;
  dir?: string;
  staticDir?: string;
}

export function findViewerDistDir(customStaticDir?: string): string {
  if (customStaticDir) {
    return resolve(customStaticDir);
  }

  // Installed layout: @tracekit/viewer is a real dependency of @tracekit/cli, so
  // resolve its package.json rather than guessing at relative paths.
  try {
    const require = createRequire(import.meta.url);
    const viewerPkg = require.resolve("@tracekit/viewer/package.json");
    const dist = join(dirname(viewerPkg), "dist");
    if (statSync(dist).isDirectory()) {
      return dist;
    }
  } catch {
    // fall through to the monorepo layout below
  }

  // Monorepo development layout: packages/cli/dist/server -> packages/viewer/dist
  const currentDir = typeof import.meta.dirname !== "undefined"
    ? import.meta.dirname
    : fileURLToPath(new URL(".", import.meta.url));

  const monorepoDist = resolve(currentDir, "../../../viewer/dist");
  if (statSync(monorepoDist, { throwIfNoEntry: false })?.isDirectory()) {
    return monorepoDist;
  }

  throw new Error(
    "Could not locate the Tracekit viewer assets. The @tracekit/viewer package " +
      "appears to be missing or was not built. Try reinstalling, or pass an " +
      "explicit path with --static-dir."
  );
}

export function createUiServer(options: UiServerOptions = {}) {
  const port = options.port ?? 4300;
  const store = new FsReplayStore({ baseDir: options.dir });
  const staticDir = findViewerDistDir(options.staticDir);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS for development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = parsedUrl.pathname;

    // --- REST API ENDPOINTS ---
    if (pathname === "/api/runs") {
      try {
        const runs = await store.listRuns();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(runs));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname.startsWith("/api/runs/") && pathname.endsWith("/events")) {
      const runId = pathname.slice("/api/runs/".length, -"/events".length);
      try {
        const events: AgentEvent[] = [];
        for await (const evt of store.getEvents(runId)) {
          events.push(evt);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(events));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname.startsWith("/api/runs/")) {
      const runId = pathname.slice("/api/runs/".length);
      try {
        const run = await store.getRun(runId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(run));
      } catch (err: any) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (pathname === "/api/compare") {
      const runAId = parsedUrl.searchParams.get("a");
      const runBId = parsedUrl.searchParams.get("b");

      if (!runAId || !runBId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing 'a' or 'b' run ID query parameter" }));
        return;
      }

      try {
        const runA = await store.getRun(runAId);
        const runB = await store.getRun(runBId);

        const eventsA: AgentEvent[] = [];
        for await (const evt of store.getEvents(runAId)) {
          eventsA.push(evt);
        }

        const eventsB: AgentEvent[] = [];
        for await (const evt of store.getEvents(runBId)) {
          eventsB.push(evt);
        }

        const comparison = compareRuns(runA, eventsA, runB, eventsB);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(comparison));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // --- STATIC FILES / SPA FALLBACK ---
    let filePath = join(staticDir, pathname === "/" ? "index.html" : pathname);

    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = join(filePath, "index.html");
      }
      const data = await fs.readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    } catch {
      // SPA fallback to index.html
      try {
        const fallbackPath = join(staticDir, "index.html");
        const data = await fs.readFile(fallbackPath);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(
          `Tracekit UI static assets not found at ${staticDir}. Please run 'pnpm --filter @tracekit/viewer run build'.`
        );
      }
    }
  });

  return {
    server,
    port,
    start: () =>
      new Promise<number>((resolveStart, rejectStart) => {
        server.once("error", rejectStart);
        server.listen(port, () => {
          const addr = server.address();
          const actualPort = typeof addr === "object" && addr ? addr.port : port;
          resolveStart(actualPort);
        });
      }),
  };
}
