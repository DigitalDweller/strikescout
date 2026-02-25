import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MessageSquare } from "lucide-react";
import type { Event, Team, ScoutingEntry } from "@shared/schema";

export default function TeamNotes() {
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

  const team = teams?.find((t) => t.id === teamId);

  const noteGroups = entries ? [
    { label: "Auto Notes", notes: entries.map(e => ({ match: e.matchNumber, text: e.autoNotes })).filter(n => n.text) },
    { label: "Driver Skill", notes: entries.map(e => ({ match: e.matchNumber, text: e.driverSkillNotes })).filter(n => n.text) },
    { label: "Defense Notes", notes: entries.map(e => ({ match: e.matchNumber, text: e.defenseNotes })).filter(n => n.text) },
    { label: "General Notes", notes: entries.map(e => ({ match: e.matchNumber, text: e.notes })).filter(n => n.text) },
  ].filter(g => g.notes.length > 0) : [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <Link href={`/events/${eventId}/teams/${teamId}`}>
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-team">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Team
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-notes-title">
          <MessageSquare className="h-7 w-7" />
          {team ? `${team.teamNumber} - ${team.teamName}` : <Skeleton className="h-9 w-56 inline-block" />}
        </h1>
        {event && (
          <p className="text-base text-muted-foreground mt-1">All Scout Notes &middot; {event.name}</p>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : noteGroups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-base text-muted-foreground">No notes have been recorded for this team yet.</p>
          </CardContent>
        </Card>
      ) : (
        noteGroups.map(group => (
          <Card key={group.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">{group.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {group.notes.sort((a, b) => a.match - b.match).map((n, i) => (
                  <div key={i} className="flex gap-3 text-sm border-b last:border-0 pb-2 last:pb-0" data-testid={`note-${group.label}-${i}`}>
                    <span className="font-bold text-muted-foreground shrink-0 w-8">M{n.match}</span>
                    <span>{n.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
