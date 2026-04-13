import { useMemo, useState, useEffect, type ComponentType } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { toPct, computeTeamStats, computeStatRanges, computeStatRangesForSzr, computeTbaRanges, computeSzrMapWithSweepBonus, parseSzrWeights } from "@/lib/team-colors";
import { DELETE_EVENT_CODE } from "@/lib/delete-confirmation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Database,
  FileSpreadsheet,
  Users,
  CalendarDays,
  FileDown,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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

function MetricCard({
  icon: Icon,
  metric,
  label,
  subtext,
  className,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  metric: string | number;
  label: string;
  subtext?: React.ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <Card
      variant="glass"
      className={cn(
        "overflow-hidden border transition-shadow duration-200 hover:shadow-lg hover:shadow-black/20",
        className,
      )}
    >
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-sm",
            iconClassName,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tabular-nums tracking-tight text-zinc-50">{metric}</p>
          <p className="text-sm text-zinc-400">{label}</p>
          {subtext ? <div className="mt-1">{subtext}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ClearEventDataConfirmDialog({
  event,
  open,
  onOpenChange,
}: {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [deleteCode, setDeleteCode] = useState("");
  const totalSteps = 5;

  const clearMutation = useMutation({
    mutationFn: async () => {
      // Server bulk-delete not implemented; same confirmation gate as delete-event.
      await Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "Not available yet",
        description:
          "Bulk clear is not wired to the server. Remove test entries from Entry history or contact your admin.",
        variant: "destructive",
      });
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (!open) {
      setStep(0);
      setDeleteCode("");
    }
  }, [open]);

  const messages = [
    `Are you sure you want to clear all scouting data for "${event.name}"?`,
    "This will permanently delete every scouting entry for this event.",
    "Your match schedule and team list for this event will remain.",
    "Export a CSV backup first if you need to keep a copy.",
    "This action cannot be undone. Final confirmation required.",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Clear event data ({step + 1}/{totalSteps})
          </DialogTitle>
          <DialogDescription>{messages[step]}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex w-full gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-destructive" : "bg-muted"}`}
            />
          ))}
        </div>
        {step === totalSteps - 1 && (
          <div className="space-y-2">
            <Label htmlFor="clear-event-delete-code" className="text-zinc-300">
              Enter code to confirm deletion
            </Label>
            <Input
              id="clear-event-delete-code"
              type="text"
              value={deleteCode}
              onChange={(e) => setDeleteCode(e.target.value)}
              placeholder="Confirmation code"
              className="border-zinc-700 bg-zinc-950/50 font-mono text-zinc-100"
              data-testid="input-clear-event-code"
              autoComplete="off"
            />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-clear-event-cancel">
            Cancel
          </Button>
          {step < totalSteps - 1 ? (
            <Button
              variant="destructive"
              onClick={() => setStep(step + 1)}
              data-testid={`button-clear-event-confirm-${step + 1}`}
            >
              Yes, continue ({step + 1}/{totalSteps})
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending || deleteCode !== DELETE_EVENT_CODE}
              data-testid="button-clear-event-final"
            >
              {clearMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clear permanently
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DataManagement() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();
  const help = useHelp();
  const queryClient = useQueryClient();
  const [clearEventOpen, setClearEventOpen] = useState(false);

  const queryKeys = useMemo(
    () => [
      ["/api/events", eventId],
      ["/api/events", eventId, "entries"],
      ["/api/events", eventId, "teams"],
      ["/api/events", eventId, "schedule"],
    ],
    [eventId],
  );

  const handleRefresh = () => {
    queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    toast({ title: "Refreshing", description: "Syncing latest data…" });
  };

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
  eventTeams?.forEach((et) => teamMap.set(et.teamId, et.team));

  const entriesCount = entries?.length ?? 0;
  const teamsCount = eventTeams?.length ?? 0;
  const scheduleCount = schedule?.length ?? 0;

  const { duplicateWarningCount, integrityPct } = useMemo(() => {
    if (!entries?.length) {
      return { duplicateWarningCount: 0, integrityPct: 100 };
    }
    const byKey = new Map<string, number>();
    for (const e of entries) {
      const k = `${e.matchNumber}-${e.teamId}`;
      byKey.set(k, (byKey.get(k) ?? 0) + 1);
    }
    let groups = 0;
    byKey.forEach((c) => {
      if (c > 1) groups++;
    });
    const pct = groups === 0 ? 100 : Math.max(85, 100 - groups);
    return { duplicateWarningCount: groups, integrityPct: pct };
  }, [entries]);

  const exportScoutingData = () => {
    if (!entries || !eventTeams) return;

    const headers = [
      "Match", "Team Number", "Team Name",
      "Auto Balls Shot", "Auto Notes", "Auto Climb", "Auto Climb Position", "Auto Climb Level",
      "Throughput", "Accuracy (0-10)", "Accuracy %", "Evaded defense %", "Move While Shoot",
      "Climb Result", "Climb Position", "Climb Level",
      "Defense Rating (0-10)", "Defense %", "Defense Notes",
      "Driver Skill Notes", "Misc.", "Date"
    ];

    const rows = [...entries]
      .sort((a, b) => a.matchNumber - b.matchNumber || a.teamId - b.teamId)
      .map((e) => {
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
          e.evadedDefense != null ? toPct(e.evadedDefense) : "",
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

    const teams = eventTeams.map((et) => et.team);
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
      .map((et) => {
        const te = entries.filter((e) => e.teamId === et.teamId);
        const count = te.length;
        const szr = szrMap.get(et.teamId);
        if (count === 0) {
          return [
            et.team.teamNumber, et.team.teamName, et.team.city || "", et.team.stateProv || "",
            0, 0, 0, 0, 0, 0, 0, szr ?? 0
          ].map(escapeCSV).join(",");
        }
        const climbs = te.filter((e) => e.climbSuccess === "success");
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
      .map((m) => [
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

  const exportRows = [
    {
      key: "scouting",
      title: "Scouting data",
      description: "All entries — auto, teleop, endgame, defense, notes. One row per entry.",
      icon: FileSpreadsheet,
      onExport: exportScoutingData,
      disabled: !entries?.length,
      testId: "button-export-scouting",
    },
    {
      key: "summary",
      title: "Team summary",
      description: "Averaged stats per team — throughput, accuracy, defense, climb rate.",
      icon: FileSpreadsheet,
      onExport: exportTeamSummary,
      disabled: !eventTeams?.length,
      testId: "button-export-summary",
    },
    {
      key: "schedule",
      title: "Match schedule",
      description: "Full schedule with alliance assignments. One row per match.",
      icon: FileSpreadsheet,
      onExport: exportSchedule,
      disabled: !schedule?.length,
      testId: "button-export-schedule",
    },
  ] as const;

  return (
    <div className="min-h-full bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl" data-testid="text-data-title">
              Data Management
              {help?.HelpTrigger?.({ content: DATA_MANAGEMENT_HELP, className: "ml-1 inline" })}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {event?.name ?? "Loading event…"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 gap-2 text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Sync / Refresh
          </Button>
        </header>

        {/* Overview metrics */}
        <section className="mb-10">
          <h2 className="sr-only">Overview metrics</h2>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-2xl border border-white/5 bg-zinc-900/40" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={Database}
                metric={entriesCount}
                label="Scouting entries"
                className="border-emerald-500/25"
                iconClassName="text-emerald-400"
              />
              <MetricCard
                icon={Users}
                metric={teamsCount}
                label="Teams"
                className="border-zinc-700/50"
                iconClassName="text-zinc-300"
              />
              <MetricCard
                icon={CalendarDays}
                metric={scheduleCount}
                label="Scheduled matches"
                className="border-zinc-700/50"
                iconClassName="text-zinc-300"
              />
              <MetricCard
                icon={ShieldCheck}
                metric={`${integrityPct}%`}
                label="Data integrity"
                subtext={
                  duplicateWarningCount > 0 ? (
                    <p className="text-xs font-medium text-amber-400/90">
                      {duplicateWarningCount} duplicate {duplicateWarningCount === 1 ? "warning" : "warnings"}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-500/80">No duplicate match–team rows</p>
                  )
                }
                className={cn(
                  "border-amber-500/20",
                  duplicateWarningCount === 0 && "border-blue-500/25",
                )}
                iconClassName={cn(
                  "text-amber-400",
                  duplicateWarningCount === 0 && "text-blue-400",
                )}
              />
            </div>
          )}
        </section>

        {/* Export hub */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Export &amp; backup</h2>

          <div className="mb-4 overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-950/30 p-4 shadow-lg shadow-black/25 backdrop-blur-xl sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  <FileDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-50">Export everything</p>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    Download scouting data, team summary, and schedule as three CSV files in one action.
                  </p>
                </div>
              </div>
              <Button
                className="shrink-0"
                onClick={exportAll}
                disabled={!entries?.length && !schedule?.length}
                data-testid="button-export-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Export all CSVs
              </Button>
            </div>
          </div>

          {/* Individual exports */}
          <div className="space-y-2">
            {isLoading ? (
              <>
                <Skeleton className="h-20 w-full rounded-xl border border-white/5" />
                <Skeleton className="h-20 w-full rounded-xl border border-white/5" />
                <Skeleton className="h-20 w-full rounded-xl border border-white/5" />
              </>
            ) : (
              exportRows.map((row) => (
                <div
                  key={row.key}
                  className="group flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/30 px-4 py-3.5 backdrop-blur-md transition-all duration-200 hover:border-white/15 hover:bg-zinc-800/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 text-primary">
                      <row.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-100">{row.title}</p>
                      <p className="text-sm text-zinc-500">{row.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={row.onExport}
                    disabled={row.disabled}
                    className="shrink-0 gap-2 text-zinc-400 opacity-100 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-300 sm:opacity-0 sm:group-hover:opacity-100"
                    data-testid={row.testId}
                  >
                    <Download className="h-4 w-4 transition-transform group-hover:translate-y-px group-hover:text-blue-400" />
                    Download
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Advanced / maintenance */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Advanced</h2>
          <div className="space-y-2">
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/30 px-4 py-3.5 backdrop-blur-md transition-colors hover:bg-zinc-800/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-zinc-100">Resolve conflicts</p>
                  <p className="text-sm text-zinc-500">
                    Review and edit scouting entries when duplicate match–team rows exist.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 border-zinc-600/60" asChild>
                <Link href={`/events/${eventId}/scout/history`}>
                  Open entry history
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3.5 backdrop-blur-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-red-200">Danger zone</p>
                    <p className="text-sm text-red-300/80">
                      Permanently remove scouting data for this event. Use before a real competition to wipe test runs.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-red-500/50 bg-transparent text-red-300 hover:bg-red-500/15 hover:text-red-200"
                  onClick={() => setClearEventOpen(true)}
                  disabled={!event}
                  data-testid="button-clear-event-open"
                >
                  Clear event data
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
      {event ? (
        <ClearEventDataConfirmDialog event={event} open={clearEventOpen} onOpenChange={setClearEventOpen} />
      ) : null}
    </div>
  );
}
