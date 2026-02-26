import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Target, Zap, Shield, ChevronUp, Bot, Video, Swords, MessageSquare } from "lucide-react";
import type { Event, ScoutingEntry, Team, ScheduleMatch, EventTeam } from "@shared/schema";
import placeholderAvatar from "@assets/image_1772067645868.png";

function fmt(val: number, multiplier = 1, suffix = "") {
  const v = val * multiplier;
  return `${parseFloat(v.toFixed(1))}${suffix}`;
}

function StatCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="text-center space-y-1">
      <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-wide">{label}</p>
      <div className={`inline-block rounded-lg px-2.5 py-1 ${bgColor}`}>
        <p className={`text-2xl font-extrabold leading-none ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function TeamMatchCard({
  teamNum,
  entry,
  team,
  eventId,
  alliance,
}: {
  teamNum: number;
  entry?: ScoutingEntry;
  team: Team | null;
  eventId: number;
  alliance: "red" | "blue";
}) {
  const borderColor = alliance === "red" ? "border-red-500/40" : "border-blue-500/40";
  const nameColor = alliance === "red" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";
  const accentBg = alliance === "red" ? "bg-red-500/8" : "bg-blue-500/8";
  const accentText = alliance === "red" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";

  return (
    <Card className={`border-t-4 ${borderColor}`} data-testid={`card-team-${teamNum}`}>
      <CardHeader className="pb-2">
        <Link href={team ? `/events/${eventId}/teams/${team.id}` : "#"}>
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <img
              src={team?.avatar || placeholderAvatar}
              alt=""
              className="w-10 h-10 rounded-full border border-border object-cover bg-white shrink-0"
            />
            <div className="min-w-0">
              <CardTitle className={`text-base font-bold ${nameColor}`} data-testid={`link-team-${teamNum}`}>
                {teamNum} {team ? `- ${team.teamName}` : ""}
              </CardTitle>
            </div>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {!entry ? (
          <div className="text-center py-4">
            <Badge variant="outline" className="text-sm">No scouting data</Badge>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className={`rounded-lg p-3 ${accentBg}`}>
                <p className={`text-xs font-bold ${accentText} uppercase tracking-wide text-center mb-2`}>Auto</p>
                <div className="flex justify-center">
                  <StatCard label="Balls Shot" value={`${entry.autoBallsShot}`} color="text-primary" bgColor="bg-primary/10" />
                </div>
              </div>

              <div className={`rounded-lg p-3 ${accentBg}`}>
                <p className={`text-xs font-bold ${accentText} uppercase tracking-wide text-center mb-2`}>Teleop</p>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Throughput" value={fmt(entry.teleopFpsEstimate)} color="text-chart-2" bgColor="bg-chart-2/10" />
                  <StatCard label="Accuracy" value={fmt(entry.teleopAccuracy, 10, "%")} color="text-chart-3" bgColor="bg-chart-3/10" />
                  <StatCard label="Defense" value={fmt(entry.defenseRating, 10, "%")} color="text-chart-4" bgColor="bg-chart-4/10" />
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Bot className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="text-xs font-medium text-muted-foreground">Move & Shoot:</span>
                  <Badge variant={entry.teleopMoveWhileShoot ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {entry.teleopMoveWhileShoot ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>

              <div className={`rounded-lg p-3 ${accentBg}`}>
                <p className={`text-xs font-bold ${accentText} uppercase tracking-wide text-center mb-2`}>Endgame</p>
                <div className="flex justify-center gap-4">
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-wide">Climb</p>
                    <Badge
                      className={`text-sm font-bold px-3 py-0.5 ${
                        entry.climbSuccess === "success"
                          ? "bg-green-600 text-white"
                          : entry.climbSuccess === "failed"
                          ? "bg-red-500/15 text-red-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {entry.climbSuccess === "success"
                        ? `Level ${entry.climbLevel || "?"}`
                        : entry.climbSuccess === "failed"
                        ? "Failed"
                        : "None"}
                    </Badge>
                  </div>
                  {entry.climbSuccess === "success" && entry.climbPosition && (
                    <div className="text-center space-y-1">
                      <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-wide">Position</p>
                      <Badge variant="outline" className="text-sm font-bold px-3 py-0.5 capitalize">
                        {entry.climbPosition}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(entry.autoNotes || entry.defenseNotes || entry.driverSkillNotes || entry.notes) && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-bold text-foreground/70 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Notes
                </p>
                <div className="space-y-1">
                  {entry.autoNotes && (
                    <div className="rounded px-2.5 py-1.5 bg-primary/5">
                      <span className="text-[10px] font-bold text-primary">Auto</span>
                      <p className="text-xs mt-0.5">{entry.autoNotes}</p>
                    </div>
                  )}
                  {entry.driverSkillNotes && (
                    <div className="rounded px-2.5 py-1.5 bg-chart-2/5">
                      <span className="text-[10px] font-bold text-chart-2">Driver</span>
                      <p className="text-xs mt-0.5">{entry.driverSkillNotes}</p>
                    </div>
                  )}
                  {entry.defenseNotes && (
                    <div className="rounded px-2.5 py-1.5 bg-chart-4/5">
                      <span className="text-[10px] font-bold text-chart-4">Defense</span>
                      <p className="text-xs mt-0.5">{entry.defenseNotes}</p>
                    </div>
                  )}
                  {entry.notes && (
                    <div className="rounded px-2.5 py-1.5 bg-chart-5/5">
                      <span className="text-[10px] font-bold text-chart-5">Misc.</span>
                      <p className="text-xs mt-0.5">{entry.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AllianceSummary({
  teamNums,
  getEntry,
  alliance,
}: {
  teamNums: number[];
  getEntry: (n: number) => ScoutingEntry | undefined;
  alliance: "red" | "blue";
}) {
  const entries = teamNums.map(n => getEntry(n)).filter(Boolean) as ScoutingEntry[];
  const count = entries.length;

  if (count === 0) return null;

  const avgAuto = entries.reduce((s, e) => s + e.autoBallsShot, 0) / count;
  const avgFps = entries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count;
  const avgAcc = entries.reduce((s, e) => s + e.teleopAccuracy, 0) / count * 10;
  const avgDef = entries.reduce((s, e) => s + e.defenseRating, 0) / count * 10;
  const climbRate = Math.round(entries.filter(e => e.climbSuccess === "success").length / count * 100);

  const borderColor = alliance === "red" ? "border-red-500/40" : "border-blue-500/40";
  const bgColor = alliance === "red" ? "bg-red-500/5 dark:bg-red-500/8" : "bg-blue-500/5 dark:bg-blue-500/8";
  const titleColor = alliance === "red" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";
  const dotColor = alliance === "red" ? "bg-red-500" : "bg-blue-500";

  return (
    <Card className={`border-t-4 ${borderColor} ${bgColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-bold ${titleColor} flex items-center gap-2`}>
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} inline-block`} />
          {alliance === "red" ? "Red" : "Blue"} Alliance Averages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-1">
          <StatCard label="Auto" value={fmt(avgAuto)} color="text-primary" bgColor="bg-primary/10" />
          <StatCard label="FPS" value={fmt(avgFps)} color="text-chart-2" bgColor="bg-chart-2/10" />
          <StatCard label="Accuracy" value={`${fmt(avgAcc)}%`} color="text-chart-3" bgColor="bg-chart-3/10" />
          <StatCard label="Defense" value={`${fmt(avgDef)}%`} color="text-chart-4" bgColor="bg-chart-4/10" />
          <StatCard label="Climb" value={`${climbRate}%`} color="text-chart-5" bgColor="bg-chart-5/10" />
        </div>
      </CardContent>
    </Card>
  );
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

  const getEntry = (teamNum: number) => {
    const team = getTeamByNumber(teamNum);
    if (!team || !entries) return undefined;
    return entries.find(e => e.teamId === team.id);
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

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href={`/events/${eventId}/schedule`}>
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-schedule">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Schedule
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Swords className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-match-title">
              Qualification {matchNum}
            </h1>
            <p className="text-base text-muted-foreground mt-0.5">
              {event?.name}{match?.time ? ` — ${formatTime(match.time)}` : ""}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !match ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Swords className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="font-semibold text-lg">Match not found in schedule</p>
            <p className="text-sm text-muted-foreground mt-1">
              This match number doesn't exist in the imported schedule.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AllianceSummary teamNums={redTeams} getEntry={getEntry} alliance="red" />
            <AllianceSummary teamNums={blueTeams} getEntry={getEntry} alliance="blue" />
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              Red Alliance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {redTeams.map(num => (
                <TeamMatchCard key={num} teamNum={num} entry={getEntry(num)} team={getTeamByNumber(num)} eventId={eventId} alliance="red" />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              Blue Alliance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {blueTeams.map(num => (
                <TeamMatchCard key={num} teamNum={num} entry={getEntry(num)} team={getTeamByNumber(num)} eventId={eventId} alliance="blue" />
              ))}
            </div>
          </div>

          {match.videoUrl && (
            <Card className="border-t-4 border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Video className="h-5 w-5 text-red-500" />
                  Match Video
                </CardTitle>
              </CardHeader>
              <CardContent>
                {match.videoUrl.includes("youtube.com") || match.videoUrl.includes("youtu.be") ? (
                  <div className="aspect-video rounded-lg overflow-hidden bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${match.videoUrl.split("v=")[1]?.split("&")[0] || match.videoUrl.split("/").pop()}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`Match ${matchNum} Video`}
                    />
                  </div>
                ) : (
                  <a href={match.videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm font-medium" data-testid="link-match-video">
                    {match.videoUrl}
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
