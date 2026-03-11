import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Deployment, ApiResponse, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

export function useDeployments(serverId: number, webAppId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'web-apps', webAppId, 'deployments'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Deployment[]>>(`/servers/${serverId}/web-apps/${webAppId}/deployments`);
      return data.data;
    },
    enabled: !!serverId && !!webAppId,
  });
}

export function useAllDeployments(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'deployments'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Deployment[]>>(`/servers/${serverId}/deployments`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

/**
 * Paginated server-level deployments list.
 */
export function useAllDeploymentsPaginated(serverId: number, page: number = 1) {
  return useQuery({
    queryKey: ['servers', serverId, 'deployments', 'paginated', page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Deployment>>(`/servers/${serverId}/deployments`, {
        params: { page },
      });
      return data;
    },
    enabled: !!serverId,
  });
}

export function useRollbackDeployment(serverId: number, webAppId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deploymentId: number) => {
      const { data } = await api.post(`/servers/${serverId}/web-apps/${webAppId}/deployments/${deploymentId}/rollback`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps', webAppId, 'deployments'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'deployments'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Rollback started');
    },
    onError: () => {
      toast.error('Failed to rollback deployment');
    },
  });
}
