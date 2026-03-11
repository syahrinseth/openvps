import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { WebApp, WebAppFormData, ApiResponse, PaginatedResponse } from '@/types';
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

/**
 * Paginated web app list with optional search query.
 */
export function useWebAppsPaginated(serverId: number, page: number = 1, search: string = '') {
  return useQuery({
    queryKey: ['servers', serverId, 'web-apps', 'paginated', page, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page };
      if (search) params.search = search;
      const { data } = await api.get<PaginatedResponse<WebApp>>(`/servers/${serverId}/web-apps`, { params });
      return data;
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
