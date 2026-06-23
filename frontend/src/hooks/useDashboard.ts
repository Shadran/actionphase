import { useQuery } from '@tanstack/react-query';
import { simpleApi } from '../lib/simple-api';
import type { DashboardData } from '../types/dashboard';

/**
 * Custom hook for fetching and managing dashboard data
 *
 * @returns Query result with dashboard data, loading state, and error handling
 */
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await simpleApi.getDashboard();
      return response.data;
    },
    refetchInterval: 15000,
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });
}
