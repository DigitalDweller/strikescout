import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X, GripVertical, Search, ListOrdered } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Team, EventTeam, PicklistEntry } from "@shared/schema";
import placeholderAvatar from "@assets/images_1772071870956.png";

type PicklistWithTeam = PicklistEntry & { team: Team };
type EventTeamWithTeam = EventTeam & { team: Team };

type DragSource = { type: "available"; teamId: number } | { type: "picklist"; idx: number };

function getHeatColor(value: number, min: number, max: number) {
  if (max === min) return "";
  const norm = (value - min) / (max - min);

  if (norm >= 0.95) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300";
  if (norm >= 0.85) return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
  if (norm >= 0.7) return "bg-green-500/20 text-green-700 dark:text-green-300";
  if (norm >= 0.55) return "bg-green-500/10 text-green-600 dark:text-green-400";
  if (norm >= 0.4) return "";
  if (norm >= 0.2) return "bg-red-500/10 text-red-600 dark:text-red-400";
  return "bg-red-500/20 text-red-700 dark:text-red-300";
}

function getRowBorderColor(value: number, min: number, max: number) {
  if (max === min) return "border-l-transparent";
  const norm = (value - min) / (max - min);

  if (norm >= 0.95) return "border-l-yellow-500";
  if (norm >= 0.85) return "border-l-yellow-400";
  if (norm >= 0.7) return "border-l-green-500";
  if (norm >= 0.55) return "border-l-green-400";
  if (norm >= 0.4) return "border-l-transparent";
  if (norm >= 0.2) return "border-l-red-400";
  return "border-l-red-500";
}

export default function Picklist() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const [search, setSearch] = useState("");
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<"picklist" | null>(null);
  const dragSourceRef = useRef<DragSource | null>(null);

  const { data: eventTeams, isLoading: teamsLoading } = useQuery<EventTeamWithTeam[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: picklist, isLoading: picklistLoading } = useQuery<PicklistWithTeam[]>({
    queryKey: ["/api/events", eventId, "picklist"],
  });

  const oprRange = useMemo(() => {
    if (!eventTeams) return null;
    const oprs = eventTeams.map(et => et.opr ?? 0).filter(v => v !== 0);
    if (oprs.length === 0) return null;
    return { min: Math.min(...oprs), max: Math.max(...oprs) };
  }, [eventTeams]);

  const picklistTeamIds = useMemo(() => {
    return new Set(picklist?.map(p => p.teamId) || []);
  }, [picklist]);

  const availableTeams = useMemo(() => {
    if (!eventTeams) return [];
    const available = eventTeams.filter(et => !picklistTeamIds.has(et.teamId));
    if (!search.trim()) return available.sort((a, b) => (b.opr ?? 0) - (a.opr ?? 0));
    const q = search.toLowerCase();
    return available
      .filter(et =>
        et.team.teamNumber.toString().includes(q) ||
        et.team.teamName.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.opr ?? 0) - (a.opr ?? 0));
  }, [eventTeams, picklistTeamIds, search]);

  const updatePicklist = useCallback(async (teamIds: number[]) => {
    queryClient.setQueryData(["/api/events", eventId, "picklist"], (old: PicklistWithTeam[] | undefined) => {
      if (!old) return old;
      return teamIds.map((tid, i) => {
        const existing = old.find(p => p.teamId === tid);
        if (existing) return { ...existing, rank: i + 1 };
        const et = eventTeams?.find(e => e.teamId === tid);
        return { id: -1, eventId, teamId: tid, rank: i + 1, tier: "pick", team: et?.team || { id: tid, teamNumber: 0, teamName: "", city: null, stateProv: null, country: null, avatar: null } } as PicklistWithTeam;
      });
    });
    await apiRequest("PUT", `/api/events/${eventId}/picklist`, { teamIds });
    queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "picklist"] });
  }, [eventId, eventTeams]);

  const addTeam = useCallback(async (teamId: number) => {
    const currentIds = picklist?.map(p => p.teamId) || [];
    await updatePicklist([...currentIds, teamId]);
  }, [picklist, updatePicklist]);

  const addTeamAtPosition = useCallback(async (teamId: number, position: number) => {
    const currentIds = picklist?.map(p => p.teamId) || [];
    const newIds = [...currentIds];
    newIds.splice(position, 0, teamId);
    await updatePicklist(newIds);
  }, [picklist, updatePicklist]);

  const removeTeam = useCallback(async (teamId: number) => {
    const currentIds = picklist?.map(p => p.teamId) || [];
    await updatePicklist(currentIds.filter(id => id !== teamId));
  }, [picklist, updatePicklist]);

  const handleDragStart = (source: DragSource, e: React.DragEvent) => {
    setDragSource(source);
    dragSourceRef.current = source;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(source));
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
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

  const handlePicklistDrop = async (idx: number) => {
    const src = dragSourceRef.current;
    if (!src || !picklist) return;

    if (src.type === "picklist") {
      if (src.idx === idx) return;
      const ids = picklist.map(p => p.teamId);
      const [moved] = ids.splice(src.idx, 1);
      ids.splice(idx, 0, moved);
      resetDrag();
      await updatePicklist(ids);
    } else if (src.type === "available") {
      resetDrag();
      await addTeamAtPosition(src.teamId, idx);
    }
  };

  const handlePicklistPanelDrop = async () => {
    const src = dragSourceRef.current;
    if (!src) return;
    if (src.type === "available") {
      resetDrag();
      await addTeam(src.teamId);
    } else {
      resetDrag();
    }
  };

  const resetDrag = () => {
    setDragSource(null);
    setDragOverIdx(null);
    setDragOverPanel(null);
    dragSourceRef.current = null;
  };

  const getTeamEventData = useCallback((teamId: number) => {
    return eventTeams?.find(e => e.teamId === teamId);
  }, [eventTeams]);

  const getTeamColor = useCallback((teamId: number) => {
    const et = eventTeams?.find(e => e.teamId === teamId);
    if (!et || !oprRange) return { bg: "", border: "" };
    const opr = et.opr ?? 0;
    return {
      bg: getHeatColor(opr, oprRange.min, oprRange.max),
      border: getRowBorderColor(opr, oprRange.min, oprRange.max),
    };
  }, [eventTeams, oprRange]);

  const isLoading = teamsLoading || picklistLoading;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-picklist-title">
          <ListOrdered className="h-7 w-7" />
          Picklist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drag teams to rank for alliance selection. {picklist?.length || 0} of {eventTeams?.length || 0} teams ranked.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="md:col-span-2 flex flex-col" data-testid="panel-available">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Available Teams</CardTitle>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
                data-testid="input-search-available"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-[60vh] space-y-0.5 pt-0 custom-scrollbar">
            {availableTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {picklistTeamIds.size === (eventTeams?.length || 0)
                  ? "All teams have been added"
                  : "No teams match your search"}
              </p>
            ) : (
              availableTeams.map(et => {
                const rank = (et as any).rank;
                const isDragging = dragSource?.type === "available" && dragSource.teamId === et.teamId;
                const colors = getTeamColor(et.teamId);
                return (
                  <div
                    key={et.teamId}
                    draggable
                    onDragStart={e => handleDragStart({ type: "available", teamId: et.teamId }, e)}
                    onDragEnd={resetDrag}
                    className={`flex items-center gap-2 p-2 rounded-md transition-colors group cursor-grab active:cursor-grabbing border-l-3 ${colors.border} ${colors.bg || "hover:bg-muted/50"} ${isDragging ? "opacity-30" : ""}`}
                    data-testid={`available-team-${et.teamId}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <img
                      src={et.team.avatar || placeholderAvatar}
                      alt={`Team ${et.team.teamNumber}`}
                      className="w-8 h-8 rounded-full border border-border object-cover bg-white shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{et.team.teamNumber} - {et.team.teamName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {et.opr != null && <span>OPR: <span className="font-semibold text-foreground/80">{et.opr.toFixed(1)}</span></span>}
                        {rank != null && <span>#{rank}</span>}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                      onClick={() => addTeam(et.teamId)}
                      data-testid={`button-add-${et.teamId}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card
          className={`md:col-span-3 flex flex-col transition-colors ${dragOverPanel === "picklist" && dragSource?.type === "available" ? "ring-2 ring-primary/30" : ""}`}
          data-testid="panel-picklist"
          onDragOver={handlePicklistPanelDragOver}
          onDragLeave={e => { if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverPanel(null); setDragOverIdx(null); } }}
          onDrop={e => { e.preventDefault(); handlePicklistPanelDrop(); }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Your Picklist</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-[60vh] space-y-0.5 pt-0 custom-scrollbar">
            {!picklist || picklist.length === 0 ? (
              <div className={`text-center py-12 rounded-lg border-2 border-dashed transition-colors ${dragOverPanel === "picklist" && dragSource?.type === "available" ? "border-primary/50 bg-primary/5" : "border-transparent"}`}>
                <ListOrdered className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-lg">No teams ranked yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag teams here or click + to start building your picklist
                </p>
              </div>
            ) : (
              picklist.map((entry, idx) => {
                const et = getTeamEventData(entry.teamId);
                const tbaRank = (et as any)?.rank;
                const isDragging = dragSource?.type === "picklist" && dragSource.idx === idx;
                const isDragOver = dragOverIdx === idx && dragOverPanel === "picklist";
                const colors = getTeamColor(entry.teamId);
                return (
                  <div
                    key={entry.teamId}
                    draggable
                    onDragStart={e => handleDragStart({ type: "picklist", idx }, e)}
                    onDragOver={e => handlePicklistDragOver(e, idx)}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); handlePicklistDrop(idx); }}
                    onDragEnd={resetDrag}
                    className={`flex items-center gap-2 p-2 rounded-md transition-all cursor-grab active:cursor-grabbing border-l-3 ${colors.border} ${
                      isDragging ? "opacity-30" : ""
                    } ${isDragOver ? "bg-primary/10 border border-primary/30" : `${colors.bg || "hover:bg-muted/50"} border border-transparent`}`}
                    data-testid={`picklist-row-${idx}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-bold text-muted-foreground w-6 text-center shrink-0">
                      {idx + 1}
                    </span>
                    <img
                      src={entry.team.avatar || placeholderAvatar}
                      alt={`Team ${entry.team.teamNumber}`}
                      className="w-8 h-8 rounded-full border border-border object-cover bg-white shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{entry.team.teamNumber} - {entry.team.teamName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {et?.opr != null && <span>OPR: <span className="font-semibold text-foreground/80">{et.opr.toFixed(1)}</span></span>}
                        {tbaRank != null && <span>#{tbaRank}</span>}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 opacity-50 hover:opacity-100 hover:text-red-500 transition-all"
                      onClick={() => removeTeam(entry.teamId)}
                      data-testid={`button-remove-${entry.teamId}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
