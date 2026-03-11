import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Server, Globe, Activity, ShieldAlert, Rocket, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/hooks/useDashboard';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { Deployment, ActivityLog, ServerMetric } from '@/types';

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMetricTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const deploymentStatusVariant: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  success: 'success',
  failed: 'danger',
  pending: 'warning',
  in_progress: 'info',
  rolled_back: 'default',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: dashboard, isLoading, error } = useDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header title="Dashboard" />
        <Card>
          <div className="text-center py-12">
            <p className="text-red-500">Failed to load dashboard data.</p>
          </div>
        </Card>
      </div>
    );
  }

  const metricsData = (dashboard?.server_metrics || []).map((m: ServerMetric) => ({
    time: formatMetricTime(m.recorded_at),
    cpu: m.cpu_usage,
    memory: Math.round((m.memory_usage / m.memory_total) * 100),
  }));

  return (
    <div>
      <Header
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'User'}`}
        description="Here's an overview of your infrastructure"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Server}
          label="Total Servers"
          value={dashboard?.servers_count ?? 0}
          color="bg-blue-600"
        />
        <StatCard
          icon={Globe}
          label="Total Web Apps"
          value={dashboard?.web_apps_count ?? 0}
          color="bg-green-600"
        />
        <StatCard
          icon={Activity}
          label="Active Servers"
          value={dashboard?.active_servers ?? 0}
          color="bg-purple-600"
        />
        <StatCard
          icon={ShieldAlert}
          label="SSL Expiring Soon"
          value={dashboard?.ssl_expiring_soon ?? 0}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Server Resource Chart */}
        <Card>
          <CardHeader title="Server Resource Usage" description="CPU & Memory over time" />
          {metricsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
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
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  name="CPU"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="memory"
                  name="Memory"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
              No metrics data available
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader title="Recent Activity" />
          <div className="space-y-3 max-h-[250px] overflow-y-auto">
            {(dashboard?.recent_activity || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No recent activity</p>
            ) : (
              (dashboard?.recent_activity || []).slice(0, 10).map((activity: ActivityLog) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.action}</span>
                    </p>
                    {activity.description && (
                      <p className="text-xs text-gray-500 truncate">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Recent Deployments */}
      <Card>
        <CardHeader
          title="Recent Deployments"
          action={
            <button
              onClick={() => navigate('/deployments')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </button>
          }
        />
        <div className="overflow-x-auto">
          {(dashboard?.recent_deployments || []).length === 0 ? (
            <div className="text-center py-8">
              <Rocket className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No deployments yet</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(dashboard?.recent_deployments || [])
                  .slice(0, 5)
                  .map((deploy: Deployment) => {
                    const duration =
                      deploy.started_at && deploy.completed_at
                        ? Math.round(
                            (new Date(deploy.completed_at).getTime() -
                              new Date(deploy.started_at).getTime()) /
                              1000
                          )
                        : null;

                    return (
                      <tr key={deploy.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={deploymentStatusVariant[deploy.status] || 'default'}>
                            {deploy.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {deploy.branch || 'main'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                          {deploy.commit_hash
                            ? deploy.commit_hash.substring(0, 7)
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(deploy.started_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {duration !== null ? `${duration}s` : '-'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
