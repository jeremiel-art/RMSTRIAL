import { useState, createContext, useContext } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Grid3X3,
  TrendingUp,
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  Settings,
  RefreshCw,
  ChevronDown,
  Hotel,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { useProperties, useRefresh } from '../hooks/useApi';
import type { Property } from '../types';

interface PropertyContextValue {
  selectedProperty: Property | null;
  setSelectedPropertyId: (id: string) => void;
}

const PropertyContext = createContext<PropertyContextValue>({
  selectedProperty: null,
  setSelectedPropertyId: () => {},
});

export function useSelectedProperty() {
  return useContext(PropertyContext);
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/setup', label: 'Setup Wizard', icon: Sparkles },
  { to: '/rate-grid', label: 'Rate Grid', icon: Grid3X3 },
  { to: '/rate-history', label: 'Rate History', icon: TrendingUp },
  { to: '/parity-alerts', label: 'Parity Alerts', icon: AlertTriangle },
  { to: '/rate-changes', label: 'Rate Changes', icon: ArrowLeftRight },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { data: properties } = useProperties();
  const [selectedId, setSelectedId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const refreshMutation = useRefresh();

  const selectedProperty =
    properties?.find((p) => p.id === selectedId) ?? properties?.[0] ?? null;

  if (selectedProperty && selectedId !== selectedProperty.id) {
    setSelectedId(selectedProperty.id);
  }

  const handleRefresh = () => {
    if (selectedProperty) {
      refreshMutation.mutate(selectedProperty.id);
    }
  };

  return (
    <PropertyContext.Provider
      value={{
        selectedProperty,
        setSelectedPropertyId: setSelectedId,
      }}
    >
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-white/5 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
              <Hotel className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Rate Shopper</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Monitor</p>
            </div>
            <button
              className="ml-auto lg:hidden text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-accent/10 text-accent shadow-[0_0_15px_rgba(56,189,248,0.1)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={clsx(
                        'w-4.5 h-4.5 flex-shrink-0 transition-colors',
                        isActive ? 'text-accent' : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    {item.label}
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/5">
            <p className="text-[10px] text-slate-600 text-center">
              Rate Shopper v1.0
            </p>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="flex items-center gap-4 px-4 lg:px-6 py-3 bg-surface/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
            <button
              className="lg:hidden text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Property selector */}
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-accent/30 transition-colors text-sm"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <Hotel className="w-4 h-4 text-accent" />
                <span className="text-white font-medium truncate max-w-[200px]">
                  {selectedProperty?.name ?? 'Select Property'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {dropdownOpen && properties && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-white/10 rounded-lg shadow-xl z-50 py-1 animate-fade-in">
                  {properties.map((p) => (
                    <button
                      key={p.id}
                      className={clsx(
                        'w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors',
                        p.id === selectedProperty?.id
                          ? 'text-accent'
                          : 'text-slate-300'
                      )}
                      onClick={() => {
                        setSelectedId(p.id);
                        setDropdownOpen(false);
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              className={clsx(
                'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300',
                'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 hover:border-accent/40',
                'hover:shadow-[0_0_15px_rgba(56,189,248,0.15)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw
                className={clsx(
                  'w-3.5 h-3.5',
                  refreshMutation.isPending && 'animate-spin'
                )}
              />
              {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Rates'}
            </button>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </PropertyContext.Provider>
  );
}
