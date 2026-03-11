import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ActivityLog, ApiResponse } from '@/types';

export function useActivityLogs(params?: { server_id?: number; page?: number; per_page?: number }) {
  return useQuery({
    queryKey: ['activity-logs', params],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ActivityLog[]>>('/activity-logs', { params });
      return data.data;
    },
  });
}
