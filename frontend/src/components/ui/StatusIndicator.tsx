interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'unreachable' | 'running' | 'stopped' | 'deploying' | 'failed' | 'maintenance' | 'pending' | 'in_progress' | 'success' | 'rolled_back' | 'completed' | 'expired' | 'revoked';
  showLabel?: boolean;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: 'bg-green-500', label: 'Active' },
  running: { color: 'bg-green-500', label: 'Running' },
  success: { color: 'bg-green-500', label: 'Success' },
  completed: { color: 'bg-green-500', label: 'Completed' },
  inactive: { color: 'bg-gray-400', label: 'Inactive' },
  stopped: { color: 'bg-gray-400', label: 'Stopped' },
  unreachable: { color: 'bg-red-500', label: 'Unreachable' },
  failed: { color: 'bg-red-500', label: 'Failed' },
  expired: { color: 'bg-red-500', label: 'Expired' },
  revoked: { color: 'bg-red-500', label: 'Revoked' },
  deploying: { color: 'bg-blue-500', label: 'Deploying' },
  in_progress: { color: 'bg-blue-500', label: 'In Progress' },
  pending: { color: 'bg-yellow-500', label: 'Pending' },
  maintenance: { color: 'bg-yellow-500', label: 'Maintenance' },
  rolled_back: { color: 'bg-orange-500', label: 'Rolled Back' },
};

export default function StatusIndicator({ status, showLabel = true }: StatusIndicatorProps) {
  const config = statusConfig[status] || { color: 'bg-gray-400', label: status };

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-2 h-2 rounded-full ${config.color}`} />
      {showLabel && <span className="text-sm text-gray-700">{config.label}</span>}
    </div>
  );
}
