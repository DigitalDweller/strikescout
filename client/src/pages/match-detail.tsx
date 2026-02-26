import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Target, Crosshair, Shield, ArrowUp, Bot, Video, Swords } from "lucide-react";
import type { Event, ScoutingEntry, Team, ScheduleMatch, EventTeam } from "@shared/schema";
import placeholderAvatar from "@assets/image_1772067645868.png";

function fmt(val: number, multiplier = 1, suffix = "") {
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

  const calcAllianceAvg = (teamNums: number[], field: (e: ScoutingEntry) => number) => {
    const vals = teamNums.map(n => getEntry(n)).filter(Boolean).map(e => field(e!));
    if (vals.length === 0) return "-";
    return fmt(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
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
        <Skeleton className="h-96 w-full" />
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
        <div className="space-y-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="text-right">
              <p className="text-xl font-extrabold text-red-600 dark:text-red-400">Red Alliance</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {redTeams.map(n => n).join(" · ")}
              </p>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Swords className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <div className="text-left">
              <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">Blue Alliance</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {blueTeams.map(n => n).join(" · ")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
            <StatCompareColumn teamNums={redTeams} getEntry={getEntry} getTeamByNumber={getTeamByNumber} alliance="red" />
            <div className="flex flex-col items-center gap-0">
              {["Auto", "Throughput", "Accuracy", "Defense", "Climb", "Move&Shoot"].map(label => (
                <div key={label} className="h-[52px] flex items-center justify-center">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>
            <StatCompareColumn teamNums={blueTeams} getEntry={getEntry} getTeamByNumber={getTeamByNumber} alliance="blue" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                Red Teams
              </h3>
              {redTeams.map(num => (
                <TeamDetailCard key={num} teamNum={num} entry={getEntry(num)} team={getTeamByNumber(num)} eventId={eventId} alliance="red" />
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                Blue Teams
              </h3>
              {blueTeams.map(num => (
                <TeamDetailCard key={num} teamNum={num} entry={getEntry(num)} team={getTeamByNumber(num)} eventId={eventId} alliance="blue" />
              ))}
            </div>
          </div>

          {match.videoUrl && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Video className="h-5 w-5 text-red-500" />
                  <span className="font-bold text-sm">Match Video</span>
                </div>
                {match.videoUrl.includes("youtube.com") || match.videoUrl.includes("youtu.be") ? (
                  <div className="aspect-video rounded-md overflow-hidden bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${match.videoUrl.split("v=")[1]?.split("&")[0] || match.videoUrl.split("/").pop()}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`Match ${matchNum} Video`}
                    />
                  </div>
                ) : (
                  <a href={match.videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm" data-testid="link-match-video">
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

function StatCompareColumn({
  teamNums,
  getEntry,
  getTeamByNumber,
  alliance,
}: {
  teamNums: number[];
  getEntry: (n: number) => ScoutingEntry | undefined;
  getTeamByNumber: (n: number) => Team | null;
  alliance: "red" | "blue";
}) {
  const entries = teamNums.map(n => getEntry(n)).filter(Boolean) as ScoutingEntry[];
  const count = entries.length;

  const avg = (fn: (e: ScoutingEntry) => number) => {
    if (count === 0) return "-";
    return fmt(entries.reduce((s, e) => s + fn(e), 0) / count);
  };

  const borderColor = alliance === "red" ? "border-red-500/30" : "border-blue-500/30";
  const bgColor = alliance === "red" ? "bg-red-500/5" : "bg-blue-500/5";
  const textColor = alliance === "red" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";
  const align = alliance === "red" ? "text-right" : "text-left";

  const stats = [
    { value: avg(e => e.autoBallsShot) },
    { value: avg(e => e.teleopFpsEstimate) },
    { value: count > 0 ? `${fmt(entries.reduce((s, e) => s + e.teleopAccuracy, 0) / count, 10)}%` : "-" },
    { value: count > 0 ? `${fmt(entries.reduce((s, e) => s + e.defenseRating, 0) / count, 10)}%` : "-" },
    { value: count > 0 ? (() => {
        const successes = entries.filter(e => e.climbSuccess === "success");
        return `${Math.round(successes.length / count * 100)}%`;
      })() : "-" },
    { value: count > 0 ? `${entries.filter(e => e.teleopMoveWhileShoot).length}/${count}` : "-" },
  ];

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      {stats.map((s, i) => (
        <div key={i} className={`h-[52px] flex items-center px-4 ${align} ${i > 0 ? "border-t border-border/50" : ""}`}>
          <span className={`text-lg font-bold ${textColor} ${alliance === "red" ? "ml-auto" : ""}`}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function TeamDetailCard({
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
  const borderColor = alliance === "red" ? "border-l-red-500" : "border-l-blue-500";
  const nameColor = alliance === "red" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400";

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Link href={team ? `/events/${eventId}/teams/${team.id}` : "#"}>
            <span className={`font-bold ${nameColor} hover:underline cursor-pointer flex items-center gap-2`} data-testid={`link-team-${teamNum}`}>
              <img src={team?.avatar || placeholderAvatar} alt="" className="w-6 h-6 rounded-full border border-border object-cover bg-white shrink-0" />
              {teamNum} {team ? `- ${team.teamName}` : ""}
            </span>
          </Link>
          {!entry && <Badge variant="outline" className="text-xs">No data</Badge>}
        </div>

        {entry && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat icon={<Target className="h-3.5 w-3.5 text-blue-500" />} label="Auto" value={`${entry.autoBallsShot}`} />
              <MiniStat icon={<Crosshair className="h-3.5 w-3.5 text-green-500" />} label="FPS" value={fmt(entry.teleopFpsEstimate)} />
              <MiniStat icon={<Target className="h-3.5 w-3.5 text-emerald-500" />} label="Acc" value={fmt(entry.teleopAccuracy, 10, "%")} />
              <MiniStat icon={<Shield className="h-3.5 w-3.5 text-orange-500" />} label="Def" value={fmt(entry.defenseRating, 10, "%")} />
              <MiniStat icon={<ArrowUp className="h-3.5 w-3.5 text-purple-500" />} label="Climb" value={entry.climbSuccess === "success" ? `L${entry.climbLevel || "?"}` : entry.climbSuccess || "none"} />
              <MiniStat icon={<Bot className="h-3.5 w-3.5 text-cyan-500" />} label="M&S" value={entry.teleopMoveWhileShoot ? "Yes" : "No"} />
            </div>
            {(entry.autoNotes || entry.defenseNotes || entry.driverSkillNotes || entry.notes) && (
              <div className="text-xs space-y-0.5 text-muted-foreground border-t pt-2 mt-1">
                {entry.autoNotes && <p><span className="font-semibold">Auto:</span> {entry.autoNotes}</p>}
                {entry.defenseNotes && <p><span className="font-semibold">Defense:</span> {entry.defenseNotes}</p>}
                {entry.driverSkillNotes && <p><span className="font-semibold">Driver:</span> {entry.driverSkillNotes}</p>}
                {entry.notes && <p><span className="font-semibold">Misc.:</span> {entry.notes}</p>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-background/60 rounded px-2 py-1.5 border">
      {icon}
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
        <p className="text-xs font-bold mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}
