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
      <p className={`text-sm font-bold ${color}`}>
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
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-team-name">
          {team ? `#${team.teamNumber} ${team.teamName}` : <Skeleton className="h-9 w-56 inline-block" />}
        </h1>
        {event && (
          <p className="text-base text-muted-foreground mt-1">{event.name}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="p-5 text-center space-y-1">
            {rankings && <RankBadge rank={rankings.autoRank} total={rankings.total} />}
            <p className="text-sm font-medium text-foreground/70">Avg Auto</p>
            <p className="text-4xl font-extrabold text-primary leading-none" data-testid="text-avg-auto">{avgAutoBalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center space-y-1">
            {rankings && <RankBadge rank={rankings.teleopRank} total={rankings.total} />}
            <p className="text-sm font-medium text-foreground/70">Avg Teleop</p>
            <p className="text-4xl font-extrabold text-chart-2 leading-none" data-testid="text-avg-teleop">{avgTeleopBalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center space-y-1">
            {rankings && <RankBadge rank={rankings.accuracyRank} total={rankings.total} />}
            <p className="text-sm font-medium text-foreground/70">Accuracy</p>
            <p className="text-4xl font-extrabold text-chart-3 leading-none" data-testid="text-avg-accuracy">{avgAccuracy}<span className="text-lg">/10</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center space-y-1">
            {rankings && <RankBadge rank={rankings.defenseRank} total={rankings.total} />}
            <p className="text-sm font-medium text-foreground/70">Defense</p>
            <p className="text-4xl font-extrabold text-chart-4 leading-none" data-testid="text-avg-defense">{avgDefense}<span className="text-lg">/10</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center space-y-1">
            {rankings && <RankBadge rank={rankings.climbRank} total={rankings.total} />}
            <p className="text-sm font-medium text-foreground/70">Climb Rate</p>
            <p className="text-4xl font-extrabold text-chart-5 leading-none" data-testid="text-climb-rate">{climbRate}<span className="text-lg">%</span></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold">Match History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : entries?.length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-6">
              No scouting entries for this team yet.
            </p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-bold">Match</TableHead>
                    <TableHead className="text-center text-sm font-bold">Auto</TableHead>
                    <TableHead className="text-center text-sm font-bold">Teleop</TableHead>
                    <TableHead className="text-center text-sm font-bold">Accuracy</TableHead>
                    <TableHead className="text-center text-sm font-bold">Climb</TableHead>
                    <TableHead className="text-center text-sm font-bold">Defense</TableHead>
                    <TableHead className="text-sm font-bold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries
                    ?.sort((a, b) => a.matchNumber - b.matchNumber)
                    .map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                        <TableCell className="font-bold text-base">
                          M{entry.matchNumber}
                        </TableCell>
                        <TableCell className="text-center text-base font-semibold">{entry.autoBallsShot}</TableCell>
                        <TableCell className="text-center text-base font-semibold">{entry.teleopBallsShot}</TableCell>
                        <TableCell className="text-center text-base font-semibold">{entry.teleopAccuracy}<span className="text-muted-foreground text-xs">/10</span></TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={entry.climbSuccess === "success" ? "default" : "secondary"}
                            className={`text-sm font-semibold ${entry.climbSuccess === "success" ? "bg-green-600 text-white" : entry.climbSuccess === "failed" ? "bg-red-500/15 text-red-500" : ""}`}
                          >
                            {entry.climbSuccess === "success" ? "Yes" : entry.climbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-base font-semibold">{entry.defenseRating}<span className="text-muted-foreground text-xs">/10</span></TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm">
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
