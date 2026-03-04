import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User as UserIcon, ClipboardList, Calendar, Award } from "lucide-react";
import { getHeatColor } from "@/lib/team-colors";

interface ScouterProfileData {
  id: number;
  displayName: string;
  role: string;
  totalEntries: number;
  events: { eventId: number; eventName: string; entryCount: number }[];
}

export default function ScouterProfile() {
  const { id: eventIdParam, scouterId: scouterIdParam } = useParams<{ id: string; scouterId: string }>();
  const eventId = parseInt(eventIdParam || "0");
  const scouterId = parseInt(scouterIdParam || "0");
  const { user } = useAuth();
  const isOwnProfile = user?.id === scouterId;

  const { data: profile, isLoading } = useQuery<ScouterProfileData>({
    queryKey: ["/api/users", scouterId, "profile"],
    enabled: !!scouterId,
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <Link href={`/events/${eventId}/scouters`}>
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Scouters
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !profile ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-base text-muted-foreground">Profile not found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UserIcon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                {profile.displayName}
                {isOwnProfile && (
                  <Badge variant="secondary" className="text-xs">
                    You
                  </Badge>
                )}
              </h1>
              <Badge variant="outline" className="mt-2">
                {profile.role === "admin" ? "Admin" : "Scouter"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  RP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-3xl font-bold inline-block rounded-lg px-2 py-1 ${getHeatColor(Math.min(profile.totalEntries, 20), 0, 20)}`}
                  data-testid="text-total-rp"
                >
                  {profile.totalEntries}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ranking Points (1 per entry)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Total Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" data-testid="text-total-entries">
                  {profile.totalEntries}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  scouting entries across all events
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Events Scouted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" data-testid="text-events-count">
                  {profile.events.length}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  events participated
                </p>
              </CardContent>
            </Card>
          </div>

          {profile.events.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Per-Event Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.events.map(e => (
                    <li
                      key={e.eventId}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <span className="font-medium">{e.eventName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                          {e.entryCount} RP
                        </span>
                        <Link href={`/events/${e.eventId}/scout`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            {e.eventId === eventId ? "This event" : "View event"}
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {isOwnProfile && (
            <Link href={`/events/${eventId}/scout/history`}>
              <Button variant="outline" data-testid="button-my-form-history">
                View My Form History
              </Button>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
