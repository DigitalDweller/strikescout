import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, Search, Video, Trophy, Medal } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Event, ScheduleMatch, Team } from "@shared/schema";

export default function Schedule() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: schedule, isLoading: scheduleLoading, isError: scheduleError } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
    enabled: !!eventId,
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const scheduleList = Array.isArray(schedule) ? schedule : [];
  const isLoading = scheduleLoading;

  const teamMap = useMemo(() => {
    const m = new Map<number, Team>();
    teams?.forEach(t => m.set(t.teamNumber, t));
    return m;
  }, [teams]);

  const TeamBadge = ({ teamNum, alliance }: { teamNum: number | null; alliance: "red" | "blue" }) => {
    if (!teamNum) return <span className="text-muted-foreground">-</span>;
    const team = teamMap.get(teamNum);
    return (
      <span className={`font-mono font-bold text-base ${alliance === "red" ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`} title={team?.teamName}>
        {teamNum}
      </span>
    );
  };

  const sortedSchedule = useMemo(() => {
    if (!scheduleList.length) return [];
    let list = [...scheduleList].sort((a, b) => a.matchNumber - b.matchNumber);
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
  }, [scheduleList, search]);

  const top3ScoringMatchNumbers = useMemo(() => {
    const withScores = scheduleList.filter(m => m.redScore != null || m.blueScore != null);
    if (withScores.length === 0) return [];
    const total = (m: ScheduleMatch) => (m.redScore ?? 0) + (m.blueScore ?? 0);
    const byScore = [...withScores].sort((a, b) => total(b) - total(a));
    return byScore.slice(0, 3).map(m => m.matchNumber);
  }, [scheduleList]);

  const hasTbaKey = !!event?.tbaEventKey;

  const TopScoreIcon = ({ matchNumber }: { matchNumber: number }) => {
    const rank = top3ScoringMatchNumbers.indexOf(matchNumber) + 1;
    if (rank === 0) return null;
    if (rank === 1) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0 text-amber-500 dark:text-amber-400" aria-hidden>
              <Trophy className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Top scoring match at this event</TooltipContent>
        </Tooltip>
      );
    }
    if (rank === 2) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0 text-slate-400 dark:text-slate-500" aria-hidden>
              <Medal className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>2nd highest scoring match</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 text-amber-700 dark:text-amber-800" aria-hidden>
            <Medal className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>3rd highest scoring match</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Schedule</h1>
        <p className="text-muted-foreground text-base mt-1">
          {event?.name || "Loading..."} — {sortedSchedule.length} matches
        </p>
      </div>

      {(scheduleList.length > 0) && (
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
      ) : scheduleError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium text-destructive">Failed to load schedule</p>
            <p className="text-sm text-muted-foreground mt-1">Check the event exists and try again.</p>
          </CardContent>
        </Card>
      ) : scheduleList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No matches yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasTbaKey
                ? "You must wait for the Blue Alliance to upload the match schedule. It will appear here once it's available."
                : "Configure a TBA event key in Settings to load the schedule."}
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
                    <TableHead className="w-20 text-sm font-bold">Match</TableHead>
                    <TableHead className="text-sm font-bold">Time</TableHead>
                    <TableHead className="text-center text-sm font-bold text-red-500 dark:text-red-400">Red 1</TableHead>
                    <TableHead className="text-center text-sm font-bold text-red-500 dark:text-red-400">Red 2</TableHead>
                    <TableHead className="text-center text-sm font-bold text-red-500 dark:text-red-400">Red 3</TableHead>
                    <TableHead className="text-center text-sm font-bold text-blue-500 dark:text-blue-400">Blue 1</TableHead>
                    <TableHead className="text-center text-sm font-bold text-blue-500 dark:text-blue-400">Blue 2</TableHead>
                    <TableHead className="text-center text-sm font-bold text-blue-500 dark:text-blue-400">Blue 3</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSchedule.map(match => {
                    const redWon = match.winningAlliance === "red";
                    const blueWon = match.winningAlliance === "blue";
                    const redBg = redWon ? "bg-red-500/20 dark:bg-red-500/25" : "bg-red-500/5";
                    const blueBg = blueWon ? "bg-blue-500/20 dark:bg-blue-500/25" : "bg-blue-500/5";
                    return (
                    <TableRow
                      key={match.id}
                      data-testid={`row-match-${match.matchNumber}`}
                      className="h-12 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/events/${eventId}/schedule/${match.matchNumber}`)}
                    >
                      <TableCell className="font-bold text-base">
                        <span className="flex items-center gap-1.5">
                          <TopScoreIcon matchNumber={match.matchNumber} />
                          Q{match.matchNumber}
                          {match.videoUrl && <Video className="h-3.5 w-3.5 text-red-500" />}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {match.time ? (() => {
                          const parsed = new Date(match.time);
                          if (!isNaN(parsed.getTime())) {
                            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                            const day = days[parsed.getDay()];
                            const timePart = match.time.replace(/^\d{4}-\d{2}-\d{2}\s*/, "");
                            return `${day} ${timePart}`;
                          }
                          return match.time;
                        })() : "-"}
                      </TableCell>
                      <TableCell className={`text-center ${redBg} ${redWon ? "border-y-2 border-l-2 border-red-500/40" : ""}`} data-testid={`cell-red1-${match.matchNumber}`}>
                        <TeamBadge teamNum={match.red1} alliance="red" />
                      </TableCell>
                      <TableCell className={`text-center ${redBg} ${redWon ? "border-y-2 border-red-500/40" : ""}`}>
                        <TeamBadge teamNum={match.red2} alliance="red" />
                      </TableCell>
                      <TableCell className={`text-center ${redBg} ${redWon ? "border-y-2 border-r-2 border-red-500/40" : ""}`}>
                        <TeamBadge teamNum={match.red3} alliance="red" />
                      </TableCell>
                      <TableCell className={`text-center ${blueBg} ${blueWon ? "border-y-2 border-l-2 border-blue-500/40" : ""}`} data-testid={`cell-blue1-${match.matchNumber}`}>
                        <TeamBadge teamNum={match.blue1} alliance="blue" />
                      </TableCell>
                      <TableCell className={`text-center ${blueBg} ${blueWon ? "border-y-2 border-blue-500/40" : ""}`}>
                        <TeamBadge teamNum={match.blue2} alliance="blue" />
                      </TableCell>
                      <TableCell className={`text-center ${blueBg} ${blueWon ? "border-y-2 border-r-2 border-blue-500/40" : ""}`}>
                        <TeamBadge teamNum={match.blue3} alliance="blue" />
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
