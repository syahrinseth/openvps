import { useState } from 'react';
import {
  Archive,
  Plus,
  Trash2,
  RotateCcw,
  Server,
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { useServers } from '@/hooks/useServers';
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
} from '@/hooks/useBackups';
import { useDatabases } from '@/hooks/useDatabases';
import { useWebApps } from '@/hooks/useWebApps';
import type { Backup } from '@/types';

const BACKUP_TYPE_OPTIONS = [
  { value: 'full', label: 'Full Backup' },
  { value: 'database', label: 'Database' },
  { value: 'files', label: 'Files' },
  { value: 'config', label: 'Configuration' },
];

const typeBadgeVariant: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  full: 'info',
  database: 'success',
  files: 'warning',
  config: 'default',
};

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '--';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function BackupListPage() {
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showRestore, setShowRestore] = useState<Backup | null>(null);
  const [showDelete, setShowDelete] = useState<Backup | null>(null);

  // Form state
  const [backupType, setBackupType] = useState('full');
  const [backupWebAppId, setBackupWebAppId] = useState('');
  const [backupDatabaseId, setBackupDatabaseId] = useState('');
  const [backupNotes, setBackupNotes] = useState('');

  const serverId = selectedServerId ?? 0;

  // Queries
  const { data: servers, isLoading: serversLoading } = useServers();
  const { data: backups, isLoading: backupsLoading } = useBackups(serverId);
  const { data: databases } = useDatabases(serverId);
  const { data: webApps } = useWebApps(serverId);

  // Mutations
  const createBackup = useCreateBackup(serverId);
  const deleteBackup = useDeleteBackup(serverId);
  const restoreBackup = useRestoreBackup(serverId);

  const serverOptions = (servers ?? []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const webAppOptions = (webApps ?? []).map((a) => ({
    value: String(a.id),
    label: a.name,
  }));

  const databaseOptions = (databases ?? []).map((d) => ({
    value: String(d.id),
    label: d.name,
  }));

  // Summary stats
  const totalBackups = backups?.length ?? 0;
  const completedCount = backups?.filter((b) => b.status === 'completed').length ?? 0;
  const failedCount = backups?.filter((b) => b.status === 'failed').length ?? 0;
  const totalSizeBytes =
    backups?.reduce((sum, b) => sum + (b.file_size ?? 0), 0) ?? 0;

  // --- Handlers ---

  function resetCreateForm() {
    setBackupType('full');
    setBackupWebAppId('');
    setBackupDatabaseId('');
    setBackupNotes('');
  }

  function handleCreateBackup(e: React.FormEvent) {
    e.preventDefault();
    const payload: {
      type: string;
      web_app_id?: number;
      database_id?: number;
      notes?: string;
    } = { type: backupType };

    if (
      (backupType === 'files' || backupType === 'full') &&
      backupWebAppId
    ) {
      payload.web_app_id = Number(backupWebAppId);
    }
    if (backupType === 'database' && backupDatabaseId) {
      payload.database_id = Number(backupDatabaseId);
    }
    if (backupNotes.trim()) {
      payload.notes = backupNotes.trim();
    }

    createBackup.mutate(payload, {
      onSuccess: () => {
        setShowCreate(false);
        resetCreateForm();
      },
      onError: () => toast.error('Failed to create backup'),
    });
  }

  function handleRestore() {
    if (!showRestore) return;
    restoreBackup.mutate(showRestore.id, {
      onSuccess: () => setShowRestore(null),
      onError: () => toast.error('Failed to restore backup'),
    });
  }

  function handleDelete() {
    if (!showDelete) return;
    deleteBackup.mutate(showDelete.id, {
      onSuccess: () => setShowDelete(null),
      onError: () => toast.error('Failed to delete backup'),
    });
  }

  function getBackupTarget(backup: Backup): string {
    if (backup.web_app_id) {
      const app = webApps?.find((a) => a.id === backup.web_app_id);
      return app?.name ?? `App #${backup.web_app_id}`;
    }
    if (backup.database_id) {
      const db = databases?.find((d) => d.id === backup.database_id);
      return db?.name ?? `DB #${backup.database_id}`;
    }
    return '--';
  }

  // --- Columns ---

  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (b: Backup) => (
        <Badge variant={typeBadgeVariant[b.type] ?? 'default'}>
          {b.type.charAt(0).toUpperCase() + b.type.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b: Backup) => <StatusIndicator status={b.status} />,
    },
    {
      key: 'target',
      header: 'Target',
      render: (b: Backup) => (
        <span className="text-gray-700">{getBackupTarget(b)}</span>
      ),
    },
    {
      key: 'file_size',
      header: 'Size',
      render: (b: Backup) => formatFileSize(b.file_size),
    },
    {
      key: 'started_at',
      header: 'Started',
      render: (b: Backup) => formatRelativeTime(b.started_at),
    },
    {
      key: 'completed_at',
      header: 'Completed',
      render: (b: Backup) => formatRelativeTime(b.completed_at),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (b: Backup) => (
        <span className="text-gray-500 truncate max-w-[200px] block">
          {b.notes ?? '--'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (b: Backup) => (
        <div className="flex items-center justify-end gap-2">
          {b.status === 'completed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRestore(b)}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Restore
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDelete(b)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // --- Summary cards ---

  const summaryCards = [
    {
      label: 'Total Backups',
      value: totalBackups,
      icon: <Archive className="w-5 h-5 text-blue-500" />,
      bg: 'bg-blue-50',
    },
    {
      label: 'Completed',
      value: completedCount,
      icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      bg: 'bg-green-50',
    },
    {
      label: 'Failed',
      value: failedCount,
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      bg: 'bg-red-50',
    },
    {
      label: 'Total Size',
      value: formatFileSize(totalSizeBytes),
      icon: <HardDrive className="w-5 h-5 text-purple-500" />,
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div>
      <Header
        title="Backups"
        description="Manage backups for your servers and applications"
      />

      {/* Server Selector */}
      <div className="mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-gray-400" />
            <Select
              id="server-selector"
              label=""
              options={serverOptions}
              value={selectedServerId ? String(selectedServerId) : ''}
              onChange={(e) =>
                setSelectedServerId(e.target.value ? Number(e.target.value) : null)
              }
              disabled={serversLoading}
              className="max-w-xs"
            />
            {serversLoading && (
              <span className="text-sm text-gray-500">Loading servers...</span>
            )}
          </div>
        </Card>
      </div>

      {/* No server selected */}
      {!selectedServerId && (
        <Card>
          <EmptyState
            icon={<Server className="w-12 h-12" />}
            title="Select a Server"
            description="Choose a server from the dropdown above to manage its backups."
          />
        </Card>
      )}

      {/* Main content */}
      {selectedServerId && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {summaryCards.map((card) => (
              <Card key={card.label}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}
                  >
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {card.value}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Backups table */}
          <Card padding={false}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Backups</h3>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Create Backup
              </Button>
            </div>

            {backupsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : backups && backups.length > 0 ? (
              <Table
                columns={columns}
                data={backups}
                keyExtractor={(b) => b.id}
              />
            ) : (
              <EmptyState
                icon={<Archive className="w-12 h-12" />}
                title="No Backups"
                description="Create your first backup to protect your server data."
                action={{
                  label: 'Create Backup',
                  onClick: () => setShowCreate(true),
                }}
              />
            )}
          </Card>
        </>
      )}

      {/* Create Backup Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetCreateForm();
        }}
        title="Create Backup"
      >
        <form onSubmit={handleCreateBackup} className="space-y-4">
          <Select
            id="backup-type"
            label="Backup Type"
            options={BACKUP_TYPE_OPTIONS}
            value={backupType}
            onChange={(e) => {
              setBackupType(e.target.value);
              setBackupWebAppId('');
              setBackupDatabaseId('');
            }}
          />

          {(backupType === 'files' || backupType === 'full') && (
            <Select
              id="backup-webapp"
              label="Web App (optional)"
              options={webAppOptions}
              value={backupWebAppId}
              onChange={(e) => setBackupWebAppId(e.target.value)}
            />
          )}

          {backupType === 'database' && (
            <Select
              id="backup-database"
              label="Database (optional)"
              options={databaseOptions}
              value={backupDatabaseId}
              onChange={(e) => setBackupDatabaseId(e.target.value)}
            />
          )}

          <div className="w-full">
            <label
              htmlFor="backup-notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              id="backup-notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              value={backupNotes}
              onChange={(e) => setBackupNotes(e.target.value)}
              placeholder="Optional notes about this backup..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createBackup.isPending}>
              Create Backup
            </Button>
          </div>
        </form>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        isOpen={!!showRestore}
        onClose={() => setShowRestore(null)}
        title="Restore Backup"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Destructive Operation
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Restoring this backup will overwrite current data. This action
                  cannot be undone. Make sure you have a recent backup of the
                  current state before proceeding.
                </p>
              </div>
            </div>
          </div>
          {showRestore && (
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-medium">Type:</span>{' '}
                {showRestore.type.charAt(0).toUpperCase() + showRestore.type.slice(1)}
              </p>
              <p>
                <span className="font-medium">Created:</span>{' '}
                {formatRelativeTime(showRestore.started_at)}
              </p>
              {showRestore.file_size && (
                <p>
                  <span className="font-medium">Size:</span>{' '}
                  {formatFileSize(showRestore.file_size)}
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowRestore(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={restoreBackup.isPending}
              onClick={handleRestore}
            >
              Restore Backup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDelete}
        onClose={() => setShowDelete(null)}
        title="Delete Backup"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete this backup? The backup file will be
            permanently removed and cannot be recovered.
          </p>
          {showDelete && (
            <div className="text-sm text-gray-500 space-y-1">
              <p>
                <span className="font-medium text-gray-700">Type:</span>{' '}
                {showDelete.type.charAt(0).toUpperCase() + showDelete.type.slice(1)}
              </p>
              {showDelete.file_size && (
                <p>
                  <span className="font-medium text-gray-700">Size:</span>{' '}
                  {formatFileSize(showDelete.file_size)}
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteBackup.isPending}
              onClick={handleDelete}
            >
              Delete Backup
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
