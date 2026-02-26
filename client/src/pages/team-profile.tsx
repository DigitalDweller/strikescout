import { useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, MessageSquare } from "lucide-react";
import type { Event, Team, ScoutingEntry, EventTeam } from "@shared/schema";
import heatmapFieldPath from "@assets/hehehehe_1771897335677.png";
import placeholderAvatar from "@assets/images_1772071870956.png";

function AggregateHeatmap({ entries }: { entries: ScoutingEntry[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldImgRef = useRef<HTMLImageElement | null>(null);

  const allPoints = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (const entry of entries) {
      if (entry.teleopShootPosition) {
        try {
          const parsed = JSON.parse(entry.teleopShootPosition);
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              if (typeof p.x === "number" && typeof p.y === "number") {
                pts.push(p);
              }
            }
          }
        } catch {}
      }
    }
    return pts;
  }, [entries]);

  const draw = useCallback(() => {
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

    if (allPoints.length > 0) {
      const radius = 35;
      const grid = 4;
      const intensity: Record<string, number> = {};
      let maxI = 0;
      for (const p of allPoints) {
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

      for (const p of allPoints) {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffffaa";
        ctx.fill();
      }
    }
  }, [allPoints]);

  useEffect(() => {
    const img = new Image();
    img.src = heatmapFieldPath;
    img.onload = () => { fieldImgRef.current = img; draw(); };
    fieldImgRef.current = img;
  }, []);

  useEffect(() => { draw(); }, [draw]);

  if (allPoints.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/30 flex items-center justify-center" style={{ aspectRatio: "400/250" }}>
        <p className="text-sm text-muted-foreground">No shooting data yet</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={250}
      className="w-full rounded-md border border-border"
      style={{ aspectRatio: "400/250" }}
      data-testid="canvas-aggregate-heatmap"
    />
  );
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getRankColor(rank: number, total: number) {
  if (total === 0) return "text-muted-foreground";
  const pct = ((rank - 1) / Math.max(total - 1, 1)) * 100;
  if (pct <= 10) return "text-yellow-500";
  if (pct <= 25) return "text-green-500";
  if (pct <= 50) return "text-blue-500";
  return "text-muted-foreground";
}

function getRankValueColor(rank: number, total: number) {
  if (total === 0) return "text-foreground/60";
  const pct = ((rank - 1) / Math.max(total - 1, 1)) * 100;
  if (pct <= 10) return "text-yellow-500 dark:text-yellow-400";
  if (pct <= 25) return "text-green-600 dark:text-green-400";
  if (pct <= 50) return "text-blue-600 dark:text-blue-400";
  return "text-foreground/60";
}

function getRankBgColor(rank: number, total: number) {
  if (total === 0) return "bg-muted/30";
  const pct = ((rank - 1) / Math.max(total - 1, 1)) * 100;
  if (pct <= 10) return "bg-yellow-500/10 dark:bg-yellow-400/10";
  if (pct <= 25) return "bg-green-500/10 dark:bg-green-400/10";
  if (pct <= 50) return "bg-blue-500/10 dark:bg-blue-400/10";
  return "bg-muted/30";
}

function MatchBar({ value, maxVal, color, suffix }: {
  value: number;
  maxVal: number;
  color: string;
  suffix?: string;
}) {
  const pct = maxVal > 0 ? Math.max((value / maxVal) * 100, 2) : 2;
  return (
    <div className="flex items-center gap-0.5 min-w-0 flex-1">
      <div className="flex-1 h-4 bg-muted/40 rounded-sm overflow-hidden">
        <div className={`h-full rounded-sm ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-muted-foreground w-7 text-right shrink-0">{value}{suffix || ""}</span>
    </div>
  );
}

function PerMatchChart({ entries, title, bars }: {
  entries: ScoutingEntry[];
  title: string;
  bars: { field: (e: ScoutingEntry) => number; color: string; label: string; max?: number; suffix?: string }[];
}) {
  const sorted = [...entries].sort((a, b) => b.matchNumber - a.matchNumber);
  if (sorted.length === 0) return null;

  const maxVals = bars.map(b => {
    if (b.max !== undefined) return b.max;
    return Math.max(...sorted.map(e => b.field(e)), 1);
  });

  const gridClass = bars.length === 3 ? "grid grid-cols-3 gap-3" : bars.length === 2 ? "grid grid-cols-2 gap-3" : "flex";

  return (
    <div className="space-y-1.5" data-testid={`chart-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            <span className="text-xs font-bold w-7 shrink-0 text-muted-foreground">M{entry.matchNumber}</span>
            <div className={`flex-1 ${gridClass}`}>
              {bars.map((b, i) => (
                <MatchBar
                  key={i}
                  value={b.field(entry)}
                  maxVal={maxVals[i]}
                  color={b.color}
                  suffix={b.suffix}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClimbChart({ entries }: { entries: ScoutingEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.matchNumber - a.matchNumber);
  if (sorted.length === 0) return null;

  return (
    <div className="space-y-1.5" data-testid="chart-climb">
      <div className="space-y-1">
        {sorted.map((entry) => {
          const isSuccess = entry.climbSuccess === "success";
          const isFailed = entry.climbSuccess === "failed";
          const bgColor = isSuccess ? "bg-green-500" : isFailed ? "bg-red-400" : "bg-muted-foreground/30";
          const label = isSuccess ? `L${entry.climbLevel || "?"}` : isFailed ? "Failed" : "None";
          const width = isSuccess ? "100%" : isFailed ? "50%" : "15%";

          return (
            <div key={entry.id} className="flex items-center gap-2">
              <span className="text-xs font-bold w-7 shrink-0 text-muted-foreground">M{entry.matchNumber}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-5 bg-muted/40 rounded-sm overflow-hidden">
                  <div className={`h-full rounded-sm ${bgColor}`} style={{ width }} />
                </div>
                <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${isSuccess ? "text-green-600 dark:text-green-400" : isFailed ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default function TeamProfile() {
  const { id: eid, teamId: tid } = useParams<{ id: string; teamId: string }>();
  const eventId = parseInt(eid!);
  const teamId = parseInt(tid!);

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: entries, isLoading } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "teams", teamId, "entries"],
  });

  const { data: allEntries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
  });

  const team = teams?.find((t) => t.id === teamId);

  const avgAutoBalls = entries?.length
    ? parseFloat((entries.reduce((s, e) => s + e.autoBallsShot, 0) / entries.length).toFixed(1)).toString()
    : "0";
  const avgThroughput = entries?.length
    ? parseFloat((entries.reduce((s, e) => s + e.teleopFpsEstimate, 0) / entries.length).toFixed(1)).toString()
    : "0";
  const avgAccuracy = entries?.length
    ? Math.round(entries.reduce((s, e) => s + e.teleopAccuracy, 0) / entries.length * 10)
    : 0;
  const avgDefense = entries?.length
    ? Math.round(entries.reduce((s, e) => s + e.defenseRating, 0) / entries.length * 10)
    : 0;
  const climbRate = entries?.length
    ? Math.round((entries.filter((e) => e.climbSuccess === "success").length / entries.length) * 100)
    : 0;

  const rankings = useMemo(() => {
    if (!allEntries || !eventTeams) return null;

    const teamIds = eventTeams.map(et => et.teamId);
    const statsMap = new Map<number, {
      avgAuto: number;
      avgThroughput: number;
      avgAccuracy: number;
      avgDefense: number;
      climbRate: number;
      avgClimbLevel: number;
    }>();

    for (const tid of teamIds) {
      const te = allEntries.filter(e => e.teamId === tid);
      const count = te.length;
      if (count === 0) {
        statsMap.set(tid, { avgAuto: 0, avgThroughput: 0, avgAccuracy: 0, avgDefense: 0, climbRate: 0, avgClimbLevel: 0 });
      } else {
        const climbs = te.filter(e => e.climbSuccess === "success");
        statsMap.set(tid, {
          avgAuto: te.reduce((s, e) => s + e.autoBallsShot, 0) / count,
          avgThroughput: te.reduce((s, e) => s + e.teleopFpsEstimate, 0) / count,
          avgAccuracy: te.reduce((s, e) => s + e.teleopAccuracy, 0) / count * 10,
          avgDefense: te.reduce((s, e) => s + e.defenseRating, 0) / count * 10,
          climbRate: climbs.length / count * 100,
          avgClimbLevel: climbs.length > 0 ? climbs.reduce((s, e) => s + (parseInt(e.climbLevel || "0") || 0), 0) / climbs.length : 0,
        });
      }
    }

    const total = teamIds.length;

    function getRank(field: string) {
      const sorted = [...teamIds].sort((a, b) => {
        const sa = statsMap.get(a) as any;
        const sb = statsMap.get(b) as any;
        if (field === "climbRate") {
          const diff = (sb?.climbRate || 0) - (sa?.climbRate || 0);
          if (diff !== 0) return diff;
          return (sb?.avgClimbLevel || 0) - (sa?.avgClimbLevel || 0);
        }
        return (sb?.[field] || 0) - (sa?.[field] || 0);
      });
      return sorted.indexOf(teamId) + 1;
    }

    return {
      total,
      autoRank: getRank("avgAuto"),
      throughputRank: getRank("avgThroughput"),
      accuracyRank: getRank("avgAccuracy"),
      defenseRank: getRank("avgDefense"),
      climbRank: getRank("climbRate"),
    };
  }, [allEntries, eventTeams, teamId]);

  const last2 = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    return [...entries].sort((a, b) => b.matchNumber - a.matchNumber).slice(0, 2);
  }, [entries]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href={`/events/${eventId}/teams`}>
          <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-event">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Teams
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          {team ? (
            <img src={team.avatar || placeholderAvatar} alt={`Team ${team.teamNumber}`} className="w-12 h-12 rounded-lg border border-border object-cover bg-white" data-testid="img-team-avatar" />
          ) : null}
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-team-name">
              {team ? `${team.teamNumber} - ${team.teamName}` : <Skeleton className="h-9 w-56 inline-block" />}
            </h1>
            {event && (
              <p className="text-base text-muted-foreground mt-1">{event.name}</p>
            )}
          </div>
        </div>
      </div>

      {entries && entries.length > 0 && (() => {
        const noteCols = [
          {
            label: "Auto",
            color: "text-primary",
            borderColor: "border-primary/30",
            bgColor: "bg-primary/5",
            notes: entries.map(e => ({ match: e.matchNumber, text: e.autoNotes })).filter(n => n.text),
          },
          {
            label: "Teleop & Defense",
            color: "text-chart-2",
            borderColor: "border-chart-2/30",
            bgColor: "bg-chart-2/5",
            notes: entries.map(e => ({
              match: e.matchNumber,
              text: [
                e.driverSkillNotes ? `[Driver] ${e.driverSkillNotes}` : "",
                e.defenseNotes ? `[Defense] ${e.defenseNotes}` : "",
              ].filter(Boolean).join("\n"),
            })).filter(n => n.text),
          },
          {
            label: "Misc.",
            color: "text-chart-5",
            borderColor: "border-chart-5/30",
            bgColor: "bg-chart-5/5",
            notes: entries.map(e => ({ match: e.matchNumber, text: e.notes })).filter(n => n.text),
          },
        ];
        const hasAny = noteCols.some(c => c.notes.length > 0);
        if (!hasAny) return null;
        return (
          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Scout Notes
            </h2>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              {noteCols.map(col => {
                const recent = [...col.notes].sort((a, b) => b.match - a.match).slice(0, 2);
                return (
                  <Card key={col.label} className={`border-t-4 ${col.borderColor}`}>
                    <CardHeader className="pb-1 pt-3 px-4">
                      <CardTitle className={`text-sm font-bold ${col.color} text-center`}>{col.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      {recent.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No notes</p>
                      ) : (
                        <div className="space-y-1.5">
                          {recent.map((n, i) => (
                            <div key={i} className={`rounded px-2.5 py-1.5 ${col.bgColor}`}>
                              <span className={`text-xs font-bold ${col.color}`}>M{n.match}</span>
                              <p className="text-sm mt-0.5 whitespace-pre-line">{n.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Link href={`/events/${eventId}/teams/${teamId}/notes`}>
              <Button variant="outline" size="sm" className="w-full" data-testid="button-view-all-notes">
                View All Notes
              </Button>
            </Link>
          </div>
        );
      })()}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
        <Card className="sm:col-span-1 border-t-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-primary text-center">Auto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Balls Shot</p>
              <div className={`inline-block rounded-lg px-3 py-1.5 ${rankings ? getRankBgColor(rankings.autoRank, rankings.total) : "bg-muted/30"}`}>
                <p className={`text-4xl font-extrabold leading-none ${rankings ? getRankValueColor(rankings.autoRank, rankings.total) : "text-primary"}`} data-testid="text-avg-auto">{avgAutoBalls}</p>
              </div>
              {rankings && (
                <>
                  <div className="w-8 mx-auto border-t border-border" />
                  <p className={`text-xs font-bold ${getRankColor(rankings.autoRank, rankings.total)}`}>{getOrdinal(rankings.autoRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                </>
              )}
              {last2.length > 0 && (
                <p className="text-xs text-muted-foreground" data-testid="text-last2-auto">
                  {last2.map((e, i) => (
                    <span key={e.id}>{i > 0 ? " | " : ""}<span className="font-bold">M{e.matchNumber}:</span> {e.autoBallsShot}</span>
                  ))}
                </p>
              )}
            </div>
            {entries && entries.length > 1 && (
              <PerMatchChart
                entries={entries}
                title="Auto"
                bars={[{ field: (e) => e.autoBallsShot, color: "bg-primary", label: "Balls" }]}
              />
            )}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 border-t-4 border-chart-2/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-chart-2 text-center">Teleop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Throughput</p>
                <div className={`inline-block rounded-lg px-2 py-1.5 ${rankings ? getRankBgColor(rankings.throughputRank, rankings.total) : "bg-muted/30"}`}>
                  <p className={`text-3xl font-extrabold leading-none ${rankings ? getRankValueColor(rankings.throughputRank, rankings.total) : "text-chart-2"}`} data-testid="text-avg-throughput">{avgThroughput}</p>
                </div>
                {rankings && (
                  <>
                    <div className="w-8 mx-auto border-t border-border" />
                    <p className={`text-xs font-bold ${getRankColor(rankings.throughputRank, rankings.total)}`}>{getOrdinal(rankings.throughputRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                  </>
                )}
                {last2.length > 0 && (
                  <p className="text-xs text-muted-foreground" data-testid="text-last2-throughput">
                    {last2.map((e, i) => (
                      <span key={e.id}>{i > 0 ? " | " : ""}<span className="font-bold">M{e.matchNumber}:</span> {e.teleopFpsEstimate}</span>
                    ))}
                  </p>
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Accuracy</p>
                <div className={`inline-block rounded-lg px-2 py-1.5 ${rankings ? getRankBgColor(rankings.accuracyRank, rankings.total) : "bg-muted/30"}`}>
                  <p className={`text-3xl font-extrabold leading-none ${rankings ? getRankValueColor(rankings.accuracyRank, rankings.total) : "text-chart-3"}`} data-testid="text-avg-accuracy">{avgAccuracy}<span className="text-lg">%</span></p>
                </div>
                {rankings && (
                  <>
                    <div className="w-8 mx-auto border-t border-border" />
                    <p className={`text-xs font-bold ${getRankColor(rankings.accuracyRank, rankings.total)}`}>{getOrdinal(rankings.accuracyRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                  </>
                )}
                {last2.length > 0 && (
                  <p className="text-xs text-muted-foreground" data-testid="text-last2-accuracy">
                    {last2.map((e, i) => (
                      <span key={e.id}>{i > 0 ? " | " : ""}<span className="font-bold">M{e.matchNumber}:</span> {e.teleopAccuracy * 10}%</span>
                    ))}
                  </p>
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Defense</p>
                <div className={`inline-block rounded-lg px-2 py-1.5 ${rankings ? getRankBgColor(rankings.defenseRank, rankings.total) : "bg-muted/30"}`}>
                  <p className={`text-3xl font-extrabold leading-none ${rankings ? getRankValueColor(rankings.defenseRank, rankings.total) : "text-chart-4"}`} data-testid="text-avg-defense">{avgDefense}<span className="text-lg">%</span></p>
                </div>
                {rankings && (
                  <>
                    <div className="w-8 mx-auto border-t border-border" />
                    <p className={`text-xs font-bold ${getRankColor(rankings.defenseRank, rankings.total)}`}>{getOrdinal(rankings.defenseRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                  </>
                )}
                {last2.length > 0 && (
                  <p className="text-xs text-muted-foreground" data-testid="text-last2-defense">
                    {last2.map((e, i) => (
                      <span key={e.id}>{i > 0 ? " | " : ""}<span className="font-bold">M{e.matchNumber}:</span> {e.defenseRating * 10}%</span>
                    ))}
                  </p>
                )}
              </div>
            </div>
            {entries && entries.length > 1 && (
              <PerMatchChart
                entries={entries}
                title="Teleop"
                bars={[
                  { field: (e) => e.teleopFpsEstimate, color: "bg-chart-2", label: "FPS" },
                  { field: (e) => e.teleopAccuracy * 10, color: "bg-chart-3", label: "Acc%", max: 100, suffix: "%" },
                  { field: (e) => e.defenseRating * 10, color: "bg-chart-4", label: "Def%", max: 100, suffix: "%" },
                ]}
              />
            )}
            <div>
              <p className="text-sm font-medium text-foreground/70 text-center mb-2">Shooting Heatmap</p>
              <AggregateHeatmap entries={entries || []} />
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-1 border-t-4 border-chart-5/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-chart-5 text-center">Endgame</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-foreground/70 uppercase tracking-wide">Climb Rate</p>
              <div className={`inline-block rounded-lg px-3 py-1.5 ${rankings ? getRankBgColor(rankings.climbRank, rankings.total) : "bg-muted/30"}`}>
                <p className={`text-4xl font-extrabold leading-none ${rankings ? getRankValueColor(rankings.climbRank, rankings.total) : "text-chart-5"}`} data-testid="text-climb-rate">{climbRate}<span className="text-lg">%</span></p>
              </div>
              {rankings && (
                <>
                  <div className="w-8 mx-auto border-t border-border" />
                  <p className={`text-xs font-bold ${getRankColor(rankings.climbRank, rankings.total)}`}>{getOrdinal(rankings.climbRank)} <span className="text-muted-foreground font-normal">of {rankings.total}</span></p>
                </>
              )}
              {last2.length > 0 && (
                <p className="text-xs text-muted-foreground" data-testid="text-last2-climb">
                  {last2.map((e, i) => (
                    <span key={e.id}>
                      {i > 0 ? " | " : ""}
                      <span className="font-bold">M{e.matchNumber}:</span>{" "}
                      {e.climbSuccess === "success" ? (
                        <span className="text-green-600 dark:text-green-400">L{e.climbLevel || "?"}</span>
                      ) : e.climbSuccess === "failed" ? (
                        <span className="text-red-500">Failed</span>
                      ) : (
                        <span>None</span>
                      )}
                    </span>
                  ))}
                </p>
              )}
            </div>
            {entries && entries.length > 1 && (
              <ClimbChart entries={entries} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold">Match History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : entries?.length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-6">
              No scouting entries for this team yet.
            </p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-bold">Match</TableHead>
                    <TableHead className="text-center text-sm font-bold">Auto</TableHead>
                    <TableHead className="text-center text-sm font-bold">Throughput</TableHead>
                    <TableHead className="text-center text-sm font-bold">Accuracy</TableHead>
                    <TableHead className="text-center text-sm font-bold">Climb</TableHead>
                    <TableHead className="text-center text-sm font-bold">Defense</TableHead>
                    <TableHead className="text-sm font-bold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries
                    ?.sort((a, b) => a.matchNumber - b.matchNumber)
                    .map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                        <TableCell className="font-bold text-base">
                          M{entry.matchNumber}
                        </TableCell>
                        <TableCell className="text-center text-base font-semibold">{entry.autoBallsShot}</TableCell>
                        <TableCell className="text-center text-base font-semibold">{entry.teleopFpsEstimate}</TableCell>
                        <TableCell className="text-center text-base font-semibold">{entry.teleopAccuracy * 10}<span className="text-muted-foreground text-xs">%</span></TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={entry.climbSuccess === "success" ? "default" : "secondary"}
                            className={`text-sm font-semibold ${entry.climbSuccess === "success" ? "bg-green-600 text-white" : entry.climbSuccess === "failed" ? "bg-red-500/15 text-red-500" : ""}`}
                          >
                            {entry.climbSuccess === "success" ? "Yes" : entry.climbSuccess === "failed" ? "Failed" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-base font-semibold">{entry.defenseRating * 10}<span className="text-muted-foreground text-xs">%</span></TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm">
                          {entry.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
