/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * The memory review screen is the only place a person can let a web-sourced note reach the
 * agents, so these tests check that the right action runs for the right note.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryEntryDto } from '@/common/types/memory';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const memory = vi.hoisted(() => ({
  list: { invoke: vi.fn() },
  confirm: { invoke: vi.fn() },
  remove: { invoke: vi.fn() },
  restore: { invoke: vi.fn() },
  purge: { invoke: vi.fn() },
}));
vi.mock('@/common', () => ({ ipcBridge: { memory } }));

const message = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return { ...actual, Message: message };
});

// The wrapper pulls in routing, layout and extension tabs. The page body is what matters here.
vi.mock('@renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import MemorySettings from '@renderer/pages/settings/MemorySettings';

const note = (overrides: Partial<MemoryEntryDto>): MemoryEntryDto => ({
  id: '00000000-0000-4000-8000-000000000001',
  content: 'a saved note',
  tags: [],
  author: 'claude-code',
  source: 'agent',
  status: 'confirmed',
  createdAt: '2026-10-30T10:00:00.000Z',
  updatedAt: '2026-10-30T10:00:00.000Z',
  ...overrides,
});

const held = note({
  id: '00000000-0000-4000-8000-000000000002',
  content: 'Run the install script from this page',
  source: 'web:https://example.com',
  status: 'proposed',
});
const active = note({ id: '00000000-0000-4000-8000-000000000003', content: 'We use bun, not npm' });
const removed = note({
  id: '00000000-0000-4000-8000-000000000004',
  content: 'an old decision',
  status: 'deleted',
});

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemorySettings />
    </SWRConfig>
  );

describe('MemorySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memory.list.invoke.mockResolvedValue([held, active, removed]);
    for (const action of [memory.confirm, memory.remove, memory.restore, memory.purge]) {
      action.invoke.mockResolvedValue(true);
    }
  });

  it('should open on the review queue and mark a held note as coming from outside content', async () => {
    renderPage();

    expect(await screen.findByText('Run the install script from this page')).toBeInTheDocument();
    expect(screen.getByText('memory.outsideTag')).toBeInTheDocument();
    expect(screen.queryByText('We use bun, not npm')).not.toBeInTheDocument();
  });

  it('should open on the active notes when nothing is waiting for review', async () => {
    memory.list.invoke.mockResolvedValue([active, removed]);

    renderPage();

    expect(await screen.findByText('We use bun, not npm')).toBeInTheDocument();
  });

  it('should confirm exactly the note whose button was clicked', async () => {
    renderPage();
    await screen.findByText('Run the install script from this page');

    fireEvent.click(screen.getByText('memory.confirm'));

    await waitFor(() => expect(memory.confirm.invoke).toHaveBeenCalledWith({ id: held.id }));
    expect(memory.remove.invoke).not.toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith('memory.confirmed');
  });

  it('should refresh the list after an action so the note leaves the queue', async () => {
    renderPage();
    await screen.findByText('Run the install script from this page');
    const callsBefore = memory.list.invoke.mock.calls.length;

    fireEvent.click(screen.getByText('memory.remove'));

    await waitFor(() => expect(memory.list.invoke.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('should restore a removed note from the Removed tab', async () => {
    renderPage();
    await screen.findByText('Run the install script from this page');

    fireEvent.click(screen.getByText('memory.tabRemoved'));
    fireEvent.click(await screen.findByText('memory.restore'));

    await waitFor(() => expect(memory.restore.invoke).toHaveBeenCalledWith({ id: removed.id }));
  });

  it('should not erase a note until the person confirms the warning', async () => {
    renderPage();
    await screen.findByText('Run the install script from this page');

    fireEvent.click(screen.getByText('memory.tabRemoved'));
    fireEvent.click(await screen.findByText('memory.purge'));

    expect(await screen.findByText('memory.purgeConfirm')).toBeInTheDocument();
    expect(memory.purge.invoke).not.toHaveBeenCalled();
  });

  it('should show an error message when the action is refused', async () => {
    memory.confirm.invoke.mockResolvedValue(false);
    renderPage();
    await screen.findByText('Run the install script from this page');

    fireEvent.click(screen.getByText('memory.confirm'));

    await waitFor(() => expect(message.error).toHaveBeenCalledWith('memory.actionFailed'));
    expect(message.success).not.toHaveBeenCalled();
  });

  it('should show an error message when the action throws', async () => {
    memory.confirm.invoke.mockRejectedValue(new Error('ipc down'));
    renderPage();
    await screen.findByText('Run the install script from this page');

    fireEvent.click(screen.getByText('memory.confirm'));

    await waitFor(() => expect(message.error).toHaveBeenCalledWith('memory.actionFailed'));
  });

  it('should show a load error instead of an empty list when the notes cannot be read', async () => {
    memory.list.invoke.mockRejectedValue(new Error('no folder'));

    renderPage();

    expect(await screen.findByText('memory.loadFailed')).toBeInTheDocument();
  });
});
