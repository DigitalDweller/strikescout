import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CalendarCheck, Trash2, Loader2, UserPlus, Bug, Check, X, Coffee, RefreshCw, User, UserCog } from "lucide-react";
import type { EventTeam, ScoutingEntry, Team } from "@shared/schema";
import { useHelp } from "@/contexts/help-context";
import { useAuth } from "@/hooks/use-auth";
import type { Event, ScheduleMatch } from "@shared/schema";
import { scoutSlots, type ScoutSlot } from "@shared/schema";
import { cn } from "@/lib/utils";
import { StickyThreeColumnLayout } from "@/components/data-dense-layout";

interface Scouter {
  id: number;
  displayName: string;
  entryCount: number;
  rep: number;
  eventsScouted: number;
  /** When false, scout is not at the event — hidden from admin roster panels. */
  isPresent?: boolean;
}

interface ScoutAssignment {
  id: number;
  eventId: number;
  matchNumber: number;
  slot: string;
  scouterId: number | null;
  scouter: { id: number; displayName: string; username: string } | null;
}

interface ScoutAssignmentRequest {
  id: number;
  eventId: number;
  type: "break" | "trade";
  requesterId: number;
  targetScouterId: number | null;
  status: string;
  requester?: { id: number; displayName: string };
  targetScouter?: { id: number; displayName: string };
  createdAt: string;
  reviewedAt?: string | null;
}

/** Roster row: click to select as the active “brush” for painting slots; click again to deselect. */
function ScoutCard({
  scouter,
  disabled,
  isSelected,
  onToggle,
}: {
  scouter: Scouter;
  disabled?: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "h-auto min-h-0 w-full flex-col items-stretch justify-start gap-0 px-3 py-2.5 text-left font-normal transition-all duration-200 ease-out select-none touch-none",
        "rounded-xl border shadow-none hover:scale-[1.01] active:scale-[0.99]",
        disabled && "cursor-not-allowed border-transparent bg-muted/40 opacity-60 hover:scale-100",
        !disabled &&
          isSelected &&
          "border-primary/80 bg-primary/10 ring-2 ring-primary/90 ring-offset-2 ring-offset-zinc-950/80 hover:bg-primary/12",
        !disabled &&
          !isSelected &&
          "border-white/10 bg-zinc-900/40 hover:bg-zinc-800/50 hover:border-primary/25",
      )}
    >
      <span className="flex w-full items-start gap-2">
        <User
          className={cn("mt-0.5 h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground opacity-70")}
        />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-medium", isSelected && "text-primary")}>{scouter.displayName}</span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0 text-xs text-muted-foreground">
            <span>{scouter.entryCount} entries</span>
            <span>·</span>
            <span>{scouter.rep} rep</span>
          </span>
        </span>
      </span>
    </Button>
  );
}

function ScheduleCell({
  slot,
  assignedScout,
  hasScouted,
  edgeClassName,
  allianceFullyScouted,
  isMySlot,
  mergeWithPrev,
  mergeWithNext,
  mergeWithPrevRow,
  mergeWithNextRow,
  missed,
}: {
  slot: string;
  assignedScout: string | null;
  hasScouted: boolean;
  edgeClassName?: string;
  allianceFullyScouted?: boolean;
  isMySlot?: boolean;
  mergeWithPrev?: boolean;
  mergeWithNext?: boolean;
  mergeWithPrevRow?: boolean;
  mergeWithNextRow?: boolean;
  missed?: boolean;
}) {
  const isRed = slot.startsWith("R");
  const baseBg = isRed ? "bg-red-500/5" : "bg-blue-500/5";
  const allianceScoutedBg = allianceFullyScouted
    ? (isRed ? "bg-red-500/75 dark:bg-red-500/85" : "bg-blue-500/75 dark:bg-blue-500/85")
    : "";
  const myScoutedCellBg = isMySlot && hasScouted
    ? (isRed ? "bg-red-500/15 dark:bg-red-500/25" : "bg-blue-500/15 dark:bg-blue-500/25")
    : "";
  const grayedOut = !isMySlot ? "opacity-50" : "";
  const mySlotOutline =
    isMySlot && !hasScouted
      ? `border-2 ${isRed ? "border-red-500 dark:border-red-400" : "border-blue-500 dark:border-blue-400"} ${mergeWithPrev ? "border-l-0" : ""} ${mergeWithNext ? "border-r-0" : ""} ${mergeWithPrevRow ? "border-t-0" : ""} ${mergeWithNextRow ? "border-b-0" : ""}`
      : "";
  const cellBg = allianceFullyScouted ? allianceScoutedBg : (isMySlot && hasScouted ? myScoutedCellBg : baseBg);
  return (
    <TableCell
      className={`text-center align-middle min-w-[48px] sm:min-w-[92px] transition-all duration-200 ease-out ${cellBg} ${grayedOut} ${edgeClassName ?? ""} ${mySlotOutline}`}
    >
      <div className="flex items-center justify-center min-h-[40px] sm:min-h-[56px]">
        {assignedScout ? (
          <Badge
            variant="outline"
            className={`text-xs sm:text-base font-medium px-1.5 py-0.5 sm:px-4 sm:py-2 max-w-full truncate border ${
              !isMySlot
                ? "bg-muted/50 border-muted-foreground/30 text-muted-foreground"
                : missed
                  ? isRed
                    ? "border-red-500/20 bg-red-500/5 dark:bg-red-500/8 text-red-500/55 dark:text-red-400/45"
                    : "border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/8 text-blue-500/55 dark:text-blue-400/45"
                  : hasScouted
                    ? isRed
                      ? "border-red-500/50 bg-red-500/15 dark:bg-red-500/25 text-red-600 dark:text-red-400"
                      : "border-blue-500/50 bg-blue-500/15 dark:bg-blue-500/25 text-blue-600 dark:text-blue-400"
                    : isRed
                      ? "border-red-500/40 bg-transparent text-red-600 dark:text-red-400"
                      : "border-blue-500/40 bg-transparent text-blue-600 dark:text-blue-400"
            } ${hasScouted ? "animate-scout-pop " : ""}`}
          >
            {assignedScout}
          </Badge>
        ) : (
          <Badge variant="outline" className={`text-xs sm:text-base font-normal px-1.5 py-0.5 sm:px-4 sm:py-2 ${!isMySlot ? "text-muted-foreground bg-muted/30" : "text-muted-foreground"}`}>
            —
          </Badge>
        )}
      </div>
    </TableCell>
  );
}

/** Schedule slot: click paints the selected scout; with no brush, a small clear control removes the assignment. */
function PaintableCell({
  matchNumber,
  slot,
  assignedScout,
  lastPaintedSlot,
  hasScouted,
  edgeClassName,
  allianceFullyScouted,
  selectedScout,
  eventIsOver,
  onPaint,
  onClear,
}: {
  matchNumber: number;
  slot: string;
  assignedScout: string | null;
  lastPaintedSlot: { matchNumber: number; slot: string } | null;
  hasScouted: boolean;
  edgeClassName?: string;
  allianceFullyScouted?: boolean;
  selectedScout: Scouter | null;
  eventIsOver: boolean;
  onPaint: () => void;
  onClear: () => void;
}) {
  const isRed = slot.startsWith("R");
  const justPainted = lastPaintedSlot?.matchNumber === matchNumber && lastPaintedSlot?.slot === slot && !!assignedScout;
  const baseBg = isRed ? "bg-red-500/5" : "bg-blue-500/5";
  const allianceScoutedBg = allianceFullyScouted
    ? (isRed ? "bg-red-500/75 dark:bg-red-500/85" : "bg-blue-500/75 dark:bg-blue-500/85")
    : "";
  const brushActive = !!selectedScout && !eventIsOver;
  const bg = allianceFullyScouted ? allianceScoutedBg : baseBg;
  const brushRing = isRed
    ? "ring-1 ring-inset ring-red-500/30 cursor-pointer hover:bg-red-500/10 hover:ring-red-500/55"
    : "ring-1 ring-inset ring-primary/20 cursor-pointer hover:bg-primary/10 hover:ring-primary/50";

  return (
    <TableCell
      className={`text-center align-middle min-w-[48px] sm:min-w-[92px] transition-all duration-150 ease-out p-1 sm:p-2 ${bg} ${edgeClassName ?? ""} ${
        brushActive ? brushRing : ""
      }`}
    >
      <div
        role={brushActive ? "button" : undefined}
        tabIndex={brushActive ? 0 : undefined}
        onClick={() => {
          if (eventIsOver) return;
          if (brushActive) onPaint();
        }}
        onKeyDown={(e) => {
          if (!brushActive || eventIsOver) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPaint();
          }
        }}
        className={`relative flex items-center justify-center min-h-[40px] sm:min-h-[56px] rounded-md ${brushActive ? "ring-0" : ""}`}
      >
        {assignedScout ? (
          <Badge
            variant="outline"
            className={`text-xs sm:text-base font-medium px-1.5 py-0.5 sm:px-4 sm:py-2 max-w-full truncate border ${
              hasScouted
                ? isRed
                  ? "border-red-500/50 bg-red-500/15 dark:bg-red-500/25 text-red-600 dark:text-red-400"
                  : "border-blue-500/50 bg-blue-500/15 dark:bg-blue-500/25 text-blue-600 dark:text-blue-400"
                : isRed
                  ? "border-red-500/40 bg-transparent text-red-600 dark:text-red-400"
                  : "border-blue-500/40 bg-transparent text-blue-600 dark:text-blue-400"
            } ${justPainted || hasScouted ? "animate-scout-pop " : ""}`}
          >
            {assignedScout}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs sm:text-base font-normal px-1.5 py-0.5 sm:px-4 sm:py-2 text-muted-foreground">
            —
          </Badge>
        )}
        {!brushActive && assignedScout && !eventIsOver && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Remove assignment"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className={cn(
              "absolute -right-0.5 -top-0.5 h-5 w-5 min-h-0 rounded-full border shadow-none backdrop-blur-md transition-colors",
              "bg-zinc-950/70 active:scale-95",
              isRed
                ? [
                    "border-red-500/45 text-red-400",
                    "hover:border-red-400/80 hover:bg-red-500/15 hover:text-red-200",
                    "focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                  ]
                : [
                    "border-primary/40 text-primary",
                    "hover:border-primary/70 hover:bg-primary/15 hover:text-sky-200",
                    "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                  ],
            )}
            aria-label="Remove scout from slot"
          >
            <X className="h-3 w-3 stroke-[2.5]" />
          </Button>
        )}
      </div>
    </TableCell>
  );
}

export default function ScoutingSchedule() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const help = useHelp();
  /** Selected scout acts as the “brush” for painting slots; null means no assignment on slot click. */
  const [selectedScout, setSelectedScout] = useState<Scouter | null>(null);
  const [lastPaintedSlot, setLastPaintedSlot] = useState<{ matchNumber: number; slot: string } | null>(null);
  const [clearAllClickCount, setClearAllClickCount] = useState(0);
  const [fillOneScoutId, setFillOneScoutId] = useState<string>("");
  const [fillSelectedScoutIds, setFillSelectedScoutIds] = useState<Set<number>>(new Set());
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [clearAllConfirmCode, setClearAllConfirmCode] = useState("");
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const lastClearAllAt = useRef<number>(0);
  const CLEAR_ALL_RATE_LIMIT_MS = 10_000;

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
    refetchInterval: 5000,
  });

  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
    enabled: !!eventId,
  });

  const { data: scouters = [], isLoading: scoutersLoading } = useQuery<Scouter[]>({
    queryKey: ["/api/events", eventId, "scouters"],
    enabled: !!eventId,
  });

  /** Scouts physically at the venue (admin roster + live panels). */
  const presentScouters = useMemo(
    () => scouters.filter((s) => s.isPresent !== false),
    [scouters],
  );

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<ScoutAssignment[]>({
    queryKey: ["/api/events", eventId, "scout-assignments", "all"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/events/${eventId}/scout-assignments?all=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!eventId,
  });

  const { data: eventTeams = [] } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
    enabled: !!eventId,
  });

  const { data: entries = [] } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
    enabled: !!eventId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { matchNumber: number; slot: string; scouterId: number | null }[]) => {
      const res = await apiRequest("PUT", `/api/events/${eventId}/scout-assignments`, {
        assignments: updates,
      });
      return res.json();
    },
    onMutate: async (updates) => {
      const single = updates[0];
      if (updates.length === 1 && single?.scouterId != null && single?.matchNumber != null && single?.slot != null) {
        setLastPaintedSlot({ matchNumber: single.matchNumber, slot: single.slot });
        setTimeout(() => setLastPaintedSlot(null), 400);
      }
      const assignKey = ["/api/events", eventId, "scout-assignments", "all"] as const;
      await queryClient.cancelQueries({ queryKey: assignKey });
      const previous = queryClient.getQueryData<ScoutAssignment[]>(assignKey);
      queryClient.setQueryData<ScoutAssignment[]>(assignKey, (old = []) => {
        const key = (m: number, s: string) => `${m}-${s}`;
        const existing = new Map(old.map((a) => [key(a.matchNumber, a.slot), a]));
        for (const u of updates) {
          if (u.matchNumber != null && u.slot != null) {
            const scout = u.scouterId != null ? scouters.find((s) => s.id === u.scouterId) : null;
            existing.set(key(u.matchNumber, u.slot), {
              id: existing.get(key(u.matchNumber, u.slot))?.id ?? -1,
              eventId,
              matchNumber: u.matchNumber,
              slot: u.slot,
              scouterId: u.scouterId,
              scouter: scout ? { id: scout.id, displayName: scout.displayName, username: scout.displayName } : null,
            });
          }
        }
        return Array.from(existing.values());
      });
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Assignment updated" });
    },
    onError: (_err, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/events", eventId, "scout-assignments", "all"], context.previous);
      }
      toast({ title: "Failed to update", description: "Assignment could not be saved", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-assignments"] });
    },
  });

  const assignmentMap = useMemo(() => {
    const m = new Map<string, ScoutAssignment>();
    assignments.forEach((a) => m.set(`${a.matchNumber}-${a.slot}`, a));
    return m;
  }, [assignments]);

  const scoutedSet = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      set.add(`${e.matchNumber}-${e.teamId}-${e.scouterId}`);
    }
    return set;
  }, [entries]);

  const teamNumberToId = useMemo(() => {
    const m = new Map<number, number>();
    eventTeams.forEach((et) => m.set(et.team.teamNumber, et.teamId));
    return m;
  }, [eventTeams]);

  const scheduleWithSlots = useMemo(() => {
    const sorted = [...schedule].sort((a, b) => a.matchNumber - b.matchNumber);
    const slotToTeam: Record<ScoutSlot, keyof ScheduleMatch> = {
      R1: "red1",
      R2: "red2",
      R3: "red3",
      B1: "blue1",
      B2: "blue2",
      B3: "blue3",
    };
    return sorted.map((m) => ({
      match: m,
      slots: scoutSlots.map((slot) => {
        const teamKey = slotToTeam[slot];
        const teamNumber = m[teamKey] as number | null;
        const assignment = assignmentMap.get(`${m.matchNumber}-${slot}`);
        const scouterId = assignment?.scouterId ?? null;
        const teamId = teamNumber != null ? teamNumberToId.get(teamNumber) : undefined;
        const hasScouted =
          !!scouterId &&
          teamId != null &&
          scoutedSet.has(`${m.matchNumber}-${teamId}-${scouterId}`);
        return {
          slot,
          teamNumber: teamNumber ?? null,
          assignedScout: assignment?.scouter?.displayName ?? null,
          scouterId,
          hasScouted,
        };
      }),
    }));
  }, [schedule, assignmentMap, scoutedSet, teamNumberToId]);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: assignmentRequests = [], refetch: refetchRequests } = useQuery<ScoutAssignmentRequest[]>({
    queryKey: ["/api/events", eventId, "scout-assignment-requests"],
    enabled: !!eventId && isAdmin,
  });
  const { data: myRequests = [] } = useQuery<{ id: number; type: string; status: string; targetScouter?: { displayName: string } }[]>({
    queryKey: ["/api/events", eventId, "scout-assignment-requests"],
    enabled: !!eventId && !isAdmin,
  });
  const { data: breakCredits } = useQuery<{ breaksUsed: number; breaksRemaining: number }>({
    queryKey: ["/api/events", eventId, "scout-break-credits"],
    enabled: !!eventId && !isAdmin,
  });
  const [tradeTargetId, setTradeTargetId] = useState<string>("");
  const pendingRequest = useMemo(() => myRequests.find((r) => r.status === "pending"), [myRequests]);
  const otherScouters = useMemo(() => scouters.filter((s) => s.id !== user?.id), [scouters, user?.id]);
  const createRequestMutation = useMutation({
    mutationFn: async ({ type, targetScouterId }: { type: "break" | "trade"; targetScouterId?: number }) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/scout-assignment-requests`, type === "trade" ? { type, targetScouterId } : { type });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-assignment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-break-credits"] });
      setTradeTargetId("");
      toast({ title: variables.type === "break" ? "Break requested" : "Trade requested", description: "Waiting for admin approval." });
    },
    onError: (err: Error) => {
      toast({ title: "Request failed", description: err.message, variant: "destructive" });
    },
  });
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/scout-assignment-requests/${requestId}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-assignment-requests"] });
      toast({ title: "Request cancelled" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    },
  });
  const giveBackBreaksMutation = useMutation({
    mutationFn: async ({ scouterId, amount }: { scouterId: number; amount: number }) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/scout-break-credits`, { scouterId, amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-break-credits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-break-credits", "all"] });
      toast({ title: "Break credits restored" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to give back", description: err.message, variant: "destructive" });
    },
  });
  const setCurrentMatchMutation = useMutation({
    mutationFn: async (currentMatchNumber: number) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/current-match`, { currentMatchNumber });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({ title: "Current match updated", description: "All clients will see the update." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update match", description: err.message, variant: "destructive" });
    },
  });
  const { data: breakCreditsAll = [] } = useQuery<{ scouterId: number; displayName: string; breaksUsed: number }[]>({
    queryKey: ["/api/events", eventId, "scout-break-credits", "all"],
    enabled: !!eventId && isAdmin,
  });
  const pendingRequests = useMemo(() => assignmentRequests.filter((r) => r.status === "pending"), [assignmentRequests]);
  const eventIsOver = !event?.isActive && !(event?.testingOverrideEventEnded ?? false);
  const currentMatchNum =
    (event?.testingOverrideMatchNumber != null ? event.testingOverrideMatchNumber : event?.currentMatchNumber) ?? 1;
  const currentMatchSlots = useMemo(() => {
    return scoutSlots.map((slot) => {
      const a = assignmentMap.get(`${currentMatchNum}-${slot}`);
      return { slot, scouterId: a?.scouterId ?? null, displayName: a?.scouter?.displayName ?? null };
    });
  }, [assignmentMap, currentMatchNum]);
  /** Latest approved break request per scouter (for recall + UI). */
  const onBreakRows = useMemo(() => {
    const list = assignmentRequests
      .filter((r) => r.type === "break" && r.status === "approved" && r.requester)
      .sort((a, b) => new Date(b.reviewedAt ?? 0).getTime() - new Date(a.reviewedAt ?? 0).getTime());
    const seen = new Set<number>();
    const rows: { requestId: number; scouterId: number; displayName: string; reviewedAt: number }[] = [];
    for (const r of list) {
      if (seen.has(r.requesterId)) continue;
      seen.add(r.requesterId);
      rows.push({
        requestId: r.id,
        scouterId: r.requesterId,
        displayName: r.requester?.displayName ?? "?",
        reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).getTime() : 0,
      });
    }
    return rows;
  }, [assignmentRequests]);

  const presentIds = useMemo(() => new Set(presentScouters.map((s) => s.id)), [presentScouters]);

  const onBreakRowsVisible = useMemo(
    () => onBreakRows.filter((r) => presentIds.has(r.scouterId)),
    [onBreakRows, presentIds],
  );

  const assignedToCurrentIds = useMemo(
    () => new Set(currentMatchSlots.map((s) => s.scouterId).filter((id): id is number => id != null)),
    [currentMatchSlots]
  );
  const onBreakIds = useMemo(() => new Set(onBreakRowsVisible.map((r) => r.scouterId)), [onBreakRowsVisible]);
  const activeScouters = useMemo(
    () =>
      presentScouters
        .filter((s) => assignedToCurrentIds.has(s.id) && !onBreakIds.has(s.id))
        .sort((a, b) => b.rep - a.rep),
    [presentScouters, assignedToCurrentIds, onBreakIds],
  );
  const onBreakSortedScouters = useMemo(
    () => presentScouters.filter((s) => onBreakIds.has(s.id)).sort((a, b) => b.rep - a.rep),
    [presentScouters, onBreakIds],
  );
  const benchScouters = useMemo(
    () => presentScouters.filter((s) => !assignedToCurrentIds.has(s.id) && !onBreakIds.has(s.id)).sort((a, b) => b.rep - a.rep),
    [presentScouters, assignedToCurrentIds, onBreakIds],
  );
  const standbyScouters = useMemo(() => benchScouters.slice(0, 4), [benchScouters]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isAdmin || onBreakRowsVisible.length === 0 || eventIsOver) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isAdmin, onBreakRowsVisible.length, eventIsOver]);

  function formatDuration(ms: number): string {
    const sec = Math.floor((Date.now() - ms) / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    return `${hr}h`;
  }

  const approveRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "denied" }) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/scout-assignment-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      refetchRequests();
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-assignment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-break-credits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-break-credits", "all"] });
      toast({ title: variables.status === "approved" ? "Request approved" : "Request denied" });
    },
    onError: () => {
      toast({ title: "Failed to update request", variant: "destructive" });
    },
  });

  const presenceMutation = useMutation({
    mutationFn: async (presence: { scouterId: number; isPresent: boolean }[]) => {
      const res = await apiRequest("PUT", `/api/events/${eventId}/scouter-presence`, { presence });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scouters"] });
      toast({ title: "Roster updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update roster", description: err.message, variant: "destructive" });
    },
  });

  const recallBreakMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/scout-assignment-requests/${requestId}/recall-break`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-assignment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-break-credits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scout-break-credits", "all"] });
      toast({ title: "Break recalled", description: "Scout returned to standby." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not recall", description: err.message, variant: "destructive" });
    },
  });

  const setPresence = useCallback(
    (scouterId: number, isPresent: boolean) => {
      presenceMutation.mutate([{ scouterId, isPresent }]);
    },
    [presenceMutation],
  );

  /** Escape drops the brush; avoid clobbering inputs/modals. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      setSelectedScout(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (selectedScout && !presentScouters.some((s) => s.id === selectedScout.id)) {
      setSelectedScout(null);
    }
  }, [selectedScout, presentScouters]);

  const toggleScoutSelection = useCallback((scout: Scouter) => {
    setSelectedScout((prev) => (prev?.id === scout.id ? null : scout));
  }, []);

  const handleClearAllClick = useCallback(() => {
    const elapsed = Date.now() - lastClearAllAt.current;
    if (elapsed < CLEAR_ALL_RATE_LIMIT_MS) {
      toast({
        title: "Please wait",
        description: `Clear all can be used again in ${Math.ceil((CLEAR_ALL_RATE_LIMIT_MS - elapsed) / 1000)}s`,
        variant: "destructive",
      });
      return;
    }
    setClearAllConfirmOpen(true);
    setClearAllConfirmCode("");
  }, [toast]);

  const performClearAll = useCallback(() => {
    setClearAllClickCount((c) => c + 1);
    lastClearAllAt.current = Date.now();
    const updates = scheduleWithSlots.flatMap((row) =>
      row.slots.map((s) => ({ matchNumber: row.match.matchNumber, slot: s.slot, scouterId: null as number | null }))
    );
    updateMutation.mutate(updates);
    toast({ title: "All assignments cleared" });
    setClearAllConfirmOpen(false);
    setClearAllConfirmCode("");
  }, [scheduleWithSlots, updateMutation, toast]);

  const handleFillOnePerson = useCallback(() => {
    const scouterId = fillOneScoutId ? parseInt(fillOneScoutId, 10) : null;
    if (!scouterId || !presentScouters.some((s) => s.id === scouterId)) {
      toast({ title: "Select a scout first", variant: "destructive" });
      return;
    }
    const updates = scheduleWithSlots.flatMap((row) =>
      row.slots.map((s) => ({ matchNumber: row.match.matchNumber, slot: s.slot, scouterId }))
    );
    updateMutation.mutate(updates);
    toast({ title: "All slots filled with selected scout" });
  }, [scheduleWithSlots, fillOneScoutId, presentScouters, updateMutation, toast]);

  const toggleFillSelectedScout = useCallback((id: number) => {
    setFillSelectedScoutIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleFillWithSelected = useCallback(() => {
    const ids = Array.from(fillSelectedScoutIds);
    if (ids.length === 0) {
      toast({ title: "Select at least one scout", variant: "destructive" });
      return;
    }
    const orderedScouters = presentScouters.filter((s) => ids.includes(s.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    if (orderedScouters.length === 0) {
      toast({ title: "Select valid scouts", variant: "destructive" });
      return;
    }
    let idx = 0;
    const updates = scheduleWithSlots.flatMap((row) =>
      row.slots.map((s) => {
        const scouterId = orderedScouters[idx % orderedScouters.length].id;
        idx++;
        return { matchNumber: row.match.matchNumber, slot: s.slot, scouterId };
      })
    );
    updateMutation.mutate(updates);
    toast({ title: "All slots filled with selected scouts" });
  }, [scheduleWithSlots, fillSelectedScoutIds, presentScouters, updateMutation, toast]);

  const handleAutoAssign = useCallback(() => {
    if (presentScouters.length === 0) {
      toast({ title: "No scouts available", variant: "destructive" });
      return;
    }
    const updates: { matchNumber: number; slot: string; scouterId: number | null }[] = [];
    let scoutIdx = 0;
    scheduleWithSlots.forEach((row) => {
      row.slots.forEach((s) => {
        const scouterId = presentScouters[scoutIdx % presentScouters.length].id;
        updates.push({ matchNumber: row.match.matchNumber, slot: s.slot, scouterId });
        scoutIdx++;
      });
    });
    updateMutation.mutate(updates);
    toast({ title: "Auto-assigned round-robin" });
  }, [presentScouters, scheduleWithSlots, updateMutation, toast]);

  const isLoading = scheduleLoading || assignmentsLoading || scoutersLoading;

  if (eventId < 1) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Invalid event</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-4 max-w-full overflow-x-auto min-h-[100dvh] flex flex-col">
      <div className="shrink-0">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarCheck className="h-8 w-8" />
          {isAdmin ? "Scouter Management" : "Overview"}
          {help?.HelpTrigger?.({
            content: {
              title: isAdmin ? "Scouter Management" : "Overview",
              body: (
                <p>
                  {isAdmin
                    ? "Assign scouts to each match and team slot (R1–R3, B1–B3). Click a scout to select them, then click slots to paint assignments. Press Escape or Deselect to drop the brush. Changes sync in real time to all scouts."
                    : "View the match schedule and scout assignments. Your assigned slots are highlighted."}
                </p>
              ),
            },
          })}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1 truncate">
          {event?.name || "Loading..."}
          <span className="hidden sm:inline">{isAdmin ? " — Assign scouts to match slots" : " — Match schedule and your assignments"}</span>
        </p>
      </div>

      {isAdmin && (
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRosterModalOpen(true)}
          disabled={isLoading || eventIsOver}
          className="border-primary/30"
        >
          <UserCog className="h-4 w-4 mr-1" />
          Manage Roster
        </Button>
        <Dialog open={rosterModalOpen} onOpenChange={setRosterModalOpen}>
          <DialogContent className="max-h-[min(90vh,640px)] overflow-hidden border border-white/10 bg-zinc-950/85 p-0 text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-xl sm:max-w-md">
            <DialogHeader className="border-b border-white/10 px-6 py-4">
              <DialogTitle className="text-lg">Event attendance</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Only scouts marked present appear in the roster and live panels. Toggle off anyone not at the venue.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[min(60vh,480px)] space-y-0 overflow-y-auto px-2 py-2">
              {scouters.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-zinc-900/40 px-3 py-2.5 transition-colors hover:bg-zinc-800/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.displayName}</p>
                    <p className="text-xs text-zinc-500">{s.rep} rep</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-zinc-500">{s.isPresent !== false ? "Present" : "Absent"}</span>
                    <Switch
                      checked={s.isPresent !== false}
                      disabled={presenceMutation.isPending || eventIsOver}
                      onCheckedChange={(on) => setPresence(s.id, on)}
                      aria-label={`${s.displayName} present at event`}
                    />
                  </div>
                </div>
              ))}
              {scouters.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No scouts in the system.</p>
              )}
            </div>
            <DialogFooter className="border-t border-white/10 px-6 py-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setRosterModalOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" onClick={handleAutoAssign} disabled={isLoading || presentScouters.length === 0 || eventIsOver}>
          <UserPlus className="h-4 w-4 mr-1" />
          Auto-assign
        </Button>
        <Button variant="outline" size="sm" onClick={handleClearAllClick} disabled={isLoading || eventIsOver}>
          <Trash2 className="h-4 w-4 mr-1" />
          Clear all
        </Button>
        <Dialog open={clearAllConfirmOpen} onOpenChange={(open) => { setClearAllConfirmOpen(open); if (!open) setClearAllConfirmCode(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear all assignments</DialogTitle>
              <DialogDescription>
                This will remove every scout from every slot. Enter the confirmation code to proceed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="clear-confirm-code">Confirmation code</Label>
              <Input
                id="clear-confirm-code"
                type="text"
                value={clearAllConfirmCode}
                onChange={(e) => setClearAllConfirmCode(e.target.value)}
                placeholder="Enter code"
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setClearAllConfirmOpen(false); setClearAllConfirmCode(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={performClearAll}
                disabled={clearAllConfirmCode !== "CONFIRM" || isLoading}
              >
                Clear all
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {clearAllClickCount >= 4 && (
          <div className="flex items-center gap-2 pl-2 border-l border-border flex-wrap">
            <Bug className="h-4 w-4 text-muted-foreground" />
            <Select value={fillOneScoutId} onValueChange={setFillOneScoutId}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="One scout" />
              </SelectTrigger>
              <SelectContent>
                {presentScouters.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFillOnePerson}
              disabled={isLoading || !fillOneScoutId || schedule.length === 0 || eventIsOver}
            >
              Fill all (one)
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  {fillSelectedScoutIds.size > 0
                    ? `${fillSelectedScoutIds.size} selected`
                    : "Select people"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {presentScouters.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={fillSelectedScoutIds.has(s.id)}
                        onCheckedChange={() => toggleFillSelectedScout(s.id)}
                      />
                      <span className="text-sm">{s.displayName}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFillWithSelected}
              disabled={isLoading || fillSelectedScoutIds.size === 0 || schedule.length === 0 || eventIsOver}
            >
              Fill all (selected)
            </Button>
          </div>
        )}
      </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : schedule.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No matches yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sync the match schedule from TBA in Settings first.
            </p>
          </CardContent>
        </Card>
      ) : isAdmin ? (
        <StickyThreeColumnLayout
          left={
            <Card className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 shadow-xl shadow-black/40 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">Scouts</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Click to select, then paint slots</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 border-primary/30 text-xs"
                  disabled={!selectedScout || eventIsOver}
                  onClick={() => setSelectedScout(null)}
                >
                  Deselect
                </Button>
              </div>
              {selectedScout && (
                <p className="text-xs text-primary mt-2 font-medium truncate" title={selectedScout.displayName}>
                  Brush: {selectedScout.displayName}
                </p>
              )}
              <div className="mt-3 space-y-4">
                {activeScouters.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary/90">Active (this match)</p>
                    <div className="space-y-2">
                      {activeScouters.map((s) => (
                        <ScoutCard
                          key={s.id}
                          scouter={s}
                          disabled={eventIsOver}
                          isSelected={selectedScout?.id === s.id}
                          onToggle={() => toggleScoutSelection(s)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {onBreakSortedScouters.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500/90">On break</p>
                    <div className="space-y-2">
                      {onBreakSortedScouters.map((s) => (
                        <ScoutCard
                          key={s.id}
                          scouter={s}
                          disabled={eventIsOver}
                          isSelected={selectedScout?.id === s.id}
                          onToggle={() => toggleScoutSelection(s)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {benchScouters.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">On bench</p>
                    <div className="space-y-2">
                      {benchScouters.map((s) => (
                        <ScoutCard
                          key={s.id}
                          scouter={s}
                          disabled={eventIsOver}
                          isSelected={selectedScout?.id === s.id}
                          onToggle={() => toggleScoutSelection(s)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {presentScouters.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No scouts marked present. Open Manage Roster to check attendance.
                  </p>
                )}
              </div>
            </Card>
          }
          center={
            <Card className="rounded-2xl border border-white/10 bg-zinc-900/50 shadow-xl shadow-black/40 backdrop-blur-xl min-w-0 min-h-0 flex flex-col">
              <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
                <div className="overflow-x-auto overflow-y-auto min-h-0 max-h-[calc(100dvh-220px)] lg:max-h-[calc(100vh-3rem)] [scrollbar-gutter:stable]">
                  <Table className="border-collapse min-w-[320px] sm:min-w-0">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 sm:w-16 font-bold text-xs sm:text-base sticky left-0 z-[1] bg-zinc-900/95 backdrop-blur-sm">M</TableHead>
                        {scoutSlots.map((s) => (
                          <TableHead
                            key={s}
                            className={`text-center font-bold text-xs sm:text-base ${s.startsWith("R") ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`}
                          >
                            {s}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleWithSlots.map(({ match, slots }) => {
                        const allRedScouted = slots[0].hasScouted && slots[1].hasScouted && slots[2].hasScouted;
                        const allBlueScouted = slots[3].hasScouted && slots[4].hasScouted && slots[5].hasScouted;
                        const isUpToCurrentMatch = match.matchNumber <= currentMatchNum;
                        return (
                        <TableRow key={match.matchNumber}>
                          <TableCell
                            className={`font-bold text-xs sm:text-base w-10 sm:w-16 sticky left-0 z-[1] bg-zinc-900/90 backdrop-blur-sm ${isUpToCurrentMatch ? "border-l-4 border-l-red-500" : ""}`}
                          >
                            Q{match.matchNumber}
                          </TableCell>
                          {slots.map((s, idx) => (
                            <PaintableCell
                              key={s.slot}
                              matchNumber={match.matchNumber}
                              slot={s.slot}
                              assignedScout={s.assignedScout}
                              lastPaintedSlot={lastPaintedSlot}
                              hasScouted={s.hasScouted}
                              edgeClassName={isUpToCurrentMatch && idx === slots.length - 1 ? "border-r-4 border-r-blue-500" : undefined}
                              allianceFullyScouted={s.slot.startsWith("R") ? allRedScouted : allBlueScouted}
                              selectedScout={selectedScout}
                              eventIsOver={eventIsOver}
                              onPaint={() => {
                                if (!selectedScout || eventIsOver) return;
                                updateMutation.mutate([
                                  { matchNumber: match.matchNumber, slot: s.slot, scouterId: selectedScout.id },
                                ]);
                              }}
                              onClear={() => {
                                if (eventIsOver) return;
                                updateMutation.mutate([{ matchNumber: match.matchNumber, slot: s.slot, scouterId: null }]);
                              }}
                            />
                          ))}
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          }
          right={
            <Card className="rounded-2xl border border-white/10 bg-zinc-900/50 shadow-xl shadow-black/40 backdrop-blur-xl flex-1 min-w-0 lg:min-w-52">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    Scouter Management
                    {pendingRequests.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {pendingRequests.length} pending
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Current match assignments, scouters on break, and idle scouters.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {eventIsOver ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Comp is over</p>
                  ) : (
                  <>
                  <div className="border-b pb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Match {currentMatchNum} — assigned
                      {event?.testingOverrideMatchNumber != null && (
                        <span className="block text-amber-600 dark:text-amber-400 mt-0.5">(Testing override in Settings)</span>
                      )}
                    </p>
                    {event?.testingOverrideMatchNumber == null && schedule.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <Input
                          type="number"
                          min={1}
                          max={Math.max(...schedule.map((s) => s.matchNumber))}
                          className="w-16 h-8 text-sm"
                          defaultValue={event?.currentMatchNumber ?? 1}
                          data-current-match-input
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const n = parseInt((e.target as HTMLInputElement).value, 10);
                              if (Number.isFinite(n) && n >= 1) setCurrentMatchMutation.mutate(n);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => {
                            const inp = document.querySelector<HTMLInputElement>("[data-current-match-input]");
                            const n = inp ? parseInt(inp.value, 10) : (event?.currentMatchNumber ?? 1);
                            if (Number.isFinite(n) && n >= 1) setCurrentMatchMutation.mutate(n);
                          }}
                          disabled={setCurrentMatchMutation.isPending}
                        >
                          {setCurrentMatchMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set"}
                        </Button>
                        <span className="text-xs text-muted-foreground">→ syncs to all clients</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {([1, 2, 3] as const).map((n) => {
                        const r = currentMatchSlots.find((s) => s.slot === `R${n}`);
                        const b = currentMatchSlots.find((s) => s.slot === `B${n}`);
                        return (
                          <div key={n} className="contents">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-bold text-red-500 dark:text-red-400 shrink-0">R{n}</span>
                              <Badge variant="secondary" className="text-xs font-normal truncate max-w-full">{r?.displayName ?? "—"}</Badge>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-bold text-blue-500 dark:text-blue-400 shrink-0">B{n}</span>
                              <Badge variant="secondary" className="text-xs font-normal truncate max-w-full">{b?.displayName ?? "—"}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Up next: Match {currentMatchNum}</p>
                  </div>
                  <div className="border-b pb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">On standby</p>
                    <p className="text-[10px] text-muted-foreground mb-2">Highest rep on bench — grab if someone is missing from the stands.</p>
                    <div className="flex flex-wrap gap-1">
                      {standbyScouters.length > 0 ? (
                        standbyScouters.map((s) => (
                          <Badge key={s.id} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                            {s.displayName}
                            <span className="ml-1 opacity-60">{s.rep}</span>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground italic">None on bench</span>
                      )}
                    </div>
                  </div>
                  <div className="border-b pb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">On break</p>
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                      {onBreakRowsVisible.length > 0 ? (
                        onBreakRowsVisible.map((row) => (
                          <div
                            key={row.requestId}
                            className="group flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-zinc-900/30 px-2 py-1.5"
                          >
                            <Badge variant="outline" className="text-xs font-normal">
                              {row.displayName}
                              {row.reviewedAt ? ` · ${formatDuration(row.reviewedAt)}` : ""}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-2 text-[10px] text-red-400/90 opacity-80 hover:bg-red-500/10 hover:text-red-300 hover:opacity-100"
                              disabled={recallBreakMutation.isPending || eventIsOver}
                              onClick={() => recallBreakMutation.mutate(row.requestId)}
                              title="Recall from break"
                            >
                              <X className="h-3.5 w-3.5 mr-0.5" />
                              Recall
                            </Button>
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground italic">None</span>
                      )}
                    </div>
                  </div>
                  <div className="border-b pb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">On bench (full)</p>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {benchScouters.length > 0 ? (
                        benchScouters.map((s) => (
                          <Badge key={s.id} variant="outline" className="text-xs font-normal">
                            {s.displayName}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground italic">None</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Pending requests</p>
                  {pendingRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No pending requests</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {pendingRequests.map((r) => (
                        <div key={r.id} className="text-sm border rounded p-2 space-y-1">
                          <div>
                            <span className="font-medium">{r.requester?.displayName ?? "?"}</span>
                            <span className="text-muted-foreground">
                              {r.type === "break" ? " requests break" : ` ↔ trade with ${r.targetScouter?.displayName ?? "?"}`}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => approveRequestMutation.mutate({ id: r.id, status: "approved" })}
                              disabled={approveRequestMutation.isPending}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => approveRequestMutation.mutate({ id: r.id, status: "denied" })}
                              disabled={approveRequestMutation.isPending}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {breakCreditsAll.filter((s) => s.breaksUsed > 0).length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Break credits — give back</p>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {breakCreditsAll.filter((s) => s.breaksUsed > 0).map((s) => (
                          <div key={s.scouterId} className="flex items-center justify-between gap-2 text-sm">
                            <span>
                              {s.displayName}
                              <span className="text-muted-foreground ml-1">({s.breaksUsed}/5 used)</span>
                            </span>
                            <div className="flex gap-1 shrink-0">
                              {[1, 2, 3, 4, 5].filter((n) => n <= s.breaksUsed).map((amount) => (
                                <Button
                                  key={amount}
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => giveBackBreaksMutation.mutate({ scouterId: s.scouterId, amount })}
                                  disabled={giveBackBreaksMutation.isPending}
                                >
                                  +{amount}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </CardContent>
              </Card>
          }
        />
      ) : (
        <div className="space-y-3 sm:space-y-4 min-h-0 flex flex-col">
          <Card className="border-2 border-primary/20 bg-card shrink-0">
            <CardHeader className="pb-2 sm:pb-3 px-4 py-3 sm:py-6">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                Request assignment change
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Need a break or want to swap slots? Submit a request—admin will review.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 px-4 pb-4 sm:px-6 sm:pb-6">
              {pendingRequest ? (
                <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="font-medium text-base">
                        {pendingRequest.type === "break" ? "Break requested" : `Trade with ${pendingRequest.targetScouter?.displayName}`}
                      </p>
                      <p className="text-sm text-muted-foreground">Waiting for admin approval</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm px-3 py-1">Pending</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelRequestMutation.mutate(pendingRequest.id)}
                      disabled={cancelRequestMutation.isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border-2 border-border hover:border-primary/30 hover:bg-muted/30 p-5 transition-colors space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Coffee className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base">Request a break</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Take a match off. Admin will unassign you from your next slot. You have {breakCredits?.breaksRemaining ?? 5} of 5 breaks remaining.
                    </p>
                    <Button
                      className="w-full h-11 text-base"
                      variant="outline"
                      onClick={() => createRequestMutation.mutate({ type: "break" })}
                      disabled={createRequestMutation.isPending || (breakCredits?.breaksRemaining ?? 5) <= 0}
                    >
                      {createRequestMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Coffee className="h-5 w-5 mr-2" />
                      )}
                      Request break
                    </Button>
                  </div>
                  <div className="rounded-xl border-2 border-border hover:border-primary/30 hover:bg-muted/30 p-5 transition-colors space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <RefreshCw className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base">Trade positions</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Swap your assignment with another scout. Both must be in the same match.
                    </p>
                    <div className="flex gap-2">
                      <Select value={tradeTargetId} onValueChange={setTradeTargetId}>
                        <SelectTrigger className="h-11 flex-1">
                          <SelectValue placeholder="Select scout..." />
                        </SelectTrigger>
                        <SelectContent>
                          {otherScouters.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.displayName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        className="h-11 px-5 shrink-0"
                        variant="default"
                        onClick={() => {
                          const id = tradeTargetId ? parseInt(tradeTargetId, 10) : undefined;
                          if (!id) {
                            toast({ title: "Select a scouter to trade with", variant: "destructive" });
                            return;
                          }
                          createRequestMutation.mutate({ type: "trade", targetScouterId: id });
                        }}
                        disabled={createRequestMutation.isPending || !tradeTargetId}
                      >
                        {createRequestMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          "Request"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        <Card className="flex-1 min-w-0 min-h-0 flex flex-col">
          <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
            <div className="overflow-auto min-h-0 max-h-[calc(100dvh-340px)] sm:max-h-none">
              <Table className="border-collapse min-w-[320px] sm:min-w-0">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sm:w-16 font-bold text-xs sm:text-base">M</TableHead>
                    {scoutSlots.map((s) => (
                      <TableHead
                        key={s}
                        className={`text-center font-bold text-xs sm:text-base ${s.startsWith("R") ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`}
                      >
                        {s}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduleWithSlots.map(({ match, slots }, rowIdx) => {
                    const isMatchDone = (match.winningAlliance != null && String(match.winningAlliance).trim() !== "") ||
                      (match.redScore != null && match.blueScore != null);
                    const allRedScouted = slots[0].hasScouted && slots[1].hasScouted && slots[2].hasScouted;
                    const allBlueScouted = slots[3].hasScouted && slots[4].hasScouted && slots[5].hasScouted;
                    const prevRowSlots = scheduleWithSlots[rowIdx - 1]?.slots;
                    const nextRowSlots = scheduleWithSlots[rowIdx + 1]?.slots;
                    const hideBottomBorder = nextRowSlots && slots.some((s, idx) => {
                      const iOutline = s.scouterId === user?.id && !s.hasScouted;
                      const nextOutline = nextRowSlots[idx].scouterId === user?.id && !nextRowSlots[idx].hasScouted;
                      return iOutline && nextOutline;
                    });
                    const isUpToCurrentMatch = match.matchNumber <= currentMatchNum;
                    return (
                      <TableRow key={match.matchNumber} className={hideBottomBorder ? "border-b-0" : undefined}>
                        <TableCell
                          className={`font-bold text-xs sm:text-base w-10 sm:w-16 ${isUpToCurrentMatch ? "border-l-4 border-l-red-500" : ""}`}
                        >
                          Q{match.matchNumber}
                        </TableCell>
                        {slots.map((s, idx) => {
                          const isMy = s.scouterId === user?.id;
                          const hasOutline = isMy && !s.hasScouted;
                          const prevOutline = idx > 0 && slots[idx - 1].scouterId === user?.id && !slots[idx - 1].hasScouted;
                          const nextOutline = idx < slots.length - 1 && slots[idx + 1].scouterId === user?.id && !slots[idx + 1].hasScouted;
                          const prevRowOutline = prevRowSlots && prevRowSlots[idx].scouterId === user?.id && !prevRowSlots[idx].hasScouted;
                          const nextRowOutline = nextRowSlots && nextRowSlots[idx].scouterId === user?.id && !nextRowSlots[idx].hasScouted;
                          const missed = isMatchDone && !s.hasScouted;
                          return (
                            <ScheduleCell
                              key={s.slot}
                              slot={s.slot}
                              assignedScout={s.assignedScout}
                              hasScouted={s.hasScouted}
                              edgeClassName={isUpToCurrentMatch && idx === slots.length - 1 ? "border-r-4 border-r-blue-500" : undefined}
                              allianceFullyScouted={s.slot.startsWith("R") ? allRedScouted : allBlueScouted}
                              isMySlot={isMy}
                              mergeWithPrev={hasOutline && prevOutline}
                              mergeWithNext={hasOutline && nextOutline}
                              mergeWithPrevRow={hasOutline && prevRowOutline}
                              mergeWithNextRow={hasOutline && nextRowOutline}
                              missed={isMy && missed}
                            />
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}
