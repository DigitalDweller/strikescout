import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  ClipboardList,
  ArrowRight,
  Radio,
  BarChart3,
  List,
  CalendarDays,
} from "lucide-react";
import type { Event, ScoutingEntry } from "@shared/schema";

export default function Dashboard() {
  const { data: activeEvent, isLoading } = useQuery<Event | null>({
    queryKey: ["/api/active-event"],
  });

  const { data: allEntries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", activeEvent?.id, "entries"],
    enabled: !!activeEvent,
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Scout Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">FRC 2026 Scouting Dashboard</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-total-entries">
                {allEntries?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-chart-2/10 text-chart-2 shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-match-number">
                {activeEvent?.currentMatchNumber || "-"}
              </p>
              <p className="text-xs text-muted-foreground">Current Match</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-chart-3/10 text-chart-3 shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-24" data-testid="text-event-name" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-event-name">
                  {activeEvent ? "Active" : "None"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Event Status</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : activeEvent ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="h-4 w-4 text-chart-2" />
                Active Event
              </CardTitle>
              <Badge variant="secondary">Match {activeEvent.currentMatchNumber}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-lg" data-testid="text-active-event-name">{activeEvent.name}</p>
              {activeEvent.location && (
                <p className="text-sm text-muted-foreground">{activeEvent.location}</p>
              )}
            </div>
            <Link href="/scout">
              <Button data-testid="link-start-scouting">
                <ClipboardList className="h-4 w-4 mr-2" />
                Start Scouting
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No Active Event</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to Events to create or activate an event.
            </p>
            <Link href="/events">
              <Button size="sm" className="mt-3" data-testid="link-create-event">
                Go to Events
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/scout">
          <Card className="hover-elevate cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3 h-full">
              <ClipboardList className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">Scout Robots</p>
                <p className="text-xs text-muted-foreground">Submit scouting data</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/teams">
          <Card className="hover-elevate cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3 h-full">
              <List className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">Team List</p>
                <p className="text-xs text-muted-foreground">Browse and compare teams</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/schedule">
          <Card className="hover-elevate cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3 h-full">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">Match Schedule</p>
                <p className="text-xs text-muted-foreground">View competition schedule</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
