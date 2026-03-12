import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Server, ServerFormData, ApiResponse, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Server[]>>('/servers');
      return data.data;
    },
  });
}

/**
 * Paginated server list with optional search query.
 */
export function useServersPaginated(page: number = 1, search: string = '') {
  return useQuery({
    queryKey: ['servers', 'paginated', page, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page };
      if (search) params.search = search;
      const { data } = await api.get<PaginatedResponse<Server>>('/servers', { params });
      return data;
    },
  });
}

export function useServer(id: number) {
  return useQuery({
    queryKey: ['servers', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Server>>(`/servers/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serverData: ServerFormData) => {
      const { data } = await api.post('/servers', serverData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server added successfully');
    },
    onError: () => {
      toast.error('Failed to add server');
    },
  });
}

export function useUpdateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...serverData }: ServerFormData & { id: number }) => {
      const { data } = await api.put(`/servers/${id}`, serverData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server updated successfully');
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server deleted successfully');
    },
  });
}

export function useTestConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/servers/${id}/test-connection`);
      return data;
    },
    onSuccess: (data, id) => {
      if (data.connected) {
        queryClient.invalidateQueries({ queryKey: ['servers', id] });
        queryClient.invalidateQueries({ queryKey: ['servers'] });
        toast.success('Connection successful!');
      } else {
        toast.error(data.message || 'Connection failed.');
      }
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || 'Connection failed.';
      toast.error(message);
    },
  });
}

export function useServerMetrics(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'metrics'],
    queryFn: async () => {
      const { data } = await api.get(`/servers/${serverId}/metrics`);
      return data.data;
    },
    enabled: !!serverId,
    refetchInterval: 60000, // Refresh every minute
  });
}
