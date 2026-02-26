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

export default function Picklist() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const [search, setSearch] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const { data: eventTeams, isLoading: teamsLoading } = useQuery<EventTeamWithTeam[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: picklist, isLoading: picklistLoading } = useQuery<PicklistWithTeam[]>({
    queryKey: ["/api/events", eventId, "picklist"],
  });

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

  const removeTeam = useCallback(async (teamId: number) => {
    const currentIds = picklist?.map(p => p.teamId) || [];
    await updatePicklist(currentIds.filter(id => id !== teamId));
  }, [picklist, updatePicklist]);

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
    dragRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    const from = dragRef.current;
    if (from === null || from === idx || !picklist) return;
    const ids = picklist.map(p => p.teamId);
    const [moved] = ids.splice(from, 1);
    ids.splice(idx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    dragRef.current = null;
    await updatePicklist(ids);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
    dragRef.current = null;
  };

  const getTeamEventData = useCallback((teamId: number) => {
    const et = eventTeams?.find(e => e.teamId === teamId);
    return et;
  }, [eventTeams]);

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
          Drag to rank teams for alliance selection. {picklist?.length || 0} of {eventTeams?.length || 0} teams ranked.
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
          <CardContent className="flex-1 overflow-auto max-h-[60vh] space-y-0.5 pt-0">
            {availableTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {picklistTeamIds.size === (eventTeams?.length || 0)
                  ? "All teams have been added"
                  : "No teams match your search"}
              </p>
            ) : (
              availableTeams.map(et => {
                const rp = (et as any).rankingPoints;
                const rank = (et as any).rank;
                return (
                  <div
                    key={et.teamId}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                    data-testid={`available-team-${et.teamId}`}
                  >
                    <img
                      src={et.team.avatar || placeholderAvatar}
                      alt={`Team ${et.team.teamNumber}`}
                      className="w-8 h-8 rounded-full border border-border object-cover bg-white shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{et.team.teamNumber} - {et.team.teamName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {et.opr != null && <span>OPR: <span className="font-semibold text-foreground/80">{et.opr.toFixed(1)}</span></span>}
                        {rp != null && <span>RP: <span className="font-semibold text-foreground/80">{rp.toFixed(1)}</span></span>}
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

        <Card className="md:col-span-3 flex flex-col" data-testid="panel-picklist">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Your Picklist</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-[60vh] space-y-0.5 pt-0">
            {!picklist || picklist.length === 0 ? (
              <div className="text-center py-12">
                <ListOrdered className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-lg">No teams ranked yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click + on teams from the left panel to start building your picklist
                </p>
              </div>
            ) : (
              picklist.map((entry, idx) => {
                const et = getTeamEventData(entry.teamId);
                const rp = (et as any)?.rankingPoints;
                const tbaRank = (et as any)?.rank;
                const isDragging = dragIdx === idx;
                const isDragOver = dragOverIdx === idx;
                return (
                  <div
                    key={entry.teamId}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-2 rounded-md transition-all cursor-grab active:cursor-grabbing ${
                      isDragging ? "opacity-30" : ""
                    } ${isDragOver ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}
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
                        {rp != null && <span>RP: <span className="font-semibold text-foreground/80">{rp.toFixed(1)}</span></span>}
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
