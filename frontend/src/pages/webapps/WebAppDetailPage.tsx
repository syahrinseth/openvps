import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Globe,
  Rocket,
  ArrowLeft,
  GitBranch,
  FolderOpen,
  Play,
  Square,
  RefreshCw,
  Terminal,
  Settings,
  Pencil,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  useWebApp,
  useDeployWebApp,
  useStartWebApp,
  useStopWebApp,
  useRestartWebApp,
  useSetupWebApp,
  useUpdateWebApp,
  useWebAppDeployments,
  useGetEnvExample,
  useRunScript,
} from '@/hooks/useWebApps';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import type { Deployment } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const appTypeBadge: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  laravel: 'danger',
  nodejs: 'success',
  react: 'info',
  static: 'default',
  custom: 'warning',
};

const deploymentStatusVariant: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  success: 'success',
  failed: 'danger',
  in_progress: 'warning',
  pending: 'info',
  rolled_back: 'default',
};

function DeploymentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success':     return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    case 'failed':      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'in_progress': return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin shrink-0" />;
    case 'pending':     return <Clock className="w-4 h-4 text-blue-400 shrink-0" />;
    default:            return <RefreshCw className="w-4 h-4 text-gray-400 shrink-0" />;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shortHash(hash: string | null): string {
  return hash ? hash.slice(0, 7) : '—';
}

function parseEnvVars(raw: string | null | undefined): { key: string; value: string }[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return idx === -1
        ? { key: line, value: '' }
        : { key: line.slice(0, idx), value: line.slice(idx + 1) };
    });
}

/**
 * Like parseEnvVars but also includes commented-out `# KEY=value` lines.
 * This is important for .env.example files (e.g. Laravel 11 has DB config commented out).
 */
function parseEnvExampleVars(raw: string | null | undefined): { key: string; value: string }[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .map((line) => (line.startsWith('#') ? line.replace(/^#+\s*/, '') : line))
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=');
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((v) => v.key && /^[A-Z_][A-Z0-9_]*$/i.test(v.key));
}

function serializeEnvVars(vars: { key: string; value: string }[]): string {
  return vars
    .filter((v) => v.key.trim())
    .map((v) => `${v.key}=${v.value}`)
    .join('\n');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeploymentRow({ deployment }: { deployment: Deployment }) {
  const [open, setOpen] = useState(false);
  const logContent = [deployment.log, deployment.error_output].filter(Boolean).join('\n\n');

  return (
    <Card className="p-0 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <DeploymentStatusIcon status={deployment.status} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={deploymentStatusVariant[deployment.status] ?? 'default'}>
                {deployment.status.replace('_', ' ')}
              </Badge>
              {deployment.branch && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <GitBranch className="w-3 h-3" />
                  {deployment.branch}
                </span>
              )}
              {deployment.commit_hash && (
                <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-700 font-mono">
                  {shortHash(deployment.commit_hash)}
                </code>
              )}
            </div>
            {deployment.commit_message && (
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-lg">
                {deployment.commit_message}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-gray-400">{timeAgo(deployment.created_at)}</span>
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4 bg-gray-50 space-y-3">
          {logContent ? (
            <pre className="text-xs bg-gray-900 text-green-400 rounded p-3 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {logContent}
            </pre>
          ) : (
            <p className="text-sm text-gray-400 italic">No log output.</p>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-gray-400 pt-1">
            {deployment.started_at && <span>Started: {formatDate(deployment.started_at)}</span>}
            {deployment.completed_at && <span>Completed: {formatDate(deployment.completed_at)}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const tabs = [
  { key: 'overview',     label: 'Overview',     icon: Globe },
  { key: 'deployments',  label: 'Deployments',  icon: Rocket },
  { key: 'environment',  label: 'Environment',  icon: Settings },
  { key: 'logs',         label: 'Logs',         icon: Terminal },
  { key: 'console',      label: 'Console',      icon: Terminal },
];

export default function WebAppDetailPage() {
  const { serverId, appId } = useParams<{ serverId: string; appId: string }>();
  const navigate = useNavigate();
  const serverIdNum = Number(serverId);
  const appIdNum = Number(appId);

  const [activeTab, setActiveTab] = useState('overview');
  const [deploymentsPage, setDeploymentsPage] = useState(1);

  // Env vars editor state
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [envEdited, setEnvEdited] = useState(false);

  const { data: app, isLoading, error, refetch } = useWebApp(serverIdNum, appIdNum);
  const deploy   = useDeployWebApp(serverIdNum);
  const start    = useStartWebApp(serverIdNum);
  const stop     = useStopWebApp(serverIdNum);
  const restart  = useRestartWebApp(serverIdNum);
  const setup    = useSetupWebApp(serverIdNum);
  const updateWebApp = useUpdateWebApp(serverIdNum);
  const getEnvExample = useGetEnvExample(serverIdNum);
  const runScript = useRunScript(serverIdNum);

  // Console tab state
  const [scriptInput, setScriptInput] = useState('');
  const [scriptResult, setScriptResult] = useState<{ output: string; exit_code: number } | null>(null);

  // Full deployments list (paginated) — only fetched when tab is active
  const { data: deploymentsData, isLoading: deploymentsLoading } = useWebAppDeployments(
    serverIdNum,
    appIdNum,
    deploymentsPage
  );

  // Initialise env vars when app data arrives (or environment_variables changes)
  useEffect(() => {
    if (app) {
      setEnvVars(parseEnvVars(app.environment_variables));
      setEnvEdited(false);
    }
  }, [app?.environment_variables]);

  const handleSaveEnvVars = () => {
    const serialized = serializeEnvVars(envVars);
    updateWebApp.mutate(
      { appId: appIdNum, data: { environment_variables: serialized || null } },
      { onSuccess: () => { setEnvEdited(false); refetch(); } }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div>
        <Header title="Web App Not Found" />
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              The web app you're looking for doesn't exist or you don't have access.
            </p>
            <Button variant="secondary" onClick={() => navigate('/web-apps')}>
              Back to Web Apps
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Deployments: use the paginated list if available, else fall back to the 5 preloaded
  const deploymentsList: Deployment[] =
    deploymentsData?.data ?? app.deployments ?? [];

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/web-apps')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Web Apps
        </button>
      </div>

      <Header
        title={app.name}
        description={app.domain}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate(`/web-apps/${serverId}/${appId}/edit`)}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="secondary"
              onClick={() => setup.mutate(app.id)}
              isLoading={setup.isPending}
            >
              <Settings className="w-4 h-4 mr-1" />
              Initialize Setup
            </Button>
            <Button
              variant="outline"
              onClick={() => deploy.mutate(app.id)}
              isLoading={deploy.isPending}
            >
              <Rocket className="w-4 h-4 mr-1" />
              Deploy
            </Button>
          </div>
        }
      />

      {/* App Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Status</p>
          <StatusIndicator status={app.status} />
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">App Type</p>
          <Badge variant={appTypeBadge[app.app_type] || 'default'}>{app.app_type}</Badge>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Git Branch</p>
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">{app.git_branch}</span>
          </div>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Auto Deploy</p>
          <Badge variant={app.auto_deploy ? 'success' : 'default'}>
            {app.auto_deploy ? 'Enabled' : 'Disabled'}
          </Badge>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Quick Actions:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => start.mutate(app.id)}
            isLoading={start.isPending}
            disabled={app.status === 'running'}
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            Start
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => stop.mutate(app.id)}
            isLoading={stop.isPending}
            disabled={app.status === 'stopped'}
          >
            <Square className="w-3.5 h-3.5 mr-1" />
            Stop
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => restart.mutate(app.id)}
            isLoading={restart.isPending}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Restart
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Overview ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Application Details" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">Domain</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{app.domain}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">App Type</dt>
                <dd className="text-sm text-gray-900 mt-0.5 capitalize">{app.app_type}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">Deploy Path</dt>
                <dd className="text-sm text-gray-900 mt-0.5 font-mono flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
                  {app.deploy_path}
                </dd>
              </div>
              {app.port && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase font-medium">Port</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{app.port}</dd>
                </div>
              )}
              {app.git_repository && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500 uppercase font-medium">Git Repository</dt>
                  <dd className="text-sm text-gray-900 mt-0.5 font-mono flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-gray-400" />
                    {app.git_repository}
                  </dd>
                </div>
              )}
              {app.docker_container_name && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase font-medium">Docker Container</dt>
                  <dd className="text-sm text-gray-900 mt-0.5 font-mono">
                    {app.docker_container_name}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">Created</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{formatDate(app.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">Last Updated</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{formatDate(app.updated_at)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {/* ── Deployments ──────────────────────────────────────────────── */}
      {activeTab === 'deployments' && (
        <div className="space-y-3">
          {deploymentsLoading && deploymentsList.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : deploymentsList.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Rocket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No deployments yet</h3>
                <p className="text-sm text-gray-500">
                  Click <strong>Deploy</strong> to trigger the first deployment.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {deploymentsList.map((d) => (
                <DeploymentRow key={d.id} deployment={d} />
              ))}

              {/* Pagination */}
              {deploymentsData && deploymentsData.meta.last_page > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-gray-500">
                    Page {deploymentsData.meta.current_page} of {deploymentsData.meta.last_page}
                    {' '}· {deploymentsData.meta.total} total
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deploymentsPage <= 1}
                      onClick={() => setDeploymentsPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deploymentsPage >= deploymentsData.meta.last_page}
                      onClick={() => setDeploymentsPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Environment Variables ─────────────────────────────────────── */}
      {activeTab === 'environment' && (
        <Card>
          <CardHeader
            title="Environment Variables"
            description="Stored encrypted at rest. Changes take effect on next deployment."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEnvVars}
                isLoading={updateWebApp.isPending}
                disabled={!envEdited}
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                Save Changes
              </Button>
            }
          />

          <div className="space-y-2">
            {envVars.length === 0 && !envEdited && (
              <p className="text-sm text-gray-400 italic mb-3">
                No environment variables set. Click "Add Variable" to get started.
              </p>
            )}

            {envVars.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="w-48 shrink-0 text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="KEY"
                  value={v.key}
                  onChange={(e) => {
                    const next = [...envVars];
                    next[i] = { ...next[i], key: e.target.value };
                    setEnvVars(next);
                    setEnvEdited(true);
                  }}
                />
                <span className="text-gray-400 font-mono">=</span>
                <input
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="value"
                  value={v.value}
                  onChange={(e) => {
                    const next = [...envVars];
                    next[i] = { ...next[i], value: e.target.value };
                    setEnvVars(next);
                    setEnvEdited(true);
                  }}
                />
                <button
                  onClick={() => {
                    setEnvVars(envVars.filter((_, j) => j !== i));
                    setEnvEdited(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                  title="Remove variable"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="pt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEnvVars([...envVars, { key: '', value: '' }]);
                  setEnvEdited(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Variable
              </Button>
              <Button
                variant="outline"
                size="sm"
                isLoading={getEnvExample.isPending}
                onClick={() => {
                  if (envVars.length > 0 && envEdited) {
                    if (!window.confirm('This will replace your current unsaved changes with values from .env.example. Continue?')) return;
                  }
                  getEnvExample.mutate(appIdNum, {
                    onSuccess: (content) => {
                      if (content) {
                        setEnvVars(parseEnvExampleVars(content));
                        setEnvEdited(true);
                      }
                    },
                  });
                }}
              >
                {!getEnvExample.isPending && <FolderOpen className="w-3.5 h-3.5 mr-1" />}
                Load from .env.example
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Logs ─────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <Card>
          <CardHeader
            title="Latest Deployment Log"
            description={
              deploymentsList[0]
                ? `Deployment from ${timeAgo(deploymentsList[0].created_at)}`
                : undefined
            }
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Refresh
              </Button>
            }
          />

          {deploymentsList.length === 0 ? (
            <div className="text-center py-12">
              <Terminal className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                No deployments yet. Run a deployment to see logs here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <DeploymentStatusIcon status={deploymentsList[0].status} />
                <Badge variant={deploymentStatusVariant[deploymentsList[0].status] ?? 'default'}>
                  {deploymentsList[0].status.replace('_', ' ')}
                </Badge>
                {deploymentsList[0].branch && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <GitBranch className="w-3 h-3" />
                    {deploymentsList[0].branch}
                  </span>
                )}
                {deploymentsList[0].commit_hash && (
                  <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-700 font-mono">
                    {shortHash(deploymentsList[0].commit_hash)}
                  </code>
                )}
              </div>

              {deploymentsList[0].log ? (
                <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {deploymentsList[0].log}
                </pre>
              ) : (
                <p className="text-sm text-gray-400 italic">No log output for this deployment.</p>
              )}

              {deploymentsList[0].error_output && (
                <>
                  <p className="text-xs font-semibold text-red-600 mt-4">Error output:</p>
                  <pre className="text-xs bg-gray-900 text-red-400 rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {deploymentsList[0].error_output}
                  </pre>
                </>
              )}

              <div className="flex flex-wrap gap-4 text-xs text-gray-400 pt-1">
                {deploymentsList[0].started_at && (
                  <span>Started: {formatDate(deploymentsList[0].started_at)}</span>
                )}
                {deploymentsList[0].completed_at && (
                  <span>Completed: {formatDate(deploymentsList[0].completed_at)}</span>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
      {/* ── Console ───────────────────────────────────────────────────── */}
      {activeTab === 'console' && (
        <Card>
          <CardHeader
            title="Run Script"
            description={
              app.deploy_path
                ? `Runs in: ${app.deploy_path}`
                : 'Run arbitrary commands on the server in the deploy directory.'
            }
          />

          <div className="space-y-4">
            <textarea
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 resize-y"
              rows={8}
              placeholder="# Enter commands to run on the server&#10;php artisan migrate --force&#10;php artisan cache:clear"
              value={scriptInput}
              onChange={(e) => setScriptInput(e.target.value)}
            />

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                disabled={!scriptInput.trim() || runScript.isPending}
                isLoading={runScript.isPending}
                onClick={() => {
                  runScript.mutate(
                    { appId: appIdNum, script: scriptInput },
                    { onSuccess: (result) => setScriptResult(result) }
                  );
                }}
              >
                <Play className="w-3.5 h-3.5 mr-1" />
                Run
              </Button>
              {scriptResult !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScriptResult(null)}
                >
                  Clear Output
                </Button>
              )}
            </div>

            {scriptResult !== null && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {scriptResult.exit_code === 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${scriptResult.exit_code === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Exit code: {scriptResult.exit_code}
                  </span>
                </div>
                {scriptResult.output ? (
                  <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {scriptResult.output}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-400 italic">No output.</p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
