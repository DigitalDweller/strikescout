import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Calendar,
  Radio,
  Plus,
  Trash2,
  ArrowRight,
  Users,
  Loader2,
  MessageSquare,
  Map as MapIcon,
  Target,
  Shield,
  Gamepad2,
  ChevronUp,
  StickyNote,
} from "lucide-react";
import type { Event, Team, EventTeam, ScoutingEntry } from "@shared/schema";
import fieldImagePath from "@assets/6846b9eeb548474b11b6b16d828c2e6092a99131_1771896624665.png";
import heatmapFieldPath from "@assets/hehehehe_1771897335677.png";

function ReadOnlyAutoDrawing({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldImgRef = useRef<HTMLImageElement | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (fieldImgRef.current?.complete) {
      const img = fieldImgRef.current;
      const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    }
    let strokes: { x: number; y: number }[][] = [];
    try { strokes = JSON.parse(data); } catch {}
    if (!Array.isArray(strokes)) return;
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) {
      if (!Array.isArray(stroke) || stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }, [data]);

  useEffect(() => {
    const img = new Image();
    img.src = fieldImagePath;
    img.onload = () => { fieldImgRef.current = img; redraw(); };
    fieldImgRef.current = img;
  }, []);

  useEffect(() => { redraw(); }, [redraw]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={250}
      className="w-full rounded-md border border-border"
      style={{ aspectRatio: "400/250" }}
    />
  );
}

function ReadOnlyHeatmap({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldImgRef = useRef<HTMLImageElement | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, W, H);
    if (fieldImgRef.current?.complete) {
      const img = fieldImgRef.current;
      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    let points: { x: number; y: number }[] = [];
    try { points = JSON.parse(data); } catch {}
    if (!Array.isArray(points) || points.length === 0) return;
    const radius = 35;
    const grid = 4;
    const intensity: Record<string, number> = {};
    let maxI = 0;
    for (const p of points) {
      const gx = Math.floor((p.x * W) / grid);
      const gy = Math.floor((p.y * H) / grid);
      for (let dx = -Math.ceil(radius / grid); dx <= Math.ceil(radius / grid); dx++) {
        for (let dy = -Math.ceil(radius / grid); dy <= Math.ceil(radius / grid); dy++) {
          const cx = (gx + dx) * grid + grid / 2;
          const cy = (gy + dy) * grid + grid / 2;
          const dist = Math.sqrt((cx - p.x * W) ** 2 + (cy - p.y * H) ** 2);
          if (dist < radius) {
            const key = `${gx + dx},${gy + dy}`;
            const weight = 1 - dist / radius;
            intensity[key] = (intensity[key] || 0) + weight;
            if (intensity[key] > maxI) maxI = intensity[key];
          }
        }
      }
    }
    for (const [key, val] of Object.entries(intensity)) {
      const [gx, gy] = key.split(",").map(Number);
      const norm = val / maxI;
      const r = 255;
      const g = Math.floor((1 - norm) * 255);
      ctx.fillStyle = `rgba(${r}, ${g}, 0, ${Math.min(norm * 0.85 + 0.15, 0.95)})`;
      ctx.fillRect(gx * grid, gy * grid, grid, grid);
    }
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffffcc";
      ctx.fill();
    }
  }, [data]);

  useEffect(() => {
    const img = new Image();
    img.src = heatmapFieldPath;
    img.onload = () => { fieldImgRef.current = img; redraw(); };
    fieldImgRef.current = img;
  }, []);

  useEffect(() => { redraw(); }, [redraw]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={250}
      className="w-full rounded-md border border-border"
      style={{ aspectRatio: "400/250" }}
    />
  );
}

function NoteBlock({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function ScoutingEntryCard({
  entry,
  team,
  eventId,
}: {
  entry: ScoutingEntry;
  team?: Team;
  eventId: number;
}) {
  const hasAutoDrawing = !!entry.autoDrawing;
  const hasHeatmap = !!entry.teleopShootPosition;
  const hasAnyNotes = !!(entry.autoNotes || entry.defenseNotes || entry.driverSkillNotes || entry.notes);
  const hasAnyMaps = hasAutoDrawing || hasHeatmap;

  return (
    <Card data-testid={`card-entry-${entry.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-base font-bold px-3 py-1">
              M{entry.matchNumber}
            </Badge>
            {team && (
              <Link href={`/events/${eventId}/teams/${entry.teamId}`}>
                <span className="font-bold text-lg text-primary hover:underline cursor-pointer" data-testid={`link-team-${entry.teamId}`}>
                  #{team.teamNumber}
                </span>
                <span className="ml-2 font-medium text-base">{team.teamName}</span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge variant={entry.climbSuccess === "success" ? "default" : "secondary"}
              className={`font-semibold ${entry.climbSuccess === "success" ? "bg-green-600 text-white" : entry.climbSuccess === "failed" ? "bg-red-500/15 text-red-500" : ""}`}
            >
              <ChevronUp className="h-3 w-3 mr-1" />
              {entry.climbSuccess === "success" ? `Climb L${entry.climbLevel || "?"}` : entry.climbSuccess === "failed" ? "Climb Failed" : "No Climb"}
            </Badge>
            {entry.defenseRating > 0 && (
              <Badge variant="secondary" className="font-semibold">
                <Shield className="h-3 w-3 mr-1" />
                Def {entry.defenseRating}/10
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {hasAnyMaps && (
          <div className={`grid gap-3 ${hasAutoDrawing && hasHeatmap ? "sm:grid-cols-2" : "grid-cols-1"}`}>
            {hasAutoDrawing && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <MapIcon className="h-3 w-3" /> Auto Path
                </p>
                <ReadOnlyAutoDrawing data={entry.autoDrawing!} />
              </div>
            )}
            {hasHeatmap && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Target className="h-3 w-3" /> Shooting Positions
                </p>
                <ReadOnlyHeatmap data={entry.teleopShootPosition!} />
              </div>
            )}
          </div>
        )}

        {hasAnyNotes && (
          <div className="grid gap-2 sm:grid-cols-2">
            {entry.autoNotes && (
              <NoteBlock
                icon={<MapIcon className="h-3 w-3 text-muted-foreground" />}
                label="Auto Notes"
                text={entry.autoNotes}
              />
            )}
            {entry.defenseNotes && (
              <NoteBlock
                icon={<Shield className="h-3 w-3 text-muted-foreground" />}
                label="Defense Notes"
                text={entry.defenseNotes}
              />
            )}
            {entry.driverSkillNotes && (
              <NoteBlock
                icon={<Gamepad2 className="h-3 w-3 text-muted-foreground" />}
                label="Driver Skill"
                text={entry.driverSkillNotes}
              />
            )}
            {entry.notes && (
              <NoteBlock
                icon={<StickyNote className="h-3 w-3 text-muted-foreground" />}
                label="General Notes"
                text={entry.notes}
              />
            )}
          </div>
        )}

        {!hasAnyMaps && !hasAnyNotes && (
          <p className="text-sm text-muted-foreground italic">No drawings or notes recorded for this entry.</p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1 border-t">
          <span>Auto: <strong className="text-foreground">{entry.autoBallsShot}</strong> balls</span>
          <span>Teleop: <strong className="text-foreground">{entry.teleopBallsShot}</strong> balls</span>
          <span>Accuracy: <strong className="text-foreground">{entry.teleopAccuracy}/10</strong></span>
          {entry.teleopFpsEstimate > 0 && <span>FPS: <strong className="text-foreground">{entry.teleopFpsEstimate}</strong></span>}
          {entry.teleopMoveWhileShoot && <Badge variant="outline" className="text-xs">Moves while shooting</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminEventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const { toast } = useToast();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: eventTeams, isLoading: teamsLoading } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const { data: allTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const addTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/teams`, { teamId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
      setSelectedTeamId("");
      toast({ title: "Team added to event" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add team", description: error.message, variant: "destructive" });
    },
  });

  const removeTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
      toast({ title: "Team removed from event" });
    },
  });

  const eventTeamIds = new Set(eventTeams?.map((et) => et.teamId) || []);
  const availableTeams = allTeams?.filter((t) => !eventTeamIds.has(t.id)) || [];

  const teamMap = useMemo(() => {
    const m = new Map<number, Team>();
    allTeams?.forEach(t => m.set(t.id, t));
    return m;
  }, [allTeams]);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    let list = [...entries].sort((a, b) => b.matchNumber - a.matchNumber || b.id - a.id);
    if (teamFilter !== "all") {
      list = list.filter(e => e.teamId === parseInt(teamFilter));
    }
    return list;
  }, [entries, teamFilter]);

  if (eventLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-event-name">
              {event.name}
              {event.isActive && (
                <Badge variant="default" className="text-sm">
                  <Radio className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-base text-muted-foreground flex-wrap">
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </span>
              )}
              {event.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {event.startDate}
                </span>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="text-base font-bold px-3 py-1">
            Match {event.currentMatchNumber}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teams ({eventTeams?.length || 0})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableTeams.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="flex-1" data-testid="select-add-team">
                  <SelectValue placeholder="Select a team to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      #{team.teamNumber} - {team.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (selectedTeamId) addTeamMutation.mutate(parseInt(selectedTeamId));
                }}
                disabled={!selectedTeamId || addTeamMutation.isPending}
                data-testid="button-add-team"
              >
                {addTeamMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {teamsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : eventTeams?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No teams added to this event yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {eventTeams?.map((et) => (
                <div key={et.id} className="flex items-center gap-1 bg-muted/50 rounded-lg px-3 py-1.5" data-testid={`chip-team-${et.teamId}`}>
                  <Link href={`/events/${eventId}/teams/${et.teamId}`}>
                    <span className="font-bold text-primary hover:underline cursor-pointer">
                      #{et.team.teamNumber}
                    </span>
                    <span className="ml-1.5 font-medium text-sm">{et.team.teamName}</span>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 ml-1"
                    onClick={() => removeTeamMutation.mutate(et.teamId)}
                    data-testid={`button-remove-team-${et.teamId}`}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Scouting Feed
          </h2>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter-team">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {eventTeams?.map(et => (
                <SelectItem key={et.teamId} value={et.teamId.toString()}>
                  #{et.team.teamNumber} {et.team.teamName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!entries ? (
          <Skeleton className="h-48 w-full" />
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-lg">No scouting data yet</p>
              <p className="text-muted-foreground mt-1">
                {teamFilter !== "all" ? "No entries for this team — try a different filter" : "Head to the Scout tab to start recording match data"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map(entry => (
              <ScoutingEntryCard
                key={entry.id}
                entry={entry}
                team={teamMap.get(entry.teamId)}
                eventId={eventId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
