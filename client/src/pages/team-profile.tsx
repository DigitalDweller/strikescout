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
import { ArrowLeft, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Event, Team, ScoutingEntry } from "@shared/schema";

export default function TeamProfile() {
  const { eventId: eid, teamId: tid } = useParams<{ eventId: string; teamId: string }>();
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

  const team = teams?.find((t) => t.id === teamId);

  const avgAuto = entries?.length
    ? Math.round(entries.reduce((s, e) => s + e.autoScore, 0) / entries.length)
    : 0;
  const avgTeleop = entries?.length
    ? Math.round(entries.reduce((s, e) => s + e.teleopScore, 0) / entries.length)
    : 0;
  const avgEndgame = entries?.length
    ? Math.round(entries.reduce((s, e) => s + e.endgameScore, 0) / entries.length)
    : 0;
  const avgDefense = entries?.length
    ? (entries.reduce((s, e) => s + e.defenseRating, 0) / entries.length).toFixed(1)
    : "0";

  const chartData =
    entries
      ?.sort((a, b) => a.matchNumber - b.matchNumber)
      .map((e) => ({
        match: `M${e.matchNumber}`,
        Auto: e.autoScore,
        Teleop: e.teleopScore,
        Endgame: e.endgameScore,
      })) || [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href={`/events/${eventId}`}>
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-event">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Event
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-team-name">
          {team ? `#${team.teamNumber} ${team.teamName}` : <Skeleton className="h-7 w-48 inline-block" />}
        </h1>
        {event && (
          <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary" data-testid="text-avg-auto">{avgAuto}</p>
            <p className="text-xs text-muted-foreground">Avg Auto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-2" data-testid="text-avg-teleop">{avgTeleop}</p>
            <p className="text-xs text-muted-foreground">Avg Teleop</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-3" data-testid="text-avg-endgame">{avgEndgame}</p>
            <p className="text-xs text-muted-foreground">Avg Endgame</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-4" data-testid="text-avg-defense">{avgDefense}</p>
            <p className="text-xs text-muted-foreground">Avg Defense</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Performance by Match
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="match" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Auto" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Teleop" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Endgame" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

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
                    <TableHead className="text-center">Auto</TableHead>
                    <TableHead className="text-center">Teleop</TableHead>
                    <TableHead className="text-center">Endgame</TableHead>
                    <TableHead className="text-center">Defense</TableHead>
                    <TableHead className="text-center">Total</TableHead>
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
                        <TableCell className="text-center">{entry.autoScore}</TableCell>
                        <TableCell className="text-center">{entry.teleopScore}</TableCell>
                        <TableCell className="text-center">{entry.endgameScore}</TableCell>
                        <TableCell className="text-center">{entry.defenseRating}/5</TableCell>
                        <TableCell className="text-center font-medium">
                          {entry.autoScore + entry.teleopScore + entry.endgameScore}
                        </TableCell>
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
