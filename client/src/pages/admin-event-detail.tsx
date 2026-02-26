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
import placeholderAvatar from "@assets/image_1772067645868.png";

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

function CompactLeaderboard({
  title,
  icon,
  teams,
  getValue,
  formatValue,
  eventId,
  sortFn,
  accentColor,
  barColor,
}: {
  title: string;
  icon: React.ReactNode;
  teams: TeamStats[];
  getValue: (t: TeamStats) => number;
  formatValue: (v: number) => string;
  eventId: number;
  sortFn?: (a: TeamStats, b: TeamStats) => number;
  accentColor: string;
  barColor: string;
}) {
  const sorted = [...teams].sort(sortFn ? (a, b) => sortFn(b, a) : (a, b) => getValue(b) - getValue(a));
  const top5 = sorted.slice(0, 5);
  if (top5.length === 0) return null;

  const maxVal = Math.max(...top5.map(t => getValue(t)), 0.01);

  return (
    <Card className={`border-t-3 ${accentColor}`} data-testid={`leaderboard-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-1">
        <div className="space-y-0.5">
          {top5.map((ts, i) => {
            const rank = i + 1;
            const pct = maxVal > 0 ? Math.max((getValue(ts) / maxVal) * 100, 3) : 3;
            const isFirst = rank === 1;
            return (
              <Link key={ts.teamId} href={`/events/${eventId}/teams/${ts.teamId}`}>
                <div
                  className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors hover:bg-muted/60 ${isFirst ? "bg-muted/40" : ""}`}
                  data-testid={`leaderboard-row-${rank}`}
                >
                  <span className={`text-xs font-extrabold w-4 text-center shrink-0 ${isFirst ? "text-yellow-500" : "text-muted-foreground"}`}>
                    {rank}
                  </span>
                  <img
                    src={ts.team?.avatar || placeholderAvatar}
                    alt={`Team ${ts.team?.teamNumber}`}
                    className="w-6 h-6 rounded-full border border-border object-cover bg-white shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`font-bold text-sm truncate ${isFirst ? "text-foreground" : ""}`}>
                        {ts.team?.teamNumber}
                      </span>
                      <span className="text-sm font-extrabold tabular-nums shrink-0">
                        {formatValue(getValue(ts))}
                      </span>
                    </div>
                    <div className="h-1 bg-muted/50 rounded-full overflow-hidden mt-0.5">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function OprLeaderboard({
  teams,
  eventId,
}: {
  teams: TeamStats[];
  eventId: number;
}) {
  const sorted = [...teams].filter(t => t.opr > 0).sort((a, b) => b.opr - a.opr);
  const top5 = sorted.slice(0, 5);
  if (top5.length === 0) return null;

  const maxVal = Math.max(...top5.map(t => t.opr), 0.01);

  return (
    <Card className="border-t-3 border-yellow-500/40 sm:col-span-2 lg:col-span-1" data-testid="leaderboard-section-opr">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
          <Crown className="h-4 w-4 text-yellow-500" />
          OPR
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-1">
        <div className="space-y-0.5">
          {top5.map((ts, i) => {
            const rank = i + 1;
            const pct = maxVal > 0 ? Math.max((ts.opr / maxVal) * 100, 3) : 3;
            const isFirst = rank === 1;
            return (
              <Link key={ts.teamId} href={`/events/${eventId}/teams/${ts.teamId}`}>
                <div
                  className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors hover:bg-muted/60 ${isFirst ? "bg-muted/40" : ""}`}
                  data-testid={`leaderboard-opr-row-${rank}`}
                >
                  <span className={`text-xs font-extrabold w-4 text-center shrink-0 ${isFirst ? "text-yellow-500" : "text-muted-foreground"}`}>
                    {rank}
                  </span>
                  <img
                    src={ts.team?.avatar || placeholderAvatar}
                    alt={`Team ${ts.team?.teamNumber}`}
                    className="w-6 h-6 rounded-full border border-border object-cover bg-white shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`font-bold text-sm truncate ${isFirst ? "text-foreground" : ""}`}>
                        {ts.team?.teamNumber}
                      </span>
                      <span className="text-sm font-extrabold tabular-nums shrink-0">
                        {parseFloat(ts.opr.toFixed(1)).toString()}
                      </span>
                    </div>
                    <div className="h-1 bg-muted/50 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full rounded-full bg-yellow-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
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
            <OprLeaderboard teams={teamStatsList} eventId={eventId} />
            <CompactLeaderboard
              title="Auto"
              icon={<Zap className="h-3.5 w-3.5 text-primary" />}
              teams={teamsWithData}
              getValue={t => t.avgAuto}
              formatValue={v => parseFloat(v.toFixed(1)).toString()}
              eventId={eventId}
              accentColor="border-primary/30"
              barColor="bg-primary"
            />
            <CompactLeaderboard
              title="Throughput"
              icon={<BarChart3 className="h-3.5 w-3.5 text-chart-2" />}
              teams={teamsWithData}
              getValue={t => t.avgThroughput}
              formatValue={v => parseFloat(v.toFixed(1)).toString()}
              eventId={eventId}
              accentColor="border-chart-2/30"
              barColor="bg-chart-2"
            />
            <CompactLeaderboard
              title="Accuracy"
              icon={<Target className="h-3.5 w-3.5 text-chart-3" />}
              teams={teamsWithData}
              getValue={t => t.avgAccuracy}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
              accentColor="border-chart-3/30"
              barColor="bg-chart-3"
            />
            <CompactLeaderboard
              title="Defense"
              icon={<Shield className="h-3.5 w-3.5 text-chart-4" />}
              teams={teamsWithData}
              getValue={t => t.avgDefense}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
              accentColor="border-chart-4/30"
              barColor="bg-chart-4"
            />
            <CompactLeaderboard
              title="Climb Rate"
              icon={<ChevronUp className="h-3.5 w-3.5 text-chart-5" />}
              teams={teamsWithData}
              getValue={t => t.climbRate}
              formatValue={v => `${Math.round(v)}%`}
              eventId={eventId}
              accentColor="border-chart-5/30"
              barColor="bg-chart-5"
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
