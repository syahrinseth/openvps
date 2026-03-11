import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Plus, Rocket, Trash2 } from 'lucide-react';
import { useServers } from '@/hooks/useServers';
import { useWebApps, useDeployWebApp, useDeleteWebApp } from '@/hooks/useWebApps';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import type { WebApp } from '@/types';

const appTypeBadge: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  laravel: 'danger',
  nodejs: 'success',
  react: 'info',
  static: 'default',
  custom: 'warning',
};

export default function WebAppListPage() {
  const navigate = useNavigate();
  const { data: servers } = useServers();
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const { data: webApps, isLoading } = useWebApps(selectedServerId);
  const deployWebApp = useDeployWebApp(selectedServerId);
  const deleteWebApp = useDeleteWebApp(selectedServerId);
  const [deleteModal, setDeleteModal] = useState<WebApp | null>(null);

  const serverOptions = (servers || []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const handleDelete = async () => {
    if (!deleteModal) return;
    await deleteWebApp.mutateAsync(deleteModal.id);
    setDeleteModal(null);
  };

  return (
    <div>
      <Header
        title="Web Apps"
        description="Manage your web applications across servers"
        actions={
          selectedServerId > 0 ? (
            <Button onClick={() => navigate(`/web-apps/create?server=${selectedServerId}`)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Web App
            </Button>
          ) : undefined
        }
      />

      {/* Server Selector */}
      <Card className="mb-6">
        <div className="max-w-sm">
          <Select
            id="server-select"
            label="Select Server"
            options={serverOptions}
            value={String(selectedServerId)}
            onChange={(e) => setSelectedServerId(Number(e.target.value))}
          />
        </div>
      </Card>

      {/* Content */}
      {selectedServerId === 0 ? (
        <Card>
          <EmptyState
            icon={<Globe className="w-12 h-12" />}
            title="Select a server"
            description="Choose a server from the dropdown above to view its web applications."
          />
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : !webApps || webApps.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Globe className="w-12 h-12" />}
            title="No web apps"
            description="No web applications found on this server. Add one to get started."
            action={{
              label: 'Add Web App',
              onClick: () => navigate(`/web-apps/create?server=${selectedServerId}`),
            }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {webApps.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3
                      className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() =>
                        navigate(`/web-apps/${selectedServerId}/${app.id}`)
                      }
                    >
                      {app.name}
                    </h3>
                    <p className="text-xs text-gray-500">{app.domain}</p>
                  </div>
                </div>
                <Badge variant={appTypeBadge[app.app_type] || 'default'}>
                  {app.app_type}
                </Badge>
              </div>

              <div className="flex items-center justify-between mb-4">
                <StatusIndicator status={app.status} />
                {app.git_repository && (
                  <p className="text-xs text-gray-400 truncate max-w-[150px]">
                    {app.git_branch}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deployWebApp.mutate(app.id)}
                  isLoading={deployWebApp.isPending}
                  className="flex-1"
                >
                  <Rocket className="w-3.5 h-3.5 mr-1" />
                  Deploy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigate(`/web-apps/${selectedServerId}/${app.id}`)
                  }
                >
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteModal(app)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Web App"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete{' '}
          <span className="font-semibold">{deleteModal?.name}</span>? This will
          remove the app configuration but won't delete files on the server.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteModal(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteWebApp.isPending}
          >
            Delete App
          </Button>
        </div>
      </Modal>
    </div>
  );
}
