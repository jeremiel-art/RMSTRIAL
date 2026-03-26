import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { Check, ArrowUpDown, AlertTriangle, CheckCircle2, ListFilter } from 'lucide-react';
import { useSelectedProperty } from '../components/Layout';
import { useParityAlerts, useAcknowledgeAlert } from '../hooks/useApi';
import ChannelBadge from '../components/ChannelBadge';
import { PageSkeleton } from '../components/LoadingSkeleton';
import type { ParityAlert } from '../types';

type SortField = 'competitor_name' | 'check_in_date' | 'our_rate' | 'competitor_rate' | 'difference_pct' | 'detected_at';
type SortDir = 'asc' | 'desc';
type FilterTab = 'all' | 'new' | 'acknowledged';

export default function ParityAlerts() {
  const { selectedProperty } = useSelectedProperty();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('detected_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const statusParam = filterTab === 'all' ? undefined : filterTab;
  const { data: alerts, isLoading } = useParityAlerts(selectedProperty?.id, statusParam);
  const acknowledgeMutation = useAcknowledgeAlert();

  const sorted = useMemo(() => {
    if (!alerts) return [];
    return [...alerts].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortField] as string | number;
      const bVal = (b as unknown as Record<string, unknown>)[sortField] as string | number;
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal as string);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [alerts, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: <ListFilter className="w-3.5 h-3.5" /> },
    { key: 'new', label: 'New', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { key: 'acknowledged', label: 'Acknowledged', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Parity Alerts</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Rate parity violations detected across competitor channels
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200',
              filterTab === tab.key
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20 hover:text-slate-300'
            )}
          >
            {tab.icon}
            {tab.label}
            {alerts && (
              <span className="ml-1 text-[10px] opacity-60">
                ({tab.key === 'all'
                  ? alerts.length
                  : alerts.filter((a) => (tab.key === 'new' ? a.alert_status === 'new' : a.alert_status === 'acknowledged')).length
                })
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-surface border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {[
                  { field: 'competitor_name' as SortField, label: 'Competitor' },
                  { field: 'check_in_date' as SortField, label: 'Check-in Date' },
                  { field: 'our_rate' as SortField, label: 'Our Rate' },
                  { field: 'competitor_rate' as SortField, label: 'Their Rate' },
                  { field: 'difference_pct' as SortField, label: 'Difference' },
                  { field: 'detected_at' as SortField, label: 'Detected' },
                ].map(({ field, label }) => (
                  <th
                    key={field}
                    className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none"
                    onClick={() => handleSort(field)}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <ArrowUpDown
                        className={clsx(
                          'w-3 h-3',
                          sortField === field ? 'text-accent' : 'text-slate-600'
                        )}
                      />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                    No parity alerts found
                  </td>
                </tr>
              ) : (
                sorted.map((alert) => (
                  <tr
                    key={alert.id}
                    className={clsx(
                      'border-b border-white/5 transition-colors hover:bg-white/[0.02]',
                      alert.alert_status === 'new' && 'bg-danger/[0.03]'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-200">{alert.competitor_name ?? 'Unknown'}</div>
                      <ChannelBadge source="Google Hotels" className="mt-1" />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-rate text-xs text-slate-300">
                        {format(new Date(alert.check_in_date + 'T00:00:00'), 'MMM d, yyyy')}
                      </span>
                      {alert.room_type && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{alert.room_type}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-rate font-semibold text-accent">
                        ${Number(alert.our_rate).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-rate font-semibold text-slate-200">
                        ${Number(alert.competitor_rate).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-rate font-semibold',
                          Number(alert.difference_pct) < -5
                            ? 'bg-danger/20 text-danger'
                            : Number(alert.difference_pct) < -2
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : Number(alert.difference_pct) < 0
                            ? 'bg-yellow-500/10 text-yellow-500'
                            : 'bg-success/20 text-success'
                        )}
                      >
                        {Number(alert.difference_pct) > 0 ? '+' : ''}
                        {Number(alert.difference_pct).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-rate text-[11px] text-slate-500">
                        {format(new Date(alert.detected_at), 'MMM d, HH:mm')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                          alert.alert_status === 'new'
                            ? 'bg-danger/10 text-danger border border-danger/20'
                            : 'bg-success/10 text-success border border-success/20'
                        )}
                      >
                        {alert.alert_status === 'new' ? (
                          <>
                            <AlertTriangle className="w-2.5 h-2.5" />
                            New
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Ack
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {alert.alert_status === 'new' && (
                        <button
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-white/5 text-slate-300 border border-white/10 hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-all duration-200 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          Ack
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
