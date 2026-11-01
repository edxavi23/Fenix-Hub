/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Workshop: the start screen. Projects sit on the garage lifts with live status on their
 * screens, and agents sit at the table as robots whose pose shows what they are doing.
 */

import garageUrl from '@renderer/assets/workshop/garage.webp';
import { Spin } from '@arco-design/web-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ActivityFeed from './components/ActivityFeed';
import CrewLayer from './components/CrewLayer';
import LiftScreen from './components/LiftScreen';
import WorkshopHeader from './components/WorkshopHeader';
import styles from './Workshop.module.css';
import { useWorkshopData } from './useWorkshopData';
import { GARAGE } from './utils/workshopGeometry';
import { assignLifts, countByStatus, pickCrew } from './utils/workshopModel';

/** Stage width in px. Falls back to the picture's own width when layout has not measured yet. */
function useStageScale(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setScale(element.clientWidth > 0 ? element.clientWidth / GARAGE.width : 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, scale];
}

const WorkshopPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, activity, isLoading } = useWorkshopData();
  const [stageRef, scale] = useStageScale();
  const [activityOpen, setActivityOpen] = useState(false);

  const lifts = useMemo(() => assignLifts(projects), [projects]);
  const { seated, hiddenCount } = useMemo(() => pickCrew(projects), [projects]);
  const counts = useMemo(() => countByStatus(projects.flatMap((project) => project.crew)), [projects]);
  const openTeam = (teamId: string) => {
    Promise.resolve(navigate(`/team/${teamId}`)).catch(console.error);
  };
  const mainProject = lifts[0].project;

  return (
    <div className={styles.workshop}>
      <WorkshopHeader
        working={counts.working}
        idle={counts.idle}
        activityOpen={activityOpen}
        canOpenProjects={Boolean(mainProject)}
        onProjects={() => mainProject && openTeam(mainProject.id)}
        onAgents={() => Promise.resolve(navigate('/settings/agent')).catch(console.error)}
        onToggleActivity={() => setActivityOpen((open) => !open)}
        onClassicStart={() => Promise.resolve(navigate('/guid')).catch(console.error)}
      />
      <section ref={stageRef} className={styles.stage} aria-label={t('workshop.sceneLabel')}>
        <img className={styles.backdrop} src={garageUrl} alt='' draggable={false} />
        {isLoading ? (
          <div className={`${styles.layer} flex items-center justify-center`}>
            <Spin />
          </div>
        ) : (
          <>
            <div className={styles.layer}>
              {lifts.map(({ slot, project }) => (
                <LiftScreen key={slot} slot={slot} project={project} scale={scale} onOpen={openTeam} />
              ))}
            </div>
            <CrewLayer seated={seated} hiddenCount={hiddenCount} onOpen={openTeam} />
          </>
        )}
        <ActivityFeed items={activity} expanded={activityOpen} />
      </section>
    </div>
  );
};

export default WorkshopPage;
