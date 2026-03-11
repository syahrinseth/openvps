import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Backup, ApiResponse } from '@/types';
import toast from 'react-hot-toast';

export function useBackups(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'backups'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Backup[]>>(`/servers/${serverId}/backups`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useCreateBackup(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (backupData: { type: string; web_app_id?: number; database_id?: number; notes?: string }) => {
      const { data } = await api.post(`/servers/${serverId}/backups`, backupData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'backups'] });
      toast.success('Backup started successfully');
    },
  });
}

export function useDeleteBackup(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${serverId}/backups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'backups'] });
      toast.success('Backup deleted');
    },
  });
}

export function useRestoreBackup(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/servers/${serverId}/backups/${id}/restore`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'backups'] });
      toast.success('Backup restore started');
    },
    onError: () => {
      toast.error('Failed to restore backup');
    },
  });
}
