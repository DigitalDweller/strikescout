import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

type SortField = "teamNumber" | "teamName" | "avgAuto" | "avgThroughput" | "avgAccuracy" | "avgDefense" | "climbRate" | "entries";
type SortDir = "asc" | "desc";

export default function TeamList() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("teamNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      return res.json();
    },
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

  const filteredTeams = useMemo(() => {
    let list = teams.filter(t => {
      const q = search.toLowerCase();
      return !q ||
        t.teamNumber.toString().includes(q) ||
        t.teamName.toLowerCase().includes(q) ||
        (t.city && t.city.toLowerCase().includes(q));
    });

    list.sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      switch (sortField) {
        case "teamNumber": valA = a.teamNumber; valB = b.teamNumber; break;
        case "teamName": valA = a.teamName.toLowerCase(); valB = b.teamName.toLowerCase(); break;
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
  }, [teams, search, sortField, sortDir, teamStats]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
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
            placeholder="Search by team number, name, or city..."
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
                    <TableHead>Location</TableHead>
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
                    return (
                      <TableRow key={team.id} data-testid={`row-team-${team.id}`} className="h-12 cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/events/${eventId}/teams/${team.id}`)}>
                        <TableCell>
                          <span className="font-bold text-base text-primary">
                            {team.teamNumber}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-base">{team.teamName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {[team.city, team.stateProv].filter(Boolean).join(", ") || "-"}
                        </TableCell>
                        <TableCell className="text-center font-bold text-base">{stats?.avgAuto?.toFixed(1) || "0.0"}</TableCell>
                        <TableCell className="text-center font-bold text-base">{stats?.avgThroughput?.toFixed(1) || "0.0"}</TableCell>
                        <TableCell className="text-center font-bold text-base">{Math.round(stats?.avgAccuracy || 0)}<span className="text-xs text-muted-foreground">%</span></TableCell>
                        <TableCell className="text-center font-bold text-base">{Math.round(stats?.avgDefense || 0)}<span className="text-xs text-muted-foreground">%</span></TableCell>
                        <TableCell className="text-center font-bold text-base">{stats?.climbRate?.toFixed(0) || "0"}<span className="text-xs text-muted-foreground">%</span></TableCell>
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
