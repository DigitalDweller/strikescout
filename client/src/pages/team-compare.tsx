import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, BarChart2 } from "lucide-react";
import { RankingColorKey } from "@/components/ranking-color-key";
import type { Event, Team, ScoutingEntry, EventTeam } from "@shared/schema";
import { TeamSearchInput } from "@/components/team-search-input";
import {
  toPct,
  getCompareHeatColor,
  computeTeamStats,
  computeStatRanges,
  computeTbaRanges,
} from "@/lib/team-colors";
import placeholderAvatar from "@assets/images_1772071870956.png";

type TeamStatsSlice = {
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
  autoClimbRate: number;
  entries: number;
  hasThroughput: boolean;
  hasDefense: boolean;
  hasDriverSkill: boolean;
  hasClimbAttempted: boolean;
  hasAutoClimbAttempted: boolean;
};

/** Heat background (green/red) based only on these two teams' values. Better = green. */
function compareHeat(myVal: number, otherVal: number | undefined): string {
  if (otherVal == null) return "";
  const min = Math.min(myVal, otherVal);
  const max = Math.max(myVal, otherVal);
  return getCompareHeatColor(myVal, min, max);
}

/** Seed: lower rank number is better, so invert for heat. */
function compareHeatSeed(mySeed: number, otherSeed: number | undefined): string {
  if (otherSeed == null) return "";
  const minR = Math.min(mySeed, otherSeed);
  const maxR = Math.max(mySeed, otherSeed);
  if (maxR === minR) return "";
  return getCompareHeatColor(maxR - mySeed, 0, maxR - minR);
}

function CompareTableRow({
  label,
  leftVal,
  rightVal,
  invertBetter = false,
  leftFormat = (v: number) => String(v),
  rightFormat = (v: number) => String(v),
}: {
  label: string;
  leftVal: number | null;
  rightVal: number | null | undefined;
  invertBetter?: boolean;
  leftFormat?: (v: number) => string;
  rightFormat?: (v: number) => string;
}) {
  const leftEmpty = leftVal == null;
  const rightEmpty = rightVal == null;
  const r = rightEmpty ? leftVal : rightVal;
  const canCompare = !leftEmpty && !rightEmpty && leftVal != null && r != null;
  const min = canCompare ? Math.min(leftVal, r) : 0;
  const max = canCompare ? Math.max(leftVal, r) : 0;
  const leftHeat = canCompare && !leftEmpty
    ? (invertBetter
        ? (max === min ? "" : getCompareHeatColor(max - leftVal!, 0, max - min))
        : (max === min ? "" : getCompareHeatColor(leftVal!, min, max)))
    : "";
  const rightHeat = rightEmpty ? "bg-muted/20" : canCompare
    ? (invertBetter
        ? (max === min ? "" : getCompareHeatColor(max - rightVal!, 0, max - min))
        : (max === min ? "" : getCompareHeatColor(rightVal!, min, max)))
    : "bg-muted/20";

  return (
    <TableRow className="border-b border-border hover:bg-transparent">
      <TableCell className="px-3 py-2 text-muted-foreground border-r border-border font-medium">
        {label}
      </TableCell>
      <TableCell className={`px-3 py-2 text-right border-r border-border ${leftHeat || "bg-muted/20"}`}>
        {leftEmpty ? <span className="text-muted-foreground/50">—</span> : leftFormat(leftVal!)}
      </TableCell>
      <TableCell className={`px-3 py-2 text-left ${rightHeat}`}>
        {rightEmpty ? <span className="text-muted-foreground/50">—</span> : rightFormat(rightVal!)}
      </TableCell>
    </TableRow>
  );
}

export default function TeamCompare() {
  const params = useParams<{ id: string; teamId: string; otherTeamId?: string }>();
  const [, setLocation] = useLocation();
  const eventId = parseInt(params.id!);
  const leftTeamId = parseInt(params.teamId!);
  const rightTeamId = params.otherTeamId ? parseInt(params.otherTeamId) : null;

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: allEntries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const teams = useMemo(() => (eventTeams || []).map((et) => et.team), [eventTeams]);
  const allTeamStats = useMemo(() => computeTeamStats(teams, allEntries || []), [teams, allEntries]);
  const statRanges = useMemo(() => computeStatRanges(allTeamStats), [allTeamStats]);
  const tbaRanges = useMemo(() => computeTbaRanges(eventTeams || []), [eventTeams]);

  const leftTeam = eventTeams?.find((et) => et.teamId === leftTeamId)?.team ?? null;
  const rightTeam = rightTeamId ? (eventTeams?.find((et) => et.teamId === rightTeamId)?.team ?? null) : null;
  const leftEventTeam = eventTeams?.find((et) => et.teamId === leftTeamId);
  const rightEventTeam = rightTeamId ? eventTeams?.find((et) => et.teamId === rightTeamId) : undefined;

  const leftStats = useMemo((): TeamStatsSlice | null => {
    const entries = (allEntries || []).filter((e) => e.teamId === leftTeamId);
    if (entries.length === 0) return null;
    const climbSuccess = entries.filter((e) => e.climbSuccess === "success");
    const autoClimbSuccess = entries.filter((e) => e.autoClimbSuccess === "success").length;
    const autoAccEntries = entries.filter((e) => (e.autoBallsShot ?? 0) >= 1);
    const avgAutoAcc = autoAccEntries.length > 0
      ? autoAccEntries.reduce((s, e) => s + toPct(e.autoAccuracy ?? 0), 0) / autoAccEntries.length
      : 0;
    return {
      avgAuto: entries.reduce((s, e) => s + e.autoBallsShot, 0) / entries.length,
      avgAutoAccuracy: avgAutoAcc,
      avgThroughput: entries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / entries.length,
      avgAccuracy: entries.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0) / entries.length,
      avgDefense: entries.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / entries.length,
      avgDriverSkill: entries.reduce((s, e) => s + toPct(e.driverSkill ?? 0), 0) / entries.length,
      climbRate: (climbSuccess.length / entries.length) * 100,
      climbL1Rate: (climbSuccess.filter((e) => e.climbLevel === "1").length / entries.length) * 100,
      climbL2Rate: (climbSuccess.filter((e) => e.climbLevel === "2").length / entries.length) * 100,
      climbL3Rate: (climbSuccess.filter((e) => e.climbLevel === "3").length / entries.length) * 100,
      autoClimbRate: (autoClimbSuccess / entries.length) * 100,
      entries: entries.length,
      hasThroughput: entries.some((e) => (e.teleopFpsEstimate ?? 0) > 0),
      hasDefense: entries.some((e) => e.playedDefense),
      hasDriverSkill: entries.some((e) => e.driverSkill != null),
      hasClimbAttempted: entries.some((e) => e.climbSuccess === "success" || e.climbSuccess === "failed"),
      hasAutoClimbAttempted: entries.some((e) => e.autoClimbSuccess === "success" || e.autoClimbSuccess === "failed"),
    };
  }, [allEntries, leftTeamId]);

  const rightStats = useMemo((): TeamStatsSlice | null => {
    if (!rightTeamId) return null;
    const entries = (allEntries || []).filter((e) => e.teamId === rightTeamId);
    if (entries.length === 0) return null;
    const climbSuccess = entries.filter((e) => e.climbSuccess === "success");
    const autoClimbSuccess = entries.filter((e) => e.autoClimbSuccess === "success").length;
    const autoAccEntries = entries.filter((e) => (e.autoBallsShot ?? 0) >= 1);
    const avgAutoAcc = autoAccEntries.length > 0
      ? autoAccEntries.reduce((s, e) => s + toPct(e.autoAccuracy ?? 0), 0) / autoAccEntries.length
      : 0;
    return {
      avgAuto: entries.reduce((s, e) => s + e.autoBallsShot, 0) / entries.length,
      avgAutoAccuracy: avgAutoAcc,
      avgThroughput: entries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / entries.length,
      avgAccuracy: entries.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0) / entries.length,
      avgDefense: entries.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / entries.length,
      avgDriverSkill: entries.reduce((s, e) => s + toPct(e.driverSkill ?? 0), 0) / entries.length,
      climbRate: (climbSuccess.length / entries.length) * 100,
      climbL1Rate: (climbSuccess.filter((e) => e.climbLevel === "1").length / entries.length) * 100,
      climbL2Rate: (climbSuccess.filter((e) => e.climbLevel === "2").length / entries.length) * 100,
      climbL3Rate: (climbSuccess.filter((e) => e.climbLevel === "3").length / entries.length) * 100,
      autoClimbRate: (autoClimbSuccess / entries.length) * 100,
      entries: entries.length,
      hasThroughput: entries.some((e) => (e.teleopFpsEstimate ?? 0) > 0),
      hasDefense: entries.some((e) => e.playedDefense),
      hasDriverSkill: entries.some((e) => e.driverSkill != null),
      hasClimbAttempted: entries.some((e) => e.climbSuccess === "success" || e.climbSuccess === "failed"),
      hasAutoClimbAttempted: entries.some((e) => e.autoClimbSuccess === "success" || e.autoClimbSuccess === "failed"),
    };
  }, [allEntries, rightTeamId]);

  const handleSelectLeft = (teamId: number) => {
    const base = `/events/${eventId}/teams/${teamId}/compare`;
    if (rightTeamId) setLocation(`${base}/${rightTeamId}`);
    else setLocation(base);
  };

  const handleSelectRight = (teamId: number) => {
    setLocation(`/events/${eventId}/teams/${leftTeamId}/compare/${teamId}`);
  };

  if (!eventTeams?.length) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <Link href={`/events/${eventId}/teams/${leftTeamId}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Team
          </Button>
        </Link>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Link href={`/events/${eventId}/teams/${leftTeamId}`}>
          <Button variant="ghost" size="sm" data-testid="button-back-team">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Team
          </Button>
        </Link>
        <RankingColorKey />
      </div>

      {/* Single contiguous block: selector row, team row, then table — all rows/columns touching */}
      <div className="border rounded-lg overflow-hidden max-w-4xl bg-card">
        {/* Row 1: two selector inputs touching */}
        <div className="grid grid-cols-2 border-b border-border">
          <div className="border-r border-border p-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Left</p>
            <TeamSearchInput
              eventTeams={eventTeams}
              selectedTeamId={leftTeamId}
              onSelectTeam={handleSelectLeft}
              placeholder="Type team number or name..."
              excludeTeamId={rightTeamId}
              teamStats={allTeamStats}
              statRanges={statRanges}
              tbaRanges={tbaRanges}
              data-testid="select-left-team"
            />
          </div>
          <div className="p-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Right</p>
            <TeamSearchInput
              eventTeams={eventTeams}
              selectedTeamId={rightTeamId}
              onSelectTeam={handleSelectRight}
              placeholder="Type team number or name..."
              excludeTeamId={leftTeamId}
              teamStats={allTeamStats}
              statRanges={statRanges}
              tbaRanges={tbaRanges}
              data-testid="select-right-team"
            />
          </div>
        </div>

        {/* Row 2: two team headers touching */}
        <div className="grid grid-cols-2 border-b border-border">
          <div className="border-r border-border flex items-center gap-3 px-3 py-3 min-h-[72px]">
            {leftTeam ? (
              <>
                <img
                  src={leftTeam.avatar || placeholderAvatar}
                  alt={`Team ${leftTeam.teamNumber}`}
                  className="w-10 h-10 rounded-lg border border-border object-cover bg-white shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{leftTeam.teamNumber} — {leftTeam.teamName}</p>
                  {event && <p className="text-xs text-muted-foreground truncate">{event.name}</p>}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a team</p>
            )}
          </div>
          <div className="flex items-center gap-3 px-3 py-3 min-h-[72px]">
            {rightTeam ? (
              <>
                <img
                  src={rightTeam.avatar || placeholderAvatar}
                  alt={`Team ${rightTeam.teamNumber}`}
                  className="w-10 h-10 rounded-lg border border-border object-cover bg-white shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{rightTeam.teamNumber} — {rightTeam.teamName}</p>
                  {event && <p className="text-xs text-muted-foreground truncate">{event.name}</p>}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a team</p>
            )}
          </div>
        </div>

        {/* Table: stat rows with left/right cells touching — no gap between columns or rows */}
        <Table className="border-collapse table-fixed">
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="w-[120px] px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border rounded-none">
                Stat
              </TableHead>
              <TableHead className="px-3 py-2 text-right text-xs font-medium text-muted-foreground border-r border-border rounded-none last:border-r-0">
                {leftTeam ? leftTeam.teamNumber : "—"}
              </TableHead>
              <TableHead className="px-3 py-2 text-left text-xs font-medium text-muted-foreground rounded-none">
                {rightTeam ? rightTeam.teamNumber : "—"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-b [&_tr]:border-border [&_tr:last-child]:border-b-0">
            {/* TBA rows */}
            {leftEventTeam && (leftEventTeam as any).rank != null && (
              <CompareTableRow
                label="Seed"
                leftVal={(leftEventTeam as any).rank}
                rightVal={(rightEventTeam as any)?.rank}
                invertBetter
                leftFormat={(v) => `#${v}`}
                rightFormat={(v) => `#${v}`}
              />
            )}
            {leftEventTeam && (leftEventTeam as any).opr != null && (
              <CompareTableRow
                label="OPR"
                leftVal={(leftEventTeam as any).opr}
                rightVal={(rightEventTeam as any)?.opr}
                leftFormat={(v) => v.toFixed(1)}
                rightFormat={(v) => v.toFixed(1)}
              />
            )}
            {leftEventTeam && (
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell className="px-3 py-2 text-muted-foreground border-r border-border font-medium">
                  Record
                </TableCell>
                <TableCell className="px-3 py-2 text-right border-r border-border bg-muted/30">
                  {`${(leftEventTeam as any)?.wins ?? 0}-${(leftEventTeam as any)?.losses ?? 0}-${(leftEventTeam as any)?.ties ?? 0}`}
                </TableCell>
                <TableCell className="px-3 py-2 text-left bg-muted/30">
                  {rightEventTeam ? `${(rightEventTeam as any)?.wins ?? 0}-${(rightEventTeam as any)?.losses ?? 0}-${(rightEventTeam as any)?.ties ?? 0}` : "—"}
                </TableCell>
              </TableRow>
            )}
            {/* Scouting rows */}
            {leftStats && (
              <>
                <CompareTableRow label="Auto (avg)" leftVal={leftStats.avgAuto} rightVal={rightStats?.avgAuto} leftFormat={(v) => v.toFixed(1)} rightFormat={(v) => v.toFixed(1)} />
                {leftStats.avgAutoAccuracy > 0 && <CompareTableRow label="Auto accuracy %" leftVal={leftStats.avgAutoAccuracy} rightVal={rightStats && rightStats.avgAutoAccuracy > 0 ? rightStats.avgAutoAccuracy : undefined} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />}
                <CompareTableRow label="Auto climb %" leftVal={leftStats.hasAutoClimbAttempted ? leftStats.autoClimbRate : null} rightVal={rightStats?.hasAutoClimbAttempted ? rightStats.autoClimbRate : undefined} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />
                <CompareTableRow label="Throughput" leftVal={leftStats.hasThroughput ? leftStats.avgThroughput : null} rightVal={rightStats?.hasThroughput ? rightStats.avgThroughput : undefined} leftFormat={(v) => v.toFixed(1)} rightFormat={(v) => v.toFixed(1)} />
                <CompareTableRow label="Accuracy %" leftVal={leftStats.avgAccuracy} rightVal={rightStats?.avgAccuracy} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />
                <CompareTableRow label="Defense %" leftVal={leftStats.hasDefense ? leftStats.avgDefense : null} rightVal={rightStats?.hasDefense ? rightStats.avgDefense : undefined} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />
                <CompareTableRow label="Driver skill %" leftVal={leftStats.hasDriverSkill ? leftStats.avgDriverSkill : null} rightVal={rightStats?.hasDriverSkill ? rightStats.avgDriverSkill : undefined} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />
                <CompareTableRow label="Climb rate %" leftVal={leftStats.hasClimbAttempted ? leftStats.climbRate : null} rightVal={rightStats?.hasClimbAttempted ? rightStats.climbRate : undefined} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />
                <CompareTableRow label="Climb L1 %" leftVal={leftStats.hasClimbAttempted ? leftStats.climbL1Rate : null} rightVal={rightStats?.hasClimbAttempted ? rightStats.climbL1Rate : undefined} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />
                <CompareTableRow label="Climb L2 %" leftVal={leftStats.hasClimbAttempted ? leftStats.climbL2Rate : null} rightVal={rightStats?.hasClimbAttempted ? rightStats.climbL2Rate : undefined} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />
                <CompareTableRow label="Climb L3 %" leftVal={leftStats.hasClimbAttempted ? leftStats.climbL3Rate : null} rightVal={rightStats?.hasClimbAttempted ? rightStats.climbL3Rate : undefined} leftFormat={(v) => `${Math.round(v)}%`} rightFormat={(v) => `${Math.round(v)}%`} />
              </>
            )}
            {leftStats && (
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableCell className="px-3 py-2 text-muted-foreground border-r border-border font-medium">
                  Matches scouted
                </TableCell>
                <TableCell className="px-3 py-2 text-right border-r border-border bg-muted/20">
                  {leftStats.entries}
                </TableCell>
                <TableCell className="px-3 py-2 text-left bg-muted/20">
                  {rightStats?.entries ?? "—"}
                </TableCell>
              </TableRow>
            )}
            {!leftStats && !(leftEventTeam && (leftEventTeam as any).opr != null) && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="px-3 py-6 text-center text-muted-foreground border-r-0">
                  Select both teams to compare stats. Green = higher, red = lower (between these two only).
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
