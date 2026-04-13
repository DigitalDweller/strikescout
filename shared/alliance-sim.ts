/** Alliance sim: 8 captains × N partner slots (default 2, optional 3 for “fourth robot” / worlds-style). */

export const ALLIANCE_SIM_CAPTAINS = 8;

export type AllianceSimPartnerSlotCount = 2 | 3;

export function partnerSlotCountFromEvent(ev: { allianceSimFourPartnerSlots?: boolean | null }): AllianceSimPartnerSlotCount {
  return ev.allianceSimFourPartnerSlots ? 3 : 2;
}

export function allianceSimMaxPicks(partnerSlots: AllianceSimPartnerSlotCount): number {
  return ALLIANCE_SIM_CAPTAINS * partnerSlots;
}

/** @deprecated use allianceSimMaxPicks(2) */
export const ALLIANCE_SIM_TOTAL_PICKS = 16;

export type AllianceSimPick = { captainSlot: number; partnerIndex: number; teamId: number };

function validPartnerIndex(n: unknown, partnerSlots: AllianceSimPartnerSlotCount): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < partnerSlots;
}

/** Normalize DB JSON: new shape, or legacy `{ captainSlot, teamId }[]` (fills up to `partnerSlots` per captain). */
export function normalizePicks(raw: unknown, partnerSlots: AllianceSimPartnerSlotCount = 2): AllianceSimPick[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  const first = raw[0];
  if (first && typeof first === "object" && "partnerIndex" in first) {
    const out: AllianceSimPick[] = [];
    for (const p of raw) {
      if (!p || typeof p !== "object") continue;
      const o = p as Record<string, unknown>;
      const captainSlot = typeof o.captainSlot === "number" ? o.captainSlot : parseInt(String(o.captainSlot), 10);
      const partnerIndex = typeof o.partnerIndex === "number" ? o.partnerIndex : parseInt(String(o.partnerIndex), 10);
      const teamId = typeof o.teamId === "number" ? o.teamId : parseInt(String(o.teamId), 10);
      if (!Number.isFinite(captainSlot) || !Number.isFinite(teamId)) continue;
      if (captainSlot < 1 || captainSlot > ALLIANCE_SIM_CAPTAINS) continue;
      if (!validPartnerIndex(partnerIndex, partnerSlots)) continue;
      out.push({ captainSlot, partnerIndex, teamId });
    }
    return sortPicksCanonical(out);
  }
  const counts = new Map<number, number>();
  const out: AllianceSimPick[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const captainSlot = typeof o.captainSlot === "number" ? o.captainSlot : parseInt(String(o.captainSlot), 10);
    const teamId = typeof o.teamId === "number" ? o.teamId : parseInt(String(o.teamId), 10);
    if (!Number.isFinite(captainSlot) || !Number.isFinite(teamId)) continue;
    if (captainSlot < 1 || captainSlot > ALLIANCE_SIM_CAPTAINS) continue;
    const n = counts.get(captainSlot) ?? 0;
    if (n >= partnerSlots) continue;
    out.push({ captainSlot, partnerIndex: n, teamId });
    counts.set(captainSlot, n + 1);
  }
  return sortPicksCanonical(out);
}

export function sortPicksCanonical(picks: AllianceSimPick[]): AllianceSimPick[] {
  return [...picks].sort((a, b) => a.captainSlot - b.captainSlot || a.partnerIndex - b.partnerIndex);
}

export function picksToMatrix(picks: AllianceSimPick[], partnerSlots: AllianceSimPartnerSlotCount): (number | null)[][] {
  const mat: (number | null)[][] = Array.from({ length: ALLIANCE_SIM_CAPTAINS }, () =>
    Array.from({ length: partnerSlots }, () => null),
  );
  for (const p of picks) {
    if (p.captainSlot < 1 || p.captainSlot > ALLIANCE_SIM_CAPTAINS) continue;
    if (!validPartnerIndex(p.partnerIndex, partnerSlots)) continue;
    mat[p.captainSlot - 1][p.partnerIndex] = p.teamId;
  }
  return mat;
}

export function matrixToPicks(mat: (number | null)[][], partnerSlots: AllianceSimPartnerSlotCount): AllianceSimPick[] {
  const out: AllianceSimPick[] = [];
  for (let i = 0; i < ALLIANCE_SIM_CAPTAINS; i++) {
    for (let p = 0; p < partnerSlots; p++) {
      const t = mat[i]?.[p];
      if (t != null) out.push({ captainSlot: i + 1, partnerIndex: p, teamId: t });
    }
  }
  return sortPicksCanonical(out);
}

/** Tuple length matches partnerSlots (P1, P2, [P3]). */
export function partnersByCaptain(
  picks: AllianceSimPick[],
  partnerSlots: AllianceSimPartnerSlotCount,
): Record<string, (number | null)[]> {
  const mat = picksToMatrix(picks, partnerSlots);
  const rec: Record<string, (number | null)[]> = {};
  for (let i = 0; i < ALLIANCE_SIM_CAPTAINS; i++) {
    rec[String(i + 1)] = mat[i].slice(0, partnerSlots);
  }
  return rec;
}

export function pickedTeamIds(picks: AllianceSimPick[]): Set<number> {
  return new Set(picks.map((p) => p.teamId));
}

/** Returns an error message or null if valid. */
export function validateAllianceSimPicks(
  picks: AllianceSimPick[],
  allowedTeamIds: Set<number>,
  partnerSlots: AllianceSimPartnerSlotCount,
): string | null {
  const max = allianceSimMaxPicks(partnerSlots);
  if (picks.length > max) return `Too many placements (max ${max}).`;
  const seenSlots = new Set<string>();
  const seenTeams = new Set<number>();
  for (const p of picks) {
    if (p.captainSlot < 1 || p.captainSlot > ALLIANCE_SIM_CAPTAINS) return "Invalid captain slot.";
    if (!validPartnerIndex(p.partnerIndex, partnerSlots)) return "Invalid partner index.";
    if (!Number.isFinite(p.teamId)) return "Invalid team id.";
    if (!allowedTeamIds.has(p.teamId)) return "Team is not in this event.";
    const sk = `${p.captainSlot}-${p.partnerIndex}`;
    if (seenSlots.has(sk)) return "Duplicate slot assignment.";
    seenSlots.add(sk);
    if (seenTeams.has(p.teamId)) return "Same team in two slots.";
    seenTeams.add(p.teamId);
  }
  return null;
}

/** Eight strings (captain robot / team number notes), index 0 = captain #1. */
export const ALLIANCE_SIM_CAPTAIN_INPUTS = 8;

export function normalizeCaptainRobots(raw: unknown): string[] {
  const empty = () => Array.from({ length: ALLIANCE_SIM_CAPTAIN_INPUTS }, () => "");
  if (!Array.isArray(raw)) return empty();
  const out = empty();
  for (let i = 0; i < ALLIANCE_SIM_CAPTAIN_INPUTS && i < raw.length; i++) {
    const v = raw[i];
    out[i] = typeof v === "string" ? v.slice(0, 32) : v != null ? String(v).slice(0, 32) : "";
  }
  return out;
}
