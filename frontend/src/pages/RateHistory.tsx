import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { clsx } from 'clsx';
import { useSelectedProperty } from '../components/Layout';
import { useRateHistoryAll } from '../hooks/useApi';
import { PageSkeleton } from '../components/LoadingSkeleton';

const COMPETITOR_COLORS = [
  '#f43f5e', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899',
  '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
    payload: Record<string, number | string>;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-surface border border-white/10 rounded-lg p-3 shadow-xl animate-fade-in">
      <p className="text-xs text-slate-400 mb-2 font-rate">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs py-0.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-400 flex-1">{entry.name}</span>
          <span className="font-rate font-semibold text-white">
            ${entry.value?.toFixed(0) ?? '--'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RateHistory() {
  const { selectedProperty } = useSelectedProperty();
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);

  const { data, isLoading } = useRateHistoryAll(selectedProperty?.id, fromDate, toDate);

  const chartData = useMemo(() => {
    if (!data) return [];

    const dateMap = new Map<string, Record<string, number>>();

    // Add our rates
    data.ourRates?.forEach((r) => {
      const key = format(new Date(r.date), 'MMM d');
      if (!dateMap.has(key)) dateMap.set(key, {});
      dateMap.get(key)!['Our Rate'] = r.rate;
    });

    // Add competitor rates
    data.competitors?.forEach((comp) => {
      comp.rates.forEach((r) => {
        const key = format(new Date(r.date), 'MMM d');
        if (!dateMap.has(key)) dateMap.set(key, {});
        dateMap.get(key)![comp.competitorName] = r.rate;
      });
    });

    return Array.from(dateMap.entries())
      .map(([date, rates]) => ({ date, ...rates }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const competitorNames = useMemo(() => {
    return data?.competitors?.map((c) => c.competitorName) ?? [];
  }, [data]);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Rate History</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Rate trends over time across all competitors
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="rounded-xl bg-surface border border-white/5 p-6">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={450}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value: string) => (
                  <span className="text-xs text-slate-400">{value}</span>
                )}
              />

              {/* Our rate as bold dashed line */}
              <Line
                type="monotone"
                dataKey="Our Rate"
                stroke="#38bdf8"
                strokeWidth={3}
                strokeDasharray="8 4"
                dot={false}
                activeDot={{ r: 5, fill: '#38bdf8', stroke: '#0a0e17', strokeWidth: 2 }}
                animationDuration={800}
              />

              {/* Competitor lines */}
              {competitorNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COMPETITOR_COLORS[i % COMPETITOR_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
                    stroke: '#0a0e17',
                    strokeWidth: 2,
                  }}
                  animationDuration={800}
                  animationBegin={i * 100}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <p>No rate history data available for the selected period.</p>
          </div>
        )}
      </div>

      {/* Rate summary cards */}
      {data && competitorNames.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {competitorNames.map((name, i) => {
            const comp = data.competitors?.find((c) => c.competitorName === name);
            const rates = comp?.rates.map((r) => r.rate) ?? [];
            const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
            const min = rates.length > 0 ? Math.min(...rates) : 0;
            const max = rates.length > 0 ? Math.max(...rates) : 0;

            return (
              <div
                key={name}
                className="rounded-lg bg-surface border border-white/5 p-3 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COMPETITOR_COLORS[i % COMPETITOR_COLORS.length] }}
                  />
                  <span className="text-xs text-slate-400 truncate">{name}</span>
                </div>
                <div className="space-y-1 text-[11px] font-rate">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg</span>
                    <span className="text-white">${avg.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Min</span>
                    <span className="text-success">${min.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max</span>
                    <span className="text-danger">${max.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
