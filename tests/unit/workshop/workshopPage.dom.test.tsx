/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITeamTaskItem, TeamAssistant, TTeam } from '@/common/types/team/teamTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@renderer/hooks/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

const team = vi.hoisted(() => ({
  list: { invoke: vi.fn() },
  listTasks: { invoke: vi.fn() },
  listActivity: { invoke: vi.fn() },
  listChanged: { on: vi.fn(() => () => {}) },
}));
vi.mock('@/common', () => ({ ipcBridge: { team } }));

import WorkshopPage from '@renderer/pages/workshop';

const agent = (name: string, status: TeamAssistant['status'], pending = 0): TeamAssistant => ({
  slot_id: name.toLowerCase(),
  conversation_id: `c-${name}`,
  role: 'teammate',
  assistant_backend: 'claude',
  assistant_name: name,
  status,
  pending_confirmations: pending,
  context_reset: { supported: false, availability: 'unsupported' },
});
const makeTeam = (id: string, name: string, assistants: TeamAssistant[], updated_at: number) =>
  ({
    id,
    user_id: 'u1',
    name,
    workspace: '/w',
    workspace_mode: 'shared',
    leader_assistant_id: '',
    assistants,
    created_at: 0,
    updated_at,
  }) as TTeam;
const task = (id: string, subject: string, status: string, created_at: number): ITeamTaskItem => ({
  id,
  team_id: 't',
  subject,
  status,
  blocked_by: [],
  blocks: [],
  created_at,
  updated_at: created_at,
});

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <WorkshopPage />
    </SWRConfig>
  );

describe('WorkshopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    team.list.invoke.mockResolvedValue([
      makeTeam('old', 'Docs refresh', [agent('Eli', 'dormant')], 10),
      makeTeam('new', 'Org home screen', [agent('Fay', 'active'), agent('Ada', 'active', 1)], 99),
    ]);
    team.listTasks.invoke.mockImplementation(({ team_id }: { team_id: string }) =>
      Promise.resolve(
        team_id === 'new' ? [task('1', 'Data layer', 'completed', 1), task('2', 'Mechanics', 'in_progress', 2)] : []
      )
    );
    team.listActivity.invoke.mockImplementation(({ team_id }: { team_id: string }) =>
      Promise.resolve({
        items:
          team_id === 'new'
            ? [
                {
                  kind: 'message',
                  id: 'm1',
                  created_at: Date.now(),
                  message: { from_agent_id: 'fay', content: 'Mapping panels', summary: '' },
                },
              ]
            : [],
        has_more: false,
      })
    );
  });

  it('should put the most recently active project on the center lift with its tasks', async () => {
    renderPage();

    const center = await screen.findByTestId('lift-center');
    await waitFor(() => expect(center).toHaveTextContent('Mechanics'));
    expect(center).toHaveTextContent('Org home screen');
  });

  it('should show the project as needing the user when one of its agents waits for a confirmation', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('lift-center')).toHaveTextContent('workshop.status.waiting'));
  });

  it('should show empty lifts when there are fewer projects than lifts', async () => {
    renderPage();

    await screen.findByTestId('lift-center');
    expect(screen.getAllByText('workshop.emptyLift')).toHaveLength(3);
  });

  it('should seat the waiting agent first with a raised hand', async () => {
    renderPage();

    const robots = await screen.findAllByTestId('workshop-robot');
    expect(robots[0]).toHaveAttribute('data-pose', 'hand-raised');
    expect(robots).toHaveLength(3);
  });

  it('should count agents that do not fit at the table', async () => {
    const crew = Array.from({ length: 8 }, (_, i) => agent(`A${i}`, 'active'));
    team.list.invoke.mockResolvedValue([makeTeam('big', 'Big team', crew, 5)]);

    renderPage();

    expect(await screen.findByText('workshop.moreAgents:{"count":2}')).toBeInTheDocument();
    expect(screen.getAllByTestId('workshop-robot')).toHaveLength(6);
  });

  it('should open the team when its lift screen is clicked', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('lift-center'));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/team/new'));
  });

  it('should show the latest activity with the agent name', async () => {
    renderPage();

    expect(await screen.findByText('Mapping panels')).toBeInTheDocument();
    expect(screen.getAllByText('Fay').length).toBeGreaterThan(0);
  });

  it('should still show the lifts when loading tasks fails', async () => {
    team.listTasks.invoke.mockRejectedValue(new Error('backend down'));

    renderPage();

    await waitFor(() => expect(screen.getByTestId('lift-center')).toHaveTextContent('workshop.noTasks'));
  });

  it('should tell the user there are no agents yet when no team exists', async () => {
    team.list.invoke.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('workshop.emptyTable')).toBeInTheDocument();
    expect(screen.getAllByText('workshop.emptyLift')).toHaveLength(5);
  });
});
