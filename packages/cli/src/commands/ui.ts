import { exec } from "node:child_process";
import { createUiServer, type UiServerOptions } from "../server/ui-server.js";

export interface UiCommandOptions extends UiServerOptions {
  open?: boolean;
}

export function openBrowser(url: string): void {
  const platform = process.platform;
  let command = "";

  if (platform === "win32") {
    command = `start "" "${url}"`;
  } else if (platform === "darwin") {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, () => {});
}

export async function uiCommand(options: UiCommandOptions = {}): Promise<void> {
  const ui = createUiServer(options);

  try {
    const actualPort = await ui.start();
    const url = `http://localhost:${actualPort}`;

    console.log(`\n⚡ Tracekit UI running at: ${url}\n`);
    console.log(`Press Ctrl+C to stop the viewer server.\n`);

    if (options.open !== false) {
      openBrowser(url);
    }
  } catch (err: any) {
    if (err.code === "EADDRINUSE") {
      console.error(`Error: Port ${options.port ?? 4300} is already in use.`);
    } else {
      console.error(`Failed to start UI server:`, err);
    }
    process.exit(1);
  }
}
