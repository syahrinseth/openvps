import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CronJob, ApiResponse } from '@/types';
import toast from 'react-hot-toast';

export function useCronJobs(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'cron-jobs'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CronJob[]>>(`/servers/${serverId}/cron-jobs`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useCreateCronJob(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cronData: { command: string; schedule: string; description?: string; web_app_id?: number }) => {
      const { data } = await api.post(`/servers/${serverId}/cron-jobs`, cronData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'cron-jobs'] });
      toast.success('Cron job created successfully');
    },
  });
}

export function useUpdateCronJob(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...cronData }: { id: number; command?: string; schedule?: string; description?: string; web_app_id?: number; is_active?: boolean }) => {
      const { data } = await api.put(`/servers/${serverId}/cron-jobs/${id}`, cronData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'cron-jobs'] });
      toast.success('Cron job updated successfully');
    },
  });
}

export function useDeleteCronJob(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${serverId}/cron-jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'cron-jobs'] });
      toast.success('Cron job deleted');
    },
  });
}
