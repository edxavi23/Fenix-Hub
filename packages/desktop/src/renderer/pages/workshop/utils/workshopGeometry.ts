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

/** Steel table pieces, redrawn above the robots so it hides where each sprite is cut. */
export const TABLE_PIECES: Point[][] = [
  [
    [470, 577],
    [1182, 577],
    [1208, 624],
    [1208, 642],
    [445, 642],
    [445, 624],
  ],
  [
    [446, 640],
    [481, 640],
    [481, 836],
    [446, 836],
  ],
  [
    [1171, 640],
    [1207, 640],
    [1207, 836],
    [1171, 836],
  ],
  [
    [478, 712],
    [1172, 712],
    [1178, 780],
    [472, 780],
  ],
  [
    [498, 640],
    [522, 640],
    [522, 782],
    [498, 782],
  ],
  [
    [1128, 640],
    [1152, 640],
    [1152, 782],
    [1128, 782],
  ],
];

/** Seated robots: the bottom of each sprite (its seat) sits hidden behind the table top. */
export const SEAT = { y: 606, robotHeight: 150, firstX: 515, lastX: 1150, tagRows: [416, 448] as const };

/** Sprite heights in px, so every pose is drawn at the same body scale. */
export const ROBOT_SPRITE_HEIGHT: Record<RobotPose, number> = {
  'point-up': 223,
  laptop: 203,
  inspect: 205,
  'lean-back': 205,
  'arms-crossed': 210,
  coffee: 194,
  'hand-raised': 217,
  'head-in-hands': 157,
};

export function seatX(index: number, count: number): number {
  if (count <= 1) return (SEAT.firstX + SEAT.lastX) / 2;
  return SEAT.firstX + (index * (SEAT.lastX - SEAT.firstX)) / (count - 1);
}

export function robotBox(pose: RobotPose, index: number, count: number): { x: number; top: number; height: number } {
  const height = SEAT.robotHeight * (ROBOT_SPRITE_HEIGHT[pose] / ROBOT_SPRITE_HEIGHT['arms-crossed']);
  return { x: seatX(index, count), top: SEAT.y - height, height };
}

/** Percent of the picture's width or height, for absolute positioning that scales with the window. */
export const pctX = (x: number): number => (x / GARAGE.width) * 100;
export const pctY = (y: number): number => (y / GARAGE.height) * 100;

export const polygonCss = (points: Point[]): string =>
  `polygon(${points.map(([x, y]) => `${pctX(x)}% ${pctY(y)}%`).join(', ')})`;

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
