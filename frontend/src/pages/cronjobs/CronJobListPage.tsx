import { useState } from 'react';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useServers } from '@/hooks/useServers';
import { useWebApps } from '@/hooks/useWebApps';
import {
  useCronJobs,
  useCreateCronJob,
  useUpdateCronJob,
  useDeleteCronJob,
} from '@/hooks/useCronJobs';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import type { CronJob } from '@/types';

const SCHEDULE_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Weekly on Sunday', value: '0 0 * * 0' },
  { label: 'Monthly', value: '0 0 1 * *' },
] as const;

interface CronFormData {
  command: string;
  schedule: string;
  description: string;
  web_app_id: number;
}

const initialFormData: CronFormData = {
  command: '',
  schedule: '',
  description: '',
  web_app_id: 0,
};

export default function CronJobListPage() {
  const { data: servers } = useServers();
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const { data: cronJobs, isLoading, error } = useCronJobs(selectedServerId);
  const { data: webApps } = useWebApps(selectedServerId);
  const createCronJob = useCreateCronJob(selectedServerId);
  const updateCronJob = useUpdateCronJob(selectedServerId);
  const deleteCronJob = useDeleteCronJob(selectedServerId);

  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CronJob | null>(null);
  const [formData, setFormData] = useState<CronFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const serverOptions = (servers || []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const webAppOptions = (webApps || []).map((app) => ({
    value: String(app.id),
    label: app.name,
  }));

  const getWebAppName = (webAppId: number | null) => {
    if (!webAppId) return null;
    const app = webApps?.find((a) => a.id === webAppId);
    return app?.name || null;
  };

  const openCreateModal = () => {
    setEditingJob(null);
    setFormData(initialFormData);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (job: CronJob) => {
    setEditingJob(job);
    setFormData({
      command: job.command,
      schedule: job.schedule,
      description: job.description || '',
      web_app_id: job.web_app_id || 0,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.command.trim()) {
      errors.command = 'Command is required';
    }
    if (!formData.schedule.trim()) {
      errors.schedule = 'Schedule is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const payload: {
      command: string;
      schedule: string;
      description?: string;
      web_app_id?: number;
    } = {
      command: formData.command,
      schedule: formData.schedule,
    };
    if (formData.description.trim()) {
      payload.description = formData.description;
    }
    if (formData.web_app_id) {
      payload.web_app_id = formData.web_app_id;
    }

    try {
      if (editingJob) {
        await updateCronJob.mutateAsync({ id: editingJob.id, ...payload });
      } else {
        await createCronJob.mutateAsync(payload);
      }
      setShowModal(false);
    } catch {
      toast.error(editingJob ? 'Failed to update cron job' : 'Failed to create cron job');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCronJob.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete cron job');
    }
  };

  const handleToggleActive = async (job: CronJob) => {
    try {
      await updateCronJob.mutateAsync({
        id: job.id,
        is_active: !job.is_active,
      });
    } catch {
      toast.error('Failed to toggle cron job status');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '---';
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
        title="Cron Jobs"
        description="Manage scheduled tasks on your servers"
        actions={
          selectedServerId > 0 ? (
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-1" />
              Add Cron Job
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
            icon={<Clock className="w-12 h-12" />}
            title="Select a server"
            description="Choose a server from the dropdown above to manage its cron jobs."
          />
        </Card>
      ) : error ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 text-sm">Failed to load cron jobs. Please try again.</p>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : !cronJobs || cronJobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Clock className="w-12 h-12" />}
            title="No cron jobs"
            description="No scheduled tasks found on this server. Create one to automate recurring tasks."
            action={{
              label: 'Add Cron Job',
              onClick: openCreateModal,
            }}
          />
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Command
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Web App
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Run
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Run
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cronJobs.map((job) => {
                  const appName = getWebAppName(job.web_app_id);
                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded font-mono">
                          {job.schedule}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() =>
                              setExpandedRow(
                                expandedRow === job.id ? null : job.id
                              )
                            }
                            className="text-left"
                          >
                            <code
                              className={`text-sm font-mono text-gray-700 ${
                                expandedRow === job.id
                                  ? 'whitespace-pre-wrap break-all'
                                  : 'truncate block max-w-[200px]'
                              }`}
                            >
                              {job.command}
                            </code>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.description || '---'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {appName ? (
                          <Badge variant="info">{appName}</Badge>
                        ) : (
                          <span className="text-sm text-gray-400">---</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(job)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            job.is_active ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                              job.is_active
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(job.last_run_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(job.next_run_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(job)}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(job)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingJob ? 'Edit Cron Job' : 'Add Cron Job'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            id="command"
            label="Command"
            placeholder="/usr/bin/php /path/to/artisan schedule:run"
            value={formData.command}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, command: e.target.value }))
            }
            error={formErrors.command}
          />

          <div>
            <Input
              id="schedule"
              label="Schedule"
              placeholder="* * * * *"
              value={formData.schedule}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, schedule: e.target.value }))
              }
              error={formErrors.schedule}
              className="font-mono"
            />
            <p className="mt-1 text-xs text-gray-500">
              Cron format: <code className="bg-gray-100 px-1 rounded">* * * * *</code>{' '}
              = minute hour day month weekday
            </p>
          </div>

          {/* Schedule Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      schedule: preset.value,
                    }))
                  }
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    formData.schedule === preset.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            id="description"
            label="Description"
            placeholder="Optional description for this cron job"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
          />

          <Select
            id="web-app"
            label="Web App (optional)"
            options={webAppOptions}
            value={String(formData.web_app_id)}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                web_app_id: Number(e.target.value),
              }))
            }
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={createCronJob.isPending || updateCronJob.isPending}
            >
              {editingJob ? 'Update Cron Job' : 'Create Cron Job'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Cron Job"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-2">
          Are you sure you want to delete this cron job?
        </p>
        {deleteTarget && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <code className="text-sm font-mono text-gray-800 block break-all">
              {deleteTarget.schedule} {deleteTarget.command}
            </code>
            {deleteTarget.description && (
              <p className="text-xs text-gray-500 mt-1">
                {deleteTarget.description}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteCronJob.isPending}
          >
            Delete Cron Job
          </Button>
        </div>
      </Modal>
    </div>
  );
}
