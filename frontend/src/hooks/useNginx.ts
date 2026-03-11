import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { NginxConfig, ApiResponse } from '@/types';
import toast from 'react-hot-toast';

export function useNginxConfigs(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'nginx'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<NginxConfig[]>>(`/servers/${serverId}/nginx`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useNginxConfig(serverId: number, configId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'nginx', configId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<NginxConfig>>(`/servers/${serverId}/nginx/${configId}`);
      return data.data;
    },
    enabled: !!serverId && !!configId,
  });
}

export function useCreateNginxConfig(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (configData: { domain: string; web_app_id?: number; upstream_port: number; config_content?: string }) => {
      const { data } = await api.post(`/servers/${serverId}/nginx`, configData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'nginx'] });
      toast.success('Nginx config created successfully');
    },
  });
}

export function useUpdateNginxConfig(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...configData }: { id: number; domain?: string; web_app_id?: number; upstream_port?: number; config_content?: string }) => {
      const { data } = await api.put(`/servers/${serverId}/nginx/${id}`, configData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'nginx'] });
      toast.success('Nginx config updated successfully');
    },
  });
}

export function useDeleteNginxConfig(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${serverId}/nginx/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'nginx'] });
      toast.success('Nginx config deleted');
    },
  });
}

export function useReloadNginx(serverId: number) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/servers/${serverId}/nginx-reload`);
      return data;
    },
    onSuccess: () => {
      toast.success('Nginx reloaded successfully');
    },
    onError: () => {
      toast.error('Failed to reload Nginx');
    },
  });
}

export function useTestNginx(serverId: number) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/servers/${serverId}/nginx-test`);
      return data;
    },
    onSuccess: () => {
      toast.success('Nginx configuration test passed');
    },
    onError: () => {
      toast.error('Nginx configuration test failed');
    },
  });
}
