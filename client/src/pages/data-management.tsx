import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { toPct, getHeatColor, getRowBorderColor, computeTeamStats, computeStatRanges, computeStatRangesForSzr, computeTbaRanges, computeSzrMapWithSweepBonus, parseSzrWeights } from "@/lib/team-colors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Database,
  FileSpreadsheet,
  ClipboardList,
  Users,
  CalendarDays,
  FileDown,
  HelpCircle,
} from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { useToast } from "@/hooks/use-toast";
import type { Event, Team, ScoutingEntry, EventTeam, ScheduleMatch } from "@shared/schema";

function escapeCSV(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const DATA_MANAGEMENT_HELP = {
  title: "Data Management",
  body: (
    <>
      <p>Export your scouting data to CSV files (spreadsheets) for backup or analysis.</p>
      <p><strong>Scouting data</strong> — Every match you&apos;ve scouted: team, match number, scores, notes. Use this for backups or to analyze in Excel.</p>
      <p><strong>Team summary</strong> — One row per team with averages (throughput, accuracy, etc.). Good for quick comparisons.</p>
      <p><strong>Schedule</strong> — Match list with red/blue alliances. Useful if you need the schedule outside the app.</p>
      <p><strong>Export all</strong> — Downloads all three files at once.</p>
    </>
  ),
};

export default function DataManagement() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();
  const help = useHelp();

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const { data: eventTeams, isLoading: teamsLoading } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: schedule, isLoading: scheduleLoading } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
  });

  const isLoading = entriesLoading || teamsLoading || scheduleLoading;
  const teamMap = new Map<number, Team>();
  eventTeams?.forEach(et => teamMap.set(et.teamId, et.team));

  const entriesCount = entries?.length ?? 0;
  const teamsCount = eventTeams?.length ?? 0;
  const scheduleCount = schedule?.length ?? 0;
  const statMin = Math.min(entriesCount, teamsCount, scheduleCount);
  const statMax = Math.max(entriesCount, teamsCount, scheduleCount);
  const entriesHeat = getHeatColor(entriesCount, statMin, statMax || 1);
  const teamsHeat = getHeatColor(teamsCount, statMin, statMax || 1);
  const scheduleHeat = getHeatColor(scheduleCount, statMin, statMax || 1);
  const entriesBorder = getRowBorderColor(entriesCount, statMin, statMax || 1);
  const teamsBorder = getRowBorderColor(teamsCount, statMin, statMax || 1);
  const scheduleBorder = getRowBorderColor(scheduleCount, statMin, statMax || 1);

  const exportScoutingData = () => {
    if (!entries || !eventTeams) return;

    const headers = [
      "Match", "Team Number", "Team Name",
      "Auto Balls Shot", "Auto Notes", "Auto Climb", "Auto Climb Position", "Auto Climb Level",
      "Throughput", "Accuracy (0-10)", "Accuracy %", "Move While Shoot",
      "Climb Result", "Climb Position", "Climb Level",
      "Defense Rating (0-10)", "Defense %", "Defense Notes",
      "Driver Skill Notes", "Misc.", "Date"
    ];

    const rows = [...entries]
      .sort((a, b) => a.matchNumber - b.matchNumber || a.teamId - b.teamId)
      .map(e => {
        const team = teamMap.get(e.teamId);
        return [
          e.matchNumber,
          team?.teamNumber || "",
          team?.teamName || "",
          e.autoBallsShot,
          e.autoNotes || "",
          e.autoClimbSuccess || "",
          e.autoClimbPosition || "",
          e.autoClimbLevel || "",
          e.teleopFpsEstimate,
          e.teleopAccuracy,
          toPct(e.teleopAccuracy ?? 0),
          e.teleopMoveWhileShoot ? "Yes" : "No",
          e.climbSuccess || "",
          e.climbPosition || "",
          e.climbLevel || "",
          e.defenseRating,
          toPct(e.defenseRating ?? 0),
          e.defenseNotes || "",
          e.driverSkillNotes || "",
          e.notes || "",
          e.createdAt ? new Date(e.createdAt).toLocaleString() : "",
        ].map(escapeCSV).join(",");
      });

    const csv = [headers.join(","), ...rows].join("\n");
    const safeName = (event?.name || "event").replace(/[^a-zA-Z0-9]/g, "_");
    downloadCSV(`${safeName}_scouting_data.csv`, csv);
    toast({ title: `Exported ${entries.length} scouting entries` });
  };

  const exportTeamSummary = () => {
    if (!entries || !eventTeams || !event) return;

    const teams = eventTeams.map(et => et.team);
    const teamStats = computeTeamStats(teams, entries);
    const statRanges = computeStatRanges(teamStats);
    const statRangesForSzr = computeStatRangesForSzr(teamStats);
    const tbaRanges = computeTbaRanges(eventTeams);
    const szrWeights = parseSzrWeights(event.szrWeights);
    const szrMap = computeSzrMapWithSweepBonus(teams, entries, statRangesForSzr, statRanges, szrWeights, eventTeams, tbaRanges);

    const headers = [
      "Team Number", "Team Name", "City", "State",
      "Entries", "Avg Auto Balls", "Avg Throughput",
      "Avg Accuracy %", "Avg Defense %", "Climb Rate %", "Avg Climb Level", "SZR"
    ];

    const rows = eventTeams
      .sort((a, b) => a.team.teamNumber - b.team.teamNumber)
      .map(et => {
        const te = entries.filter(e => e.teamId === et.teamId);
        const count = te.length;
        const szr = szrMap.get(et.teamId);
        if (count === 0) {
          return [
            et.team.teamNumber, et.team.teamName, et.team.city || "", et.team.stateProv || "",
            0, 0, 0, 0, 0, 0, 0, szr ?? 0
          ].map(escapeCSV).join(",");
        }
        const climbs = te.filter(e => e.climbSuccess === "success");
        const avgAuto = te.reduce((s, e) => s + e.autoBallsShot, 0) / count;
        const avgThroughput = te.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count;
        const avgAccuracy = te.reduce((s, e) => s + e.teleopAccuracy, 0) / count * 10;
        const avgDefense = te.reduce((s, e) => s + e.defenseRating, 0) / count * 10;
        const climbRate = climbs.length / count * 100;
        const avgClimbLevel = climbs.length > 0
          ? climbs.reduce((s, e) => s + (parseInt(e.climbLevel || "0") || 0), 0) / climbs.length
          : 0;
        return [
          et.team.teamNumber, et.team.teamName, et.team.city || "", et.team.stateProv || "",
          count,
          parseFloat(avgAuto.toFixed(1)),
          parseFloat(avgThroughput.toFixed(1)),
          Math.round(avgAccuracy),
          Math.round(avgDefense),
          Math.round(climbRate),
          parseFloat(avgClimbLevel.toFixed(1)),
          szr ?? 0,
        ].map(escapeCSV).join(",");
      });

    const csv = [headers.join(","), ...rows].join("\n");
    const safeName = (event?.name || "event").replace(/[^a-zA-Z0-9]/g, "_");
    downloadCSV(`${safeName}_team_summary.csv`, csv);
    toast({ title: `Exported summary for ${eventTeams.length} teams` });
  };

  const exportSchedule = () => {
    if (!schedule) return;

    const headers = ["Match", "Time", "Red 1", "Red 2", "Red 3", "Blue 1", "Blue 2", "Blue 3"];

    const rows = [...schedule]
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map(m => [
        m.matchNumber,
        m.time || "",
        m.red1, m.red2, m.red3,
        m.blue1, m.blue2, m.blue3,
      ].map(escapeCSV).join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const safeName = (event?.name || "event").replace(/[^a-zA-Z0-9]/g, "_");
    downloadCSV(`${safeName}_schedule.csv`, csv);
    toast({ title: `Exported ${schedule.length} matches` });
  };

  const exportAll = () => {
    exportScoutingData();
    setTimeout(() => exportTeamSummary(), 200);
    setTimeout(() => exportSchedule(), 400);
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl flex items-center gap-2" data-testid="text-data-title">
                  Data Management
                  {help?.HelpTrigger?.({ content: DATA_MANAGEMENT_HELP, className: "ml-1" })}
                </h1>
                {event && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{event.name}</p>
                )}
              </div>
            </div>
            {event && (
              <Badge variant="secondary" className="w-fit font-normal">
                Export & backup
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-8">
        {/* Stats */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Overview</h2>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className={`overflow-hidden border-0 rounded-xl ${entriesHeat ? `border-l-4 ${entriesHeat} ${entriesBorder}` : "bg-gradient-to-br from-primary/8 to-primary/4 dark:from-primary/12 dark:to-primary/6"}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${entriesHeat || "bg-primary/15 text-primary"}`}>
                    <ClipboardList className={`h-6 w-6 ${entriesHeat ? "" : "text-primary"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-2xl font-bold tabular-nums ${entriesHeat || ""}`}>{entriesCount}</p>
                    <p className="text-sm text-muted-foreground">Scouting entries</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={`overflow-hidden border-0 rounded-xl ${teamsHeat ? `border-l-4 ${teamsHeat} ${teamsBorder}` : "bg-gradient-to-br from-[hsl(var(--chart-2))]/10 to-[hsl(var(--chart-2))]/5 dark:from-[hsl(var(--chart-2))]/15 dark:to-[hsl(var(--chart-2))]/8"}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${teamsHeat || "bg-[hsl(var(--chart-2))]/20 text-[hsl(var(--chart-2))]"}`}>
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-2xl font-bold tabular-nums ${teamsHeat || ""}`}>{teamsCount}</p>
                    <p className="text-sm text-muted-foreground">Teams</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={`overflow-hidden border-0 rounded-xl ${scheduleHeat ? `border-l-4 ${scheduleHeat} ${scheduleBorder}` : "bg-gradient-to-br from-[hsl(var(--chart-5))]/10 to-[hsl(var(--chart-5))]/5 dark:from-[hsl(var(--chart-5))]/15 dark:to-[hsl(var(--chart-5))]/8"}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${scheduleHeat || "bg-[hsl(var(--chart-5))]/20 text-[hsl(var(--chart-5))]"}`}>
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-2xl font-bold tabular-nums ${scheduleHeat || ""}`}>{scheduleCount}</p>
                    <p className="text-sm text-muted-foreground">Scheduled matches</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </section>

        <Separator />

        {/* Export options */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
            Export to CSV
            {help?.HelpTrigger?.({
              content: {
                title: "Export to CSV",
                body: <p>Download your data as spreadsheets. Scouting data = every entry. Team summary = averages per team. Schedule = match list.</p>,
              },
            })}
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-1">
                <Card className="transition-colors hover:bg-muted/30">
                  <CardHeader className="py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-medium flex items-center gap-1.5">
                            Scouting data
                            {help?.HelpTrigger?.({
                              content: { title: "Scouting data", body: <p>Every match you scouted: team, match number, auto balls, throughput, accuracy, climb, defense, notes. One row per entry.</p> },
                            })}
                          </CardTitle>
                          <CardDescription className="mt-0.5 text-sm">
                            All scouting entries — auto, teleop, endgame, defense, notes. One row per entry.
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportScoutingData}
                        disabled={!entries?.length}
                        className="shrink-0"
                        data-testid="button-export-scouting"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                <Card className="transition-colors hover:bg-muted/30">
                  <CardHeader className="py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--chart-2))]/15 text-[hsl(var(--chart-2))]">
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-medium flex items-center gap-1.5">
                            Team summary
                            {help?.HelpTrigger?.({
                              content: { title: "Team summary", body: <p>Averaged stats per team — auto, throughput, accuracy, defense, climb rate. One row per team. Good for quick comparisons.</p> },
                            })}
                          </CardTitle>
                          <CardDescription className="mt-0.5 text-sm">
                            Averaged stats per team — auto, throughput, accuracy, defense, climb rate. One row per team.
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportTeamSummary}
                        disabled={!eventTeams?.length}
                        className="shrink-0"
                        data-testid="button-export-summary"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                <Card className="transition-colors hover:bg-muted/30">
                  <CardHeader className="py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--chart-5))]/15 text-[hsl(var(--chart-5))]">
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-medium flex items-center gap-1.5">
                            Match schedule
                            {help?.HelpTrigger?.({
                              content: { title: "Match schedule", body: <p>Match list with red/blue alliance team numbers. Useful if you need the schedule outside the app.</p> },
                            })}
                          </CardTitle>
                          <CardDescription className="mt-0.5 text-sm">
                            Full match schedule with alliance assignments. One row per match.
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportSchedule}
                        disabled={!schedule?.length}
                        className="shrink-0"
                        data-testid="button-export-schedule"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              </div>

              <Card className="mt-4 border-primary/20 bg-primary/5 dark:bg-primary/10">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <FileDown className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-1.5">
                        Export everything
                        {help?.HelpTrigger?.({
                          content: { title: "Export all", body: <p>Downloads scouting data, team summary, and schedule as three CSV files at once. Use for backup or to share with others.</p> },
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Download all three CSVs at once — scouting data, team summary, and schedule.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="default"
                    onClick={exportAll}
                    disabled={!entries?.length && !schedule?.length}
                    className="shrink-0"
                    data-testid="button-export-all"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export all
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
