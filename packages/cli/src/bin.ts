#!/usr/bin/env node
import { Command } from "commander";
import { listCommand } from "./commands/list.js";
import { inspectCommand } from "./commands/inspect.js";
import { exportCommand } from "./commands/export.js";
import { eventsCommand } from "./commands/events.js";
import { compareCommand } from "./commands/compare.js";
import { uiCommand } from "./commands/ui.js";
import { wrapCommand } from "./commands/wrap.js";

const program = new Command();

program
  .name("tracekit")
  .description("Local-first observability and replay tool for AI coding agents")
  .version("0.1.0")
  // Required so `wrap` can use passThroughOptions and forward a child
  // command's own flags without tracekit trying to parse them.
  .enablePositionalOptions();

program
  .command("list")
  .description("List all recorded agent runs")
  .option("--dir <path>", "Custom storage base directory (default: .tracekit)")
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
  .option("--dir <path>", "Custom storage base directory (default: .tracekit)")
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
  .option("--dir <path>", "Custom storage base directory (default: .tracekit)")
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
  .option("--dir <path>", "Custom storage base directory (default: .tracekit)")
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
  .option("--dir <path>", "Custom storage base directory (default: .tracekit)")
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
  .option("--dir <path>", "Custom storage base directory (default: .tracekit)")
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

program
  .command("wrap")
  .description(
    "Record any coding agent with no instrumentation: run a command, capture its output and the files it changed"
  )
  .argument("<command...>", "command to run, after --")
  .option("--dir <path>", "Custom storage base directory (default: .tracekit)")
  .option("-C, --cwd <path>", "Directory to run the command in (default: current directory)")
  .option("-t, --task <text>", "Label for the recorded run (default: the command line)")
  .option("-p, --project <name>", "Project name recorded in the run (default: cwd basename)")
  .option("--no-git", "Skip the before/after worktree diff")
  .option("--inherit-stdio", "Let the command own the terminal (required for TUI agents, output is not recorded)")
  .option("-q, --quiet", "Do not print the run summary when the command exits")
  .allowUnknownOption()
  .passThroughOptions()
  .action(async (command: string[], options) => {
    try {
      await wrapCommand(command, {
        dir: options.dir,
        cwd: options.cwd,
        task: options.task,
        project: options.project,
        noGit: options.git === false,
        inheritStdio: options.inheritStdio,
        quiet: options.quiet,
      });
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
