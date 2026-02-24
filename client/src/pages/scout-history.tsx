import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ClipboardList, BarChart3 } from "lucide-react";
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
import type { ScoutingEntry, Event, Team } from "@shared/schema";

export default function ScoutHistory() {
  const { user } = useAuth();

  const { data: entries, isLoading } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/scouters", user?.id, "entries"],
    enabled: !!user,
  });

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const totalEntries = entries?.length || 0;
  const avgAutoBalls = totalEntries
    ? (entries!.reduce((s, e) => s + e.autoBallsShot, 0) / totalEntries).toFixed(1)
    : "0";
  const avgTeleopBalls = totalEntries
    ? (entries!.reduce((s, e) => s + e.teleopBallsShot, 0) / totalEntries).toFixed(1)
    : "0";
  const avgAccuracy = totalEntries
    ? (entries!.reduce((s, e) => s + e.teleopAccuracy, 0) / totalEntries).toFixed(1)
    : "0";

  const eventMap = new Map(events?.map((e) => [e.id, e.name]) || []);
  const teamMap = new Map(
    teams?.map((t) => [t.id, `#${t.teamNumber} ${t.teamName}`]) || []
  );

  const last10 = entries
    ?.sort(
      (a, b) =>
        (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
        (a.createdAt ? new Date(a.createdAt).getTime() : 0)
    )
    .slice(0, 10);

  const chartData =
    last10
      ?.reverse()
      .map((e, i) => ({
        entry: `${i + 1}`,
        "Auto Balls": e.autoBallsShot,
        "Teleop Balls": e.teleopBallsShot,
        Accuracy: e.teleopAccuracy,
      })) || [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          My Scouting Stats
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your all-time scouting performance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-total-entries">
              {totalEntries}
            </p>
            <p className="text-xs text-muted-foreground">Total Entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{avgAutoBalls}</p>
            <p className="text-xs text-muted-foreground">Avg Auto Balls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">{avgTeleopBalls}</p>
            <p className="text-xs text-muted-foreground">Avg Teleop Balls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-chart-3">{avgAccuracy}/10</p>
            <p className="text-xs text-muted-foreground">Avg Accuracy</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Recent Entries (Last 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="entry" className="text-xs" />
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
                  <Bar dataKey="Auto Balls" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Teleop Balls" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Accuracy" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            All Entries ({totalEntries})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : entries?.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">No entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start scouting to see your stats here.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-center">Auto</TableHead>
                    <TableHead className="text-center">Teleop</TableHead>
                    <TableHead className="text-center">Accuracy</TableHead>
                    <TableHead className="text-center">Climb</TableHead>
                    <TableHead className="text-center">Defense</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries
                    ?.sort(
                      (a, b) =>
                        (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
                        (a.createdAt ? new Date(a.createdAt).getTime() : 0)
                    )
                    .map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                        <TableCell className="text-sm">
                          {eventMap.get(entry.eventId) || `Event ${entry.eventId}`}
                        </TableCell>
                        <TableCell className="text-sm">
                          {teamMap.get(entry.teamId) || `Team ${entry.teamId}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">M{entry.matchNumber}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{entry.autoBallsShot}</TableCell>
                        <TableCell className="text-center">{entry.teleopBallsShot}</TableCell>
                        <TableCell className="text-center">{entry.teleopAccuracy}/10</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={entry.climbSuccess === "success" ? "default" : "secondary"} className="text-xs">
                            {entry.climbSuccess === "success" ? "Yes" : entry.climbSuccess === "failed" ? "Fail" : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.defenseRating}/10
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
