/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { ITeamTaskItem, TeamAssistant, TTeam } from '@/common/types/team/teamTypes';
import {
  assignLifts,
  buildProject,
  countByStatus,
  crewStatus,
  MAX_SEATS,
  pickCrew,
  poseFor,
  projectStatus,
  taskProgress,
  type CrewMember,
  type WorkshopProject,
} from '@renderer/pages/workshop/utils/workshopModel';

const task = (id: string, status: string, created_at: number, updated_at = created_at): ITeamTaskItem => ({
  id,
  team_id: 't1',
  subject: `Task ${id}`,
  status,
  blocked_by: [],
  blocks: [],
  created_at,
  updated_at,
});

const assistant = (slot_id: string, status: TeamAssistant['status'], pending = 0): TeamAssistant => ({
  slot_id,
  conversation_id: `c-${slot_id}`,
  role: 'teammate',
  assistant_backend: 'claude',
  assistant_name: slot_id,
  status,
  pending_confirmations: pending,
  context_reset: { supported: false, availability: 'unsupported' },
});

const team = (id: string, assistants: TeamAssistant[], updated_at = 1): TTeam =>
  ({
    id,
    user_id: 'u',
    name: `Team ${id}`,
    workspace: '/w',
    workspace_mode: 'shared',
    leader_assistant_id: '',
    assistants,
    created_at: 0,
    updated_at,
  }) as TTeam;

const member = (name: string, status: CrewMember['status']): CrewMember => ({
  id: name,
  name,
  backend: 'claude',
  status,
  teamId: 't',
  teamName: 'T',
});

describe('crewStatus', () => {
  it('should treat a pending confirmation as needing the user, even while active', () => {
    expect(crewStatus({ status: 'active', pending_confirmations: 2 })).toBe('waiting');
  });

  it('should map active to working and failed to failed', () => {
    expect(crewStatus({ status: 'active' })).toBe('working');
    expect(crewStatus({ status: 'failed' })).toBe('failed');
  });

  it('should treat pending, dormant and completed agents as idle', () => {
    expect(
      ['pending', 'dormant', 'completed'].map((s) => crewStatus({ status: s as TeamAssistant['status'] }))
    ).toEqual(['idle', 'idle', 'idle']);
  });
});

describe('taskProgress', () => {
  it('should return no progress when the team has no tasks', () => {
    expect(taskProgress([])).toEqual({ tasks: [], progress: null });
  });

  it('should leave deleted tasks out of the list and the percentage', () => {
    const result = taskProgress([task('a', 'completed', 1), task('b', 'deleted', 2), task('c', 'pending', 3)]);

    expect(result.tasks.map((t) => t.id)).toEqual(['a', 'c']);
    expect(result.progress).toBe(50);
  });

  it('should mark the task in progress as current, not the first pending one', () => {
    const result = taskProgress([task('a', 'pending', 1), task('b', 'in_progress', 2)]);

    expect(result.tasks.map((t) => t.state)).toEqual(['todo', 'now']);
  });

  it('should mark the first unfinished task as current when nothing is in progress', () => {
    const result = taskProgress([task('a', 'completed', 1), task('b', 'pending', 2), task('c', 'pending', 3)]);

    expect(result.tasks.map((t) => t.state)).toEqual(['done', 'now', 'todo']);
  });

  it('should sort tasks by creation time whatever order they arrive in', () => {
    const result = taskProgress([task('late', 'pending', 9), task('early', 'pending', 1)]);

    expect(result.tasks[0].id).toBe('early');
  });
});

describe('projectStatus', () => {
  it('should put needs-you ahead of failed and working', () => {
    expect(projectStatus([member('a', 'working'), member('b', 'failed'), member('c', 'waiting')], [])).toBe('waiting');
  });

  it('should report done only when every task is finished and nobody is busy', () => {
    expect(projectStatus([member('a', 'idle')], [{ id: '1', subject: 's', state: 'done' }])).toBe('done');
    expect(projectStatus([member('a', 'idle')], [])).toBe('idle');
  });
});

describe('buildProject', () => {
  it('should use the latest task update as the last activity when it is newer than the team', () => {
    const project = buildProject(team('t1', [assistant('Fay', 'active')], 10), [task('a', 'pending', 1, 50)]);

    expect(project.lastActive).toBe(50);
  });

  it('should survive a team without an assistants list', () => {
    const broken = { ...team('t1', []), assistants: undefined } as unknown as TTeam;

    expect(buildProject(broken, []).crew).toEqual([]);
  });
});

describe('assignLifts', () => {
  const project = (id: string, lastActive: number) => ({ id, lastActive }) as WorkshopProject;

  it('should put the most recently active project on the center lift', () => {
    const lifts = assignLifts([project('old', 1), project('new', 9), project('mid', 5)]);

    expect(lifts[0]).toEqual({ slot: 'center', project: expect.objectContaining({ id: 'new' }) });
  });

  it('should leave lifts empty when there are fewer than five projects', () => {
    expect(assignLifts([project('only', 1)]).filter((lift) => lift.project === null)).toHaveLength(4);
  });

  it('should ignore projects beyond the five lifts', () => {
    const lifts = assignLifts(Array.from({ length: 8 }, (_, i) => project(`p${i}`, i)));

    expect(lifts.map((lift) => lift.project?.id)).toEqual(['p7', 'p6', 'p5', 'p4', 'p3']);
  });
});

describe('pickCrew', () => {
  const projects = (crew: CrewMember[]) => [{ crew } as WorkshopProject];

  it('should seat agents that need the user before working and idle ones', () => {
    const { seated } = pickCrew(projects([member('a', 'idle'), member('b', 'working'), member('c', 'waiting')]));

    expect(seated.map((m) => m.name)).toEqual(['c', 'b', 'a']);
  });

  it('should count the agents that do not fit at the table', () => {
    const crew = Array.from({ length: MAX_SEATS + 3 }, (_, i) => member(`m${i}`, 'idle'));

    expect(pickCrew(projects(crew)).hiddenCount).toBe(3);
  });

  it('should return an empty table when there are no agents', () => {
    expect(pickCrew([])).toEqual({ seated: [], hiddenCount: 0 });
  });
});

describe('poseFor', () => {
  it('should show one clear pose for each of the four statuses', () => {
    expect(poseFor('idle')).toBe('arms-crossed');
    expect(poseFor('working')).toBe('laptop');
    expect(poseFor('waiting')).toBe('hand-raised');
    expect(poseFor('failed')).toBe('head-in-hands');
  });
});

describe('countByStatus', () => {
  it('should count every status, including ones with no agents', () => {
    expect(countByStatus([member('a', 'working'), member('b', 'working')])).toEqual({
      working: 2,
      waiting: 0,
      failed: 0,
      idle: 0,
    });
  });
});
