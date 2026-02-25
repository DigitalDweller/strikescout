import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MessageSquare } from "lucide-react";
import type { Event, Team, ScoutingEntry } from "@shared/schema";

const NOTE_COLUMNS = [
  {
    label: "Auto",
    color: "text-primary",
    borderColor: "border-primary/30",
    bgColor: "bg-primary/5",
    extract: (e: ScoutingEntry) => e.autoNotes,
  },
  {
    label: "Teleop & Defense",
    color: "text-chart-2",
    borderColor: "border-chart-2/30",
    bgColor: "bg-chart-2/5",
    extract: (e: ScoutingEntry) => [
      e.driverSkillNotes ? `[Driver] ${e.driverSkillNotes}` : "",
      e.defenseNotes ? `[Defense] ${e.defenseNotes}` : "",
    ].filter(Boolean).join("\n"),
  },
  {
    label: "Misc.",
    color: "text-chart-5",
    borderColor: "border-chart-5/30",
    bgColor: "bg-chart-5/5",
    extract: (e: ScoutingEntry) => e.notes,
  },
];

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

  const columns = NOTE_COLUMNS.map(col => ({
    ...col,
    notes: (entries || [])
      .map(e => ({ match: e.matchNumber, text: col.extract(e) }))
      .filter(n => n.text)
      .sort((a, b) => a.match - b.match),
  }));

  const hasAnyNotes = columns.some(c => c.notes.length > 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
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
      ) : !hasAnyNotes ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-base text-muted-foreground">No notes have been recorded for this team yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {columns.map(col => (
            <Card key={col.label} className={`border-t-4 ${col.borderColor}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-base font-bold ${col.color} text-center`}>{col.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {col.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No notes</p>
                ) : (
                  <div className="space-y-2">
                    {col.notes.map((n, i) => (
                      <div key={i} className={`rounded-md px-3 py-2 ${col.bgColor}`} data-testid={`note-${col.label}-${i}`}>
                        <span className={`text-xs font-bold ${col.color}`}>M{n.match}</span>
                        <p className="text-sm mt-0.5 whitespace-pre-line">{n.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
