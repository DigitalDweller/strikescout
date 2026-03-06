import type { EventTeam, ScoutingEntry, Team } from "@shared/schema";

export type TeamStats = {
  avgAuto: number;
  avgAutoAccuracy: number;
  avgThroughput: number;
  avgAccuracy: number;
  avgDefense: number;
  avgDriverSkill: number;
  climbRate: number;
  climbL1Rate: number;
  climbL2Rate: number;
  climbL3Rate: number;
  entries: number;
  /** True if team has at least one scouting entry where playedDefense was true. */
  hasDefense: boolean;
  /** True if team has at least one scouting entry where climb was attempted (success or failed). */
  hasClimbAttempted: boolean;
};

export type StatRange = { min: number; max: number; sweep?: number };
export type StatRanges = {
  auto: StatRange;
  autoAccuracy: StatRange;
  throughput: StatRange;
  accuracy: StatRange;
  defense: StatRange;
  driverSkill: StatRange;
  climb: StatRange;
  climbL1: StatRange;
  climbL2: StatRange;
  climbL3: StatRange;
};

/**
 * Sweep threshold: only values strictly above this get blue.
 * Uses a gap rule: the top value must be meaningfully ahead of the pack.
 * Excludes the top when computing min/max so non-sweep teams use the pack's range.
 */
function sweepThreshold(values: number[]): number | undefined {
  if (values.length < 4) return undefined;
  const sorted = [...values].sort((a, b) => b - a); // descending: highest first
  const top = sorted[0];
  const second = sorted[1];
  const range = top - sorted[sorted.length - 1];
  const minGap = Math.max(range * 0.15, 0.5); // top must be 15% of range or 0.5 units ahead
  if (top - second < minGap) return undefined; // no clear outlier, no sweep
  return second + 1e-6; // only values strictly above second get blue
}

export type TbaRanges = {
  opr: { min: number; max: number; sweep?: number } | null;
  seed: { min: number; max: number } | null;
};

export type SzrWeights = {
  auto: number;
  throughput: number;
  accuracy: number;
  defense: number;
  driverSkill: number;
  climb: number;
};

export const DEFAULT_SZR_WEIGHTS: SzrWeights = {
  auto: 1,
  throughput: 1,
  accuracy: 1,
  defense: 0.5,
  driverSkill: 0.8,
  climb: 1,
};

const SZR_KEYS: (keyof SzrWeights)[] = ["auto", "throughput", "accuracy", "defense", "driverSkill", "climb"];

/** Normalize weights so they sum to 100 (for percentage display/editing). Preserves relative ratios. */
export function normalizeWeightsToPercent(weights: SzrWeights): SzrWeights {
  const sum = SZR_KEYS.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0);
  if (sum <= 0) return DEFAULT_SZR_WEIGHTS_PERCENT;
  const result: SzrWeights = {} as SzrWeights;
  let allocated = 0;
  for (let i = 0; i < SZR_KEYS.length; i++) {
    const k = SZR_KEYS[i];
    const isLast = i === SZR_KEYS.length - 1;
    const raw = Math.max(0, weights[k] ?? 0);
    result[k] = isLast
      ? Math.round((100 - allocated) * 100) / 100
      : Math.round((raw / sum) * 10000) / 100;
    allocated += result[k];
  }
  return result;
}

export const DEFAULT_SZR_WEIGHTS_PERCENT: SzrWeights = {
  auto: 18,
  throughput: 18,
  accuracy: 18,
  defense: 10,
  driverSkill: 18,
  climb: 18,
};

/** Parse szrWeights from event (may be JSON string or object). Returns DEFAULT_SZR_WEIGHTS if invalid. */
export function parseSzrWeights(szrWeights: unknown): SzrWeights {
  if (szrWeights && typeof szrWeights === "object" && "auto" in szrWeights && "throughput" in szrWeights && "accuracy" in szrWeights && "defense" in szrWeights && "climb" in szrWeights) {
    const w = szrWeights as Record<string, unknown>;
    if ("driverSkill" in w && typeof w.driverSkill === "number") {
      return {
        auto: Number(w.auto) || 0,
        throughput: Number(w.throughput) || 0,
        accuracy: Number(w.accuracy) || 0,
        defense: Number(w.defense) || 0,
        driverSkill: Number(w.driverSkill) || 0,
        climb: Number(w.climb) || 0,
      };
    }
    /* Old 5-key format: scale existing weights to add driverSkill (18%), preserving relative importance */
    const a = Number(w.auto) || 0, t = Number(w.throughput) || 0, acc = Number(w.accuracy) || 0, d = Number(w.defense) || 0, c = Number(w.climb) || 0;
    const oldSum = a + t + acc + d + c;
    const scale = oldSum > 0 ? 82 / oldSum : 1;
    const autoS = Math.round(a * scale * 100) / 100, throughputS = Math.round(t * scale * 100) / 100, accuracyS = Math.round(acc * scale * 100) / 100, defenseS = Math.round(d * scale * 100) / 100;
    const climbS = Math.round((82 - autoS - throughputS - accuracyS - defenseS) * 100) / 100;
    return { auto: autoS, throughput: throughputS, accuracy: accuracyS, defense: defenseS, driverSkill: 18, climb: climbS };
  }
  if (typeof szrWeights === "string") {
    try {
      const parsed = JSON.parse(szrWeights);
      return parseSzrWeights(parsed);
    } catch {
      return DEFAULT_SZR_WEIGHTS;
    }
  }
  return DEFAULT_SZR_WEIGHTS;
}

/** Sweep = far above rest (value > sweepThreshold). Blue, Green = best, Yellow = mid, Orange = bad, Red = worst. */
export function getHeatColor(value: number, min: number, max: number, sweepThreshold?: number | null) {
  if (sweepThreshold != null && value > sweepThreshold) return "bg-blue-500/40 text-blue-50 dark:text-blue-50";
  if (max === min) {
    const norm = (value >= 0 && value <= 100) ? value / 100 : 0.5;
    if (norm >= 0.6) return "bg-green-500/35 text-green-950 dark:text-green-100";
    if (norm >= 0.4) return "bg-yellow-500/35 text-yellow-950 dark:text-yellow-100";
    if (norm >= 0.2) return "bg-orange-500/35 text-orange-950 dark:text-orange-100";
    return "bg-red-500/40 text-red-950 dark:text-red-100";
  }
  const norm = (value - min) / (max - min);
  if (norm >= 0.6) return "bg-green-500/35 text-green-950 dark:text-green-100";
  if (norm >= 0.4) return "bg-yellow-500/35 text-yellow-950 dark:text-yellow-100";
  if (norm >= 0.2) return "bg-orange-500/35 text-orange-950 dark:text-orange-100";
  return "bg-red-500/40 text-red-950 dark:text-red-100";
}

/** Returns only the background part of getHeatColor (for coloring containers without text). */
export function getHeatBgOnly(value: number, min: number, max: number, sweepThreshold?: number | null) {
  const full = getHeatColor(value, min, max, sweepThreshold);
  if (!full) return "";
  return full.split(/\s+/).filter((c) => c.startsWith("bg-")).join(" ") || "";
}

/** Returns only the text color part of getHeatColor (for coloring text without background). */
export function getHeatTextOnly(value: number, min: number, max: number, sweepThreshold?: number | null) {
  const full = getHeatColor(value, min, max, sweepThreshold);
  if (!full) return "";
  return full.split(/\s+/).filter((c) => !c.startsWith("bg-")).join(" ") || "";
}

/** Returns a subtle border color class for heat. */
export function getHeatBorderOnly(value: number, min: number, max: number, sweepThreshold?: number | null) {
  if (sweepThreshold != null && value > sweepThreshold) return "border-blue-500/70 dark:border-blue-600/70";
  if (max === min) {
    const norm = (value >= 0 && value <= 100) ? value / 100 : 0.5;
    if (norm >= 0.6) return "border-green-500/60 dark:border-green-500/60";
    if (norm >= 0.4) return "border-yellow-500/60 dark:border-yellow-500/60";
    if (norm >= 0.2) return "border-orange-500/60 dark:border-orange-500/60";
    return "border-red-500/60 dark:border-red-500/60";
  }
  const norm = (value - min) / (max - min);
  if (norm >= 0.6) return "border-green-500/60 dark:border-green-500/60";
  if (norm >= 0.4) return "border-yellow-500/60 dark:border-yellow-500/60";
  if (norm >= 0.2) return "border-orange-500/60 dark:border-orange-500/60";
  return "border-red-500/60 dark:border-red-500/60";
}

/** Like getHeatColor for team compare view. */
export function getCompareHeatColor(value: number, min: number, max: number, sweepThreshold?: number | null) {
  return getHeatColor(value, min, max, sweepThreshold);
}

/** Returns a CSS color string (not Tailwind class) for slider tracks. */
export function getHeatCssColor(value: number, min: number, max: number, sweepThreshold?: number | null): string {
  if (sweepThreshold != null && value > sweepThreshold) return "rgb(59 130 246)"; // blue-500
  if (max === min) {
    const norm = (value >= 0 && value <= 100) ? value / 100 : 0.5;
    if (norm >= 0.6) return "rgb(34 197 94)";   // green-500
    if (norm >= 0.4) return "rgb(234 179 8)";   // yellow-500
    if (norm >= 0.2) return "rgb(249 115 22)";  // orange-500
    return "rgb(239 68 68)";                     // red-500
  }
  const norm = (value - min) / (max - min);
  if (norm >= 0.6) return "rgb(34 197 94)";   // green-500
  if (norm >= 0.4) return "rgb(234 179 8)";   // yellow-500
  if (norm >= 0.2) return "rgb(249 115 22)";  // orange-500
  return "rgb(239 68 68)";                     // red-500
}

export function getRowBorderColor(value: number, min: number, max: number, sweepThreshold?: number | null) {
  if (sweepThreshold != null && value > sweepThreshold) return "border-l-blue-500";
  if (max === min) {
    const norm = (value >= 0 && value <= 100) ? value / 100 : 0.5;
    if (norm >= 0.6) return "border-l-green-500";
    if (norm >= 0.4) return "border-l-yellow-500";
    if (norm >= 0.2) return "border-l-orange-500";
    return "border-l-red-500";
  }
  const norm = (value - min) / (max - min);
  if (norm >= 0.6) return "border-l-green-500";
  if (norm >= 0.4) return "border-l-yellow-500";
  if (norm >= 0.2) return "border-l-orange-500";
  return "border-l-red-500";
}

/** When counting stats for team color: higher tiers count as that tier + all below.
 *  We weight by tier importance: sweep=8, green=4, yellow=3, orange=2, red=1. */
const TIER_WEIGHT: Record<string, number> = { sweep: 8, green: 4, yellow: 3, orange: 2, red: 1 };
const TIER_ORDER = ["sweep", "green", "yellow", "orange", "red"] as const;

function scoreTiers(colors: string[]): Record<string, number> {
  const scores: Record<string, number> = { sweep: 0, green: 0, yellow: 0, orange: 0, red: 0 };
  for (const c of colors) {
    let tier = "";
    if (c.includes("blue-500") || c.includes("blue-900")) tier = "sweep";
    else if (c.includes("green-5")) tier = "green";
    else if (c.includes("yellow-5")) tier = "yellow";
    else if (c.includes("orange-5")) tier = "orange";
    else if (c.includes("red-5") || c.includes("rose-")) tier = "red";
    if (tier) {
      const w = TIER_WEIGHT[tier];
      for (const t of TIER_ORDER) if (TIER_WEIGHT[t] <= w) scores[t] = (scores[t] || 0) + 1;
    }
  }
  return scores;
}

export function getDominantColor(colors: string[]): string {
  const validColors = colors.filter(c => c !== "");
  if (validColors.length === 0) return "";

  const scores = scoreTiers(validColors);
  const weighted: Record<string, number> = {};
  for (const t of TIER_ORDER) {
    weighted[t] = (scores[t] ?? 0) * TIER_WEIGHT[t];
  }
  let best = "";
  let bestScore = 0;
  for (const t of TIER_ORDER) {
    if ((weighted[t] ?? 0) > bestScore) { best = t; bestScore = weighted[t] ?? 0; }
  }

  if (best === "sweep") return "bg-blue-500/40 text-blue-50 dark:text-blue-50";
  if (best === "green") return "bg-green-500/35 text-green-950 dark:text-green-100";
  if (best === "yellow") return "bg-yellow-500/35 text-yellow-950 dark:text-yellow-100";
  if (best === "orange") return "bg-orange-500/35 text-orange-950 dark:text-orange-100";
  if (best === "red") return "bg-red-500/40 text-red-950 dark:text-red-100";
  return "";
}

export function getDominantBorderColor(colors: string[]): string {
  const validColors = colors.filter(c => c !== "");
  if (validColors.length === 0) return "border-l-transparent";

  const scores = scoreTiers(validColors);
  const weighted: Record<string, number> = {};
  for (const t of TIER_ORDER) weighted[t] = (scores[t] ?? 0) * TIER_WEIGHT[t];
  let best = "";
  let bestScore = 0;
  for (const t of TIER_ORDER) {
    if ((weighted[t] ?? 0) > bestScore) { best = t; bestScore = weighted[t] ?? 0; }
  }

  if (best === "sweep") return "border-l-blue-500";
  if (best === "green") return "border-l-green-500";
  if (best === "yellow") return "border-l-yellow-500";
  if (best === "orange") return "border-l-orange-500";
  if (best === "red") return "border-l-red-500";
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
      map.set(team.id, { avgAuto: 0, avgAutoAccuracy: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, avgDriverSkill: 0, climbRate: 0, climbL1Rate: 0, climbL2Rate: 0, climbL3Rate: 0, entries: 0, hasDefense: false, hasClimbAttempted: false });
    } else {
      const accSum = teamEntries.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0);
      const defenseEntries = teamEntries.filter(e => e.playedDefense);
      const hasDefense = defenseEntries.length > 0;
      const defSum = hasDefense
        ? defenseEntries.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / defenseEntries.length
        : 0;
      const autoAccEntries = teamEntries.filter(e => (e.autoBallsShot ?? 0) >= 1);
      const avgAutoAcc = autoAccEntries.length > 0
        ? autoAccEntries.reduce((s, e) => s + toPct(e.autoAccuracy ?? 0), 0) / autoAccEntries.length
        : 0;
      const driverSum = teamEntries.reduce((s, e) => s + toPct(e.driverSkill ?? 0), 0);
      const hasClimbAttempted = teamEntries.some(e => e.climbSuccess === "success" || e.climbSuccess === "failed");
      const climbSuccess = teamEntries.filter(e => e.climbSuccess === "success");
      const l1Count = climbSuccess.filter(e => e.climbLevel === "1").length;
      const l2Count = climbSuccess.filter(e => e.climbLevel === "2").length;
      const l3Count = climbSuccess.filter(e => e.climbLevel === "3").length;
      map.set(team.id, {
        avgAuto: teamEntries.reduce((s, e) => s + e.autoBallsShot, 0) / count,
        avgAutoAccuracy: avgAutoAcc,
        avgThroughput: teamEntries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count,
        avgAccuracy: accSum / count,
        avgDefense: defSum,
        avgDriverSkill: driverSum / count,
        climbRate: climbSuccess.length / count * 100,
        climbL1Rate: l1Count / count * 100,
        climbL2Rate: l2Count / count * 100,
        climbL3Rate: l3Count / count * 100,
        entries: count,
        hasDefense,
        hasClimbAttempted,
      });
    }
  }
  return map;
}

/** Same as computeTeamStats but keyed by scouterId for scouter leaderboard. */
export function computeScouterStats(entries: ScoutingEntry[]): Map<number, TeamStats> {
  const map = new Map<number, TeamStats>();
  const scouterIds = Array.from(new Set(entries.map((e) => e.scouterId)));
  for (const scouterId of scouterIds) {
    const scouterEntries = entries.filter((e) => e.scouterId === scouterId);
    const count = scouterEntries.length;
    if (count === 0) {
      map.set(scouterId, { avgAuto: 0, avgAutoAccuracy: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, avgDriverSkill: 0, climbRate: 0, climbL1Rate: 0, climbL2Rate: 0, climbL3Rate: 0, entries: 0, hasDefense: false, hasClimbAttempted: false });
    } else {
      const accSum = scouterEntries.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0);
      const defenseEntries = scouterEntries.filter((e) => e.playedDefense);
      const hasDefense = defenseEntries.length > 0;
      const defSum = hasDefense
        ? defenseEntries.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / defenseEntries.length
        : 0;
      const autoAccEntries = scouterEntries.filter((e) => (e.autoBallsShot ?? 0) >= 1);
      const avgAutoAcc = autoAccEntries.length > 0
        ? autoAccEntries.reduce((s, e) => s + toPct(e.autoAccuracy ?? 0), 0) / autoAccEntries.length
        : 0;
      const driverSum = scouterEntries.reduce((s, e) => s + toPct(e.driverSkill ?? 0), 0);
      const hasClimbAttempted = scouterEntries.some((e) => e.climbSuccess === "success" || e.climbSuccess === "failed");
      const climbSuccess = scouterEntries.filter((e) => e.climbSuccess === "success");
      const l1Count = climbSuccess.filter((e) => e.climbLevel === "1").length;
      const l2Count = climbSuccess.filter((e) => e.climbLevel === "2").length;
      const l3Count = climbSuccess.filter((e) => e.climbLevel === "3").length;
      map.set(scouterId, {
        avgAuto: scouterEntries.reduce((s, e) => s + e.autoBallsShot, 0) / count,
        avgAutoAccuracy: avgAutoAcc,
        avgThroughput: scouterEntries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count,
        avgAccuracy: accSum / count,
        avgDefense: defSum,
        avgDriverSkill: driverSum / count,
        climbRate: climbSuccess.length / count * 100,
        climbL1Rate: l1Count / count * 100,
        climbL2Rate: l2Count / count * 100,
        climbL3Rate: l3Count / count * 100,
        entries: count,
        hasDefense,
        hasClimbAttempted,
      });
    }
  }
  return map;
}

function rangeFull(values: number[], fallback: { min: number; max: number }): StatRange {
  if (values.length === 0) return { ...fallback };
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** 5th and 95th percentiles — robust to outliers, prevents one stat from stretching the scale. */
function p5(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(values.length * 0.05);
  return sorted[Math.max(0, idx)];
}
function p95(values: number[]): number {
  if (values.length === 0) return 100;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(values.length * 0.95) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, idx))];
}

function rangePercentile(values: number[], fallback: { min: number; max: number }): StatRange {
  if (values.length < 4) return rangeFull(values, fallback);
  const min = p5(values);
  const max = p95(values);
  return min >= max ? { ...fallback } : { min, max };
}

function rangeWithSweep(values: number[], fallback: { min: number; max: number }): StatRange {
  if (values.length === 0) return { ...fallback };
  if (values.length === 1) {
    const v = values[0];
    return { min: v, max: v, sweep: v - 1e-6 }; // Sole in category = sweep
  }
  const sweep = sweepThreshold(values);
  const excluded = sweep != null ? values.filter(v => v < sweep) : values;
  if (excluded.length === 0) return { min: Math.min(...values), max: Math.max(...values), sweep: sweep ?? undefined };
  const min = Math.min(...excluded);
  const max = Math.max(...excluded);
  return { min, max, sweep: sweep ?? undefined };
}

export function computeStatRanges(teamStats: Map<number, TeamStats>): StatRanges | null {
  const allStats = Array.from(teamStats.values()).filter(s => s.entries > 0);
  if (allStats.length === 0) return null;
  const withAutoAcc = allStats.filter(s => s.avgAutoAccuracy > 0);
  const withDefense = allStats.filter(s => s.hasDefense);
  const withClimb = allStats.filter(s => s.hasClimbAttempted);

  return {
    auto: rangeWithSweep(allStats.map(s => s.avgAuto), { min: 0, max: 0 }),
    autoAccuracy: withAutoAcc.length > 0 ? rangeWithSweep(withAutoAcc.map(s => s.avgAutoAccuracy), { min: 0, max: 100 }) : { min: 0, max: 100 },
    throughput: rangeWithSweep(allStats.map(s => s.avgThroughput), { min: 0, max: 0 }),
    accuracy: rangeWithSweep(allStats.map(s => s.avgAccuracy), { min: 0, max: 100 }),
    defense: withDefense.length > 0 ? rangeWithSweep(withDefense.map(s => s.avgDefense), { min: 0, max: 100 }) : { min: 0, max: 100 },
    driverSkill: rangeWithSweep(allStats.map(s => s.avgDriverSkill), { min: 0, max: 100 }),
    climb: withClimb.length > 0 ? rangeWithSweep(withClimb.map(s => s.climbRate), { min: 0, max: 100 }) : { min: 0, max: 100 },
    climbL1: withClimb.length > 0 ? rangeWithSweep(withClimb.map(s => s.climbL1Rate), { min: 0, max: 100 }) : { min: 0, max: 100 },
    climbL2: withClimb.length > 0 ? rangeWithSweep(withClimb.map(s => s.climbL2Rate), { min: 0, max: 100 }) : { min: 0, max: 100 },
    climbL3: withClimb.length > 0 ? rangeWithSweep(withClimb.map(s => s.climbL3Rate), { min: 0, max: 100 }) : { min: 0, max: 100 },
  };
}

/** Percentile-based ranges (5th–95th) — robust to outliers. One high stat won't stretch the scale for others. */
export function computeStatRangesForSzr(teamStats: Map<number, TeamStats>): StatRanges | null {
  const allStats = Array.from(teamStats.values()).filter(s => s.entries > 0);
  if (allStats.length === 0) return null;
  const withAutoAcc = allStats.filter(s => s.avgAutoAccuracy > 0);
  const withDefense = allStats.filter(s => s.hasDefense);
  const withClimb = allStats.filter(s => s.hasClimbAttempted);
  return {
    auto: rangePercentile(allStats.map(s => s.avgAuto), { min: 0, max: 0 }),
    autoAccuracy: withAutoAcc.length > 0 ? rangePercentile(withAutoAcc.map(s => s.avgAutoAccuracy), { min: 0, max: 100 }) : { min: 0, max: 100 },
    throughput: rangePercentile(allStats.map(s => s.avgThroughput), { min: 0, max: 0 }),
    accuracy: rangePercentile(allStats.map(s => s.avgAccuracy), { min: 0, max: 100 }),
    defense: withDefense.length > 0 ? rangePercentile(withDefense.map(s => s.avgDefense), { min: 0, max: 100 }) : { min: 0, max: 100 },
    driverSkill: rangePercentile(allStats.map(s => s.avgDriverSkill), { min: 0, max: 100 }),
    climb: withClimb.length > 0 ? rangePercentile(withClimb.map(s => s.climbRate), { min: 0, max: 100 }) : { min: 0, max: 100 },
    climbL1: withClimb.length > 0 ? rangeFull(withClimb.map(s => s.climbL1Rate), { min: 0, max: 100 }) : { min: 0, max: 100 },
    climbL2: withClimb.length > 0 ? rangeFull(withClimb.map(s => s.climbL2Rate), { min: 0, max: 100 }) : { min: 0, max: 100 },
    climbL3: withClimb.length > 0 ? rangeFull(withClimb.map(s => s.climbL3Rate), { min: 0, max: 100 }) : { min: 0, max: 100 },
  };
}

function normalizeStat(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function computeSZR(
  stats: TeamStats,
  ranges: StatRanges | null,
  weights: SzrWeights
): number | null {
  if (stats.entries === 0 || !ranges) return null;
  const components: { w: number; norm: number }[] = [
    { w: weights.auto, norm: normalizeStat(stats.avgAuto, ranges.auto.min, ranges.auto.max) },
    { w: weights.throughput, norm: normalizeStat(stats.avgThroughput, ranges.throughput.min, ranges.throughput.max) },
    { w: weights.accuracy, norm: normalizeStat(stats.avgAccuracy, ranges.accuracy.min, ranges.accuracy.max) },
    { w: stats.hasDefense ? weights.defense : 0, norm: stats.hasDefense ? normalizeStat(stats.avgDefense, ranges.defense.min, ranges.defense.max) : 0 },
    { w: weights.driverSkill, norm: normalizeStat(stats.avgDriverSkill, ranges.driverSkill.min, ranges.driverSkill.max) },
    { w: stats.hasClimbAttempted ? weights.climb : 0, norm: stats.hasClimbAttempted ? normalizeStat(stats.climbRate, ranges.climb.min, ranges.climb.max) : 0 },
  ];
  let sum = 0;
  let weightSum = 0;
  for (const { w, norm } of components) {
    if (w > 0) {
      sum += w * norm;
      weightSum += w;
    }
  }
  if (weightSum === 0) return 0;
  let weightedAvg = sum / weightSum;
  /* Balance factor: penalize teams with one stat dominating. Rewards well-roundedness. */
  const activeNorms = components.filter(c => c.w > 0).map(c => c.norm);
  if (activeNorms.length >= 2) {
    const mean = activeNorms.reduce((a, b) => a + b, 0) / activeNorms.length;
    const variance = activeNorms.reduce((s, n) => s + (n - mean) ** 2, 0) / activeNorms.length;
    const balanceFactor = Math.max(0.75, 1 - 0.2 * variance);
    weightedAvg *= balanceFactor;
  }
  return Math.round(100 * Math.min(1, weightedAvg));
}

export function computeSzrMap(
  teams: Team[],
  entries: ScoutingEntry[],
  statRanges: StatRanges | null,
  weights: SzrWeights
): Map<number, number> {
  const teamStats = computeTeamStats(teams, entries);
  const map = new Map<number, number>();
  for (const team of teams) {
    const stats = teamStats.get(team.id);
    const szr = stats ? computeSZR(stats, statRanges, weights) : null;
    map.set(team.id, szr ?? 0);
  }
  return map;
}

/** Count sweep categories for a team (OPR, seed, dr, auto, throughput, accuracy, defense, climb). Excludes SZR. */
function getTeamSweepCount(
  teamId: number,
  eventTeams: (EventTeam & { team: Team })[] | undefined,
  teamStats: Map<number, TeamStats>,
  statRanges: StatRanges | null,
  tbaRanges: TbaRanges | null,
): number {
  const et = eventTeams?.find(e => e.teamId === teamId);
  const stats = teamStats.get(teamId);
  const hasData = (stats?.entries || 0) > 0;
  const colors: string[] = [];
  if (et) {
    const opr = (et as any).opr;
    const seed = (et as any).rank;
    if (opr != null && tbaRanges?.opr) colors.push(getHeatColor(opr, tbaRanges.opr.min, tbaRanges.opr.max, tbaRanges.opr.sweep));
    if (seed != null && tbaRanges?.seed) colors.push(getSeedHeatColor(seed, tbaRanges.seed, et));
  }
  if (hasData && statRanges && stats) {
    colors.push(getHeatColor(stats.avgDriverSkill, statRanges.driverSkill.min, statRanges.driverSkill.max, statRanges.driverSkill.sweep));
    colors.push(getHeatColor(stats.avgAuto, statRanges.auto.min, statRanges.auto.max, statRanges.auto.sweep));
    colors.push(getHeatColor(stats.avgThroughput, statRanges.throughput.min, statRanges.throughput.max, statRanges.throughput.sweep));
    colors.push(getHeatColor(stats.avgAccuracy, statRanges.accuracy.min, statRanges.accuracy.max, statRanges.accuracy.sweep));
    if (stats.hasDefense) colors.push(getHeatColor(stats.avgDefense, statRanges.defense.min, statRanges.defense.max, statRanges.defense.sweep));
    if (stats.hasClimbAttempted) colors.push(getHeatColor(stats.climbRate, statRanges.climb.min, statRanges.climb.max, statRanges.climb.sweep));
  }
  return colors.filter(c => c.includes("blue-500") || c.includes("blue-900")).length;
}

/** SZR bonus: +10 for 1+ sweep categories, +3 per extra. Can exceed 100. */
const SZR_SWEEP_BONUS_FIRST = 10;
const SZR_SWEEP_BONUS_EXTRA = 3;

/** Returns SZR map with sweep bonus applied. Use this instead of computeSzrMap when eventTeams/tbaRanges/statRanges are available. */
export function computeSzrMapWithSweepBonus(
  teams: Team[],
  entries: ScoutingEntry[],
  statRangesForSzr: StatRanges | null,
  statRanges: StatRanges | null,
  weights: SzrWeights,
  eventTeams: (EventTeam & { team: Team })[] | undefined,
  tbaRanges: TbaRanges | null,
): Map<number, number> {
  const base = computeSzrMap(teams, entries, statRangesForSzr, weights);
  const teamStats = computeTeamStats(teams, entries);
  const result = new Map<number, number>();
  for (const team of teams) {
    const baseSzr = base.get(team.id) ?? 0;
    const sweepCount = getTeamSweepCount(team.id, eventTeams, teamStats, statRanges, tbaRanges);
    const bonus = sweepCount >= 1 ? SZR_SWEEP_BONUS_FIRST + (sweepCount - 1) * SZR_SWEEP_BONUS_EXTRA : 0;
    result.set(team.id, baseSzr + bonus);
  }
  return result;
}

const SEED_SWEEP_BG = "bg-blue-500/40";
const SEED_SWEEP_TEXT = "text-blue-50 dark:text-blue-50";
const SEED_SWEEP_BORDER = "border-blue-500/60 dark:border-blue-600/60";

/** Seed heat color. Returns sweep (blue) if team record is undefeated (wins>=1, losses=0). */
export function getSeedHeatColor(
  seed: number,
  seedRange: { min: number; max: number },
  eventTeam?: { wins?: number; losses?: number } | null,
): string {
  const wins = (eventTeam as { wins?: number })?.wins ?? 0;
  const losses = (eventTeam as { losses?: number })?.losses ?? 0;
  if (wins >= 1 && losses === 0) return `${SEED_SWEEP_BG} ${SEED_SWEEP_TEXT}`;
  return getHeatColor(seedRange.max - seed + seedRange.min, seedRange.min, seedRange.max);
}

/** Seed heat parts for separate bg/text/border styling. Sweep if undefeated. */
export function getSeedHeatParts(
  seed: number,
  seedRange: { min: number; max: number },
  eventTeam?: { wins?: number; losses?: number } | null,
): { bg: string; text: string; border: string } {
  const wins = (eventTeam as { wins?: number })?.wins ?? 0;
  const losses = (eventTeam as { losses?: number })?.losses ?? 0;
  if (wins >= 1 && losses === 0) return { bg: SEED_SWEEP_BG, text: SEED_SWEEP_TEXT, border: SEED_SWEEP_BORDER };
  const inv = seedRange.max - seed + seedRange.min;
  return {
    bg: getHeatBgOnly(inv, seedRange.min, seedRange.max),
    text: getHeatTextOnly(inv, seedRange.min, seedRange.max),
    border: getHeatBorderOnly(inv, seedRange.min, seedRange.max),
  };
}

export function computeTbaRanges(eventTeams: (EventTeam & { team: Team })[]): TbaRanges | null {
  const oprs = eventTeams.map(et => (et as any).opr).filter((v: any) => v != null) as number[];
  const seeds = eventTeams.map(et => (et as any).rank).filter((v: any) => v != null) as number[];
  if (oprs.length === 0 && seeds.length === 0) return null;

  let oprRange: { min: number; max: number; sweep?: number } | null = null;
  if (oprs.length > 0) {
    const sorted = [...oprs].sort((a, b) => b - a);
    const top = sorted[0];
    const second = sorted[1];
    const sweepThresh = second != null && top - second >= 100 ? second + 100 - 1e-6 : undefined;
    const packOprs = sweepThresh != null ? oprs.filter(v => v <= sweepThresh) : oprs;
    const packMin = packOprs.length > 0 ? Math.min(...packOprs) : Math.min(...oprs);
    const packMax = packOprs.length > 0 ? Math.max(...packOprs) : Math.max(...oprs);
    oprRange = { min: packMin, max: packMax };
    if (sweepThresh != null) oprRange.sweep = sweepThresh;
  }

  return {
    opr: oprRange,
    seed: seeds.length > 0 ? { min: Math.min(...seeds), max: Math.max(...seeds) } : null,
  };
}

export function getTeamDominantColor(
  teamId: number,
  eventTeams: (EventTeam & { team: Team })[] | undefined,
  teamStats: Map<number, TeamStats>,
  statRanges: StatRanges | null,
  tbaRanges: TbaRanges | null,
  opts?: { szrMap?: Map<number, number>; szrSweepThreshold?: number | null },
): { bg: string; border: string } {
  const et = eventTeams?.find(e => e.teamId === teamId);
  const stats = teamStats.get(teamId);
  const hasData = (stats?.entries || 0) > 0;

  const colors: string[] = [];

  const szrVal = opts?.szrMap?.get(teamId) ?? 0;
  if (szrVal > 0) colors.push(getHeatColor(szrVal, 0, 100, opts?.szrSweepThreshold ?? undefined));

  if (et) {
    const opr = (et as any).opr;
    const seed = (et as any).rank;
    if (opr != null && tbaRanges?.opr) colors.push(getHeatColor(opr, tbaRanges.opr.min, tbaRanges.opr.max, tbaRanges.opr.sweep));
    if (seed != null && tbaRanges?.seed) colors.push(getSeedHeatColor(seed, tbaRanges.seed, et));
  }

  if (hasData && statRanges && stats) {
    colors.push(getHeatColor(stats.avgDriverSkill, statRanges.driverSkill.min, statRanges.driverSkill.max, statRanges.driverSkill.sweep));
    colors.push(getHeatColor(stats.avgAuto, statRanges.auto.min, statRanges.auto.max, statRanges.auto.sweep));
    colors.push(getHeatColor(stats.avgThroughput, statRanges.throughput.min, statRanges.throughput.max, statRanges.throughput.sweep));
    colors.push(getHeatColor(stats.avgAccuracy, statRanges.accuracy.min, statRanges.accuracy.max, statRanges.accuracy.sweep));
    if (stats.hasDefense) colors.push(getHeatColor(stats.avgDefense, statRanges.defense.min, statRanges.defense.max, statRanges.defense.sweep));
    if (stats.hasClimbAttempted) colors.push(getHeatColor(stats.climbRate, statRanges.climb.min, statRanges.climb.max, statRanges.climb.sweep));
  }

  const sweepCount = colors.filter(c => c.includes("blue-500") || c.includes("blue-900")).length;
  if (sweepCount >= 2) {
    return { bg: "bg-blue-500/40 text-blue-50 dark:text-blue-50", border: "border-l-blue-500" };
  }

  /* Exclude sweep from rating vote; use non-sweep categories only. Fall back to all colors if all are sweep. */
  const nonSweep = colors.filter(c => !c.includes("blue-500") && !c.includes("blue-900"));
  const forRating = nonSweep.length > 0 ? nonSweep : colors;

  return {
    bg: getDominantColor(forRating),
    border: getDominantBorderColor(forRating),
  };
}
