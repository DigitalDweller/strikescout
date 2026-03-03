import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { toPct } from "@/lib/team-colors";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Pencil, Trash2, Search, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Event, Team, ScoutingEntry, EventTeam } from "@shared/schema";

export default function FormHistory() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [editEntry, setEditEntry] = useState<ScoutingEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<ScoutingEntry | null>(null);
  const [editForm, setEditForm] = useState<Partial<ScoutingEntry>>({});

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const entriesUrl = isAdmin
    ? `/api/events/${eventId}/entries`
    : `/api/events/${eventId}/entries?mine=true`;

  const { data: entries, isLoading } = useQuery<ScoutingEntry[]>({
    queryKey: [entriesUrl],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const teamMap = new Map<number, Team>();
  eventTeams?.forEach(et => teamMap.set(et.teamId, et.team));

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ScoutingEntry> }) => {
      await apiRequest("PATCH", `/api/entries/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entriesUrl] });
      toast({ title: "Entry updated" });
      setEditEntry(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entriesUrl] });
      toast({ title: "Entry deleted" });
      setDeleteEntry(null);
    },
  });

  const filtered = (entries || [])
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      const team = teamMap.get(e.teamId);
      return (
        e.matchNumber.toString().includes(q) ||
        (team?.teamNumber.toString().includes(q)) ||
        (team?.teamName.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => b.matchNumber - a.matchNumber || b.id - a.id);

  const openEdit = (entry: ScoutingEntry) => {
    setEditEntry(entry);
    setEditForm({
      matchNumber: entry.matchNumber,
      autoBallsShot: entry.autoBallsShot,
      autoNotes: entry.autoNotes,
      autoClimbSuccess: entry.autoClimbSuccess,
      teleopFpsEstimate: entry.teleopFpsEstimate,
      teleopAccuracy: entry.teleopAccuracy,
      teleopMoveWhileShoot: entry.teleopMoveWhileShoot,
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
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-form-history-title">
          <History className="h-6 w-6" />
          {isAdmin ? "Form History" : "My Form History"}
        </h1>
        {event && (
          <p className="text-sm text-muted-foreground mt-1">{event.name} &middot; {filtered.length} entries</p>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by match number or team..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-history"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-base text-muted-foreground">
              {entries?.length === 0 ? "No scouting entries yet." : "No entries match your search."}
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
                    <TableHead className="text-center text-sm font-bold">Auto</TableHead>
                    <TableHead className="text-center text-sm font-bold">Throughput</TableHead>
                    <TableHead className="text-center text-sm font-bold">Accuracy</TableHead>
                    <TableHead className="text-center text-sm font-bold">Defense</TableHead>
                    <TableHead className="text-center text-sm font-bold">Climb</TableHead>
                    <TableHead className="text-sm font-bold w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(entry => {
                    const team = teamMap.get(entry.teamId);
                    return (
                      <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                        <TableCell className="font-bold text-base">M{entry.matchNumber}</TableCell>
                        <TableCell>
                          <span className="font-bold text-primary">{team?.teamNumber || "?"}</span>
                          <span className="ml-1.5 text-sm text-muted-foreground">{team?.teamName || ""}</span>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{entry.autoBallsShot}</TableCell>
                        <TableCell className="text-center font-semibold">{entry.teleopFpsEstimate}</TableCell>
                        <TableCell className="text-center font-semibold">{toPct(entry.teleopAccuracy ?? 0)}%</TableCell>
                        <TableCell className="text-center font-semibold">{toPct(entry.defenseRating ?? 0)}%</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={entry.climbSuccess === "success" ? "default" : "secondary"}
                            className={`text-xs font-semibold ${entry.climbSuccess === "success" ? "bg-green-600 text-white" : entry.climbSuccess === "failed" ? "bg-red-500/15 text-red-500" : ""}`}
                          >
                            {entry.climbSuccess === "success" ? "Yes" : entry.climbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>
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

      <Dialog open={!!editEntry} onOpenChange={open => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Entry — M{editEntry?.matchNumber} · {teamMap.get(editEntry?.teamId || 0)?.teamNumber || "?"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Match Number</Label>
                <Input
                  type="number"
                  value={editForm.matchNumber || 0}
                  onChange={e => setEditForm(f => ({ ...f, matchNumber: parseInt(e.target.value) || 0 }))}
                  data-testid="input-edit-match"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Auto Balls Shot</Label>
                <Input
                  type="number"
                  value={editForm.autoBallsShot || 0}
                  onChange={e => setEditForm(f => ({ ...f, autoBallsShot: parseInt(e.target.value) || 0 }))}
                  data-testid="input-edit-auto"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Throughput</Label>
                <Input
                  type="number"
                  value={editForm.teleopFpsEstimate || 0}
                  onChange={e => setEditForm(f => ({ ...f, teleopFpsEstimate: parseInt(e.target.value) || 0 }))}
                  data-testid="input-edit-throughput"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Accuracy (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={editForm.teleopAccuracy || 0}
                  onChange={e => setEditForm(f => ({ ...f, teleopAccuracy: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  data-testid="input-edit-accuracy"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Defense (0-10)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={editForm.defenseRating || 0}
                  onChange={e => setEditForm(f => ({ ...f, defenseRating: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  data-testid="input-edit-defense"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Climb</Label>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Auto Notes</Label>
              <Textarea
                value={editForm.autoNotes || ""}
                onChange={e => setEditForm(f => ({ ...f, autoNotes: e.target.value }))}
                rows={2}
                data-testid="input-edit-auto-notes"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Driver Skill Notes</Label>
              <Textarea
                value={editForm.driverSkillNotes || ""}
                onChange={e => setEditForm(f => ({ ...f, driverSkillNotes: e.target.value }))}
                rows={2}
                data-testid="input-edit-driver-notes"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Defense Notes</Label>
              <Textarea
                value={editForm.defenseNotes || ""}
                onChange={e => setEditForm(f => ({ ...f, defenseNotes: e.target.value }))}
                rows={2}
                data-testid="input-edit-defense-notes"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Misc.</Label>
              <Textarea
                value={editForm.notes || ""}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
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
              onClick={() => deleteEntry && deleteMutation.mutate(deleteEntry.id)}
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
