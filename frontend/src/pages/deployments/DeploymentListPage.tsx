import { useState } from 'react';
import {
  Rocket,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Loader2,
  GitBranch,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useServers } from '@/hooks/useServers';
import { useWebApps } from '@/hooks/useWebApps';
import { useAllDeployments, useDeployments, useRollbackDeployment } from '@/hooks/useDeployments';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import type { Deployment } from '@/types';

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '---';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;

  if (diffMs < 0) return '---';

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '---';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusConfig: Record<
  Deployment['status'],
  {
    icon: React.ReactNode;
    badgeVariant: 'warning' | 'info' | 'success' | 'danger' | 'default';
    label: string;
  }
> = {
  pending: {
    icon: <Clock className="w-4 h-4 text-yellow-500" />,
    badgeVariant: 'warning',
    label: 'Pending',
  },
  in_progress: {
    icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    badgeVariant: 'info',
    label: 'In Progress',
  },
  success: {
    icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    badgeVariant: 'success',
    label: 'Success',
  },
  failed: {
    icon: <XCircle className="w-4 h-4 text-red-500" />,
    badgeVariant: 'danger',
    label: 'Failed',
  },
  rolled_back: {
    icon: <AlertCircle className="w-4 h-4 text-orange-500" />,
    badgeVariant: 'warning',
    label: 'Rolled Back',
  },
};

export default function DeploymentListPage() {
  const { data: servers } = useServers();
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const [selectedWebAppId, setSelectedWebAppId] = useState<number>(0);

  const { data: webApps } = useWebApps(selectedServerId);
  const { data: allDeployments, isLoading: isLoadingAll, error: allError } = useAllDeployments(selectedServerId);
  const { data: filteredDeployments, isLoading: isLoadingFiltered, error: filteredError } = useDeployments(
    selectedServerId,
    selectedWebAppId
  );
  const rollbackDeployment = useRollbackDeployment(
    selectedServerId,
    selectedWebAppId || 0
  );

  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);

  const deployments = selectedWebAppId ? filteredDeployments : allDeployments;
  const isLoading = selectedWebAppId ? isLoadingFiltered : isLoadingAll;
  const error = selectedWebAppId ? filteredError : allError;

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
    return app?.name || `App #${webAppId}`;
  };

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    try {
      await rollbackDeployment.mutateAsync(rollbackTarget.id);
      setRollbackTarget(null);
    } catch {
      toast.error('Failed to initiate rollback');
    }
  };

  const toggleRow = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div>
      <Header
        title="Deployments"
        description="View deployment history across all applications"
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="max-w-sm flex-1">
            <Select
              id="server-select"
              label="Select Server"
              options={serverOptions}
              value={String(selectedServerId)}
              onChange={(e) => {
                setSelectedServerId(Number(e.target.value));
                setSelectedWebAppId(0);
              }}
            />
          </div>
          {selectedServerId > 0 && (
            <div className="max-w-sm flex-1">
              <Select
                id="webapp-filter"
                label="Filter by Web App"
                options={webAppOptions}
                value={String(selectedWebAppId)}
                onChange={(e) => setSelectedWebAppId(Number(e.target.value))}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Content */}
      {selectedServerId === 0 ? (
        <Card>
          <EmptyState
            icon={<Rocket className="w-12 h-12" />}
            title="Select a server"
            description="Choose a server from the dropdown above to view its deployment history."
          />
        </Card>
      ) : error ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 text-sm">
              Failed to load deployments. Please try again.
            </p>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : !deployments || deployments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Rocket className="w-12 h-12" />}
            title="No deployments"
            description={
              selectedWebAppId
                ? 'No deployments found for this web app.'
                : 'No deployments found on this server yet.'
            }
          />
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-3 py-3" />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    App
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deployments.map((deployment) => {
                  const config = statusConfig[deployment.status];
                  const isExpanded = expandedRow === deployment.id;

                  return (
                    <tr key={deployment.id} className="group">
                      <td className="px-3 py-4">
                        <button
                          onClick={() => toggleRow(deployment.id)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400"
                          title={isExpanded ? 'Collapse log' : 'Expand log'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {config.icon}
                          <Badge variant={config.badgeVariant}>
                            {config.label}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {deployment.commit_hash ? (
                          <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                            {deployment.commit_hash.substring(0, 7)}
                          </code>
                        ) : (
                          <span className="text-sm text-gray-400">---</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="text-sm text-gray-700 truncate block max-w-[250px]"
                          title={deployment.commit_message || ''}
                        >
                          {deployment.commit_message || '---'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {deployment.branch ? (
                          <Badge variant="info">
                            <GitBranch className="w-3 h-3 mr-1" />
                            {deployment.branch}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-400">---</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {getWebAppName(deployment.web_app_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(deployment.started_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-600">
                          {deployment.status === 'in_progress' ? (
                            <span className="text-blue-600">
                              {formatDuration(deployment.started_at, null)}
                            </span>
                          ) : (
                            formatDuration(
                              deployment.started_at,
                              deployment.completed_at
                            )
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {deployment.status === 'success' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRollbackTarget(deployment)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Rollback
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded deployment logs are rendered outside the table for better layout */}
          {expandedRow &&
            deployments
              .filter((d) => d.id === expandedRow)
              .map((deployment) => (
                <div
                  key={`log-${deployment.id}`}
                  className="border-t border-gray-200 bg-gray-50 px-6 py-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      Deployment Log
                    </span>
                    <span className="text-xs text-gray-400">
                      #{deployment.id}
                    </span>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 max-h-80 overflow-y-auto">
                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                      {deployment.log || 'No log output available.'}
                    </pre>
                  </div>
                </div>
              ))}
        </Card>
      )}

      {/* Rollback Confirmation Modal */}
      <Modal
        isOpen={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        title="Confirm Rollback"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to rollback to this deployment? This will
            trigger a new deployment to restore the previous state.
          </p>
          {rollbackTarget && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">
                  Commit:
                </span>
                <code className="text-xs font-mono bg-gray-200 px-1.5 py-0.5 rounded">
                  {rollbackTarget.commit_hash?.substring(0, 7) || '---'}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">
                  Message:
                </span>
                <span className="text-xs text-gray-700">
                  {rollbackTarget.commit_message || '---'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">
                  Deployed:
                </span>
                <span className="text-xs text-gray-700">
                  {formatDate(rollbackTarget.started_at)}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setRollbackTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRollback}
              isLoading={rollbackDeployment.isPending}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Confirm Rollback
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
