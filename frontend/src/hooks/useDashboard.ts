import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DashboardStats, ApiResponse } from '@/types';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardStats>>('/dashboard');
      return data.data;
    },
    refetchInterval: 30000,
  });
}
