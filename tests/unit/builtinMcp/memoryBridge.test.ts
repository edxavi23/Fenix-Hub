/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (params?: unknown) => Promise<unknown> | unknown;
const handlers = new Map<string, Handler>();

vi.mock('@/common', () => {
  const provider = (name: string) => ({
    provider: (handler: Handler) => {
      handlers.set(name, handler);
    },
  });
  return {
    ipcBridge: {
      memory: {
        list: provider('list'),
        confirm: provider('confirm'),
        remove: provider('remove'),
        restore: provider('restore'),
        purge: provider('purge'),
      },
    },
  };
});

vi.mock('@process/utils/utils', () => ({ getMemoryDir: () => '/unused' }));

import { MemoryStore } from '@process/resources/builtinMcp/memoryStore';
import { initMemoryBridge } from '@process/bridge/memoryBridge';

describe('memory bridge', () => {
  let dir: string;
  let store: MemoryStore;
  const call = (name: string, params?: unknown) => Promise.resolve(handlers.get(name)?.(params));

  beforeEach(async () => {
    handlers.clear();
    dir = await mkdtemp(path.join(os.tmpdir(), 'memory-bridge-'));
    store = new MemoryStore(dir);
    initMemoryBridge(store);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('should register all five review actions', () => {
    expect([...handlers.keys()].toSorted()).toEqual(['confirm', 'list', 'purge', 'remove', 'restore']);
  });

  it('should list notes of every status, including held and forgotten ones', async () => {
    await store.save({ content: 'active note' });
    await store.save({ content: 'held note', source: 'web:https://example.com' });
    const gone = await store.save({ content: 'gone note' });
    await store.forget(gone.id);

    const notes = (await call('list')) as Array<{ status: string }>;

    expect(notes.map((note) => note.status).toSorted()).toEqual(['confirmed', 'deleted', 'proposed']);
  });

  it('should make a held note visible to agents only after confirm', async () => {
    const held = await store.save({ content: 'release steps', source: 'email:inbox' });
    expect(await store.search('release')).toEqual([]);

    expect(await call('confirm', { id: held.id })).toBe(true);

    expect(await store.search('release')).toHaveLength(1);
  });

  it('should hide a note from agents on remove and bring it back on restore', async () => {
    const entry = await store.save({ content: 'temporary decision' });

    await call('remove', { id: entry.id });
    expect(await store.search('decision')).toEqual([]);

    await call('restore', { id: entry.id });
    expect(await store.search('decision')).toHaveLength(1);
  });

  it('should only erase notes that were removed first', async () => {
    const entry = await store.save({ content: 'important fact' });

    expect(await call('purge', { id: entry.id })).toBe(false);
    await call('remove', { id: entry.id });
    expect(await call('purge', { id: entry.id })).toBe(true);
  });

  it('should reject an id that tries to leave the memory folder', async () => {
    await expect(call('remove', { id: '../../secrets' })).rejects.toThrow(/Invalid memory id/);
  });
});
