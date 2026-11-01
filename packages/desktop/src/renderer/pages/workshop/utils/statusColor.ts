/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CrewStatus, ProjectStatus } from './workshopModel';

/** CSS variables defined on the Workshop root in Workshop.module.css. */
export const STATUS_COLOR: Record<CrewStatus | ProjectStatus | 'user', string> = {
  working: 'var(--ws-working)',
  waiting: 'var(--ws-waiting)',
  failed: 'var(--ws-failed)',
  idle: 'var(--ws-idle)',
  done: 'var(--ws-done)',
  user: 'var(--ws-ember)',
};
