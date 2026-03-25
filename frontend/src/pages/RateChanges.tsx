import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { clsx } from 'clsx';
import { ArrowRight, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { useSelectedProperty } from '../components/Layout';
import { useRateChanges, useCompetitors } from '../hooks/useApi';
import ChannelBadge from '../components/ChannelBadge';
import { PageSkeleton } from '../components/LoadingSkeleton';

export default function RateChanges() {
  const { selectedProperty } = useSelectedProperty();
  const today = format(new Date(), 'yyyy-MM-dd');
  const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  const [fromDate, setFromDate] = useState(sevenDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all');

  const { data: changes, isLoading } = useRateChanges(selectedProperty?.id, fromDate, toDate);
  const { data: competitors } = useCompetitors(selectedProperty?.id);

  const filtered = useMemo(() => {
    if (!changes) return [];
    if (selectedCompetitor === 'all') return changes;
    return changes.filter((c) => c.competitorId === selectedCompetitor);
  }, [changes, selectedCompetitor]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Rate Changes</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Track competitor rate movements in real-time
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Competitor filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCompetitor}
              onChange={(e) => setSelectedCompetitor(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Competitors</option>
              {competitors?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-rate focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-rate focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Changes feed */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl bg-surface border border-white/5 py-16 text-center text-slate-500">
            No rate changes found for the selected period.
          </div>
        ) : (
          filtered.map((change) => {
            const isIncrease = change.newRate > change.oldRate;
            const absDiff = Math.abs(change.newRate - change.oldRate);
            const absPercent = Math.abs(change.changePercent);

            return (
              <div
                key={change.id}
                className={clsx(
                  'flex items-center gap-4 px-5 py-4 rounded-xl bg-surface border transition-all duration-200 hover:border-white/10 animate-slide-up',
                  isIncrease
                    ? 'border-danger/10 hover:border-danger/20'
                    : 'border-success/10 hover:border-success/20'
                )}
              >
                {/* Direction icon */}
                <div
                  className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    isIncrease ? 'bg-danger/10' : 'bg-success/10'
                  )}
                >
                  {isIncrease ? (
                    <TrendingUp className="w-5 h-5 text-danger" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-success" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {change.competitorName}
                    </span>
                    <ChannelBadge source={change.source} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>
                      Check-in:{' '}
                      <span className="font-rate text-slate-400">
                        {format(new Date(change.checkIn), 'MMM d, yyyy')}
                      </span>
                    </span>
                    {change.roomType && (
                      <span className="text-slate-600">|</span>
                    )}
                    {change.roomType && (
                      <span>{change.roomType}</span>
                    )}
                  </div>
                </div>

                {/* Rate change */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-rate text-sm text-slate-400">
                    ${change.oldRate.toFixed(0)}
                  </span>
                  <ArrowRight
                    className={clsx(
                      'w-4 h-4',
                      isIncrease ? 'text-danger' : 'text-success'
                    )}
                  />
                  <span
                    className={clsx(
                      'font-rate text-sm font-bold',
                      isIncrease ? 'text-danger' : 'text-success'
                    )}
                  >
                    ${change.newRate.toFixed(0)}
                  </span>
                </div>

                {/* Percentage badge */}
                <div
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-rate font-bold flex-shrink-0',
                    isIncrease
                      ? 'bg-danger/10 text-danger border border-danger/20'
                      : 'bg-success/10 text-success border border-success/20'
                  )}
                >
                  {isIncrease ? '+' : '-'}${absDiff.toFixed(0)}{' '}
                  <span className="opacity-60">({absPercent.toFixed(1)}%)</span>
                </div>

                {/* Timestamp */}
                <div className="text-[10px] font-rate text-slate-600 flex-shrink-0 text-right w-16">
                  {format(new Date(change.detectedAt), 'HH:mm')}
                  <br />
                  {format(new Date(change.detectedAt), 'MMM d')}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
