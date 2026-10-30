# Fenix Hub

<p align="center">
  <img src="./resources/fenix-hub-logo.png" alt="Fenix Hub logo" width="160">
</p>

Where all my agents meet and work.

Fenix Hub is a desktop app that runs several AI agents side by side. Local and cloud agents can
share one memory, so they work from the same context.

## What is different from the original

- **Shared memory.** A built-in tool server (`aionui-memory`) lets every agent search, save and
  forget short notes. Notes that come from web pages, email or other bots are held until you
  confirm them. Notes that look like secrets are refused.
- **New name and logo.**

More is planned: a memory review screen, an agent-org home screen, and automated jobs.

## Based on AionUi

Fenix Hub is a fork of [AionUi](https://github.com/iOfficeAI/AionUi) by iOfficeAI, used under the
Apache License 2.0. See [LICENSE](LICENSE). Original copyright notices stay in the source files.
Fenix Hub is not affiliated with or endorsed by the AionUi project.

The local backend (AionCore) is a separate project, also from iOfficeAI.

## Build from source

Needs Bun, Node.js 22 to 24, and the Rust toolchain. On Windows you also need the Microsoft C++
Build Tools. Full steps are in [docs/contributing/development.md](docs/contributing/development.md).

```bash
bun install
bun run start
```

## Test

```bash
bun run test
bunx tsc --noEmit
```
