import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft } from "lucide-react";
import type { Event, Team, ScoutingEntry, EventTeam } from "@shared/schema";

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getRankColor(rank: number, total: number) {
  if (total === 0) return "text-muted-foreground";
  const pct = ((rank - 1) / Math.max(total - 1, 1)) * 100;
  if (pct <= 10) return "text-yellow-500";
  if (pct <= 25) return "text-green-500";
  if (pct <= 50) return "text-blue-500";
  return "text-muted-foreground";
}

export default function TeamProfile() {
  const { id: eid, teamId: tid } = useParams<{ id: string; teamId: string }>();
  const eventId = parseInt(eid!);
  const teamId = parseInt(tid!);

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: entries, isLoading } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "teams", teamId, "entries"],
  });

  const { data: allEntries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const team = teams?.find((t) => t.id === teamId);

  const avgAutoBalls = entries?.length
    ? (entries.reduce((s, e) => s + e.autoBallsShot, 0) / entries.length).toFixed(1)
    : "0";
  const avgTeleopBalls = entries?.length
    ? (entries.reduce((s, e) => s + e.teleopBallsShot, 0) / entries.length).toFixed(1)
    : "0";
  const avgAccuracy = entries?.length
    ? (entries.reduce((s, e) => s + e.teleopAccuracy, 0) / entries.length).toFixed(1)
    : "0";
  const avgDefense = entries?.length
    ? (entries.reduce((s, e) => s + e.defenseRating, 0) / entries.length).toFixed(1)
    : "0";
  const climbRate = entries?.length
    ? Math.round((entries.filter((e) => e.climbSuccess === "success").length / entries.length) * 100)
    : 0;

  const rankings = useMemo(() => {
    if (!allEntries || !eventTeams) return null;

    const teamIds = eventTeams.map(et => et.teamId);
    const statsMap = new Map<number, {
      avgAuto: number;
      avgTeleop: number;
      avgAccuracy: number;
      avgDefense: number;
      climbRate: number;
    }>();

    for (const tid of teamIds) {
      const te = allEntries.filter(e => e.teamId === tid);
      const count = te.length;
      if (count === 0) {
        statsMap.set(tid, { avgAuto: 0, avgTeleop: 0, avgAccuracy: 0, avgDefense: 0, climbRate: 0 });
      } else {
        statsMap.set(tid, {
          avgAuto: te.reduce((s, e) => s + e.autoBallsShot, 0) / count,
          avgTeleop: te.reduce((s, e) => s + e.teleopBallsShot, 0) / count,
          avgAccuracy: te.reduce((s, e) => s + e.teleopAccuracy, 0) / count,
          avgDefense: te.reduce((s, e) => s + e.defenseRating, 0) / count,
          climbRate: te.filter(e => e.climbSuccess === "success").length / count * 100,
        });
      }
    }

    const total = teamIds.length;

    function getRank(field: keyof typeof statsMap extends never ? never : string) {
      const sorted = [...teamIds].sort((a, b) => {
        const sa = statsMap.get(a) as any;
        const sb = statsMap.get(b) as any;
        return (sb?.[field] || 0) - (sa?.[field] || 0);
      });
      return sorted.indexOf(teamId) + 1;
    }

    return {
      total,
      autoRank: getRank("avgAuto"),
      teleopRank: getRank("avgTeleop"),
      accuracyRank: getRank("avgAccuracy"),
      defenseRank: getRank("avgDefense"),
      climbRank: getRank("climbRate"),
    };
  }, [allEntries, eventTeams, teamId]);

  const RankBadge = ({ rank, total }: { rank: number; total: number }) => {
    const color = getRankColor(rank, total);
    return (
      <p className={`text-xs font-semibold ${color}`}>
        {getOrdinal(rank)}
      </p>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href={`/events/${eventId}/teams`}>
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-event">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Teams
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-team-name">
          {team ? `#${team.teamNumber} ${team.teamName}` : <Skeleton className="h-7 w-48 inline-block" />}
        </h1>
        {event && (
          <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="p-4 text-center">
            {rankings && <RankBadge rank={rankings.autoRank} total={rankings.total} />}
            <p className="text-xs text-muted-foreground mb-1">Avg Auto Balls</p>
            <p className="text-2xl font-bold text-primary" data-testid="text-avg-auto">{avgAutoBalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            {rankings && <RankBadge rank={rankings.teleopRank} total={rankings.total} />}
            <p className="text-xs text-muted-foreground mb-1">Avg Teleop Balls</p>
            <p className="text-2xl font-bold text-chart-2" data-testid="text-avg-teleop">{avgTeleopBalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            {rankings && <RankBadge rank={rankings.accuracyRank} total={rankings.total} />}
            <p className="text-xs text-muted-foreground mb-1">Avg Accuracy</p>
            <p className="text-2xl font-bold text-chart-3" data-testid="text-avg-accuracy">{avgAccuracy}/10</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            {rankings && <RankBadge rank={rankings.defenseRank} total={rankings.total} />}
            <p className="text-xs text-muted-foreground mb-1">Avg Defense</p>
            <p className="text-2xl font-bold text-chart-4" data-testid="text-avg-defense">{avgDefense}/10</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            {rankings && <RankBadge rank={rankings.climbRank} total={rankings.total} />}
            <p className="text-xs text-muted-foreground mb-1">Climb Rate</p>
            <p className="text-2xl font-bold text-chart-5" data-testid="text-climb-rate">{climbRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Match Entries ({entries?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : entries?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No scouting entries for this team yet.
            </p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-center">Auto Balls</TableHead>
                    <TableHead className="text-center">Teleop Balls</TableHead>
                    <TableHead className="text-center">Accuracy</TableHead>
                    <TableHead className="text-center">Climb</TableHead>
                    <TableHead className="text-center">Defense</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries
                    ?.sort((a, b) => a.matchNumber - b.matchNumber)
                    .map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                        <TableCell>
                          <Badge variant="secondary">M{entry.matchNumber}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{entry.autoBallsShot}</TableCell>
                        <TableCell className="text-center">{entry.teleopBallsShot}</TableCell>
                        <TableCell className="text-center">{entry.teleopAccuracy}/10</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={entry.climbSuccess === "success" ? "default" : "secondary"}>
                            {entry.climbSuccess === "success" ? "Yes" : entry.climbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{entry.defenseRating}/10</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {entry.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
