/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Workshop.module.css';
import { STATUS_COLOR } from '../utils/statusColor';
import { COMPACT_SLOTS, SCREENS, screenTransform } from '../utils/workshopGeometry';
import type { LiftSlot, WorkshopProject } from '../utils/workshopModel';

const MAX_TASK_ROWS = 5;

type LiftScreenProps = {
  slot: LiftSlot;
  project: WorkshopProject | null;
  scale: number;
  onOpen: (teamId: string) => void;
};

const LiftScreen: React.FC<LiftScreenProps> = ({ slot, project, scale, onOpen }) => {
  const { t } = useTranslation();
  const transform = screenTransform(SCREENS[slot], scale);
  const compact = COMPACT_SLOTS.has(slot);

  if (!project) {
    return (
      <div className={`${styles.panel} ${styles.empty}`} style={{ transform }} data-testid={`lift-${slot}`}>
        <h3>{t('workshop.emptyLift')}</h3>
        {compact ? null : <div className={styles.muted}>{t('workshop.emptyLiftHint')}</div>}
      </div>
    );
  }

  const color = STATUS_COLOR[project.status];
  const progress = project.progress ?? 0;
  const working = project.crew.filter((member) => member.status === 'working').length;
  const open = () => onOpen(project.id);
  const dots = (
    <span className={styles.dots}>
      {project.crew.map((member) => (
        <i key={member.id} style={{ background: STATUS_COLOR[member.status] }} title={member.name} />
      ))}
    </span>
  );

  return (
    <div
      className={`${styles.panel} ${compact ? styles.compact : ''}`}
      style={{ transform }}
      role='button'
      tabIndex={0}
      aria-label={t('workshop.openProject', { name: project.name })}
      data-testid={`lift-${slot}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      {compact ? (
        <>
          <h3>{project.name}</h3>
          <span className={styles.chip} style={{ color }}>
            {t(`workshop.status.${project.status}`)}
          </span>
          <div className={styles.bar}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.compactRow}>
            <span>{project.progress === null ? '' : `${progress}%`}</span>
            {dots}
          </div>
        </>
      ) : (
        <>
          <div className={styles.panelHead}>
            <h3>{project.name}</h3>
            <span className={styles.chip} style={{ color }}>
              {t(`workshop.status.${project.status}`)}
            </span>
          </div>
          <div className={styles.panelBody}>
            <ul className={styles.tasks}>
              {project.tasks.length === 0 ? <li className={styles.task}>{t('workshop.noTasks')}</li> : null}
              {project.tasks.slice(0, MAX_TASK_ROWS).map((task) => (
                <li
                  key={task.id}
                  className={`${styles.task} ${task.state === 'done' ? styles.taskDone : ''} ${task.state === 'now' ? styles.taskNow : ''}`}
                >
                  <span className={styles.box}>{task.state === 'done' ? '✓' : ''}</span>
                  {task.subject}
                </li>
              ))}
            </ul>
            <div className={styles.side}>
              <div
                className={styles.ring}
                style={{ background: `conic-gradient(var(--ws-ember) ${progress}%, var(--ws-track) 0)` }}
              >
                <span>{project.progress === null ? '–' : `${progress}%`}</span>
              </div>
              {dots}
              <div className={styles.muted}>{t('workshop.crewWorking', { working, total: project.crew.length })}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LiftScreen;
