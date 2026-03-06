import { useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Calendar,
  Users,
  User as UserIcon,
  ClipboardList,
  CalendarDays,
  ListOrdered,
  Database,
  Settings,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Circle,
  Rocket,
} from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import type { Event, EventTeam, ScoutingEntry, ScheduleMatch, Team } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { getHeatColor } from "@/lib/team-colors";

function formatMatchLabel(matchNumber: number): string {
  return `Q${matchNumber}`;
}

function formatScheduleTime(timeStr: string | null | undefined): string | null {
  if (!timeStr || !timeStr.trim()) return null;
  try {
    const iso = timeStr.replace(" ", "T");
    const d = parseISO(iso);
    if (Number.isNaN(d.getTime())) return null;
    return format(d, "EEE h:mm a");
  } catch {
    return null;
  }
}

function isMatchOver(m: { winningAlliance?: string | null; videoUrl?: string | null }): boolean {
  const hasWinner = m.winningAlliance != null && String(m.winningAlliance).trim() !== "";
  const hasVideo = m.videoUrl != null && String(m.videoUrl).trim() !== "";
  return hasWinner || hasVideo;
}

export default function AdminEventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const help = useHelp();

  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const { data: schedule } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
  });

  const stats = useMemo(() => {
    const teamCount = eventTeams?.length ?? 0;
    const scheduleCount = Array.isArray(schedule) ? schedule.length : 0;
    const totalEntries = entries?.length ?? 0;
    const matchesScouted = entries ? new Set(entries.map((e) => e.matchNumber)).size : 0;
    const teamsWithData = entries ? new Set(entries.map((e) => e.teamId)).size : 0;
    const teamsWithoutData = teamCount - teamsWithData;
    const coveragePct =
      teamCount > 0 && scheduleCount > 0
        ? Math.round((totalEntries / (teamCount * Math.max(scheduleCount, 1))) * 100)
        : 0;
    return {
      teamCount,
      scheduleCount,
      totalEntries,
      matchesScouted,
      teamsWithData,
      teamsWithoutData: Math.max(0, teamsWithoutData),
      coveragePct,
    };
  }, [eventTeams, entries, schedule]);

  const badgeVals = [stats.teamCount, stats.matchesScouted, stats.scheduleCount, stats.totalEntries];
  const badgeMin = Math.min(...badgeVals);
  const badgeMax = Math.max(...badgeVals);
  const teamsBadgeHeat = getHeatColor(stats.teamCount, badgeMin, badgeMax || 1);
  const matchesScoutedHeat = getHeatColor(stats.matchesScouted, badgeMin, badgeMax || 1);
  const scheduleBadgeHeat = getHeatColor(stats.scheduleCount, badgeMin, badgeMax || 1);
  const entriesBadgeHeat = getHeatColor(stats.totalEntries, badgeMin, badgeMax || 1);

  const { completedMatches, upcomingMatches } = useMemo(() => {
    if (!Array.isArray(schedule) || schedule.length === 0) {
      return { completedMatches: [], upcomingMatches: [] };
    }
    const sorted = [...schedule].sort((a, b) => a.matchNumber - b.matchNumber);
    const completed = sorted.filter((m) => isMatchOver(m));
    const upcoming = sorted.filter((m) => !isMatchOver(m));
    return { completedMatches: completed, upcomingMatches: upcoming };
  }, [schedule]);

  const recentScoutingMatches = useMemo(() => {
    if (!entries?.length || !schedule?.length) return [];
    const byCreated = [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const seen = new Set<number>();
    const matchOrder: number[] = [];
    for (const e of byCreated) {
      if (!seen.has(e.matchNumber)) {
        seen.add(e.matchNumber);
        matchOrder.push(e.matchNumber);
      }
    }
    const scheduleByMatch = new Map(schedule.map((m) => [m.matchNumber, m]));
    return matchOrder
      .map((mn) => scheduleByMatch.get(mn))
      .filter((m): m is ScheduleMatch => m != null)
      .slice(0, 5);
  }, [entries, schedule]);

  const firstUpcomingRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (upcomingMatches.length > 0 && firstUpcomingRef.current) {
      firstUpcomingRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [upcomingMatches.length]);

  if (eventLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
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

  const needsSetup = stats.teamCount === 0 && stats.scheduleCount === 0;
  const quickActions = [
    { title: "Scout", href: `/events/${eventId}/scout`, icon: ClipboardList, color: "text-emerald-500", desc: "Record match data" },
    { title: "Teams", href: `/events/${eventId}/teams`, icon: Users, color: "text-blue-500", desc: "View & sort teams" },
    { title: "Scouter Leaderboard", href: `/events/${eventId}/scouters`, icon: UserIcon, color: "text-emerald-500", desc: "Scouter stats & rankings" },
    { title: "Matches", href: `/events/${eventId}/schedule`, icon: CalendarDays, color: "text-sky-500", desc: "Match schedule & results" },
    { title: "Picklists", href: `/events/${eventId}/picklists`, icon: ListOrdered, color: "text-teal-500", desc: "Build draft order" },
    { title: "Data", href: `/events/${eventId}/data`, icon: Database, color: "text-slate-400", desc: "Export CSV" },
    { title: "Settings", href: `/events/${eventId}/settings`, icon: Settings, color: "text-slate-400", desc: "TBA & sync" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
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
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Badge variant="secondary" className={`text-sm font-semibold px-3 py-1 rounded-full ${teamsBadgeHeat}`}>
            {stats.teamCount} teams
          </Badge>
          <Badge variant="secondary" className={`text-sm font-semibold px-3 py-1 rounded-full ${matchesScoutedHeat}`}>
            {stats.matchesScouted} matches scouted
          </Badge>
          {stats.scheduleCount > 0 && (
            <Badge variant="outline" className={`text-sm font-medium px-3 py-1 rounded-full ${scheduleBadgeHeat}`}>
              {stats.scheduleCount} matches
            </Badge>
          )}
          {stats.totalEntries > 0 && (
            <Badge variant="outline" className={`text-sm font-medium px-3 py-1 rounded-full ${entriesBadgeHeat}`}>
              {stats.totalEntries} entries
            </Badge>
          )}
        </div>
      </div>

      {/* Getting Started - show when event has no data yet */}
      {needsSetup && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Getting started
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Set up your event in 3 steps so your team can start scouting.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li>
                <strong>Connect to TBA</strong> — In{" "}
                <Link href={`/events/${eventId}/settings`} className="text-primary hover:underline font-medium">
                  Settings
                </Link>
                , add your event key (e.g. <code className="text-xs bg-muted px-1 rounded">2026txhou</code>) and click &quot;Sync Schedule&quot; and &quot;Sync Teams&quot; to load matches and teams.
              </li>
              <li>
                <strong>Scout matches</strong> — Use the{" "}
                <Link href={`/events/${eventId}/scout`} className="text-primary hover:underline font-medium">
                  Scouting Form
                </Link>
                {" "}to record robot performance during matches.
              </li>
              <li>
                <strong>Build your picklist</strong> — After collecting data, use the{" "}
                <Link href={`/events/${eventId}/picklists`} className="text-primary hover:underline font-medium">
                  Picklists
                </Link>
                {" "}to rank teams for alliance selection.
              </li>
            </ol>
            {help?.helpTipsEnabled && (
            <div className="flex items-center gap-1.5 mt-2">
              {help.HelpTrigger({
                content: {
                  title: "What is TBA?",
                  body: (
                    <>
                      <p><strong>TBA</strong> (The Blue Alliance) hosts official FRC schedules and results. Strikescout syncs from TBA so you don&apos;t type team numbers by hand.</p>
                      <p>Event key: visit thebluealliance.com, find your event, copy the short code from the URL (e.g. <code>2026txhou</code>).</p>
                    </>
                  ),
                },
              })}
              <button
                type="button"
                onClick={() => help.showHelp({
                  title: "What is TBA?",
                  body: <><p><strong>TBA</strong> hosts official FRC schedules. Get your event key from thebluealliance.com.</p></>,
                })}
                className="text-xs text-primary hover:underline"
              >
                What is TBA? →
              </button>
            </div>
          )}
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-1.5">
          Quick actions
          {help?.HelpTrigger?.({
            content: {
              title: "Quick actions",
              body: <p>Jump to the main sections: Scout matches, view teams, see the schedule, build your picklist, export data, or adjust settings.</p>,
            },
          })}
        </h2>
        <motion.div
          className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
            hidden: {},
          }}
        >
          {quickActions.map((action) => (
            <motion.div
              key={action.title}
              variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }}
              transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
            >
              <Link href={action.href}>
                <Card className="cursor-pointer hover-elevate transition-colors h-full group border-border/80">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <action.icon className={`h-6 w-6 mb-1.5 ${action.color}`} />
                    <span className="font-semibold text-sm">{action.title}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{action.desc}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Needs attention */}
      {stats.teamsWithoutData > 0 && stats.teamCount > 0 && (
        <div className="mt-6">
        <Link href={`/events/${eventId}/teams`}>
          <Card className="cursor-pointer hover-elevate transition-colors border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="font-medium">
                  {stats.teamsWithoutData} team{stats.teamsWithoutData !== 1 ? "s" : ""} have no scouting data yet
                </p>
                <p className="text-sm text-muted-foreground">View team list to see who still needs to be scouted</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </CardContent>
          </Card>
        </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming matches */}
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <CalendarDays className="h-5 w-5 text-sky-500" />
            Upcoming matches
            {help?.HelpTrigger?.({
              content: {
                title: "Upcoming matches",
                body: <p>Next matches that haven&apos;t been played yet. Click a match to see alliances and add scouting data.</p>,
              },
            })}
          </h2>
          {!schedule?.length ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CalendarDays className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No matches yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sync from TBA in <Link href={`/events/${eventId}/settings`} className="text-primary underline">Settings</Link>
                </p>
              </CardContent>
            </Card>
          ) : upcomingMatches.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">All matches are over</p>
                <Link href={`/events/${eventId}/schedule`} className="text-xs text-primary hover:underline mt-1 inline-block">
                  View matches →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border max-h-[50vh] overflow-y-auto custom-scrollbar">
                  {upcomingMatches.slice(0, 3).map((m, idx) => {
                    const dayTime = formatScheduleTime(m.time);
                    const redTeams = [m.red1, m.red2, m.red3].filter((n): n is number => n != null && n > 0);
                    const blueTeams = [m.blue1, m.blue2, m.blue3].filter((n): n is number => n != null && n > 0);
                    const isFirstUpcoming = idx === 0;
                    return (
                      <li key={m.matchNumber} ref={isFirstUpcoming ? firstUpcomingRef : undefined}>
                        <Link href={`/events/${eventId}/schedule/${m.matchNumber}`}>
                          <div className={`px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 hover:bg-muted/50 transition-colors ${isFirstUpcoming ? "ring-inset ring-1 ring-primary/20 bg-primary/5" : ""}`}>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-semibold">{formatMatchLabel(m.matchNumber)}</span>
                              {dayTime && <span className="text-sm text-muted-foreground">{dayTime}</span>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <div className="flex items-center gap-1">
                                {redTeams.length > 0 ? redTeams.map((num) => (
                                  <span key={num} className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">{num}</span>
                                )) : <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                              <span className="text-muted-foreground/50 text-xs">vs</span>
                              <div className="flex items-center gap-1">
                                {blueTeams.length > 0 ? blueTeams.map((num) => (
                                  <span key={num} className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">{num}</span>
                                )) : <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="px-4 py-2 border-t border-border bg-muted/30">
                  <Link href={`/events/${eventId}/schedule`} className="text-sm text-primary hover:underline font-medium">
                    View all matches →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent scouting */}
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <ClipboardList className="h-5 w-5 text-emerald-500" />
            Recent scouting
            {help?.HelpTrigger?.({
              content: {
                title: "Recent scouting",
                body: <p>Matches scouted most recently. Click to view or add more data.</p>,
              },
            })}
          </h2>
          {!entries?.length ? (
            <Card>
              <CardContent className="p-6 text-center">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No scouting data yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Link href={`/events/${eventId}/scout`} className="text-primary underline">Scout</Link> a match to get started
                </p>
                <Link href={`/events/${eventId}/form-history`} className="text-xs text-primary hover:underline mt-1 inline-block">
                  View form history →
                </Link>
              </CardContent>
            </Card>
          ) : recentScoutingMatches.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Scouted matches not in schedule</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sync schedule from TBA in <Link href={`/events/${eventId}/settings`} className="text-primary underline">Settings</Link>
                </p>
                <Link href={`/events/${eventId}/form-history`} className="text-xs text-primary hover:underline mt-1 inline-block">
                  View form history →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border max-h-[50vh] overflow-y-auto custom-scrollbar">
                  {recentScoutingMatches.map((m) => {
                    const dayTime = formatScheduleTime(m.time);
                    const redTeams = [m.red1, m.red2, m.red3].filter((n): n is number => n != null && n > 0);
                    const blueTeams = [m.blue1, m.blue2, m.blue3].filter((n): n is number => n != null && n > 0);
                    return (
                      <li key={m.matchNumber}>
                        <Link href={`/events/${eventId}/schedule/${m.matchNumber}`}>
                          <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-semibold">{formatMatchLabel(m.matchNumber)}</span>
                              {dayTime && <span className="text-sm text-muted-foreground">{dayTime}</span>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <div className="flex items-center gap-1">
                                {redTeams.length > 0 ? redTeams.map((num) => (
                                  <span key={num} className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">{num}</span>
                                )) : <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                              <span className="text-muted-foreground/50 text-xs">vs</span>
                              <div className="flex items-center gap-1">
                                {blueTeams.length > 0 ? blueTeams.map((num) => (
                                  <span key={num} className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">{num}</span>
                                )) : <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="px-4 py-2 border-t border-border bg-muted/30">
                  <Link href={`/events/${eventId}/form-history`} className="text-sm text-primary hover:underline font-medium">
                    View form history →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Scouting checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-1.5">
            Scouting checklist
            {help?.HelpTrigger?.({
              content: {
                title: "Scouting checklist",
                body: <p>Track whether you&apos;ve scouted each team and every qual match. Green checkmarks show completed goals.</p>,
              },
            })}
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Track progress for your scouting team
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-4">
            {/* Each team scouted at least once */}
            <li>
              <Link
                href={`/events/${eventId}/teams`}
                className="block p-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {stats.teamsWithData >= stats.teamCount && stats.teamCount > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">Scout each team at least once</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stats.teamCount === 0
                        ? "Add teams to this event to track"
                        : `${stats.teamsWithData} of ${stats.teamCount} teams`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <div className="mt-2 ml-8">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${stats.teamCount > 0 ? Math.round((stats.teamsWithData / stats.teamCount) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            </li>

            {/* All qualification matches scouted */}
            <li>
              <Link
                href={stats.scheduleCount > 0 ? `/events/${eventId}/schedule` : `/events/${eventId}/settings`}
                className="block p-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {stats.scheduleCount > 0 && stats.matchesScouted >= stats.scheduleCount ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">Scout all qualification matches</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stats.scheduleCount === 0
                        ? "Sync schedule from TBA to track"
                        : `${stats.matchesScouted} of ${stats.scheduleCount} matches`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <div className="mt-2 ml-8">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${stats.scheduleCount > 0 ? Math.round((stats.matchesScouted / stats.scheduleCount) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
