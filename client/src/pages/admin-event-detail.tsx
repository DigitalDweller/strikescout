import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  MapPin,
  Calendar,
  Plus,
  Trash2,
  Users,
  Loader2,
  Trophy,
  Target,
  Shield,
  ChevronUp,
  Zap,
  ArrowRight,
} from "lucide-react";
import type { Event, Team, EventTeam, ScoutingEntry } from "@shared/schema";

type TeamStats = {
  teamId: number;
  team?: Team;
  avgAuto: number;
  avgTeleop: number;
  avgAccuracy: number;
  avgDefense: number;
  climbRate: number;
  totalBalls: number;
};

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getMedalColor(rank: number) {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-600";
  return "text-muted-foreground";
}

function LeaderboardCard({
  title,
  icon,
  teams,
  getValue,
  formatValue,
  eventId,
}: {
  title: string;
  icon: React.ReactNode;
  teams: TeamStats[];
  getValue: (t: TeamStats) => number;
  formatValue: (v: number) => string;
  eventId: number;
}) {
  const sorted = [...teams].sort((a, b) => getValue(b) - getValue(a)).slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No data yet</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((ts, i) => {
              const rank = i + 1;
              return (
                <Link key={ts.teamId} href={`/events/${eventId}/teams/${ts.teamId}`}>
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" data-testid={`leaderboard-${title.toLowerCase().replace(/\s+/g, "-")}-${rank}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-extrabold w-8 ${getMedalColor(rank)}`}>
                        {getOrdinal(rank)}
                      </span>
                      <div>
                        <span className="font-bold text-primary">#{ts.team?.teamNumber}</span>
                        <span className="ml-1.5 text-sm font-medium">{ts.team?.teamName}</span>
                      </div>
                    </div>
                    <span className="text-xl font-extrabold tabular-nums">
                      {formatValue(getValue(ts))}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminEventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const { toast } = useToast();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: eventTeams, isLoading: teamsLoading } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: allTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const addTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/teams`, { teamId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
      setSelectedTeamId("");
      toast({ title: "Team added to event" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add team", description: error.message, variant: "destructive" });
    },
  });

  const removeTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
      toast({ title: "Team removed from event" });
    },
  });

  const eventTeamIds = new Set(eventTeams?.map((et) => et.teamId) || []);
  const availableTeams = allTeams?.filter((t) => !eventTeamIds.has(t.id)) || [];

  const teamMap = useMemo(() => {
    const m = new globalThis.Map<number, Team>();
    allTeams?.forEach(t => m.set(t.id, t));
    return m;
  }, [allTeams]);

  const teamStatsList = useMemo((): TeamStats[] => {
    if (!eventTeams || !entries) return [];
    return eventTeams.map(et => {
      const te = entries.filter(e => e.teamId === et.teamId);
      const count = te.length;
      if (count === 0) {
        return {
          teamId: et.teamId,
          team: et.team,
          avgAuto: 0, avgTeleop: 0, avgAccuracy: 0, avgDefense: 0, climbRate: 0, totalBalls: 0,
        };
      }
      return {
        teamId: et.teamId,
        team: et.team,
        avgAuto: te.reduce((s, e) => s + e.autoBallsShot, 0) / count,
        avgTeleop: te.reduce((s, e) => s + e.teleopBallsShot, 0) / count,
        avgAccuracy: te.reduce((s, e) => s + e.teleopAccuracy, 0) / count,
        avgDefense: te.reduce((s, e) => s + e.defenseRating, 0) / count,
        climbRate: te.filter(e => e.climbSuccess === "success").length / count * 100,
        totalBalls: te.reduce((s, e) => s + e.autoBallsShot + e.teleopBallsShot, 0) / count,
      };
    });
  }, [eventTeams, entries]);

  const teamsWithData = teamStatsList.filter(t => t.avgAuto > 0 || t.avgTeleop > 0 || t.avgAccuracy > 0 || t.avgDefense > 0 || t.climbRate > 0);
  const totalEntries = entries?.length || 0;
  const matchesScouted = entries ? new Set(entries.map(e => e.matchNumber)).size : 0;

  if (eventLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-event-name">
          {event.name}
        </h1>
        <div className="flex items-center gap-3 mt-1 text-base text-muted-foreground flex-wrap">
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {event.location}
            </span>
          )}
          {event.startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {event.startDate}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
            {eventTeams?.length || 0} teams
          </Badge>
          <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
            {matchesScouted} matches scouted
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teams ({eventTeams?.length || 0})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableTeams.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="flex-1" data-testid="select-add-team">
                  <SelectValue placeholder="Select a team to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      #{team.teamNumber} - {team.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (selectedTeamId) addTeamMutation.mutate(parseInt(selectedTeamId));
                }}
                disabled={!selectedTeamId || addTeamMutation.isPending}
                data-testid="button-add-team"
              >
                {addTeamMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {teamsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : eventTeams?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No teams added to this event yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {eventTeams?.map((et) => (
                <div key={et.id} className="flex items-center gap-1 bg-muted/50 rounded-lg px-3 py-1.5" data-testid={`chip-team-${et.teamId}`}>
                  <Link href={`/events/${eventId}/teams/${et.teamId}`}>
                    <span className="font-bold text-primary hover:underline cursor-pointer">
                      #{et.team.teamNumber}
                    </span>
                    <span className="ml-1.5 font-medium text-sm">{et.team.teamName}</span>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 ml-1"
                    onClick={() => removeTeamMutation.mutate(et.teamId)}
                    data-testid={`button-remove-team-${et.teamId}`}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5" />
          Leaderboards
        </h2>

        {teamsWithData.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-lg">No scouting data yet</p>
              <p className="text-muted-foreground mt-1">
                Head to the Scout tab to start recording match data. Leaderboards will populate automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <LeaderboardCard
              title="Total Scoring"
              icon={<Zap className="h-4 w-4 text-chart-1" />}
              teams={teamsWithData}
              getValue={t => t.totalBalls}
              formatValue={v => v.toFixed(1)}
              eventId={eventId}
            />
            <LeaderboardCard
              title="Auto Performance"
              icon={<Zap className="h-4 w-4 text-primary" />}
              teams={teamsWithData}
              getValue={t => t.avgAuto}
              formatValue={v => v.toFixed(1)}
              eventId={eventId}
            />
            <LeaderboardCard
              title="Teleop Performance"
              icon={<Target className="h-4 w-4 text-chart-2" />}
              teams={teamsWithData}
              getValue={t => t.avgTeleop}
              formatValue={v => v.toFixed(1)}
              eventId={eventId}
            />
            <LeaderboardCard
              title="Accuracy"
              icon={<Target className="h-4 w-4 text-chart-3" />}
              teams={teamsWithData}
              getValue={t => t.avgAccuracy}
              formatValue={v => `${v.toFixed(1)}/10`}
              eventId={eventId}
            />
            <LeaderboardCard
              title="Defense"
              icon={<Shield className="h-4 w-4 text-chart-4" />}
              teams={teamsWithData}
              getValue={t => t.avgDefense}
              formatValue={v => `${v.toFixed(1)}/10`}
              eventId={eventId}
            />
            <LeaderboardCard
              title="Climb Rate"
              icon={<ChevronUp className="h-4 w-4 text-chart-5" />}
              teams={teamsWithData}
              getValue={t => t.climbRate}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
