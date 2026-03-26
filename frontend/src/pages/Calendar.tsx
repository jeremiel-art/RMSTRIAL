import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from 'date-fns';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, X, ShieldCheck, Calendar as CalendarIcon, DollarSign, TrendingDown } from 'lucide-react';
import { useSelectedProperty } from '../components/Layout';
import { useCalendar, useCheapestSummary } from '../hooks/useApi';
import { ChannelLegend, getChannelColor } from '../components/ChannelBadge';
import KpiCard from '../components/KpiCard';
import { PageSkeleton } from '../components/LoadingSkeleton';
import type { CalendarDay } from '../types';

const PARITY_DOT_COLORS = {
  ok: 'bg-success',
  warning: 'bg-yellow-400',
  violation: 'bg-danger',
  'no-data': 'bg-slate-600',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const { selectedProperty } = useSelectedProperty();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const monthStr = format(currentMonth, 'yyyy-MM');
  const { data: calendarDays, isLoading } = useCalendar(selectedProperty?.id, monthStr);
  const { data: summaryData } = useCheapestSummary(selectedProperty?.id, monthStr);

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    calendarDays?.forEach((d) => map.set(d.date, d));
    return map;
  }, [calendarDays]);

  const calendarGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Derive summary KPIs from cheapest summary array
  const topCheapest = summaryData?.[0];
  const totalCheapestDays = summaryData?.reduce((sum, s) => sum + Number(s.cheapest_count), 0) ?? 0;
  const avgRate = summaryData?.length
    ? summaryData.reduce((sum, s) => sum + Number(s.avg_rate), 0) / summaryData.length
    : 0;

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar View</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Monthly rate overview with cheapest channel analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-accent/30 hover:bg-accent/5 transition-all text-slate-400 hover:text-accent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-accent/30 hover:bg-accent/5 transition-all text-slate-400 hover:text-accent"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      {summaryData && summaryData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Days Tracked"
            value={totalCheapestDays}
            variant="default"
            icon={<ShieldCheck className="w-5 h-5" />}
          />
          <KpiCard
            label="Most Frequent Cheapest"
            value={topCheapest?.competitor_name ?? 'N/A'}
            variant="default"
            icon={<CalendarIcon className="w-5 h-5" />}
          />
          <KpiCard
            label="Cheapest Min Rate"
            value={topCheapest ? `$${Number(topCheapest.min_rate).toFixed(0)}` : 'N/A'}
            variant="accent"
            icon={<TrendingDown className="w-5 h-5" />}
          />
          <KpiCard
            label="Average Rate"
            value={avgRate > 0 ? `$${avgRate.toFixed(0)}` : 'N/A'}
            variant="accent"
            icon={<DollarSign className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <ChannelLegend />
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" /> Parity OK
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400" /> Warning
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger" /> Violation
          </span>
        </div>
      </div>

      {/* Calendar + Detail panel side by side */}
      <div className="flex gap-4">
        {/* Calendar grid */}
        <div className={clsx('flex-1 min-w-0', selectedDay && 'hidden lg:block')}>
          <div className="rounded-xl bg-surface border border-white/5 overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-white/5">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarGrid.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const dayData = dayMap.get(dateStr);
                const inMonth = isSameMonth(date, currentMonth);
                const todayDate = isToday(date);
                const isSelected = selectedDay?.date === dateStr;
                const topChannels = dayData?.channels?.slice(0, 3) ?? [];

                return (
                  <button
                    key={dateStr}
                    onClick={() => dayData && setSelectedDay(dayData)}
                    disabled={!inMonth}
                    className={clsx(
                      'relative min-h-[100px] p-2 border-b border-r border-white/5 text-left transition-all duration-200',
                      inMonth ? 'hover:bg-white/[0.03] cursor-pointer' : 'opacity-30 cursor-default',
                      todayDate && 'ring-1 ring-accent/50 ring-inset bg-accent/[0.03]',
                      isSelected && 'bg-accent/5 ring-1 ring-accent/40 ring-inset'
                    )}
                  >
                    {/* Day number + parity dot */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={clsx(
                          'text-xs font-rate',
                          todayDate ? 'text-accent font-bold' : inMonth ? 'text-slate-400' : 'text-slate-700'
                        )}
                      >
                        {format(date, 'd')}
                      </span>
                      {dayData && (
                        <span
                          className={clsx(
                            'w-1.5 h-1.5 rounded-full',
                            PARITY_DOT_COLORS[dayData.parityStatus]
                          )}
                        />
                      )}
                    </div>

                    {/* Our rate */}
                    {dayData?.ourRate != null && (
                      <div className="font-rate text-[11px] font-bold text-white mb-1">
                        ${dayData.ourRate.toFixed(0)}
                      </div>
                    )}

                    {/* Top 3 channels */}
                    <div className="space-y-0.5">
                      {topChannels.map((ch) => (
                        <div key={ch.competitorId} className="flex items-center gap-1 text-[9px]">
                          <div
                            className="w-1 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getChannelColor(ch.source) }}
                          />
                          <span className="text-slate-500 truncate flex-1">{ch.source}</span>
                          <span
                            className={clsx(
                              'font-rate font-semibold flex-shrink-0',
                              ch.rate < (dayData?.ourRate ?? 0) ? 'text-danger' : 'text-success'
                            )}
                          >
                            ${ch.rate.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedDay && (
          <div className="w-full lg:w-96 flex-shrink-0 animate-slide-up">
            <div className="rounded-xl bg-surface border border-white/5 sticky top-24">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {format(new Date(selectedDay.date), 'EEEE, MMM d')}
                    </span>
                    <span
                      className={clsx(
                        'w-2 h-2 rounded-full',
                        PARITY_DOT_COLORS[selectedDay.parityStatus]
                      )}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">
                    {selectedDay.parityStatus === 'ok'
                      ? 'Parity Maintained'
                      : selectedDay.parityStatus === 'warning'
                      ? 'Minor Parity Issue'
                      : selectedDay.parityStatus === 'violation'
                      ? 'Parity Violation'
                      : 'No Data'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Our rate */}
              <div className="px-4 py-3 border-b border-white/5 bg-accent/5">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                  Our Rate
                </div>
                <div className="font-rate text-2xl font-bold text-accent">
                  {selectedDay.ourRate != null ? `$${selectedDay.ourRate.toFixed(0)}` : 'N/A'}
                </div>
              </div>

              {/* All channels sorted cheapest to expensive */}
              <div className="px-4 py-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">
                  All Channels (cheapest first)
                </div>
                <div className="space-y-2">
                  {[...selectedDay.channels]
                    .sort((a, b) => a.rate - b.rate)
                    .map((ch, i) => {
                      const isUndercut = selectedDay.ourRate ? ch.rate < selectedDay.ourRate : false;
                      const diff = selectedDay.ourRate
                        ? ((ch.rate - selectedDay.ourRate) / selectedDay.ourRate) * 100
                        : 0;
                      const color = getChannelColor(ch.source);

                      return (
                        <div
                          key={ch.competitorId}
                          className={clsx(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                            i === 0
                              ? 'bg-white/[0.03] border-white/10'
                              : 'border-transparent hover:border-white/5'
                          )}
                        >
                          {/* Rank */}
                          <span className="text-[10px] font-rate text-slate-600 w-4">
                            #{i + 1}
                          </span>

                          {/* Color bar */}
                          <div
                            className="w-1 h-8 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />

                          {/* Channel info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-300 truncate">
                              {ch.competitorName}
                            </div>
                            <div className="text-[10px] text-slate-500">{ch.source}</div>
                          </div>

                          {/* Rate */}
                          <div className="text-right flex-shrink-0">
                            <div
                              className={clsx(
                                'font-rate text-sm font-bold',
                                isUndercut ? 'text-danger' : 'text-success'
                              )}
                            >
                              ${ch.rate.toFixed(0)}
                            </div>
                            {selectedDay.ourRate && (
                              <div
                                className={clsx(
                                  'font-rate text-[10px]',
                                  isUndercut ? 'text-danger/70' : 'text-success/70'
                                )}
                              >
                                {diff > 0 ? '+' : ''}
                                {diff.toFixed(1)}%
                              </div>
                            )}
                          </div>

                          {/* Badges */}
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            {i === 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-medium">
                                Cheapest
                              </span>
                            )}
                            {isUndercut && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/10 text-danger font-medium">
                                Undercut
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {selectedDay.channels.length === 0 && (
                    <p className="text-sm text-slate-600 text-center py-4">
                      No channel data for this date
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
