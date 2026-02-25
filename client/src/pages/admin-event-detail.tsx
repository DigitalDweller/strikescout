import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  Calendar,
  Radio,
  Plus,
  Trash2,
  ArrowRight,
  Users,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import type { Event, Team, EventTeam, ScoutingEntry } from "@shared/schema";

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

  function getTeamStats(teamId: number) {
    const teamEntries = entries?.filter((e) => e.teamId === teamId) || [];
    if (teamEntries.length === 0)
      return { count: 0, avgAutoBalls: 0, avgTeleopBalls: 0, avgAccuracy: 0, climbRate: 0 };
    const count = teamEntries.length;
    const avgAutoBalls = +(teamEntries.reduce((s, e) => s + e.autoBallsShot, 0) / count).toFixed(1);
    const avgTeleopBalls = +(teamEntries.reduce((s, e) => s + e.teleopBallsShot, 0) / count).toFixed(1);
    const avgAccuracy = +(teamEntries.reduce((s, e) => s + e.teleopAccuracy, 0) / count).toFixed(1);
    const climbRate = Math.round((teamEntries.filter((e) => e.climbSuccess === "success").length / count) * 100);
    return { count, avgAutoBalls, avgTeleopBalls, avgAccuracy, climbRate };
  }

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
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-events">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Events
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-event-name">
              {event.name}
              {event.isActive && (
                <Badge variant="default" className="text-xs">
                  <Radio className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </span>
              )}
              {event.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {event.startDate}
                </span>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            Match {event.currentMatchNumber}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Teams ({eventTeams?.length || 0})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Skeleton className="h-32 w-full" />
          ) : eventTeams?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No teams added to this event yet.
            </p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Entries</TableHead>
                    <TableHead className="text-center">Auto Balls</TableHead>
                    <TableHead className="text-center">Teleop Balls</TableHead>
                    <TableHead className="text-center">Accuracy</TableHead>
                    <TableHead className="text-center">Climb %</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventTeams?.map((et) => {
                    const stats = getTeamStats(et.teamId);
                    return (
                      <TableRow key={et.id} data-testid={`row-team-${et.teamId}`}>
                        <TableCell>
                          <Link href={`/events/${eventId}/teams/${et.teamId}`}>
                            <span className="font-medium hover:underline cursor-pointer">
                              #{et.team.teamNumber} {et.team.teamName}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">{stats.count}</TableCell>
                        <TableCell className="text-center">{stats.avgAutoBalls}</TableCell>
                        <TableCell className="text-center">{stats.avgTeleopBalls}</TableCell>
                        <TableCell className="text-center">{stats.avgAccuracy}/10</TableCell>
                        <TableCell className="text-center">{stats.climbRate}%</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={`/events/${eventId}/teams/${et.teamId}`}>
                              <Button size="icon" variant="ghost" data-testid={`button-view-team-${et.teamId}`}>
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeTeamMutation.mutate(et.teamId)}
                              data-testid={`button-remove-team-${et.teamId}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
