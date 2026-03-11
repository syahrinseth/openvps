import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Plus,
  Pencil,
  Trash2,
  Rocket,
  LogIn,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useActivityLogs } from '@/hooks/useActivityLog';
import { useServers } from '@/hooks/useServers';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import type { ActivityLog } from '@/types';

// --- Helpers ---

const ACTION_ICON_MAP: Record<string, { icon: typeof Plus; color: string; bg: string }> = {
  create: { icon: Plus, color: 'text-green-600', bg: 'bg-green-100' },
  created: { icon: Plus, color: 'text-green-600', bg: 'bg-green-100' },
  update: { icon: Pencil, color: 'text-blue-600', bg: 'bg-blue-100' },
  updated: { icon: Pencil, color: 'text-blue-600', bg: 'bg-blue-100' },
  delete: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100' },
  deleted: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100' },
  deploy: { icon: Rocket, color: 'text-purple-600', bg: 'bg-purple-100' },
  deployed: { icon: Rocket, color: 'text-purple-600', bg: 'bg-purple-100' },
  login: { icon: LogIn, color: 'text-gray-600', bg: 'bg-gray-100' },
};

function getActionConfig(action: string) {
  const lower = action.toLowerCase();
  for (const key of Object.keys(ACTION_ICON_MAP)) {
    if (lower.includes(key)) {
      return ACTION_ICON_MAP[key];
    }
  }
  return { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-100' };
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) === 1 ? '' : 's'} ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} month${Math.floor(diffDay / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(diffDay / 365)} year${Math.floor(diffDay / 365) === 1 ? '' : 's'} ago`;
}

const ACTION_TYPE_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'deploy', label: 'Deploy' },
  { value: 'login', label: 'Login' },
];

// --- Timeline Entry ---

function TimelineEntry({ entry, isLast }: { entry: ActivityLog; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const config = getActionConfig(entry.action);
  const Icon = config.icon;
  const hasProperties = entry.properties && Object.keys(entry.properties).length > 0;

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full ${config.bg} flex items-center justify-center shrink-0 z-10`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* Content */}
      <div className={`pb-8 flex-1 min-w-0 ${isLast ? '' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-gray-900 text-sm">{entry.action}</span>
          {entry.server && (
            <Badge variant="info">{entry.server.name}</Badge>
          )}
          <span className="text-xs text-gray-400">{relativeTime(entry.created_at)}</span>
        </div>

        {entry.description && (
          <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-2">
          {entry.user && (
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full ${getAvatarColor(entry.user.name)} flex items-center justify-center text-white text-[10px] font-semibold`}
              >
                {entry.user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-gray-500">{entry.user.name}</span>
            </div>
          )}
          {entry.ip_address && (
            <span className="text-xs text-gray-400">{entry.ip_address}</span>
          )}
        </div>

        {hasProperties && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show details
                </>
              )}
            </button>
            {expanded && (
              <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded-lg overflow-x-auto max-h-60">
                <code>{JSON.stringify(entry.properties, null, 2)}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function ActivityLogPage() {
  const { data: servers } = useServers();

  // Filters
  const [serverFilter, setServerFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]);
  const PER_PAGE = 20;

  const {
    data: pagedResult,
    isLoading,
    error,
    isFetching,
  } = useActivityLogs({
    server_id: serverFilter ? Number(serverFilter) : undefined,
    page,
    per_page: PER_PAGE,
  });

  const logs = pagedResult?.data;

  // Accumulate logs on each page fetch; reset when filters change
  const prevFiltersRef = useRef({ serverFilter, page: 1 });
  useEffect(() => {
    if (!logs) return;
    if (prevFiltersRef.current.serverFilter !== serverFilter) {
      // Filter changed — reset
      setAllLogs(logs);
      prevFiltersRef.current = { serverFilter, page: 1 };
    } else {
      // Same filter, new page — append (avoid duplicates)
      setAllLogs((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const newEntries = logs.filter((l) => !existingIds.has(l.id));
        return [...prev, ...newEntries];
      });
    }
  }, [logs, serverFilter]);

  const hasMorePages = pagedResult
    ? pagedResult.meta.current_page < pagedResult.meta.last_page
    : false;

  // Client-side filtering for action type and date range
  const filteredLogs = allLogs.filter((entry) => {
    if (actionFilter && !entry.action.toLowerCase().includes(actionFilter.toLowerCase())) {
      return false;
    }
    if (dateFrom) {
      const entryDate = new Date(entry.created_at);
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (entryDate < from) return false;
    }
    if (dateTo) {
      const entryDate = new Date(entry.created_at);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (entryDate > to) return false;
    }
    return true;
  });

  const serverOptions = [
    { value: '', label: 'All Servers' },
    ...(servers?.map((s) => ({ value: String(s.id), label: s.name })) ?? []),
  ];

  const hasActiveFilters = serverFilter || actionFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setServerFilter('');
    setActionFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setAllLogs([]);
  };

  // --- Loading ---
  if (isLoading) {
    return (
      <div>
        <Header title="Activity Log" description="View all actions and events across your infrastructure" />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div>
        <Header title="Activity Log" />
        <Card>
          <div className="text-center py-12">
            <p className="text-red-500">Failed to load activity logs. Please try again later.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Activity Log"
        description="View all actions and events across your infrastructure"
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            id="server-filter"
            label="Server"
            options={serverOptions}
            value={serverFilter}
            onChange={(e) => {
              setServerFilter(e.target.value);
              setPage(1);
            }}
          />
          <Select
            id="action-filter"
            label="Action Type"
            options={ACTION_TYPE_OPTIONS}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
          <Input
            id="date-from"
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            id="date-to"
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Timeline */}
      {filteredLogs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Activity className="w-12 h-12" />}
            title="No activity recorded yet"
            description={
              hasActiveFilters
                ? 'No activity matches your current filters. Try adjusting or clearing them.'
                : 'Activity from your infrastructure will appear here as events occur.'
            }
            action={
              hasActiveFilters
                ? { label: 'Clear Filters', onClick: clearFilters }
                : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="space-y-0">
            {filteredLogs.map((entry, index) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                isLast={index === filteredLogs.length - 1}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMorePages && (
            <div className="flex justify-center pt-4 border-t border-gray-100 mt-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
