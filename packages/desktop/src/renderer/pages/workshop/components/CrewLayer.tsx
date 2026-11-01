/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import garageUrl from '@renderer/assets/workshop/garage.webp';
import armsCrossed from '@renderer/assets/workshop/robots/arms-crossed.png';
import coffee from '@renderer/assets/workshop/robots/coffee.png';
import handRaised from '@renderer/assets/workshop/robots/hand-raised.png';
import headInHands from '@renderer/assets/workshop/robots/head-in-hands.png';
import inspect from '@renderer/assets/workshop/robots/inspect.png';
import laptop from '@renderer/assets/workshop/robots/laptop.png';
import leanBack from '@renderer/assets/workshop/robots/lean-back.png';
import pointUp from '@renderer/assets/workshop/robots/point-up.png';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Workshop.module.css';
import { STATUS_COLOR } from '../utils/statusColor';
import { pctX, pctY, polygonCss, robotBox, SEAT, TABLE_PIECES } from '../utils/workshopGeometry';
import { poseFor, type CrewMember, type RobotPose } from '../utils/workshopModel';

const ROBOT_IMAGES: Record<RobotPose, string> = {
  'point-up': pointUp,
  laptop,
  inspect,
  'lean-back': leanBack,
  'arms-crossed': armsCrossed,
  coffee,
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
    const pose = poseFor(member.status, index);
    return { member, pose, box: robotBox(pose, index, seated.length) };
  });
  const tableTop = TABLE_PIECES[0];

  return (
    <>
      <div className={styles.layer}>
        {placed.map(({ member, pose, box }) => (
          <div
            key={member.id}
            className={styles.robot}
            style={{ left: `${pctX(box.x)}%`, top: `${pctY(box.top)}%`, height: `${pctY(box.height)}%` }}
            data-testid='workshop-robot'
            data-pose={pose}
            onClick={() => onOpen(member.teamId)}
          >
            <img src={ROBOT_IMAGES[pose]} alt={member.name} draggable={false} />
          </div>
        ))}
      </div>

      {/* The table is drawn again above the robots, so it hides where each sprite is cut. */}
      <div className={styles.layer} aria-hidden='true'>
        {TABLE_PIECES.map((piece, index) => (
          <img key={index} className={styles.backdrop} src={garageUrl} alt='' style={{ clipPath: polygonCss(piece) }} />
        ))}
        <div className={`${styles.layer} ${styles.tableReflection}`} style={{ clipPath: polygonCss(tableTop) }}>
          {placed.map(({ member, pose, box }) => (
            <img
              key={member.id}
              src={ROBOT_IMAGES[pose]}
              alt=''
              style={{ left: `${pctX(box.x)}%`, top: `${pctY(tableTop[0][1])}%`, height: `${pctY(box.height)}%` }}
            />
          ))}
        </div>
      </div>

      <div className={styles.layer}>
        {placed.map(({ member, box }, index) => (
          <span
            key={member.id}
            className={styles.tag}
            style={{ left: `${pctX(box.x)}%`, top: `${pctY(SEAT.tagRows[index % 2])}%` }}
          >
            <i className={styles.dot} style={{ background: STATUS_COLOR[member.status] }} />
            <b>{member.name}</b>
            <small>{member.teamName}</small>
          </span>
        ))}
        {hiddenCount > 0 ? (
          <span className={styles.more} style={{ left: `${pctX(SEAT.lastX + 115)}%`, top: `${pctY(SEAT.y - 40)}%` }}>
            {t('workshop.moreAgents', { count: hiddenCount })}
          </span>
        ) : null}
        {seated.length === 0 ? (
          <span className={styles.more} style={{ left: '50%', top: `${pctY(SEAT.y - 60)}%` }}>
            {t('workshop.emptyTable')}
          </span>
        ) : null}
      </div>
    </>
  );
};

export default CrewLayer;
