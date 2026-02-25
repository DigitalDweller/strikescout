import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Database, FileSpreadsheet } from "lucide-react";
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

export default function DataManagement() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();

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
          e.teleopAccuracy * 10,
          e.teleopMoveWhileShoot ? "Yes" : "No",
          e.climbSuccess || "",
          e.climbPosition || "",
          e.climbLevel || "",
          e.defenseRating,
          e.defenseRating * 10,
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
    if (!entries || !eventTeams) return;

    const headers = [
      "Team Number", "Team Name", "City", "State",
      "Entries", "Avg Auto Balls", "Avg Throughput",
      "Avg Accuracy %", "Avg Defense %", "Climb Rate %", "Avg Climb Level"
    ];

    const rows = eventTeams
      .sort((a, b) => a.team.teamNumber - b.team.teamNumber)
      .map(et => {
        const te = entries.filter(e => e.teamId === et.teamId);
        const count = te.length;
        if (count === 0) {
          return [
            et.team.teamNumber, et.team.teamName, et.team.city || "", et.team.stateProv || "",
            0, 0, 0, 0, 0, 0, 0
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
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-data-title">
          <Database className="h-6 w-6" />
          Data Management
        </h1>
        {event && (
          <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="text-center">
              <CardContent className="pt-6">
                <p className="text-4xl font-extrabold text-primary">{entries?.length || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Scouting Entries</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <p className="text-4xl font-extrabold text-chart-2">{eventTeams?.length || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Teams</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <p className="text-4xl font-extrabold text-chart-5">{schedule?.length || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Scheduled Matches</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold">Export Data</h2>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      Scouting Data
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Every scouting entry with all fields — auto, teleop, endgame, defense, and notes. One row per entry.
                    </CardDescription>
                  </div>
                  <Button onClick={exportScoutingData} disabled={!entries?.length} data-testid="button-export-scouting">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-chart-2" />
                      Team Summary
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Averaged stats per team — auto, throughput, accuracy, defense, climb rate. One row per team.
                    </CardDescription>
                  </div>
                  <Button onClick={exportTeamSummary} disabled={!eventTeams?.length} data-testid="button-export-summary">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-chart-5" />
                      Match Schedule
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Full match schedule with alliance assignments. One row per match.
                    </CardDescription>
                  </div>
                  <Button onClick={exportSchedule} disabled={!schedule?.length} data-testid="button-export-schedule">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-t-4 border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Export Everything</CardTitle>
                  <CardDescription className="mt-1">
                    Download all three spreadsheets at once — scouting data, team summary, and schedule.
                  </CardDescription>
                </div>
                <Button
                  size="lg"
                  onClick={exportAll}
                  disabled={!entries?.length && !schedule?.length}
                  data-testid="button-export-all"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Export All
                </Button>
              </div>
            </CardHeader>
          </Card>
        </>
      )}
    </div>
  );
}
