// User types
export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  roles: string[];
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  name: string;
  guard_name: string;
}

// Server types
export interface Server {
  id: number;
  user_id: number;
  name: string;
  hostname: string;
  ip_address: string;
  ssh_port: number;
  ssh_user: string;
  os_type: string | null;
  os_version: string | null;
  status: 'active' | 'inactive' | 'unreachable';
  /** true = control plane / local hosting; false = SSH-managed remote VPS */
  is_local: boolean;
  provider: string;
  notes: string | null;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
  web_apps_count?: number;
}

export interface ServerFormData {
  name: string;
  hostname: string;
  ip_address?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_private_key?: string;
  ssh_key_passphrase?: string;
  ssh_password?: string;
  is_local?: boolean;
  provider: string;
  notes?: string;
}

// Web App types
export interface WebApp {
  id: number;
  server_id: number;
  user_id: number;
  name: string;
  domain: string;
  app_type: 'laravel' | 'nodejs' | 'react' | 'static' | 'custom';
  git_repository: string | null;
  git_branch: string;
  has_git_token: boolean;
  has_git_deploy_key: boolean;
  git_deploy_key_public: string | null;
  deploy_path: string;
  docker_compose_path: string | null;
  port: number | null;
  status: 'running' | 'stopped' | 'deploying' | 'failed' | 'maintenance';
  auto_deploy: boolean;
  docker_container_name: string | null;
  environment_variables: string | null;
  deployments?: Deployment[];
  created_at: string;
  updated_at: string;
}

export interface WebAppFormData {
  name: string;
  domain: string;
  app_type: string;
  git_repository?: string;
  git_branch: string;
  git_token?: string;
  deploy_path: string;
  docker_compose_path?: string;
  port?: number;
  docker_container_name?: string;
  environment_variables?: string | null;
  auto_deploy: boolean;
}

// Nginx types
export interface NginxConfig {
  id: number;
  server_id: number;
  web_app_id: number | null;
  domain: string;
  config_content: string;
  is_active: boolean;
  is_ssl: boolean;
  upstream_port: number | null;
  created_at: string;
  updated_at: string;
}

// SSL Certificate types
export interface SslCertificate {
  id: number;
  server_id: number;
  web_app_id: number | null;
  nginx_config_id: number | null;
  domain: string;
  type: 'letsencrypt' | 'custom' | 'self_signed';
  issued_at: string | null;
  expires_at: string | null;
  auto_renew: boolean;
  status: 'active' | 'expired' | 'pending' | 'revoked';
  created_at: string;
  updated_at: string;
}

// Database types
export interface Database {
  id: number;
  server_id: number;
  name: string;
  charset: string;
  collation: string;
  size_mb: number | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseUser {
  id: number;
  server_id: number;
  database_id: number | null;
  username: string;
  host: string;
  privileges: string[];
  created_at: string;
  updated_at: string;
}

// Firewall types
export interface FirewallRule {
  id: number;
  server_id: number;
  rule_type: 'allow' | 'deny' | 'limit';
  direction: 'in' | 'out';
  protocol: 'tcp' | 'udp' | 'any';
  port: string;
  from_ip: string | null;
  to_ip: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// GitHub Webhook types
export interface GithubWebhook {
  id: number;
  server_id: number;
  web_app_id: number;
  repository: string;
  branch: string;
  webhook_url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  created_at: string;
  updated_at: string;
}

// Deployment types
export interface Deployment {
  id: number;
  web_app_id: number;
  user_id: number | null;
  server_id: number;
  commit_hash: string | null;
  commit_message: string | null;
  branch: string | null;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
  log: string | null;
  error_output: string | null;
  started_at: string | null;
  completed_at: string | null;
  rolled_back_at: string | null;
  created_at: string;
  updated_at: string;
}

// Server Metrics types
export interface ServerMetric {
  id: number;
  server_id: number;
  cpu_usage: number;
  memory_usage: number;
  memory_total: number;
  disk_usage: number;
  disk_total: number;
  network_in: number;
  network_out: number;
  load_average_1: number;
  load_average_5: number;
  load_average_15: number;
  recorded_at: string;
}

// Backup types
export interface Backup {
  id: number;
  server_id: number;
  web_app_id: number | null;
  database_id: number | null;
  type: 'full' | 'database' | 'files' | 'config';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  file_path: string | null;
  file_size: number | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Activity Log types
export interface ActivityLog {
  id: number;
  user_id: number | null;
  server_id: number | null;
  action: string;
  description: string | null;
  properties: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  user?: User;
  server?: Server;
}

// Cron Job types
export interface CronJob {
  id: number;
  server_id: number;
  web_app_id: number | null;
  command: string;
  schedule: string;
  description: string | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

// Notification types
export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
}

// Dashboard types
export interface DashboardStats {
  servers_count: number;
  web_apps_count: number;
  active_servers: number;
  ssl_expiring_soon: number;
  recent_deployments: Deployment[];
  recent_activity: ActivityLog[];
  server_metrics: ServerMetric[];
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}
