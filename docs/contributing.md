# Contributing to Tracekit

Thank you for your interest in contributing to **Tracekit** (Agent Replay)!

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0 (or 12.x)
- Git

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/tracekit/tracekit.git
   cd Tracekit
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build all workspace packages:
   ```bash
   pnpm build
   ```

4. Run the test suite:
   ```bash
   pnpm test
   ```

5. Typecheck all packages:
   ```bash
   pnpm typecheck
   ```

## Development Commands

- `pnpm -r run build`: Builds core, sdk, viewer, cli, adapters.
- `pnpm test`: Runs Vitest across all packages.
- `pnpm test:watch`: Runs Vitest in watch mode.
- `pnpm --filter @agent-replay/viewer run dev`: Starts Vite dev server for the React viewer.

## Engineering Standards

- **Strict TypeScript**: Avoid `any` unless strictly required for generic JSON data.
- **Local-first only**: Do not introduce external database dependencies or hosted SaaS components.
- **Privacy conscious**: Never bypass the redaction engine when persisting traces.
- **Cross-platform**: Ensure paths and shell commands function properly across Windows, macOS, and Linux.
- **Tests for public APIs**: Ensure any new features include comprehensive unit tests.
