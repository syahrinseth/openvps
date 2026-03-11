import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  Server,
  Globe,
  FileCode,
  ShieldCheck,
  Database,
  Shield,
  Archive,
  Activity,
  Wifi,
  ArrowLeft,
  BarChart3,
  Network,
} from 'lucide-react';
import { useServer, useServerMetrics, useTestConnection } from '@/hooks/useServers';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import type { ServerMetric } from '@/types';

const tabs = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'web-apps', label: 'Web Apps', icon: Globe },
  { key: 'nginx', label: 'Nginx', icon: FileCode },
  { key: 'ssl', label: 'SSL', icon: ShieldCheck },
  { key: 'databases', label: 'Databases', icon: Database },
  { key: 'firewall', label: 'Firewall', icon: Shield },
  { key: 'backups', label: 'Backups', icon: Archive },
  { key: 'metrics', label: 'Metrics', icon: Activity },
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

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const serverId = Number(id);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: server, isLoading, error } = useServer(serverId);
  const { data: metrics } = useServerMetrics(serverId);
  const testConnection = useTestConnection();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !server) {
    return (
      <div>
        <Header title="Server Not Found" />
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              The server you're looking for doesn't exist or you don't have access.
            </p>
            <Button variant="secondary" onClick={() => navigate('/servers')}>
              Back to Servers
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const metricsData = (metrics || []).map((m: ServerMetric) => ({
    time: new Date(m.recorded_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    cpu: m.cpu_usage,
    memory: m.memory_total > 0 ? Math.round((m.memory_usage / m.memory_total) * 100) : 0,
    disk: m.disk_total > 0 ? Math.round((m.disk_usage / m.disk_total) * 100) : 0,
    network_in: m.network_in,
    network_out: m.network_out,
  }));

  const latestMetric = metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/servers')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Servers
        </button>
      </div>

      <Header
        title={server.name}
        description={`${server.ip_address} - ${server.hostname}`}
        actions={
          <Button
            variant="outline"
            onClick={() => testConnection.mutate(server.id)}
            isLoading={testConnection.isPending}
          >
            <Wifi className="w-4 h-4 mr-1" />
            Test Connection
          </Button>
        }
      />

      {/* Server Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Status</p>
          <StatusIndicator status={server.status} />
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Provider</p>
          <Badge variant="info">{server.provider}</Badge>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">OS</p>
          <p className="text-sm font-medium text-gray-900">
            {server.os_type ? `${server.os_type} ${server.os_version || ''}` : 'Unknown'}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Last Connected</p>
          <p className="text-sm font-medium text-gray-900">
            {formatDate(server.last_connected_at)}
          </p>
        </Card>
      </div>

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

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Resource Usage Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {latestMetric ? (
              <>
                <Card>
                  <CardHeader title="CPU Usage" />
                  <div className="text-center">
                    <p className="text-4xl font-bold text-blue-600">
                      {latestMetric.cpu_usage}%
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Load: {latestMetric.load_average_1} / {latestMetric.load_average_5} / {latestMetric.load_average_15}
                    </p>
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Memory Usage" />
                  <div className="text-center">
                    <p className="text-4xl font-bold text-purple-600">
                      {latestMetric.memory_total > 0
                        ? Math.round((latestMetric.memory_usage / latestMetric.memory_total) * 100)
                        : 0}%
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {Math.round(latestMetric.memory_usage)} / {Math.round(latestMetric.memory_total)} MB
                    </p>
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Disk Usage" />
                  <div className="text-center">
                    <p className="text-4xl font-bold text-orange-600">
                      {latestMetric.disk_total > 0
                        ? Math.round((latestMetric.disk_usage / latestMetric.disk_total) * 100)
                        : 0}%
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {Math.round(latestMetric.disk_usage)} / {Math.round(latestMetric.disk_total)} GB
                    </p>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="lg:col-span-3">
                <div className="text-center py-8 text-gray-400">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No metrics data available yet</p>
                </div>
              </Card>
            )}
          </div>

          {/* Resource Charts */}
          {metricsData.length > 0 && (
            <Card>
              <CardHeader title="Resource History" description="CPU, Memory, and Disk usage over time" />
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="cpu" name="CPU" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="memory" name="Memory" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="disk" name="Disk" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Server Details */}
          <Card>
            <CardHeader title="Server Details" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">Hostname</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{server.hostname}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">IP Address</dt>
                <dd className="text-sm text-gray-900 mt-0.5 font-mono">{server.ip_address}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">SSH Port</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{server.ssh_port}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">SSH User</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{server.ssh_user}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">Provider</dt>
                <dd className="text-sm text-gray-900 mt-0.5 capitalize">{server.provider}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase font-medium">Created</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{formatDate(server.created_at)}</dd>
              </div>
              {server.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500 uppercase font-medium">Notes</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{server.notes}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      )}

      {/* ── METRICS TAB ── */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Latest snapshot summary */}
          {latestMetric ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'CPU', value: `${latestMetric.cpu_usage}%`, color: 'text-blue-600' },
                {
                  label: 'Memory',
                  value: latestMetric.memory_total > 0
                    ? `${Math.round((latestMetric.memory_usage / latestMetric.memory_total) * 100)}%`
                    : '0%',
                  color: 'text-purple-600',
                },
                {
                  label: 'Disk',
                  value: latestMetric.disk_total > 0
                    ? `${Math.round((latestMetric.disk_usage / latestMetric.disk_total) * 100)}%`
                    : '0%',
                  color: 'text-orange-600',
                },
                { label: 'Load (1m)', value: String(latestMetric.load_average_1), color: 'text-gray-700' },
                { label: 'Net In', value: formatBytes(latestMetric.network_in), color: 'text-green-600' },
                { label: 'Net Out', value: formatBytes(latestMetric.network_out), color: 'text-red-500' },
              ].map(({ label, value, color }) => (
                <Card key={label}>
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="text-center py-8 text-gray-400">
                <Activity className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No metrics collected yet. The scheduler collects metrics every minute.</p>
              </div>
            </Card>
          )}

          {/* CPU + Memory chart */}
          {metricsData.length > 0 && (
            <Card>
              <CardHeader title="CPU & Memory" description="Percentage over time" />
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value) => [`${value}%`]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="cpu" name="CPU" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="memory" name="Memory" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Disk usage chart */}
          {metricsData.length > 0 && (
            <Card>
              <CardHeader title="Disk Usage" description="Percentage over time" />
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value) => [`${value}%`]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="disk" name="Disk" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Network I/O chart */}
          {metricsData.length > 0 && (
            <Card>
              <CardHeader
                title="Network I/O"
                description="Inbound and outbound traffic (MB)"
              />
              <div className="flex items-center gap-2 mb-3">
                <Network className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">Values in megabytes per sample interval</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    tickFormatter={(v) => `${v} MB`}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)} MB`]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="network_in"
                    name="In"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="network_out"
                    name="Out"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Load average table */}
          {latestMetric && (
            <Card>
              <CardHeader title="Load Averages" description="Current server load" />
              <div className="grid grid-cols-3 gap-6 text-center">
                {[
                  { label: '1 minute', value: latestMetric.load_average_1 },
                  { label: '5 minutes', value: latestMetric.load_average_5 },
                  { label: '15 minutes', value: latestMetric.load_average_15 },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-2xl font-bold text-gray-800">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Other placeholder tabs ── */}
      {activeTab !== 'overview' && activeTab !== 'metrics' && (
        <Card>
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {tabs.find((t) => t.key === activeTab)?.label}
            </h3>
            <p className="text-sm text-gray-500">
              This section is coming soon. Navigate to the dedicated page for full management.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
