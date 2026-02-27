import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import placeholderAvatar from "@assets/images_1772071870956.png";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, List } from "lucide-react";
import type { Event, Team, ScoutingEntry, EventTeam } from "@shared/schema";

type SortField = "teamNumber" | "teamName" | "opr" | "rankingPoints" | "rank" | "avgAuto" | "avgThroughput" | "avgAccuracy" | "avgDefense" | "climbRate" | "entries";
type SortDir = "asc" | "desc";

function getHeatColor(value: number, min: number, max: number) {
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

function getDominantColor(colors: string[]): string {
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

export default function TeamList() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const [search, _setSearch] = useState(() => sessionStorage.getItem(`teams-search-${eventId}`) || "");
  const [sortField, _setSortField] = useState<SortField>(() => (sessionStorage.getItem(`teams-sort-${eventId}`) as SortField) || "teamNumber");
  const [sortDir, _setSortDir] = useState<SortDir>(() => (sessionStorage.getItem(`teams-dir-${eventId}`) as SortDir) || "asc");

  const setSearch = useCallback((v: string) => { sessionStorage.setItem(`teams-search-${eventId}`, v); _setSearch(v); }, [eventId]);
  const setSortField = useCallback((v: SortField) => { sessionStorage.setItem(`teams-sort-${eventId}`, v); _setSortField(v); }, [eventId]);
  const setSortDir = useCallback((v: SortDir) => { sessionStorage.setItem(`teams-dir-${eventId}`, v); _setSortDir(v); }, [eventId]);

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: eventTeams, isLoading: teamsLoading } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
    enabled: !!eventId,
  });

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
    enabled: !!eventId,
  });

  const teams = eventTeams ? eventTeams.map(et => et.team) : [];
  const isLoading = teamsLoading;

  const eventTeamMap = useMemo(() => {
    const map = new Map<number, EventTeam & { team: Team }>();
    if (eventTeams) {
      for (const et of eventTeams) {
        map.set(et.teamId, et);
      }
    }
    return map;
  }, [eventTeams]);

  const hasTbaData = useMemo(() => {
    if (!eventTeams) return false;
    return eventTeams.some(et => (et as any).opr != null || (et as any).rankingPoints != null);
  }, [eventTeams]);

  const teamStats = useMemo(() => {
    if (!entries || !teams) return new Map();
    const map = new Map<number, {
      avgAuto: number;
      avgThroughput: number;
      avgAccuracy: number;
      avgDefense: number;
      climbRate: number;
      entries: number;
    }>();

    for (const team of teams) {
      const teamEntries = entries.filter(e => e.teamId === team.id);
      const count = teamEntries.length;
      if (count === 0) {
        map.set(team.id, { avgAuto: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, climbRate: 0, entries: 0 });
      } else {
        map.set(team.id, {
          avgAuto: teamEntries.reduce((s, e) => s + e.autoBallsShot, 0) / count,
          avgThroughput: teamEntries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count,
          avgAccuracy: teamEntries.reduce((s, e) => s + e.teleopAccuracy, 0) / count * 10,
          avgDefense: teamEntries.reduce((s, e) => s + e.defenseRating, 0) / count * 10,
          climbRate: teamEntries.filter(e => e.climbSuccess === "success").length / count * 100,
          entries: count,
        });
      }
    }
    return map;
  }, [entries, teams]);

  const statRanges = useMemo(() => {
    const allStats = [...teamStats.values()].filter(s => s.entries > 0);
    if (allStats.length === 0) return null;
    return {
      auto: { min: Math.min(...allStats.map(s => s.avgAuto)), max: Math.max(...allStats.map(s => s.avgAuto)) },
      throughput: { min: Math.min(...allStats.map(s => s.avgThroughput)), max: Math.max(...allStats.map(s => s.avgThroughput)) },
      accuracy: { min: Math.min(...allStats.map(s => s.avgAccuracy)), max: Math.max(...allStats.map(s => s.avgAccuracy)) },
      defense: { min: Math.min(...allStats.map(s => s.avgDefense)), max: Math.max(...allStats.map(s => s.avgDefense)) },
      climb: { min: Math.min(...allStats.map(s => s.climbRate)), max: Math.max(...allStats.map(s => s.climbRate)) },
    };
  }, [teamStats]);

  const tbaRanges = useMemo(() => {
    if (!eventTeams) return null;
    const oprs = eventTeams.map(et => (et as any).opr).filter((v: any) => v != null) as number[];
    const rps = eventTeams.map(et => (et as any).rankingPoints).filter((v: any) => v != null) as number[];
    const seeds = eventTeams.map(et => (et as any).rank).filter((v: any) => v != null) as number[];
    if (oprs.length === 0 && rps.length === 0 && seeds.length === 0) return null;
    return {
      opr: oprs.length > 0 ? { min: Math.min(...oprs), max: Math.max(...oprs) } : null,
      rp: rps.length > 0 ? { min: Math.min(...rps), max: Math.max(...rps) } : null,
      seed: seeds.length > 0 ? { min: Math.min(...seeds), max: Math.max(...seeds) } : null,
    };
  }, [eventTeams]);

  const filteredTeams = useMemo(() => {
    let list = teams.filter(t => {
      const q = search.toLowerCase();
      return !q ||
        t.teamNumber.toString().includes(q) ||
        t.teamName.toLowerCase().includes(q);
    });

    list.sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      switch (sortField) {
        case "teamNumber": valA = a.teamNumber; valB = b.teamNumber; break;
        case "teamName": valA = a.teamName.toLowerCase(); valB = b.teamName.toLowerCase(); break;
        case "opr": valA = (eventTeamMap.get(a.id) as any)?.opr || 0; valB = (eventTeamMap.get(b.id) as any)?.opr || 0; break;
        case "rankingPoints": valA = (eventTeamMap.get(a.id) as any)?.rankingPoints || 0; valB = (eventTeamMap.get(b.id) as any)?.rankingPoints || 0; break;
        case "rank": valA = (eventTeamMap.get(a.id) as any)?.rank || 999; valB = (eventTeamMap.get(b.id) as any)?.rank || 999; break;
        case "avgAuto": valA = teamStats.get(a.id)?.avgAuto || 0; valB = teamStats.get(b.id)?.avgAuto || 0; break;
        case "avgThroughput": valA = teamStats.get(a.id)?.avgThroughput || 0; valB = teamStats.get(b.id)?.avgThroughput || 0; break;
        case "avgAccuracy": valA = teamStats.get(a.id)?.avgAccuracy || 0; valB = teamStats.get(b.id)?.avgAccuracy || 0; break;
        case "avgDefense": valA = teamStats.get(a.id)?.avgDefense || 0; valB = teamStats.get(b.id)?.avgDefense || 0; break;
        case "climbRate": valA = teamStats.get(a.id)?.climbRate || 0; valB = teamStats.get(b.id)?.climbRate || 0; break;
        case "entries": valA = teamStats.get(a.id)?.entries || 0; valB = teamStats.get(b.id)?.entries || 0; break;
        default: valA = a.teamNumber; valB = b.teamNumber;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [teams, search, sortField, sortDir, teamStats, eventTeamMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      const next = sortDir === "asc" ? "desc" : "asc";
      setSortDir(next);
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => toggleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Team List</h1>
        <p className="text-muted-foreground text-base mt-1">
          {event ? `Teams at ${event.name}` : "Loading..."} — {filteredTeams.length} teams
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by team number or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-team-search"
          />
        </div>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[180px]" data-testid="select-sort-field">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="teamNumber">Team Number</SelectItem>
            <SelectItem value="teamName">Team Name</SelectItem>
            {hasTbaData && <SelectItem value="opr">OPR</SelectItem>}
            {hasTbaData && <SelectItem value="rankingPoints">Ranking Points</SelectItem>}
            {hasTbaData && <SelectItem value="rank">Seed</SelectItem>}
            <SelectItem value="avgAuto">Avg Auto</SelectItem>
            <SelectItem value="avgThroughput">Throughput</SelectItem>
            <SelectItem value="avgAccuracy">Avg Accuracy</SelectItem>
            <SelectItem value="avgDefense">Avg Defense</SelectItem>
            <SelectItem value="climbRate">Climb Rate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <List className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No teams found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search term" : "No teams have been added yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="teamNumber">#</SortableHeader>
                    <SortableHeader field="teamName">Name</SortableHeader>
                    {hasTbaData && <SortableHeader field="opr">OPR</SortableHeader>}
                    {hasTbaData && <SortableHeader field="rankingPoints">RP</SortableHeader>}
                    {hasTbaData && <SortableHeader field="rank">Seed</SortableHeader>}
                    <SortableHeader field="avgAuto">Auto</SortableHeader>
                    <SortableHeader field="avgThroughput">Throughput</SortableHeader>
                    <SortableHeader field="avgAccuracy">Accuracy</SortableHeader>
                    <SortableHeader field="avgDefense">Defense</SortableHeader>
                    <SortableHeader field="climbRate">Climb</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map(team => {
                    const stats = teamStats.get(team.id);
                    const et = eventTeamMap.get(team.id);
                    const opr = (et as any)?.opr;
                    const rp = (et as any)?.rankingPoints;
                    const seed = (et as any)?.rank;
                    const hasData = (stats?.entries || 0) > 0;
                    const autoVal = parseFloat((stats?.avgAuto || 0).toFixed(1));
                    const throughputVal = parseFloat((stats?.avgThroughput || 0).toFixed(1));
                    const accuracyVal = Math.round(stats?.avgAccuracy || 0);
                    const defenseVal = Math.round(stats?.avgDefense || 0);
                    const climbVal = Math.round(stats?.climbRate || 0);

                    const autoColor = hasData && statRanges ? getHeatColor(stats!.avgAuto, statRanges.auto.min, statRanges.auto.max) : "";
                    const throughputColor = hasData && statRanges ? getHeatColor(stats!.avgThroughput, statRanges.throughput.min, statRanges.throughput.max) : "";
                    const accuracyColor = hasData && statRanges ? getHeatColor(stats!.avgAccuracy, statRanges.accuracy.min, statRanges.accuracy.max) : "";
                    const defenseColor = hasData && statRanges ? getHeatColor(stats!.avgDefense, statRanges.defense.min, statRanges.defense.max) : "";
                    const climbColor = hasData && statRanges ? getHeatColor(stats!.climbRate, statRanges.climb.min, statRanges.climb.max) : "";

                    const oprColorVal = opr != null && tbaRanges?.opr ? getHeatColor(opr, tbaRanges.opr.min, tbaRanges.opr.max) : "";
                    const rpColorVal = rp != null && tbaRanges?.rp ? getHeatColor(rp, tbaRanges.rp.min, tbaRanges.rp.max) : "";
                    const seedColorVal = seed != null && tbaRanges?.seed ? getHeatColor(tbaRanges.seed.max - seed + tbaRanges.seed.min, tbaRanges.seed.min, tbaRanges.seed.max) : "";
                    const dominant = getDominantColor([oprColorVal, rpColorVal, seedColorVal, autoColor, throughputColor, accuracyColor, defenseColor, climbColor]);

                    return (
                      <TableRow key={team.id} data-testid={`row-team-${team.id}`} className="h-12 cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/events/${eventId}/teams/${team.id}`)}>
                        <TableCell className={dominant}>
                          <div className="flex items-center gap-2">
                            <img src={team.avatar || placeholderAvatar} alt="" className="w-7 h-7 rounded-full border border-border object-cover bg-white shrink-0" />
                            <span className="font-bold text-base">
                              {team.teamNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={`font-semibold text-base ${dominant}`}>{team.teamName}</TableCell>
                        {hasTbaData && (
                          <TableCell className={`text-center font-bold text-base ${oprColorVal}`} data-testid={`stat-opr-${team.id}`}>
                            {opr != null ? opr.toFixed(1) : <span className="text-muted-foreground/40">-</span>}
                          </TableCell>
                        )}
                        {hasTbaData && (
                          <TableCell className={`text-center font-bold text-base ${rpColorVal}`} data-testid={`stat-rp-${team.id}`}>
                            {rp != null ? rp.toFixed(2) : <span className="text-muted-foreground/40">-</span>}
                          </TableCell>
                        )}
                        {hasTbaData && (
                          <TableCell className={`text-center font-bold text-base ${seedColorVal}`} data-testid={`stat-seed-${team.id}`}>
                            {seed != null ? `#${seed}` : <span className="text-muted-foreground/40">-</span>}
                          </TableCell>
                        )}
                        <TableCell className={`text-center font-bold text-base ${autoColor}`} data-testid={`stat-auto-${team.id}`}>
                          {autoVal}
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${throughputColor}`} data-testid={`stat-throughput-${team.id}`}>
                          {throughputVal}
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${accuracyColor}`} data-testid={`stat-accuracy-${team.id}`}>
                          {accuracyVal}<span className="text-xs text-muted-foreground">%</span>
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${defenseColor}`} data-testid={`stat-defense-${team.id}`}>
                          {defenseVal}<span className="text-xs text-muted-foreground">%</span>
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${climbColor}`} data-testid={`stat-climb-${team.id}`}>
                          {climbVal}<span className="text-xs text-muted-foreground">%</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
