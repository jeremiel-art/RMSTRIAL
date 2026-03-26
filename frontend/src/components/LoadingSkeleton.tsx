import { clsx } from 'clsx';

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  variant?: 'text' | 'card' | 'table-row' | 'circle';
}

function SkeletonItem({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-lg bg-surface border border-white/5 animate-shimmer',
        className
      )}
    />
  );
}

export default function LoadingSkeleton({
  className,
  count = 1,
  variant = 'text',
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return (
      <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
        {items.map((i) => (
          <div key={i} className="rounded-xl bg-surface border border-white/5 p-5 space-y-3">
            <SkeletonItem className="h-3 w-20" />
            <SkeletonItem className="h-8 w-28" />
            <SkeletonItem className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className={clsx('space-y-2', className)}>
        {items.map((i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-surface/50">
            <SkeletonItem className="h-4 w-32" />
            <SkeletonItem className="h-4 w-24" />
            <SkeletonItem className="h-4 w-20" />
            <SkeletonItem className="h-4 w-16" />
            <SkeletonItem className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div className={clsx('flex gap-3', className)}>
        {items.map((i) => (
          <SkeletonItem key={i} className="h-10 w-10 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('space-y-2', className)}>
      {items.map((i) => (
        <SkeletonItem key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <LoadingSkeleton variant="card" count={4} />
      <div className="rounded-xl bg-surface border border-white/5 p-6">
        <LoadingSkeleton variant="table-row" count={8} />
      </div>
    </div>
  );
}
