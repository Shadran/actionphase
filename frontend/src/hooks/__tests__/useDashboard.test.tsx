import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { useDashboard } from '../useDashboard';
import { simpleApi } from '../../lib/simple-api';
import type { DashboardData } from '../../types/dashboard';

// Mock the API
vi.mock('../../lib/simple-api', () => ({
  simpleApi: {
    getDashboard: vi.fn(),
  },
}));

describe('useDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for tests
        },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const mockDashboardData: DashboardData = {
    user_id: 1,
    has_games: true,
    player_games: [
      {
        game_id: 1,
        title: 'Test Game',
        state: 'in_progress',
        genre: 'Fantasy',
        gm_user_id: 100,
        gm_username: 'TestGM',
        user_role: 'player',
        has_pending_action: false,
        pending_applications: 0,
        unread_comments: 0,
        unvoted_polls: 0,
        deadline_status: 'normal',
        is_urgent: false,
        updated_at: new Date(),
        created_at: new Date(),
      },
    ],
    gm_games: [],
    audience_games: [],
    mixed_role_games: [],
    recent_messages: [],
    upcoming_deadlines: [],
    unread_notifications: 0,
    notifications_by_type: {},
  };

  it('fetches dashboard data successfully', async () => {
    vi.mocked(simpleApi.getDashboard).mockResolvedValue({
      data: mockDashboardData,
    } as Partial<AxiosResponse<DashboardData>>);

    const { result } = renderHook(() => useDashboard(), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockDashboardData);
    expect(result.current.error).toBeNull();
    expect(simpleApi.getDashboard).toHaveBeenCalledTimes(1);
  });

  it('handles error state', async () => {
    const error = new Error('Failed to fetch dashboard');
    vi.mocked(simpleApi.getDashboard).mockRejectedValue(error);

    const { result } = renderHook(() => useDashboard(), { wrapper });

    // Wait for error
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual(error);
  });

  it('uses correct query key', async () => {
    vi.mocked(simpleApi.getDashboard).mockResolvedValue({
      data: mockDashboardData,
    } as Partial<AxiosResponse<DashboardData>>);

    renderHook(() => useDashboard(), { wrapper });

    await waitFor(() => {
      const cachedData = queryClient.getQueryData(['dashboard']);
      expect(cachedData).toEqual(mockDashboardData);
    });
  });

  it('returns loading state initially', () => {
    vi.mocked(simpleApi.getDashboard).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useDashboard(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('refetches when query is invalidated', async () => {
    vi.mocked(simpleApi.getDashboard).mockResolvedValue({
      data: mockDashboardData,
    } as Partial<AxiosResponse<DashboardData>>);

    const { result } = renderHook(() => useDashboard(), { wrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.data).toEqual(mockDashboardData);
    });

    expect(simpleApi.getDashboard).toHaveBeenCalledTimes(1);

    // Invalidate the query
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

    // Should refetch
    await waitFor(() => {
      expect(simpleApi.getDashboard).toHaveBeenCalledTimes(2);
    });
  });

  it('maintains previous data during refetch', async () => {
    vi.mocked(simpleApi.getDashboard).mockResolvedValue({
      data: mockDashboardData,
    } as Partial<AxiosResponse<DashboardData>>);

    const { result } = renderHook(() => useDashboard(), { wrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.data).toEqual(mockDashboardData);
    });

    // Update mock to return new data
    const updatedData: DashboardData = {
      ...mockDashboardData,
      unread_notifications: 5,
    };

    vi.mocked(simpleApi.getDashboard).mockResolvedValue({
      data: updatedData,
    } as Partial<AxiosResponse<DashboardData>>);

    // Trigger refetch
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

    // During refetch, should maintain previous data due to placeholderData
    expect(result.current.data).toBeDefined();

    // Wait for new data
    await waitFor(() => {
      expect(result.current.data?.unread_notifications).toBe(5);
    });
  });

  it('returns data with expected structure', async () => {
    vi.mocked(simpleApi.getDashboard).mockResolvedValue({
      data: mockDashboardData,
    } as Partial<AxiosResponse<DashboardData>>);

    const { result } = renderHook(() => useDashboard(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const data = result.current.data!;

    expect(data).toHaveProperty('user_id');
    expect(data).toHaveProperty('has_games');
    expect(data).toHaveProperty('player_games');
    expect(data).toHaveProperty('gm_games');
    expect(data).toHaveProperty('audience_games');
    expect(data).toHaveProperty('mixed_role_games');
    expect(data).toHaveProperty('recent_messages');
    expect(data).toHaveProperty('upcoming_deadlines');
    expect(data).toHaveProperty('unread_notifications');
    expect(data).toHaveProperty('notifications_by_type');
  });

  it('handles empty dashboard data', async () => {
    const emptyData: DashboardData = {
      user_id: 1,
      has_games: false,
      player_games: [],
      gm_games: [],
      audience_games: [],
      mixed_role_games: [],
      recent_messages: [],
      upcoming_deadlines: [],
      unread_notifications: 0,
      notifications_by_type: {},
    };

    vi.mocked(simpleApi.getDashboard).mockResolvedValue({
      data: emptyData,
    } as Partial<AxiosResponse<DashboardData>>);

    const { result } = renderHook(() => useDashboard(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(emptyData);
    });

    expect(result.current.data?.has_games).toBe(false);
    expect(result.current.data?.player_games).toEqual([]);
    expect(result.current.data?.gm_games).toEqual([]);
  });
});
