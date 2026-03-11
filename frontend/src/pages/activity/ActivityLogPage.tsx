import { Activity, Construction } from 'lucide-react';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';

export default function ActivityLogPage() {
  return (
    <div>
      <Header
        title="Activity Log"
        description="View all actions and events across your infrastructure"
      />
      <Card>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4">
            <Construction className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Under Construction</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm">
            The full activity log viewer is being built. You'll be able to filter,
            search, and export activity logs here.
          </p>
          <div className="flex items-center gap-2 mt-4 text-gray-400">
            <Activity className="w-5 h-5" />
            <span className="text-sm">Coming Soon</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
