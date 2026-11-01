/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  homography,
  PANEL,
  polygonCss,
  projectPoint,
  robotBox,
  SCREENS,
  screenTransform,
  SEAT,
  seatX,
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

describe('seating', () => {
  it('should centre a single robot on the table', () => {
    expect(seatX(0, 1)).toBe((SEAT.firstX + SEAT.lastX) / 2);
  });

  it('should spread robots from the first seat to the last', () => {
    expect([seatX(0, 6), seatX(5, 6)]).toEqual([SEAT.firstX, SEAT.lastX]);
  });

  it('should keep every pose seated on the same line behind the table top', () => {
    const bottoms = (['laptop', 'head-in-hands', 'hand-raised'] as const).map((pose) => {
      const box = robotBox(pose, 0, 3);
      return box.top + box.height;
    });

    expect(new Set(bottoms.map((b) => b.toFixed(6))).size).toBe(1);
  });
});

describe('polygonCss', () => {
  it('should turn picture coordinates into percentages', () => {
    expect(
      polygonCss([
        [0, 0],
        [1668, 943],
      ])
    ).toBe('polygon(0% 0%, 100% 100%)');
  });
});
