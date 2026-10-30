/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared memory notes as the review screen sees them.
 * `proposed` notes came from an untrusted source and wait for a person to confirm them.
 * `deleted` notes are hidden from agents but can still be restored.
 */
export type MemoryStatusDto = 'confirmed' | 'proposed' | 'deleted';

export type MemoryEntryDto = {
  id: string;
  content: string;
  tags: string[];
  author: string;
  source: string;
  status: MemoryStatusDto;
  createdAt: string;
  updatedAt: string;
};
