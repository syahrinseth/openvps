import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SslCertificate, ApiResponse } from '@/types';
import toast from 'react-hot-toast';

export function useSslCertificates(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'ssl-certificates'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SslCertificate[]>>(`/servers/${serverId}/ssl-certificates`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useSslCertificate(serverId: number, certId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'ssl-certificates', certId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SslCertificate>>(`/servers/${serverId}/ssl-certificates/${certId}`);
      return data.data;
    },
    enabled: !!serverId && !!certId,
  });
}

export function useRequestCertificate(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (certData: { domain: string; type?: string }) => {
      const { data } = await api.post(`/servers/${serverId}/ssl-certificates`, certData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'ssl-certificates'] });
      toast.success('SSL certificate requested successfully');
    },
    onError: (error: any) => {
      const detail =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to request SSL certificate';
      toast.error(detail);
    },
  });
}

export function useDeleteCertificate(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${serverId}/ssl-certificates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'ssl-certificates'] });
      toast.success('SSL certificate deleted');
    },
    onError: (error: any) => {
      const detail =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to delete SSL certificate';
      toast.error(detail);
    },
  });
}

export function useRenewCertificate(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/servers/${serverId}/ssl-certificates/${id}/renew`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'ssl-certificates'] });
      toast.success('SSL certificate renewal started');
    },
    onError: (error: any) => {
      const detail =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to renew SSL certificate';
      toast.error(detail);
    },
  });
}
