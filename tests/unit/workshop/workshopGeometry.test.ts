/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  GARAGE,
  homography,
  PANEL,
  pctX,
  pctY,
  projectPoint,
  layoutRobots,
  SCREENS,
  screenTransform,
  STAND,
  type Quad,
} from '@renderer/pages/workshop/utils/workshopGeometry';

const translateX = (css: string) => Number(css.slice('matrix3d('.length, -1).split(',')[12]);

describe('homography', () => {
  it.each(Object.entries(SCREENS))('should land the panel corners on the %s screen corners', (_slot, quad) => {
    const h = homography(PANEL.width, PANEL.height, quad);
    const corners: Array<[number, number]> = [
      [0, 0],
      [PANEL.width, 0],
      [PANEL.width, PANEL.height],
      [0, PANEL.height],
    ];

    corners.forEach(([x, y], i) => {
      const [u, v] = projectPoint(h, x, y);
      expect(u).toBeCloseTo(quad[i][0], 6);
      expect(v).toBeCloseTo(quad[i][1], 6);
    });
  });

  it('should refuse corners that collapse onto one line', () => {
    const flat: Quad = [
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ];

    expect(() => homography(100, 100, flat)).toThrow(/valid shape/);
  });
});

describe('screenTransform', () => {
  it('should produce a CSS matrix3d with sixteen finite numbers', () => {
    const css = screenTransform(SCREENS.center, 0.5);
    const numbers = css.slice('matrix3d('.length, -1).split(',').map(Number);

    expect(numbers).toHaveLength(16);
    expect(numbers.every(Number.isFinite)).toBe(true);
  });

  it('should scale the target with the stage width', () => {
    expect(translateX(screenTransform(SCREENS.center, 0.5))).toBeCloseTo(SCREENS.center[0][0] * 0.5, 6);
  });
});

describe('standing', () => {
  const ALL = ['arms-crossed', 'laptop', 'hand-raised', 'head-in-hands'] as const;
  const sixLaptops = Array.from({ length: 6 }, () => 'head-in-hands' as const);

  it('should centre a single robot on the row centre', () => {
    expect(layoutRobots(['laptop'])[0].x).toBeCloseTo(STAND.centerX, 6);
  });

  it('should return no boxes for no robots', () => {
    expect(layoutRobots([])).toEqual([]);
  });

  it.each([[[...ALL]], [[...ALL, ...ALL]], [sixLaptops]])('should never let two robots touch: %j', (poses) => {
    const boxes = layoutRobots(poses);

    boxes.slice(1).forEach((box, i) => {
      const previous = boxes[i];
      expect(box.x - box.width / 2 - (previous.x + previous.width / 2)).toBeGreaterThanOrEqual(STAND.gap - 1e-6);
    });
  });

  it('should put the feet of every pose on the same floor line', () => {
    const feet = layoutRobots([...ALL]).map((box) => box.top + box.height);

    expect(feet.every((y) => Math.abs(y - STAND.feetY) < 1e-6)).toBe(true);
  });

  it('should draw a raised hand taller than the idle body at the same scale', () => {
    const [idle, raised] = layoutRobots(['arms-crossed', 'hand-raised']);

    expect(raised.height).toBeGreaterThan(idle.height);
    expect(idle.height).toBeCloseTo(STAND.bodyHeight, 6);
  });

  it('should keep the widest row of six clear of the activity feed on the right', () => {
    const boxes = layoutRobots(sixLaptops);
    const last = boxes[boxes.length - 1];

    expect(last.x + last.width / 2).toBeLessThan(GARAGE.width - 380 - 16);
  });
});

describe('percent helpers', () => {
  it('should turn picture coordinates into percentages', () => {
    expect([pctX(1668), pctY(943)]).toEqual([100, 100]);
  });
});
