import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, X, GripVertical, Search, ListOrdered, MoreHorizontal, Pencil, Trash2, Users, User, ArrowRight, Shield, Swords, Zap, ArrowLeft } from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import type { Event, Team, EventTeam, PicklistEntry, Picklist, ScoutingEntry } from "@shared/schema";
import placeholderAvatar from "@assets/images_1772071870956.png";
import { getTeamDominantColor, computeTeamStats, computeStatRanges, computeStatRangesForSzr, computeTbaRanges, computeSzrMapWithSweepBonus, parseSzrWeights } from "@/lib/team-colors";
import { RankingColorKey } from "@/components/ranking-color-key";

type PicklistWithTeam = PicklistEntry & { team: Team };
type EventTeamWithTeam = EventTeam & { team: Team };
type PicklistWithCreator = Picklist & { createdBy?: { id: number; displayName: string; role: string } };

type DragSource = { type: "available"; teamId: number } | { type: "picklist"; idx: number };

function DragPreview({ team, avatar, mousePos }: { team: { teamNumber: number; teamName: string }; avatar: string; mousePos: { x: number; y: number } }) {
  return createPortal(
    <div
      className="fixed pointer-events-none z-[9999] flex items-center gap-2 px-3 py-2 rounded-lg shadow-xl border border-border/50 bg-background/95 backdrop-blur-sm"
      style={{ left: mousePos.x + 12, top: mousePos.y - 16 }}
    >
      <img src={avatar || placeholderAvatar} alt="" className="w-7 h-7 rounded-full border border-border object-cover bg-white shrink-0" />
      <span className="font-bold text-sm whitespace-nowrap">{team.teamNumber} - {team.teamName}</span>
    </div>,
    document.body
  );
}

const PICKLIST_HELP = {
  title: "How to use the Picklist",
  body: (
    <>
      <p>The picklist helps you rank teams for alliance selection at the end of qualifications.</p>
      <p><strong>Create lists</strong> — Click &quot;New picklist&quot; to make a new ranking list. You can have multiple lists (e.g. one per mentor).</p>
      <p><strong>Add teams</strong> — Click the + button on a team in the &quot;Available&quot; panel to add it to your picklist.</p>
      <p><strong>Reorder</strong> — Drag teams by the grip handle (⋮⋮) to change the order. Top teams are your preferred picks.</p>
      <p><strong>Remove</strong> — Click a team in the picklist, then click the X that appears to remove it.</p>
    </>
  ),
};

export default function Picklist() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const [location, setLocation] = useLocation();
  const listIdFromUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const list = params.get("list");
    const n = list ? parseInt(list, 10) : null;
    return n && Number.isFinite(n) ? n : null;
  }, [location]);
  const openCreateFromUrl = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("new") === "1";
  }, [location]);
  const { toast } = useToast();
  const help = useHelp();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAdminOnly, setCreateAdminOnly] = useState(false);
  const [createIcon, setCreateIcon] = useState<"sword" | "shield" | "bolt" | null>("sword");
  const [createColor, setCreateColor] = useState<"red" | "orange" | "yellow" | "green" | "blue" | "violet">("blue");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renamePicklist, setRenamePicklist] = useState<PicklistWithCreator | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameAdminOnly, setRenameAdminOnly] = useState(false);
  const [deletePicklist, setDeletePicklist] = useState<PicklistWithCreator | null>(null);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<"picklist" | "available" | null>(null);
  /** Team row selected to show the remove control (keeps the list uncluttered until you pick a row). */
  const [removeControlTeamId, setRemoveControlTeamId] = useState<number | null>(null);
  const picklistPanelRef = useRef<HTMLDivElement | null>(null);
  const dragSourceRef = useRef<DragSource | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draggedTeam, setDraggedTeam] = useState<{ teamNumber: number; teamName: string; avatar: string } | null>(null);
  const emptyImg = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    emptyImg.current = img;
  }, []);

  useEffect(() => {
    if (!draggedTeam) return;
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    const handleDragOver = (e: DragEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("dragover", handleDragOver);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, [draggedTeam]);

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: picklists = [], isLoading: picklistsLoading } = useQuery<PicklistWithCreator[]>({
    queryKey: ["/api/events", eventId, "picklists"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/picklists`);
      if (!res.ok) throw new Error("Failed to fetch picklists");
      return res.json();
    },
  });

  const selectedPicklistId = listIdFromUrl;

  useEffect(() => {
    // No list switching inside the editor: you must pick a list from the table page.
    if (selectedPicklistId != null) return;
    if (openCreateFromUrl) {
      setCreateOpen(true);
      return;
    }
    // If user navigates here directly, send them back to the table.
    setLocation(`/events/${eventId}/picklists`, { replace: true });
  }, [selectedPicklistId, openCreateFromUrl, eventId, setLocation]);

  useEffect(() => {
    setRemoveControlTeamId(null);
  }, [selectedPicklistId]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = picklistPanelRef.current;
      if (!el) return;
      const target = e.target as Node;
      if (!el.contains(target)) setRemoveControlTeamId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const { data: eventTeams, isLoading: teamsLoading } = useQuery<EventTeamWithTeam[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: scoutingEntries = [] } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
    enabled: !!eventId,
  });

  const teams = useMemo(() => (eventTeams || []).map((et) => et.team), [eventTeams]);
  const teamStats = useMemo(() => computeTeamStats(teams, scoutingEntries), [teams, scoutingEntries]);
  const statRanges = useMemo(() => computeStatRanges(teamStats), [teamStats]);
  const statRangesForSzr = useMemo(() => computeStatRangesForSzr(teamStats), [teamStats]);
  const tbaRanges = useMemo(() => computeTbaRanges(eventTeams || []), [eventTeams]);
  const szrWeights = useMemo(() => parseSzrWeights(event?.szrWeights), [event?.szrWeights]);
  const szrMap = useMemo(() => computeSzrMapWithSweepBonus(teams, scoutingEntries, statRangesForSzr, statRanges, szrWeights, eventTeams ?? undefined, tbaRanges), [teams, scoutingEntries, statRangesForSzr, statRanges, szrWeights, eventTeams, tbaRanges]);
  const szrSweepThreshold = useMemo(() => {
    const values = Array.from(szrMap.values()).filter((v) => v > 0).sort((a, b) => b - a);
    if (values.length < 2) return null;
    return values[1] + 19;
  }, [szrMap]);

  const { data: picklistEntries = [], isLoading: entriesLoading } = useQuery<PicklistWithTeam[]>({
    queryKey: ["/api/events", eventId, "picklists", selectedPicklistId, "entries"],
    queryFn: async () => {
      if (!selectedPicklistId) return [];
      const res = await fetch(`/api/events/${eventId}/picklists/${selectedPicklistId}/entries`);
      if (!res.ok) throw new Error("Failed to fetch entries");
      return res.json();
    },
    enabled: !!selectedPicklistId,
  });

  useEffect(() => {
    if (removeControlTeamId == null) return;
    if (!picklistEntries?.some((e) => e.teamId === removeControlTeamId)) {
      setRemoveControlTeamId(null);
    }
  }, [picklistEntries, removeControlTeamId]);

  const selectedPicklist = useMemo(() => picklists.find((p) => p.id === selectedPicklistId) ?? null, [picklists, selectedPicklistId]);
  const canEditPicklist = isAdmin || !selectedPicklist?.adminOnly;

  const createMutation = useMutation({
    mutationFn: async ({
      name,
      adminOnly,
      icon,
      color,
    }: {
      name: string;
      adminOnly: boolean;
      icon: "sword" | "shield" | "bolt" | null;
      color: "red" | "orange" | "yellow" | "green" | "blue" | "violet";
    }) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/picklists`, { name, adminOnly, icon, color });
      return res.json();
    },
    onSuccess: (created: Picklist) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "picklists"] });
      setCreateOpen(false);
      setCreateName("");
      setCreateAdminOnly(false);
      setCreateIcon("sword");
      setCreateColor("blue");
      setLocation(`/events/${eventId}/picklist?list=${created.id}`, { replace: true });
      toast({ title: "Picklist created" });
    },
    onError: (e: Error) => toast({ title: "Failed to create picklist", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id: picklistId, name, adminOnly }: { id: number; name: string; adminOnly?: boolean }) => {
      const body: { name?: string; adminOnly?: boolean } = { name };
      if (adminOnly !== undefined) body.adminOnly = adminOnly;
      await apiRequest("PATCH", `/api/events/${eventId}/picklists/${picklistId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "picklists"] });
      setRenameOpen(false);
      setRenamePicklist(null);
      setRenameName("");
      setRenameAdminOnly(false);
      toast({ title: "Picklist renamed" });
    },
    onError: (e: Error) => toast({ title: "Failed to rename", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (picklistId: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}/picklists/${picklistId}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "picklists"] });
      setDeletePicklist(null);
      if (selectedPicklistId === deletedId) {
        setLocation(`/events/${eventId}/picklists`, { replace: true });
      }
      toast({ title: "Picklist deleted" });
    },
    onError: (e: Error) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const setAdminOnlyMutation = useMutation({
    mutationFn: async ({ picklistId, adminOnly, name }: { picklistId: number; adminOnly: boolean; name: string }) => {
      await apiRequest("PATCH", `/api/events/${eventId}/picklists/${picklistId}`, { name, adminOnly });
    },
    onSuccess: (_, { adminOnly }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "picklists"] });
      toast({ title: adminOnly ? "Picklist is now admin only" : "Picklist is now editable by all" });
    },
    onError: (e: Error) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const picklistTeamIds = useMemo(() => new Set(picklistEntries?.map((p) => p.teamId) || []), [picklistEntries]);

  const availableTeams = useMemo(() => {
    if (!eventTeams) return [];
    const available = eventTeams.filter((et) => !picklistTeamIds.has(et.teamId));
    const sortBySzrOrOpr = (a: EventTeamWithTeam, b: EventTeamWithTeam) => {
      const szrA = szrMap.get(a.teamId) ?? -1;
      const szrB = szrMap.get(b.teamId) ?? -1;
      if (szrA >= 0 || szrB >= 0) return szrB - szrA;
      return (b.opr ?? 0) - (a.opr ?? 0);
    };
    if (!search.trim()) return available.sort(sortBySzrOrOpr);
    const q = search.toLowerCase();
    return available
      .filter((et) => et.team.teamNumber.toString().includes(q) || et.team.teamName.toLowerCase().includes(q))
      .sort(sortBySzrOrOpr);
  }, [eventTeams, picklistTeamIds, search, szrMap]);

  const updatePicklistEntries = useCallback(
    async (teamIds: number[]) => {
      if (!selectedPicklistId) return;
      const queryKey = ["/api/events", eventId, "picklists", selectedPicklistId, "entries"];
      const previousData = queryClient.getQueryData<PicklistWithTeam[]>(queryKey);

      queryClient.setQueryData(queryKey, (old: PicklistWithTeam[] | undefined) => {
        return teamIds.map((tid, i) => {
          const existing = old?.find((p) => p.teamId === tid);
          if (existing) return { ...existing, rank: i + 1 };
          const et = eventTeams?.find((e) => e.teamId === tid);
          return {
            id: -1,
            picklistId: selectedPicklistId,
            teamId: tid,
            rank: i + 1,
            tier: "pick",
            team: et?.team || { id: tid, teamNumber: 0, teamName: "", city: null, stateProv: null, country: null, avatar: null },
          } as PicklistWithTeam;
        });
      });

      try {
        await apiRequest("PUT", `/api/events/${eventId}/picklists/${selectedPicklistId}/entries`, { teamIds });
        queryClient.invalidateQueries({ queryKey });
      } catch {
        queryClient.setQueryData(queryKey, previousData);
        queryClient.invalidateQueries({ queryKey });
        toast({ title: "Picklist update failed", description: "Changes were reverted. Try again.", variant: "destructive" });
      }
    },
    [eventId, selectedPicklistId, eventTeams, toast]
  );

  const addTeam = useCallback(
    async (teamId: number) => {
      const currentIds = picklistEntries?.map((p) => p.teamId) || [];
      await updatePicklistEntries([...currentIds, teamId]);
    },
    [picklistEntries, updatePicklistEntries]
  );

  const addTeamAtPosition = useCallback(
    async (teamId: number, position: number) => {
      const currentIds = picklistEntries?.map((p) => p.teamId) || [];
      const newIds = [...currentIds];
      newIds.splice(position, 0, teamId);
      await updatePicklistEntries(newIds);
    },
    [picklistEntries, updatePicklistEntries]
  );

  const removeTeam = useCallback(
    async (teamId: number) => {
      const currentIds = picklistEntries?.map((p) => p.teamId) || [];
      await updatePicklistEntries(currentIds.filter((id) => id !== teamId));
    },
    [picklistEntries, updatePicklistEntries]
  );

  const findTeamInfo = useCallback(
    (source: DragSource) => {
      if (source.type === "available") {
        const et = eventTeams?.find((e) => e.teamId === source.teamId);
        if (et) return { teamNumber: et.team.teamNumber, teamName: et.team.teamName, avatar: et.team.avatar || "" };
      } else if (source.type === "picklist" && picklistEntries) {
        const entry = picklistEntries[source.idx];
        if (entry) return { teamNumber: entry.team.teamNumber, teamName: entry.team.teamName, avatar: entry.team.avatar || "" };
      }
      return null;
    },
    [eventTeams, picklistEntries]
  );

  const handleDragStart = (source: DragSource, e: React.DragEvent) => {
    setDragSource(source);
    dragSourceRef.current = source;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(source));
    if (emptyImg.current) e.dataTransfer.setDragImage(emptyImg.current, 0, 0);
    setMousePos({ x: e.clientX, y: e.clientY });
    const info = findTeamInfo(source);
    if (info) setDraggedTeam(info);
  };

  const handlePicklistDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
    setDragOverPanel("picklist");
  };

  const handlePicklistPanelDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPanel("picklist");
  };

  const handleAvailablePanelDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPanel("available");
    setDragOverIdx(null);
  };

  const handleAvailablePanelDrop = async () => {
    if (!canEditPicklist) return;
    const src = dragSourceRef.current;
    if (!src) return;
    if (src.type === "picklist" && picklistEntries) {
      const teamId = picklistEntries[src.idx]?.teamId;
      if (teamId) {
        resetDrag();
        await removeTeam(teamId);
      }
    } else resetDrag();
  };

  const handlePicklistDrop = async (idx: number) => {
    if (!canEditPicklist) return;
    const src = dragSourceRef.current;
    if (!src || !picklistEntries) return;
    if (src.type === "picklist") {
      if (src.idx === idx) return;
      const ids = picklistEntries.map((p) => p.teamId);
      const [moved] = ids.splice(src.idx, 1);
      ids.splice(idx, 0, moved);
      resetDrag();
      await updatePicklistEntries(ids);
    } else if (src.type === "available") {
      resetDrag();
      await addTeamAtPosition(src.teamId, idx);
    }
  };

  const handlePicklistPanelDrop = async () => {
    if (!canEditPicklist) return;
    const src = dragSourceRef.current;
    if (!src) return;
    if (src.type === "available") {
      resetDrag();
      await addTeam(src.teamId);
    } else resetDrag();
  };

  const resetDrag = () => {
    setDragSource(null);
    setDragOverIdx(null);
    setDragOverPanel(null);
    setDraggedTeam(null);
    dragSourceRef.current = null;
  };

  const getTeamEventData = useCallback((teamId: number) => eventTeams?.find((e) => e.teamId === teamId), [eventTeams]);

  const getTeamColor = useCallback(
    (teamId: number) => getTeamDominantColor(teamId, eventTeams ?? undefined, teamStats, statRanges, tbaRanges, { szrMap, szrSweepThreshold }),
    [eventTeams, teamStats, statRanges, tbaRanges, szrMap, szrSweepThreshold]
  );

  const isLoading = teamsLoading || picklistsLoading;

  const picklistColorClass: Record<"red" | "orange" | "yellow" | "green" | "blue" | "violet", string> = {
    red: "text-red-400",
    orange: "text-orange-400",
    yellow: "text-yellow-400",
    green: "text-emerald-400",
    blue: "text-blue-400",
    violet: "text-violet-400",
  };

  const picklistColorRingClass: Record<"red" | "orange" | "yellow" | "green" | "blue" | "violet", string> = {
    red: "ring-red-500/35",
    orange: "ring-orange-500/35",
    yellow: "ring-yellow-500/35",
    green: "ring-emerald-500/35",
    blue: "ring-blue-500/35",
    violet: "ring-violet-500/35",
  };

  const picklistColorBgClass: Record<"red" | "orange" | "yellow" | "green" | "blue" | "violet", string> = {
    red: "bg-red-500/15",
    orange: "bg-orange-500/15",
    yellow: "bg-yellow-500/15",
    green: "bg-emerald-500/15",
    blue: "bg-blue-500/15",
    violet: "bg-violet-500/15",
  };

  const iconForValue = (v: "sword" | "shield" | "bolt") => {
    if (v === "sword") return Swords;
    if (v === "shield") return Shield;
    return Zap;
  };

  if (isLoading) {
    return (
      <div className="min-h-full">
        <header className="border-b bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <Skeleton className="h-[420px] rounded-xl md:col-span-2" />
            <Skeleton className="h-[420px] rounded-xl md:col-span-3" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-950">
      {draggedTeam && <DragPreview team={draggedTeam} avatar={draggedTeam.avatar} mousePos={mousePos} />}

      <header className="border-b border-white/10 bg-zinc-950/60 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  className="h-9 px-0 text-zinc-400 hover:bg-transparent hover:text-zinc-100"
                  asChild
                  data-testid="button-back-picklists"
                >
                  <Link href={`/events/${eventId}/picklists`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Picklists
                  </Link>
                </Button>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-black tracking-tight text-zinc-50 sm:text-2xl" data-testid="text-picklist-title">
                    {selectedPicklist?.name ?? "Picklist"}
                  </h1>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {event?.name ?? ""}
                    {selectedPicklist?.createdBy ? ` · by ${selectedPicklist.createdBy.displayName}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Alliance sim hidden for now */}

              {selectedPicklist && canEditPicklist && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-0 bg-white/5 text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-white/10"
                      data-testid="button-picklist-edit"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isAdmin && (
                      <DropdownMenuItem
                        onClick={() =>
                          setAdminOnlyMutation.mutate({
                            picklistId: selectedPicklist.id,
                            adminOnly: !selectedPicklist.adminOnly,
                            name: selectedPicklist.name,
                          })
                        }
                        disabled={setAdminOnlyMutation.isPending}
                        data-testid="button-toggle-admin-only"
                      >
                        <Shield className="mr-2 h-4 w-4 text-blue-500" />
                        {selectedPicklist.adminOnly ? "Remove admin only" : "Make admin only"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        setRenamePicklist(selectedPicklist);
                        setRenameName(selectedPicklist.name);
                        setRenameAdminOnly(selectedPicklist.adminOnly ?? false);
                        setRenameOpen(true);
                      }}
                      data-testid="button-rename-picklist"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeletePicklist(selectedPicklist)}
                      data-testid="button-delete-picklist"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">

        {picklists.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
                <ListOrdered className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">No picklists yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create a picklist to rank teams for alliance selection. You can have multiple lists (e.g. main, backup).
              </p>
              <Button className="mt-6" onClick={() => setCreateOpen(true)} data-testid="button-create-first-picklist">
                <Plus className="h-4 w-4 mr-2" />
                Create your first picklist
              </Button>
            </CardContent>
          </Card>
        ) : selectedPicklistId && (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {selectedPicklist?.createdBy && (
                  <span className="flex items-center gap-2" data-testid="text-picklist-creator">
                    <span className="flex items-center gap-1.5">
                      <User className="h-4 w-4 shrink-0" />
                      Created by {selectedPicklist.createdBy.displayName}
                    </span>
                    {selectedPicklist.createdBy.role === "admin" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                        <Shield className="h-3 w-3" />
                        Admin
                      </span>
                    )}
                  </span>
                )}
                {!canEditPicklist ? (
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-blue-500 shrink-0" aria-label="Admin only" />
                    Admin-only picklist — view only. Only admins can edit this list.
                  </span>
                ) : null}
              </div>
              <RankingColorKey />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div
              className={`md:col-span-2 flex flex-col overflow-hidden transition-shadow ${dragOverPanel === "available" && dragSource?.type === "picklist" ? "ring-2 ring-primary/40 shadow-md" : ""}`}
              data-testid="panel-available"
              onDragOver={handleAvailablePanelDragOver}
              onDragLeave={(e) => {
                if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget as Node) && dragOverPanel === "available") setDragOverPanel(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleAvailablePanelDrop();
              }}
            >
              <div className="ss-glass-subtle border border-white/10 bg-zinc-900/35 p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <p className="text-sm font-semibold text-zinc-100">
                    Available teams
                    {help?.HelpTrigger?.({
                      content: { title: "Available teams", body: <p>Teams not yet in your picklist. Click + or drag to add. Search to filter. Sorted by OPR when empty.</p> },
                    })}
                  </p>
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search by number or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" data-testid="input-search-available" />
                </div>
              </div>
              <div className="mt-3 flex-1 overflow-auto min-h-[200px] max-h-[55vh] space-y-1 pt-0 custom-scrollbar">
                {availableTeams.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 px-4 text-center transition-colors ${dragOverPanel === "available" && dragSource?.type === "picklist" ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 bg-muted/30"}`}>
                    <p className="text-sm font-medium text-muted-foreground">
                      {dragOverPanel === "available" && dragSource?.type === "picklist"
                        ? "Drop here to remove from picklist"
                        : picklistTeamIds.size === (eventTeams?.length || 0)
                          ? "All teams are in your list"
                          : "No teams match your search"}
                    </p>
                    {!search.trim() && picklistTeamIds.size < (eventTeams?.length || 0) && (
                      <p className="mt-1 text-xs text-muted-foreground">Try a different search term</p>
                    )}
                  </div>
                ) : (
                  availableTeams.map((et) => {
                    const rank = (et as any).rank;
                    const isDragging = dragSource?.type === "available" && dragSource.teamId === et.teamId;
                    const colors = getTeamColor(et.teamId);
                    return (
                      <div
                        key={et.teamId}
                        draggable={canEditPicklist}
                        onDragStart={(e) => canEditPicklist && handleDragStart({ type: "available", teamId: et.teamId }, e)}
                        onDragEnd={resetDrag}
                        className={`flex items-center gap-3 rounded-lg border-l-4 py-2.5 px-3 transition-colors group ${canEditPicklist ? "cursor-grab active:cursor-grabbing" : ""} ${colors.border} ${colors.bg || "hover:bg-muted/50"} ${isDragging ? "opacity-40" : ""}`}
                        data-testid={`available-team-${et.teamId}`}
                      >
                        {canEditPicklist ? <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" /> : <span className="w-4 shrink-0" aria-hidden />}
                        <img src={et.team.avatar || placeholderAvatar} alt="" className="h-9 w-9 rounded-full border border-border object-cover bg-muted shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{et.team.teamNumber} — {et.team.teamName}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>SZR <span className="font-medium text-foreground/90">{szrMap.get(et.teamId) ?? 0}</span></span>
                            {et.opr != null && <span>OPR <span className="font-medium text-foreground/90">{et.opr.toFixed(1)}</span></span>}
                            {rank != null && <span>Rank #{rank}</span>}
                          </div>
                        </div>
                        {canEditPicklist && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" onClick={() => addTeam(et.teamId)} data-testid={`button-add-${et.teamId}`} aria-label={`Add team ${et.team.teamNumber}`}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div
              ref={picklistPanelRef}
              className={`md:col-span-3 flex flex-col overflow-hidden transition-shadow border-primary/20 bg-primary/[0.02] ${dragOverPanel === "picklist" && dragSource?.type === "available" ? "ring-2 ring-primary/40 shadow-md" : ""}`}
              data-testid="panel-picklist"
              onDragOver={handlePicklistPanelDragOver}
              onDragLeave={(e) => {
                if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget as Node) && dragOverPanel === "picklist") {
                  setDragOverPanel(null);
                  setDragOverIdx(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                handlePicklistPanelDrop();
              }}
            >
              <div className="ss-glass-subtle border border-white/10 bg-zinc-900/35 p-4">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-blue-400" />
                  <p className="text-sm font-semibold text-zinc-100">
                    Ranked teams
                    {selectedPicklist?.adminOnly && <Shield className="ml-2 inline h-4 w-4 text-blue-400" aria-label="Admin only" />}
                    {help?.HelpTrigger?.({
                      content: { title: "Your picklist", body: <p>Teams you&apos;ve ranked. Drag by the handle to reorder. Top = preferred. Drag back to Available to remove.</p> },
                    })}
                  </p>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {picklistEntries?.length ?? 0} of {eventTeams?.length ?? 0} teams · drag to reorder
                </p>
              </div>

              <div className="mt-3 flex-1 overflow-auto min-h-[200px] max-h-[55vh] space-y-1 pt-0 custom-scrollbar">
                {entriesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                  </div>
                ) : !picklistEntries || picklistEntries.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 px-4 text-center transition-colors ${dragOverPanel === "picklist" && dragSource?.type === "available" ? "border-primary/50 bg-primary/10" : "border-muted-foreground/20 bg-muted/20"}`}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                      <ListOrdered className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">No teams in this list yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Add teams from the list on the left — click + or drag them here</p>
                  </div>
                ) : (
                  picklistEntries.map((entry, idx) => {
                    const et = getTeamEventData(entry.teamId);
                    const tbaRank = (et as any)?.rank;
                    const isDragging = dragSource?.type === "picklist" && dragSource.idx === idx;
                    const isDragOver = dragOverIdx === idx && dragOverPanel === "picklist";
                    const colors = getTeamColor(entry.teamId);
                    return (
                      <div
                        key={entry.teamId}
                        draggable={canEditPicklist}
                        onDragStart={(e) => canEditPicklist && handleDragStart({ type: "picklist", idx }, e)}
                        onDragOver={(e) => canEditPicklist && handlePicklistDragOver(e, idx)}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePicklistDrop(idx);
                        }}
                        onDragEnd={resetDrag}
                        className={`flex items-center gap-3 rounded-lg border-l-4 py-2.5 px-3 transition-all ${canEditPicklist ? "cursor-grab active:cursor-grabbing" : ""} ${colors.border} ${isDragging ? "opacity-40" : ""} ${isDragOver ? "bg-primary/15 border border-primary/40 ring-1 ring-primary/20" : `${colors.bg || "hover:bg-muted/50"} border border-transparent`}`}
                        data-testid={`picklist-row-${idx}`}
                      >
                        {canEditPicklist ? <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" /> : <span className="w-4 shrink-0" aria-hidden />}
                        <button
                          type="button"
                          className={`flex flex-1 min-w-0 items-center gap-3 text-left rounded-md -m-1 p-1 transition-colors ${canEditPicklist ? "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
                          disabled={!canEditPicklist}
                          onClick={() => canEditPicklist && setRemoveControlTeamId(entry.teamId)}
                          data-testid={`picklist-row-select-${entry.teamId}`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground" aria-hidden>{idx + 1}</span>
                          <img src={entry.team.avatar || placeholderAvatar} alt="" className="h-9 w-9 rounded-full border border-border object-cover bg-muted shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{entry.team.teamNumber} — {entry.team.teamName}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>SZR <span className="font-medium text-foreground/90">{szrMap.get(entry.teamId) ?? 0}</span></span>
                              {et?.opr != null && <span>OPR <span className="font-medium text-foreground/90">{et.opr.toFixed(1)}</span></span>}
                              {tbaRank != null && <span>Rank #{tbaRank}</span>}
                            </div>
                          </div>
                        </button>
                        {canEditPicklist && removeControlTeamId === entry.teamId && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100 hover:text-destructive transition-all animate-in fade-in zoom-in-95 duration-150" onClick={() => removeTeam(entry.teamId)} data-testid={`button-remove-${entry.teamId}`} aria-label={`Remove team ${entry.team.teamNumber}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            </div>
          </>
        )}
      </main>

      {/* Create picklist dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New picklist</DialogTitle>
            <DialogDescription>Give this picklist a name (e.g. &quot;Strategy A&quot;, &quot;Backup&quot;).</DialogDescription>
          </DialogHeader>
          <Input placeholder="Picklist name" value={createName} onChange={(e) => setCreateName(e.target.value)} data-testid="input-new-picklist-name" />
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Icon</p>
              <div className="grid grid-cols-3 gap-2">
                {(["sword", "shield", "bolt"] as const).map((v) => {
                  const Icon = iconForValue(v);
                  const active = createIcon === v;
                  const c = picklistColorClass[createColor];
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCreateIcon(v)}
                      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-black/20 hover:bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] ${active ? `ring-2 ${picklistColorRingClass[createColor]}` : ""}`}
                      data-testid={`picklist-icon-${v}`}
                    >
                      <Icon className={`h-4 w-4 ${c}`} />
                      <span className="capitalize text-zinc-200">{v === "bolt" ? "Bolt" : v}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Color</p>
              <div className="grid grid-cols-6 gap-2">
                {(["red", "orange", "yellow", "green", "blue", "violet"] as const).map((c) => {
                  const active = createColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCreateColor(c)}
                      className={`h-9 rounded-lg ${picklistColorBgClass[c]} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] ${active ? `ring-2 ${picklistColorRingClass[c]}` : "hover:bg-white/5"}`}
                      aria-label={`Color ${c}`}
                      data-testid={`picklist-color-${c}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center space-x-2">
              <Checkbox id="create-admin-only" checked={createAdminOnly} onCheckedChange={(c) => setCreateAdminOnly(!!c)} />
              <label htmlFor="create-admin-only" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                Admin only — only admins can edit this picklist
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                createName.trim() &&
                createMutation.mutate({ name: createName.trim(), adminOnly: createAdminOnly, icon: createIcon, color: createColor })
              }
              disabled={!createName.trim() || createMutation.isPending}
              data-testid="button-create-picklist-submit"
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={(open) => { if (!open) { setRenameOpen(false); setRenamePicklist(null); setRenameName(""); setRenameAdminOnly(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename picklist</DialogTitle>
            <DialogDescription>Enter a new name for this picklist.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Name" value={renameName} onChange={(e) => setRenameName(e.target.value)} data-testid="input-rename-picklist" />
          {isAdmin && renamePicklist && (
            <div className="flex items-center space-x-2">
              <Checkbox id="rename-admin-only" checked={renameAdminOnly} onCheckedChange={(c) => setRenameAdminOnly(!!c)} />
              <label htmlFor="rename-admin-only" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                Admin only — only admins can edit this picklist
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={() => renamePicklist && renameName.trim() && renameMutation.mutate({ id: renamePicklist.id, name: renameName.trim(), adminOnly: isAdmin ? renameAdminOnly : undefined })}
              disabled={!renamePicklist || !renameName.trim() || renameMutation.isPending}
              data-testid="button-rename-picklist-submit"
            >
              {renameMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletePicklist} onOpenChange={(open) => !open && setDeletePicklist(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deletePicklist?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the picklist and its ranking. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePicklist && deleteMutation.mutate(deletePicklist.id)}
              data-testid="button-delete-picklist-confirm"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
