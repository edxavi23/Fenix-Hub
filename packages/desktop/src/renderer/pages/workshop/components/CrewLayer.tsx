/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import armsCrossed from '@renderer/assets/workshop/robots/arms-crossed.png';
import handRaised from '@renderer/assets/workshop/robots/hand-raised.png';
import headInHands from '@renderer/assets/workshop/robots/head-in-hands.png';
import laptop from '@renderer/assets/workshop/robots/laptop.png';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Workshop.module.css';
import { STATUS_COLOR } from '../utils/statusColor';
import { pctX, pctY, robotBox, STAND } from '../utils/workshopGeometry';
import { poseFor, type CrewMember, type RobotPose } from '../utils/workshopModel';

const ROBOT_IMAGES: Record<RobotPose, string> = {
  'arms-crossed': armsCrossed,
  laptop,
  'hand-raised': handRaised,
  'head-in-hands': headInHands,
};

type CrewLayerProps = {
  seated: CrewMember[];
  hiddenCount: number;
  onOpen: (teamId: string) => void;
};

const CrewLayer: React.FC<CrewLayerProps> = ({ seated, hiddenCount, onOpen }) => {
  const { t } = useTranslation();
  const placed = seated.map((member, index) => {
    const pose = poseFor(member.status);
    return { member, pose, box: robotBox(pose, index, seated.length) };
  });

  return (
    <>
      <div className={styles.layer}>
        {placed.map(({ member, pose, box }) => (
          <div
            key={member.id}
            className={styles.robot}
            style={{
              left: `${pctX(box.x)}%`,
              top: `${pctY(box.top)}%`,
              height: `${pctY(box.height)}%`,
              aspectRatio: `${box.width} / ${box.height}`,
            }}
            data-testid='workshop-robot'
            data-pose={pose}
            onClick={() => onOpen(member.teamId)}
          >
            <img src={ROBOT_IMAGES[pose]} alt={member.name} draggable={false} />
          </div>
        ))}
      </div>

      <div className={styles.layer}>
        {placed.map(({ member, box }, index) => (
          <span
            key={member.id}
            className={styles.tag}
            style={{ left: `${pctX(box.x)}%`, top: `${pctY(Math.min(STAND.tagRows[index % 2], box.top - 6))}%` }}
          >
            <i className={styles.dot} style={{ background: STATUS_COLOR[member.status] }} />
            <b>{member.name}</b>
            <small>{member.teamName}</small>
          </span>
        ))}
        {hiddenCount > 0 ? (
          <span
            className={styles.more}
            style={{ left: `${pctX(STAND.lastX + 150)}%`, top: `${pctY(STAND.feetY - 200)}%` }}
          >
            {t('workshop.moreAgents', { count: hiddenCount })}
          </span>
        ) : null}
        {seated.length === 0 ? (
          <span className={styles.more} style={{ left: '50%', top: `${pctY(STAND.feetY - 200)}%` }}>
            {t('workshop.emptyTable')}
          </span>
        ) : null}
      </div>
    </>
  );
};

export default CrewLayer;
