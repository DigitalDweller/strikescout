import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Upload, CalendarDays, Search } from "lucide-react";
import type { Event, ScheduleMatch, Team } from "@shared/schema";

export default function Schedule() {
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      return res.json();
    },
    enabled: !!eventId,
  });

  const { data: schedule, isLoading } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
    enabled: !!eventId,
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const teamMap = useMemo(() => {
    const m = new Map<number, Team>();
    teams?.forEach(t => m.set(t.teamNumber, t));
    return m;
  }, [teams]);

  const uploadMutation = useMutation({
    mutationFn: async (matches: any[]) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/schedule`, { matches });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "schedule"] });
      toast({ title: "Schedule imported successfully!" });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !eventId) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      if (lines.length < 2) {
        toast({ title: "CSV file is empty or has no data rows", variant: "destructive" });
        return;
      }

      const header = lines[0].toLowerCase().replace(/\r/g, "");
      const cols = header.split(",").map(c => c.trim());

      const matchIdx = cols.findIndex(c => c.includes("match"));
      const timeIdx = cols.findIndex(c => c.includes("time"));
      const red1Idx = cols.findIndex(c => c === "red1" || c === "red 1");
      const red2Idx = cols.findIndex(c => c === "red2" || c === "red 2");
      const red3Idx = cols.findIndex(c => c === "red3" || c === "red 3");
      const blue1Idx = cols.findIndex(c => c === "blue1" || c === "blue 1");
      const blue2Idx = cols.findIndex(c => c === "blue2" || c === "blue 2");
      const blue3Idx = cols.findIndex(c => c === "blue3" || c === "blue 3");

      if (matchIdx === -1) {
        toast({ title: "CSV must have a 'match' column", variant: "destructive" });
        return;
      }

      const matches = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].replace(/\r/g, "").split(",").map(c => c.trim());
        if (row.length < 2) continue;

        const matchNum = parseInt(row[matchIdx]);
        if (isNaN(matchNum)) continue;

        matches.push({
          matchNumber: matchNum,
          time: timeIdx >= 0 ? row[timeIdx] || null : null,
          red1: red1Idx >= 0 ? parseInt(row[red1Idx]) || null : null,
          red2: red2Idx >= 0 ? parseInt(row[red2Idx]) || null : null,
          red3: red3Idx >= 0 ? parseInt(row[red3Idx]) || null : null,
          blue1: blue1Idx >= 0 ? parseInt(row[blue1Idx]) || null : null,
          blue2: blue2Idx >= 0 ? parseInt(row[blue2Idx]) || null : null,
          blue3: blue3Idx >= 0 ? parseInt(row[blue3Idx]) || null : null,
        });
      }

      if (matches.length === 0) {
        toast({ title: "No valid matches found in CSV", variant: "destructive" });
        return;
      }

      uploadMutation.mutate(matches);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const TeamBadge = ({ teamNum }: { teamNum: number | null }) => {
    if (!teamNum) return <span className="text-muted-foreground">-</span>;
    const team = teamMap.get(teamNum);
    return (
      <span className="font-mono text-sm" title={team?.teamName}>
        {teamNum}
      </span>
    );
  };

  const sortedSchedule = useMemo(() => {
    if (!schedule) return [];
    let list = [...schedule].sort((a, b) => a.matchNumber - b.matchNumber);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m => {
        const nums = [m.matchNumber, m.red1, m.red2, m.red3, m.blue1, m.blue2, m.blue3]
          .filter(Boolean)
          .map(n => n!.toString());
        return nums.some(n => n.includes(q)) ||
          (m.time && m.time.toLowerCase().includes(q));
      });
    }
    return list;
  }, [schedule, search]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Schedule</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {event?.name || "Loading..."} — {sortedSchedule.length} matches
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVUpload}
            data-testid="input-csv-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            data-testid="button-import-csv"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {(schedule && schedule.length > 0) && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by match or team number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-schedule-search"
          />
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !schedule || schedule.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No Schedule Loaded</p>
            <p className="text-sm text-muted-foreground mt-1">
              Import a CSV file with columns: match, time, red1, red2, red3, blue1, blue2, blue3
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
                    <TableHead className="w-20">Match</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-center text-red-500">Red 1</TableHead>
                    <TableHead className="text-center text-red-500">Red 2</TableHead>
                    <TableHead className="text-center text-red-500">Red 3</TableHead>
                    <TableHead className="text-center text-blue-500">Blue 1</TableHead>
                    <TableHead className="text-center text-blue-500">Blue 2</TableHead>
                    <TableHead className="text-center text-blue-500">Blue 3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSchedule.map(match => (
                    <TableRow key={match.id} data-testid={`row-match-${match.matchNumber}`}>
                      <TableCell>
                        <Badge variant="secondary">Q{match.matchNumber}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {match.time || "-"}
                      </TableCell>
                      <TableCell className="text-center bg-red-500/5">
                        <TeamBadge teamNum={match.red1} />
                      </TableCell>
                      <TableCell className="text-center bg-red-500/5">
                        <TeamBadge teamNum={match.red2} />
                      </TableCell>
                      <TableCell className="text-center bg-red-500/5">
                        <TeamBadge teamNum={match.red3} />
                      </TableCell>
                      <TableCell className="text-center bg-blue-500/5">
                        <TeamBadge teamNum={match.blue1} />
                      </TableCell>
                      <TableCell className="text-center bg-blue-500/5">
                        <TeamBadge teamNum={match.blue2} />
                      </TableCell>
                      <TableCell className="text-center bg-blue-500/5">
                        <TeamBadge teamNum={match.blue3} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
