/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Workshop.module.css';
import type { WorkshopActivity } from '../useWorkshopData';
import { STATUS_COLOR } from '../utils/statusColor';

const COLLAPSED_ROWS = 3;
const EXPANDED_ROWS = 15;

/** Short relative time. Timestamps from the backend are in milliseconds. */
export function timeAgoKey(at: number, now: number): { key: string; count: number } {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return { key: 'workshop.time.now', count: 0 };
  if (minutes < 60) return { key: 'workshop.time.minutes', count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { key: 'workshop.time.hours', count: hours };
  return { key: 'workshop.time.days', count: Math.floor(hours / 24) };
}

type ActivityFeedProps = { items: WorkshopActivity[]; expanded: boolean };

const ActivityFeed: React.FC<ActivityFeedProps> = ({ items, expanded }) => {
  const { t } = useTranslation();
  const now = Date.now();
  const rows = items.slice(0, expanded ? EXPANDED_ROWS : COLLAPSED_ROWS);

  return (
    <aside className={`${styles.feed} ${expanded ? styles.feedExpanded : ''}`} aria-label={t('workshop.tabs.activity')}>
      {rows.length === 0 ? <div className={styles.feedRow}>{t('workshop.activityEmpty')}</div> : null}
      {rows.map((item) => {
        const ago = timeAgoKey(item.at, now);
        return (
          <div key={item.id} className={styles.feedRow}>
            <i className={styles.dot} style={{ background: STATUS_COLOR[item.whoStatus] }} />
            <b>{item.who || t('workshop.you')}</b>
            <span title={item.text}>{item.text}</span>
            <em>{t(ago.key, { count: ago.count })}</em>
          </div>
        );
      })}
    </aside>
  );
};

export default ActivityFeed;
