import { useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, MessageSquare, AlertCircle, AlertTriangle, BarChart2 } from "lucide-react";
import { RankingColorKey } from "@/components/ranking-color-key";
import { useHelp } from "@/contexts/help-context";
import type { Event, Team, ScoutingEntry, EventTeam } from "@shared/schema";
import { toPct, getHeatColor, getHeatBgOnly, getHeatTextOnly, getHeatBorderOnly, computeTeamStats, computeStatRanges, computeTbaRanges, computeSZR, parseSzrWeights } from "@/lib/team-colors";
import heatmapFieldPath from "@assets/hehehehe_1771897335677.png";
import placeholderAvatar from "@assets/images_1772071870956.png";

function AggregateHeatmap({ entries }: { entries: ScoutingEntry[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldImgRef = useRef<HTMLImageElement | null>(null);

  const allPoints = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (const entry of entries) {
      if (entry.teleopShootPosition) {
        try {
          const parsed = JSON.parse(entry.teleopShootPosition);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              if (typeof p.x === "number" && typeof p.y === "number") {
                pts.push(p);
              }
            }
          }
        } catch {}
      }
    }
    return pts;
  }, [entries]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#e8ebe6";
    ctx.fillRect(0, 0, W, H);
    if (fieldImgRef.current?.complete) {
      const img = fieldImgRef.current;
      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    }

    if (allPoints.length > 0) {
      const radius = 42;
      const grid = 2;
      const intensity: Record<string, number> = {};
      let maxI = 0;
      for (const p of allPoints) {
        const px = p.x * W;
        const py = p.y * H;
        const gx0 = Math.floor(px / grid);
        const gy0 = Math.floor(py / grid);
        const range = Math.ceil(radius / grid);
        for (let dx = -range; dx <= range; dx++) {
          for (let dy = -range; dy <= range; dy++) {
            const cx = (gx0 + dx) * grid + grid / 2;
            const cy = (gy0 + dy) * grid + grid / 2;
            const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
            if (dist < radius) {
              const key = `${gx0 + dx},${gy0 + dy}`;
              const weight = 1 - dist / radius;
              intensity[key] = (intensity[key] || 0) + weight;
              if (intensity[key] > maxI) maxI = intensity[key];
            }
          }
        }
      }

      if (maxI > 0) {
        for (const [key, val] of Object.entries(intensity)) {
          const [gx, gy] = key.split(",").map(Number);
          const norm = val / maxI;
          const alpha = norm * 0.55;
          const t = Math.max(0, Math.min(1, norm));
          let r: number, g: number, b: number;
          if (t < 0.33) {
            const u = t / 0.33;
            r = Math.round(0 + u * 0);
            g = Math.round(0 + u * 255);
            b = Math.round(255 * (1 - u) + 0);
          } else if (t < 0.66) {
            const u = (t - 0.33) / 0.33;
            r = Math.round(0 + u * 255);
            g = 255;
            b = Math.round(0 + u * 0);
          } else {
            const u = (t - 0.66) / 0.34;
            r = 255;
            g = Math.round(255 * (1 - u));
            b = 0;
          }
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fillRect(gx * grid, gy * grid, grid + 1, grid + 1);
        }
      }
    }
  }, [allPoints]);

  useEffect(() => {
    const img = new Image();
    img.src = heatmapFieldPath;
    img.onload = () => { fieldImgRef.current = img; draw(); };
    fieldImgRef.current = img;
  }, []);

  useEffect(() => { draw(); }, [draw]);

  if (allPoints.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 flex items-center justify-center shadow-inner" style={{ aspectRatio: "400/250" }}>
        <p className="text-sm text-muted-foreground">No shooting data yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-inner">
      <canvas
        ref={canvasRef}
        width={400}
        height={250}
        className="w-full block"
        style={{ aspectRatio: "400/250" }}
        data-testid="canvas-aggregate-heatmap"
      />
    </div>
  );
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Extract just the text color class from a heat color string. */
function heatTextOnly(hc: string): string {
  const parts = hc.split(" ").filter(p => p.startsWith("text-"));
  return parts.join(" ") || "text-foreground/60";
}

/** Extract just the bg class from a heat color string. */
function heatBgOnly(hc: string): string {
  const parts = hc.split(" ").filter(p => p.startsWith("bg-"));
  return parts.join(" ") || "bg-muted/30";
}

function getRankColor(rank: number, total: number) {
  if (total === 0) return "text-muted-foreground";
  const norm = 1 - (rank - 1) / Math.max(total - 1, 1);
  const hc = getHeatColor(norm, 0, 1);
  return hc ? heatTextOnly(hc) : "text-muted-foreground";
}

function getRankValueColor(rank: number, total: number) {
  if (total === 0) return "text-foreground/60";
  const norm = 1 - (rank - 1) / Math.max(total - 1, 1);
  const hc = getHeatColor(norm, 0, 1);
  return hc ? heatTextOnly(hc) : "text-foreground/60";
}

function getRankBgColor(rank: number, total: number) {
  if (total === 0) return "bg-muted/30";
  const norm = 1 - (rank - 1) / Math.max(total - 1, 1);
  const hc = getHeatColor(norm, 0, 1);
  return hc ? heatBgOnly(hc) : "bg-muted/30";
}

function MatchBar({ value, maxVal, color, suffix }: {
  value: number;
  maxVal: number;
  color: string;
  suffix?: string;
}) {
  const pct = maxVal > 0 ? Math.max((value / maxVal) * 100, 2) : 2;
  return (
    <div className="flex items-center gap-0.5 min-w-0 flex-1">
      <div className="flex-1 h-4 bg-muted/40 rounded-sm overflow-hidden">
        <div className={`h-full rounded-sm ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-muted-foreground w-7 text-right shrink-0">{value}{suffix || ""}</span>
    </div>
  );
}

function PerMatchChart({ entries, title, bars }: {
  entries: ScoutingEntry[];
  title: string;
  bars: { field: (e: ScoutingEntry) => number; color: string; label: string; max?: number; suffix?: string }[];
}) {
  const sorted = [...entries].sort((a, b) => b.matchNumber - a.matchNumber);
  if (sorted.length === 0) return null;

  const maxVals = bars.map(b => {
    if (b.max !== undefined) return b.max;
    return Math.max(...sorted.map(e => b.field(e)), 1);
  });

  const gridClass = bars.length === 4 ? "grid grid-cols-4 gap-2" : bars.length === 3 ? "grid grid-cols-3 gap-3" : bars.length === 2 ? "grid grid-cols-2 gap-3" : "flex";

  return (
    <div className="space-y-1.5" data-testid={`chart-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            <span className="text-xs font-bold w-7 shrink-0 text-muted-foreground">M{entry.matchNumber}</span>
            <div className={`flex-1 ${gridClass}`}>
              {bars.map((b, i) => (
                <MatchBar
                  key={i}
                  value={b.field(entry)}
                  maxVal={maxVals[i]}
                  color={b.color}
                  suffix={b.suffix}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClimbChart({ entries }: { entries: ScoutingEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.matchNumber - a.matchNumber);
  if (sorted.length === 0) return null;

  return (
    <div className="space-y-1.5" data-testid="chart-climb">
      <div className="space-y-1">
        {sorted.map((entry) => {
          const isSuccess = entry.climbSuccess === "success";
          const isFailed = entry.climbSuccess === "failed";
          const bgColor = isSuccess ? "bg-green-500" : isFailed ? "bg-red-400" : "bg-muted-foreground/30";
          const label = isSuccess ? `L${entry.climbLevel || "?"}` : isFailed ? "Failed" : "None";
          const width = isSuccess ? "100%" : isFailed ? "50%" : "15%";

          return (
            <div key={entry.id} className="flex items-center gap-2">
              <span className="text-xs font-bold w-7 shrink-0 text-muted-foreground">M{entry.matchNumber}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-5 bg-muted/40 rounded-sm overflow-hidden">
                  <div className={`h-full rounded-sm ${bgColor}`} style={{ width }} />
                </div>
                <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${isSuccess ? "text-green-600 dark:text-green-400" : isFailed ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AutoClimbChart({ entries }: { entries: ScoutingEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.matchNumber - a.matchNumber);
  if (sorted.length === 0) return null;

  return (
    <div className="space-y-1.5" data-testid="chart-auto-climb">
      <div className="space-y-1">
        {sorted.map((entry) => {
          const isSuccess = entry.autoClimbSuccess === "success";
          const isFailed = entry.autoClimbSuccess === "failed";
          const bgColor = isSuccess ? "bg-green-500" : isFailed ? "bg-red-400" : "bg-muted-foreground/30";
          const label = isSuccess ? `L${entry.autoClimbLevel || "?"}` : isFailed ? "Failed" : "None";
          const width = isSuccess ? "100%" : isFailed ? "50%" : "15%";

          return (
            <div key={entry.id} className="flex items-center gap-2">
              <span className="text-xs font-bold w-7 shrink-0 text-muted-foreground">M{entry.matchNumber}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-5 bg-muted/40 rounded-sm overflow-hidden">
                  <div className={`h-full rounded-sm ${bgColor}`} style={{ width }} />
                </div>
                <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${isSuccess ? "text-green-600 dark:text-green-400" : isFailed ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default function TeamProfile() {
  const { id: eid, teamId: tid } = useParams<{ id: string; teamId: string }>();
  const [, setLocation] = useLocation();
  const eventId = parseInt(eid!);
  const teamId = parseInt(tid!);
  const returnTo = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("returnTo") : null;
  const help = useHelp();

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: entries, isLoading } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "teams", teamId, "entries"],
  });

  const { data: allEntries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const team = teams?.find((t) => t.id === teamId);
  const eventTeam = eventTeams?.find(et => et.teamId === teamId);
  const tbaOpr = (eventTeam as any)?.opr;
  const tbaSeed = (eventTeam as any)?.rank;
  const tbaRecord = eventTeam ? `${(eventTeam as any)?.wins ?? 0}-${(eventTeam as any)?.losses ?? 0}-${(eventTeam as any)?.ties ?? 0}` : null;

  const hasTbaForTeam = tbaOpr != null || tbaSeed != null;
  const hasScoutingForTeam = (entries?.length ?? 0) > 0;
  const showNoTbaIcon = !hasTbaForTeam;
  const showNoScoutingIcon = !hasScoutingForTeam;

  const hasEntries = (entries?.length ?? 0) > 0;
  const avgAutoBalls = hasEntries
    ? parseFloat((entries!.reduce((s, e) => s + e.autoBallsShot, 0) / entries!.length).toFixed(1)).toString()
    : "0";
  const autoAccEntries = entries?.filter((e) => (e.autoBallsShot ?? 0) >= 1) ?? [];
  const hasThroughput = entries?.some((e) => (e.teleopFpsEstimate ?? 0) > 0) ?? false;
  const hasDefense = entries?.some((e) => e.playedDefense) ?? false;
  const hasDriverSkill = entries?.some((e) => e.driverSkill != null) ?? false;
  const hasClimbAttempted = entries?.some((e) => e.climbSuccess === "success" || e.climbSuccess === "failed") ?? false;
  const hasAutoClimbAttempted = entries?.some((e) => e.autoClimbSuccess === "success" || e.autoClimbSuccess === "failed") ?? false;
  const avgAutoAccuracy = autoAccEntries.length > 0
    ? Math.round(autoAccEntries.reduce((s, e) => s + toPct(e.autoAccuracy ?? 0), 0) / autoAccEntries.length)
    : 0;
  const avgThroughput = hasEntries
    ? parseFloat((entries!.reduce((s, e) => s + e.teleopFpsEstimate, 0) / entries!.length).toFixed(1)).toString()
    : "0";
  const avgAccuracy = hasEntries
    ? Math.round(entries!.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0) / entries!.length)
    : 0;
  const avgDefense = hasEntries
    ? Math.round(entries!.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / entries!.length)
    : 0;
  const avgDriverSkill = hasEntries
    ? Math.round(entries!.reduce((s, e) => s + toPct(e.driverSkill ?? 0), 0) / entries!.length)
    : 0;
  const climbRate = hasEntries
    ? Math.round((entries!.filter((e) => e.climbSuccess === "success").length / entries!.length) * 100)
    : 0;
  const climbSuccessEntries = entries?.filter((e) => e.climbSuccess === "success") ?? [];
  const climbL1Rate = hasEntries
    ? Math.round((climbSuccessEntries.filter((e) => e.climbLevel === "1").length / entries!.length) * 100)
    : 0;
  const climbL2Rate = hasEntries
    ? Math.round((climbSuccessEntries.filter((e) => e.climbLevel === "2").length / entries!.length) * 100)
    : 0;
  const climbL3Rate = hasEntries
    ? Math.round((climbSuccessEntries.filter((e) => e.climbLevel === "3").length / entries!.length) * 100)
    : 0;
  const autoClimbRate = hasEntries
    ? Math.round((entries!.filter((e) => e.autoClimbSuccess === "success").length / entries!.length) * 100)
    : 0;

  const EMPTY = "—";
  const dispAutoBalls = hasEntries ? avgAutoBalls : EMPTY;
  const dispAutoAccuracy = autoAccEntries.length > 0 ? `${avgAutoAccuracy}%` : EMPTY;
  const dispThroughput = hasEntries && hasThroughput ? avgThroughput : EMPTY;
  const dispAccuracy = hasEntries ? `${avgAccuracy}%` : EMPTY;
  const dispDefense = hasEntries && hasDefense ? `${avgDefense}%` : EMPTY;
  const dispDriverSkill = hasEntries && hasDriverSkill ? `${avgDriverSkill}%` : EMPTY;
  const dispClimbRate = hasEntries && hasClimbAttempted ? `${climbRate}%` : EMPTY;
  const dispClimbL1 = hasEntries && hasClimbAttempted ? `${climbL1Rate}%` : EMPTY;
  const dispClimbL2 = hasEntries && hasClimbAttempted ? `${climbL2Rate}%` : EMPTY;
  const dispClimbL3 = hasEntries && hasClimbAttempted ? `${climbL3Rate}%` : EMPTY;
  const dispAutoClimbRate = hasEntries && hasAutoClimbAttempted ? `${autoClimbRate}%` : EMPTY;

  const teamsList = useMemo(() => (eventTeams || []).map(et => et.team), [eventTeams]);
  const teamStatsMap = useMemo(() => computeTeamStats(teamsList, allEntries || []), [teamsList, allEntries]);
  const szrStatRanges = useMemo(() => computeStatRanges(teamStatsMap), [teamStatsMap]);
  const szrWeights = useMemo(() => parseSzrWeights(event?.szrWeights), [event?.szrWeights]);
  const szr = useMemo(() => {
    if (!teamId) return 0;
    const stats = teamStatsMap.get(teamId);
    const computed = stats ? computeSZR(stats, szrStatRanges, szrWeights) : null;
    return computed ?? 0;
  }, [teamId, teamStatsMap, szrStatRanges, szrWeights]);

  const rankings = useMemo(() => {
    if (!allEntries || !eventTeams) return null;

    const teamIds = eventTeams.map(et => et.teamId);
    const statsMap = new Map<number, {
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
      avgClimbLevel: number;
      autoClimbRate: number;
      avgAutoClimbLevel: number;
    }>();

    for (const tid of teamIds) {
      const te = allEntries.filter(e => e.teamId === tid);
      const count = te.length;
      if (count === 0) {
        statsMap.set(tid, { avgAuto: 0, avgAutoAccuracy: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, avgDriverSkill: 0, climbRate: 0, climbL1Rate: 0, climbL2Rate: 0, climbL3Rate: 0, avgClimbLevel: 0, autoClimbRate: 0, avgAutoClimbLevel: 0 });
      } else {
        const climbs = te.filter(e => e.climbSuccess === "success");
        const autoClimbs = te.filter(e => e.autoClimbSuccess === "success");
        const autoAccTe = te.filter(e => (e.autoBallsShot ?? 0) >= 1);
        const avgAutoAcc = autoAccTe.length > 0
          ? autoAccTe.reduce((s, e) => s + toPct(e.autoAccuracy ?? 0), 0) / autoAccTe.length
          : 0;
        statsMap.set(tid, {
          avgAuto: te.reduce((s, e) => s + e.autoBallsShot, 0) / count,
          avgAutoAccuracy: avgAutoAcc,
          avgThroughput: te.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count,
          avgAccuracy: te.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0) / count,
          avgDefense: te.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / count,
          avgDriverSkill: te.reduce((s, e) => s + toPct(e.driverSkill ?? 0), 0) / count,
          climbRate: climbs.length / count * 100,
          climbL1Rate: climbs.filter(e => e.climbLevel === "1").length / count * 100,
          climbL2Rate: climbs.filter(e => e.climbLevel === "2").length / count * 100,
          climbL3Rate: climbs.filter(e => e.climbLevel === "3").length / count * 100,
          avgClimbLevel: climbs.length > 0 ? climbs.reduce((s, e) => s + (parseInt(e.climbLevel || "0") || 0), 0) / climbs.length : 0,
          autoClimbRate: autoClimbs.length / count * 100,
          avgAutoClimbLevel: autoClimbs.length > 0 ? autoClimbs.reduce((s, e) => s + (parseInt(e.autoClimbLevel || "0") || 0), 0) / autoClimbs.length : 0,
        });
      }
    }

    const total = teamIds.length;
    const autoClimbRates = Array.from(statsMap.values()).map(s => s.autoClimbRate);
    const autoClimbRange = autoClimbRates.length > 0
      ? { min: Math.min(...autoClimbRates), max: Math.max(...autoClimbRates) }
      : { min: 0, max: 100 };

    function getRank(field: string) {
      const sorted = [...teamIds].sort((a, b) => {
        const sa = statsMap.get(a) as any;
        const sb = statsMap.get(b) as any;
        if (field === "climbRate") {
          const diff = (sb?.climbRate || 0) - (sa?.climbRate || 0);
          if (diff !== 0) return diff;
          return (sb?.avgClimbLevel || 0) - (sa?.avgClimbLevel || 0);
        }
        if (field === "autoClimbRate") {
          const diff = (sb?.autoClimbRate || 0) - (sa?.autoClimbRate || 0);
          if (diff !== 0) return diff;
          return (sb?.avgAutoClimbLevel || 0) - (sa?.avgAutoClimbLevel || 0);
        }
        return (sb?.[field] || 0) - (sa?.[field] || 0);
      });
      return sorted.indexOf(teamId) + 1;
    }

    return {
      total,
      autoClimbRange,
      autoRank: getRank("avgAuto"),
      autoAccuracyRank: getRank("avgAutoAccuracy"),
      throughputRank: getRank("avgThroughput"),
      accuracyRank: getRank("avgAccuracy"),
      defenseRank: getRank("avgDefense"),
      driverSkillRank: getRank("avgDriverSkill"),
      climbRank: getRank("climbRate"),
      climbL1Rank: getRank("climbL1Rate"),
      climbL2Rank: getRank("climbL2Rate"),
      climbL3Rank: getRank("climbL3Rate"),
      autoClimbRank: getRank("autoClimbRate"),
    };
  }, [allEntries, eventTeams, teamId]);

  const allTeams = useMemo(() => (eventTeams || []).map(et => et.team), [eventTeams]);
  const allTeamStats = useMemo(() => computeTeamStats(allTeams, allEntries || []), [allTeams, allEntries]);
  const statRanges = useMemo(() => computeStatRanges(allTeamStats), [allTeamStats]);
  const tbaRanges = useMemo(() => computeTbaRanges(eventTeams || []), [eventTeams]);
  const thisTeamStats = allTeamStats.get(teamId);

  const tbaStatHeat = useMemo(() => {
    const wins = (eventTeam as any)?.wins ?? 0;
    const losses = (eventTeam as any)?.losses ?? 0;
    const ties = (eventTeam as any)?.ties ?? 0;
    const total = wins + losses + ties;
    const winRate = total > 0 ? (wins / total) * 100 : 0;

    const winRates = (eventTeams || []).map(et => {
      const w = (et as any)?.wins ?? 0;
      const l = (et as any)?.losses ?? 0;
      const t = (et as any)?.ties ?? 0;
      const tot = w + l + t;
      return tot > 0 ? (w / tot) * 100 : 0;
    });
    const winRateMin = winRates.length > 0 ? Math.min(...winRates) : 0;
    const winRateMax = winRates.length > 0 ? Math.max(...winRates) : 100;

    const heatInv = (fn: (v: number, a: number, b: number) => string) =>
      (value: number, min: number, max: number) => fn(max - value + min, min, max);

    return {
      szr: szr > 0 ? { bg: getHeatBgOnly(szr, 0, 100), text: getHeatTextOnly(szr, 0, 100), border: getHeatBorderOnly(szr, 0, 100) } : { bg: "", text: "", border: "" },
      seed: tbaSeed != null && tbaRanges?.seed
        ? { bg: heatInv(getHeatBgOnly)(tbaSeed, tbaRanges.seed.min, tbaRanges.seed.max), text: heatInv(getHeatTextOnly)(tbaSeed, tbaRanges.seed.min, tbaRanges.seed.max), border: heatInv(getHeatBorderOnly)(tbaSeed, tbaRanges.seed.min, tbaRanges.seed.max) }
        : { bg: "", text: "", border: "" },
      opr: tbaOpr != null && tbaRanges?.opr ? { bg: getHeatBgOnly(tbaOpr, tbaRanges.opr.min, tbaRanges.opr.max), text: getHeatTextOnly(tbaOpr, tbaRanges.opr.min, tbaRanges.opr.max), border: getHeatBorderOnly(tbaOpr, tbaRanges.opr.min, tbaRanges.opr.max) } : { bg: "", text: "", border: "" },
      record: total > 0 ? { bg: getHeatBgOnly(winRate, winRateMin, winRateMax || 1), text: getHeatTextOnly(winRate, winRateMin, winRateMax || 1), border: getHeatBorderOnly(winRate, winRateMin, winRateMax || 1) } : { bg: "", text: "", border: "" },
    };
  }, [eventTeam, eventTeams, tbaOpr, tbaSeed, tbaRanges, szr]);

  const heatColors = useMemo(() => {
    if (!thisTeamStats || !statRanges) return { auto: "", autoAccuracy: "", throughput: "", accuracy: "", defense: "", driverSkill: "", climb: "", climbL1: "", climbL2: "", climbL3: "" };
    const s = thisTeamStats;
    const r = statRanges;
    return {
      auto: getHeatColor(s.avgAuto, r.auto.min, r.auto.max),
      autoAccuracy: s.avgAutoAccuracy > 0 ? getHeatColor(s.avgAutoAccuracy, r.autoAccuracy.min, r.autoAccuracy.max) : "",
      throughput: getHeatColor(s.avgThroughput, r.throughput.min, r.throughput.max),
      accuracy: getHeatColor(s.avgAccuracy, r.accuracy.min, r.accuracy.max),
      defense: getHeatColor(s.avgDefense, r.defense.min, r.defense.max),
      driverSkill: getHeatColor(s.avgDriverSkill, r.driverSkill.min, r.driverSkill.max),
      climb: getHeatColor(s.climbRate, r.climb.min, r.climb.max),
      climbL1: getHeatColor(s.climbL1Rate, r.climbL1.min, r.climbL1.max),
      climbL2: getHeatColor(s.climbL2Rate, r.climbL2.min, r.climbL2.max),
      climbL3: getHeatColor(s.climbL3Rate, r.climbL3.min, r.climbL3.max),
    };
  }, [thisTeamStats, statRanges]);

  const last2 = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    return [...entries].sort((a, b) => b.matchNumber - a.matchNumber).slice(0, 2);
  }, [entries]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Link href={returnTo ?? `/events/${eventId}/teams`}>
            <Button variant="ghost" size="sm" data-testid="button-back-event">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {returnTo ? "Back to Match" : "Back to Teams"}
            </Button>
          </Link>
          <Link href={`/events/${eventId}/teams/${teamId}/compare`}>
            <Button variant="outline" size="sm" data-testid="button-compare-stats">
              <BarChart2 className="h-4 w-4 mr-1" />
              Compare Stats
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {team ? (
            <img src={team.avatar || placeholderAvatar} alt={`Team ${team.teamNumber}`} className="w-12 h-12 rounded-lg border border-border object-cover bg-white" data-testid="img-team-avatar" />
          ) : null}
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-team-name">
              {team ? `${team.teamNumber} - ${team.teamName}` : <Skeleton className="h-9 w-56 inline-block" />}
              {help?.HelpTrigger?.({
                content: {
                  title: "Team profile",
                  body: <p>Stats from your scouting data: auto, throughput, accuracy, defense, climb. Compare with other teams or view notes.</p>,
                },
              })}
              {showNoTbaIcon && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex shrink-0 cursor-help">
                      <AlertCircle className="h-6 w-6 text-blue-500 dark:text-blue-400" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>No Blue Alliance (TBA) data yet</TooltipContent>
                </Tooltip>
              )}
              {showNoScoutingIcon && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex shrink-0 cursor-help">
                      <AlertTriangle className="h-6 w-6 text-amber-500 dark:text-amber-400" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>No scouting data yet</TooltipContent>
                </Tooltip>
              )}
            </h1>
            {event && (
              <p className="text-base text-muted-foreground mt-1">{event.name}</p>
            )}
            <RankingColorKey className="mt-2" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3" data-testid="tba-stats-bar">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 cursor-help ${tbaStatHeat.szr.border || "border-border"} ${tbaStatHeat.szr.bg || "bg-card"}`} data-testid="szr-badge">
                  <span className={`text-xs font-medium uppercase ${tbaStatHeat.szr.text || "text-muted-foreground"}`}>SZR</span>
                  <span className={`text-lg font-extrabold ${tbaStatHeat.szr.text || "text-foreground"}`}>{szr}</span>
                </div>
              </TooltipTrigger>
                <TooltipContent>Strike Zone Rating — scouting-derived team strength (0–100)</TooltipContent>
              </Tooltip>
            {tbaSeed != null && (
              <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${tbaStatHeat.seed.border || "border-border"} ${tbaStatHeat.seed.bg || "bg-card"}`}>
                <span className={`text-xs font-medium uppercase ${tbaStatHeat.seed.text || "text-muted-foreground"}`}>Seed</span>
                <span className={`text-lg font-extrabold ${tbaStatHeat.seed.text || "text-foreground"}`}>#{tbaSeed}</span>
              </div>
            )}
            {tbaOpr != null && (
              <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${tbaStatHeat.opr.border || "border-border"} ${tbaStatHeat.opr.bg || "bg-card"}`}>
                <span className={`text-xs font-medium uppercase ${tbaStatHeat.opr.text || "text-muted-foreground"}`}>OPR</span>
                <span className={`text-lg font-extrabold ${tbaStatHeat.opr.text || "text-foreground"}`}>{tbaOpr.toFixed(1)}</span>
              </div>
            )}
            {tbaRecord && tbaRecord !== "0-0-0" && (
              <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${tbaStatHeat.record.border || "border-border"} ${tbaStatHeat.record.bg || "bg-card"}`}>
                <span className={`text-xs font-medium uppercase ${tbaStatHeat.record.text || "text-muted-foreground"}`}>Record</span>
                <span className={`text-lg font-extrabold ${tbaStatHeat.record.text || "text-foreground"}`}>{tbaRecord}</span>
              </div>
            )}
          </div>
      </div>

      {entries && entries.length > 0 && (() => {
        const noteCols = [
          {
            label: "Auto",
            color: "text-primary",
            borderColor: "border-primary/30",
            bgColor: "bg-primary/5",
            notes: entries.map(e => ({ match: e.matchNumber, text: e.autoNotes })).filter(n => n.text),
          },
          {
            label: "Teleop & Defense",
            color: "text-chart-2",
            borderColor: "border-chart-2/30",
            bgColor: "bg-chart-2/5",
            notes: entries.map(e => ({
              match: e.matchNumber,
              text: [
                e.driverSkillNotes ? `[Driver] ${e.driverSkillNotes}` : "",
                e.defenseNotes ? `[Defense] ${e.defenseNotes}` : "",
              ].filter(Boolean).join("\n"),
            })).filter(n => n.text),
          },
          {
            label: "Misc.",
            color: "text-chart-5",
            borderColor: "border-chart-5/30",
            bgColor: "bg-chart-5/5",
            notes: entries.map(e => ({ match: e.matchNumber, text: e.notes })).filter(n => n.text),
          },
        ];
        const hasAny = noteCols.some(c => c.notes.length > 0);
        if (!hasAny) return null;
        return (
          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Scout Notes
            </h2>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              {noteCols.map(col => {
                const recent = [...col.notes].sort((a, b) => b.match - a.match).slice(0, 2);
                return (
                  <Card key={col.label} className={`border-t-4 ${col.borderColor}`}>
                    <CardHeader className="pb-1 pt-3 px-4">
                      <CardTitle className={`text-sm font-bold ${col.color} text-center`}>{col.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      {recent.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No notes</p>
                      ) : (
                        <div className="space-y-1.5">
                          {recent.map((n, i) => (
                            <div key={i} className={`rounded px-2.5 py-1.5 ${col.bgColor}`}>
                              <span className={`text-xs font-bold ${col.color}`}>M{n.match}</span>
                              <p className="text-sm mt-0.5 whitespace-pre-line">{n.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Link href={`/events/${eventId}/teams/${teamId}/notes`}>
              <Button variant="outline" size="sm" className="w-full" data-testid="button-view-all-notes">
                View All Notes
              </Button>
            </Link>
          </div>
        );
      })()}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
        <Card className="sm:col-span-1 border-t-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-primary text-center">Auto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Balls Shot</p>
              <div className={`inline-block rounded-lg px-3 py-1.5 ${heatColors.auto || "bg-muted/30"}`}>
                <p className={`text-4xl font-extrabold leading-none ${dispAutoBalls === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-auto">{dispAutoBalls}</p>
              </div>
              {rankings && (
                <>
                  <div className="w-8 mx-auto border-t border-border" />
                  <p className={`text-xs font-bold ${heatTextOnly(heatColors.auto) || "text-muted-foreground"}`}>{getOrdinal(rankings.autoRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                </>
              )}
            </div>
            {autoAccEntries.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide text-center">Auto accuracy</p>
                <div className="text-center space-y-2">
                  <div className={`inline-block rounded-lg px-3 py-1.5 ${heatColors.autoAccuracy || "bg-muted/30"}`}>
                    <p className={`text-3xl font-extrabold leading-none ${dispAutoAccuracy === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-auto-accuracy">{dispAutoAccuracy}</p>
                  </div>
                  {rankings && (
                    <>
                      <div className="w-8 mx-auto border-t border-border" />
                      <p className={`text-xs font-bold ${heatTextOnly(heatColors.autoAccuracy) || "text-muted-foreground"}`}>{getOrdinal(rankings.autoAccuracyRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide text-center">Auto climb</p>
              <div className="text-center space-y-2">
                <div className={`inline-block rounded-lg px-3 py-1.5 ${rankings ? (getHeatColor(autoClimbRate, rankings.autoClimbRange.min, rankings.autoClimbRange.max) || "bg-muted/30") : "bg-muted/30"}`}>
                  <p className={`text-3xl font-extrabold leading-none ${dispAutoClimbRate === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-auto-climb-rate">{dispAutoClimbRate}</p>
                </div>

                {rankings && (
                  <>
                    <div className="w-8 mx-auto border-t border-border" />
                    <p className={`text-xs font-bold ${rankings ? (heatTextOnly(getHeatColor(autoClimbRate, rankings.autoClimbRange.min, rankings.autoClimbRange.max)) || "text-muted-foreground") : "text-muted-foreground"}`}>{getOrdinal(rankings.autoClimbRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                  </>
                )}
              </div>
            </div>
            {entries && entries.length > 1 && (
              <PerMatchChart
                entries={entries}
                title="Auto"
                bars={
                  autoAccEntries.length > 0
                    ? [
                        { field: (e) => e.autoBallsShot, color: "bg-primary", label: "Balls" },
                        { field: (e) => (e.autoBallsShot ?? 0) >= 1 ? toPct(e.autoAccuracy ?? 0) : 0, color: "bg-primary/70", label: "Auto Acc%", max: 100, suffix: "%" },
                      ]
                    : [{ field: (e) => e.autoBallsShot, color: "bg-primary", label: "Balls" }]
                }
              />
            )}
            {entries && entries.length > 1 && (
              <AutoClimbChart entries={entries} />
            )}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 border-t-4 border-chart-2/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-chart-2 text-center">Teleop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Throughput</p>
                <div className={`inline-block rounded-lg px-2 py-1.5 ${heatColors.throughput || "bg-muted/30"}`}>
                  <p className={`text-3xl font-extrabold leading-none ${dispThroughput === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-throughput">{dispThroughput}</p>
                </div>
                {rankings && (
                  <>
                    <div className="w-8 mx-auto border-t border-border" />
                    <p className={`text-xs font-bold ${heatTextOnly(heatColors.throughput) || "text-muted-foreground"}`}>{getOrdinal(rankings.throughputRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                  </>
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Accuracy</p>
                <div className={`inline-block rounded-lg px-2 py-1.5 ${heatColors.accuracy || "bg-muted/30"}`}>
                  <p className={`text-3xl font-extrabold leading-none ${dispAccuracy === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-accuracy">{dispAccuracy}</p>
                </div>
                {rankings && (
                  <>
                    <div className="w-8 mx-auto border-t border-border" />
                    <p className={`text-xs font-bold ${heatTextOnly(heatColors.accuracy) || "text-muted-foreground"}`}>{getOrdinal(rankings.accuracyRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                  </>
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Defense</p>
                <div className={`inline-block rounded-lg px-2 py-1.5 ${heatColors.defense || "bg-muted/30"}`}>
                  <p className={`text-3xl font-extrabold leading-none ${dispDefense === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-defense">{dispDefense}</p>
                </div>
                {rankings && (
                  <>
                    <div className="w-8 mx-auto border-t border-border" />
                    <p className={`text-xs font-bold ${heatTextOnly(heatColors.defense) || "text-muted-foreground"}`}>{getOrdinal(rankings.defenseRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                  </>
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Driver skill</p>
                <div className={`inline-block rounded-lg px-2 py-1.5 ${heatColors.driverSkill || "bg-muted/30"}`}>
                  <p className={`text-3xl font-extrabold leading-none ${dispDriverSkill === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-driver-skill">{dispDriverSkill}</p>
                </div>
                {rankings && (
                  <>
                    <div className="w-8 mx-auto border-t border-border" />
                    <p className={`text-xs font-bold ${heatTextOnly(heatColors.driverSkill) || "text-muted-foreground"}`}>{getOrdinal(rankings.driverSkillRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                  </>
                )}
              </div>
            </div>
            {entries && entries.length > 1 && (
              <PerMatchChart
                entries={entries}
                title="Teleop"
                bars={[
                  { field: (e) => e.teleopFpsEstimate, color: "bg-chart-2", label: "FPS" },
                  { field: (e) => toPct(e.teleopAccuracy ?? 0), color: "bg-chart-3", label: "Acc%", max: 100, suffix: "%" },
                  { field: (e) => toPct(e.defenseRating ?? 0), color: "bg-chart-4", label: "Def%", max: 100, suffix: "%" },
                  { field: (e) => toPct(e.driverSkill ?? 0), color: "bg-chart-5", label: "Driver%", max: 100, suffix: "%" },
                ]}
              />
            )}
            <div>
              <p className="text-sm font-medium text-foreground/70 text-center mb-2">Shooting Heatmap</p>
              <AggregateHeatmap entries={entries || []} />
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-1 border-t-4 border-chart-5/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-chart-5 text-center">Endgame</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Climb Rate</p>
              <div className={`inline-block rounded-lg px-3 py-1.5 ${heatColors.climb || "bg-muted/30"}`}>
                <p className={`text-4xl font-extrabold leading-none ${dispClimbRate === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-climb-rate">{dispClimbRate}</p>
              </div>
              {rankings && (
                <>
                  <div className="w-8 mx-auto border-t border-border" />
                  <p className={`text-xs font-bold ${heatTextOnly(heatColors.climb) || "text-muted-foreground"}`}>{getOrdinal(rankings.climbRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                </>
              )}
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide text-center">By level</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">L1</p>
                  <div className={`rounded-lg px-2 py-1 ${heatColors.climbL1 || "bg-muted/30"}`}>
                    <p className={`text-lg font-bold leading-none ${dispClimbL1 === EMPTY ? "text-muted-foreground/40" : ""}`}>{dispClimbL1}</p>
                  </div>
                  {rankings && <p className={`text-[10px] ${heatTextOnly(heatColors.climbL1) || "text-muted-foreground"}`}>{getOrdinal(rankings.climbL1Rank)}/{rankings.total}</p>}
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">L2</p>
                  <div className={`rounded-lg px-2 py-1 ${heatColors.climbL2 || "bg-muted/30"}`}>
                    <p className={`text-lg font-bold leading-none ${dispClimbL2 === EMPTY ? "text-muted-foreground/40" : ""}`}>{dispClimbL2}</p>
                  </div>
                  {rankings && <p className={`text-[10px] ${heatTextOnly(heatColors.climbL2) || "text-muted-foreground"}`}>{getOrdinal(rankings.climbL2Rank)}/{rankings.total}</p>}
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">L3</p>
                  <div className={`rounded-lg px-2 py-1 ${heatColors.climbL3 || "bg-muted/30"}`}>
                    <p className={`text-lg font-bold leading-none ${dispClimbL3 === EMPTY ? "text-muted-foreground/40" : ""}`}>{dispClimbL3}</p>
                  </div>
                  {rankings && <p className={`text-[10px] ${heatTextOnly(heatColors.climbL3) || "text-muted-foreground"}`}>{getOrdinal(rankings.climbL3Rank)}/{rankings.total}</p>}
                </div>
              </div>
            </div>
            {entries && entries.length > 1 && (
              <ClimbChart entries={entries} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold">Match History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : entries?.length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-6">
              No scouting entries for this team yet.
            </p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-bold">Match</TableHead>
                    <TableHead className="text-center text-sm font-bold">Auto</TableHead>
                    <TableHead className="text-center text-sm font-bold">Auto Acc</TableHead>
                    <TableHead className="text-center text-sm font-bold">Auto climb</TableHead>
                    <TableHead className="text-center text-sm font-bold">Throughput</TableHead>
                    <TableHead className="text-center text-sm font-bold">Accuracy</TableHead>
                    <TableHead className="text-center text-sm font-bold">Driver</TableHead>
                    <TableHead className="text-center text-sm font-bold">Climb</TableHead>
                    <TableHead className="text-center text-sm font-bold">Defense</TableHead>
                    <TableHead className="text-sm font-bold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries
                    ?.sort((a, b) => a.matchNumber - b.matchNumber)
                    .map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                        <TableCell className="font-bold text-base">
                          M{entry.matchNumber}
                        </TableCell>
                        <TableCell className={`text-center text-base font-semibold ${statRanges ? getHeatColor(entry.autoBallsShot, statRanges.auto.min, statRanges.auto.max) : ""}`}>{entry.autoBallsShot}</TableCell>
                        <TableCell className={`text-center text-base font-semibold ${(entry.autoBallsShot ?? 0) >= 1 && entry.autoAccuracy != null && statRanges?.autoAccuracy ? getHeatColor(toPct(entry.autoAccuracy), statRanges.autoAccuracy.min, statRanges.autoAccuracy.max) : ""}`}>
                          {(entry.autoBallsShot ?? 0) >= 1 && entry.autoAccuracy != null ? `${toPct(entry.autoAccuracy)}%` : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={entry.autoClimbSuccess === "success" ? "default" : "secondary"}
                            className={`text-sm font-semibold ${entry.autoClimbSuccess === "success" ? "bg-green-600 text-white" : entry.autoClimbSuccess === "failed" ? "bg-red-500/15 text-red-500" : ""}`}
                          >
                            {entry.autoClimbSuccess === "success" ? "Yes" : entry.autoClimbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-center text-base font-semibold ${statRanges ? getHeatColor(entry.teleopFpsEstimate, statRanges.throughput.min, statRanges.throughput.max) : ""}`}>{entry.teleopFpsEstimate}</TableCell>
                        <TableCell className={`text-center text-base font-semibold ${statRanges ? getHeatColor(toPct(entry.teleopAccuracy ?? 0), statRanges.accuracy.min, statRanges.accuracy.max) : ""}`}>{toPct(entry.teleopAccuracy ?? 0)}<span className="text-xs">%</span></TableCell>
                        <TableCell className={`text-center text-base font-semibold ${entry.driverSkill != null && statRanges?.driverSkill ? getHeatColor(toPct(entry.driverSkill), statRanges.driverSkill.min, statRanges.driverSkill.max) : ""}`}>
                          {entry.driverSkill != null ? <>{toPct(entry.driverSkill)}<span className="text-xs">%</span></> : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={entry.climbSuccess === "success" ? "default" : "secondary"}
                            className={`text-sm font-semibold ${entry.climbSuccess === "success" ? "bg-green-600 text-white" : entry.climbSuccess === "failed" ? "bg-red-500/15 text-red-500" : ""}`}
                          >
                            {entry.climbSuccess === "success" ? `L${entry.climbLevel || "?"}` : entry.climbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-center text-base font-semibold ${entry.playedDefense && statRanges ? getHeatColor(toPct(entry.defenseRating ?? 0), statRanges.defense.min, statRanges.defense.max) : ""}`}>
                          {entry.playedDefense ? <>{toPct(entry.defenseRating ?? 0)}<span className="text-xs">%</span></> : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm">
                          {entry.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
