import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { WebApp, WebAppFormData, ApiResponse } from '@/types';
import toast from 'react-hot-toast';

export function useWebApps(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'web-apps'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<WebApp[]>>(`/servers/${serverId}/web-apps`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useWebApp(serverId: number, appId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'web-apps', appId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<WebApp>>(`/servers/${serverId}/web-apps/${appId}`);
      return data.data;
    },
    enabled: !!serverId && !!appId,
  });
}

export function useCreateWebApp(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appData: WebAppFormData) => {
      const { data } = await api.post(`/servers/${serverId}/web-apps`, appData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Web app created successfully');
    },
  });
}

export function useDeployWebApp(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: number) => {
      const { data } = await api.post(`/servers/${serverId}/web-apps/${appId}/deploy`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Deployment started');
    },
  });
}

export function useDeleteWebApp(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: number) => {
      await api.delete(`/servers/${serverId}/web-apps/${appId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Web app deleted');
    },
  });
}

export function useUpdateWebApp(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, data }: { appId: number; data: Partial<WebAppFormData> }) => {
      const { data: response } = await api.put(`/servers/${serverId}/web-apps/${appId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Web app updated successfully');
    },
  });
}

export function useRestartWebApp(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: number) => {
      const { data } = await api.post(`/servers/${serverId}/web-apps/${appId}/restart`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Web app restarted');
    },
  });
}
