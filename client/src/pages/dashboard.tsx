import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Users,
  ClipboardList,
  ArrowRight,
  Gamepad2,
  Radio,
  BarChart3,
} from "lucide-react";
import type { Event, ScoutingEntry, User } from "@shared/schema";

function AdminDashboard() {
  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });
  const { data: scouters, isLoading: scoutersLoading } = useQuery<User[]>({
    queryKey: ["/api/scouters"],
  });
  const activeEvent = events?.find((e) => e.isActive);

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", activeEvent?.id, "entries"],
    enabled: !!activeEvent,
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your scouting operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-events-count">
                {eventsLoading ? <Skeleton className="h-7 w-8" /> : events?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-chart-2/10 text-chart-2 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-scouters-count">
                {scoutersLoading ? <Skeleton className="h-7 w-8" /> : scouters?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Scouters</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-chart-3/10 text-chart-3 shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-entries-count">
                {entries?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Entries (Active Event)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeEvent ? (
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
            <div className="flex flex-wrap gap-2">
              <Link href="/match-control">
                <Button size="sm" data-testid="link-match-control">
                  <Gamepad2 className="h-4 w-4 mr-1" />
                  Match Control
                </Button>
              </Link>
              <Link href={`/events/${activeEvent.id}`}>
                <Button size="sm" variant="outline" data-testid="link-event-detail">
                  View Event
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No Active Event</p>
            <p className="text-sm text-muted-foreground mt-1">
              Set an event as active so scouters can begin scouting.
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/events">
          <Card className="hover-elevate cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">Manage Events</p>
                <p className="text-xs text-muted-foreground">Create events and manage teams</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/scouters">
          <Card className="hover-elevate cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">Manage Scouters</p>
                <p className="text-xs text-muted-foreground">Add or remove scouter accounts</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function ScouterDashboard() {
  const { user } = useAuth();
  const { data: activeEvent, isLoading } = useQuery<Event | null>({
    queryKey: ["/api/active-event"],
  });
  const { data: myEntries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/scouters", user?.id, "entries"],
    enabled: !!user,
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Welcome, {user?.displayName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Ready to scout some robots</p>
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
                Current Event
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
              Wait for your admin to set an active event.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-total-entries">
                {myEntries?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </div>
          </CardContent>
        </Card>
        <Link href="/scout/history">
          <Card className="hover-elevate cursor-pointer h-full">
            <CardContent className="p-4 flex items-center gap-3 h-full">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">View My Stats</p>
                <p className="text-xs text-muted-foreground">See your scouting history</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminDashboard />;
  return <ScouterDashboard />;
}
