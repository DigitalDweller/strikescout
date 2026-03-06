/**
 * Key explaining the ranking colors used for team performance metrics.
 * Blue = sweep, Green = best (Cooking), Yellow = mid, Orange = bad, Red = worst.
 * variant "scouters" uses "Burnt" for red; default uses "Shit" for teams.
 */
export function RankingColorKey({ className = "", variant = "teams" }: { className?: string; variant?: "teams" | "scouters" }) {
  const redLabel = variant === "scouters" ? "Burnt" : "Shit";
  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-muted-foreground ${className}`} role="img" aria-label="Ranking color key">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-blue-500 border border-blue-600" aria-hidden />
        <span>Sweep</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-green-500 border border-green-600" aria-hidden />
        <span>Cooking</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-yellow-500 border border-yellow-600" aria-hidden />
        <span>Mid</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-orange-500 border border-orange-600" aria-hidden />
        <span>Bad</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-red-500 border border-red-600" aria-hidden />
        <span>{redLabel}</span>
      </span>
    </div>
  );
}
