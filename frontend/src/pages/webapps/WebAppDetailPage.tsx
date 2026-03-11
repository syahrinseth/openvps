import { useState } from 'react';
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
} from 'lucide-react';
import { useWebApp, useDeployWebApp } from '@/hooks/useWebApps';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StatusIndicator from '@/components/ui/StatusIndicator';

const appTypeBadge: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  laravel: 'danger',
  nodejs: 'success',
  react: 'info',
  static: 'default',
  custom: 'warning',
};

const tabs = [
  { key: 'overview', label: 'Overview', icon: Globe },
  { key: 'deployments', label: 'Deployments', icon: Rocket },
  { key: 'environment', label: 'Environment', icon: Settings },
  { key: 'logs', label: 'Logs', icon: Terminal },
];

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

export default function WebAppDetailPage() {
  const { serverId, appId } = useParams<{ serverId: string; appId: string }>();
  const navigate = useNavigate();
  const serverIdNum = Number(serverId);
  const appIdNum = Number(appId);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: app, isLoading, error } = useWebApp(serverIdNum, appIdNum);
  const deploy = useDeployWebApp(serverIdNum);

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
          <Badge variant={appTypeBadge[app.app_type] || 'default'}>
            {app.app_type}
          </Badge>
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

      {/* Status Controls */}
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Quick Actions:</span>
          <Button variant="outline" size="sm">
            <Play className="w-3.5 h-3.5 mr-1" />
            Start
          </Button>
          <Button variant="outline" size="sm">
            <Square className="w-3.5 h-3.5 mr-1" />
            Stop
          </Button>
          <Button variant="outline" size="sm">
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

      {/* Tab Content */}
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

      {activeTab === 'deployments' && (
        <Card>
          <div className="text-center py-12">
            <Rocket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Deployment History</h3>
            <p className="text-sm text-gray-500">
              View and manage deployments from the Deployments page.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/deployments')}
            >
              Go to Deployments
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'environment' && (
        <Card>
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Environment Variables
            </h3>
            <p className="text-sm text-gray-500">
              Environment variable management is coming soon.
            </p>
          </div>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card>
          <div className="text-center py-12">
            <Terminal className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Application Logs</h3>
            <p className="text-sm text-gray-500">
              Log viewer is coming soon.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
