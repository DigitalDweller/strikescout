import type { EventTeam, ScoutingEntry, Team } from "@shared/schema";

export type TeamStats = {
  avgAuto: number;
  avgThroughput: number;
  avgAccuracy: number;
  avgDefense: number;
  climbRate: number;
  entries: number;
};

export type StatRanges = {
  auto: { min: number; max: number };
  throughput: { min: number; max: number };
  accuracy: { min: number; max: number };
  defense: { min: number; max: number };
  climb: { min: number; max: number };
};

export type TbaRanges = {
  opr: { min: number; max: number } | null;
  rp: { min: number; max: number } | null;
  seed: { min: number; max: number } | null;
};

export function getHeatColor(value: number, min: number, max: number) {
  if (max === min) return "";
  const norm = (value - min) / (max - min);

  if (norm >= 0.95) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300";
  if (norm >= 0.85) return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
  if (norm >= 0.7) return "bg-green-500/20 text-green-700 dark:text-green-300";
  if (norm >= 0.55) return "bg-green-500/10 text-green-600 dark:text-green-400";
  if (norm >= 0.4) return "";
  if (norm >= 0.2) return "bg-red-500/10 text-red-600 dark:text-red-400";
  return "bg-red-500/20 text-red-700 dark:text-red-300";
}

/** Like getHeatColor but best/higher value = green (for team compare view). */
export function getCompareHeatColor(value: number, min: number, max: number) {
  if (max === min) return "";
  const norm = (value - min) / (max - min);

  if (norm >= 0.85) return "bg-green-500/20 text-green-700 dark:text-green-300";
  if (norm >= 0.55) return "bg-green-500/10 text-green-600 dark:text-green-400";
  if (norm >= 0.4) return "";
  if (norm >= 0.2) return "bg-red-500/10 text-red-600 dark:text-red-400";
  return "bg-red-500/20 text-red-700 dark:text-red-300";
}

/** Returns a CSS color string (not Tailwind class) for use in inline styles like slider tracks. */
export function getHeatCssColor(value: number, min: number, max: number): string {
  if (max === min) return "";
  const norm = (value - min) / (max - min);

  if (norm >= 0.95) return "rgb(234 179 8)";       // yellow-500
  if (norm >= 0.85) return "rgb(250 204 21)";       // yellow-400
  if (norm >= 0.7)  return "rgb(34 197 94)";        // green-500
  if (norm >= 0.55) return "rgb(74 222 128)";       // green-400
  if (norm >= 0.4)  return "";
  if (norm >= 0.2)  return "rgb(248 113 113)";      // red-400
  return "rgb(239 68 68)";                           // red-500
}

export function getRowBorderColor(value: number, min: number, max: number) {
  if (max === min) return "border-l-transparent";
  const norm = (value - min) / (max - min);

  if (norm >= 0.95) return "border-l-yellow-500";
  if (norm >= 0.85) return "border-l-yellow-400";
  if (norm >= 0.7) return "border-l-green-500";
  if (norm >= 0.55) return "border-l-green-400";
  if (norm >= 0.4) return "border-l-transparent";
  if (norm >= 0.2) return "border-l-red-400";
  return "border-l-red-500";
}

export function getDominantColor(colors: string[]): string {
  const validColors = colors.filter(c => c !== "");
  if (validColors.length === 0) return "";

  const scores: Record<string, number> = {};
  for (const c of validColors) {
    if (c.includes("yellow-500/20")) scores["yellow"] = (scores["yellow"] || 0) + 3;
    else if (c.includes("yellow-500/10")) scores["yellow"] = (scores["yellow"] || 0) + 2;
    else if (c.includes("green-500/20")) scores["green"] = (scores["green"] || 0) + 2;
    else if (c.includes("green-500/10")) scores["green"] = (scores["green"] || 0) + 1;
    else if (c.includes("red-500/20")) scores["red"] = (scores["red"] || 0) + 2;
    else if (c.includes("red-500/10")) scores["red"] = (scores["red"] || 0) + 1;
  }

  let best = "";
  let bestScore = 0;
  for (const [color, score] of Object.entries(scores)) {
    if (score > bestScore) { best = color; bestScore = score; }
  }

  if (best === "yellow") return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300";
  if (best === "green") return "bg-green-500/10 text-green-700 dark:text-green-300";
  if (best === "red") return "bg-red-500/10 text-red-700 dark:text-red-300";
  return "";
}

export function getDominantBorderColor(colors: string[]): string {
  const validColors = colors.filter(c => c !== "");
  if (validColors.length === 0) return "border-l-transparent";

  const scores: Record<string, number> = {};
  for (const c of validColors) {
    if (c.includes("yellow-500/20")) scores["yellow"] = (scores["yellow"] || 0) + 3;
    else if (c.includes("yellow-500/10")) scores["yellow"] = (scores["yellow"] || 0) + 2;
    else if (c.includes("green-500/20")) scores["green"] = (scores["green"] || 0) + 2;
    else if (c.includes("green-500/10")) scores["green"] = (scores["green"] || 0) + 1;
    else if (c.includes("red-500/20")) scores["red"] = (scores["red"] || 0) + 2;
    else if (c.includes("red-500/10")) scores["red"] = (scores["red"] || 0) + 1;
  }

  let best = "";
  let bestScore = 0;
  for (const [color, score] of Object.entries(scores)) {
    if (score > bestScore) { best = color; bestScore = score; }
  }

  if (best === "yellow") return "border-l-yellow-400";
  if (best === "green") return "border-l-green-400";
  if (best === "red") return "border-l-red-400";
  return "border-l-transparent";
}

/** Normalize accuracy/defense: stored as 0-10 (scale) or 0-100 (legacy %); always returns 0-100. */
export function toPct(val: number): number {
  if (val == null || isNaN(val)) return 0;
  return val <= 10 ? val * 10 : Math.min(100, val);
}

export function computeTeamStats(teams: Team[], entries: ScoutingEntry[]): Map<number, TeamStats> {
  const map = new Map<number, TeamStats>();
  for (const team of teams) {
    const teamEntries = entries.filter(e => e.teamId === team.id);
    const count = teamEntries.length;
    if (count === 0) {
      map.set(team.id, { avgAuto: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, climbRate: 0, entries: 0 });
    } else {
      const accSum = teamEntries.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0);
      const defSum = teamEntries.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0);
      map.set(team.id, {
        avgAuto: teamEntries.reduce((s, e) => s + e.autoBallsShot, 0) / count,
        avgThroughput: teamEntries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count,
        avgAccuracy: accSum / count,
        avgDefense: defSum / count,
        climbRate: teamEntries.filter(e => e.climbSuccess === "success").length / count * 100,
        entries: count,
      });
    }
  }
  return map;
}

export function computeStatRanges(teamStats: Map<number, TeamStats>): StatRanges | null {
  const allStats = [...teamStats.values()].filter(s => s.entries > 0);
  if (allStats.length === 0) return null;
  return {
    auto: { min: Math.min(...allStats.map(s => s.avgAuto)), max: Math.max(...allStats.map(s => s.avgAuto)) },
    throughput: { min: Math.min(...allStats.map(s => s.avgThroughput)), max: Math.max(...allStats.map(s => s.avgThroughput)) },
    accuracy: { min: Math.min(...allStats.map(s => s.avgAccuracy)), max: Math.max(...allStats.map(s => s.avgAccuracy)) },
    defense: { min: Math.min(...allStats.map(s => s.avgDefense)), max: Math.max(...allStats.map(s => s.avgDefense)) },
    climb: { min: Math.min(...allStats.map(s => s.climbRate)), max: Math.max(...allStats.map(s => s.climbRate)) },
  };
}

export function computeTbaRanges(eventTeams: (EventTeam & { team: Team })[]): TbaRanges | null {
  const oprs = eventTeams.map(et => (et as any).opr).filter((v: any) => v != null) as number[];
  const rps = eventTeams.map(et => (et as any).rankingPoints).filter((v: any) => v != null) as number[];
  const seeds = eventTeams.map(et => (et as any).rank).filter((v: any) => v != null) as number[];
  if (oprs.length === 0 && rps.length === 0 && seeds.length === 0) return null;
  return {
    opr: oprs.length > 0 ? { min: Math.min(...oprs), max: Math.max(...oprs) } : null,
    rp: rps.length > 0 ? { min: Math.min(...rps), max: Math.max(...rps) } : null,
    seed: seeds.length > 0 ? { min: Math.min(...seeds), max: Math.max(...seeds) } : null,
  };
}

export function getTeamDominantColor(
  teamId: number,
  eventTeams: (EventTeam & { team: Team })[] | undefined,
  teamStats: Map<number, TeamStats>,
  statRanges: StatRanges | null,
  tbaRanges: TbaRanges | null,
): { bg: string; border: string } {
  const et = eventTeams?.find(e => e.teamId === teamId);
  const stats = teamStats.get(teamId);
  const hasData = (stats?.entries || 0) > 0;

  const colors: string[] = [];

  if (et) {
    const opr = (et as any).opr;
    const rp = (et as any).rankingPoints;
    const seed = (et as any).rank;
    if (opr != null && tbaRanges?.opr) colors.push(getHeatColor(opr, tbaRanges.opr.min, tbaRanges.opr.max));
    if (rp != null && tbaRanges?.rp) colors.push(getHeatColor(rp, tbaRanges.rp.min, tbaRanges.rp.max));
    if (seed != null && tbaRanges?.seed) colors.push(getHeatColor(tbaRanges.seed.max - seed + tbaRanges.seed.min, tbaRanges.seed.min, tbaRanges.seed.max));
  }

  if (hasData && statRanges && stats) {
    colors.push(getHeatColor(stats.avgAuto, statRanges.auto.min, statRanges.auto.max));
    colors.push(getHeatColor(stats.avgThroughput, statRanges.throughput.min, statRanges.throughput.max));
    colors.push(getHeatColor(stats.avgAccuracy, statRanges.accuracy.min, statRanges.accuracy.max));
    colors.push(getHeatColor(stats.avgDefense, statRanges.defense.min, statRanges.defense.max));
    colors.push(getHeatColor(stats.climbRate, statRanges.climb.min, statRanges.climb.max));
  }

  return {
    bg: getDominantColor(colors),
    border: getDominantBorderColor(colors),
  };
}
