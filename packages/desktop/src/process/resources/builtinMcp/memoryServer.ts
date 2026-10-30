/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Built-in MCP server for shared agent memory.
 * Runs as a standalone stdio process spawned by the MCP client. Every agent that uses it
 * gets its own process, and all of them read and write the same folder.
 * The folder comes from the AIONUI_MEMORY_DIR environment variable.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MemoryStore } from './memoryStore';
import { createMemoryServer } from './memoryTools';

async function main() {
  const memoryDir = process.env.AIONUI_MEMORY_DIR;
  if (!memoryDir) {
    // stdout is the protocol channel, so diagnostics go to stderr.
    console.error('[MemoryMCP] AIONUI_MEMORY_DIR is not set. Refusing to start without a memory folder.');
    process.exit(1);
  }

  const server = createMemoryServer(new MemoryStore(memoryDir));
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error('[MemoryMCP] Fatal error:', error);
  process.exit(1);
});
