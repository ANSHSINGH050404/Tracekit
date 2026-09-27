#!/usr/bin/env node
import { Command } from "commander";
import { listCommand } from "./commands/list.js";
import { inspectCommand } from "./commands/inspect.js";
import { exportCommand } from "./commands/export.js";
import { eventsCommand } from "./commands/events.js";
import { compareCommand } from "./commands/compare.js";
import { uiCommand } from "./commands/ui.js";

const program = new Command();

program
  .name("agent-replay")
  .alias("tracekit")
  .description("Local-first observability and replay tool for AI coding agents")
  .version("0.1.0");

program
  .command("list")
  .description("List all recorded agent runs")
  .option("--dir <path>", "Custom storage base directory (default: .agent-replay)")
  .option("--json", "Output runs as raw JSON")
  .action(async (options) => {
    try {
      await listCommand(options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("inspect <run-id>")
  .description("Inspect an agent run trajectory and changed files")
  .option("--dir <path>", "Custom storage base directory (default: .agent-replay)")
  .option("--json", "Output inspect details as raw JSON")
  .action(async (runId: string, options) => {
    try {
      await inspectCommand(runId, options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("export <run-id>")
  .description("Export a run and all recorded events to JSON")
  .option("-o, --output <file>", "Output file path (default: stdout)")
  .option("--dir <path>", "Custom storage base directory (default: .agent-replay)")
  .action(async (runId: string, options) => {
    try {
      await exportCommand(runId, options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("events <run-id>")
  .description("Stream or print events recorded during an agent run")
  .option("--dir <path>", "Custom storage base directory (default: .agent-replay)")
  .option("--json", "Output events as JSONL")
  .action(async (runId: string, options) => {
    try {
      await eventsCommand(runId, options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("compare <run-a> <run-b>")
  .description("Compare factual execution metrics between two runs")
  .option("--dir <path>", "Custom storage base directory (default: .agent-replay)")
  .option("--json", "Output comparison as JSON")
  .action(async (runAId: string, runBId: string, options) => {
    try {
      await compareCommand(runAId, runBId, options);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("ui")
  .description("Start the local web UI viewer to inspect runs visually")
  .option("-p, --port <number>", "Port number for the local web server", "4300")
  .option("--dir <path>", "Custom storage base directory (default: .agent-replay)")
  .option("--no-open", "Do not automatically open the browser")
  .action(async (options) => {
    try {
      const port = parseInt(options.port, 10) || 4300;
      await uiCommand({
        port,
        dir: options.dir,
        open: options.open,
      });
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
