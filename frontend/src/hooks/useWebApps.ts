import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { WebApp, WebAppFormData, Deployment, ApiResponse, PaginatedResponse } from '@/types';
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
      return response as { data: WebApp; warning?: string };
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      if (response.warning) {
        toast.error(response.warning);
      } else {
        toast.success('Web app updated successfully');
      }
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

export function useStartWebApp(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: number) => {
      const { data } = await api.post(`/servers/${serverId}/web-apps/${appId}/start`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Web app started');
    },
  });
}

export function useStopWebApp(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: number) => {
      const { data } = await api.post(`/servers/${serverId}/web-apps/${appId}/stop`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Web app stopped');
    },
  });
}

export function useWebAppDeployments(serverId: number, appId: number, page: number = 1) {
  return useQuery({
    queryKey: ['servers', serverId, 'web-apps', appId, 'deployments', page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Deployment>>(
        `/servers/${serverId}/web-apps/${appId}/deployments`,
        { params: { page, per_page: 20 } }
      );
      return data;
    },
    enabled: !!serverId && !!appId,
  });
}

export function useGenerateDeployKey(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: number) => {
      const { data } = await api.post<{ data: import('@/types').WebApp }>(
        `/servers/${serverId}/web-apps/${appId}/generate-deploy-key`
      );
      return data.data;
    },
    onSuccess: (_data, appId) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps', appId] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      toast.success('Deploy key generated successfully');
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Failed to generate deploy key.';
      toast.error(message);
    },
  });
}

export function useSetupWebApp(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: number) => {
      const { data } = await api.post(`/servers/${serverId}/web-apps/${appId}/setup`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      if (data.success === false) {
        toast.error(data.message || 'Setup failed.');
      } else {
        toast.success('Web app setup completed successfully');
      }
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Setup failed.';
      toast.error(message);
    },
  });
}

/**
 * Fetch the raw content of .env.example from the web app's deploy path.
 * Returns a mutation so it can be triggered on demand (e.g. button click).
 */
export function useGetEnvExample(serverId: number) {
  return useMutation({
    mutationFn: async (appId: number) => {
      const { data } = await api.get<{ content: string | null; message?: string }>(
        `/servers/${serverId}/web-apps/${appId}/env-example`
      );
      return data.content;
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Could not load .env.example.';
      toast.error(message);
    },
  });
}

/**
 * Run an arbitrary shell script in the web app's deploy path.
 * Returns { output: string, exit_code: number }.
 */
export function useRunScript(serverId: number) {
  return useMutation({
    mutationFn: async ({ appId, script }: { appId: number; script: string }) => {
      const { data } = await api.post<{ output: string; exit_code: number }>(
        `/servers/${serverId}/web-apps/${appId}/run-script`,
        { script }
      );
      return data;
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Failed to run script.';
      toast.error(message);
    },
  });
}
