/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MemoryEntryDto } from '@/common/types/memory';
import { Button, Popconfirm, Tag } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type MemoryAction = 'confirm' | 'remove' | 'restore' | 'purge';

type MemoryNoteRowProps = {
  entry: MemoryEntryDto;
  isLast: boolean;
  busy: boolean;
  onAction: (action: MemoryAction, id: string) => void;
};

const MemoryNoteRow: React.FC<MemoryNoteRowProps> = ({ entry, isLast, busy, onAction }) => {
  const { t } = useTranslation();
  const isHeld = entry.status === 'proposed';
  const isRemoved = entry.status === 'deleted';

  return (
    <div
      data-testid={`memory-note-${entry.id}`}
      className={`flex flex-col gap-8px px-16px py-12px ${isLast ? '' : 'border-b border-solid border-[var(--color-border-2)]'}`}
    >
      <div className='whitespace-pre-wrap break-words text-14px text-t-primary'>{entry.content}</div>
      <div className='flex flex-wrap items-center gap-8px text-12px text-t-secondary'>
        {isHeld ? (
          <Tag size='small' color='orangered'>
            {t('memory.outsideTag')}
          </Tag>
        ) : null}
        {entry.tags.map((tag) => (
          <Tag key={tag} size='small'>
            {tag}
          </Tag>
        ))}
        <span>{t('memory.byAuthor', { author: entry.author })}</span>
        <span>{new Date(entry.createdAt).toLocaleString()}</span>
        <span className='min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap'>
          {t('memory.sourceLabel', { source: entry.source })}
        </span>
      </div>
      <div className='flex items-center gap-8px'>
        {isHeld ? (
          <Button size='small' type='primary' disabled={busy} onClick={() => onAction('confirm', entry.id)}>
            {t('memory.confirm')}
          </Button>
        ) : null}
        {isRemoved ? (
          <Button size='small' type='secondary' disabled={busy} onClick={() => onAction('restore', entry.id)}>
            {t('memory.restore')}
          </Button>
        ) : (
          <Button size='small' type='secondary' disabled={busy} onClick={() => onAction('remove', entry.id)}>
            {t('memory.remove')}
          </Button>
        )}
        {isRemoved ? (
          <Popconfirm title={t('memory.purgeConfirm')} onOk={() => onAction('purge', entry.id)}>
            <Button size='small' status='danger' disabled={busy}>
              {t('memory.purge')}
            </Button>
          </Popconfirm>
        ) : null}
      </div>
    </div>
  );
};

export default MemoryNoteRow;
