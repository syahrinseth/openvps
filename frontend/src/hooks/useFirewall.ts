import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { FirewallRule, ApiResponse } from '@/types';
import toast from 'react-hot-toast';

export function useFirewallRules(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'firewall-rules'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<FirewallRule[]>>(`/servers/${serverId}/firewall-rules`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useCreateFirewallRule(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleData: { rule_type: string; direction: string; protocol: string; port: string; from_ip?: string; to_ip?: string; description?: string }) => {
      const { data } = await api.post(`/servers/${serverId}/firewall-rules`, ruleData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'firewall-rules'] });
      toast.success('Firewall rule created successfully');
    },
  });
}

export function useUpdateFirewallRule(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...ruleData }: { id: number; rule_type?: string; direction?: string; protocol?: string; port?: string; from_ip?: string; to_ip?: string; description?: string; is_active?: boolean }) => {
      const { data } = await api.put(`/servers/${serverId}/firewall-rules/${id}`, ruleData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'firewall-rules'] });
      toast.success('Firewall rule updated successfully');
    },
  });
}

export function useDeleteFirewallRule(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${serverId}/firewall-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'firewall-rules'] });
      toast.success('Firewall rule deleted');
    },
  });
}

export function useFirewallStatus(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'firewall-status'],
    queryFn: async () => {
      const { data } = await api.get(`/servers/${serverId}/firewall-status`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useSyncFirewall(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/servers/${serverId}/firewall-sync`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'firewall-rules'] });
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'firewall-status'] });
      toast.success('Firewall synced successfully');
    },
    onError: () => {
      toast.error('Failed to sync firewall');
    },
  });
}
