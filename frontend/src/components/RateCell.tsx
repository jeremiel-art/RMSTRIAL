import { clsx } from 'clsx';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface RateCellProps {
  rate: number | null;
  ourRate: number | null;
  previousRate?: number | null;
  change?: number | null;
  changePercent?: number | null;
  currency?: string;
}

export default function RateCell({
  rate,
  ourRate,
  previousRate,
  change,
  changePercent,
  currency = '$',
}: RateCellProps) {
  if (rate === null || rate === undefined) {
    return (
      <div className="flex items-center justify-center h-full px-2 py-1.5">
        <span className="text-xs text-slate-600 font-mono">--</span>
      </div>
    );
  }

  let cellColor = 'bg-slate-800/50 border-slate-700/30';
  let textColor = 'text-slate-300';

  if (ourRate !== null && ourRate !== undefined) {
    const diff = rate - ourRate;
    const diffPercent = (diff / ourRate) * 100;

    if (diffPercent < -3) {
      // Competitor is significantly cheaper - we're losing parity
      cellColor = 'bg-danger/10 border-danger/20';
      textColor = 'text-danger';
    } else if (diffPercent < -1) {
      // Competitor is slightly cheaper - warning
      cellColor = 'bg-yellow-500/10 border-yellow-500/20';
      textColor = 'text-yellow-400';
    } else if (diffPercent > 1) {
      // Competitor is more expensive - good for us
      cellColor = 'bg-success/10 border-success/20';
      textColor = 'text-success';
    }
  }

  const hasChange = change !== null && change !== undefined && change !== 0;
  const isIncrease = hasChange && change! > 0;

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center h-full px-2 py-1.5 rounded border transition-colors duration-200',
        cellColor
      )}
    >
      <span className={clsx('text-sm font-rate font-semibold', textColor)}>
        {currency}{rate.toFixed(0)}
      </span>
      {hasChange && (
        <div
          className={clsx(
            'flex items-center gap-0.5 text-[10px] font-rate mt-0.5',
            isIncrease ? 'text-danger' : 'text-success'
          )}
        >
          {isIncrease ? (
            <ArrowUp className="w-2.5 h-2.5" />
          ) : (
            <ArrowDown className="w-2.5 h-2.5" />
          )}
          <span>
            {changePercent !== null && changePercent !== undefined
              ? `${Math.abs(changePercent).toFixed(1)}%`
              : `${currency}${Math.abs(change!).toFixed(0)}`}
          </span>
        </div>
      )}
    </div>
  );
}
