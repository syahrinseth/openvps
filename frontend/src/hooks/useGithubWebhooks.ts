import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { GithubWebhook, ApiResponse } from '@/types';
import toast from 'react-hot-toast';

export function useGithubWebhooks(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'github-webhooks'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<GithubWebhook[]>>(`/servers/${serverId}/github-webhooks`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useCreateGithubWebhook(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (webhookData: { web_app_id: number; repository: string; branch?: string; events?: string[] }) => {
      const { data } = await api.post(`/servers/${serverId}/github-webhooks`, webhookData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'github-webhooks'] });
      toast.success('GitHub webhook created successfully');
    },
  });
}

export function useUpdateGithubWebhook(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...webhookData }: { id: number; repository?: string; branch?: string; events?: string[] }) => {
      const { data } = await api.put(`/servers/${serverId}/github-webhooks/${id}`, webhookData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'github-webhooks'] });
      toast.success('GitHub webhook updated successfully');
    },
  });
}

export function useDeleteGithubWebhook(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${serverId}/github-webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'github-webhooks'] });
      toast.success('GitHub webhook deleted');
    },
  });
}
