import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import type { Event, Team, EventTeam, ScoutingEntry } from "@shared/schema";
import placeholderAvatar from "@assets/images_1772071870956.png";

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

const medalColors = [
  { ring: "ring-yellow-400", bg: "bg-gradient-to-b from-yellow-400/25 to-yellow-500/10", text: "text-yellow-500", border: "border-yellow-400/60", label: "1st" },
  { ring: "ring-slate-300 dark:ring-slate-400", bg: "bg-gradient-to-b from-slate-300/20 to-slate-400/10 dark:from-slate-400/20 dark:to-slate-500/10", text: "text-slate-400", border: "border-slate-300/50 dark:border-slate-400/50", label: "2nd" },
  { ring: "ring-amber-600", bg: "bg-gradient-to-b from-amber-600/20 to-amber-700/10", text: "text-amber-600", border: "border-amber-600/50", label: "3rd" },
];

function MiniPodium({
  top3,
  formatValue,
  getValue,
  eventId,
}: {
  top3: TeamStats[];
  formatValue: (v: number) => string;
  getValue: (t: TeamStats) => number;
  eventId: number;
}) {
  const podiumSlots = [
    { rankIdx: 1, height: "h-10" },
    { rankIdx: 0, height: "h-16" },
    { rankIdx: 2, height: "h-7" },
  ];

  return (
    <div className="flex items-end justify-center gap-3 px-2">
      {podiumSlots.map(({ rankIdx, height }) => {
        const ts = top3[rankIdx];
        if (!ts) return <div key={rankIdx} className="flex-1" />;
        const m = medalColors[rankIdx];
        const isFirst = rankIdx === 0;
        return (
          <Link key={ts.teamId} href={`/events/${eventId}/teams/${ts.teamId}`} className="flex-1">
            <div className="flex flex-col items-center cursor-pointer group min-w-0 w-full" data-testid={`podium-${rankIdx + 1}`}>
              <div className={`relative ${isFirst ? `ring-2 ${m.ring} ring-offset-2 ring-offset-background` : `ring-1 ${m.ring} ring-offset-1 ring-offset-background`} rounded-full mb-0.5`}>
                <img
                  src={ts.team?.avatar || placeholderAvatar}
                  alt={`Team ${ts.team?.teamNumber}`}
                  className={`${isFirst ? "w-11 h-11" : "w-8 h-8"} rounded-full border border-border object-cover bg-white`}
                />
                {isFirst && <Crown className="absolute -top-2 -right-1 h-4 w-4 text-yellow-500 fill-yellow-500" />}
              </div>
              <span className="font-extrabold text-xs group-hover:text-primary transition-colors">{ts.team?.teamNumber}</span>
              <span className={`${isFirst ? "text-base" : "text-sm"} font-black tabular-nums leading-tight`}>{formatValue(getValue(ts))}</span>
              <div className={`w-full ${height} ${m.bg} ${m.border} border-t-2 rounded-t-md flex items-start justify-center pt-0.5 mt-0.5`}>
                <span className={`text-xs font-black ${m.text}`}>{m.label}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function LeaderboardCard({
  title,
  icon,
  teams,
  getValue,
  formatValue,
  eventId,
  sortFn,
  accentColor,
  extraProps,
}: {
  title: string;
  icon: React.ReactNode;
  teams: TeamStats[];
  getValue: (t: TeamStats) => number;
  formatValue: (v: number) => string;
  eventId: number;
  sortFn?: (a: TeamStats, b: TeamStats) => number;
  accentColor: string;
  extraProps?: string;
}) {
  const sorted = [...teams].sort(sortFn ? (a, b) => sortFn(b, a) : (a, b) => getValue(b) - getValue(a));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3, 5);

  if (top3.length === 0) return null;

  return (
    <Card className={`border-t-3 ${accentColor} ${extraProps || ""}`} data-testid={`leaderboard-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="pb-1 pt-2.5 px-3">
        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2.5 pt-0">
        <MiniPodium top3={top3} formatValue={formatValue} getValue={getValue} eventId={eventId} />
        {rest.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-0">
            {rest.map((ts, i) => (
              <Link key={ts.teamId} href={`/events/${eventId}/teams/${ts.teamId}`}>
                <div className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer transition-colors" data-testid={`leaderboard-row-${i + 4}`}>
                  <span className="text-[11px] font-bold text-muted-foreground w-4 text-center shrink-0">{i + 4}</span>
                  <img
                    src={ts.team?.avatar || placeholderAvatar}
                    alt={`Team ${ts.team?.teamNumber}`}
                    className="w-5 h-5 rounded-full border border-border object-cover bg-white shrink-0"
                  />
                  <span className="font-bold text-xs flex-1 truncate">{ts.team?.teamNumber}</span>
                  <span className="text-xs font-extrabold tabular-nums shrink-0">{formatValue(getValue(ts))}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
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
          opr: (et as any).opr || 0,
          dpr: (et as any).dpr || 0,
          ccwm: (et as any).ccwm || 0,
          avgAuto: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, climbRate: 0, avgClimbLevel: 0,
        };
      }
      const climbs = te.filter(e => e.climbSuccess === "success");
      return {
        teamId: et.teamId,
        team: et.team,
        opr: (et as any).opr || 0,
        dpr: (et as any).dpr || 0,
        ccwm: (et as any).ccwm || 0,
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
  const teamsWithOpr = teamStatsList.filter(t => t.opr > 0);
  const matchesScouted = entries ? new Set(entries.map(e => e.matchNumber)).size : 0;

  if (eventLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
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

  const hasAnyData = teamsWithData.length > 0 || teamsWithOpr.length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
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
        <h2 className="text-xl font-bold flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5" />
          Leaderboards
        </h2>

        {!hasAnyData ? (
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
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {teamsWithOpr.length > 0 && (
              <LeaderboardCard
                title="OPR"
                icon={<Crown className="h-3.5 w-3.5 text-yellow-500" />}
                teams={teamsWithOpr}
                getValue={t => t.opr}
                formatValue={v => parseFloat(v.toFixed(1)).toString()}
                eventId={eventId}
                accentColor="border-yellow-500/40"
              />
            )}
            <LeaderboardCard
              title="Auto"
              icon={<Zap className="h-3.5 w-3.5 text-primary" />}
              teams={teamsWithData}
              getValue={t => t.avgAuto}
              formatValue={v => parseFloat(v.toFixed(1)).toString()}
              eventId={eventId}
              accentColor="border-primary/30"
            />
            <LeaderboardCard
              title="Throughput"
              icon={<BarChart3 className="h-3.5 w-3.5 text-chart-2" />}
              teams={teamsWithData}
              getValue={t => t.avgThroughput}
              formatValue={v => parseFloat(v.toFixed(1)).toString()}
              eventId={eventId}
              accentColor="border-chart-2/30"
            />
            <LeaderboardCard
              title="Accuracy"
              icon={<Target className="h-3.5 w-3.5 text-chart-3" />}
              teams={teamsWithData}
              getValue={t => t.avgAccuracy}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
              accentColor="border-chart-3/30"
            />
            <LeaderboardCard
              title="Defense"
              icon={<Shield className="h-3.5 w-3.5 text-chart-4" />}
              teams={teamsWithData}
              getValue={t => t.avgDefense}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
              accentColor="border-chart-4/30"
            />
            <LeaderboardCard
              title="Climb Rate"
              icon={<ChevronUp className="h-3.5 w-3.5 text-chart-5" />}
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
