/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Where things sit in the garage picture (1668 x 943 px), and the math that maps a flat
 * HTML panel onto each angled lift screen.
 */

import type { LiftSlot, RobotPose } from './workshopModel';

export type Point = [number, number];
/** Corners in order: top left, top right, bottom right, bottom left. */
export type Quad = [Point, Point, Point, Point];

export const GARAGE = { width: 1668, height: 943 };

export const SCREENS: Record<LiftSlot, Quad> = {
  left: [
    [140, 196],
    [373, 193],
    [373, 358],
    [140, 362],
  ],
  midleft: [
    [491, 251],
    [611, 248],
    [611, 341],
    [491, 343],
  ],
  center: [
    [684, 177],
    [948, 177],
    [948, 352],
    [684, 352],
  ],
  midright: [
    [1021, 249],
    [1146, 252],
    [1146, 343],
    [1021, 345],
  ],
  right: [
    [1283, 201],
    [1525, 199],
    [1525, 360],
    [1283, 360],
  ],
};

/** The two small screens at the back only fit a name, status and progress. */
export const COMPACT_SLOTS = new Set<LiftSlot>(['midleft', 'midright']);
export const PANEL = { width: 600, height: 400 };

/**
 * Robots stand on the floor in front of the table, full body. Every sprite ends at the same
 * baseline (the feet), so one body scale keeps all poses the same size. Robots are laid out
 * side by side from their real widths, so two of them never overlap.
 */
export const STAND = {
  feetY: 850,
  bodyHeight: 360,
  /** Empty space between two neighbours, in picture px. */
  gap: 10,
  /** The row of robots is centred here, left of the activity feed. */
  centerX: 790,
  /** Tag rows above the heads; a tag also never sits lower than the top of its own robot. */
  tagRows: [484, 456] as const,
};

/** Sprite size in px (cropped tight, feet at the bottom edge) for each pose. */
export const ROBOT_SPRITE_SIZE: Record<RobotPose, { width: number; height: number }> = {
  'arms-crossed': { width: 266, height: 781 },
  laptop: { width: 304, height: 780 },
  'hand-raised': { width: 316, height: 805 },
  'head-in-hands': { width: 318, height: 775 },
};

export type RobotBox = { x: number; top: number; height: number; width: number };

/** Boxes of standing robots in picture px: x is the centre, top is the highest point (a raised hand counts). */
export function layoutRobots(poses: RobotPose[]): RobotBox[] {
  const scale = STAND.bodyHeight / ROBOT_SPRITE_SIZE['arms-crossed'].height;
  const sizes = poses.map((pose) => ({
    width: ROBOT_SPRITE_SIZE[pose].width * scale,
    height: ROBOT_SPRITE_SIZE[pose].height * scale,
  }));
  const total = sizes.reduce((sum, size) => sum + size.width, 0) + STAND.gap * Math.max(0, sizes.length - 1);
  let left = STAND.centerX - total / 2;
  return sizes.map((size) => {
    const box = { x: left + size.width / 2, top: STAND.feetY - size.height, height: size.height, width: size.width };
    left += size.width + STAND.gap;
    return box;
  });
}

/** Percent of the picture's width or height, for absolute positioning that scales with the window. */
export const pctX = (x: number): number => (x / GARAGE.width) * 100;
export const pctY = (y: number): number => (y / GARAGE.height) * 100;

function solveLinear(matrix: number[][], values: number[]): number[] {
  const a = matrix.map((row) => [...row]);
  const b = [...values];
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    if (Math.abs(a[col][col]) < 1e-12) throw new Error('Screen corners do not form a valid shape.');
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let k = col; k < n; k++) a[row][k] -= factor * a[col][k];
      b[row] -= factor * b[col];
    }
  }
  const x = Array.from({ length: n }, () => 0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k];
    x[row] = sum / a[row][row];
  }
  return x;
}

/** Homography coefficients [a..h] that map the w x h rectangle onto the quad. */
export function homography(width: number, height: number, quad: Quad): number[] {
  const source: Point[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const rows: number[][] = [];
  const values: number[] = [];
  source.forEach(([x, y], i) => {
    const [u, v] = quad[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  });
  return solveLinear(rows, values);
}

/** Where a point of the panel lands after the homography. Used by tests and hit checks. */
export function projectPoint(h: number[], x: number, y: number): Point {
  const [a, b, c, d, e, f, g, k] = h;
  const w = g * x + k * y + 1;
  return [(a * x + b * y + c) / w, (d * x + e * y + f) / w];
}

/** CSS matrix3d (column-major) for a panel of the given size, scaled to the current stage width. */
export function screenTransform(quad: Quad, scale: number, width = PANEL.width, height = PANEL.height): string {
  const scaled = quad.map(([x, y]) => [x * scale, y * scale]) as Quad;
  const [a, b, c, d, e, f, g, k] = homography(width, height, scaled);
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${k},0,0,1,0,${c},${f},0,1)`;
}
