import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { toPct } from "@/lib/team-colors";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, Search, ClipboardList, User as UserIcon, Zap, Target, ArrowUp, Shield, MessageSquare } from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Event, Team, ScoutingEntry, EventTeam } from "@shared/schema";

type EntryWithScouter = ScoutingEntry & {
  scouter?: { id: number; displayName: string; username: string };
};

export default function FormHistory() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [editEntry, setEditEntry] = useState<EntryWithScouter | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<EntryWithScouter | null>(null);
  const [editForm, setEditForm] = useState<Partial<ScoutingEntry>>({});
  const help = useHelp();

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const entriesUrl = isAdmin
    ? `/api/events/${eventId}/entries`
    : `/api/events/${eventId}/entries?mine=true`;

  const { data: entries, isLoading } = useQuery<EntryWithScouter[]>({
    queryKey: [entriesUrl],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const teamMap = new Map<number, Team>();
  eventTeams?.forEach(et => teamMap.set(et.teamId, et.team));

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ScoutingEntry> }) => {
      await apiRequest("PATCH", `/api/entries/${id}`, data, { eventId });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [entriesUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scouters"] });
      if (variables.scouterId) queryClient.invalidateQueries({ queryKey: ["/api/users", variables.scouterId, "profile"] });
      toast({ title: "Entry updated" });
      setEditEntry(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: number; scouterId?: number }) => {
      await apiRequest("DELETE", `/api/entries/${id}`, undefined, { eventId });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [entriesUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scouters"] });
      if (variables.scouterId) queryClient.invalidateQueries({ queryKey: ["/api/users", variables.scouterId, "profile"] });
      toast({ title: "Entry deleted" });
      setDeleteEntry(null);
    },
  });

  const filtered = (entries || [])
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      const team = teamMap.get(e.teamId);
      const scouterName = e.scouter?.displayName?.toLowerCase() ?? "";
      const scouterUser = e.scouter?.username?.toLowerCase() ?? "";
      return (
        e.matchNumber.toString().includes(q) ||
        (team?.teamNumber.toString().includes(q)) ||
        (team?.teamName.toLowerCase().includes(q)) ||
        scouterName.includes(q) ||
        scouterUser.includes(q)
      );
    })
    .sort((a, b) => b.matchNumber - a.matchNumber || b.id - a.id);

  const openEdit = (entry: EntryWithScouter) => {
    setEditEntry(entry);
    setEditForm({
      matchNumber: entry.matchNumber,
      autoBallsShot: entry.autoBallsShot,
      autoAccuracy: ("autoAccuracy" in entry ? entry.autoAccuracy : undefined) ?? 0,
      autoNotes: entry.autoNotes,
      autoClimbSuccess: entry.autoClimbSuccess,
      teleopFpsEstimate: entry.teleopFpsEstimate,
      teleopAccuracy: entry.teleopAccuracy,
      teleopMoveWhileShoot: entry.teleopMoveWhileShoot,
      driverSkill: ("driverSkill" in entry ? entry.driverSkill : undefined) ?? 0,
      playedDefense: entry.playedDefense,
      climbSuccess: entry.climbSuccess,
      climbPosition: entry.climbPosition,
      climbLevel: entry.climbLevel,
      defenseRating: entry.defenseRating,
      defenseNotes: entry.defenseNotes,
      driverSkillNotes: entry.driverSkillNotes,
      notes: entry.notes,
    });
  };

  const saveEdit = () => {
    if (!editEntry) return;
    updateMutation.mutate({ id: editEntry.id, data: editForm });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto overflow-x-hidden">
      {/* Header - matches scouters-list & admin-event-detail */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-form-history-title">
          {isAdmin ? "Form History" : "My Form History"}
        </h1>
        <p className="text-muted-foreground text-base mt-1">
          {event ? `${event.name} — ${filtered.length} entries` : "Loading..."}
          {help?.HelpTrigger?.({
            content: {
              title: "Form history",
              body: <p>All scouting entries. Search by match, team, or scouter. Admins can edit or delete. Scouters see only their own entries.</p>,
            },
          })}
        </p>
      </div>

      {/* Section header with icon - matches admin-event-detail Recent scouting */}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-emerald-500" />
          Scouting entries
        </h2>
      </div>

      {/* Search - matches scouters-list */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by match, team, or scouter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-history"
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No entries found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {entries?.length === 0
                ? "No scouting entries yet. Start scouting matches to see them here."
                : "No entries match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-bold">Match</TableHead>
                    <TableHead className="text-sm font-bold">Team</TableHead>
                    {isAdmin && (
                      <TableHead className="text-sm font-bold">Scouter</TableHead>
                    )}
                    <TableHead className="text-center text-sm font-bold">Auto</TableHead>
                    <TableHead className="text-center text-sm font-bold">Throughput</TableHead>
                    <TableHead className="text-center text-sm font-bold">Accuracy</TableHead>
                    <TableHead className="text-center text-sm font-bold">Defense</TableHead>
                    <TableHead className="text-center text-sm font-bold">Climb</TableHead>
                    <TableHead className="text-sm font-bold w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => {
                    const team = teamMap.get(entry.teamId);
                    const scouter = entry.scouter;
                    return (
                      <TableRow
                        key={entry.id}
                        data-testid={`row-entry-${entry.id}`}
                        className="h-12 hover:bg-accent/50"
                      >
                        <TableCell className="font-bold text-base">M{entry.matchNumber}</TableCell>
                        <TableCell>
                          <span className="font-bold text-primary">{team?.teamNumber || "?"}</span>
                          <span className="ml-1.5 text-sm text-muted-foreground">{team?.teamName || ""}</span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            {scouter ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link href={`/events/${eventId}/scouters/${scouter.id}`}>
                                    <div className="flex items-center gap-2 group">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
                                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                      </div>
                                      <span className="font-medium text-sm">
                                        {scouter.displayName}
                                      </span>
                                    </div>
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{scouter.displayName}</p>
                                  <p className="text-xs text-muted-foreground">@{scouter.username}</p>
                                  <p className="text-xs text-primary mt-0.5">View profile →</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-center font-semibold">{entry.autoBallsShot}</TableCell>
                        <TableCell className="text-center font-semibold">{entry.teleopFpsEstimate}</TableCell>
                        <TableCell className="text-center font-semibold">{toPct(entry.teleopAccuracy ?? 0)}%</TableCell>
                        <TableCell className="text-center font-semibold">{entry.playedDefense ? `${toPct(entry.defenseRating ?? 0)}%` : "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={entry.climbSuccess === "success" ? "default" : "secondary"}
                            className={`text-xs font-semibold ${entry.climbSuccess === "success" ? "bg-green-600 text-white" : entry.climbSuccess === "failed" ? "bg-red-500/15 text-red-500" : ""}`}
                          >
                            {entry.climbSuccess === "success" ? "Yes" : entry.climbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => openEdit(entry)}
                                data-testid={`button-edit-${entry.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteEntry(entry)}
                                data-testid={`button-delete-${entry.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show scouter info for non-admins too - their own username */}
      {!isAdmin && user && (
        <p className="text-sm text-muted-foreground">
          Showing your entries as <span className="font-medium">{user.displayName}</span>
          {user.displayName !== user.username && (
            <span className="text-muted-foreground/80"> (@{user.username})</span>
          )}
        </p>
      )}

      <Dialog open={!!editEntry} onOpenChange={open => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          {/* Header with context */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border space-y-0 text-left">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                M{editEntry?.matchNumber}
              </Badge>
              <Badge variant="outline" className="text-sm font-semibold px-3 py-1 text-primary border-primary/40">
                Team {teamMap.get(editEntry?.teamId || 0)?.teamNumber || "?"}
              </Badge>
              {editEntry?.scouter && (
                <Link href={`/events/${eventId}/scouters/${editEntry.scouter.id}`}>
                  <Badge variant="outline" className="text-sm font-medium px-2.5 py-1 cursor-pointer hover:bg-accent/50 transition-colors">
                    <UserIcon className="h-3 w-3 mr-1.5" />
                    {editEntry.scouter.displayName}
                  </Badge>
                </Link>
              )}
            </div>
            <DialogTitle className="text-xl font-semibold">Edit Scouting Entry</DialogTitle>
            <DialogDescription>
              {teamMap.get(editEntry?.teamId || 0)?.teamName || ""}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="auto" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 w-fit shrink-0">
              <TabsTrigger value="auto" className="gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Auto
              </TabsTrigger>
              <TabsTrigger value="teleop" className="gap-1.5">
                <Target className="h-3.5 w-3.5 text-blue-500" />
                Teleop
              </TabsTrigger>
              <TabsTrigger value="endgame" className="gap-1.5">
                <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />
                Endgame
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                Notes
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-[280px] overflow-hidden">
              <TabsContent value="auto" className="mt-0 h-full data-[state=inactive]:hidden">
                <ScrollArea className="h-[280px]">
                  <div className="px-6 py-4 pr-8 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Match Number</Label>
                      <Input
                        type="number"
                        value={editForm.matchNumber || 0}
                        onChange={e => setEditForm(f => ({ ...f, matchNumber: parseInt(e.target.value) || 0 }))}
                        data-testid="input-edit-match"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Auto Balls Shot</Label>
                      <Input
                        type="number"
                        value={editForm.autoBallsShot || 0}
                        onChange={e => setEditForm(f => ({ ...f, autoBallsShot: parseInt(e.target.value) || 0 }))}
                        data-testid="input-edit-auto"
                      />
                    </div>
                  </div>
                  {(editForm.autoBallsShot ?? 0) >= 1 && (
                    <div className="space-y-2 rounded-lg border border-border/80 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Auto Accuracy</Label>
                        <Badge variant="secondary" className="tabular-nums">{editForm.autoAccuracy ?? 0}%</Badge>
                      </div>
                      <Slider
                        value={[Math.min(100, Math.max(0, editForm.autoAccuracy ?? 0))]}
                        onValueChange={([v]) => setEditForm(f => ({ ...f, autoAccuracy: v }))}
                        min={0}
                        max={100}
                        step={1}
                        data-testid="input-edit-auto-accuracy"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Auto Notes</Label>
                    <Textarea
                      value={editForm.autoNotes || ""}
                      onChange={e => setEditForm(f => ({ ...f, autoNotes: e.target.value }))}
                      rows={2}
                      className="resize-none"
                      data-testid="input-edit-auto-notes"
                    />
                  </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="teleop" className="mt-0 h-full data-[state=inactive]:hidden">
                <ScrollArea className="h-[280px]">
                  <div className="px-6 py-4 pr-8 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Throughput (balls/min)</Label>
                    <Input
                      type="number"
                      value={editForm.teleopFpsEstimate || 0}
                      onChange={e => setEditForm(f => ({ ...f, teleopFpsEstimate: parseInt(e.target.value) || 0 }))}
                      data-testid="input-edit-throughput"
                    />
                  </div>
                  <div className="space-y-2 rounded-lg border border-border/80 p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Accuracy</Label>
                      <Badge variant="secondary" className="tabular-nums">{toPct(editForm.teleopAccuracy ?? 0)}%</Badge>
                    </div>
                    <Slider
                      value={[toPct(editForm.teleopAccuracy ?? 0)]}
                      onValueChange={([v]) => setEditForm(f => ({ ...f, teleopAccuracy: v }))}
                      min={0}
                      max={100}
                      step={1}
                      data-testid="input-edit-accuracy"
                    />
                  </div>
                  <div className="space-y-2 rounded-lg border border-border/80 p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Driver Skill</Label>
                      <Badge variant="secondary" className="tabular-nums">{(editForm.driverSkill ?? 0)}%</Badge>
                    </div>
                    <Slider
                      value={[Math.min(100, Math.max(0, editForm.driverSkill ?? 0))]}
                      onValueChange={([v]) => setEditForm(f => ({ ...f, driverSkill: v }))}
                      min={0}
                      max={100}
                      step={1}
                      data-testid="input-edit-driver-skill"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Driver Skill Notes</Label>
                    <Textarea
                      value={editForm.driverSkillNotes || ""}
                      onChange={e => setEditForm(f => ({ ...f, driverSkillNotes: e.target.value }))}
                      rows={2}
                      className="resize-none"
                      data-testid="input-edit-driver-notes"
                    />
                  </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="endgame" className="mt-0 h-full data-[state=inactive]:hidden">
                <ScrollArea className="h-[280px]">
                  <div className="px-6 py-4 pr-8 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Climb Result</Label>
                    <Select
                      value={editForm.climbSuccess || "none"}
                      onValueChange={v => setEditForm(f => ({ ...f, climbSuccess: v }))}
                    >
                      <SelectTrigger data-testid="select-edit-climb">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(editForm.climbSuccess && editForm.climbSuccess !== "none") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Climb Position</Label>
                        <Select
                          value={editForm.climbPosition || "middle"}
                          onValueChange={v => setEditForm(f => ({ ...f, climbPosition: v }))}
                        >
                          <SelectTrigger data-testid="select-edit-climb-pos">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="middle">Middle</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Climb Level</Label>
                        <Select
                          value={editForm.climbLevel || "1"}
                          onValueChange={v => setEditForm(f => ({ ...f, climbLevel: v }))}
                        >
                          <SelectTrigger data-testid="select-edit-climb-level">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Level 1</SelectItem>
                            <SelectItem value="2">Level 2</SelectItem>
                            <SelectItem value="3">Level 3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between gap-3 py-1">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-500" />
                      Played Defense?
                    </Label>
                    <div className="flex gap-1.5 shrink-0">
                      {([{ value: true, label: "Yes" }, { value: false, label: "No" }] as const).map(({ value, label }) => (
                        <Button key={String(value)} type="button" variant="outline" size="sm" className={`h-9 px-3 text-sm ${editForm.playedDefense === value ? (value ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white dark:bg-emerald-500 dark:border-emerald-500 dark:hover:bg-emerald-600" : "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 hover:text-muted-foreground") : ""}`} onClick={() => setEditForm(f => ({ ...f, playedDefense: value, ...(value ? {} : { defenseRating: 0, defenseNotes: "" }) }))} data-testid={`button-edit-played-defense-${value}`}>{label}</Button>
                      ))}
                    </div>
                  </div>
                  {(editForm.playedDefense ?? false) && (
                    <div className="space-y-2 rounded-lg border border-border/80 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Defense Rating</Label>
                        <Badge variant="secondary" className="tabular-nums">{toPct(editForm.defenseRating ?? 0)}%</Badge>
                      </div>
                      <Slider
                        value={[toPct(editForm.defenseRating ?? 0)]}
                        onValueChange={([v]) => setEditForm(f => ({ ...f, defenseRating: v }))}
                        min={0}
                        max={100}
                        step={1}
                        data-testid="input-edit-defense"
                      />
                      <div className="mt-3 space-y-1.5">
                        <Label className="text-sm font-medium">Defense Notes</Label>
                        <Textarea
                          value={editForm.defenseNotes || ""}
                          onChange={e => setEditForm(f => ({ ...f, defenseNotes: e.target.value }))}
                          rows={2}
                          className="resize-none"
                          data-testid="input-edit-defense-notes"
                        />
                      </div>
                    </div>
                  )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="notes" className="mt-0 h-full data-[state=inactive]:hidden">
                <ScrollArea className="h-[280px]">
                  <div className="px-6 py-4 pr-8">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Additional Notes</Label>
                    <Textarea
                      value={editForm.notes || ""}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      rows={4}
                      className="resize-none"
                      placeholder="Any other observations about this match..."
                      data-testid="input-edit-notes"
                    />
                  </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={() => setEditEntry(null)} data-testid="button-cancel-edit">Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEntry} onOpenChange={open => { if (!open) setDeleteEntry(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the scouting entry for Match {deleteEntry?.matchNumber} · Team {teamMap.get(deleteEntry?.teamId || 0)?.teamNumber || "?"}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteEntry && deleteMutation.mutate({ id: deleteEntry.id, scouterId: deleteEntry.scouterId })}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
