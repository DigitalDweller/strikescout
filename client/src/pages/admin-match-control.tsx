import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import {
  Gamepad2,
  SkipForward,
  RotateCcw,
  Radio,
  Calendar,
  Users,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import type { Event, ScoutingEntry, User } from "@shared/schema";

export default function AdminMatchControl() {
  const { toast } = useToast();

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });
  const activeEvent = events?.find((e) => e.isActive);

  const { data: matchEntries, isLoading: entriesLoading } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", activeEvent?.id, "match", activeEvent?.currentMatchNumber, "entries"],
    enabled: !!activeEvent,
    refetchInterval: 5000,
  });

  const { data: scouters } = useQuery<User[]>({
    queryKey: ["/api/scouters"],
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${activeEvent!.id}/advance-match`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/active-event"] });
      toast({ title: "Match advanced" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${activeEvent!.id}/reset-match`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/active-event"] });
      toast({ title: "Match reset to 1" });
    },
  });

  const scouterMap = new Map(scouters?.map((s) => [s.id, s.displayName]) || []);

  if (!activeEvent) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-6" data-testid="text-page-title">Match Control</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No Active Event</p>
            <p className="text-sm text-muted-foreground mt-1">
              Set an event as active before using match control.
            </p>
            <Link href="/events">
              <Button size="sm" className="mt-3" data-testid="link-go-events">
                Go to Events
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Match Control</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage match flow for the active event</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-chart-2" />
            {activeEvent.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Current Match
              </p>
              <p className="text-6xl font-bold tabular-nums" data-testid="text-match-number">
                {activeEvent.currentMatchNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={() => advanceMutation.mutate()}
              disabled={advanceMutation.isPending}
              data-testid="button-advance-match"
            >
              {advanceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <SkipForward className="h-4 w-4 mr-2" />
              )}
              End Match & Advance
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Reset match number back to 1?")) {
                  resetMutation.mutate();
                }
              }}
              disabled={resetMutation.isPending}
              data-testid="button-reset-match"
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reset to 1
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Match {activeEvent.currentMatchNumber} Submissions
            </CardTitle>
            <Badge variant="secondary">
              {matchEntries?.length || 0} entries
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : matchEntries?.length === 0 ? (
            <div className="text-center py-6">
              <Gamepad2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No entries submitted for this match yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Entries will appear here as scouters submit them.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scouter</TableHead>
                    <TableHead className="text-center">Auto</TableHead>
                    <TableHead className="text-center">Teleop</TableHead>
                    <TableHead className="text-center">Endgame</TableHead>
                    <TableHead className="text-center">Defense</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchEntries?.map((entry) => (
                    <TableRow key={entry.id} data-testid={`row-match-entry-${entry.id}`}>
                      <TableCell className="font-medium">
                        {scouterMap.get(entry.scouterId) || `Scouter ${entry.scouterId}`}
                      </TableCell>
                      <TableCell className="text-center">{entry.autoScore}</TableCell>
                      <TableCell className="text-center">{entry.teleopScore}</TableCell>
                      <TableCell className="text-center">{entry.endgameScore}</TableCell>
                      <TableCell className="text-center">{entry.defenseRating}/5</TableCell>
                      <TableCell className="text-center font-medium">
                        {entry.autoScore + entry.teleopScore + entry.endgameScore}
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
