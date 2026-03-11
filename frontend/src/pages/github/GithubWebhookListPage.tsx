import { useState } from 'react';
import {
  Github,
  Plus,
  Copy,
  Check,
  Pencil,
  Trash2,
  Webhook,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useServers } from '@/hooks/useServers';
import { useWebApps } from '@/hooks/useWebApps';
import {
  useGithubWebhooks,
  useCreateGithubWebhook,
  useUpdateGithubWebhook,
  useDeleteGithubWebhook,
} from '@/hooks/useGithubWebhooks';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import type { GithubWebhook } from '@/types';

const AVAILABLE_EVENTS = ['push', 'pull_request', 'release', 'create', 'delete'] as const;

interface WebhookFormData {
  repository: string;
  branch: string;
  web_app_id: number;
  events: string[];
}

const initialFormData: WebhookFormData = {
  repository: '',
  branch: 'main',
  web_app_id: 0,
  events: ['push'],
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
      title="Copy webhook URL"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export default function GithubWebhookListPage() {
  const { data: servers } = useServers();
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const { data: webhooks, isLoading, error } = useGithubWebhooks(selectedServerId);
  const { data: webApps } = useWebApps(selectedServerId);
  const createWebhook = useCreateGithubWebhook(selectedServerId);
  const updateWebhook = useUpdateGithubWebhook(selectedServerId);
  const deleteWebhook = useDeleteGithubWebhook(selectedServerId);

  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<GithubWebhook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GithubWebhook | null>(null);
  const [formData, setFormData] = useState<WebhookFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const serverOptions = (servers || []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const webAppOptions = (webApps || []).map((app) => ({
    value: String(app.id),
    label: app.name,
  }));

  const getWebAppName = (webAppId: number) => {
    const app = webApps?.find((a) => a.id === webAppId);
    return app?.name || 'Unknown App';
  };

  const openCreateModal = () => {
    setEditingWebhook(null);
    setFormData(initialFormData);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (webhook: GithubWebhook) => {
    setEditingWebhook(webhook);
    setFormData({
      repository: webhook.repository,
      branch: webhook.branch,
      web_app_id: webhook.web_app_id,
      events: [...webhook.events],
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.repository.trim()) {
      errors.repository = 'Repository is required';
    } else if (!formData.repository.includes('/')) {
      errors.repository = 'Format must be owner/repo';
    }
    if (!formData.branch.trim()) {
      errors.branch = 'Branch is required';
    }
    if (!formData.web_app_id) {
      errors.web_app_id = 'Web app is required';
    }
    if (formData.events.length === 0) {
      errors.events = 'Select at least one event';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      if (editingWebhook) {
        await updateWebhook.mutateAsync({
          id: editingWebhook.id,
          repository: formData.repository,
          branch: formData.branch,
          events: formData.events,
        });
      } else {
        await createWebhook.mutateAsync({
          repository: formData.repository,
          branch: formData.branch,
          web_app_id: formData.web_app_id,
          events: formData.events,
        });
      }
      setShowModal(false);
    } catch {
      toast.error(editingWebhook ? 'Failed to update webhook' : 'Failed to create webhook');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWebhook.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const handleToggleActive = async (webhook: GithubWebhook) => {
    try {
      await updateWebhook.mutateAsync({
        id: webhook.id,
        is_active: !webhook.is_active,
      });
    } catch {
      toast.error('Failed to toggle webhook status');
    }
  };

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <Header
        title="GitHub Webhooks"
        description="Manage GitHub webhook integrations for auto-deployments"
        actions={
          selectedServerId > 0 ? (
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-1" />
              Add Webhook
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
            icon={<Github className="w-12 h-12" />}
            title="Select a server"
            description="Choose a server from the dropdown above to manage its GitHub webhooks."
          />
        </Card>
      ) : error ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 text-sm">Failed to load webhooks. Please try again.</p>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Github className="w-12 h-12" />}
            title="No webhooks"
            description="No GitHub webhooks configured on this server. Add one to enable automatic deployments."
            action={{
              label: 'Add Webhook',
              onClick: openCreateModal,
            }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
                    <Github className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 hover:text-blue-600 transition-colors cursor-pointer flex items-center gap-1">
                      {webhook.repository}
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="info">{webhook.branch}</Badge>
                      <span className="text-xs text-gray-500">{getWebAppName(webhook.web_app_id)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(webhook)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    webhook.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      webhook.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Events */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {webhook.events.map((event) => (
                  <Badge key={event} variant="default">
                    {event}
                  </Badge>
                ))}
              </div>

              {/* Webhook URL */}
              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                <Webhook className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <code className="text-xs text-gray-600 truncate flex-1">
                  {webhook.webhook_url}
                </code>
                <CopyButton text={webhook.webhook_url} />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  Last delivery: {formatDate(webhook.last_delivery_at)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(webhook)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(webhook)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            id="repository"
            label="Repository"
            placeholder="owner/repo"
            value={formData.repository}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, repository: e.target.value }))
            }
            error={formErrors.repository}
          />
          <Input
            id="branch"
            label="Branch"
            placeholder="main"
            value={formData.branch}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, branch: e.target.value }))
            }
            error={formErrors.branch}
          />
          {!editingWebhook && (
            <Select
              id="web-app"
              label="Web App"
              options={webAppOptions}
              value={String(formData.web_app_id)}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  web_app_id: Number(e.target.value),
                }))
              }
              error={formErrors.web_app_id}
            />
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Events
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <label
                  key={event}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    formData.events.includes(event)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="sr-only"
                  />
                  <span className="text-sm">{event}</span>
                </label>
              ))}
            </div>
            {formErrors.events && (
              <p className="mt-1 text-sm text-red-600">{formErrors.events}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={createWebhook.isPending || updateWebhook.isPending}
            >
              {editingWebhook ? 'Update Webhook' : 'Create Webhook'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Webhook"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete the webhook for{' '}
          <span className="font-semibold">{deleteTarget?.repository}</span>? This
          action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteWebhook.isPending}
          >
            Delete Webhook
          </Button>
        </div>
      </Modal>
    </div>
  );
}
