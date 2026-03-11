import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { getEcho } from '@/lib/echo';
import type { Deployment } from '@/types';

interface DeploymentBroadcastPayload {
  deployment: {
    id: number;
    web_app_id: number;
    server_id: number;
    status: Deployment['status'];
    commit_hash: string | null;
    commit_message: string | null;
    branch: string | null;
    log: string | null;
    started_at: string | null;
    completed_at: string | null;
  };
}

interface LiveDeploymentLogProps {
  /** The server ID — used to subscribe to the correct private channel. */
  serverId: number;
  /** The deployment to track. If null, the panel is hidden. */
  deployment: Deployment | null;
  /** Called when the user closes the live panel. */
  onClose: () => void;
}

const statusIcon: Record<Deployment['status'], React.ReactNode> = {
  pending:     <Clock className="w-4 h-4 text-yellow-500" />,
  in_progress: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  success:     <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed:      <XCircle className="w-4 h-4 text-red-500" />,
  rolled_back: <AlertCircle className="w-4 h-4 text-orange-500" />,
};

const statusLabel: Record<Deployment['status'], string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  success:     'Success',
  failed:      'Failed',
  rolled_back: 'Rolled Back',
};

/**
 * LiveDeploymentLog
 *
 * Subscribes to the `private-server.{serverId}.deployments` channel and listens
 * for `DeploymentUpdated` events. When the tracked deployment ID matches an
 * incoming event it updates the displayed log in real time.
 *
 * On success/failure it also invalidates the React Query deployments cache so
 * the main deployment list auto-refreshes.
 */
export default function LiveDeploymentLog({ serverId, deployment, onClose }: LiveDeploymentLogProps) {
  const queryClient = useQueryClient();
  const logEndRef = useRef<HTMLDivElement>(null);

  // Live state — we start from what the server already knows
  const [liveStatus, setLiveStatus] = useState<Deployment['status']>(deployment?.status ?? 'pending');
  const [liveLog, setLiveLog] = useState<string>(deployment?.log ?? '');

  // When the parent swaps in a new deployment (new deploy triggered), reset state
  useEffect(() => {
    if (deployment) {
      setLiveStatus(deployment.status);
      setLiveLog(deployment.log ?? '');
    }
  }, [deployment?.id]);

  // Auto-scroll to bottom when log changes
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLog]);

  // WebSocket subscription
  useEffect(() => {
    if (!serverId) return;

    const echo = getEcho();
    const channel = echo.private(`server.${serverId}.deployments`);

    channel.listen('.DeploymentUpdated', (payload: DeploymentBroadcastPayload) => {
      const incoming = payload.deployment;

      // Only process events for the deployment we are tracking
      if (!deployment || incoming.id !== deployment.id) return;

      setLiveStatus(incoming.status);
      if (incoming.log !== null) {
        setLiveLog(incoming.log);
      }

      // Invalidate queries when the deployment finishes
      if (incoming.status === 'success' || incoming.status === 'failed') {
        queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'deployments'] });
        queryClient.invalidateQueries({
          queryKey: ['servers', serverId, 'web-apps', incoming.web_app_id, 'deployments'],
        });
        queryClient.invalidateQueries({ queryKey: ['servers', serverId, 'web-apps'] });
      }
    });

    return () => {
      channel.stopListening('.DeploymentUpdated');
      // Leave the channel only when there are no other subscribers
      echo.leave(`server.${serverId}.deployments`);
    };
  }, [serverId, deployment?.id]);

  if (!deployment) return null;

  const isActive = liveStatus === 'pending' || liveStatus === 'in_progress';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/40">
      <div className="w-full max-w-3xl bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {statusIcon[liveStatus]}
            <div>
              <p className="text-sm font-semibold text-white">
                Live Deployment Log
              </p>
              <p className="text-xs text-gray-400">
                #{deployment.id}
                {deployment.commit_hash && (
                  <> &bull; <code className="font-mono">{deployment.commit_hash.substring(0, 7)}</code></>
                )}
                {deployment.branch && (
                  <> &bull; {deployment.branch}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              liveStatus === 'success'     ? 'bg-green-900/50 text-green-400' :
              liveStatus === 'failed'      ? 'bg-red-900/50 text-red-400' :
              liveStatus === 'in_progress' ? 'bg-blue-900/50 text-blue-400' :
                                             'bg-gray-700 text-gray-300'
            }`}>
              {statusLabel[liveStatus]}
            </span>
            {!isActive && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white text-lg leading-none transition-colors px-1"
                aria-label="Close"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Log output */}
        <div className="h-80 overflow-y-auto p-5 font-mono text-sm">
          {liveLog ? (
            <pre className="text-gray-300 whitespace-pre-wrap break-words">{liveLog}</pre>
          ) : (
            <p className="text-gray-500 text-xs">
              {isActive ? 'Waiting for output...' : 'No log output available.'}
            </p>
          )}
          {isActive && (
            <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
          )}
          <div ref={logEndRef} />
        </div>

        {/* Footer */}
        {isActive && (
          <div className="px-5 py-2 bg-gray-800 border-t border-gray-700">
            <p className="text-xs text-gray-500">Receiving live output via WebSocket…</p>
          </div>
        )}
      </div>
    </div>
  );
}
