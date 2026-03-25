import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'danger' | 'accent';
  icon?: React.ReactNode;
}

export default function KpiCard({
  label,
  value,
  suffix,
  trend,
  trendValue,
  variant = 'default',
  icon,
}: KpiCardProps) {
  const glowClass = {
    default: 'glow-border',
    success: 'glow-success',
    danger: 'glow-danger',
    accent: 'glow-border',
  }[variant];

  const trendColor = {
    up: 'text-success',
    down: 'text-danger',
    neutral: 'text-slate-400',
  };

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  };

  return (
    <div
      className={clsx(
        'relative rounded-xl bg-surface border border-white/5 p-5 animate-fade-in',
        'transition-all duration-300 hover:border-accent/30',
        'glow-border-hover',
        glowClass
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-rate tracking-tight text-white">
              {value}
            </span>
            {suffix && (
              <span className="text-sm font-medium text-slate-400">{suffix}</span>
            )}
          </div>
          {trend && trendValue && (
            <div className={clsx('flex items-center gap-1 mt-2 text-xs font-medium', trendColor[trend])}>
              {(() => {
                const Icon = TrendIcon[trend];
                return <Icon className="w-3.5 h-3.5" />;
              })()}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-lg bg-accent/10 text-accent">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
