import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ServerListPage from '@/pages/servers/ServerListPage';
import ServerDetailPage from '@/pages/servers/ServerDetailPage';
import AddServerPage from '@/pages/servers/AddServerPage';
import WebAppListPage from '@/pages/webapps/WebAppListPage';
import WebAppDetailPage from '@/pages/webapps/WebAppDetailPage';
import NginxListPage from '@/pages/nginx/NginxListPage';
import SslListPage from '@/pages/ssl/SslListPage';
import FirewallListPage from '@/pages/firewall/FirewallListPage';
import DatabaseListPage from '@/pages/databases/DatabaseListPage';
import BackupListPage from '@/pages/backups/BackupListPage';
import GithubWebhookListPage from '@/pages/github/GithubWebhookListPage';
import CronJobListPage from '@/pages/cronjobs/CronJobListPage';
import DeploymentListPage from '@/pages/deployments/DeploymentListPage';
import UserListPage from '@/pages/users/UserListPage';
import ActivityLogPage from '@/pages/activity/ActivityLogPage';
import NotFoundPage from '@/pages/NotFoundPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Guest Routes */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="servers" element={<ServerListPage />} />
        <Route path="servers/add" element={<AddServerPage />} />
        <Route path="servers/:id" element={<ServerDetailPage />} />
        <Route path="web-apps" element={<WebAppListPage />} />
        <Route path="web-apps/:serverId/:appId" element={<WebAppDetailPage />} />
        <Route path="nginx" element={<NginxListPage />} />
        <Route path="ssl" element={<SslListPage />} />
        <Route path="firewall" element={<FirewallListPage />} />
        <Route path="databases" element={<DatabaseListPage />} />
        <Route path="backups" element={<BackupListPage />} />
        <Route path="github" element={<GithubWebhookListPage />} />
        <Route path="cron-jobs" element={<CronJobListPage />} />
        <Route path="deployments" element={<DeploymentListPage />} />
        <Route path="users" element={<UserListPage />} />
        <Route path="activity" element={<ActivityLogPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
