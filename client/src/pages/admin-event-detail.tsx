import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Calendar,
  Trophy,
  Target,
  Shield,
  ChevronUp,
  Zap,
  Crown,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import type { Event, Team, EventTeam, ScoutingEntry } from "@shared/schema";
import placeholderAvatar from "@assets/image_1772067604092.png";

type TeamStats = {
  teamId: number;
  team?: Team;
  opr: number;
  dpr: number;
  ccwm: number;
  avgAuto: number;
  avgThroughput: number;
  avgAccuracy: number;
  avgDefense: number;
  climbRate: number;
  avgClimbLevel: number;
};

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function TeamAvatar({ team, size = "md" }: { team?: Team; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
  };
  const src = team?.avatar || placeholderAvatar;
  return (
    <img
      src={src}
      alt={team ? `Team ${team.teamNumber}` : "Team"}
      className={`${sizeClasses[size]} rounded-full border-2 border-border object-cover bg-white`}
      data-testid={`img-avatar-${team?.teamNumber || "unknown"}`}
    />
  );
}

function PodiumBlock({
  rank,
  ts,
  formatValue,
  getValue,
  eventId,
}: {
  rank: number;
  ts: TeamStats;
  formatValue: (v: number) => string;
  getValue: (t: TeamStats) => number;
  eventId: number;
}) {
  const podiumHeight = rank === 1 ? "h-28" : rank === 2 ? "h-20" : "h-14";
  const podiumColor = rank === 1
    ? "bg-yellow-400/20 dark:bg-yellow-500/15 border-yellow-400/50"
    : rank === 2
    ? "bg-gray-300/20 dark:bg-gray-400/15 border-gray-400/50"
    : "bg-amber-600/15 dark:bg-amber-700/15 border-amber-600/40";
  const crownColor = rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : "text-amber-600";
  const avatarSize = rank === 1 ? "lg" : "md";
  const order = rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3";
  const avatarBorderExtra = rank === 1
    ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-background"
    : rank === 2
    ? "ring-2 ring-gray-400 ring-offset-1 ring-offset-background"
    : "ring-2 ring-amber-600 ring-offset-1 ring-offset-background";

  return (
    <div className={`flex-1 flex flex-col items-center ${order}`}>
      <Link href={`/events/${eventId}/teams/${ts.teamId}`}>
        <div className="flex flex-col items-center cursor-pointer group" data-testid={`podium-${rank}`}>
          <div className={`relative mb-1 ${avatarBorderExtra} rounded-full`}>
            <TeamAvatar team={ts.team} size={avatarSize} />
            {rank === 1 && (
              <Crown className={`absolute -top-2 -right-2 h-5 w-5 ${crownColor} fill-current`} />
            )}
          </div>
          <p className="font-extrabold text-sm group-hover:text-primary transition-colors">{ts.team?.teamNumber}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[100px] text-center">{ts.team?.teamName}</p>
          <p className="text-lg font-black mt-0.5 tabular-nums">{formatValue(getValue(ts))}</p>
        </div>
      </Link>
      <div className={`w-full ${podiumHeight} ${podiumColor} border-t-2 rounded-t-lg flex items-start justify-center pt-2 mt-1`}>
        <span className={`text-2xl font-black ${crownColor}`}>{getOrdinal(rank)}</span>
      </div>
    </div>
  );
}

function LeaderboardSection({
  title,
  icon,
  teams,
  getValue,
  formatValue,
  eventId,
  sortFn,
  accentColor,
  sortField,
}: {
  title: string;
  icon: React.ReactNode;
  teams: TeamStats[];
  getValue: (t: TeamStats) => number;
  formatValue: (v: number) => string;
  eventId: number;
  sortFn?: (a: TeamStats, b: TeamStats) => number;
  accentColor: string;
  sortField: string;
}) {
  const sorted = [...teams].sort(sortFn ? (a, b) => sortFn(b, a) : (a, b) => getValue(b) - getValue(a));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3, 8);

  if (top3.length === 0) return null;

  return (
    <Card className={`border-t-4 ${accentColor}`} data-testid={`leaderboard-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2 px-2">
          {top3.map((ts, i) => (
            <PodiumBlock key={ts.teamId} rank={i + 1} ts={ts} formatValue={formatValue} getValue={getValue} eventId={eventId} />
          ))}
        </div>

        {rest.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border">
            {rest.map((ts, i) => {
              const rank = i + 4;
              return (
                <Link key={ts.teamId} href={`/events/${eventId}/teams/${ts.teamId}`}>
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" data-testid={`leaderboard-row-${rank}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold w-7 text-muted-foreground">
                        {getOrdinal(rank)}
                      </span>
                      <TeamAvatar team={ts.team} size="sm" />
                      <div>
                        <span className="font-bold text-primary">{ts.team?.teamNumber}</span>
                        <span className="ml-1.5 text-sm font-medium">{ts.team?.teamName}</span>
                      </div>
                    </div>
                    <span className="text-lg font-extrabold tabular-nums">
                      {formatValue(getValue(ts))}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <Link href={`/events/${eventId}/teams?sort=${sortField}&dir=desc`}>
          <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-all-${sortField}`}>
            View All Teams
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function AdminEventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);

  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const teamStatsList = useMemo((): TeamStats[] => {
    if (!eventTeams || !entries) return [];
    return eventTeams.map(et => {
      const te = entries.filter(e => e.teamId === et.teamId);
      const count = te.length;
      if (count === 0) {
        return {
          teamId: et.teamId,
          team: et.team,
          avgAuto: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, climbRate: 0, avgClimbLevel: 0,
        };
      }
      const climbs = te.filter(e => e.climbSuccess === "success");
      return {
        teamId: et.teamId,
        team: et.team,
        avgAuto: te.reduce((s, e) => s + e.autoBallsShot, 0) / count,
        avgThroughput: te.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count,
        avgAccuracy: te.reduce((s, e) => s + e.teleopAccuracy, 0) / count * 10,
        avgDefense: te.reduce((s, e) => s + e.defenseRating, 0) / count * 10,
        climbRate: climbs.length / count * 100,
        avgClimbLevel: climbs.length > 0 ? climbs.reduce((s, e) => s + (parseInt(e.climbLevel || "0") || 0), 0) / climbs.length : 0,
      };
    });
  }, [eventTeams, entries]);

  const teamsWithData = teamStatsList.filter(t => t.avgAuto > 0 || t.avgThroughput > 0 || t.avgAccuracy > 0 || t.avgDefense > 0 || t.climbRate > 0);
  const matchesScouted = entries ? new Set(entries.map(e => e.matchNumber)).size : 0;

  if (eventLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-event-name">
          {event.name}
        </h1>
        <div className="flex items-center gap-3 mt-1 text-base text-muted-foreground flex-wrap">
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {event.location}
            </span>
          )}
          {event.startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {event.startDate}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
            {eventTeams?.length || 0} teams
          </Badge>
          <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
            {matchesScouted} matches scouted
          </Badge>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5" />
          Leaderboard
        </h2>

        {teamsWithData.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-lg">No scouting data yet</p>
              <p className="text-muted-foreground mt-1">
                Head to the Scout tab to start recording match data. Leaderboards will populate automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <LeaderboardSection
              title="Auto Balls Shot"
              icon={<Zap className="h-4 w-4 text-primary" />}
              teams={teamsWithData}
              getValue={t => t.avgAuto}
              formatValue={v => parseFloat(v.toFixed(1)).toString()}
              eventId={eventId}
              accentColor="border-primary/30"
            />
            <LeaderboardSection
              title="Throughput"
              icon={<Target className="h-4 w-4 text-chart-2" />}
              teams={teamsWithData}
              getValue={t => t.avgThroughput}
              formatValue={v => parseFloat(v.toFixed(1)).toString()}
              eventId={eventId}
              accentColor="border-chart-2/30"
            />
            <LeaderboardSection
              title="Accuracy"
              icon={<Target className="h-4 w-4 text-chart-3" />}
              teams={teamsWithData}
              getValue={t => t.avgAccuracy}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
              accentColor="border-chart-3/30"
            />
            <LeaderboardSection
              title="Defense"
              icon={<Shield className="h-4 w-4 text-chart-4" />}
              teams={teamsWithData}
              getValue={t => t.avgDefense}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
              accentColor="border-chart-4/30"
            />
            <LeaderboardSection
              title="Climb Rate"
              icon={<ChevronUp className="h-4 w-4 text-chart-5" />}
              teams={teamsWithData}
              getValue={t => t.climbRate}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
              accentColor="border-chart-5/30"
              sortFn={(a, b) => {
                const diff = a.climbRate - b.climbRate;
                if (diff !== 0) return diff;
                return a.avgClimbLevel - b.avgClimbLevel;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
