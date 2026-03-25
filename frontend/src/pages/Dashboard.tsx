import { format } from 'date-fns';
import { ShieldCheck, BarChart3, AlertTriangle, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { useSelectedProperty } from '../components/Layout';
import { useDashboardSummary, useRatesGrid } from '../hooks/useApi';
import KpiCard from '../components/KpiCard';
import RateCell from '../components/RateCell';
import { PageSkeleton } from '../components/LoadingSkeleton';

export default function Dashboard() {
  const { selectedProperty } = useSelectedProperty();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(selectedProperty?.id);
  const { data: grid, isLoading: gridLoading } = useRatesGrid(selectedProperty?.id);

  if (summaryLoading || gridLoading) return <PageSkeleton />;

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
        {summary && (
          <div className="text-right text-xs text-slate-500 space-y-0.5">
            {summary.lastRefresh && (
              <p>
                Last refresh:{' '}
                <span className="text-slate-400 font-rate">
                  {format(new Date(summary.lastRefresh), 'MMM d, HH:mm')}
                </span>
              </p>
            )}
            {summary.nextRefresh && (
              <p>
                Next refresh:{' '}
                <span className="text-slate-400 font-rate">
                  {format(new Date(summary.nextRefresh), 'MMM d, HH:mm')}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Parity Score"
            value={summary.parityScore}
            suffix="%"
            variant={summary.parityScore >= 90 ? 'success' : summary.parityScore >= 70 ? 'default' : 'danger'}
            trend={summary.parityScore >= 90 ? 'up' : summary.parityScore >= 70 ? 'neutral' : 'down'}
            trendValue={summary.parityScore >= 90 ? 'Healthy' : summary.parityScore >= 70 ? 'Moderate' : 'At Risk'}
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <KpiCard
            label="Rate Position"
            value={`${summary.ratePosition}/${summary.totalPositions}`}
            variant="accent"
            trend={summary.ratePosition <= 2 ? 'up' : summary.ratePosition <= 3 ? 'neutral' : 'down'}
            trendValue={
              summary.ratePosition === 1
                ? 'Cheapest'
                : summary.ratePosition <= 2
                ? 'Competitive'
                : 'Review pricing'
            }
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <KpiCard
            label="Active Alerts"
            value={summary.activeAlerts}
            variant={summary.activeAlerts === 0 ? 'success' : 'danger'}
            trend={summary.activeAlerts === 0 ? 'up' : 'down'}
            trendValue={summary.activeAlerts === 0 ? 'All clear' : 'Needs attention'}
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <KpiCard
            label="Competitors"
            value={summary.competitorCount}
            variant="default"
            trend="neutral"
            trendValue="Active sources"
            icon={<Users className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Rate Grid */}
      {grid && (
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
                      <div className="font-rate">{format(new Date(date), 'MMM d')}</div>
                      <div className="text-[10px] text-slate-600">
                        {format(new Date(date), 'EEE')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Our rates row */}
                <tr className="border-b border-accent/20 bg-accent/5">
                  <td className="sticky left-0 bg-surface z-10 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
                      <span className="font-semibold text-accent text-xs">Our Rate</span>
                    </div>
                  </td>
                  {grid.dates.map((date) => {
                    const rate = grid.ourRates[date];
                    return (
                      <td key={date} className="px-2 py-2 text-center">
                        <span className="font-rate font-bold text-accent text-sm">
                          {rate != null ? `$${rate.toFixed(0)}` : '--'}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* Competitor rows */}
                {grid.competitors.map((comp) => (
                  <tr
                    key={comp.competitorId}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="sticky left-0 bg-surface z-10 px-4 py-2">
                      <div className="text-xs font-medium text-slate-300 truncate">
                        {comp.competitorName}
                      </div>
                      <div className="text-[10px] text-slate-500">{comp.source}</div>
                    </td>
                    {grid.dates.map((date) => {
                      const rateData = comp.rates[date];
                      return (
                        <td key={date} className="px-1 py-1">
                          <RateCell
                            rate={rateData?.rate ?? null}
                            ourRate={grid.ourRates[date] ?? null}
                            previousRate={rateData?.previousRate}
                            change={rateData?.change}
                            changePercent={rateData?.changePercent}
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
