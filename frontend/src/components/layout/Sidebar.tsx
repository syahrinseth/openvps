import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Server,
  Globe,
  FileCode,
  ShieldCheck,
  Shield,
  Database,
  Archive,
  Github,
  Clock,
  Rocket,
  Users,
  Activity,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: 'Main',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { name: 'Servers', href: '/servers', icon: Server },
      { name: 'Web Apps', href: '/web-apps', icon: Globe },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { name: 'Nginx', href: '/nginx', icon: FileCode },
      { name: 'SSL Certificates', href: '/ssl', icon: ShieldCheck },
      { name: 'Firewall', href: '/firewall', icon: Shield },
    ],
  },
  {
    title: 'Data',
    items: [
      { name: 'Databases', href: '/databases', icon: Database },
      { name: 'Backups', href: '/backups', icon: Archive },
    ],
  },
  {
    title: 'Automation',
    items: [
      { name: 'GitHub Webhooks', href: '/github', icon: Github },
      { name: 'Cron Jobs', href: '/cron-jobs', icon: Clock },
      { name: 'Deployments', href: '/deployments', icon: Rocket },
    ],
  },
  {
    title: 'Administration',
    items: [
      { name: 'Users', href: '/users', icon: Users, permission: 'admin' },
      { name: 'Activity Log', href: '/activity', icon: Activity },
    ],
  },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, logout, hasRole } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 text-white"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-white transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700">
            <Server className="w-8 h-8 text-blue-400" />
            <span className="text-xl font-bold">OpenVPS</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            {navigation.map((section) => {
              const filteredItems = section.items.filter(
                (item) => !item.permission || hasRole(item.permission)
              );
              if (filteredItems.length === 0) return null;

              return (
                <div key={section.title} className="mb-4">
                  <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {section.title}
                  </p>
                  {filteredItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                        isActive(item.href)
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-slate-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
