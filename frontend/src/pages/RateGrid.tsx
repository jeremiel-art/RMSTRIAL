import { useMemo } from 'react';
import { format } from 'date-fns';
import { useSelectedProperty } from '../components/Layout';
import { useRatesGrid } from '../hooks/useApi';
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

export default function RateGrid() {
  const { selectedProperty } = useSelectedProperty();
  const { data: rawGrid, isLoading } = useRatesGrid(selectedProperty?.id);

  const grid = useMemo(() => {
    if (!rawGrid || rawGrid.length === 0) return null;
    return buildGridView(rawGrid);
  }, [rawGrid]);

  if (isLoading) return <PageSkeleton />;

  if (!grid) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p className="text-lg">No rate data available</p>
        <p className="text-sm mt-1">Refresh rates to populate the grid.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Rate Grid</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Full competitor rate comparison matrix
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-success/20 border border-success/30" />
          Competitor more expensive
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/30" />
          Within threshold
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-danger/20 border border-danger/30" />
          Losing parity
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-800/50 border border-slate-700/30" />
          No data
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="sticky left-0 bg-surface z-10 px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-[180px]">
                  Source
                </th>
                {grid.dates.map((date) => (
                  <th
                    key={date}
                    className="px-2 py-3 text-center text-xs font-medium text-slate-400 min-w-[85px]"
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
              {grid.competitors.map((comp) => (
                <tr
                  key={comp.id}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="sticky left-0 bg-surface z-10 px-4 py-2.5">
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
    </div>
  );
}
