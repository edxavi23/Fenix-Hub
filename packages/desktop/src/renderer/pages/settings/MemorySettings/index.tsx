/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { MemoryEntryDto, MemoryStatusDto } from '@/common/types/memory';
import { Empty, Message, Spin } from '@arco-design/web-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import SettingsPageHeader from '../components/SettingsPageHeader';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import MemoryNoteRow, { type MemoryAction } from './MemoryNoteRow';

type TabKey = 'held' | 'active' | 'removed';

const MEMORY_SWR_KEY = 'memory-notes';
/** Agents save notes while this page is open, so the list refreshes on its own. */
const REFRESH_MS = 5000;

const TAB_STATUS: Record<TabKey, MemoryStatusDto> = {
  held: 'proposed',
  active: 'confirmed',
  removed: 'deleted',
};

const ACTION_MESSAGE_KEY: Record<MemoryAction, 'confirmed' | 'removed' | 'restored' | 'purged'> = {
  confirm: 'confirmed',
  remove: 'removed',
  restore: 'restored',
  purge: 'purged',
};

const runAction = (action: MemoryAction, id: string): Promise<boolean> => ipcBridge.memory[action].invoke({ id });

const MemorySettings: React.FC = () => {
  const { t } = useTranslation();
  const { data, error, isLoading, mutate } = useSWR<MemoryEntryDto[]>(
    MEMORY_SWR_KEY,
    () => ipcBridge.memory.list.invoke(),
    {
      refreshInterval: REFRESH_MS,
    }
  );
  const [chosenTab, setChosenTab] = useState<TabKey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const byTab = useMemo(() => {
    const entries = data ?? [];
    return {
      held: entries.filter((entry) => entry.status === TAB_STATUS.held),
      active: entries.filter((entry) => entry.status === TAB_STATUS.active),
      removed: entries.filter((entry) => entry.status === TAB_STATUS.removed),
    };
  }, [data]);

  // Open on the review queue when something is waiting, otherwise on the active notes.
  const tab: TabKey = chosenTab ?? (byTab.held.length > 0 ? 'held' : 'active');
  const rows = byTab[tab];

  const handleAction = useCallback(
    async (action: MemoryAction, id: string) => {
      setBusyId(id);
      try {
        const done = await runAction(action, id);
        if (done) {
          Message.success(t(`memory.${ACTION_MESSAGE_KEY[action]}`));
        } else {
          Message.error(t('memory.actionFailed'));
        }
      } catch {
        Message.error(t('memory.actionFailed'));
      } finally {
        setBusyId(null);
        await mutate();
      }
    },
    [mutate, t]
  );

  return (
    <SettingsPageWrapper>
      <SettingsPageHeader
        title={t('memory.title')}
        description={t('memory.description')}
        tabs={[
          { key: 'held', label: t('memory.tabHeld'), count: byTab.held.length },
          { key: 'active', label: t('memory.tabActive'), count: byTab.active.length },
          { key: 'removed', label: t('memory.tabRemoved'), count: byTab.removed.length },
        ]}
        activeTab={tab}
        onTabChange={(key) => setChosenTab(key as TabKey)}
      />

      {isLoading ? (
        <div className='flex items-center justify-center py-64px'>
          <Spin />
        </div>
      ) : error ? (
        <div className='flex items-center justify-center py-64px'>
          <Empty description={t('memory.loadFailed')} />
        </div>
      ) : rows.length === 0 ? (
        <div className='flex items-center justify-center py-64px'>
          <Empty
            description={t(
              tab === 'held' ? 'memory.emptyHeld' : tab === 'active' ? 'memory.emptyActive' : 'memory.emptyRemoved'
            )}
          />
        </div>
      ) : (
        <div className='mt-18px overflow-hidden rd-12px border border-solid border-[var(--color-border-2)] bg-bg-1'>
          {rows.map((entry, index) => (
            <MemoryNoteRow
              key={entry.id}
              entry={entry}
              isLast={index === rows.length - 1}
              busy={busyId === entry.id}
              onAction={(action, id) => void handleAction(action, id)}
            />
          ))}
        </div>
      )}
    </SettingsPageWrapper>
  );
};

export default MemorySettings;
