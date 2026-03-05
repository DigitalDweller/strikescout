/**
 * Key explaining the ranking colors used for team performance metrics.
 * Yellow = top, Green = good, Red = lower. Shown wherever heat colors are used.
 */
export function RankingColorKey({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-muted-foreground ${className}`} role="img" aria-label="Ranking color key">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-yellow-500/20 border border-yellow-500/40 dark:bg-yellow-500/30 dark:border-yellow-400/50" aria-hidden />
        <span>Top</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40 dark:bg-green-500/30 dark:border-green-400/50" aria-hidden />
        <span>Good</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40 dark:bg-red-500/30 dark:border-red-400/50" aria-hidden />
        <span>Lower</span>
      </span>
    </div>
  );
}
