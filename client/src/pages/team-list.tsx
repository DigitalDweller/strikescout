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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, ArrowUpDown, List, AlertCircle, AlertTriangle } from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { Button } from "@/components/ui/button";
import { RankingColorKey } from "@/components/ranking-color-key";
import { useRuffles } from "@/contexts/ruffles";
import type { Event, Team, ScoutingEntry, EventTeam } from "@shared/schema";
import { getHeatColor, getDominantColor, computeTeamStats, computeStatRanges, computeTbaRanges, computeSzrMap, parseSzrWeights } from "@/lib/team-colors";

type SortField = "teamNumber" | "teamName" | "opr" | "szr" | "rank" | "avgAuto" | "avgThroughput" | "avgAccuracy" | "avgDefense" | "climbRate" | "entries";
type SortDir = "asc" | "desc";

const TEAM_SEARCH_EASTER_EGG = "5460";

export default function TeamList() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { triggerSpawn } = useRuffles();
  const help = useHelp();
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

  const { data: eventTeams, isLoading: teamsLoading, isError: teamsError } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
    enabled: !!eventId,
  });

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
    enabled: !!eventId,
  });

  const teams = Array.isArray(eventTeams) ? eventTeams.map(et => et.team) : [];
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
    return eventTeams.some(et => (et as any).opr != null || (et as any).rank != null);
  }, [eventTeams]);

  const teamStats = useMemo(() => computeTeamStats(teams, entries || []), [teams, entries]);
  const statRanges = useMemo(() => computeStatRanges(teamStats), [teamStats]);
  const tbaRanges = useMemo(() => computeTbaRanges(eventTeams || []), [eventTeams]);
  const szrWeights = useMemo(() => parseSzrWeights(event?.szrWeights), [event?.szrWeights]);
  const szrMap = useMemo(() => computeSzrMap(teams, entries || [], statRanges, szrWeights), [teams, entries, statRanges, szrWeights]);

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
        case "szr": valA = szrMap.get(a.id) ?? 0; valB = szrMap.get(b.id) ?? 0; break;
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
  }, [teams, search, sortField, sortDir, teamStats, eventTeamMap, szrMap]);

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
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          Team List
          {help?.HelpTrigger?.({
            content: {
              title: "Team list",
              body: <p>All teams at this event. Sort by any column (click header). Use search to find teams by number or name. Colors show performance: green = strong, red = weak.</p>,
            },
          })}
        </h1>
        <p className="text-muted-foreground text-base mt-1">
          {event ? `Teams at ${event.name}` : "Loading..."} — {filteredTeams.length} teams
        </p>
        <RankingColorKey className="mt-2" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by team number or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-team-search"
          />
        </div>
        <div className="flex items-center gap-1.5">
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[180px]" data-testid="select-sort-field">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="teamNumber">Team Number</SelectItem>
            <SelectItem value="teamName">Team Name</SelectItem>
            <SelectItem value="szr">SZR</SelectItem>
            {hasTbaData && <SelectItem value="opr">OPR</SelectItem>}
            {hasTbaData && <SelectItem value="rank">Seed</SelectItem>}
            <SelectItem value="avgAuto">Avg Auto</SelectItem>
            <SelectItem value="avgThroughput">Throughput</SelectItem>
            <SelectItem value="avgAccuracy">Avg Accuracy</SelectItem>
            <SelectItem value="avgDefense">Avg Defense</SelectItem>
            <SelectItem value="climbRate">Climb Rate</SelectItem>
          </SelectContent>
        </Select>
        {help?.HelpTrigger?.({
          content: {
            title: "Sort by",
            body: <p>Choose how to sort the team list. Click column headers to reverse order. OPR, Rank, and Seed come from TBA. SZR is from your scouting data.</p>,
          },
        })}
      </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : teamsError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium text-destructive">Failed to load teams</p>
            <p className="text-sm text-muted-foreground mt-1">Check the event exists and try again.</p>
          </CardContent>
        </Card>
      ) : filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <List className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No teams found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search term" : "No teams have been added yet. Sync teams from TBA in Event Settings."}
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
                    <SortableHeader field="szr">
                      <Tooltip>
                        <TooltipTrigger asChild><span className="cursor-help">SZR</span></TooltipTrigger>
                        <TooltipContent>Strike Zone Rating — scouting-derived team strength (0–100)</TooltipContent>
                      </Tooltip>
                    </SortableHeader>
                    {hasTbaData && <SortableHeader field="opr">OPR</SortableHeader>}
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
                    const szrVal = szrMap.get(team.id) ?? 0;
                    const szrColorVal = szrVal > 0 ? getHeatColor(szrVal, 0, 100) : "";
                    const seedColorVal = seed != null && tbaRanges?.seed ? getHeatColor(tbaRanges.seed.max - seed + tbaRanges.seed.min, tbaRanges.seed.min, tbaRanges.seed.max) : "";
                    const dominant = getDominantColor([szrColorVal, oprColorVal, seedColorVal, autoColor, throughputColor, accuracyColor, defenseColor, climbColor]);

                    const hasTbaForTeam = opr != null || seed != null;
                    const hasScoutingForTeam = (stats?.entries || 0) > 0;
                    const showNoTbaIcon = !hasTbaForTeam;
                    const showNoScoutingIcon = !hasScoutingForTeam;

                    return (
                      <TableRow key={team.id} data-testid={`row-team-${team.id}`} className="h-12 cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/events/${eventId}/teams/${team.id}`)}>
                        <TableCell className={dominant}>
                          <div className="flex items-center gap-2">
                            {showNoTbaIcon && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex shrink-0 cursor-help">
                                    <AlertCircle className="h-4 w-4 text-blue-500 dark:text-blue-400" aria-hidden />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>No Blue Alliance (TBA) data yet</TooltipContent>
                              </Tooltip>
                            )}
                            {showNoScoutingIcon && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex shrink-0 cursor-help">
                                    <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" aria-hidden />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>No scouting data yet</TooltipContent>
                              </Tooltip>
                            )}
                            <img src={team.avatar || placeholderAvatar} alt="" className="w-7 h-7 rounded-full border border-border object-cover bg-white shrink-0" />
                            <span className="font-bold text-base">
                              {team.teamNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={`font-semibold text-base ${dominant}`}>{team.teamName}</TableCell>
                        <TableCell className={`text-center font-bold text-base ${szrColorVal}`} data-testid={`stat-szr-${team.id}`}>
                          {hasData ? szrVal : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        {hasTbaData && (
                          <TableCell className={`text-center font-bold text-base ${oprColorVal}`} data-testid={`stat-opr-${team.id}`}>
                            {opr != null ? opr.toFixed(1) : <span className="text-muted-foreground/40">-</span>}
                          </TableCell>
                        )}
                        {hasTbaData && (
                          <TableCell className={`text-center font-bold text-base ${seedColorVal}`} data-testid={`stat-seed-${team.id}`}>
                            {seed != null ? `#${seed}` : <span className="text-muted-foreground/40">-</span>}
                          </TableCell>
                        )}
                        <TableCell className={`text-center font-bold text-base ${autoColor}`} data-testid={`stat-auto-${team.id}`}>
                          {hasData ? autoVal : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${throughputColor}`} data-testid={`stat-throughput-${team.id}`}>
                          {hasData ? throughputVal : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${accuracyColor}`} data-testid={`stat-accuracy-${team.id}`}>
                          {hasData ? <>{accuracyVal}<span className="text-xs text-muted-foreground">%</span></> : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${defenseColor}`} data-testid={`stat-defense-${team.id}`}>
                          {hasData ? <>{defenseVal}<span className="text-xs text-muted-foreground">%</span></> : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${climbColor}`} data-testid={`stat-climb-${team.id}`}>
                          {hasData ? <>{climbVal}<span className="text-xs text-muted-foreground">%</span></> : <span className="text-muted-foreground/40">—</span>}
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

      {search.trim() === TEAM_SEARCH_EASTER_EGG && (
        <div className="flex justify-center pt-10 pb-12 px-16 sm:px-24 min-h-[220px] items-center overflow-visible">
          <Button
            variant="outline"
            onClick={triggerSpawn}
            className="ruffles-btn ruffles-btn-big animate-ruffles-glow-pulse animate-ruffles-reveal-below border-0 shadow-none hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <span className="ruffles-btn-text">Ruffles</span>
          </Button>
        </div>
      )}
    </div>
  );
}
