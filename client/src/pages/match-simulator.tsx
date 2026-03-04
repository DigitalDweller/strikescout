import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, Swords, Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import type { Event, Team, EventTeam, ScoutingEntry } from "@shared/schema";
import { toPct } from "@/lib/team-colors";
import { TeamSearchInput } from "@/components/team-search-input";
import { computeTeamStats, computeStatRanges, computeTbaRanges } from "@/lib/team-colors";
import placeholderAvatar from "@assets/images_1772071870956.png";

type TeamStatsSlice = {
  avgAuto: number;
  avgThroughput: number;
  avgAccuracy: number;
  avgDefense: number;
  climbRate: number;
  autoClimbRate: number;
  entries: number;
};

type EtExtended = EventTeam & { team: Team } & { opr?: number };

function computeTeamStatsSlice(teamId: number, entries: ScoutingEntry[]): TeamStatsSlice | null {
  const teamEntries = entries.filter((e) => e.teamId === teamId);
  if (teamEntries.length === 0) return null;
  const climbSuccess = teamEntries.filter((e) => e.climbSuccess === "success").length;
  const autoClimbSuccess = teamEntries.filter((e) => e.autoClimbSuccess === "success").length;
  return {
    avgAuto: teamEntries.reduce((s, e) => s + e.autoBallsShot, 0) / teamEntries.length,
    avgThroughput: teamEntries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / teamEntries.length,
    avgAccuracy: teamEntries.reduce((s, e) => s + toPct(e.teleopAccuracy ?? 0), 0) / teamEntries.length,
    avgDefense: teamEntries.reduce((s, e) => s + toPct(e.defenseRating ?? 0), 0) / teamEntries.length,
    climbRate: (climbSuccess / teamEntries.length) * 100,
    autoClimbRate: (autoClimbSuccess / teamEntries.length) * 100,
    entries: teamEntries.length,
  };
}

function allianceAverage(statsList: (TeamStatsSlice | null)[]): TeamStatsSlice | null {
  const valid = statsList.filter((s): s is TeamStatsSlice => s != null && s.entries > 0);
  if (valid.length === 0) return null;
  return {
    avgAuto: valid.reduce((s, v) => s + v.avgAuto, 0) / valid.length,
    avgThroughput: valid.reduce((s, v) => s + v.avgThroughput, 0) / valid.length,
    avgAccuracy: valid.reduce((s, v) => s + v.avgAccuracy, 0) / valid.length,
    avgDefense: valid.reduce((s, v) => s + v.avgDefense, 0) / valid.length,
    climbRate: valid.reduce((s, v) => s + v.climbRate, 0) / valid.length,
    autoClimbRate: valid.reduce((s, v) => s + v.autoClimbRate, 0) / valid.length,
    entries: valid.reduce((s, v) => s + v.entries, 0),
  };
}

export default function MatchSimulator() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const eventId = parseInt(id || "0");

  const [red1Id, setRed1Id] = useState<number | null>(null);
  const [red2Id, setRed2Id] = useState<number | null>(null);
  const [red3Id, setRed3Id] = useState<number | null>(null);
  const [blue1Id, setBlue1Id] = useState<number | null>(null);
  const [blue2Id, setBlue2Id] = useState<number | null>(null);
  const [blue3Id, setBlue3Id] = useState<number | null>(null);

  const { data: event } = useQuery<Event>({ queryKey: ["/api/events", eventId] });
  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });
  const { data: allEntries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const eventTeamList = useMemo(() => eventTeams?.map((et) => et.team) ?? [], [eventTeams]);
  const rawTeamStats = useMemo(
    () => computeTeamStats(eventTeamList, allEntries || []),
    [eventTeamList, allEntries]
  );
  const teamStats = useMemo(() => {
    const map = new Map<number, TeamStatsSlice>();
    if (!allEntries || !eventTeams) return map;
    for (const et of eventTeams) {
      const slice = computeTeamStatsSlice(et.teamId, allEntries);
      if (slice) map.set(et.teamId, slice);
    }
    return map;
  }, [allEntries, eventTeams]);
  const statRanges = useMemo(() => computeStatRanges(rawTeamStats), [rawTeamStats]);
  const tbaRanges = useMemo(() => computeTbaRanges(eventTeams || []), [eventTeams]);

  const teamNumToId = useMemo(() => {
    const m = new Map<number, number>();
    eventTeams?.forEach((et) => m.set(et.team.teamNumber, et.teamId));
    return m;
  }, [eventTeams]);

  const redTeamNums = useMemo(
    () =>
      [red1Id, red2Id, red3Id]
        .map((id) => (id != null ? eventTeams?.find((et) => et.teamId === id)?.team.teamNumber : null))
        .filter((n): n is number => n != null),
    [red1Id, red2Id, red3Id, eventTeams]
  );
  const blueTeamNums = useMemo(
    () =>
      [blue1Id, blue2Id, blue3Id]
        .map((id) => (id != null ? eventTeams?.find((et) => et.teamId === id)?.team.teamNumber : null))
        .filter((n): n is number => n != null),
    [blue1Id, blue2Id, blue3Id, eventTeams]
  );

  const redStatsCorrect = useMemo(() => {
    const ids = [red1Id, red2Id, red3Id].filter((x): x is number => x != null);
    return ids.map((id) => {
      const et = eventTeams?.find((e) => e.teamId === id);
      if (!et) return null;
      return teamStats.get(et.teamId) ?? computeTeamStatsSlice(et.teamId, allEntries || []);
    });
  }, [red1Id, red2Id, red3Id, eventTeams, teamStats, allEntries]);

  const blueStatsCorrect = useMemo(() => {
    const ids = [blue1Id, blue2Id, blue3Id].filter((x): x is number => x != null);
    return ids.map((id) => {
      const et = eventTeams?.find((e) => e.teamId === id);
      if (!et) return null;
      return teamStats.get(et.teamId) ?? computeTeamStatsSlice(et.teamId, allEntries || []);
    });
  }, [blue1Id, blue2Id, blue3Id, eventTeams, teamStats, allEntries]);

  const redAllianceStats = useMemo(() => allianceAverage(redStatsCorrect), [redStatsCorrect]);
  const blueAllianceStats = useMemo(() => allianceAverage(blueStatsCorrect), [blueStatsCorrect]);

  const redOprSum = useMemo(() => {
    if (!eventTeams) return null;
    let sum = 0;
    let count = 0;
    for (const n of redTeamNums) {
      const et = eventTeams.find((e) => e.team.teamNumber === n) as EtExtended;
      if (et?.opr != null) {
        sum += et.opr;
        count++;
      }
    }
    return count > 0 ? sum : null;
  }, [eventTeams, redTeamNums]);

  const blueOprSum = useMemo(() => {
    if (!eventTeams) return null;
    let sum = 0;
    let count = 0;
    for (const n of blueTeamNums) {
      const et = eventTeams.find((e) => e.team.teamNumber === n) as EtExtended;
      if (et?.opr != null) {
        sum += et.opr;
        count++;
      }
    }
    return count > 0 ? sum : null;
  }, [eventTeams, blueTeamNums]);

  const compositeWeights = {
    auto: 2.0,
    throughput: 1.5,
    accuracy: 0.5,
    defense: 0.3,
    climb: 0.3,
    autoClimb: 0.2,
  };

  const predictionAnalysis = useMemo(() => {
    const result: {
      winner: "red" | "blue" | "tossup";
      winProbability: number;
      confidence: string;
      compositeScoreRed: number;
      compositeScoreBlue: number;
      breakdown: { factor: string; weight: number; redVal: number; blueVal: number; redContrib: number; blueContrib: number; edge: "red" | "blue" | "tie" }[];
      redAdvantages: string[];
      blueAdvantages: string[];
      dataQuality: { redScouted: number; blueScouted: number; redMissing: string[]; blueMissing: string[] };
      keyFactors: string[];
    } = {
      winner: "tossup",
      winProbability: 50,
      confidence: "N/A",
      compositeScoreRed: 0,
      compositeScoreBlue: 0,
      breakdown: [],
      redAdvantages: [],
      blueAdvantages: [],
      dataQuality: { redScouted: 0, blueScouted: 0, redMissing: [], blueMissing: [] },
      keyFactors: [],
    };

    const redScouted = redStatsCorrect.filter(Boolean).reduce((s, st) => s + (st?.entries ?? 0), 0);
    const blueScouted = blueStatsCorrect.filter(Boolean).reduce((s, st) => s + (st?.entries ?? 0), 0);
    result.dataQuality.redScouted = redScouted;
    result.dataQuality.blueScouted = blueScouted;
    redTeamNums.forEach((n, i) => {
      const st = redStatsCorrect[i];
      if (!st || st.entries === 0) result.dataQuality.redMissing.push(`Team ${n}`);
    });
    blueTeamNums.forEach((n, i) => {
      const st = blueStatsCorrect[i];
      if (!st || st.entries === 0) result.dataQuality.blueMissing.push(`Team ${n}`);
    });

    if (redOprSum != null && blueOprSum != null) {
      const totalOpr = redOprSum + blueOprSum;
      result.winProbability = totalOpr > 0 ? Math.round((redOprSum / totalOpr) * 100) : 50;
      result.winner = result.winProbability > 55 ? "red" : result.winProbability < 45 ? "blue" : "tossup";
      const pctDiff = totalOpr > 0 ? (Math.abs(redOprSum - blueOprSum) / totalOpr) * 100 : 0;
      result.confidence = pctDiff > 20 ? "High" : pctDiff > 10 ? "Medium" : "Low";
      result.breakdown.push({
        factor: "OPR sum",
        weight: 3,
        redVal: redOprSum,
        blueVal: blueOprSum,
        redContrib: redOprSum,
        blueContrib: blueOprSum,
        edge: redOprSum > blueOprSum ? "red" : blueOprSum > redOprSum ? "blue" : "tie",
      });
      if (redOprSum > blueOprSum) result.redAdvantages.push(`OPR +${(redOprSum - blueOprSum).toFixed(1)}`);
      else if (blueOprSum > redOprSum) result.blueAdvantages.push(`OPR +${(blueOprSum - redOprSum).toFixed(1)}`);
    }
    if (redAllianceStats && blueAllianceStats) {
      const factors: { key: keyof TeamStatsSlice; label: string; weight: number }[] = [
        { key: "avgAuto", label: "Auto (avg)", weight: compositeWeights.auto },
        { key: "avgThroughput", label: "Throughput", weight: compositeWeights.throughput },
        { key: "avgAccuracy", label: "Accuracy %", weight: compositeWeights.accuracy },
        { key: "avgDefense", label: "Defense %", weight: compositeWeights.defense },
        { key: "climbRate", label: "Climb %", weight: compositeWeights.climb },
        { key: "autoClimbRate", label: "Auto climb %", weight: compositeWeights.autoClimb },
      ];
      for (const { key, label, weight } of factors) {
        const r = redAllianceStats[key] as number;
        const b = blueAllianceStats[key] as number;
        result.breakdown.push({
          factor: label,
          weight,
          redVal: r,
          blueVal: b,
          redContrib: r * weight,
          blueContrib: b * weight,
          edge: r > b ? "red" : b > r ? "blue" : "tie",
        });
        if (r > b) result.redAdvantages.push(`${label}: ${r.toFixed(1)} vs ${b.toFixed(1)}`);
        else if (b > r) result.blueAdvantages.push(`${label}: ${b.toFixed(1)} vs ${r.toFixed(1)}`);
      }
      result.compositeScoreRed =
        redAllianceStats.avgAuto * compositeWeights.auto +
        redAllianceStats.avgThroughput * compositeWeights.throughput +
        (redAllianceStats.avgAccuracy / 100) * compositeWeights.accuracy +
        (redAllianceStats.avgDefense / 100) * compositeWeights.defense +
        (redAllianceStats.climbRate / 100) * compositeWeights.climb +
        (redAllianceStats.autoClimbRate / 100) * compositeWeights.autoClimb;
      result.compositeScoreBlue =
        blueAllianceStats.avgAuto * compositeWeights.auto +
        blueAllianceStats.avgThroughput * compositeWeights.throughput +
        (blueAllianceStats.avgAccuracy / 100) * compositeWeights.accuracy +
        (blueAllianceStats.avgDefense / 100) * compositeWeights.defense +
        (blueAllianceStats.climbRate / 100) * compositeWeights.climb +
        (blueAllianceStats.autoClimbRate / 100) * compositeWeights.autoClimb;

      if (redOprSum == null || blueOprSum == null) {
        const total = result.compositeScoreRed + result.compositeScoreBlue;
        result.winProbability = total > 0 ? Math.round((result.compositeScoreRed / total) * 100) : 50;
        result.winner = result.winProbability > 55 ? "red" : result.winProbability < 45 ? "blue" : "tossup";
        const diff = Math.abs(result.compositeScoreRed - result.compositeScoreBlue);
        result.confidence = diff > 2 ? "Medium" : diff > 0.5 ? "Low" : "N/A";
      }
    }

    if (result.winner === "tossup") result.keyFactors.push("Match is highly competitive — small advantages could swing either way.");
    else result.keyFactors.push(`Prediction favors ${result.winner} alliance based on composite metrics.`);
    if (result.dataQuality.redMissing.length > 0 || result.dataQuality.blueMissing.length > 0) {
      result.keyFactors.push("Some teams lack scouting data — prediction confidence may be affected.");
    }
    if (redOprSum != null && blueOprSum != null && result.breakdown.length > 1) {
      result.keyFactors.push("TBA OPR provides statistical baseline; scouting adds game-specific nuance.");
    }

    return result;
  }, [
    redOprSum,
    blueOprSum,
    redAllianceStats,
    blueAllianceStats,
    redStatsCorrect,
    blueStatsCorrect,
    redTeamNums,
    blueTeamNums,
  ]);

  const excludeForSlot = (slot: "r1" | "r2" | "r3" | "b1" | "b2" | "b3") => {
    const all = [red1Id, red2Id, red3Id, blue1Id, blue2Id, blue3Id].filter((x): x is number => x != null);
    const exclude: Record<string, number[]> = {
      r1: [red2Id, red3Id, blue1Id, blue2Id, blue3Id].filter((x): x is number => x != null),
      r2: [red1Id, red3Id, blue1Id, blue2Id, blue3Id].filter((x): x is number => x != null),
      r3: [red1Id, red2Id, blue1Id, blue2Id, blue3Id].filter((x): x is number => x != null),
      b1: [red1Id, red2Id, red3Id, blue2Id, blue3Id].filter((x): x is number => x != null),
      b2: [red1Id, red2Id, red3Id, blue1Id, blue3Id].filter((x): x is number => x != null),
      b3: [red1Id, red2Id, red3Id, blue1Id, blue2Id].filter((x): x is number => x != null),
    };
    return exclude[slot];
  };

  const teamLink = (teamId: number) => `/events/${eventId}/teams/${teamId}`;

  const hasTeams = redTeamNums.length > 0 || blueTeamNums.length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-6xl mx-auto">
      <div className="space-y-1">
        <Link href={`/events/${eventId}/schedule`}>
          <Button variant="ghost" size="sm" className="-ml-1 text-muted-foreground hover:text-foreground" data-testid="button-back-schedule">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Matches
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground" data-testid="text-simulator-title">
          Match Simulator
        </h1>
        <p className="text-sm text-muted-foreground">
          {event?.name} · Pick teams to simulate a match prediction
        </p>
      </div>

      {/* Team pickers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Choose contenders</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select 3 teams per alliance to see the prediction
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">Red Alliance</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">1</span>
                  <div className="flex-1 min-w-[260px]">
                    <TeamSearchInput
                    eventTeams={eventTeams || []}
                    selectedTeamId={red1Id}
                    onSelectTeam={setRed1Id}
                    placeholder="Search Red 1..."
                    excludeTeamIds={excludeForSlot("r1")}
                    teamStats={rawTeamStats as any}
                    statRanges={statRanges}
                    tbaRanges={tbaRanges}
                  />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">2</span>
                  <div className="flex-1 min-w-[260px]">
                    <TeamSearchInput
                    eventTeams={eventTeams || []}
                    selectedTeamId={red2Id}
                    onSelectTeam={setRed2Id}
                    placeholder="Search Red 2..."
                    excludeTeamIds={excludeForSlot("r2")}
                    teamStats={rawTeamStats as any}
                    statRanges={statRanges}
                    tbaRanges={tbaRanges}
                  />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">3</span>
                  <div className="flex-1 min-w-[260px]">
                    <TeamSearchInput
                    eventTeams={eventTeams || []}
                    selectedTeamId={red3Id}
                    onSelectTeam={setRed3Id}
                    placeholder="Search Red 3..."
                    excludeTeamIds={excludeForSlot("r3")}
                    teamStats={rawTeamStats as any}
                    statRanges={statRanges}
                    tbaRanges={tbaRanges}
                  />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Blue Alliance</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">1</span>
                  <div className="flex-1 min-w-[260px]">
                    <TeamSearchInput
                    eventTeams={eventTeams || []}
                    selectedTeamId={blue1Id}
                    onSelectTeam={setBlue1Id}
                    placeholder="Search Blue 1..."
                    excludeTeamIds={excludeForSlot("b1")}
                    teamStats={rawTeamStats as any}
                    statRanges={statRanges}
                    tbaRanges={tbaRanges}
                  />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">2</span>
                  <div className="flex-1 min-w-[260px]">
                    <TeamSearchInput
                    eventTeams={eventTeams || []}
                    selectedTeamId={blue2Id}
                    onSelectTeam={setBlue2Id}
                    placeholder="Search Blue 2..."
                    excludeTeamIds={excludeForSlot("b2")}
                    teamStats={rawTeamStats as any}
                    statRanges={statRanges}
                    tbaRanges={tbaRanges}
                  />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">3</span>
                  <div className="flex-1 min-w-[260px]">
                    <TeamSearchInput
                    eventTeams={eventTeams || []}
                    selectedTeamId={blue3Id}
                    onSelectTeam={setBlue3Id}
                    placeholder="Search Blue 3..."
                    excludeTeamIds={excludeForSlot("b3")}
                    teamStats={rawTeamStats as any}
                    statRanges={statRanges}
                    tbaRanges={tbaRanges}
                  />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasTeams ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Swords className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="font-semibold text-lg">Pick your teams</p>
            <p className="text-sm text-muted-foreground mt-1">
              Select Red and Blue alliance teams above to see the match prediction.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Alliance display */}
          <div
            className="grid items-stretch gap-0 rounded-xl overflow-hidden border border-border"
            style={{ gridTemplateColumns: "1fr auto 1fr" }}
          >
            <div className="p-4 bg-red-500/5 dark:bg-red-500/8">
              <p className="text-sm font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-3">Red Alliance</p>
              <div className="space-y-2">
                {redTeamNums.map((num) => {
                  const team = eventTeams?.find((e) => e.team.teamNumber === num)?.team;
                  const et = eventTeams?.find((e) => e.team.teamNumber === num);
                  const stats = et ? teamStats.get(et.teamId) ?? null : null;
                  return (
                    <Link key={num} href={et ? teamLink(et.team.id) : "#"}>
                      <div className="flex items-center gap-2.5 py-1.5 hover:opacity-80 transition-opacity cursor-pointer">
                        <img src={team?.avatar || placeholderAvatar} alt="" className="w-7 h-7 rounded-full border border-border object-cover bg-white shrink-0" />
                        <div>
                          <p className="font-bold text-sm">{num}</p>
                          <p className="text-muted-foreground truncate text-xs">{team?.teamName || "Unknown"}</p>
                          {stats && (
                            <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5 text-[10px] text-muted-foreground">
                              <span>Auto: {stats.avgAuto.toFixed(1)}</span>
                              <span>TP: {stats.avgThroughput.toFixed(1)}</span>
                              <span>Climb: {Math.round(stats.climbRate)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {redTeamNums.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              </div>
              {redAllianceStats && (
                <div className="mt-3 pt-2 border-t border-red-500/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Alliance avg</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0 text-[10px] text-muted-foreground">
                    <span>Auto {redAllianceStats.avgAuto.toFixed(1)}</span>
                    <span>TP {redAllianceStats.avgThroughput.toFixed(1)}</span>
                    <span>Acc {Math.round(redAllianceStats.avgAccuracy)}%</span>
                    <span>Climb {Math.round(redAllianceStats.climbRate)}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center px-3 bg-muted/30 border-x border-border">
              <Swords className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="p-4 bg-blue-500/5 dark:bg-blue-500/8">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-3">Blue Alliance</p>
              <div className="space-y-2">
                {blueTeamNums.map((num) => {
                  const team = eventTeams?.find((e) => e.team.teamNumber === num)?.team;
                  const et = eventTeams?.find((e) => e.team.teamNumber === num);
                  const stats = et ? teamStats.get(et.teamId) ?? null : null;
                  return (
                    <Link key={num} href={et ? teamLink(et.team.id) : "#"}>
                      <div className="flex items-center gap-2.5 py-1.5 hover:opacity-80 transition-opacity cursor-pointer">
                        <img src={team?.avatar || placeholderAvatar} alt="" className="w-7 h-7 rounded-full border border-border object-cover bg-white shrink-0" />
                        <div>
                          <p className="font-bold text-sm">{num}</p>
                          <p className="text-muted-foreground truncate text-xs">{team?.teamName || "Unknown"}</p>
                          {stats && (
                            <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5 text-[10px] text-muted-foreground">
                              <span>Auto: {stats.avgAuto.toFixed(1)}</span>
                              <span>TP: {stats.avgThroughput.toFixed(1)}</span>
                              <span>Climb: {Math.round(stats.climbRate)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {blueTeamNums.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              </div>
              {blueAllianceStats && (
                <div className="mt-3 pt-2 border-t border-blue-500/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Alliance avg</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0 text-[10px] text-muted-foreground">
                    <span>Auto {blueAllianceStats.avgAuto.toFixed(1)}</span>
                    <span>TP {blueAllianceStats.avgThroughput.toFixed(1)}</span>
                    <span>Acc {Math.round(blueAllianceStats.avgAccuracy)}%</span>
                    <span>Climb {Math.round(blueAllianceStats.climbRate)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Prediction section - same as match-detail */}
          <Separator className="my-10" />
          <section className="space-y-8" aria-label="Match prediction analysis">
            {/* Verdict */}
            <Card className={`overflow-hidden border-0 shadow-lg ${
              predictionAnalysis.winner === "tossup"
                ? "bg-muted dark:bg-muted/80 border border-border"
                : predictionAnalysis.winner === "red"
                  ? "bg-red-500/15 dark:bg-red-500/20 border border-red-500/30"
                  : "bg-blue-500/15 dark:bg-blue-500/20 border border-blue-500/30"
            }`}>
              <CardContent className="py-5 px-6">
                <div className="flex flex-col items-center justify-center text-center gap-2">
                  {predictionAnalysis.winner === "tossup" ? (
                    <>
                      <div className="rounded-full p-2 bg-muted/50">
                        <Swords className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xl font-bold tracking-tight text-muted-foreground">Toss-up</p>
                        <p className="text-sm font-medium text-muted-foreground/70 mt-0.5">50% Favoured</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`rounded-full p-2 ${
                        predictionAnalysis.winner === "red" ? "bg-red-500/25 dark:bg-red-500/30" : "bg-blue-500/25 dark:bg-blue-500/30"
                      }`}>
                        <Trophy className={`h-7 w-7 ${predictionAnalysis.winner === "red" ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`} />
                      </div>
                      <div>
                        <p className={`text-2xl font-bold tracking-tight ${
                          predictionAnalysis.winner === "red" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                        }`}>
                          {predictionAnalysis.winner === "red" ? "Red" : "Blue"} Alliance
                        </p>
                        <p className={`text-sm font-semibold mt-0.5 tabular-nums ${
                          predictionAnalysis.winner === "red" ? "text-red-600/90 dark:text-red-400/90" : "text-blue-600/90 dark:text-blue-400/90"
                        }`}>
                          {(predictionAnalysis.winner === "red" ? predictionAnalysis.winProbability : 100 - predictionAnalysis.winProbability)}% Favoured
                        </p>
                      </div>
                      <div className="w-full max-w-[200px] h-1.5 rounded-full bg-black/40 dark:bg-black/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${predictionAnalysis.winner === "red" ? "bg-red-500 dark:bg-red-400" : "bg-blue-500 dark:bg-blue-400"}`}
                          style={{ width: `${predictionAnalysis.winner === "red" ? predictionAnalysis.winProbability : 100 - predictionAnalysis.winProbability}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Overall Alliance Stats */}
            {(redAllianceStats || blueAllianceStats || redOprSum != null || blueOprSum != null) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-foreground">Overall Alliance Stats</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">Red vs Blue alliance averages</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="rounded-md border overflow-auto bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-border bg-muted/60 hover:bg-muted/60">
                          <TableHead className="w-24 text-sm font-bold text-foreground h-11">Alliance</TableHead>
                          <TableHead className="text-right text-sm font-bold text-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild><span className="cursor-help">OPR</span></TooltipTrigger>
                              <TooltipContent>Offensive Power Rating sum (TBA)</TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="text-right text-sm font-bold text-foreground">Auto</TableHead>
                          <TableHead className="text-right text-sm font-bold text-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild><span className="cursor-help">TP</span></TooltipTrigger>
                              <TooltipContent>Throughput (balls/min in teleop)</TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="text-right text-sm font-bold text-foreground">Acc %</TableHead>
                          <TableHead className="text-right text-sm font-bold text-foreground">Def %</TableHead>
                          <TableHead className="text-right text-sm font-bold text-foreground">Climb %</TableHead>
                          <TableHead className="text-right text-sm font-bold text-foreground">Auto Climb %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className={`h-12 border-b border-border bg-red-500/5 hover:bg-red-500/10 transition-colors ${predictionAnalysis.winner === "red" ? "ring-2 ring-red-500/60 ring-inset" : ""}`}>
                          <TableCell className="font-medium font-mono font-bold text-base text-red-500 dark:text-red-400">Red</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-red-500 dark:text-red-400">{redOprSum != null ? redOprSum.toFixed(1) : <span className="text-red-500/70 dark:text-red-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-red-500 dark:text-red-400">{redAllianceStats ? redAllianceStats.avgAuto.toFixed(1) : <span className="text-red-500/70 dark:text-red-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-red-500 dark:text-red-400">{redAllianceStats ? redAllianceStats.avgThroughput.toFixed(1) : <span className="text-red-500/70 dark:text-red-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-red-500 dark:text-red-400">{redAllianceStats ? `${Math.round(redAllianceStats.avgAccuracy)}%` : <span className="text-red-500/70 dark:text-red-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-red-500 dark:text-red-400">{redAllianceStats ? `${Math.round(redAllianceStats.avgDefense)}%` : <span className="text-red-500/70 dark:text-red-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-red-500 dark:text-red-400">{redAllianceStats ? `${Math.round(redAllianceStats.climbRate)}%` : <span className="text-red-500/70 dark:text-red-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-red-500 dark:text-red-400">{redAllianceStats ? `${Math.round(redAllianceStats.autoClimbRate)}%` : <span className="text-red-500/70 dark:text-red-400/70">—</span>}</TableCell>
                        </TableRow>
                        <TableRow className={`h-12 border-b border-border bg-blue-500/5 hover:bg-blue-500/10 transition-colors ${predictionAnalysis.winner === "blue" ? "ring-2 ring-blue-500/60 ring-inset" : ""}`}>
                          <TableCell className="font-medium font-mono font-bold text-base text-blue-500 dark:text-blue-400">Blue</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-blue-500 dark:text-blue-400">{blueOprSum != null ? blueOprSum.toFixed(1) : <span className="text-blue-500/70 dark:text-blue-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-blue-500 dark:text-blue-400">{blueAllianceStats ? blueAllianceStats.avgAuto.toFixed(1) : <span className="text-blue-500/70 dark:text-blue-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-blue-500 dark:text-blue-400">{blueAllianceStats ? blueAllianceStats.avgThroughput.toFixed(1) : <span className="text-blue-500/70 dark:text-blue-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-blue-500 dark:text-blue-400">{blueAllianceStats ? `${Math.round(blueAllianceStats.avgAccuracy)}%` : <span className="text-blue-500/70 dark:text-blue-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-blue-500 dark:text-blue-400">{blueAllianceStats ? `${Math.round(blueAllianceStats.avgDefense)}%` : <span className="text-blue-500/70 dark:text-blue-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-blue-500 dark:text-blue-400">{blueAllianceStats ? `${Math.round(blueAllianceStats.climbRate)}%` : <span className="text-blue-500/70 dark:text-blue-400/70">—</span>}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-blue-500 dark:text-blue-400">{blueAllianceStats ? `${Math.round(blueAllianceStats.autoClimbRate)}%` : <span className="text-blue-500/70 dark:text-blue-400/70">—</span>}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Per-Team Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">Per-Team Stats</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">Individual metrics for each team</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-md border overflow-auto bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-border bg-muted/60 hover:bg-muted/60">
                        <TableHead className="w-24 text-sm font-bold text-foreground h-11">Team</TableHead>
                        <TableHead className="text-right text-sm font-bold text-foreground">Auto</TableHead>
                        <TableHead className="text-right text-sm font-bold text-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-help">TP</span></TooltipTrigger>
                            <TooltipContent>Throughput (balls/min in teleop)</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead className="text-right text-sm font-bold text-foreground">Acc %</TableHead>
                        <TableHead className="text-right text-sm font-bold text-foreground">Def %</TableHead>
                        <TableHead className="text-right text-sm font-bold text-foreground">Climb %</TableHead>
                        <TableHead className="text-right text-sm font-bold text-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-help">OPR</span></TooltipTrigger>
                            <TooltipContent>Offensive Power Rating (TBA)</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead className="text-right text-sm font-bold text-foreground">Scouted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...redTeamNums, ...blueTeamNums].map((num, idx) => {
                        const isRed = idx < redTeamNums.length;
                        const et = eventTeams?.find((e) => e.team.teamNumber === num);
                        const stats = et ? teamStats.get(et.teamId) ?? null : null;
                        const opr = et ? (et as EtExtended).opr : null;
                        const rowBg = isRed ? "bg-red-500/5 hover:bg-red-500/10" : "bg-blue-500/5 hover:bg-blue-500/10";
                        const textCls = isRed ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400";
                        const mutedCls = isRed ? "text-red-500/70 dark:text-red-400/70" : "text-blue-500/70 dark:text-blue-400/70";
                        const isPredictedWinner = predictionAnalysis.winner !== "tossup" && ((isRed && predictionAnalysis.winner === "red") || (!isRed && predictionAnalysis.winner === "blue"));
                        const posInAlliance = isRed ? idx : idx - redTeamNums.length;
                        const isFirstInAlliance = posInAlliance === 0;
                        const isLastInAlliance = isRed ? posInAlliance === redTeamNums.length - 1 : posInAlliance === blueTeamNums.length - 1;
                        const winnerBlockBorder = isPredictedWinner
                          ? (isRed
                            ? `${isFirstInAlliance ? "border-t-2 " : ""}border-l-2 border-r-2 border-red-500/60${isLastInAlliance ? " border-b-2" : ""}`
                            : `${isFirstInAlliance ? "border-t-2 " : ""}border-l-2 border-r-2 border-blue-500/60${isLastInAlliance ? " border-b-2" : ""}`)
                          : "";
                        return (
                          <TableRow key={`${num}-${isRed ? "r" : "b"}`} className={`h-12 cursor-pointer border-b border-border transition-colors ${rowBg} ${winnerBlockBorder}`} onClick={() => et && navigate(teamLink(et.team.id))}>
                            <TableCell className={`font-medium ${textCls}`}>
                              <Link href={et ? teamLink(et.team.id) : "#"} className={`font-mono font-bold text-base hover:underline ${isRed ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`} onClick={(e) => e.stopPropagation()}>
                                {num}
                              </Link>
                            </TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${textCls}`}>{stats ? stats.avgAuto.toFixed(1) : <span className={mutedCls}>—</span>}</TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${textCls}`}>{stats ? stats.avgThroughput.toFixed(1) : <span className={mutedCls}>—</span>}</TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${textCls}`}>{stats ? `${Math.round(stats.avgAccuracy)}%` : <span className={mutedCls}>—</span>}</TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${textCls}`}>{stats ? `${Math.round(stats.avgDefense)}%` : <span className={mutedCls}>—</span>}</TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${textCls}`}>{stats ? `${Math.round(stats.climbRate)}%` : <span className={mutedCls}>—</span>}</TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${textCls}`}>{opr != null ? opr.toFixed(1) : <span className={mutedCls}>—</span>}</TableCell>
                            <TableCell className={`text-right tabular-nums font-medium ${textCls}`}>{stats ? stats.entries : <span className={mutedCls}>0</span>}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableCaption className="text-xs text-muted-foreground py-3">Click a team number to view full profile.</TableCaption>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Advantages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-l-4 border-l-red-500/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-red-700 dark:text-red-400">Red Alliance Advantages</CardTitle>
                </CardHeader>
                <CardContent>
                  {predictionAnalysis.redAdvantages.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {predictionAnalysis.redAdvantages.map((a, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-red-500 shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No significant advantages identified.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-blue-700 dark:text-blue-400">Blue Alliance Advantages</CardTitle>
                </CardHeader>
                <CardContent>
                  {predictionAnalysis.blueAdvantages.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {predictionAnalysis.blueAdvantages.map((a, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No significant advantages identified.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Data Quality & Key Factors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Data Quality
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-red-600 dark:text-red-400">Red alliance</p>
                    <p className="text-muted-foreground">{predictionAnalysis.dataQuality.redScouted} matches scouted total</p>
                    {predictionAnalysis.dataQuality.redMissing.length > 0 && (
                      <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">Missing data: {predictionAnalysis.dataQuality.redMissing.join(", ")}</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-blue-600 dark:text-blue-400">Blue alliance</p>
                    <p className="text-muted-foreground">{predictionAnalysis.dataQuality.blueScouted} matches scouted total</p>
                    {predictionAnalysis.dataQuality.blueMissing.length > 0 && (
                      <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">Missing data: {predictionAnalysis.dataQuality.blueMissing.join(", ")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-foreground">Key Factors</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {predictionAnalysis.keyFactors.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
