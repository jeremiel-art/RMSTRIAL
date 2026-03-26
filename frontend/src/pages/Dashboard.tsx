import { format } from 'date-fns';
import { ShieldCheck, BarChart3, AlertTriangle, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { useSelectedProperty } from '../components/Layout';
import { useDashboardSummary, useRatesGrid } from '../hooks/useApi';
import KpiCard from '../components/KpiCard';
import RateCell from '../components/RateCell';
import { PageSkeleton } from '../components/LoadingSkeleton';
import type { RateGridRow } from '../types';

// Transform flat rate grid rows into grouped structure for display
function buildGridView(rows: RateGridRow[]) {
  const dates = [...new Set(rows.map((r) => r.check_in_date))].sort();
  const competitorMap = new Map<string, { name: string; rates: Map<string, RateGridRow> }>();

  for (const row of rows) {
    const key = row.competitor_id ?? row.competitor_name;
    if (!competitorMap.has(key)) {
      competitorMap.set(key, { name: row.competitor_name, rates: new Map() });
    }
    competitorMap.get(key)!.rates.set(row.check_in_date, row);
  }

  return {
    dates,
    competitors: Array.from(competitorMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      rates: data.rates,
    })),
  };
}

export default function Dashboard() {
  const { selectedProperty } = useSelectedProperty();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(selectedProperty?.id);
  const { data: rawGrid, isLoading: gridLoading } = useRatesGrid(selectedProperty?.id);

  if (summaryLoading || gridLoading) return <PageSkeleton />;

  const grid = rawGrid ? buildGridView(rawGrid) : null;

  // Compute parity score from summary
  const parityScore = summary
    ? summary.new_parity_alerts === 0
      ? 100
      : Math.max(0, 100 - summary.new_parity_alerts * 10)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Rate monitoring overview for {selectedProperty?.name ?? 'your property'}
          </p>
        </div>
        {summary?.last_refresh && (
          <div className="text-right text-xs text-slate-500 space-y-0.5">
            <p>
              Last refresh:{' '}
              <span className="text-slate-400 font-rate">
                {format(new Date(summary.last_refresh.started_at), 'MMM d, HH:mm')}
              </span>
            </p>
            <p>
              Status:{' '}
              <span
                className={clsx(
                  'font-rate',
                  summary.last_refresh.status === 'completed' ? 'text-success' : 'text-slate-400'
                )}
              >
                {summary.last_refresh.status}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Parity Score"
            value={parityScore}
            suffix="%"
            variant={parityScore >= 90 ? 'success' : parityScore >= 70 ? 'default' : 'danger'}
            trend={parityScore >= 90 ? 'up' : parityScore >= 70 ? 'neutral' : 'down'}
            trendValue={parityScore >= 90 ? 'Healthy' : parityScore >= 70 ? 'Moderate' : 'At Risk'}
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <KpiCard
            label="Snapshots Today"
            value={summary.total_snapshots_today}
            variant="accent"
            trend="neutral"
            trendValue="Rate checks"
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <KpiCard
            label="Active Alerts"
            value={summary.new_parity_alerts}
            variant={summary.new_parity_alerts === 0 ? 'success' : 'danger'}
            trend={summary.new_parity_alerts === 0 ? 'up' : 'down'}
            trendValue={summary.new_parity_alerts === 0 ? 'All clear' : 'Needs attention'}
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <KpiCard
            label="Competitors"
            value={`${summary.active_competitors}/${summary.total_competitors}`}
            variant="default"
            trend="neutral"
            trendValue="Active sources"
            icon={<Users className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Rate Grid */}
      {grid && grid.dates.length > 0 && (
        <div className="rounded-xl bg-surface border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Rate Grid</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Competitor rates by check-in date. Color-coded by parity status.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="sticky left-0 bg-surface z-10 px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[160px]">
                    Source
                  </th>
                  {grid.dates.map((date) => (
                    <th
                      key={date}
                      className="px-2 py-3 text-center text-xs font-medium text-slate-400 min-w-[80px]"
                    >
                      <div className="font-rate">{format(new Date(date + 'T00:00:00'), 'MMM d')}</div>
                      <div className="text-[10px] text-slate-600">
                        {format(new Date(date + 'T00:00:00'), 'EEE')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Competitor rows */}
                {grid.competitors.map((comp) => (
                  <tr
                    key={comp.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="sticky left-0 bg-surface z-10 px-4 py-2">
                      <div className="text-xs font-medium text-slate-300 truncate">
                        {comp.name}
                      </div>
                      <div className="text-[10px] text-slate-500">Google Hotels</div>
                    </td>
                    {grid.dates.map((date) => {
                      const rateData = comp.rates.get(date);
                      return (
                        <td key={date} className="px-1 py-1">
                          <RateCell
                            rate={rateData?.rate_amount ?? null}
                            ourRate={null}
                            previousRate={null}
                            change={null}
                            changePercent={null}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!summary && !grid && (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg">No data available</p>
          <p className="text-sm mt-1">Select a property and refresh rates to get started.</p>
        </div>
      )}
    </div>
  );
}
