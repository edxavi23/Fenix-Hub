/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * File-backed store for the shared agent memory.
 *
 * Every memory is one JSON file named `<uuid>.json`. Several agents each start their own
 * MCP server process against the same folder, so entries are written once to a temporary
 * file and renamed into place. Two processes never write the same file at the same time.
 *
 * This module only uses Node built-ins so it can run inside the standalone stdio process.
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const MAX_CONTENT_CHARS = 2000;
export const MAX_TAGS = 10;
export const MAX_TAG_CHARS = 40;
export const MAX_RESULTS = 20;
export const DEFAULT_RESULTS = 10;

/**
 * Sources that start with one of these prefixes came from content the user does not
 * control (web pages, email, other bots). Entries from them are held as `proposed` and
 * stay out of agent context until a person confirms them in the app.
 */
const UNTRUSTED_SOURCE_PREFIXES = [
  'web:',
  'browser:',
  'email:',
  'inbox:',
  'url:',
  'http://',
  'https://',
  'bot-message:',
];

/** Obvious credential shapes. Memory is shared between agents, so secrets must never enter it. */
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
];

const ENTRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const memoryEntrySchema = z.object({
  id: z.string().regex(ENTRY_ID_PATTERN),
  content: z.string(),
  tags: z.array(z.string()),
  author: z.string(),
  source: z.string(),
  status: z.enum(['confirmed', 'proposed', 'deleted']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MemoryEntry = z.infer<typeof memoryEntrySchema>;
export type MemoryStatus = MemoryEntry['status'];

export type SaveMemoryInput = {
  content: string;
  tags?: string[];
  /** Who is saving. Self-reported by the agent, so it is a label and not proof of identity. */
  author?: string;
  /** Where the information came from, for example `user`, `task`, or `web:https://example.com`. */
  source?: string;
};

export class MemoryError extends Error {}

export function isUntrustedSource(source: string): boolean {
  const normalized = source.trim().toLowerCase();
  return UNTRUSTED_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1);
}

function normalizeTags(tags: string[] | undefined): string[] {
  const unique = new Set<string>();
  for (const tag of tags ?? []) {
    const normalized = tag.trim().toLowerCase().slice(0, MAX_TAG_CHARS);
    if (normalized) unique.add(normalized);
  }
  if (unique.size > MAX_TAGS) {
    throw new MemoryError(`Too many tags. Use at most ${MAX_TAGS}.`);
  }
  return [...unique];
}

export class MemoryStore {
  constructor(private readonly dir: string) {}

  /** Save a note. Notes from untrusted sources are held as `proposed`. */
  async save(input: SaveMemoryInput): Promise<MemoryEntry> {
    const content = (input.content ?? '').trim();
    if (!content) throw new MemoryError('Memory content is empty.');
    if (content.length > MAX_CONTENT_CHARS) {
      throw new MemoryError(`Memory is too long (${content.length} characters). The limit is ${MAX_CONTENT_CHARS}.`);
    }
    if (looksLikeSecret(content)) {
      throw new MemoryError('This looks like a secret (key, token, or password). Secrets must not be saved to memory.');
    }

    const source = (input.source ?? 'agent').trim() || 'agent';
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: randomUUID(),
      content,
      tags: normalizeTags(input.tags),
      author: (input.author ?? 'unknown').trim().slice(0, 60) || 'unknown',
      source: source.slice(0, 300),
      status: isUntrustedSource(source) ? 'proposed' : 'confirmed',
      createdAt: now,
      updatedAt: now,
    };
    await this.write(entry);
    return entry;
  }

  /** Search confirmed notes. Best matches first, newest first on ties. */
  async search(query: string, limit: number = DEFAULT_RESULTS): Promise<MemoryEntry[]> {
    const queryTokens = new Set(tokenize(query));
    if (queryTokens.size === 0) return [];

    const scored: Array<{ entry: MemoryEntry; score: number }> = [];
    for (const entry of await this.readAll()) {
      if (entry.status !== 'confirmed') continue;
      const textTokens = new Set(tokenize(entry.content));
      const tagTokens = new Set(entry.tags.flatMap(tokenize));
      let score = 0;
      for (const token of queryTokens) {
        if (textTokens.has(token)) score += 1;
        if (tagTokens.has(token)) score += 2;
      }
      if (score > 0) scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score || b.entry.createdAt.localeCompare(a.entry.createdAt));
    return scored.slice(0, clampLimit(limit)).map((item) => item.entry);
  }

  /** Newest confirmed notes. */
  async recent(limit: number = DEFAULT_RESULTS): Promise<MemoryEntry[]> {
    const confirmed = (await this.readAll()).filter((entry) => entry.status === 'confirmed');
    confirmed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return confirmed.slice(0, clampLimit(limit));
  }

  /** Notes waiting for a person to confirm. Not exposed to agents. */
  async proposed(): Promise<MemoryEntry[]> {
    const proposed = (await this.readAll()).filter((entry) => entry.status === 'proposed');
    return proposed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Soft delete. The file stays on disk so a person can recover it. */
  async forget(id: string): Promise<boolean> {
    return this.setStatus(id, 'deleted', ['confirmed', 'proposed']);
  }

  /** Confirm a proposed note. Meant for the app UI only and never exposed as an agent tool. */
  async confirm(id: string): Promise<boolean> {
    return this.setStatus(id, 'confirmed', ['proposed']);
  }

  private async setStatus(id: string, status: MemoryStatus, allowedFrom: MemoryStatus[]): Promise<boolean> {
    const entry = await this.read(id);
    if (!entry || !allowedFrom.includes(entry.status)) return false;
    await this.write({ ...entry, status, updatedAt: new Date().toISOString() });
    return true;
  }

  private entryPath(id: string): string {
    // The id becomes part of a file path, so it must match the strict pattern first.
    if (!ENTRY_ID_PATTERN.test(id)) throw new MemoryError('Invalid memory id.');
    return path.join(this.dir, `${id}.json`);
  }

  private async read(id: string): Promise<MemoryEntry | null> {
    try {
      const raw = await fs.readFile(this.entryPath(id), 'utf8');
      const parsed = memoryEntrySchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch (error) {
      if (error instanceof MemoryError) throw error;
      return null;
    }
  }

  private async write(entry: MemoryEntry): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const target = this.entryPath(entry.id);
    const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(entry, null, 2), 'utf8');
    await fs.rename(temp, target);
  }

  /** Read every valid entry. Damaged or foreign files are skipped, never fatal. */
  private async readAll(): Promise<MemoryEntry[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.dir);
    } catch {
      return [];
    }

    const entries = await Promise.all(
      names
        .filter((name) => name.endsWith('.json'))
        .map((name) => this.read(name.slice(0, -'.json'.length)).catch((): null => null))
    );
    return entries.filter((entry): entry is MemoryEntry => entry !== null);
  }
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_RESULTS;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_RESULTS);
}
