import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Database, DatabaseUser, ApiResponse } from '@/types';
import toast from 'react-hot-toast';

export function useDatabases(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'databases'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Database[]>>(`/servers/${serverId}/databases`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useCreateDatabase(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dbData: { name: string; charset?: string; collation?: string }) => {
      const { data } = await api.post(`/servers/${serverId}/databases`, dbData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'databases'] });
      toast.success('Database created successfully');
    },
  });
}

export function useDeleteDatabase(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${serverId}/databases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'databases'] });
      toast.success('Database deleted');
    },
  });
}

export function useBackupDatabase(serverId: number) {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/servers/${serverId}/databases/${id}/backup`);
      return data.data;
    },
    onSuccess: () => {
      toast.success('Database backup started');
    },
    onError: () => {
      toast.error('Failed to start database backup');
    },
  });
}

export function useDatabaseUsers(serverId: number) {
  return useQuery({
    queryKey: ['servers', serverId, 'database-users'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DatabaseUser[]>>(`/servers/${serverId}/database-users`);
      return data.data;
    },
    enabled: !!serverId,
  });
}

export function useCreateDatabaseUser(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userData: { username: string; password: string; database_id?: number; host?: string; privileges?: string[] }) => {
      const { data } = await api.post(`/servers/${serverId}/database-users`, userData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'database-users'] });
      toast.success('Database user created successfully');
    },
  });
}

export function useUpdateDatabaseUser(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...userData }: { id: number; password?: string; database_id?: number; host?: string; privileges?: string[] }) => {
      const { data } = await api.put(`/servers/${serverId}/database-users/${id}`, userData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'database-users'] });
      toast.success('Database user updated successfully');
    },
  });
}

export function useDeleteDatabaseUser(serverId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/servers/${serverId}/database-users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'database-users'] });
      toast.success('Database user deleted');
    },
  });
}
