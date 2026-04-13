import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DELETE_EVENT_CODE } from "@/lib/delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AppLogoMark } from "@/components/app-logo-mark";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LandingBackground } from "@/components/landing/LandingBackground";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Calendar,
  MapPin,
  Loader2,
  Settings,
  AlertTriangle,
  Moon,
  Sun,
  LogOut,
  Shield,
  Trophy,
  Users,
  Cog,
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { Event, Season, Team, EventTeam, ScoutingEntry } from "@shared/schema";
import {
  computeTeamStats,
  computeStatRanges,
  computeStatRangesForSzr,
  computeTbaRanges,
  computeSzrMapWithSweepBonus,
  parseSzrWeights,
} from "@/lib/team-colors";

/** Re-export API event model for consumers of dashboard-related types. */
export type { Event };

/**
 * Event slice for season insight aggregation: dashboard toggles plus per-scout match rows
 * (one row per scouting entry; szrScore is that team's event SZR for context).
 */
export interface SeasonInsightEvent {
  id: number;
  name: string;
  isActive: boolean;
  matches: MatchData[];
}

export interface MatchData {
  teamNumber: number;
  teamName: string;
  szrScore: number;
  scoutId: string;
  scoutName: string;
}

type ScoutingEntryWithScouter = ScoutingEntry & {
  scouter: { id: number; displayName: string; username: string };
};

/** Sidebar row: team's mean SZR across included events (events where SZR > 0). */
export interface TeamStat {
  id: string;
  eventId: number;
  teamNumber: number;
  teamLabel: string;
  szrScore: number;
}

/** Sidebar row: total scouting entries across included events. */
export interface ScoutStat {
  id: string;
  eventId: number;
  scoutKey: string;
  initials: string;
  name: string;
  matches: number;
}

const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  location: z.string().optional(),
  startDate: z.string().optional(),
});

const editEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  location: z.string().optional(),
});

function displayNameToInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Builds per-event match rows from real scouting entries (for scout totals and typing).
 * Top-team SZR aggregation uses one value per team per event (not repeated per entry).
 */
function buildMatchDataForEvent(
  entries: ScoutingEntryWithScouter[],
  teamById: Map<number, Team>,
  szrByTeamId: Map<number, number>,
): MatchData[] {
  const rows: MatchData[] = [];
  for (const entry of entries) {
    const team = teamById.get(entry.teamId);
    if (!team) continue;
    rows.push({
      teamNumber: team.teamNumber,
      teamName: team.teamName,
      szrScore: szrByTeamId.get(entry.teamId) ?? 0,
      scoutId: String(entry.scouterId),
      scoutName: entry.scouter.displayName,
    });
  }
  return rows;
}

/** From active events' match rows: group by scoutId, count entries (scouted slots), top `limit`. */
function topScoutsFromMatchRows(allMatches: MatchData[], limit = 4): ScoutStat[] {
  const map = new Map<
    string,
    { scoutKey: string; name: string; matches: number }
  >();
  for (const m of allMatches) {
    if (!m.scoutId) continue;
    const prev = map.get(m.scoutId);
    if (!prev) {
      map.set(m.scoutId, { scoutKey: m.scoutId, name: m.scoutName, matches: 1 });
    } else {
      prev.matches += 1;
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.matches - a.matches)
    .slice(0, limit)
    .map((r) => ({
      id: r.scoutKey,
      eventId: 0,
      scoutKey: r.scoutKey,
      initials: displayNameToInitials(r.name),
      name: r.name,
      matches: r.matches,
    }));
}


const eventFilterSwitchClass =
  "shrink-0 border-0 shadow-sm transition-colors duration-200 data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-zinc-700 data-[state=unchecked]:hover:bg-zinc-600";

type SeasonStatsSidebarProps = {
  topTeams: TeamStat[];
  scoutRows: ScoutStat[];
  maxSzr: number;
  maxMatches: number;
  emptySelection: boolean;
  insightsLoading: boolean;
  insightsRefetching: boolean;
};

function SeasonStatsSidebar({
  topTeams,
  scoutRows,
  maxSzr,
  maxMatches,
  emptySelection,
  insightsLoading,
  insightsRefetching,
}: SeasonStatsSidebarProps) {
  return (
    <aside className="lg:sticky lg:top-24" data-testid="season-dashboard-stats">
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl transition-opacity duration-300 ${
          insightsRefetching && !insightsLoading ? "animate-pulse opacity-90" : ""
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold tracking-tight text-zinc-100">Season insights</h3>
          </div>
        </div>

        {insightsLoading ? (
          <div className="space-y-8 animate-pulse">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded bg-zinc-800/90" />
                <Skeleton className="h-3 w-28 rounded bg-zinc-800/90" />
              </div>
              <ul className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5">
                    <div className="flex justify-between gap-2">
                      <Skeleton className="h-9 flex-1 rounded-lg bg-zinc-800/80" />
                      <Skeleton className="h-6 w-12 shrink-0 rounded-md bg-zinc-800/80" />
                    </div>
                    <Skeleton className="mt-2 h-1.5 w-full rounded-full bg-zinc-800/80" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-zinc-800/80 pt-6">
              <div className="mb-3 flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded bg-zinc-800/90" />
                <Skeleton className="h-3 w-32 rounded bg-zinc-800/90" />
              </div>
              <ul className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-zinc-800/80" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4 max-w-[140px] rounded bg-zinc-800/80" />
                      <Skeleton className="h-1 max-w-[120px] rounded-full bg-zinc-800/80" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : emptySelection ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-zinc-800/60 bg-zinc-950/40 px-4 py-10 text-center">
            <p className="text-sm font-medium tracking-tight text-zinc-200">Select an event to view season insights.</p>
            <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-zinc-500">
              Turn on one or more event cards below to aggregate SZR and scout activity.
            </p>
          </div>
        ) : (
        <div className="space-y-8">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400/90" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Top teams (SZR)
              </h4>
            </div>
            {topTeams.length === 0 ? (
              <p className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-3 py-4 text-center text-xs text-zinc-500">
                No SZR data for the selected events yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {topTeams.map((row, i) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-xs font-bold tabular-nums text-blue-300">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tabular-nums text-zinc-100">{row.teamNumber}</p>
                          <p className="truncate text-[11px] text-zinc-500">{row.teamLabel}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-400">
                        {row.szrScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                        style={{ width: `${(row.szrScore / maxSzr) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-zinc-800/80 pt-6">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400/90" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Scout leaderboard
              </h4>
            </div>
            {scoutRows.length === 0 ? (
              <p className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-3 py-4 text-center text-xs text-zinc-500">
                No scout entries for the selected events.
              </p>
            ) : (
              <ul className="space-y-3">
                {scoutRows.map((row) => (
                  <li
                    key={row.scoutKey}
                    className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-500/25 bg-gradient-to-br from-blue-500/20 to-zinc-800 text-xs font-bold text-zinc-100">
                      {row.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{row.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 max-w-[120px] flex-1 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-blue-500/80 transition-all duration-300"
                            style={{ width: `${(row.matches / maxMatches) * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums text-zinc-500">{row.matches} matches</span>
                      </div>
                    </div>
                    <Badge className="shrink-0 border-0 bg-zinc-800 text-[10px] text-zinc-300 hover:bg-zinc-800">
                      Active
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        )}
      </div>
    </aside>
  );
}

function DeleteConfirmDialog({
  event,
  open,
  onOpenChange,
  onDeleted,
}: {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [deleteCode, setDeleteCode] = useState("");
  const totalSteps = 5;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/events/${event.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event deleted" });
      onDeleted();
    },
  });

  useEffect(() => {
    if (!open) {
      setStep(0);
      setDeleteCode("");
    }
  }, [open]);

  const messages = [
    `Are you sure you want to delete "${event.name}"?`,
    "This will permanently delete ALL scouting data for this event.",
    "All match schedule data will also be deleted.",
    "All team associations with this event will be removed.",
    "This action cannot be undone. Final confirmation required.",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Event ({step + 1}/{totalSteps})
          </DialogTitle>
          <DialogDescription>{messages[step]}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 w-full mt-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-destructive" : "bg-muted"}`}
            />
          ))}
        </div>
        {step === totalSteps - 1 && (
          <div className="space-y-2">
            <Label htmlFor="delete-code" className="text-zinc-300">
              Enter code to confirm deletion
            </Label>
            <Input
              id="delete-code"
              type="text"
              value={deleteCode}
              onChange={(e) => setDeleteCode(e.target.value)}
              placeholder="Confirmation code"
              className="border-zinc-700 bg-zinc-950/50 font-mono text-zinc-100"
              data-testid="input-delete-event-code"
              autoComplete="off"
            />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-delete-cancel">
            Cancel
          </Button>
          {step < totalSteps - 1 ? (
            <Button
              variant="destructive"
              onClick={() => setStep(step + 1)}
              data-testid={`button-delete-confirm-${step + 1}`}
            >
              Yes, Continue ({step + 1}/{totalSteps})
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || deleteCode !== DELETE_EVENT_CODE}
              data-testid="button-delete-final"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Permanently
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventSettingsDialog({
  event,
  open,
  onOpenChange,
}: {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const form = useForm<z.infer<typeof editEventSchema>>({
    resolver: zodResolver(editEventSchema),
    defaultValues: { name: event.name, location: event.location || "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: event.name, location: event.location || "" });
    }
  }, [open, event]);

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editEventSchema>) => {
      const res = await apiRequest("PATCH", `/api/events/${event.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event updated" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update event", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Dialog open={open && !deleteOpen} onOpenChange={onOpenChange}>
        <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Event Settings</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Event Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. 2026 Houston Regional"
                        data-testid="input-edit-event-name"
                        className="border-zinc-700 bg-zinc-950/50 text-zinc-100"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Location</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Houston, TX"
                        data-testid="input-edit-event-location"
                        className="border-zinc-700 bg-zinc-950/50 text-zinc-100"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={updateMutation.isPending}
                  data-testid="button-save-event"
                >
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
              <div className="border-t pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => setDeleteOpen(true)}
                  data-testid="button-open-delete"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Delete Event
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        event={event}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          setDeleteOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

export default function AdminEvents() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsEvent, setSettingsEvent] = useState<Event | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: selectedSeasonPayload } = useQuery<{ selectedYear: number }>({
    queryKey: ["/api/selected-season"],
  });
  const selectedYear = selectedSeasonPayload?.selectedYear;

  const selectSeasonMutation = useMutation({
    mutationFn: async (year: number) => {
      const res = await apiRequest("PATCH", "/api/selected-season", { year });
      return (await res.json()) as { selectedYear: number };
    },
    onError: (error: Error) => {
      toast({ title: "Could not change season", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<z.infer<typeof createEventSchema>>({
    resolver: zodResolver(createEventSchema),
    defaultValues: { name: "", location: "", startDate: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createEventSchema>) => {
      const res = await apiRequest("POST", "/api/events", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      form.reset();
      setCreateOpen(false);
      toast({ title: "Event created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create event", description: error.message, variant: "destructive" });
    },
  });

  /** When `eventId` is false/undefined treat as off; default ON for all current events. */
  const [activeEvents, setActiveEvents] = useState<Record<number, boolean>>({});

  const activeEventIds = useMemo(
    () => (events ?? []).filter((e) => activeEvents[e.id] !== false).map((e) => e.id),
    [events, activeEvents],
  );

  const eventDetailQueries = useQueries({
    queries: activeEventIds.map((eventId) => ({
      queryKey: ["/api/events", eventId],
      enabled: !isLoading && activeEventIds.length > 0,
    })),
  });

  const eventTeamsQueries = useQueries({
    queries: activeEventIds.map((eventId) => ({
      queryKey: ["/api/events", eventId, "teams"],
      enabled: !isLoading && activeEventIds.length > 0,
    })),
  });

  const eventEntriesQueries = useQueries({
    queries: activeEventIds.map((eventId) => ({
      queryKey: ["/api/events", eventId, "entries"],
      enabled: !isLoading && activeEventIds.length > 0,
    })),
  });

  const insightsLoading =
    isLoading ||
    (activeEventIds.length > 0 &&
      activeEventIds.some((_, i) => {
        const eq = eventDetailQueries[i];
        const tq = eventTeamsQueries[i];
        const enq = eventEntriesQueries[i];
        return !!(eq?.isLoading || tq?.isLoading || enq?.isLoading);
      }));

  const insightsRefetching =
    activeEventIds.length > 0 &&
    !insightsLoading &&
    activeEventIds.some((_, i) => {
      const eq = eventDetailQueries[i];
      const tq = eventTeamsQueries[i];
      const enq = eventEntriesQueries[i];
      return !!(eq?.isFetching || tq?.isFetching || enq?.isFetching);
    });

  const emptySelection =
    !isLoading && (events?.length ?? 0) > 0 && activeEventIds.length === 0;

  const insightBundleKey = useMemo(() => {
    if (activeEventIds.length === 0) return "";
    return activeEventIds
      .map((id, i) => {
        const eq = eventDetailQueries[i];
        const tq = eventTeamsQueries[i];
        const enq = eventEntriesQueries[i];
        return [
          id,
          eq?.dataUpdatedAt ?? 0,
          tq?.dataUpdatedAt ?? 0,
          enq?.dataUpdatedAt ?? 0,
          eq?.fetchStatus ?? "",
        ].join(":");
      })
      .join("|");
  }, [activeEventIds, eventDetailQueries, eventTeamsQueries, eventEntriesQueries]);

  const { topTeamsDisplay, scoutLeaderboardDisplay } = useMemo(() => {
    if (insightBundleKey === "") {
      return { topTeamsDisplay: [] as TeamStat[], scoutLeaderboardDisplay: [] as ScoutStat[] };
    }

    const allMatches: MatchData[] = [];
    const teamAgg = new Map<number, { teamLabel: string; sum: number; count: number }>();

    for (let i = 0; i < activeEventIds.length; i++) {
      const eventRow = eventDetailQueries[i]?.data as Event | undefined;
      const eventTeams = eventTeamsQueries[i]?.data as (EventTeam & { team: Team })[] | undefined;
      const entries = eventEntriesQueries[i]?.data as ScoutingEntryWithScouter[] | undefined;

      if (!eventRow || !Array.isArray(eventTeams) || !Array.isArray(entries)) {
        continue;
      }

      const teamById = new Map<number, Team>();
      for (const et of eventTeams) {
        teamById.set(et.teamId, et.team);
      }

      const teams = eventTeams.map((et) => et.team);
      const teamStats = computeTeamStats(teams, entries);
      const statRanges = computeStatRanges(teamStats);
      const statRangesForSzr = computeStatRangesForSzr(teamStats);
      const tbaRanges = computeTbaRanges(eventTeams);
      const szrWeights = parseSzrWeights(eventRow.szrWeights);
      const szrMap = computeSzrMapWithSweepBonus(
        teams,
        entries,
        statRangesForSzr,
        statRanges,
        szrWeights,
        eventTeams,
        tbaRanges,
      );

      for (const et of eventTeams) {
        const szr = szrMap.get(et.teamId) ?? 0;
        if (szr <= 0) continue;
        const tn = et.team.teamNumber;
        const prev = teamAgg.get(tn);
        if (prev) {
          prev.sum += szr;
          prev.count += 1;
        } else {
          teamAgg.set(tn, { teamLabel: et.team.teamName, sum: szr, count: 1 });
        }
      }

      const matches = buildMatchDataForEvent(entries, teamById, szrMap);
      allMatches.push(...matches);
    }

    const topTeamsDisplay: TeamStat[] = Array.from(teamAgg.entries())
      .map(([teamNumber, v]) => ({
        id: `team-${teamNumber}`,
        eventId: 0,
        teamNumber,
        teamLabel: v.teamLabel,
        szrScore: Math.round((v.sum / v.count) * 10) / 10,
      }))
      .sort((a, b) => b.szrScore - a.szrScore)
      .slice(0, 4);

    return {
      topTeamsDisplay,
      scoutLeaderboardDisplay: topScoutsFromMatchRows(allMatches, 4),
    };
  }, [insightBundleKey, activeEventIds, eventDetailQueries, eventTeamsQueries, eventEntriesQueries]);

  useEffect(() => {
    if (!events?.length) {
      setActiveEvents({});
      return;
    }
    setActiveEvents((prev) => {
      const next = { ...prev };
      const validIds = new Set(events.map((e) => e.id));
      for (const key of Object.keys(next)) {
        const id = Number(key);
        if (!validIds.has(id)) delete next[id];
      }
      for (const e of events) {
        if (next[e.id] === undefined) next[e.id] = true;
      }
      return next;
    });
  }, [events]);

  const maxSzr = useMemo(
    () => Math.max(1, ...topTeamsDisplay.map((t) => t.szrScore)),
    [topTeamsDisplay]
  );
  const maxMatches = useMemo(
    () => Math.max(1, ...scoutLeaderboardDisplay.map((s) => s.matches)),
    [scoutLeaderboardDisplay]
  );

  const openGlobalSettings = () => {
    toast({ title: "Coming soon", description: "Global app settings are not available yet." });
  };

  const glassNavBtn =
    "h-10 w-10 rounded-xl border border-zinc-700/60 bg-zinc-900/50 text-zinc-400 shadow-sm backdrop-blur-md transition-all hover:border-blue-500/30 hover:bg-zinc-800/60 hover:text-zinc-100 hover:shadow-md hover:shadow-black/30";

  return (
    <div className="dark relative min-h-screen overflow-x-hidden bg-[#0a0a0a] font-[Inter,system-ui,sans-serif] antialiased text-zinc-100">
      <LandingBackground tone="dashboard" />

      <div className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-zinc-950/70 p-1.5 shadow-lg shadow-black/40 backdrop-blur-xl sm:right-6 sm:gap-2">
        {user?.role === "admin" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={glassNavBtn} asChild data-testid="button-admin-users">
                <Link href="/admin/users">
                  <Shield className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="border-zinc-700 bg-zinc-900 text-zinc-200">
              Admin — manage users
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={glassNavBtn}
              onClick={openGlobalSettings}
              data-testid="button-global-settings"
            >
              <Cog className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border-zinc-700 bg-zinc-900 text-zinc-200">
            Settings
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={glassNavBtn}
              onClick={toggleTheme}
              data-testid="button-toggle-theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border-zinc-700 bg-zinc-900 text-zinc-200">
            Theme
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className={glassNavBtn} onClick={logout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border-zinc-700 bg-zinc-900 text-zinc-200">
            Log out{user?.username ? ` (${user.username})` : ""}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="relative z-10 w-full px-4 pb-16 pt-20 sm:px-6 lg:px-10 lg:pt-24 xl:px-14 2xl:px-16">
        <div className="mx-auto max-w-[1680px] space-y-10">
          <header className="border-b border-zinc-800/80 pb-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <AppLogoMark boxClassName="h-14 w-14 sm:h-16 sm:w-16" imgClassName="h-11 w-11 sm:h-14 sm:w-14" />
                  <div>
                    <h1
                      className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl"
                      data-testid="text-page-title"
                    >
                      Season dashboard
                    </h1>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-400">
                      Strikescout — events and tools for the selected competition year.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 lg:max-w-sm lg:items-end">
                {user?.role === "admin" && seasons && seasons.length > 0 && selectedYear != null ? (
                  <>
                    <Label htmlFor="season-select" className="text-xs font-medium text-zinc-500">
                      Season
                    </Label>
                    <Select
                      value={String(selectedYear)}
                      disabled={selectSeasonMutation.isPending}
                      onValueChange={(v) => selectSeasonMutation.mutate(Number(v))}
                    >
                      <SelectTrigger
                        id="season-select"
                        className="h-11 w-full min-w-[200px] border-zinc-700 bg-zinc-900/60 text-zinc-100 backdrop-blur-sm focus:ring-blue-500/40 lg:w-[220px]"
                        data-testid="select-season"
                      >
                        <SelectValue placeholder="Season" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                        {seasons.map((s) => (
                          <SelectItem
                            key={s.year}
                            value={String(s.year)}
                            className="focus:bg-zinc-800 focus:text-zinc-100"
                          >
                            {s.year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] leading-relaxed text-zinc-500 lg:text-right">
                      New years are added by developers. Changing season sends every signed-in device back to this
                      dashboard from any event screen.
                    </p>
                  </>
                ) : null}

                {user?.role !== "admin" && selectedYear != null ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 backdrop-blur-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Viewing season</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-50">{selectedYear}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.65fr_1fr] lg:items-start lg:gap-12">
            <section className="min-w-0 space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-zinc-100 sm:text-xl" data-testid="text-events-heading">
                  Events
                </h2>
                {user?.role === "admin" && (
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                      <Button
                        data-testid="button-create-event"
                        className="w-full border-0 bg-blue-600 text-white shadow-lg shadow-black/25 transition-all hover:bg-blue-500 hover:shadow-black/30 sm:w-auto"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                      <DialogHeader>
                        <DialogTitle className="text-zinc-100">Create Event</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form
                          onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                          className="space-y-4"
                        >
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-zinc-300">Event Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g. 2026 Houston Regional"
                                    data-testid="input-event-name"
                                    className="border-zinc-700 bg-zinc-950/50 text-zinc-100"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="location"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-zinc-300">Location</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g. Houston, TX"
                                    data-testid="input-event-location"
                                    className="border-zinc-700 bg-zinc-950/50 text-zinc-100"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-zinc-300">Start Date</FormLabel>
                                <FormControl>
                                  <DatePicker
                                    ref={field.ref}
                                    value={field.value ?? ""}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    placeholder="Pick start date"
                                    data-testid="input-event-date"
                                    triggerClassName="border-zinc-700 bg-zinc-950/50 text-zinc-100 hover:bg-zinc-950/50 hover:text-zinc-100"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="submit"
                            className="w-full bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500"
                            disabled={createMutation.isPending}
                            data-testid="button-submit-event"
                          >
                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Event
                          </Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {isLoading ? (
                <motion.div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
                    hidden: {},
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <motion.div
                      key={i}
                      variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 8 } }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="h-full overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur-md">
                        <Skeleton className="h-24 w-full bg-zinc-800/80" />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : events?.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/30 px-6 py-14 text-center backdrop-blur-sm sm:px-10">
                  <Calendar className="mx-auto mb-4 h-12 w-12 text-zinc-500" />
                  <p className="text-lg font-semibold text-zinc-200">No events yet</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {user?.role === "admin"
                      ? "Create your first event to start scouting robots."
                      : "No events have been created. Ask an admin to set one up."}
                  </p>
                  {user?.role === "admin" && (
                    <Button
                      className="mt-6 bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500"
                      onClick={() => setCreateOpen(true)}
                      data-testid="button-create-event-empty"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Event
                    </Button>
                  )}
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
                    hidden: {},
                  }}
                >
                  {events?.map((event) => (
                    <motion.div
                      key={event.id}
                      variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 10 } }}
                      transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
                      className="h-full"
                    >
                      <Card
                        variant="glassHover"
                        className="group relative flex h-full flex-col overflow-hidden p-5"
                        data-testid={`card-event-${event.id}`}
                      >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="flex flex-1 items-start justify-between gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-0 min-w-0 flex-1 justify-start p-0 text-left font-normal transition-transform hover:bg-transparent active:scale-[0.99]"
                            onClick={() =>
                              setLocation(
                                user?.role === "admin"
                                  ? `/events/${event.id}`
                                  : `/events/${event.id}/scouting-schedule`
                              )
                            }
                          >
                            <span
                              className="line-clamp-2 text-lg font-semibold leading-snug text-zinc-100 group-hover:text-blue-100"
                              data-testid={`text-event-name-${event.id}`}
                            >
                              {event.name}
                            </span>
                            <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-400">
                              {event.location ? (
                                <span className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-400/80" />
                                  <span className="truncate">{event.location}</span>
                                </span>
                              ) : null}
                              {event.startDate ? (
                                <span className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-400/80" />
                                  <span className="tabular-nums">{event.startDate}</span>
                                </span>
                              ) : null}
                            </div>
                          </Button>
                          {user?.role === "admin" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 shrink-0 rounded-xl border border-transparent text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80 hover:text-zinc-100"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSettingsEvent(event);
                              }}
                              data-testid={`button-settings-${event.id}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div
                          className="mt-4 flex items-center justify-end border-t border-zinc-800/60 pt-3"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={activeEvents[event.id] !== false}
                            onCheckedChange={(on) =>
                              setActiveEvents((prev) => ({ ...prev, [event.id]: on }))
                            }
                            className={eventFilterSwitchClass}
                            aria-label={`Include ${event.name} in season-wide stats`}
                            data-testid={`toggle-event-include-${event.id}`}
                          />
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </section>

            <SeasonStatsSidebar
              topTeams={topTeamsDisplay}
              scoutRows={scoutLeaderboardDisplay}
              maxSzr={maxSzr}
              maxMatches={maxMatches}
              emptySelection={emptySelection}
              insightsLoading={insightsLoading}
              insightsRefetching={insightsRefetching}
            />
          </div>

          {settingsEvent && (
            <EventSettingsDialog
              event={settingsEvent}
              open={!!settingsEvent}
              onOpenChange={(open) => {
                if (!open) setSettingsEvent(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
