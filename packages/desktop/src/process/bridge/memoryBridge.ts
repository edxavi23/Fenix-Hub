/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Review actions for the shared agent memory.
 *
 * Only a person using the app reaches these. Agents get a smaller tool set from the built-in
 * memory MCP server, which cannot confirm, restore or erase notes.
 */

import { ipcBridge } from '@/common';
import { MemoryStore } from '@process/resources/builtinMcp/memoryStore';
import { getMemoryDir } from '@process/utils/utils';

export function initMemoryBridge(store: MemoryStore = new MemoryStore(getMemoryDir())): void {
  ipcBridge.memory.list.provider(() => store.list(['proposed', 'confirmed', 'deleted']));
  ipcBridge.memory.confirm.provider(({ id }) => store.confirm(id));
  ipcBridge.memory.remove.provider(({ id }) => store.forget(id));
  ipcBridge.memory.restore.provider(({ id }) => store.restore(id));
  ipcBridge.memory.purge.provider(({ id }) => store.purge(id));
}
