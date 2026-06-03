import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { useDraftPost, useCreateDraftPost, useDeleteDraftPost } from '../useDraftPost';
import { apiClient } from '../../lib/api';
import type { Message } from '../../types/messages';
import React from 'react';

vi.mock('../../lib/api', () => ({
  apiClient: {
    messages: {
      getDraftPost: vi.fn(),
      createDraftPost: vi.fn(),
      updateDraftPost: vi.fn(),
      deleteDraftPost: vi.fn(),
    },
  },
}));

const mockDraft: Message = {
  id: 42,
  game_id: 1,
  phase_id: 10,
  author_id: 1,
  character_id: 5,
  content: 'The fog which surrounded you dissipates...',
  message_type: 'post',
  thread_depth: 0,
  author_username: 'gm_user',
  character_name: 'Narrator',
  is_edited: false,
  is_deleted: false,
  is_draft: true,
  created_at: '2025-11-01T10:00:00Z',
  updated_at: '2025-11-01T10:00:00Z',
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useDraftPost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns draft post when one exists', async () => {
    vi.mocked(apiClient.messages.getDraftPost).mockResolvedValue({
      data: mockDraft,
    } as AxiosResponse<Message>);

    const { result } = renderHook(() => useDraftPost(10), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockDraft);
    expect(result.current.data?.is_draft).toBe(true);
  });

  it('returns null when API returns 404', async () => {
    vi.mocked(apiClient.messages.getDraftPost).mockRejectedValue({
      response: { status: 404 },
    });

    const { result } = renderHook(() => useDraftPost(10), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('does not fetch when phaseId is undefined', () => {
    const { result } = renderHook(() => useDraftPost(undefined), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.messages.getDraftPost).not.toHaveBeenCalled();
  });
});

describe('useCreateDraftPost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls API with correct args', async () => {
    vi.mocked(apiClient.messages.createDraftPost).mockResolvedValue({
      data: mockDraft,
    } as AxiosResponse<Message>);

    const { result } = renderHook(() => useCreateDraftPost(10), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({ characterId: 5, content: 'Hello world' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.messages.createDraftPost).toHaveBeenCalledWith(10, 5, 'Hello world');
  });
});

describe('useDeleteDraftPost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls delete API', async () => {
    vi.mocked(apiClient.messages.deleteDraftPost).mockResolvedValue({
      data: { message: 'deleted' },
    } as AxiosResponse);

    const { result } = renderHook(() => useDeleteDraftPost(10), {
      wrapper: makeWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.messages.deleteDraftPost).toHaveBeenCalledWith(10);
  });
});
