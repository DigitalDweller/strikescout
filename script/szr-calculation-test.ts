/**
 * SZR (Strike Zone Rating) — Exact Calculation & Test
 *
 * This script documents the exact SZR formula and runs test numbers with
 * extremely high values to verify the calculation.
 */

// --- Exact formula (from client/src/lib/team-colors.ts) ---

/** Normalize a stat value to 0-1 within its event range. */
function normalizeStat(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** Compute SZR: weighted average of normalized stats, scaled 0-100. */
function computeSZR(
  stats: { avgAuto: number; avgThroughput: number; avgAccuracy: number; avgDefense: number; climbRate: number; entries: number },
  ranges: { auto: { min: number; max: number }; throughput: { min: number; max: number }; accuracy: { min: number; max: number }; defense: { min: number; max: number }; climb: { min: number; max: number } },
  weights: { auto: number; throughput: number; accuracy: number; defense: number; climb: number }
): number {
  let sum = 0;
  let weightSum = 0;
  const components = [
    { key: "auto", w: weights.auto, norm: normalizeStat(stats.avgAuto, ranges.auto.min, ranges.auto.max), value: stats.avgAuto },
    { key: "throughput", w: weights.throughput, norm: normalizeStat(stats.avgThroughput, ranges.throughput.min, ranges.throughput.max), value: stats.avgThroughput },
    { key: "accuracy", w: weights.accuracy, norm: normalizeStat(stats.avgAccuracy, ranges.accuracy.min, ranges.accuracy.max), value: stats.avgAccuracy },
    { key: "defense", w: weights.defense, norm: normalizeStat(stats.avgDefense, ranges.defense.min, ranges.defense.max), value: stats.avgDefense },
    { key: "climb", w: weights.climb, norm: normalizeStat(stats.climbRate, ranges.climb.min, ranges.climb.max), value: stats.climbRate },
  ];
  for (const { w, norm } of components) {
    if (w > 0) {
      sum += w * norm;
      weightSum += w;
    }
  }
  if (weightSum === 0) return 0;
  return Math.round(100 * sum / weightSum);
}

// --- Default weights (percent) ---
const DEFAULT_WEIGHTS = { auto: 22, throughput: 22, accuracy: 22, defense: 12, climb: 22 };

// --- Test: extremely high team vs baseline team ---
console.log("=".repeat(80));
console.log("SZR (Strike Zone Rating) — Exact Calculation");
console.log("=".repeat(80));
console.log(`
FORMULA:
  normalizeStat(value, min, max) = clamp(0, 1, (value - min) / (max - min))
  SZR = round(100 * Σ(weight_i * norm_i) / Σ(weight_i))

  where norm_i = normalizeStat(stats_i, range_i.min, range_i.max)
  and range min/max come from ALL teams in the event (min/max across event).
`);

// Scenario: 2 teams — one extremely high, one baseline (zeros)
const highTeam = {
  avgAuto: 15,      // extremely high
  avgThroughput: 20, // extremely high
  avgAccuracy: 100,
  avgDefense: 100,
  climbRate: 100,
  entries: 5,
};

const baselineTeam = {
  avgAuto: 0,
  avgThroughput: 0,
  avgAccuracy: 0,
  avgDefense: 0,
  climbRate: 0,
  entries: 3,
};

// Ranges = min/max across both teams
const ranges = {
  auto:       { min: 0,  max: 15 },
  throughput: { min: 0,  max: 20 },
  accuracy:   { min: 0,  max: 100 },
  defense:    { min: 0,  max: 100 },
  climb:      { min: 0,  max: 100 },
};

console.log("RANGES (min/max across event):");
console.log(JSON.stringify(ranges, null, 2));
console.log("");

console.log("WEIGHTS (default %):", DEFAULT_WEIGHTS);
console.log("");

// Step-by-step for high team
console.log("-".repeat(80));
console.log("EXTREMELY HIGH TEAM (avgAuto=15, throughput=20, acc=100%, def=100%, climb=100%)");
console.log("-".repeat(80));

const norms = {
  auto:       normalizeStat(highTeam.avgAuto, ranges.auto.min, ranges.auto.max),
  throughput: normalizeStat(highTeam.avgThroughput, ranges.throughput.min, ranges.throughput.max),
  accuracy:   normalizeStat(highTeam.avgAccuracy, ranges.accuracy.min, ranges.accuracy.max),
  defense:    normalizeStat(highTeam.avgDefense, ranges.defense.min, ranges.defense.max),
  climb:      normalizeStat(highTeam.climbRate, ranges.climb.min, ranges.climb.max),
};

console.log("Normalized values (0-1):");
console.log(`  auto:       (15 - 0) / (15 - 0) = ${norms.auto}`);
console.log(`  throughput: (20 - 0) / (20 - 0) = ${norms.throughput}`);
console.log(`  accuracy:   (100 - 0) / (100 - 0) = ${norms.accuracy}`);
console.log(`  defense:    (100 - 0) / (100 - 0) = ${norms.defense}`);
console.log(`  climb:      (100 - 0) / (100 - 0) = ${norms.climb}`);
console.log("");

const w = DEFAULT_WEIGHTS;
const sum = w.auto * norms.auto + w.throughput * norms.throughput + w.accuracy * norms.accuracy + w.defense * norms.defense + w.climb * norms.climb;
const weightSum = w.auto + w.throughput + w.accuracy + w.defense + w.climb;

console.log("Weighted sum:");
console.log(`  sum = (22×1) + (22×1) + (22×1) + (12×1) + (22×1) = ${sum}`);
console.log(`  weightSum = 22 + 22 + 22 + 12 + 22 = ${weightSum}`);
console.log(`  SZR = round(100 × ${sum} / ${weightSum}) = ${Math.round(100 * sum / weightSum)}`);
console.log("");

const szrHigh = computeSZR(highTeam, ranges, DEFAULT_WEIGHTS);
const szrBaseline = computeSZR(baselineTeam, ranges, DEFAULT_WEIGHTS);

console.log("RESULT:");
console.log(`  Extremely high team SZR: ${szrHigh}`);
console.log(`  Baseline team (all zeros) SZR: ${szrBaseline}`);
console.log("");

// Additional test: mixed high values
const mixedTeam = {
  avgAuto: 10,
  avgThroughput: 15,
  avgAccuracy: 80,
  avgDefense: 60,
  climbRate: 67,
  entries: 4,
};

// With same ranges (0-15 auto, 0-20 throughput, etc.)
const szrMixed = computeSZR(mixedTeam, ranges, DEFAULT_WEIGHTS);
console.log("MIXED TEAM (auto=10, throughput=15, acc=80%, def=60%, climb=67%):");
console.log(`  norm_auto = (10-0)/(15-0) = ${(10/15).toFixed(4)}`);
console.log(`  norm_throughput = (15-0)/(20-0) = ${(15/20).toFixed(4)}`);
console.log(`  norm_accuracy = 80/100 = 0.8`);
console.log(`  norm_defense = 60/100 = 0.6`);
console.log(`  norm_climb = 67/100 = 0.67`);
console.log(`  SZR = ${szrMixed}`);
console.log("");
console.log("=".repeat(80));
