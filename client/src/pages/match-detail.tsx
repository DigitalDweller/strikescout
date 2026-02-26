import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Swords, Video, Trophy } from "lucide-react";
import type { Event, Team, ScheduleMatch, EventTeam } from "@shared/schema";
import placeholderAvatar from "@assets/image_1772067645868.png";

export default function MatchDetail() {
  const { id, matchNumber } = useParams<{ id: string; matchNumber: string }>();
  const eventId = parseInt(id || "0");
  const matchNum = parseInt(matchNumber || "0");

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: schedule, isLoading } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const teamMap = new Map<number, Team>();
  eventTeams?.forEach(et => {
    teamMap.set(et.team.teamNumber, et.team);
  });

  const match = schedule?.find(m => m.matchNumber === matchNum);

  const redTeams = match ? [match.red1, match.red2, match.red3].filter(Boolean) as number[] : [];
  const blueTeams = match ? [match.blue1, match.blue2, match.blue3].filter(Boolean) as number[] : [];

  const hasScores = match?.redScore != null && match?.blueScore != null;
  const redWon = match?.winningAlliance === "red";
  const blueWon = match?.winningAlliance === "blue";
  const isTie = hasScores && !redWon && !blueWon;

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

  const getYoutubeId = (url: string) => {
    if (url.includes("v=")) return url.split("v=")[1]?.split("&")[0];
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1]?.split("?")[0];
    return url.split("/").pop();
  };

  const winnerFr = hasScores && (redWon || blueWon) ? "3fr" : "1fr";
  const loserFr = hasScores && (redWon || blueWon) ? "2fr" : "1fr";
  const redFr = redWon ? winnerFr : loserFr;
  const blueFr = blueWon ? winnerFr : loserFr;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <Link href={`/events/${eventId}/schedule`}>
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-schedule">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Schedule
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-match-title">
          Qualification {matchNum}
        </h1>
        <p className="text-base text-muted-foreground mt-0.5">
          {event?.name}{match?.time ? ` — ${formatTime(match.time)}` : ""}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
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
        <div className="space-y-4">
          {match.videoUrl && (match.videoUrl.includes("youtube.com") || match.videoUrl.includes("youtu.be")) && (
            <div className="flex justify-center">
              <div className="w-full max-w-lg aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${getYoutubeId(match.videoUrl)}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={`Match ${matchNum} Video`}
                />
              </div>
            </div>
          )}

          {match.videoUrl && !(match.videoUrl.includes("youtube.com") || match.videoUrl.includes("youtu.be")) && (
            <a href={match.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-primary hover:underline text-sm font-medium" data-testid="link-match-video">
              <Video className="h-4 w-4" />
              Watch Match Video
            </a>
          )}

          <div
            className="grid items-stretch gap-0 rounded-xl overflow-hidden border border-border transition-all duration-300"
            style={{ gridTemplateColumns: `${redFr} auto ${blueFr}` }}
          >
            <div className={`p-4 transition-all duration-300 ${redWon ? "bg-red-500/15 dark:bg-red-500/20" : hasScores && blueWon ? "bg-red-500/3 dark:bg-red-500/5 opacity-75" : "bg-red-500/5 dark:bg-red-500/8"}`}>
              <div className="flex items-center gap-2 mb-3">
                {redWon && <Trophy className="h-5 w-5 text-yellow-500" />}
                <p className={`text-sm font-bold uppercase tracking-wide ${redWon ? "text-red-600 dark:text-red-400" : "text-red-500/60 dark:text-red-400/50"}`}>
                  Red Alliance
                </p>
              </div>

              {hasScores && (
                <p className={`font-extrabold tabular-nums mb-4 ${redWon ? "text-5xl text-red-600 dark:text-red-400" : "text-3xl text-red-500/40 dark:text-red-400/40"}`} data-testid="text-red-score">
                  {match.redScore}
                </p>
              )}

              <div className="space-y-2">
                {redTeams.map(num => {
                  const team = teamMap.get(num);
                  return (
                    <Link key={num} href={team ? `/events/${eventId}/teams/${team.id}` : "#"}>
                      <div className="flex items-center gap-2.5 py-1 hover:opacity-80 transition-opacity cursor-pointer" data-testid={`link-team-${num}`}>
                        <img
                          src={team?.avatar || placeholderAvatar}
                          alt=""
                          className={`rounded-full border border-border object-cover bg-white shrink-0 ${redWon ? "w-9 h-9" : "w-7 h-7"}`}
                        />
                        <div className="min-w-0">
                          <p className={`font-bold text-foreground leading-tight ${redWon ? "text-sm" : "text-xs"} ${!redWon && hasScores && blueWon ? "text-foreground/60" : ""}`}>{num}</p>
                          <p className={`text-muted-foreground truncate ${redWon ? "text-xs" : "text-[11px]"}`}>{team?.teamName || "Unknown"}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center px-3 bg-muted/30 border-x border-border">
              <Swords className="h-5 w-5 text-muted-foreground" />
              {isTie && (
                <span className="text-[10px] font-bold text-muted-foreground mt-1">TIE</span>
              )}
            </div>

            <div className={`p-4 transition-all duration-300 ${blueWon ? "bg-blue-500/15 dark:bg-blue-500/20" : hasScores && redWon ? "bg-blue-500/3 dark:bg-blue-500/5 opacity-75" : "bg-blue-500/5 dark:bg-blue-500/8"}`}>
              <div className="flex items-center gap-2 mb-3">
                {blueWon && <Trophy className="h-5 w-5 text-yellow-500" />}
                <p className={`text-sm font-bold uppercase tracking-wide ${blueWon ? "text-blue-600 dark:text-blue-400" : "text-blue-500/60 dark:text-blue-400/50"}`}>
                  Blue Alliance
                </p>
              </div>

              {hasScores && (
                <p className={`font-extrabold tabular-nums mb-4 ${blueWon ? "text-5xl text-blue-600 dark:text-blue-400" : "text-3xl text-blue-500/40 dark:text-blue-400/40"}`} data-testid="text-blue-score">
                  {match.blueScore}
                </p>
              )}

              <div className="space-y-2">
                {blueTeams.map(num => {
                  const team = teamMap.get(num);
                  return (
                    <Link key={num} href={team ? `/events/${eventId}/teams/${team.id}` : "#"}>
                      <div className="flex items-center gap-2.5 py-1 hover:opacity-80 transition-opacity cursor-pointer" data-testid={`link-team-${num}`}>
                        <img
                          src={team?.avatar || placeholderAvatar}
                          alt=""
                          className={`rounded-full border border-border object-cover bg-white shrink-0 ${blueWon ? "w-9 h-9" : "w-7 h-7"}`}
                        />
                        <div className="min-w-0">
                          <p className={`font-bold text-foreground leading-tight ${blueWon ? "text-sm" : "text-xs"} ${!blueWon && hasScores && redWon ? "text-foreground/60" : ""}`}>{num}</p>
                          <p className={`text-muted-foreground truncate ${blueWon ? "text-xs" : "text-[11px]"}`}>{team?.teamName || "Unknown"}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {!hasScores && (
            <p className="text-center text-sm text-muted-foreground">
              Scores not yet available. Sync results from TBA in Event Settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
