import { useState } from 'react';
import {
  FileCode,
  Plus,
  RefreshCw,
  FlaskConical,
  Pencil,
  Trash2,
  Lock,
  LockOpen,
  Server,
} from 'lucide-react';
import { useServers } from '@/hooks/useServers';
import {
  useNginxConfigs,
  useCreateNginxConfig,
  useUpdateNginxConfig,
  useDeleteNginxConfig,
  useReloadNginx,
  useTestNginx,
} from '@/hooks/useNginx';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { NginxConfig } from '@/types';

interface NginxFormData {
  domain: string;
  upstream_port: string;
  config_content: string;
  web_app_id: string;
}

const emptyForm: NginxFormData = {
  domain: '',
  upstream_port: '',
  config_content: '',
  web_app_id: '',
};

export default function NginxListPage() {
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<NginxConfig | null>(null);
  const [deleteConfig, setDeleteConfig] = useState<NginxConfig | null>(null);
  const [reloadModalOpen, setReloadModalOpen] = useState(false);
  const [formData, setFormData] = useState<NginxFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NginxFormData, string>>>({});

  const { data: servers, isLoading: serversLoading } = useServers();
  const { data: configs, isLoading: configsLoading } = useNginxConfigs(selectedServerId);
  const createConfig = useCreateNginxConfig(selectedServerId);
  const updateConfig = useUpdateNginxConfig(selectedServerId);
  const deleteConfigMutation = useDeleteNginxConfig(selectedServerId);
  const reloadNginx = useReloadNginx(selectedServerId);
  const testNginx = useTestNginx(selectedServerId);

  const serverOptions = (servers || []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NginxFormData, string>> = {};
    if (!formData.domain.trim()) errors.domain = 'Domain is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreateModal = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setCreateModalOpen(true);
  };

  const openEditModal = (config: NginxConfig) => {
    setFormData({
      domain: config.domain,
      upstream_port: config.upstream_port?.toString() || '',
      config_content: config.config_content || '',
      web_app_id: config.web_app_id?.toString() || '',
    });
    setFormErrors({});
    setEditConfig(config);
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    await createConfig.mutateAsync({
      domain: formData.domain,
      upstream_port: formData.upstream_port ? Number(formData.upstream_port) : 0,
      config_content: formData.config_content || undefined,
      web_app_id: formData.web_app_id ? Number(formData.web_app_id) : undefined,
    });
    setCreateModalOpen(false);
    setFormData(emptyForm);
  };

  const handleUpdate = async () => {
    if (!editConfig || !validateForm()) return;
    await updateConfig.mutateAsync({
      id: editConfig.id,
      domain: formData.domain,
      upstream_port: formData.upstream_port ? Number(formData.upstream_port) : undefined,
      config_content: formData.config_content || undefined,
      web_app_id: formData.web_app_id ? Number(formData.web_app_id) : undefined,
    });
    setEditConfig(null);
    setFormData(emptyForm);
  };

  const handleDelete = async () => {
    if (!deleteConfig) return;
    await deleteConfigMutation.mutateAsync(deleteConfig.id);
    setDeleteConfig(null);
  };

  const handleToggleActive = async (config: NginxConfig) => {
    await updateConfig.mutateAsync({
      id: config.id,
      is_active: !config.is_active,
    });
  };

  const handleReload = async () => {
    await reloadNginx.mutateAsync();
    setReloadModalOpen(false);
  };

  const columns = [
    {
      key: 'domain',
      header: 'Domain',
      render: (config: NginxConfig) => (
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900">{config.domain}</span>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (config: NginxConfig) => (
        <button
          onClick={() => handleToggleActive(config)}
          title={config.is_active ? 'Click to deactivate' : 'Click to activate'}
        >
          <Badge variant={config.is_active ? 'success' : 'default'}>
            {config.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'is_ssl',
      header: 'SSL',
      render: (config: NginxConfig) =>
        config.is_ssl ? (
          <div className="flex items-center gap-1 text-green-600">
            <Lock className="w-4 h-4" />
            <span className="text-xs">Enabled</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-400">
            <LockOpen className="w-4 h-4" />
            <span className="text-xs">None</span>
          </div>
        ),
    },
    {
      key: 'upstream_port',
      header: 'Upstream Port',
      render: (config: NginxConfig) => (
        <span className="text-gray-700 font-mono text-xs">
          {config.upstream_port ?? '—'}
        </span>
      ),
    },
    {
      key: 'web_app_id',
      header: 'Web App',
      render: (config: NginxConfig) => (
        <span className="text-gray-500">
          {config.web_app_id ? `App #${config.web_app_id}` : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (config: NginxConfig) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(config)}
            title="Edit Config"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfig(config)}
            title="Delete Config"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  const renderForm = () => (
    <div className="space-y-4">
      <Input
        label="Domain"
        id="domain"
        placeholder="example.com"
        value={formData.domain}
        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
        error={formErrors.domain}
      />
      <Input
        label="Upstream Port"
        id="upstream_port"
        type="number"
        placeholder="3000"
        value={formData.upstream_port}
        onChange={(e) => setFormData({ ...formData, upstream_port: e.target.value })}
      />
      <Input
        label="Web App ID (optional)"
        id="web_app_id"
        type="number"
        placeholder="Leave empty if not linked"
        value={formData.web_app_id}
        onChange={(e) => setFormData({ ...formData, web_app_id: e.target.value })}
      />
      <div className="w-full">
        <label htmlFor="config_content" className="block text-sm font-medium text-gray-700 mb-1">
          Config Content
        </label>
        <textarea
          id="config_content"
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          placeholder="server { ... }"
          value={formData.config_content}
          onChange={(e) => setFormData({ ...formData, config_content: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div>
      <Header
        title="Nginx Configurations"
        description="Manage Nginx server blocks and configurations"
        actions={
          selectedServerId ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => testNginx.mutate()}
                isLoading={testNginx.isPending}
              >
                <FlaskConical className="w-4 h-4 mr-1" />
                Test Config
              </Button>
              <Button
                variant="secondary"
                onClick={() => setReloadModalOpen(true)}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Reload Nginx
              </Button>
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-1" />
                Add Config
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Server Selector */}
      <div className="mb-6">
        <Select
          id="server-select"
          label="Select Server"
          options={serverOptions}
          value={String(selectedServerId)}
          onChange={(e) => setSelectedServerId(Number(e.target.value))}
          disabled={serversLoading}
        />
      </div>

      {/* Content */}
      {!selectedServerId ? (
        <Card>
          <EmptyState
            icon={<Server className="w-12 h-12" />}
            title="Select a server"
            description="Choose a server from the dropdown above to manage its Nginx configurations."
          />
        </Card>
      ) : configsLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : !configs || configs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileCode className="w-12 h-12" />}
            title="No Nginx configurations"
            description="Create your first Nginx server block configuration for this server."
            action={{
              label: 'Add Config',
              onClick: openCreateModal,
            }}
          />
        </Card>
      ) : (
        <Card padding={false}>
          <Table
            columns={columns}
            data={configs}
            keyExtractor={(c) => c.id}
          />
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Nginx Configuration"
        size="lg"
      >
        {renderForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} isLoading={createConfig.isPending}>
            Create Config
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editConfig}
        onClose={() => setEditConfig(null)}
        title="Edit Nginx Configuration"
        size="lg"
      >
        {renderForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setEditConfig(null)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} isLoading={updateConfig.isPending}>
            Save Changes
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfig}
        onClose={() => setDeleteConfig(null)}
        title="Delete Nginx Configuration"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete the configuration for{' '}
          <span className="font-semibold">{deleteConfig?.domain}</span>? This action
          cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfig(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteConfigMutation.isPending}
          >
            Delete Config
          </Button>
        </div>
      </Modal>

      {/* Reload Confirmation Modal */}
      <Modal
        isOpen={reloadModalOpen}
        onClose={() => setReloadModalOpen(false)}
        title="Reload Nginx"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to reload Nginx on this server? It is recommended to
          run a config test first to avoid downtime.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setReloadModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleReload} isLoading={reloadNginx.isPending}>
            Reload Nginx
          </Button>
        </div>
      </Modal>
    </div>
  );
}
