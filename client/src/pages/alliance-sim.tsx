import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ArrowLeft, Swords, RotateCcw, Trash2, Plus } from "lucide-react";

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

function samePickSets(a: AllianceSimPick[], b: AllianceSimPick[], partnerSlots: AllianceSimPartnerSlotCount) {
  return (
    JSON.stringify(sortPicksCanonical(normalizePicks(a, partnerSlots))) ===
    JSON.stringify(sortPicksCanonical(normalizePicks(b, partnerSlots)))
  );
}

function formatUpdatedAtShort(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Updated recently";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(sec) < 60) return `Updated ${rtf.format(-sec, "second")}`;
  if (Math.abs(min) < 60) return `Updated ${rtf.format(-min, "minute")}`;
  if (Math.abs(hr) < 24) return `Updated ${rtf.format(-hr, "hour")}`;
  return `Updated ${rtf.format(-day, "day")}`;
}

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
type PicklistSummary = {
  id: number;
  eventId: number;
  name: string;
  adminOnly?: boolean | null;
  entryCount: number;
};
type PicklistEntryWithTeam = {
  id: number;
  picklistId: number;
  teamId: number;
  rank: number;
  tier: string;
  team: Team;
};

const ALLIANCE_SIM_HELP = {
  title: "Alliance selection simulator",
  body: (
    <>
      <p>Drag teams from the pool into slots. Drag to swap/remove.</p>
      <p>
        Use <strong>Reset draft</strong> to clear placements.
      </p>
    </>
  ),
};

function teamByIdMap(teams: EventTeamWithTeam[]): Map<number, Team> {
  const m = new Map<number, Team>();
  for (const et of teams) m.set(et.teamId, et.team);
  return m;
}

function normalizeTeamNumberDraft(v: string): string {
  return v.replace(/[^\d]/g, "").slice(0, 5);
}

function isNonEmptyDraft(v: string | null | undefined): v is string {
  return !!v && v.trim().length > 0;
}

function parseDraftTeamNumber(raw: string): number | null {
  const v = normalizeTeamNumberDraft(raw);
  if (!isNonEmptyDraft(v)) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function duplicateTeamNumbersFromDraft({
  captainsDraft,
  picksDraft,
  partnerSlots,
  attendingTeamNumbers,
}: {
  captainsDraft: string[];
  picksDraft: string[][];
  partnerSlots: AllianceSimPartnerSlotCount;
  attendingTeamNumbers: Set<number>;
}): Set<number> {
  const counts = new Map<number, number>();
  for (let i = 0; i < ALLIANCE_SIM_CAPTAINS; i++) {
    const n = parseDraftTeamNumber(captainsDraft?.[i] ?? "");
    if (n != null && attendingTeamNumbers.has(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  for (let c = 0; c < ALLIANCE_SIM_CAPTAINS; c++) {
    for (let p = 0; p < partnerSlots; p++) {
      const n = parseDraftTeamNumber(picksDraft?.[c]?.[p] ?? "");
      if (n != null && attendingTeamNumbers.has(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }
  const dupes = new Set<number>();
  for (const [n, ct] of counts.entries()) if (ct >= 2) dupes.add(n);
  return dupes;
}

function createEmptyDraftMatrix(partnerSlots: AllianceSimPartnerSlotCount): string[][] {
  return Array.from({ length: ALLIANCE_SIM_CAPTAINS }, () => Array.from({ length: partnerSlots }, () => ""));
}

function draftFromPicks(picks: AllianceSimPick[], partnerSlots: AllianceSimPartnerSlotCount, teamMap: Map<number, Team>): string[][] {
  const matIds = picksToMatrix(normalizePicks(picks, partnerSlots), partnerSlots);
  return matIds.map((row) =>
    row.map((teamId) => {
      if (teamId == null) return "";
      const t = teamMap.get(teamId);
      return t ? String(t.teamNumber) : "";
    }),
  );
}

function matrixToPicksFromDraft(
  draft: string[][],
  partnerSlots: AllianceSimPartnerSlotCount,
  teamIdByNumber: Map<number, number>,
): { picks: AllianceSimPick[]; hasInvalid: boolean } {
  const mat: (number | null)[][] = Array.from({ length: ALLIANCE_SIM_CAPTAINS }, () =>
    Array.from({ length: partnerSlots }, () => null as number | null),
  );
  let hasInvalid = false;
  for (let c = 0; c < ALLIANCE_SIM_CAPTAINS; c++) {
    for (let p = 0; p < partnerSlots; p++) {
      const raw = draft?.[c]?.[p] ?? "";
      const v = normalizeTeamNumberDraft(raw);
      if (!isNonEmptyDraft(v)) {
        mat[c][p] = null;
        continue;
      }
      const n = parseInt(v, 10);
      const teamId = teamIdByNumber.get(n);
      if (teamId == null) {
        hasInvalid = true;
        mat[c][p] = null;
        continue;
      }
      mat[c][p] = teamId;
    }
  }
  return { picks: sortPicksCanonical(normalizePicks(matrixToPicks(mat, partnerSlots), partnerSlots)), hasInvalid };
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
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [captainsDraft, setCaptainsDraft] = useState<string[]>(() => normalizeCaptainRobots([]));
  const captainSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const picksSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [picksDraft, setPicksDraft] = useState<string[][]>(() => createEmptyDraftMatrix(2));
  const [selectedPicklistId, setSelectedPicklistId] = useState<string>("none");

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

  const { data: picklists = [] } = useQuery<PicklistSummary[]>({
    queryKey: ["/api/events", eventId, "picklists"],
    enabled: !!eventId,
  });

  const picklistIdNum = selectedPicklistId !== "none" ? parseInt(selectedPicklistId, 10) : null;
  const { data: picklistEntries = [] } = useQuery<PicklistEntryWithTeam[]>({
    queryKey: picklistIdNum ? ["/api/events", eventId, "picklists", picklistIdNum, "entries"] : ["picklist-entries-disabled"],
    enabled: !!eventId && !!picklistIdNum,
  });

  const teamMap = useMemo(() => teamByIdMap(eventTeams), [eventTeams]);
  const teamIdByNumber = useMemo(() => {
    const m = new Map<number, number>();
    for (const et of eventTeams) m.set(et.team.teamNumber, et.teamId);
    return m;
  }, [eventTeams]);
  const attendingTeamNumbers = useMemo(() => new Set<number>(teamIdByNumber.keys()), [teamIdByNumber]);
  const duplicateTeamNumbers = useMemo(
    () =>
      session
        ? duplicateTeamNumbersFromDraft({
            captainsDraft,
            picksDraft,
            partnerSlots: session.partnerSlots,
            attendingTeamNumbers,
          })
        : new Set<number>(),
    [session, captainsDraft, picksDraft, attendingTeamNumbers],
  );
  const draftedTeamIds = useMemo(() => {
    if (!session) return new Set<number>();
    return pickedTeamIds(normalizePicks(session.picks, session.partnerSlots));
  }, [session?.picks, session?.partnerSlots]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const title = newName.trim();
      const res = await apiRequest("POST", `/api/events/${eventId}/alliance-sim/sessions`, { name: title });
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
        if (!session) return;
        const dupes = duplicateTeamNumbersFromDraft({
          captainsDraft: next,
          picksDraft,
          partnerSlots: session.partnerSlots,
          attendingTeamNumbers,
        });
        if (dupes.size > 0) return;
        // captains are now treated as team numbers; only save if all non-empty entries attend this event.
        for (let i = 0; i < ALLIANCE_SIM_CAPTAINS; i++) {
          const n = parseDraftTeamNumber(next?.[i] ?? "");
          if (n != null && !attendingTeamNumbers.has(n)) return;
        }
        patchCaptainsMutation.mutate(normalizeCaptainRobots(next));
      }, 450);
    },
    [patchCaptainsMutation, session, picksDraft, attendingTeamNumbers],
  );

  const schedulePicksSave = useCallback(
    (nextDraft: string[][], ps: AllianceSimPartnerSlotCount) => {
      if (picksSaveTimer.current) clearTimeout(picksSaveTimer.current);
      picksSaveTimer.current = setTimeout(() => {
        if (!session) return;
        const dupes = duplicateTeamNumbersFromDraft({
          captainsDraft,
          picksDraft: nextDraft,
          partnerSlots: ps,
          attendingTeamNumbers,
        });
        if (dupes.size > 0) return;
        const { picks: nextPicks, hasInvalid } = matrixToPicksFromDraft(nextDraft, ps, teamIdByNumber);
        if (hasInvalid) return;
        if (samePickSets(session.picks, nextPicks, ps)) return;
        patchPicksMutation.mutate(nextPicks);
      }, 450);
    },
    [patchPicksMutation, session, teamIdByNumber, captainsDraft, attendingTeamNumbers],
  );

  useEffect(() => {
    if (!session) return;
    setCaptainsDraft(normalizeCaptainRobots(session.captainRobots));
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    setPicksDraft(draftFromPicks(session.picks, session.partnerSlots, teamMap));
  }, [session?.picks, session?.partnerSlots, teamMap]);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/alliance-sim/sessions/${sessionId}/reset`, {});
      return (await res.json()) as SimSessionDetail;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(sessionQueryKey, data);
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "alliance-sim", "sessions"] });
      setPicksDraft(createEmptyDraftMatrix(data.partnerSlots));
      setCaptainsDraft(normalizeCaptainRobots([]));
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

  if (!eventId) {
    return <div className="p-6 text-muted-foreground">Invalid event.</div>;
  }

  /* ——— List hub ——— */
  if (!sessionId) {
    const title = newName.trim();
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Swords className="h-7 w-7 text-primary" />
              Alliance sim
              {help?.HelpTrigger?.({ content: ALLIANCE_SIM_HELP, className: "ml-1" })}
            </h1>
            <p className="text-muted-foreground mt-1">{event?.name ?? "Event"}</p>
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
                className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                onClick={() => openSession(s.id)}
                data-testid={`card-alliance-sim-${s.id}`}
              >
                <CardHeader className="py-5">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="min-w-0 flex-1 truncate text-lg font-semibold leading-none tracking-tight sm:text-xl">
                      {s.name}
                    </CardTitle>
                    <div className="shrink-0 flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                        className="h-8 w-8 p-0 text-destructive/90 opacity-80 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(s.id);
                    }}
                    aria-label={`Delete simulation ${s.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New alliance simulation</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Title"
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
                disabled={createMutation.isPending || !title}
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
              {event?.name}
              {session.isComplete ? " · Complete" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
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
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-0 sm:px-5 sm:pb-5">
            <div className="w-full">
              {(() => {
                const ps = session.partnerSlots;
                const slots = Array.from({ length: ALLIANCE_SIM_CAPTAINS }, (_, i) => i + 1);
                const renderColumn = (slot: number) => {
                  return (
                    <div
                      key={`col-${slot}`}
                      className={cn(
                        "min-w-0 overflow-hidden rounded-xl border shadow-sm",
                        "border-border/60 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70",
                      )}
                      data-testid={`alliance-column-${slot}`}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center border-b px-1 py-2.5",
                          "border-border/40 bg-muted/30",
                        )}
                      >
                        <span className={cn("truncate text-center text-sm font-bold tabular-nums sm:text-base")}>#{slot}</span>
                      </div>

                      <div className="space-y-0">
                        <div className="border-b border-border/30 px-2.5 py-2.5">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                            Capt
                          </span>
                          {(() => {
                            const v = normalizeTeamNumberDraft(captainsDraft[slot - 1] ?? "");
                            const n = parseDraftTeamNumber(v);
                            const invalidAbsent = n != null && !attendingTeamNumbers.has(n);
                            const dup = n != null && duplicateTeamNumbers.has(n) && !invalidAbsent;
                            return (
                              <Input
                                className={cn(
                                  "h-10 px-2 text-center text-sm tabular-nums sm:h-11 sm:text-base",
                                  invalidAbsent && "text-destructive",
                                  dup && "text-yellow-700 dark:text-yellow-400",
                                )}
                                value={v}
                                onChange={(e) => {
                                  const v = normalizeTeamNumberDraft(e.target.value);
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
                            );
                          })()}
                        </div>

                        {Array.from({ length: ps }, (_, partnerIndex) => {
                          const raw = picksDraft?.[slot - 1]?.[partnerIndex] ?? "";
                          const v = normalizeTeamNumberDraft(raw);
                          const n = parseDraftTeamNumber(v);
                          const invalidAbsent = n != null && !attendingTeamNumbers.has(n);
                          const dup = n != null && duplicateTeamNumbers.has(n) && !invalidAbsent;
                          const isLast = partnerIndex === ps - 1;
                          return (
                            <div
                              key={`col-${slot}-p-${partnerIndex}`}
                              className={cn("px-2.5 py-2.5", !isLast && "border-b border-border/30")}
                            >
                              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                                P{partnerIndex + 1}
                              </span>
                              <Input
                                className={cn(
                                  "h-10 px-2 text-center text-sm tabular-nums sm:h-11 sm:text-base",
                                  invalidAbsent && "text-destructive",
                                  dup && "text-yellow-700 dark:text-yellow-400",
                                )}
                                value={v}
                                onChange={(e) => {
                                  const nextVal = normalizeTeamNumberDraft(e.target.value);
                                  setPicksDraft((prev) => {
                                    const next = prev?.length ? prev.map((r) => r.slice()) : createEmptyDraftMatrix(ps);
                                    while (next.length < ALLIANCE_SIM_CAPTAINS) next.push(Array.from({ length: ps }, () => ""));
                                    while (next[slot - 1].length < ps) next[slot - 1].push("");
                                    next[slot - 1][partnerIndex] = nextVal;
                                    schedulePicksSave(next, ps);
                                    return next;
                                  });
                                }}
                                placeholder="—"
                                aria-label={`Alliance ${slot} partner ${partnerIndex + 1}`}
                                data-testid={`input-alliance-partner-${slot}-${partnerIndex + 1}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                const top = slots.slice(0, 4);
                const bottom = slots.slice(4, 8);

                return (
                  <div className="space-y-4" data-testid="alliance-draft-grid">
                    <div className="grid w-full grid-cols-4 gap-3 sm:gap-4 xl:hidden">{top.map(renderColumn)}</div>
                    <div className="grid w-full grid-cols-4 gap-3 sm:gap-4 xl:hidden">{bottom.map(renderColumn)}</div>
                    <div className="hidden w-full grid-cols-8 gap-x-5 gap-y-3 xl:grid">{slots.map(renderColumn)}</div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-2 pb-3 pt-4 sm:pt-5">
            <CardTitle className="text-base sm:text-lg">Picklist</CardTitle>
            <CardDescription className="text-sm leading-relaxed sm:text-[0.9375rem]">
              Select a picklist to view teams in order. Drafted teams move below the divider automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="flex flex-col gap-3">
              <Select value={selectedPicklistId} onValueChange={setSelectedPicklistId}>
                <SelectTrigger className="max-w-md" data-testid="select-alliance-sim-picklist">
                  <SelectValue placeholder="Select picklist…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {picklists.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.entryCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {picklistIdNum == null ? (
                <div className="text-sm text-muted-foreground">Choose a picklist to show its teams here.</div>
              ) : picklistEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">This picklist has no teams yet.</div>
              ) : (
                (() => {
                  const available = picklistEntries.filter((e) => !draftedTeamIds.has(e.teamId));
                  const drafted = picklistEntries.filter((e) => draftedTeamIds.has(e.teamId));
                  const Row = ({ e }: { e: PicklistEntryWithTeam }) => (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/10 px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-semibold tabular-nums leading-none">
                          {e.rank}. {e.team.teamNumber}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">{e.team.teamName}</div>
                      </div>
                    </div>
                  );
                  return (
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {available.map((e) => (
                          <Row key={e.id} e={e} />
                        ))}
                      </div>

                      <div className="border-t-4 border-border/60 pt-3" />

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 opacity-80">
                        {drafted.map((e) => (
                          <Row key={e.id} e={e} />
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
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
  );
}
