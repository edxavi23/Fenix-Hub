/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Workshop.module.css';
import { STATUS_COLOR } from '../utils/statusColor';

type WorkshopHeaderProps = {
  working: number;
  idle: number;
  activityOpen: boolean;
  canOpenProjects: boolean;
  onProjects: () => void;
  onAgents: () => void;
  onToggleActivity: () => void;
  onClassicStart: () => void;
};

const WorkshopHeader: React.FC<WorkshopHeaderProps> = ({
  working,
  idle,
  activityOpen,
  canOpenProjects,
  onProjects,
  onAgents,
  onToggleActivity,
  onClassicStart,
}) => {
  const { t } = useTranslation();
  const tab = (active: boolean) => `${styles.tab} ${active ? styles.tabActive : ''}`;

  return (
    <header className={styles.header}>
      <Button type='text' className={tab(!activityOpen)} onClick={() => activityOpen && onToggleActivity()}>
        {t('workshop.tabs.workshop')}
      </Button>
      <Button type='text' className={tab(false)} disabled={!canOpenProjects} onClick={onProjects}>
        {t('workshop.tabs.projects')}
      </Button>
      <Button type='text' className={tab(false)} onClick={onAgents}>
        {t('workshop.tabs.agents')}
      </Button>
      <Button type='text' className={tab(activityOpen)} onClick={onToggleActivity}>
        {t('workshop.tabs.activity')}
      </Button>
      <span className={styles.live} role='status'>
        <i className={styles.dot} style={{ background: STATUS_COLOR.working }} />
        {t('workshop.liveCount', { working, idle })}
      </span>
      <Button type='text' size='small' className={styles.tab} onClick={onClassicStart}>
        {t('workshop.classicStart')}
      </Button>
    </header>
  );
};

export default WorkshopHeader;
