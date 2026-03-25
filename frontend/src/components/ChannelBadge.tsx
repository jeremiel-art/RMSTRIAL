import { clsx } from 'clsx';

const CHANNEL_COLORS: Record<string, string> = {
  'Direct': '#10b981',
  'Booking.com': '#003580',
  'Agoda': '#5542F6',
  'Expedia': '#FBAF17',
  'Hotels.com': '#d32f2f',
  'Trip.com': '#287DFA',
};

function getChannelColor(source: string): string {
  if (CHANNEL_COLORS[source]) return CHANNEL_COLORS[source];
  for (const key of Object.keys(CHANNEL_COLORS)) {
    if (source.toLowerCase().includes(key.toLowerCase().replace('.com', ''))) {
      return CHANNEL_COLORS[key];
    }
  }
  return '#64748b';
}

interface ChannelBadgeProps {
  source: string;
  className?: string;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

export default function ChannelBadge({
  source,
  className,
  showDot = true,
  size = 'sm',
}: ChannelBadgeProps) {
  const color = getChannelColor(source);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        'bg-white/5 border border-white/10',
        className
      )}
    >
      {showDot && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="text-slate-300 truncate">{source}</span>
    </span>
  );
}

export function ChannelColorBar({
  source,
  rate,
  ourRate,
  className,
}: {
  source: string;
  rate: number;
  ourRate: number | null;
  className?: string;
}) {
  const color = getChannelColor(source);
  const diff = ourRate ? ((rate - ourRate) / ourRate) * 100 : 0;
  const isUndercut = ourRate ? rate < ourRate : false;

  return (
    <div className={clsx('flex items-center gap-2 text-[11px]', className)}>
      <div
        className="w-1 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-slate-400 truncate flex-1 min-w-0">{source}</span>
      <span
        className={clsx(
          'font-rate font-semibold flex-shrink-0',
          isUndercut ? 'text-danger' : 'text-success'
        )}
      >
        ${rate.toFixed(0)}
      </span>
      {ourRate && (
        <span
          className={clsx(
            'font-rate text-[10px] flex-shrink-0',
            isUndercut ? 'text-danger/70' : 'text-success/70'
          )}
        >
          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export function ChannelLegend() {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.entries(CHANNEL_COLORS).map(([name, color]) => (
        <div key={name} className="flex items-center gap-1.5 text-xs text-slate-400">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {name}
        </div>
      ))}
    </div>
  );
}

export { getChannelColor, CHANNEL_COLORS };
