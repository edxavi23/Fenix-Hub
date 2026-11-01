/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ITeamActivityItem, ITeamActivityPage, ITeamTaskItem, TTeam } from '@/common/types/team/teamTypes';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { buildProject, crewStatus, type CrewStatus, type WorkshopProject } from './utils/workshopModel';

/** The scene shows live status, so it polls instead of waiting for list-change events only. */
const REFRESH_MS = 10_000;
const ACTIVITY_PER_TEAM = 6;

export type WorkshopActivity = {
  id: string;
  who: string;
  whoStatus: CrewStatus | 'user';
  text: string;
  at: number;
};

function describeActivity(team: TTeam, item: ITeamActivityItem): WorkshopActivity {
  const bySlot = new Map((team.assistants ?? []).map((a) => [a.slot_id, a]));
  if (item.kind === 'message') {
    const sender = bySlot.get(item.message.from_agent_id);
    return {
      id: `${team.id}:${item.id}`,
      who: sender?.assistant_name ?? '',
      whoStatus: sender ? crewStatus(sender) : 'user',
      text: (item.message.summary || item.message.content).replace(/\s+/g, ' ').trim(),
      at: item.created_at,
    };
  }
  const owner = item.task.owner ? bySlot.get(item.task.owner) : undefined;
  return {
    id: `${team.id}:${item.id}`,
    who: owner?.assistant_name ?? team.name,
    whoStatus: owner ? crewStatus(owner) : 'idle',
    text: item.task.subject,
    at: item.created_at,
  };
}

export function useWorkshopData(): {
  projects: WorkshopProject[];
  activity: WorkshopActivity[];
  isLoading: boolean;
  error: unknown;
} {
  const { user } = useAuth();
  const userId = user?.id ?? 'system_default_user';

  const teamsQuery = useSWR<TTeam[]>(
    ['workshop-teams', userId],
    () => ipcBridge.team.list.invoke({ user_id: userId }),
    {
      refreshInterval: REFRESH_MS,
    }
  );
  const teams = teamsQuery.data ?? [];
  const teamKey = teams.map((team) => team.id).join(',');

  useEffect(() => {
    const unsubscribe = [ipcBridge.team.listChanged.on(() => void teamsQuery.mutate())];
    return () => unsubscribe.forEach((off) => off());
  }, [teamsQuery.mutate]);

  const tasksQuery = useSWR<Record<string, ITeamTaskItem[]>>(
    teamKey ? ['workshop-tasks', teamKey] : null,
    async () => {
      const entries = await Promise.all(
        teams.map(async (team) => {
          const tasks = await ipcBridge.team.listTasks.invoke({ team_id: team.id }).catch((): ITeamTaskItem[] => []);
          return [team.id, tasks] as const;
        })
      );
      return Object.fromEntries(entries);
    },
    { refreshInterval: REFRESH_MS }
  );

  const activityQuery = useSWR<WorkshopActivity[]>(
    teamKey ? ['workshop-activity', teamKey] : null,
    async () => {
      const pages = await Promise.all(
        teams.map(async (team) => {
          const page = await ipcBridge.team.listActivity
            .invoke({ team_id: team.id, limit: ACTIVITY_PER_TEAM, direction: 'desc' })
            .catch((): ITeamActivityPage => ({ items: [], has_more: false }));
          return page.items.map((item) => describeActivity(team, item));
        })
      );
      return pages.flat().toSorted((a, b) => b.at - a.at);
    },
    { refreshInterval: REFRESH_MS }
  );

  const projects = useMemo(
    () => teams.map((team) => buildProject(team, tasksQuery.data?.[team.id] ?? [])),
    [teams, tasksQuery.data]
  );

  return {
    projects,
    activity: activityQuery.data ?? [],
    isLoading: teamsQuery.isLoading,
    error: teamsQuery.error,
  };
}
