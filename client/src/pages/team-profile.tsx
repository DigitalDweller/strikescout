import { useMemo, useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, MessageSquare, AlertCircle, AlertTriangle, BarChart2, Pencil } from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { useAuth } from "@/hooks/use-auth";
import type { Event, Team, ScoutingEntry, EventTeam, PitScoutingEntry } from "@shared/schema";
import { toPct, getHeatColor, getSeedHeatColor, computeTeamStats, computeStatRanges, computeStatRangesForSzr, computeTbaRanges, computeSZR, computeSzrMapWithSweepBonus, parseSzrWeights } from "@/lib/team-colors";
import heatmapFieldPath from "@assets/heatmap-field.png";
import placeholderAvatar from "@assets/images_1772071870956.png";

/** Canvas resolution; aspect ratio preserved via CSS. */
const HEATMAP_W = 960;
const HEATMAP_H = 480;

function AggregateHeatmap({ entries, width = HEATMAP_W, height = HEATMAP_H }: { entries: ScoutingEntry[]; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldImgRef = useRef<HTMLImageElement | null>(null);
  const [mutedFill, setMutedFill] = useState("hsl(0 0% 92%)");

  useEffect(() => {
    const m = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
    if (m) setMutedFill(`hsl(${m})`);
  }, []);

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
    ctx.fillStyle = mutedFill;
    ctx.fillRect(0, 0, W, H);
    const fieldImg = fieldImgRef.current;
    if (fieldImg?.complete && fieldImg.naturalWidth > 0) {
      const img = fieldImg;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      // Cover the canvas (no letterboxing) when image aspect ≠ canvas aspect.
      const scale = Math.max(W / nw, H / nh);
      const dw = nw * scale;
      const dh = nh * scale;
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
  }, [allPoints, mutedFill, width, height]);

  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const img = new Image();
    const redraw = () => drawRef.current();
    const onDone = () => {
      fieldImgRef.current = img;
      redraw();
    };
    img.onload = onDone;
    img.onerror = () => {
      console.warn("[heatmap] Field image failed to load:", heatmapFieldPath);
      fieldImgRef.current = null;
      redraw();
    };
    img.src = heatmapFieldPath;
    if (img.complete && img.naturalWidth > 0) onDone();
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, []);

  useLayoutEffect(() => {
    draw();
  }, [draw]);

  if (allPoints.length === 0) {
    return (
      <div
        className="rounded-xl border border-border bg-muted/30 flex items-center justify-center shadow-inner"
        style={{ aspectRatio: `${width}/${height}` }}
      >
        <p className="text-sm text-muted-foreground">No shooting data yet</p>
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-border bg-muted/30 shadow-inner"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block h-auto w-full"
        data-testid="canvas-aggregate-heatmap"
      />
    </div>
  );
}

function truncateNote(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

type TeamPitEntryResponse =
  | (PitScoutingEntry & {
      scouter: { id: number; username: string; displayName: string; role: string; demoEventId: number | null } | null;
    })
  | null;

function yesNoLabel(v: boolean | null | undefined) {
  if (v == null) return "—";
  return v ? "Yes" : "No";
}


export default function TeamProfile() {
  const { id: eid, teamId: tid } = useParams<{ id: string; teamId: string }>();
  const { user } = useAuth();
  const isDemo = user?.role === "demo";
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

  const { data: pitSnapshot, isLoading: pitLoading } = useQuery<{
    entry: TeamPitEntryResponse;
    accessDenied: boolean;
  }>({
    queryKey: ["/api/events", eventId, "teams", teamId, "pit-entry"],
    enabled: Number.isFinite(eventId) && eventId > 0 && Number.isFinite(teamId) && teamId > 0,
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/teams/${teamId}/pit-entry`, {
        credentials: "include",
      });
      if (res.status === 403) return { entry: null, accessDenied: true };
      if (res.status === 404) return { entry: null, accessDenied: false };
      if (!res.ok) throw new Error("Failed to load pit scouting");
      return { entry: (await res.json()) as TeamPitEntryResponse, accessDenied: false };
    },
  });

  const { data: allEntries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const team = teams?.find((t) => t.id === teamId);
  const eventTeam = eventTeams?.find(et => et.teamId === teamId);
  const pitEntry = pitSnapshot?.entry ?? null;
  const pitAccessDenied = pitSnapshot?.accessDenied ?? false;
  const pitFuelDisplay = pitEntry
    ? pitEntry.hopperCapacityOver100
      ? "100+"
      : `${pitEntry.hopperCapacity}`
    : "—";
  const pitUpdatedDisplay =
    pitEntry?.updatedAt != null ? new Date(pitEntry.updatedAt).toLocaleString() : null;
  const pitNewAutonDisplay =
    pitEntry?.newAutonTimeMinutes != null ? `${pitEntry.newAutonTimeMinutes} min` : "—";
  const pitWeightDisplay =
    pitEntry?.robotWeightLbs != null ? `${pitEntry.robotWeightLbs} lbs` : "—";
  const pitRevControllerDisplay =
    pitEntry?.revMotorControllerCount != null ? `${pitEntry.revMotorControllerCount}` : "—";
  const pitExtraImages = pitEntry
    ? [
        pitEntry.robotExtraImage1,
        pitEntry.robotExtraImage2,
        pitEntry.robotExtraImage3,
        pitEntry.robotExtraImage4,
      ].filter((img): img is string => !!img)
    : [];
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
  const evadedEntries = entries?.filter((e) => e.evadedDefense != null) ?? [];
  const hasEvadedDefense = evadedEntries.length > 0;
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
  const defenseEntries = entries?.filter((e) => e.playedDefense) ?? [];
  const avgDefense = defenseEntries.length > 0
    ? Math.round(defenseEntries.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / defenseEntries.length)
    : 0;
  const avgEvadedDefense = evadedEntries.length > 0
    ? Math.round(evadedEntries.reduce((s, e) => s + toPct(e.evadedDefense ?? 0), 0) / evadedEntries.length)
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
  const dispEvadedDefense = hasEntries && hasEvadedDefense ? `${avgEvadedDefense}%` : EMPTY;
  const dispDefense = hasEntries && hasDefense ? `${avgDefense}%` : EMPTY;
  const dispDriverSkill = hasEntries && hasDriverSkill ? `${avgDriverSkill}%` : EMPTY;
  const reliability = hasEntries
    ? Math.round((entries!.filter((e) => !e.died).length / entries!.length) * 100)
    : 0;
  const dispReliability = hasEntries ? `${reliability}%` : EMPTY;
  const reliabilityHeat = hasEntries ? getHeatColor(reliability, 0, 100) : "";
  const dispClimbRate = hasEntries && hasClimbAttempted ? `${climbRate}%` : EMPTY;
  const dispClimbL1 = hasEntries && hasClimbAttempted ? `${climbL1Rate}%` : EMPTY;
  const dispClimbL2 = hasEntries && hasClimbAttempted ? `${climbL2Rate}%` : EMPTY;
  const dispClimbL3 = hasEntries && hasClimbAttempted ? `${climbL3Rate}%` : EMPTY;
  const dispAutoClimbRate = hasEntries && hasAutoClimbAttempted ? `${autoClimbRate}%` : EMPTY;

  const teamsList = useMemo(() => (eventTeams || []).map(et => et.team), [eventTeams]);
  const teamStatsMap = useMemo(() => computeTeamStats(teamsList, allEntries || []), [teamsList, allEntries]);
  const statRanges = useMemo(() => computeStatRanges(teamStatsMap), [teamStatsMap]);
  const szrStatRanges = useMemo(() => computeStatRangesForSzr(teamStatsMap), [teamStatsMap]);
  const tbaRanges = useMemo(() => computeTbaRanges(eventTeams || []), [eventTeams]);
  const szrWeights = useMemo(() => parseSzrWeights(event?.szrWeights), [event?.szrWeights]);
  const szrMap = useMemo(() => computeSzrMapWithSweepBonus(teamsList, allEntries || [], szrStatRanges, statRanges, szrWeights, eventTeams ?? undefined, tbaRanges), [teamsList, allEntries, szrStatRanges, statRanges, szrWeights, eventTeams, tbaRanges]);
  const szrSweepThreshold = useMemo(() => {
    const values = Array.from(szrMap.values()).filter(v => v > 0).sort((a, b) => b - a);
    if (values.length < 2) return null;
    return values[1] + 19; // 20+ above second place: value > second+19
  }, [szrMap]);
  const szr = useMemo(() => szrMap.get(teamId ?? 0) ?? 0, [teamId, szrMap]);

  const rankings = useMemo(() => {
    if (!allEntries || !eventTeams) return null;

    const teamIds = eventTeams.map(et => et.teamId);
    const statsMap = new Map<number, {
      avgAuto: number;
      avgAutoAccuracy: number;
      avgThroughput: number;
      avgAccuracy: number;
      avgDefense: number;
      avgEvadedDefense: number;
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
        statsMap.set(tid, { avgAuto: 0, avgAutoAccuracy: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, avgEvadedDefense: 0, avgDriverSkill: 0, climbRate: 0, climbL1Rate: 0, climbL2Rate: 0, climbL3Rate: 0, avgClimbLevel: 0, autoClimbRate: 0, avgAutoClimbLevel: 0 });
      } else {
        const climbs = te.filter(e => e.climbSuccess === "success");
        const autoClimbs = te.filter(e => e.autoClimbSuccess === "success");
        const autoAccTe = te.filter(e => (e.autoBallsShot ?? 0) >= 1);
        const avgAutoAcc = autoAccTe.length > 0
          ? autoAccTe.reduce((s, e) => s + toPct(e.autoAccuracy ?? 0), 0) / autoAccTe.length
          : 0;
        const evadedTe = te.filter((e) => e.evadedDefense != null);
        const avgEv = evadedTe.length > 0
          ? evadedTe.reduce((s, e) => s + toPct(e.evadedDefense ?? 0), 0) / evadedTe.length
          : 0;
        const defenseTe = te.filter((e) => e.playedDefense);
        const avgDefPlayed = defenseTe.length > 0
          ? defenseTe.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / defenseTe.length
          : 0;
        statsMap.set(tid, {
          avgAuto: te.reduce((s, e) => s + e.autoBallsShot, 0) / count,
          avgAutoAccuracy: avgAutoAcc,
          avgThroughput: te.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count,
          avgAccuracy: te.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0) / count,
          avgDefense: avgDefPlayed,
          avgEvadedDefense: avgEv,
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
      evadedDefenseRank: getRank("avgEvadedDefense"),
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

    /** Same full class strings as `team-list.tsx` table cells (bg + text tiers). */
    return {
      szr: szr > 0 ? getHeatColor(szr, 0, 100, szrSweepThreshold) : "",
      seed: tbaSeed != null && tbaRanges?.seed ? getSeedHeatColor(tbaSeed, tbaRanges.seed, eventTeam) : "",
      record: total > 0 ? getHeatColor(winRate, winRateMin, winRateMax || 1) : "",
    };
  }, [eventTeam, eventTeams, tbaOpr, tbaSeed, tbaRanges, szr, szrSweepThreshold]);

  const heatColors = useMemo(() => {
    if (!thisTeamStats || !statRanges) return { auto: "", autoAccuracy: "", throughput: "", accuracy: "", evadedDefense: "", defense: "", driverSkill: "", climb: "", climbL1: "", climbL2: "", climbL3: "" };
    const s = thisTeamStats;
    const r = statRanges;
    return {
      auto: getHeatColor(s.avgAuto, r.auto.min, r.auto.max, r.auto.sweep),
      autoAccuracy: s.avgAutoAccuracy > 0 ? getHeatColor(s.avgAutoAccuracy, r.autoAccuracy.min, r.autoAccuracy.max, r.autoAccuracy.sweep) : "",
      throughput: getHeatColor(s.avgThroughput, r.throughput.min, r.throughput.max, r.throughput.sweep),
      accuracy: getHeatColor(s.avgAccuracy, r.accuracy.min, r.accuracy.max, r.accuracy.sweep),
      evadedDefense: s.hasEvadedDefense ? getHeatColor(s.avgEvadedDefense, r.evadedDefense.min, r.evadedDefense.max, r.evadedDefense.sweep) : "",
      defense: s.hasDefense ? getHeatColor(s.avgDefense, r.defense.min, r.defense.max, r.defense.sweep) : "",
      driverSkill: getHeatColor(s.avgDriverSkill, r.driverSkill.min, r.driverSkill.max, r.driverSkill.sweep),
      climb: s.hasClimbAttempted ? getHeatColor(s.climbRate, r.climb.min, r.climb.max, r.climb.sweep) : "",
      climbL1: s.hasClimbAttempted ? getHeatColor(s.climbL1Rate, r.climbL1.min, r.climbL1.max, r.climbL1.sweep) : "",
      climbL2: s.hasClimbAttempted ? getHeatColor(s.climbL2Rate, r.climbL2.min, r.climbL2.max, r.climbL2.sweep) : "",
      climbL3: s.hasClimbAttempted ? getHeatColor(s.climbL3Rate, r.climbL3.min, r.climbL3.max, r.climbL3.sweep) : "",
    };
  }, [thisTeamStats, statRanges]);

  const autoClimbHeatClass = rankings
    ? getHeatColor(autoClimbRate, rankings.autoClimbRange.min, rankings.autoClimbRange.max)
    : "";

  const perfOverviewRef = useRef<HTMLDivElement>(null);
  const [scoutNotesHeightPx, setScoutNotesHeightPx] = useState<number | null>(null);
  const [expandedPitImage, setExpandedPitImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (isDemo) return;
    const el = perfOverviewRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setScoutNotesHeightPx(Math.round(h));
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDemo]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Link href={returnTo ?? `/events/${eventId}/teams`}>
            <Button variant="ghost" size="sm" data-testid="button-back-event">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {returnTo ? "Back to Match" : "Back to Teams"}
            </Button>
          </Link>
          {!isDemo && (
            <Link href={`/events/${eventId}/teams/${teamId}/compare`}>
              <Button variant="outline" size="sm" data-testid="button-compare-stats">
                <BarChart2 className="h-4 w-4 mr-1" />
                Compare Stats
              </Button>
            </Link>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:max-w-md lg:max-w-[22rem]">
          <div className="flex items-start gap-4">
            {team ? (
              <img src={team.avatar || placeholderAvatar} alt={`Team ${team.teamNumber}`} className="w-14 h-14 shrink-0 rounded-lg border border-border object-cover bg-card" data-testid="img-team-avatar" />
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold tracking-tight flex flex-wrap items-center gap-2" data-testid="text-team-name">
                {team ? `${team.teamNumber} - ${team.teamName}` : <Skeleton className="h-9 w-56 inline-block" />}
                {help?.HelpTrigger?.({
                  content: {
                    title: "Team profile",
                    body: (
                      <p>
                        Stats from your scouting data: auto, throughput, accuracy, defense, climb.
                        {!isDemo && " Compare with other teams or view notes."}
                      </p>
                    ),
                  },
                })}
                {showNoTbaIcon && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex shrink-0 cursor-help">
                        <AlertCircle className="h-5 w-5 text-primary" aria-hidden />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>No Blue Alliance (TBA) data yet</TooltipContent>
                  </Tooltip>
                )}
                {showNoScoutingIcon && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex shrink-0 cursor-help">
                        <AlertTriangle className="h-5 w-5 text-important" aria-hidden />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>No scouting data yet</TooltipContent>
                  </Tooltip>
                )}
              </h1>
              {event && (
                <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 sm:gap-3 mt-4" data-testid="tba-stats-bar">
          {tbaSeed != null && (
            <div className={`flex items-baseline gap-2 rounded-lg px-3 py-2 ${tbaStatHeat.seed || "border border-border bg-card"}`}>
              <span className={`text-[10px] font-medium uppercase tracking-wide ${tbaStatHeat.seed ? "opacity-80" : "text-muted-foreground"}`}>Rank</span>
              <span className="text-3xl font-extrabold tabular-nums leading-none">#{tbaSeed}</span>
            </div>
          )}
          {tbaRecord && tbaRecord !== "0-0-0" && (
            <div className={`flex items-baseline gap-2 rounded-lg px-3 py-2 ${tbaStatHeat.record || "border border-border bg-card"}`}>
              <span className={`text-[10px] font-medium uppercase tracking-wide ${tbaStatHeat.record ? "opacity-80" : "text-muted-foreground"}`}>Record</span>
              <span className="text-2xl font-extrabold tabular-nums leading-none">{tbaRecord}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div ref={perfOverviewRef} className="flex min-w-0 flex-1 flex-col">
          <Card className="border-border w-full shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Performance overview</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 mb-4 sm:grid-cols-3">
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">DR</p>
                  <div className={`inline-flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[5rem] ${dispDriverSkill === EMPTY ? "bg-muted/30" : (heatColors.driverSkill || "bg-muted/30")}`}>
                    <span className={`text-3xl font-extrabold tabular-nums leading-none ${dispDriverSkill === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-overview-dr">{dispDriverSkill}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">SZR</p>
                  <div className={`inline-flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[5rem] ${hasEntries ? (tbaStatHeat.szr || "bg-muted/30") : "bg-muted/30"}`}>
                    <span className={`text-3xl font-extrabold tabular-nums leading-none ${hasEntries ? "" : "text-muted-foreground/40"}`} data-testid="text-overview-szr">
                      {hasEntries ? szr : EMPTY}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Reliability</p>
                  <div className={`inline-flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[5rem] ${dispReliability === EMPTY ? "bg-muted/30" : (reliabilityHeat || "bg-muted/30")}`}>
                    <span className={`text-3xl font-extrabold tabular-nums leading-none ${dispReliability === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-overview-reliability">{dispReliability}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 border-t border-border pt-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
                <div className="space-y-5 sm:px-3 sm:first:pl-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">Auto</p>
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Balls shot</p>
                      <div className={`inline-flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[5rem] ${dispAutoBalls === EMPTY ? "bg-muted/30" : (heatColors.auto || "bg-muted/30")}`}>
                        <span className={`text-5xl font-extrabold tabular-nums leading-none ${dispAutoBalls === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-auto">{dispAutoBalls}</span>
                      </div>
                    </div>
                    {autoAccEntries.length > 0 && (
                      <div className="text-center border-t border-border pt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Auto accuracy</p>
                        <div className={`inline-flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[5rem] ${dispAutoAccuracy === EMPTY ? "bg-muted/30" : (heatColors.autoAccuracy || "bg-muted/30")}`}>
                          <span className={`text-4xl font-extrabold tabular-nums leading-none ${dispAutoAccuracy === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-auto-accuracy">{dispAutoAccuracy}</span>
                        </div>
                      </div>
                    )}
                    {hasAutoClimbAttempted && (
                      <div className="text-center border-t border-border pt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Auto climb</p>
                        <div className={`inline-flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[5rem] ${dispAutoClimbRate === EMPTY ? "bg-muted/30" : (autoClimbHeatClass || "bg-muted/30")}`}>
                          <span className={`text-3xl font-extrabold tabular-nums leading-none ${dispAutoClimbRate === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-auto-climb-rate">{dispAutoClimbRate}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5 sm:px-3 border-t border-border pt-4 sm:border-t-0 sm:pt-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">Teleop</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Throughput</p>
                      <div className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-2 min-w-[4.5rem] ${dispThroughput === EMPTY ? "bg-muted/30" : (heatColors.throughput || "bg-muted/30")}`}>
                        <span className={`text-4xl font-extrabold tabular-nums leading-none ${dispThroughput === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-throughput">{dispThroughput}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Accuracy</p>
                      <div className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-2 min-w-[4.5rem] ${dispAccuracy === EMPTY ? "bg-muted/30" : (heatColors.accuracy || "bg-muted/30")}`}>
                        <span className={`text-4xl font-extrabold tabular-nums leading-none ${dispAccuracy === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-accuracy">{dispAccuracy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Played defence</p>
                      <div className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-2 min-w-[4.5rem] ${dispDefense === EMPTY ? "bg-muted/30" : (heatColors.defense || "bg-muted/30")}`}>
                        <span className={`text-3xl font-extrabold tabular-nums leading-none ${dispDefense === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-played-defence">{dispDefense}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Evaded defense</p>
                      <div className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-2 min-w-[4.5rem] ${dispEvadedDefense === EMPTY ? "bg-muted/30" : (heatColors.evadedDefense || "bg-muted/30")}`}>
                        <span className={`text-3xl font-extrabold tabular-nums leading-none ${dispEvadedDefense === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-avg-evaded-defense">{dispEvadedDefense}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 sm:px-3 sm:pr-0 border-t border-border pt-4 sm:border-t-0 sm:pt-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">Endgame</p>
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Climb rate</p>
                      <div className={`inline-flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[5rem] ${dispClimbRate === EMPTY ? "bg-muted/30" : (heatColors.climb || "bg-muted/30")}`}>
                        <span className={`text-5xl font-extrabold tabular-nums leading-none ${dispClimbRate === EMPTY ? "text-muted-foreground/40" : ""}`} data-testid="text-climb-rate">{dispClimbRate}</span>
                      </div>
                    </div>
                    <div className="text-center border-t border-border pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">L3 rate</p>
                      <div className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-1.5 min-w-[4rem] ${dispClimbL3 === EMPTY ? "bg-muted/30" : (heatColors.climbL3 || "bg-muted/30")}`}>
                        <span className={`text-2xl font-extrabold tabular-nums leading-none ${dispClimbL3 === EMPTY ? "text-muted-foreground/40" : ""}`}>{dispClimbL3}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!isDemo && entries && entries.length > 0 && (() => {
          const noteCols = [
            {
              label: "Auto",
              notes: entries.map(e => ({ match: e.matchNumber, text: e.autoNotes })).filter(n => n.text),
            },
            {
              label: "Teleop & defense",
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
              notes: entries.map(e => ({ match: e.matchNumber, text: e.notes })).filter(n => n.text),
            },
          ];
          const hasAny = noteCols.some(c => c.notes.length > 0);
          if (!hasAny) return null;
          return (
            <aside
              className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden xl:w-[280px] xl:shrink-0"
              style={
                scoutNotesHeightPx != null
                  ? { height: scoutNotesHeightPx, maxHeight: scoutNotesHeightPx }
                  : undefined
              }
            >
              <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <h2 className="text-sm font-bold">Scout notes</h2>
                </div>
                <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                  {noteCols.map(col => {
                    const recent = [...col.notes].sort((a, b) => b.match - a.match).slice(0, 4);
                    if (recent.length === 0) return null;
                    return (
                      <div key={col.label}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{col.label}</p>
                        <ul className="space-y-2">
                          {recent.map((n, i) => {
                            const display = truncateNote(n.text!, 50);
                            const full = n.text!.trim();
                            return (
                              <li key={i} className="rounded-md border border-border bg-muted/25 px-2 py-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground">M{n.match}</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="mt-0.5 line-clamp-3 cursor-default text-xs leading-snug text-foreground/90 whitespace-pre-line">{display}</p>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs whitespace-pre-wrap">{full}</TooltipContent>
                                </Tooltip>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <div className="shrink-0 border-t border-border p-2">
                  <Link href={`/events/${eventId}/teams/${teamId}/notes`}>
                    <Button variant="outline" size="sm" className="w-full" data-testid="button-view-all-notes">
                      View all notes
                    </Button>
                  </Link>
                </div>
              </div>
            </aside>
          );
        })()}
      </div>


      <div className="w-full min-w-0">
        <Card className="w-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg font-bold">Pit Snapshot</CardTitle>
              {!isDemo ? (
                <Link href={`/events/${eventId}/pit-scout?teamId=${teamId}`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground/50 hover:text-muted-foreground"
                    data-testid="button-edit-pit-snapshot"
                    aria-label="Edit pit scouting entry"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {pitLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : pitAccessDenied ? (
              <p className="text-sm text-muted-foreground">
                Pit scouting data is available, but your account does not currently have pit scouting access.
              </p>
            ) : !pitEntry ? (
              <p className="text-sm text-muted-foreground">
                No pit scouting entry submitted for this team yet.
              </p>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Drive type</p>
                    <p className="text-sm font-semibold capitalize">{pitEntry.drivetrainType}</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fuel capacity</p>
                    <p className="text-sm font-semibold">{pitFuelDisplay}</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Weight</p>
                    <p className="text-sm font-semibold">{pitWeightDisplay}</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">REV controllers</p>
                    <p className="text-sm font-semibold">{pitRevControllerDisplay}</p>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mechanical</p>
                    <div className="space-y-1 rounded-md border border-border bg-muted/20 p-3 text-sm">
                      <p><span className="font-medium">Can go under trench:</span> {yesNoLabel(pitEntry.fitsUnderTrench)}</p>
                      <p><span className="font-medium">Fuel capacity:</span> {pitFuelDisplay}</p>
                      <p className="whitespace-pre-wrap">
                        <span className="font-medium">Can climb and to what level:</span>{" "}
                        {pitEntry.pitClimbNotes?.trim() || "—"}
                      </p>
                      <p><span className="font-medium">Robot weight:</span> {pitWeightDisplay}</p>
                      <p><span className="font-medium">REV motor controllers:</span> {pitRevControllerDisplay}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Programming</p>
                    <div className="space-y-1 rounded-md border border-border bg-muted/20 p-3 text-sm">
                      <p><span className="font-medium">Has auto:</span> {yesNoLabel(pitEntry.hasAuto)}</p>
                      <p><span className="font-medium">Uses PathPlanner:</span> {yesNoLabel(pitEntry.usesPathplanner)}</p>
                      <p><span className="font-medium">Has midfield fuel auto:</span> {yesNoLabel(pitEntry.hasMidfieldFuelAuto)}</p>
                      <p><span className="font-medium">New auton build time:</span> {pitNewAutonDisplay}</p>
                      <p className="whitespace-pre-wrap">
                        <span className="font-medium">Auto routine notes:</span>{" "}
                        {pitEntry.autoDescription?.trim() || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {(pitEntry.robotHeroImage || pitExtraImages.length > 0) && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photos</p>
                    <div className="space-y-3">
                      {pitEntry.robotHeroImage ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => setExpandedPitImage({ src: pitEntry.robotHeroImage!, alt: "Pit hero" })}
                            className="w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            data-testid="button-expand-pit-hero"
                          >
                            <img
                              src={pitEntry.robotHeroImage}
                              alt="Pit hero"
                              className="h-80 w-full cursor-zoom-in rounded-md border border-border object-cover md:h-[28rem]"
                            />
                          </button>
                        </div>
                      ) : null}
                      {pitExtraImages.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {pitExtraImages.map((img, idx) => (
                            <button
                              key={`${img}-${idx}`}
                              type="button"
                              onClick={() => setExpandedPitImage({ src: img, alt: `Pit extra ${idx + 1}` })}
                              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                              data-testid={`button-expand-pit-extra-${idx}`}
                            >
                              <img
                                src={img}
                                alt={`Pit extra ${idx + 1}`}
                                className="h-24 w-32 cursor-zoom-in rounded-md border border-border object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Last updated: {pitUpdatedDisplay ?? "—"}
                  {pitEntry.scouter?.displayName ? ` · Scouter: ${pitEntry.scouter.displayName}` : ""}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Shooting heatmap</p>
        {hasEntries && entries ? (
          <div className="w-full min-w-0">
            <AggregateHeatmap entries={entries} width={HEATMAP_W} height={HEATMAP_H} />
          </div>
        ) : (
          <div className="flex min-h-[180px] w-full items-center justify-center rounded-xl border border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">No shooting data yet</p>
          </div>
        )}
      </div>



      <Card className="w-full">
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
                    {!isDemo && <TableHead className="text-sm font-bold">Notes</TableHead>}
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
                        <TableCell className={`text-center text-base font-bold tabular-nums ${statRanges ? getHeatColor(entry.autoBallsShot, statRanges.auto.min, statRanges.auto.max, statRanges.auto.sweep) : ""}`}>
                          {entry.autoBallsShot}
                        </TableCell>
                        <TableCell className={`text-center text-base font-bold tabular-nums ${(entry.autoBallsShot ?? 0) >= 1 && entry.autoAccuracy != null && statRanges?.autoAccuracy ? getHeatColor(toPct(entry.autoAccuracy), statRanges.autoAccuracy.min, statRanges.autoAccuracy.max, statRanges.autoAccuracy.sweep) : ""}`}>
                          {(entry.autoBallsShot ?? 0) >= 1 && entry.autoAccuracy != null ? (
                            <>{toPct(entry.autoAccuracy)}<span className="text-xs text-muted-foreground">%</span></>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={
                              entry.autoClimbSuccess === "success"
                                ? "border-success/30 bg-success/15 text-success-foreground"
                                : entry.autoClimbSuccess === "failed"
                                  ? "border-destructive/30 bg-destructive/15 text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            {entry.autoClimbSuccess === "success" ? "Yes" : entry.autoClimbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-center text-base font-bold tabular-nums ${statRanges ? getHeatColor(entry.teleopFpsEstimate, statRanges.throughput.min, statRanges.throughput.max, statRanges.throughput.sweep) : ""}`}>
                          {entry.teleopFpsEstimate}
                        </TableCell>
                        <TableCell className={`text-center text-base font-bold tabular-nums ${statRanges ? getHeatColor(toPct(entry.teleopAccuracy ?? 0), statRanges.accuracy.min, statRanges.accuracy.max, statRanges.accuracy.sweep) : ""}`}>
                          {toPct(entry.teleopAccuracy ?? 0)}<span className="text-xs text-muted-foreground">%</span>
                        </TableCell>
                        <TableCell className={`text-center text-base font-bold tabular-nums ${entry.driverSkill != null && statRanges?.driverSkill ? getHeatColor(toPct(entry.driverSkill), statRanges.driverSkill.min, statRanges.driverSkill.max, statRanges.driverSkill.sweep) : ""}`}>
                          {entry.driverSkill != null ? (
                            <>{toPct(entry.driverSkill)}<span className="text-xs text-muted-foreground">%</span></>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={
                              entry.climbSuccess === "success"
                                ? "border-success/30 bg-success/15 text-success-foreground"
                                : entry.climbSuccess === "failed"
                                  ? "border-destructive/30 bg-destructive/15 text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            {entry.climbSuccess === "success" ? `L${entry.climbLevel || "?"}` : entry.climbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-center text-base font-bold tabular-nums ${entry.playedDefense && statRanges ? getHeatColor(toPct(entry.defenseRating ?? 0), statRanges.defense.min, statRanges.defense.max, statRanges.defense.sweep) : ""}`}>
                          {entry.playedDefense ? (
                            <>{toPct(entry.defenseRating ?? 0)}<span className="text-xs text-muted-foreground">%</span></>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        {!isDemo && (
                        <TableCell className="max-w-[200px] text-sm">
                          {entry.notes ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="line-clamp-2 cursor-default text-foreground/90">{truncateNote(entry.notes, 50)}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs whitespace-pre-wrap">{entry.notes}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!expandedPitImage} onOpenChange={(open) => !open && setExpandedPitImage(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl border-border bg-zinc-950 p-2 sm:p-3">
          <DialogTitle className="sr-only">{expandedPitImage?.alt ?? "Expanded pit image"}</DialogTitle>
          {expandedPitImage ? (
            <img
              src={expandedPitImage.src}
              alt={expandedPitImage.alt}
              className="max-h-[82vh] w-full rounded-md object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>


    </div>
  );
}
