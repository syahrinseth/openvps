import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Plus, Wifi, Trash2, ExternalLink } from 'lucide-react';
import { useServers, useDeleteServer, useTestConnection } from '@/hooks/useServers';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import type { Server as ServerType } from '@/types';

const providerBadge: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  hetzner: 'info',
  digitalocean: 'info',
  linode: 'success',
  vultr: 'warning',
  aws: 'warning',
  custom: 'default',
};

export default function ServerListPage() {
  const navigate = useNavigate();
  const { data: servers, isLoading, error } = useServers();
  const deleteServer = useDeleteServer();
  const testConnection = useTestConnection();
  const [deleteModal, setDeleteModal] = useState<ServerType | null>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    await deleteServer.mutateAsync(deleteModal.id);
    setDeleteModal(null);
  };

  if (isLoading) {
    return (
      <div>
        <Header title="Servers" description="Manage your server infrastructure" />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header title="Servers" />
        <Card>
          <div className="text-center py-12">
            <p className="text-red-500">Failed to load servers.</p>
          </div>
        </Card>
      </div>
    );
  }

  const columns = [
    {
      key: 'name',
      header: 'Server',
      render: (server: ServerType) => (
        <button
          onClick={() => navigate(`/servers/${server.id}`)}
          className="text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <Server className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                {server.name}
              </p>
              <p className="text-xs text-gray-500">{server.ip_address}</p>
            </div>
          </div>
        </button>
      ),
    },
    {
      key: 'provider',
      header: 'Provider',
      render: (server: ServerType) => (
        <Badge variant={providerBadge[server.provider] || 'default'}>
          {server.provider}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (server: ServerType) => (
        <StatusIndicator status={server.status} />
      ),
    },
    {
      key: 'web_apps_count',
      header: 'Apps',
      render: (server: ServerType) => (
        <span className="text-gray-700">{server.web_apps_count ?? 0}</span>
      ),
    },
    {
      key: 'last_connected_at',
      header: 'Last Connected',
      render: (server: ServerType) => (
        <span className="text-gray-500">{formatDate(server.last_connected_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (server: ServerType) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              testConnection.mutate(server.id);
            }}
            isLoading={testConnection.isPending}
            title="Test Connection"
          >
            <Wifi className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/servers/${server.id}`);
            }}
            title="View Details"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteModal(server);
            }}
            title="Delete Server"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Header
        title="Servers"
        description="Manage your server infrastructure"
        actions={
          <Button onClick={() => navigate('/servers/add')}>
            <Plus className="w-4 h-4 mr-1" />
            Add Server
          </Button>
        }
      />

      {!servers || servers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Server className="w-12 h-12" />}
            title="No servers yet"
            description="Add your first server to get started managing your infrastructure."
            action={{
              label: 'Add Server',
              onClick: () => navigate('/servers/add'),
            }}
          />
        </Card>
      ) : (
        <Card padding={false}>
          <Table
            columns={columns}
            data={servers}
            keyExtractor={(s) => s.id}
          />
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Server"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete{' '}
          <span className="font-semibold">{deleteModal?.name}</span>? This action
          cannot be undone and will remove all associated configurations.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteModal(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteServer.isPending}
          >
            Delete Server
          </Button>
        </div>
      </Modal>
    </div>
  );
}
