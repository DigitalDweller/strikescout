import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Target, Crosshair, Shield, ArrowUp, Bot } from "lucide-react";
import type { Event, ScoutingEntry, Team, ScheduleMatch, EventTeam } from "@shared/schema";

function formatStat(val: number, multiplier = 1, suffix = "") {
  const v = val * multiplier;
  return `${parseFloat(v.toFixed(1))}${suffix}`;
}

export default function MatchDetail() {
  const { id, matchNumber } = useParams<{ id: string; matchNumber: string }>();
  const eventId = parseInt(id || "0");
  const matchNum = parseInt(matchNumber || "0");

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      return res.json();
    },
  });

  const { data: schedule } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
  });

  const { data: entries, isLoading } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "match", matchNum, "entries"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/match/${matchNum}/entries`);
      return res.json();
    },
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const teamMap = new Map<number, Team>();
  eventTeams?.forEach(et => teamMap.set(et.teamId, et.team));

  const match = schedule?.find(m => m.matchNumber === matchNum);

  const redTeams = match ? [match.red1, match.red2, match.red3].filter(Boolean) as number[] : [];
  const blueTeams = match ? [match.blue1, match.blue2, match.blue3].filter(Boolean) as number[] : [];

  const getTeamByNumber = (num: number) => {
    for (const [, t] of teamMap) {
      if (t.teamNumber === num) return t;
    }
    return null;
  };

  const getEntriesForTeamNumber = (teamNum: number) => {
    const team = getTeamByNumber(teamNum);
    if (!team || !entries) return [];
    return entries.filter(e => e.teamId === team.id);
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    const parsed = new Date(time);
    if (!isNaN(parsed.getTime())) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const day = days[parsed.getDay()];
      const timePart = time.replace(/^\d{4}-\d{2}-\d{2}\s*/, "");
      return `${day} ${timePart}`;
    }
    return time;
  };

  const TeamCard = ({ teamNum, alliance, entry }: { teamNum: number; alliance: "red" | "blue"; entry?: ScoutingEntry }) => {
    const team = getTeamByNumber(teamNum);
    const allianceColor = alliance === "red"
      ? "border-red-500/40 bg-red-500/5"
      : "border-blue-500/40 bg-blue-500/5";
    const headerColor = alliance === "red"
      ? "text-red-600 dark:text-red-400"
      : "text-blue-600 dark:text-blue-400";

    return (
      <Card className={`${allianceColor} border`}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <Link href={team ? `/events/${eventId}/teams/${team.id}` : "#"}>
              <span className={`font-bold text-lg ${headerColor} hover:underline cursor-pointer`} data-testid={`link-team-${teamNum}`}>
                {teamNum} {team ? `- ${team.teamName}` : ""}
              </span>
            </Link>
            {!entry && (
              <Badge variant="outline" className="text-xs text-muted-foreground">No data</Badge>
            )}
          </div>
        </CardHeader>
        {entry ? (
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatBox icon={<Target className="h-4 w-4 text-blue-500" />} label="Auto" value={`${entry.autoBallsShot}`} />
              <StatBox icon={<Crosshair className="h-4 w-4 text-green-500" />} label="Throughput" value={formatStat(entry.teleopFpsEstimate)} />
              <StatBox icon={<Target className="h-4 w-4 text-emerald-500" />} label="Accuracy" value={formatStat(entry.teleopAccuracy, 10, "%")} />
              <StatBox icon={<Shield className="h-4 w-4 text-orange-500" />} label="Defense" value={formatStat(entry.defenseRating, 10, "%")} />
              <StatBox icon={<ArrowUp className="h-4 w-4 text-purple-500" />} label="Climb" value={entry.climbSuccess === "success" ? `L${entry.climbLevel || "?"}` : entry.climbSuccess || "none"} />
              <StatBox icon={<Bot className="h-4 w-4 text-cyan-500" />} label="Move & Shoot" value={entry.teleopMoveWhileShoot ? "Yes" : "No"} />
            </div>

            {(entry.autoNotes || entry.defenseNotes || entry.driverSkillNotes || entry.notes) && (
              <div className="space-y-1.5 pt-1">
                {entry.autoNotes && <NoteRow label="Auto" text={entry.autoNotes} />}
                {entry.defenseNotes && <NoteRow label="Defense" text={entry.defenseNotes} />}
                {entry.driverSkillNotes && <NoteRow label="Driver" text={entry.driverSkillNotes} />}
                {entry.notes && <NoteRow label="Misc." text={entry.notes} />}
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground">No scouting data has been recorded for this team in this match.</p>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href={`/events/${eventId}/schedule`}>
          <Button variant="ghost" size="icon" data-testid="button-back-schedule">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-match-title">
            Qualification {matchNum}
          </h1>
          <p className="text-sm text-muted-foreground">
            {event?.name}{match?.time ? ` — ${formatTime(match.time)}` : ""}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !match ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">Match not found in schedule</p>
            <p className="text-sm text-muted-foreground mt-1">
              This match number doesn't exist in the imported schedule.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              Red Alliance
            </h2>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              {redTeams.map(num => (
                <TeamCard key={num} teamNum={num} alliance="red" entry={getEntriesForTeamNumber(num)[0]} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              Blue Alliance
            </h2>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              {blueTeams.map(num => (
                <TeamCard key={num} teamNum={num} alliance="blue" entry={getEntriesForTeamNumber(num)[0]} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-background/60 rounded-md px-3 py-2 border" data-testid={`stat-${label.toLowerCase()}`}>
      {icon}
      <div>
        <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-bold mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function NoteRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="text-sm">
      <span className="font-semibold text-muted-foreground">{label}:</span>{" "}
      <span>{text}</span>
    </div>
  );
}
