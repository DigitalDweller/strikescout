import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
import { Search, ArrowUpDown, User as UserIcon, Trophy } from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { RankingColorKey } from "@/components/ranking-color-key";
import type { Event } from "@shared/schema";
import { getHeatColor } from "@/lib/team-colors";

type ScouterRow = { id: number; displayName: string; entryCount: number; rep: number; eventsScouted: number };

type SortField = "displayName" | "rep" | "entries" | "events";
type SortDir = "asc" | "desc";

export default function ScouterLeaderboard() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const help = useHelp();
  const isAdmin = user?.role === "admin";
  const [search, _setSearch] = useState(() => sessionStorage.getItem(`scouter-leaderboard-search-${eventId}`) || "");
  const [sortField, _setSortField] = useState<SortField>(() => (sessionStorage.getItem(`scouter-leaderboard-sort-${eventId}`) as SortField) || "rep");
  const [sortDir, _setSortDir] = useState<SortDir>(() => (sessionStorage.getItem(`scouter-leaderboard-dir-${eventId}`) as SortDir) || "desc");

  const setSearch = useCallback((v: string) => { sessionStorage.setItem(`scouter-leaderboard-search-${eventId}`, v); _setSearch(v); }, [eventId]);
  const setSortField = useCallback((v: SortField) => { sessionStorage.setItem(`scouter-leaderboard-sort-${eventId}`, v); _setSortField(v); }, [eventId]);
  const setSortDir = useCallback((v: SortDir) => { sessionStorage.setItem(`scouter-leaderboard-dir-${eventId}`, v); _setSortDir(v); }, [eventId]);

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: scouters = [], isLoading } = useQuery<ScouterRow[]>({
    queryKey: ["/api/events", eventId, "scouters"],
    enabled: !!eventId,
  });

  const filteredScouters = useMemo(() => {
    let list = scouters.filter((s) => {
      if (s.entryCount === 0) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return s.displayName.toLowerCase().includes(q);
    });

    list.sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      switch (sortField) {
        case "displayName": valA = a.displayName; valB = b.displayName; break;
        case "rep": valA = a.rep; valB = b.rep; break;
        case "entries": valA = a.entryCount; valB = b.entryCount; break;
        case "events": valA = a.eventsScouted; valB = b.eventsScouted; break;
        default: valA = a.rep; valB = b.rep;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [scouters, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortableHeader = ({ field, children, center }: { field: SortField; children: React.ReactNode; center?: boolean }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 ${center ? "text-center" : ""}`}
      onClick={() => toggleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className={`flex items-center gap-1 ${center ? "justify-center" : ""}`}>
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  );

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto overflow-x-hidden">
        <h1 className="text-3xl font-bold tracking-tight mb-4" data-testid="text-page-title">
          Scouter Leaderboard
        </h1>
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Coming soon</p>
            <p className="text-sm text-muted-foreground mt-1">
              Scouter stats and rankings will be available here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          Scouter Leaderboard
          {help?.HelpTrigger?.({
            content: {
              title: "Scouter Leaderboard",
              body: <p>Individual scouter stats at this event. Same ranking colors as teams: blue = Sweep, green = Cooking, yellow = Mid, orange = Bad, red = Burnt. Click a row to view their scouting profile.</p>,
            },
          })}
        </h1>
        <p className="text-muted-foreground text-base mt-1">
          {event ? `Scouters at ${event.name}` : "Loading..."}
          {isAdmin && ` — ${filteredScouters.length} scouters with entries`}
        </p>
        {isAdmin && <RankingColorKey className="mt-2" variant="scouters" />}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-scouter-search"
          />
        </div>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[180px]" data-testid="select-sort-field">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="displayName">Name</SelectItem>
            <SelectItem value="rep">Rep</SelectItem>
            <SelectItem value="entries">Entries</SelectItem>
            <SelectItem value="events">Events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : filteredScouters.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <UserIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No scouters found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {scouters.filter((s) => s.entryCount > 0).length === 0
                ? "No scouting entries yet. Scouters will appear here once they submit data."
                : "No scouters match your search."}
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
                    <SortableHeader field="displayName">Scouter</SortableHeader>
                    <SortableHeader field="rep" center>Rep</SortableHeader>
                    <SortableHeader field="entries" center>Entries</SortableHeader>
                    <SortableHeader field="events" center>Events</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScouters.map((scouter) => {
                    const repMax = filteredScouters.length > 0 ? Math.max(...filteredScouters.map((s) => s.rep)) : 1;
                    const entriesMax = filteredScouters.length > 0 ? Math.max(...filteredScouters.map((s) => s.entryCount)) : 1;
                    const eventsMax = filteredScouters.length > 0 ? Math.max(...filteredScouters.map((s) => s.eventsScouted)) : 1;
                    const sweep = filteredScouters.length === 1;
                    const repColor = repMax > 0 ? getHeatColor(scouter.rep, 0, repMax, sweep && repMax > 0 ? repMax - 1e-6 : undefined) : "";
                    const entriesColor = entriesMax > 0 ? getHeatColor(scouter.entryCount, 0, entriesMax, sweep && entriesMax > 0 ? entriesMax - 1e-6 : undefined) : "";
                    const eventsColor = eventsMax > 0 ? getHeatColor(scouter.eventsScouted, 0, eventsMax, sweep && eventsMax > 0 ? eventsMax - 1e-6 : undefined) : "";

                    return (
                      <TableRow
                        key={scouter.id}
                        data-testid={`row-scouter-${scouter.id}`}
                        className="h-12 cursor-pointer hover:bg-accent/50"
                        onClick={() => navigate(`/events/${eventId}/scouters/${scouter.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
                              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="font-bold text-base">{scouter.displayName}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base ${repColor}`} data-testid={`stat-rep-${scouter.id}`}>
                          {scouter.rep}
                        </TableCell>
                        <TableCell className={`text-center font-medium ${entriesColor}`} data-testid={`stat-entries-${scouter.id}`}>
                          {scouter.entryCount}
                        </TableCell>
                        <TableCell className={`text-center font-medium ${eventsColor}`} data-testid={`stat-events-${scouter.id}`}>
                          {scouter.eventsScouted}
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
