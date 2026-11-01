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
  robotBox,
  SCREENS,
  screenTransform,
  STAND,
  standX,
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
  it('should centre a single robot between the first and last spot', () => {
    expect(standX(0, 1)).toBe((STAND.firstX + STAND.lastX) / 2);
  });

  it('should spread robots from the first spot to the last', () => {
    expect([standX(0, 6), standX(5, 6)]).toEqual([STAND.firstX, STAND.lastX]);
  });

  it('should put the feet of every pose on the same floor line', () => {
    const feet = (['arms-crossed', 'laptop', 'head-in-hands', 'hand-raised'] as const).map((pose) => {
      const box = robotBox(pose, 0, 4);
      return box.top + box.height;
    });

    expect(feet.every((y) => Math.abs(y - STAND.feetY) < 1e-6)).toBe(true);
  });

  it('should draw a raised hand taller than the idle body at the same scale', () => {
    expect(robotBox('hand-raised', 0, 1).height).toBeGreaterThan(robotBox('arms-crossed', 0, 1).height);
    expect(robotBox('arms-crossed', 0, 1).height).toBe(STAND.bodyHeight);
  });

  it('should keep the last robot clear of the activity feed on the right', () => {
    const box = robotBox('laptop', 5, 6);

    expect(box.x + box.width / 2).toBeLessThan(GARAGE.width - 380 - 16);
  });
});

describe('percent helpers', () => {
  it('should turn picture coordinates into percentages', () => {
    expect([pctX(1668), pctY(943)]).toEqual([100, 100]);
  });
});
