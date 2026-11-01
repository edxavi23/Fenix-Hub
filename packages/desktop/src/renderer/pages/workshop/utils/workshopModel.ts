/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure mapping from team data to what the Workshop scene shows:
 * which project sits on which lift, each project's status and progress,
 * and which agents stand in front of the table in which pose.
 */

import type { ITeamTaskItem, TeamAssistant, TTeam } from '@/common/types/team/teamTypes';

export type CrewStatus = 'working' | 'waiting' | 'failed' | 'idle';
export type ProjectStatus = 'working' | 'waiting' | 'failed' | 'done' | 'idle';
export type LiftSlot = 'center' | 'left' | 'right' | 'midleft' | 'midright';
export type RobotPose = 'arms-crossed' | 'laptop' | 'hand-raised' | 'head-in-hands';

export type WorkshopTask = { id: string; subject: string; state: 'done' | 'now' | 'todo' };

export type CrewMember = {
  id: string;
  name: string;
  backend: string;
  status: CrewStatus;
  teamId: string;
  teamName: string;
};

export type WorkshopProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  tasks: WorkshopTask[];
  /** Share of finished tasks from 0 to 100, or null when the team has no tasks. */
  progress: number | null;
  crew: CrewMember[];
  lastActive: number;
};

/** Most important lift first: the center lift is the one the user watches. */
export const LIFT_ORDER: LiftSlot[] = ['center', 'left', 'right', 'midleft', 'midright'];
export const MAX_SEATS = 6;

const CREW_PRIORITY: Record<CrewStatus, number> = { waiting: 0, failed: 1, working: 2, idle: 3 };

export function crewStatus(assistant: Pick<TeamAssistant, 'status' | 'pending_confirmations'>): CrewStatus {
  if ((assistant.pending_confirmations ?? 0) > 0) return 'waiting';
  if (assistant.status === 'failed') return 'failed';
  if (assistant.status === 'active') return 'working';
  return 'idle';
}

/** Tasks in creation order, without deleted ones. The first unfinished task in progress is "now". */
export function taskProgress(tasks: ITeamTaskItem[]): { tasks: WorkshopTask[]; progress: number | null } {
  const live = tasks.filter((task) => task.status !== 'deleted').toSorted((a, b) => a.created_at - b.created_at);
  if (live.length === 0) return { tasks: [], progress: null };
  const nowIndex = Math.max(
    live.findIndex((task) => task.status === 'in_progress'),
    live.findIndex((task) => task.status !== 'completed')
  );
  const mapped = live.map((task, index): WorkshopTask => {
    const state = task.status === 'completed' ? 'done' : index === nowIndex ? 'now' : 'todo';
    return { id: task.id, subject: task.subject, state };
  });
  const done = mapped.filter((task) => task.state === 'done').length;
  return { tasks: mapped, progress: Math.round((done / live.length) * 100) };
}

export function projectStatus(crew: CrewMember[], tasks: WorkshopTask[]): ProjectStatus {
  if (crew.some((member) => member.status === 'waiting')) return 'waiting';
  if (crew.some((member) => member.status === 'failed')) return 'failed';
  if (crew.some((member) => member.status === 'working')) return 'working';
  if (tasks.length > 0 && tasks.every((task) => task.state === 'done')) return 'done';
  return 'idle';
}

export function buildProject(team: TTeam, tasks: ITeamTaskItem[]): WorkshopProject {
  const crew = (team.assistants ?? []).map(
    (assistant): CrewMember => ({
      id: `${team.id}:${assistant.slot_id}`,
      name: assistant.assistant_name,
      backend: assistant.assistant_backend,
      status: crewStatus(assistant),
      teamId: team.id,
      teamName: team.name,
    })
  );
  const { tasks: mapped, progress } = taskProgress(tasks);
  const lastTask = tasks.reduce((latest, task) => Math.max(latest, task.updated_at), 0);
  return {
    id: team.id,
    name: team.name,
    status: projectStatus(crew, mapped),
    tasks: mapped,
    progress,
    crew,
    lastActive: Math.max(team.updated_at ?? 0, lastTask),
  };
}

/** The most recently active projects take the lifts, most important lift first. */
export function assignLifts(projects: WorkshopProject[]): Array<{ slot: LiftSlot; project: WorkshopProject | null }> {
  const ranked = projects.toSorted((a, b) => b.lastActive - a.lastActive);
  return LIFT_ORDER.map((slot, index) => ({ slot, project: ranked[index] ?? null }));
}

/** Agents that need attention get a seat first; the rest are counted. */
export function pickCrew(projects: WorkshopProject[], max = MAX_SEATS): { seated: CrewMember[]; hiddenCount: number } {
  const all = projects.flatMap((project) => project.crew);
  const ranked = all.toSorted(
    (a, b) => CREW_PRIORITY[a.status] - CREW_PRIORITY[b.status] || a.name.localeCompare(b.name)
  );
  return { seated: ranked.slice(0, max), hiddenCount: Math.max(0, ranked.length - max) };
}

const POSE_BY_STATUS: Record<CrewStatus, RobotPose> = {
  idle: 'arms-crossed',
  working: 'laptop',
  waiting: 'hand-raised',
  failed: 'head-in-hands',
};

export function poseFor(status: CrewStatus): RobotPose {
  return POSE_BY_STATUS[status];
}

export function countByStatus(crew: CrewMember[]): Record<CrewStatus, number> {
  const counts: Record<CrewStatus, number> = { working: 0, waiting: 0, failed: 0, idle: 0 };
  for (const member of crew) counts[member.status] += 1;
  return counts;
}
