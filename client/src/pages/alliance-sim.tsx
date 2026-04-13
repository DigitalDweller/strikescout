import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCorners,
  MeasuringStrategy,
  useDroppable,
  useDraggable,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useHelp } from "@/contexts/help-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Event, Team, EventTeam } from "@shared/schema";
import type { AllianceSimPick } from "@shared/alliance-sim";
import {
  ALLIANCE_SIM_CAPTAINS,
  allianceSimMaxPicks,
  normalizePicks,
  normalizeCaptainRobots,
  partnerSlotCountFromEvent,
  type AllianceSimPartnerSlotCount,
  sortPicksCanonical,
  picksToMatrix,
  matrixToPicks,
  partnersByCaptain,
  pickedTeamIds,
} from "@shared/alliance-sim";
import { ArrowLeft, Swords, RotateCcw, Trash2, Search, Plus, GripVertical } from "lucide-react";

const DROP_POOL_ID = "drop-pool";

/** Verbose alliance-sim logs: Vite dev, `?allianceDebug=1`, `localStorage.allianceSimDebug=1`, or `window.__ALLIANCE_SIM_DEBUG__ = true`. */
function allianceSimDebugEnabled(): boolean {
  if (typeof window === "undefined") return Boolean(import.meta.env?.DEV);
  try {
    if ((window as unknown as { __ALLIANCE_SIM_DEBUG__?: boolean }).__ALLIANCE_SIM_DEBUG__) return true;
    if (window.localStorage?.getItem("allianceSimDebug") === "1") return true;
    if (new URLSearchParams(window.location.search).get("allianceDebug") === "1") return true;
  } catch {
    /* ignore */
  }
  return Boolean(import.meta.env?.DEV);
}

function asimLog(...args: unknown[]) {
  if (allianceSimDebugEnabled()) console.log("[AllianceSim]", ...args);
}

function asimWarn(...args: unknown[]) {
  if (allianceSimDebugEnabled()) console.warn("[AllianceSim]", ...args);
}

let lastMoveLog = 0;
function asimLogMoveThrottled(payload: Record<string, unknown>) {
  if (!allianceSimDebugEnabled()) return;
  const now = Date.now();
  if (now - lastMoveLog < 250) return;
  lastMoveLog = now;
  console.log("[AllianceSim][dragMove]", payload);
}

let lastCollisionLog = 0;
function asimLogCollisionThrottled(kind: string, payload: Record<string, unknown>) {
  if (!allianceSimDebugEnabled()) return;
  const now = Date.now();
  if (now - lastCollisionLog < 400) return;
  lastCollisionLog = now;
  console.log("[AllianceSim][collision]", kind, payload);
}

function dropSlotId(captainSlot: number, partnerIndex: number) {
  return `drop-slot-${captainSlot}-${partnerIndex}`;
}

type ActiveDragData =
  | { from: "pool"; teamId: number }
  | { from: "slot"; captainSlot: number; partnerIndex: number; teamId: number };

function applyDragToPicks(
  picks: AllianceSimPick[],
  active: ActiveDragData,
  overId: string | null,
  partnerSlots: AllianceSimPartnerSlotCount,
): AllianceSimPick[] | null {
  if (!overId) return null;
  const mat = picksToMatrix(normalizePicks(picks, partnerSlots), partnerSlots);

  if (overId === DROP_POOL_ID) {
    if (active.from !== "slot") return null;
    mat[active.captainSlot - 1][active.partnerIndex] = null;
    return matrixToPicks(mat, partnerSlots);
  }

  if (!overId.startsWith("drop-slot-")) return null;
  const rest = overId.slice("drop-slot-".length);
  const dash = rest.lastIndexOf("-");
  if (dash < 1) return null;
  const tc = parseInt(rest.slice(0, dash), 10);
  const tp = parseInt(rest.slice(dash + 1), 10);
  if (!Number.isFinite(tc) || tc < 1 || tc > ALLIANCE_SIM_CAPTAINS || !Number.isFinite(tp) || tp < 0 || tp >= partnerSlots)
    return null;

  if (active.from === "pool") {
    for (let i = 0; i < ALLIANCE_SIM_CAPTAINS; i++) {
      for (let p = 0; p < partnerSlots; p++) {
        if (mat[i][p] === active.teamId) mat[i][p] = null;
      }
    }
    mat[tc - 1][tp] = active.teamId;
    return matrixToPicks(mat, partnerSlots);
  }

  if (active.from === "slot") {
    const { captainSlot: sc, partnerIndex: sp, teamId: st } = active;
    if (sc === tc && sp === tp) return null;
    const targetTeam = mat[tc - 1][tp];
    mat[tc - 1][tp] = st;
    mat[sc - 1][sp] = targetTeam;
    return matrixToPicks(mat, partnerSlots);
  }

  return null;
}

function samePickSets(a: AllianceSimPick[], b: AllianceSimPick[], partnerSlots: AllianceSimPartnerSlotCount) {
  return (
    JSON.stringify(sortPicksCanonical(normalizePicks(a, partnerSlots))) ===
    JSON.stringify(sortPicksCanonical(normalizePicks(b, partnerSlots)))
  );
}

/** dnd-kit often reports the inner draggable id as `over` when dropping onto a filled slot; map to the droppable id. */
function normalizeDropTargetId(overId: string | null, active: ActiveDragData): string | null {
  if (overId == null) return null;
  if (overId.startsWith("drag-slot-")) return `drop-slot-${overId.slice("drag-slot-".length)}`;
  if (active.from === "slot" && overId.startsWith("drag-pool-")) return DROP_POOL_ID;
  return overId;
}

/** Prefer pointer position (works for empty cells); overlay + small slots fall back to closest corners. */
const allianceSimCollision: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  if (byPointer.length > 0) {
    if (args.active?.id != null) {
      asimLogCollisionThrottled("pointerWithin", {
        activeId: args.active.id,
        hits: byPointer.map((c) => String(c.id)),
        pointer: args.pointerCoordinates,
      });
    }
    return byPointer;
  }
  const byCorners = closestCorners(args);
  if (args.active?.id != null) {
    asimLogCollisionThrottled("closestCorners", {
      activeId: args.active.id,
      topCorners: byCorners.slice(0, 5).map((c) => ({ id: String(c.id), dist: c.data?.value })),
      pointer: args.pointerCoordinates,
    });
  }
  return byCorners;
};

type SimSessionSummary = {
  id: number;
  eventId: number;
  name: string;
  partnerSlots: AllianceSimPartnerSlotCount;
  pickCount: number;
  isComplete: boolean;
  updatedAt: string;
};

type SimSessionDetail = SimSessionSummary & {
  picks: AllianceSimPick[];
  captainRobots: string[];
  partnersByCaptain: Record<string, (number | null)[]>;
  createdAt: string;
};

type EventTeamWithTeam = EventTeam & { team: Team };

const ALLIANCE_SIM_HELP = {
  title: "Alliance selection simulator",
  body: (
    <>
      <p>
        Build alliances by <strong>dragging</strong> teams from the pool into partner slots (any order). Drag a placed
        team onto another slot to swap, or onto the pool to remove it.
      </p>
      <p>
        Optional captain labels and a third partner slot are configured in <strong>Event settings</strong>. Use{" "}
        <strong>Reset draft</strong> to clear placements.
      </p>
    </>
  ),
};

function teamByIdMap(teams: EventTeamWithTeam[]): Map<number, Team> {
  const m = new Map<number, Team>();
  for (const et of teams) m.set(et.teamId, et.team);
  return m;
}

function PoolTeamChip({ teamId, team }: { teamId: number; team: Team }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-pool-${teamId}`,
    data: { from: "pool" as const, teamId },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex min-w-0 cursor-grab touch-none items-start gap-2 rounded-lg border bg-card px-2.5 py-2.5 text-left shadow-sm active:cursor-grabbing sm:gap-2.5 sm:px-3 sm:py-3",
        isDragging && "opacity-40",
      )}
    >
      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-base font-semibold tabular-nums leading-none sm:text-lg">{team.teamNumber}</div>
        <div className="line-clamp-2 text-sm leading-snug text-muted-foreground sm:text-[0.9375rem]">{team.teamName}</div>
      </div>
    </div>
  );
}

/** Filled slot: one surface — droppable + draggable share the same node (no inner “pill”). */
function PartnerSlotFilled({
  captainSlot,
  partnerIndex,
  teamId,
  team,
}: {
  captainSlot: number;
  partnerIndex: number;
  teamId: number;
  team: Team;
}) {
  const dropId = dropSlotId(captainSlot, partnerIndex);
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: dropId,
    data: { captainSlot, partnerIndex },
  });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-slot-${captainSlot}-${partnerIndex}`,
    data: { from: "slot" as const, captainSlot, partnerIndex, teamId },
  });
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDropRef(node);
      setDragRef(node);
    },
    [setDropRef, setDragRef],
  );

  return (
    <div
      ref={mergedRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex h-full min-h-[5.5rem] cursor-grab touch-none flex-col rounded-md border border-border/70 bg-muted/55 px-2 py-2 dark:bg-muted/40 active:cursor-grabbing sm:min-h-[5.75rem] sm:px-2.5 sm:py-2.5",
        isOver && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        isDragging && "opacity-40",
      )}
    >
      <div className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
        P{partnerIndex + 1}
      </div>
      <div className="flex min-h-0 flex-1 items-stretch gap-2 overflow-hidden pt-1.5">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/90" aria-hidden />
        <div className="flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center gap-1">
          <span className="truncate text-base font-bold tabular-nums leading-none text-foreground sm:text-lg">
            {team.teamNumber}
          </span>
          <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-snug text-foreground/85 sm:text-sm">{team.teamName}</p>
        </div>
      </div>
    </div>
  );
}

function PartnerSlotEmpty({ captainSlot, partnerIndex }: { captainSlot: number; partnerIndex: number }) {
  const dropId = dropSlotId(captainSlot, partnerIndex);
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: dropId,
    data: { captainSlot, partnerIndex },
  });

  return (
    <div
      ref={setDropRef}
      className={cn(
        "flex h-full min-h-[5.5rem] flex-col rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 px-2 py-2 sm:min-h-[5.75rem] sm:px-2.5 sm:py-2.5",
        isOver && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
        P{partnerIndex + 1}
      </div>
      <div className="flex flex-1 items-center justify-center px-1 text-center text-xs text-muted-foreground sm:text-sm">
        Drop here
      </div>
    </div>
  );
}

function PartnerSlot({
  captainSlot,
  partnerIndex,
  teamId,
  team,
}: {
  captainSlot: number;
  partnerIndex: number;
  teamId: number | null;
  team: Team | undefined;
}) {
  if (teamId != null && team) {
    return <PartnerSlotFilled captainSlot={captainSlot} partnerIndex={partnerIndex} teamId={teamId} team={team} />;
  }
  return <PartnerSlotEmpty captainSlot={captainSlot} partnerIndex={partnerIndex} />;
}

function PoolDropShell({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_POOL_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[120px] flex-1 flex-col rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-2.5 sm:min-h-[140px] sm:p-3",
        isOver && "border-primary bg-primary/5",
      )}
    >
      {children}
    </div>
  );
}

export default function AllianceSimPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const help = useHelp();
  const [sessionId, setSessionId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search).get("session");
    if (!q) return null;
    const n = parseInt(q, 10);
    return Number.isFinite(n) ? n : null;
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [overlayTeam, setOverlayTeam] = useState<Team | null>(null);
  const [captainsDraft, setCaptainsDraft] = useState<string[]>(() => normalizeCaptainRobots([]));
  const captainSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    if (!eventId) return;
    if (!sessionId || !Number.isFinite(sessionId)) {
      if (typeof window !== "undefined" && window.location.search) {
        setLocation(`/events/${eventId}/alliance-sim`, { replace: true });
      }
      return;
    }
    const want = `?session=${sessionId}`;
    if (typeof window !== "undefined" && window.location.search !== want) {
      setLocation(`/events/${eventId}/alliance-sim${want}`, { replace: true });
    }
  }, [eventId, sessionId, setLocation]);

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SimSessionSummary[]>({
    queryKey: ["/api/events", eventId, "alliance-sim", "sessions"],
    enabled: !!eventId,
  });

  const sessionQueryKey = ["/api/events", eventId, "alliance-sim", "sessions", sessionId] as const;

  const { data: session, isLoading: sessionLoading } = useQuery<SimSessionDetail>({
    queryKey: ["/api/events", eventId, "alliance-sim", "sessions", sessionId],
    enabled: !!eventId && !!sessionId,
  });

  const { data: eventTeams = [] } = useQuery<EventTeamWithTeam[]>({
    queryKey: ["/api/events", eventId, "teams"],
    enabled: !!eventId,
  });

  const teamMap = useMemo(() => teamByIdMap(eventTeams), [eventTeams]);

  const remainingTeams = useMemo(() => {
    if (!session) return [];
    const taken = pickedTeamIds(normalizePicks(session.picks, session.partnerSlots));
    let list = eventTeams.filter((et) => !taken.has(et.teamId));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (et) => et.team.teamNumber.toString().includes(q) || et.team.teamName.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.team.teamNumber - b.team.teamNumber);
  }, [session, eventTeams, search]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/alliance-sim/sessions`, {
        name: newName.trim() || "Alliance sim",
      });
      return (await res.json()) as SimSessionDetail;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "alliance-sim", "sessions"] });
      setCreateOpen(false);
      setNewName("");
      setSessionId(created.id);
      setLocation(`/events/${eventId}/alliance-sim?session=${created.id}`, { replace: true });
      queryClient.setQueryData(["/api/events", eventId, "alliance-sim", "sessions", created.id], created);
      toast({ title: "Simulation created" });
    },
    onError: (e: Error) => toast({ title: "Could not create", description: e.message, variant: "destructive" }),
  });

  const patchPicksMutation = useMutation({
    mutationFn: async (picks: AllianceSimPick[]) => {
      const url = `/api/events/${eventId}/alliance-sim/sessions/${sessionId}`;
      const prevSnap = queryClient.getQueryData<SimSessionDetail>(sessionQueryKey);
      const ps = prevSnap?.partnerSlots ?? partnerSlotCountFromEvent(event ?? {});
      const norm = sortPicksCanonical(normalizePicks(picks, ps));
      asimLog("[PATCH] mutationFn start", {
        url,
        eventId,
        sessionId,
        pickCount: norm.length,
        picks: norm,
      });
      const res = await apiRequest("PATCH", url, { picks: norm });
      const json = (await res.json()) as SimSessionDetail;
      asimLog("[PATCH] mutationFn ok", { status: res.status, responsePickCount: json.pickCount, picks: json.picks });
      return json;
    },
    onMutate: async (picks) => {
      asimLog("[PATCH] onMutate optimistic", { picks });
      await queryClient.cancelQueries({ queryKey: sessionQueryKey });
      const prev = queryClient.getQueryData<SimSessionDetail>(sessionQueryKey);
      if (prev) {
        const norm = normalizePicks(picks, prev.partnerSlots);
        const maxP = allianceSimMaxPicks(prev.partnerSlots);
        queryClient.setQueryData(sessionQueryKey, {
          ...prev,
          picks: norm,
          pickCount: norm.length,
          isComplete: norm.length >= maxP,
          partnersByCaptain: partnersByCaptain(norm, prev.partnerSlots),
        });
      } else {
        asimWarn("[PATCH] onMutate: no previous session in cache", { sessionQueryKey });
      }
      return { prev };
    },
    onError: (e: Error, picks, ctx) => {
      asimWarn("[PATCH] onError", {
        message: e.message,
        stack: e.stack,
        attemptedPicks: picks,
        hadPrev: !!ctx?.prev,
      });
      if (ctx?.prev) queryClient.setQueryData(sessionQueryKey, ctx.prev);
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
    onSuccess: (data) => {
      asimLog("[PATCH] onSuccess", { id: data.id, pickCount: data.pickCount, picks: data.picks });
      queryClient.setQueryData(sessionQueryKey, data);
      queryClient.invalidateQueries({
        queryKey: ["/api/events", eventId, "alliance-sim", "sessions"],
        exact: true,
      });
    },
  });

  const patchCaptainsMutation = useMutation({
    mutationFn: async (captainRobots: string[]) => {
      const url = `/api/events/${eventId}/alliance-sim/sessions/${sessionId}`;
      const res = await apiRequest("PATCH", url, { captainRobots: normalizeCaptainRobots(captainRobots) });
      return (await res.json()) as SimSessionDetail;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(sessionQueryKey, data);
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "alliance-sim", "sessions"], exact: true });
    },
    onError: (e: Error) => toast({ title: "Could not save captains", description: e.message, variant: "destructive" }),
  });

  const scheduleCaptainSave = useCallback(
    (next: string[]) => {
      if (captainSaveTimer.current) clearTimeout(captainSaveTimer.current);
      captainSaveTimer.current = setTimeout(() => {
        patchCaptainsMutation.mutate(normalizeCaptainRobots(next));
      }, 450);
    },
    [patchCaptainsMutation],
  );

  useEffect(() => {
    if (!session) return;
    setCaptainsDraft(normalizeCaptainRobots(session.captainRobots));
  }, [session?.id]);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/alliance-sim/sessions/${sessionId}/reset`, {});
      return (await res.json()) as SimSessionDetail;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(sessionQueryKey, data);
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "alliance-sim", "sessions"] });
      toast({ title: "Draft reset" });
    },
    onError: (e: Error) => toast({ title: "Reset failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sid: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}/alliance-sim/sessions/${sid}`);
    },
    onSuccess: (_, sid) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "alliance-sim", "sessions"] });
      if (sessionId === sid) {
        setSessionId(null);
        setLocation(`/events/${eventId}/alliance-sim`, { replace: true });
      }
      setDeleteId(null);
      toast({ title: "Simulation deleted" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const openSession = useCallback(
    (sid: number) => {
      setSessionId(sid);
      setLocation(`/events/${eventId}/alliance-sim?session=${sid}`, { replace: true });
    },
    [eventId, setLocation],
  );

  const backToList = useCallback(() => {
    setSessionId(null);
    setLocation(`/events/${eventId}/alliance-sim`, { replace: true });
  }, [eventId, setLocation]);

  const handleDragStart = useCallback(
    (ev: DragStartEvent) => {
      const d = ev.active.data.current as Partial<ActiveDragData> | undefined;
      asimLog("[dragStart]", { activeId: ev.active.id, data: d });
      if (d?.from === "pool" && typeof d.teamId === "number") {
        setOverlayTeam(teamMap.get(d.teamId) ?? null);
        return;
      }
      if (d?.from === "slot" && typeof d.teamId === "number") {
        setOverlayTeam(teamMap.get(d.teamId) ?? null);
        return;
      }
      setOverlayTeam(null);
    },
    [teamMap],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setOverlayTeam(null);
      const { active, over } = event;
      const rawOver = over?.id != null ? String(over.id) : null;
      const activeData = active.data.current as ActiveDragData | undefined;
      asimLog("[dragEnd] raw", {
        activeId: active.id,
        activeData,
        overId: rawOver,
        delta: event.delta,
      });
      if (!session) {
        asimWarn("[dragEnd] abort: no session in scope");
        return;
      }
      if (!activeData || !("from" in activeData)) {
        asimWarn("[dragEnd] abort: missing activeData.from", { activeData });
        return;
      }
      const overId = normalizeDropTargetId(rawOver, activeData);
      asimLog("[dragEnd] normalized over", { overId, currentPicks: session.picks });
      const ps = session.partnerSlots;
      const next = applyDragToPicks(session.picks, activeData, overId, ps);
      if (next == null) {
        asimWarn("[dragEnd] abort: applyDragToPicks returned null (no-op or invalid target)", {
          overId,
          activeData,
        });
        return;
      }
      const nextNorm = sortPicksCanonical(normalizePicks(next, ps));
      if (samePickSets(session.picks, nextNorm, ps)) {
        asimLog("[dragEnd] skip PATCH: pick set unchanged", { nextNorm });
        return;
      }
      asimLog("[dragEnd] calling PATCH", { nextNorm });
      patchPicksMutation.mutate(nextNorm);
    },
    [session, patchPicksMutation],
  );

  useEffect(() => {
    if (!allianceSimDebugEnabled()) return;
    asimLog(
      "[debug] logging on — client: Vite dev or ?allianceDebug=1 or localStorage.allianceSimDebug=1 or window.__ALLIANCE_SIM_DEBUG__=true | server: set ALLIANCE_SIM_DEBUG=1 when starting dev",
    );
  }, []);

  useEffect(() => {
    if (!allianceSimDebugEnabled()) return;
    asimLog("[route]", { eventId, sessionId });
  }, [eventId, sessionId]);

  useEffect(() => {
    if (!allianceSimDebugEnabled()) return;
    if (!sessionId) return;
    asimLog("[query session]", {
      sessionLoading,
      hasData: !!session,
      pickCount: session?.pickCount,
      isComplete: session?.isComplete,
      picks: session?.picks,
    });
  }, [sessionId, sessionLoading, session]);

  useEffect(() => {
    if (!allianceSimDebugEnabled()) return;
    asimLog("[query eventTeams]", {
      count: eventTeams.length,
      teamIds: eventTeams.slice(0, 24).map((et) => et.teamId),
    });
  }, [eventTeams]);

  const handleDragMove = useCallback((e: DragMoveEvent) => {
    asimLogMoveThrottled({
      activeId: e.active?.id,
      overId: e.over?.id,
      delta: e.delta,
    });
  }, []);

  if (!eventId) {
    return <div className="p-6 text-muted-foreground">Invalid event.</div>;
  }

  /* ——— List hub ——— */
  if (!sessionId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Swords className="h-7 w-7 text-primary" />
              Alliance sim
              {help?.HelpTrigger?.({ content: ALLIANCE_SIM_HELP, className: "ml-1" })}
            </h1>
            <p className="text-muted-foreground mt-1">{event?.name ?? "Event"} — practice alliance selection</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCreateOpen(true)} data-testid="button-new-alliance-sim">
              <Plus className="h-4 w-4 mr-2" />
              New simulation
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/events/${eventId}/picklists`}>Picklists</Link>
            </Button>
          </div>
        </div>

        {sessionsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : sessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>No saved simulations yet.</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                Start one
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((s) => (
              <Card
                key={s.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => openSession(s.id)}
                data-testid={`card-alliance-sim-${s.id}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <CardDescription>
                    {s.pickCount}/{allianceSimMaxPicks(s.partnerSlots)} placements
                    {s.isComplete ? " · Complete" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-between text-xs text-muted-foreground">
                  <span>Updated {new Date(s.updatedAt).toLocaleString()}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New alliance simulation</DialogTitle>
              <DialogDescription>
                Drag teams into partner slots in any order. Captain labels and a third partner slot (worlds-style) are
                configured in Event settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-testid="input-alliance-sim-name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                data-testid="button-create-alliance-sim"
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this simulation?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId != null && deleteMutation.mutate(deleteId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  /* ——— Active session ——— */
  if (sessionLoading || !session) {
    return (
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={allianceSimCollision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="mx-auto max-w-[1600px] space-y-3 overflow-x-hidden px-3 py-3 pb-16 sm:px-4 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-8" onClick={backToList}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              All simulations
            </Button>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2 sm:text-xl">
              <Swords className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
              <span className="truncate">{session.name}</span>
              {help?.HelpTrigger?.({ content: ALLIANCE_SIM_HELP, className: "shrink-0" })}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {event?.name} · {session.pickCount}/{allianceSimMaxPicks(session.partnerSlots)} placements
              {session.isComplete ? " · Complete" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={!session.pickCount || resetMutation.isPending}
              data-testid="button-alliance-sim-reset"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset draft
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteId(session.id)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-1.5 pb-3 pt-4 sm:pt-5">
            <CardTitle className="text-base sm:text-lg">Draft board</CardTitle>
            <CardDescription className="text-sm leading-relaxed sm:text-[0.9375rem]">
              Eight alliances in columns. Rows align across the board — enter captain numbers in the Capt row, then drag
              partners into P1
              {session.partnerSlots === 3 ? " / P2 / P3" : " / P2"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-0 sm:px-5 sm:pb-5">
            <div className="w-full overflow-x-hidden">
              {(() => {
                const ps = session.partnerSlots;
                const slots = Array.from({ length: ALLIANCE_SIM_CAPTAINS }, (_, i) => i + 1);
                const emptyTuple = () => Array.from({ length: ps }, () => null as number | null);
                return (
                  <div
                    className="grid w-full grid-cols-8 gap-x-1 gap-y-2 text-[clamp(10px,2vw,13px)] leading-snug sm:gap-x-1.5 sm:gap-y-2.5"
                    data-testid="alliance-draft-grid"
                  >
                    {slots.map((slot) => (
                      <div
                        key={`hdr-${slot}`}
                        className="flex min-w-0 items-end justify-center border-b border-border/50 pb-1"
                        data-testid={`alliance-column-${slot}`}
                      >
                        <span className="truncate text-center text-xs font-bold tabular-nums sm:text-sm">#{slot}</span>
                      </div>
                    ))}
                    {slots.map((slot) => (
                      <div key={`capt-${slot}`} className="min-w-0">
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                          Capt
                        </span>
                        <Input
                          className="h-8 px-1.5 text-center text-xs tabular-nums sm:h-9 sm:text-sm"
                          value={captainsDraft[slot - 1] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.slice(0, 32);
                            const next = [...captainsDraft];
                            while (next.length < ALLIANCE_SIM_CAPTAINS) next.push("");
                            next[slot - 1] = v;
                            setCaptainsDraft(next);
                            scheduleCaptainSave(next);
                          }}
                          placeholder="—"
                          aria-label={`Captain slot ${slot}`}
                          data-testid={`input-alliance-captain-${slot}`}
                        />
                      </div>
                    ))}
                    {slots.map((slot) => {
                      const tuple = session.partnersByCaptain[String(slot)] ?? emptyTuple();
                      return (
                        <div key={`p1-${slot}`} className="flex min-h-0 min-w-0">
                          <PartnerSlot
                            captainSlot={slot}
                            partnerIndex={0}
                            teamId={tuple[0] ?? null}
                            team={tuple[0] != null ? teamMap.get(tuple[0]) : undefined}
                          />
                        </div>
                      );
                    })}
                    {slots.map((slot) => {
                      const tuple = session.partnersByCaptain[String(slot)] ?? emptyTuple();
                      return (
                        <div key={`p2-${slot}`} className="flex min-h-0 min-w-0">
                          <PartnerSlot
                            captainSlot={slot}
                            partnerIndex={1}
                            teamId={tuple[1] ?? null}
                            team={tuple[1] != null ? teamMap.get(tuple[1]) : undefined}
                          />
                        </div>
                      );
                    })}
                    {ps === 3
                      ? slots.map((slot) => {
                          const tuple = session.partnersByCaptain[String(slot)] ?? emptyTuple();
                          return (
                            <div key={`p3-${slot}`} className="flex min-h-0 min-w-0">
                              <PartnerSlot
                                captainSlot={slot}
                                partnerIndex={2}
                                teamId={tuple[2] ?? null}
                                team={tuple[2] != null ? teamMap.get(tuple[2]) : undefined}
                              />
                            </div>
                          );
                        })
                      : null}
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col">
          <CardHeader className="shrink-0 space-y-3 pb-3">
            <CardTitle className="text-base sm:text-lg">Remaining teams</CardTitle>
            <CardDescription className="text-sm leading-relaxed sm:text-[0.9375rem]">
              Drag into a partner slot, or onto the dashed pool area to return a slot pick to the pool.
            </CardDescription>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9 text-sm"
                placeholder="Search number or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-5">
            <PoolDropShell>
              <div className="flex max-h-[min(42vh,420px)] flex-wrap content-start gap-2.5 overflow-y-auto p-0.5 custom-scrollbar sm:gap-3">
                {remainingTeams.map((et) => (
                  <div
                    key={et.teamId}
                    className="w-[calc(50%-0.25rem)] min-w-0 sm:w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.45rem)] lg:w-[calc(20%-0.4rem)]"
                    data-testid={`button-draft-team-${et.teamId}`}
                  >
                    <PoolTeamChip teamId={et.teamId} team={et.team} />
                  </div>
                ))}
                {remainingTeams.length === 0 && (
                  <p className="w-full py-6 text-center text-sm text-muted-foreground">No teams left in the pool.</p>
                )}
              </div>
            </PoolDropShell>
          </CardContent>
        </Card>

        <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this simulation?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId != null && deleteMutation.mutate(deleteId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <DragOverlay dropAnimation={null}>
        {overlayTeam ? (
          <div className="flex max-w-[min(90vw,280px)] cursor-grabbing items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-lg">
            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 space-y-1">
              <div className="text-lg font-bold tabular-nums leading-none">{overlayTeam.teamNumber}</div>
              <div className="line-clamp-2 text-sm leading-snug text-muted-foreground">{overlayTeam.teamName}</div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
