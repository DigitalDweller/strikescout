import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Minus,
  Plus,
  Calendar,
  Loader2,
  Eraser,
  Undo2,
  Target,
  ArrowUp,
  Crosshair,
  Check,
  Search,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event, Team, EventTeam, ScheduleMatch, ScoutingEntry } from "@shared/schema";
import heatmapFieldPath from "@assets/heatmap-field.png";
import {
  getHeatColor as getHeatColorLib,
  getHeatCssColor,
  getHeatBgOnly,
  getHeatTextOnly,
  getScoutFieldShellClass,
  computeTeamStats,
  computeStatRanges,
} from "@/lib/team-colors";
import { useHelp } from "@/contexts/help-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DEFAULT_STAT_RANGES = {
  auto: { min: 0, max: 10 },
  throughput: { min: 0, max: 14 },
  accuracy: { min: 0, max: 100 },
  evadedDefense: { min: 0, max: 100 },
  defense: { min: 0, max: 100 },
  autoAccuracy: { min: 0, max: 100 },
  driverSkill: { min: 0, max: 100 },
};

const FIELD_SHELL_FALLBACK = "bg-zinc-950/40 border-white/10";

/** Outer wrap for segmented / toggle rows — neutral only (no heat tint on the container). */
const NEUTRAL_FIELD_WRAP = "rounded-2xl border border-white/10 bg-zinc-950/40 p-3";

function segmentHeatPill(h: number): { pill: string; text: string } {
  const bg = getHeatBgOnly(h, 0, 100) || "bg-zinc-600";
  const text = getHeatTextOnly(h, 0, 100) || "text-white";
  return {
    pill: cn(bg, "shadow-[0_0_16px_rgba(0,0,0,0.2)] ring-1 ring-white/10"),
    text,
  };
}

/** Heat tier 0–100 for barge / level segment options (null = unknown). */
function heatForPositionOption(v: string): number | null {
  if (v === "left") return 25;
  if (v === "middle") return 50;
  if (v === "right") return 75;
  return null;
}

function heatForLevelOption(v: string): number | null {
  if (v === "1") return 33;
  if (v === "2") return 66;
  if (v === "3") return 100;
  return null;
}

type ScoutStatRanges = {
  auto: { min: number; max: number; sweep?: number };
  throughput: { min: number; max: number; sweep?: number };
  accuracy: { min: number; max: number; sweep?: number };
  evadedDefense: { min: number; max: number; sweep?: number };
  defense: { min: number; max: number; sweep?: number };
  autoAccuracy: { min: number; max: number; sweep?: number };
  driverSkill: { min: number; max: number; sweep?: number };
};

function TeamSearchCombobox({
  eventTeams,
  selectedTeamId,
  onSelectTeam,
  compact,
  testId,
  matchNumber,
  schedule,
  prominent,
}: {
  eventTeams?: (EventTeam & { team: Team })[];
  selectedTeamId: number;
  onSelectTeam: (teamId: number) => void;
  compact: boolean;
  testId: string;
  matchNumber?: number;
  schedule?: Pick<ScheduleMatch, "matchNumber" | "red1" | "red2" | "red3" | "blue1" | "blue2" | "blue3">[];
  /** Large glowing search bar at top of scout form */
  prominent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | undefined>(undefined);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const selectedTeam = eventTeams?.find((et) => et.teamId === selectedTeamId);

  const { redTeamNumbers, blueTeamNumbers, matchTeamNumbers, redOrder, blueOrder } = useMemo(() => {
    if (!matchNumber || !schedule?.length) return { redTeamNumbers: new Set<number>(), blueTeamNumbers: new Set<number>(), matchTeamNumbers: new Set<number>(), redOrder: [] as number[], blueOrder: [] as number[] };
    const m = schedule.find((s) => s.matchNumber === matchNumber);
    if (!m) return { redTeamNumbers: new Set<number>(), blueTeamNumbers: new Set<number>(), matchTeamNumbers: new Set<number>(), redOrder: [] as number[], blueOrder: [] as number[] };
    const redArr = [m.red1, m.red2, m.red3].filter((n): n is number => n != null);
    const blueArr = [m.blue1, m.blue2, m.blue3].filter((n): n is number => n != null);
    const red = new Set(redArr);
    const blue = new Set(blueArr);
    const all = new Set([...redArr, ...blueArr]);
    return { redTeamNumbers: red, blueTeamNumbers: blue, matchTeamNumbers: all, redOrder: redArr, blueOrder: blueArr };
  }, [matchNumber, schedule]);

  const eligibleTeams = useMemo(() => {
    const teams = eventTeams || [];
    if (!matchNumber || !schedule?.length || matchTeamNumbers.size === 0) return teams;
    const matchTeams = teams.filter((et) => matchTeamNumbers.has(et.team.teamNumber));
    if (redOrder.length === 0 && blueOrder.length === 0) return matchTeams;
    return [...matchTeams].sort((a, b) => {
      const aRedIdx = redOrder.indexOf(a.team.teamNumber);
      const bRedIdx = redOrder.indexOf(b.team.teamNumber);
      const aBlueIdx = blueOrder.indexOf(a.team.teamNumber);
      const bBlueIdx = blueOrder.indexOf(b.team.teamNumber);
      const aInRed = aRedIdx >= 0;
      const bInRed = bRedIdx >= 0;
      if (aInRed && !bInRed) return -1;
      if (!aInRed && bInRed) return 1;
      if (aInRed && bInRed) return aRedIdx - bRedIdx;
      return aBlueIdx - bBlueIdx;
    });
  }, [eventTeams, matchNumber, schedule, matchTeamNumbers, redOrder, blueOrder]);

  const filtered = eligibleTeams.filter((et) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      et.team.teamNumber.toString().includes(q) ||
      et.team.teamName.toLowerCase().includes(q)
    );
  });

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const sync = () => setPanelWidth(el.offsetWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          ref={triggerRef}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 text-left transition-all duration-200",
            prominent
              ? cn(
                  "min-h-14 border border-blue-500/40 bg-zinc-950/60 py-3 shadow-lg shadow-black/30 backdrop-blur-md",
                  open
                    ? "ring-2 ring-blue-500/60 ring-offset-2 ring-offset-zinc-950"
                    : "hover:border-blue-500/55 hover:shadow-xl hover:shadow-black/35",
                )
              : cn(
                  "min-h-11 rounded-md border bg-background sm:min-h-0",
                  compact ? "h-11 sm:h-11" : "h-12 sm:h-14",
                  open ? "ring-2 ring-ring" : "",
                ),
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-testid={testId}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              prominent ? "text-base text-zinc-100 sm:text-lg" : compact ? "text-sm" : "text-lg",
            )}
            data-testid={`${testId}-input`}
          >
            {selectedTeam
              ? `${selectedTeam.team.teamNumber} — ${selectedTeam.team.teamName}`
              : "Select a team from this match…"}
          </span>
          <Search
            className={cn(
              "h-5 w-5 shrink-0",
              prominent ? "text-blue-400" : "h-4 w-4 text-muted-foreground",
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        avoidCollisions
        collisionPadding={12}
        style={{ width: panelWidth }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => filterInputRef.current?.focus());
        }}
        className={cn(
          "z-[100] flex max-h-[min(60vh,280px)] flex-col overflow-hidden p-0 shadow-lg",
          prominent ? "border-white/10 bg-zinc-900/95 backdrop-blur-xl" : "bg-popover",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-b px-3 py-2",
            prominent ? "border-white/10 bg-zinc-900/95" : "border-border bg-popover",
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={filterInputRef}
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Filter by number or name…"
            className={cn(
              "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
              prominent ? "text-zinc-100" : "",
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid={`${testId}-filter`}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">No teams found</div>
          ) : (
            filtered.map((et) => {
              const isRed = redTeamNumbers.has(et.team.teamNumber);
              const isBlue = blueTeamNumbers.has(et.team.teamNumber);
              const redPos = redOrder.indexOf(et.team.teamNumber) + 1;
              const bluePos = blueOrder.indexOf(et.team.teamNumber) + 1;
              const slotLabel = isRed ? `R${redPos}` : isBlue ? `B${bluePos}` : null;
              const allianceClass = isRed
                ? "bg-red-500/15 hover:bg-red-500/25 border-l-2 border-l-red-500"
                : isBlue
                  ? "bg-blue-500/15 hover:bg-blue-500/25 border-l-2 border-l-blue-500"
                  : "";
              return (
                <div
                  key={et.teamId}
                  role="option"
                  aria-selected={et.teamId === selectedTeamId}
                  className={`flex cursor-pointer items-center gap-2 px-3 ${compact ? "py-2 text-sm" : "py-3 text-base"} ${et.teamId === selectedTeamId ? "bg-accent/50" : allianceClass || "hover:bg-accent"}`}
                  onClick={() => {
                    onSelectTeam(et.teamId);
                    setSearch("");
                    setOpen(false);
                  }}
                  data-testid={`${testId}-option-${et.team.teamNumber}`}
                >
                  {et.teamId === selectedTeamId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  {slotLabel && (
                    <span
                      className={`w-7 shrink-0 text-xs font-bold tabular-nums ${isRed ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
                    >
                      {slotLabel}
                    </span>
                  )}
                  <span className={et.teamId === selectedTeamId ? "" : slotLabel ? "" : "ml-6"}>
                    <span
                      className={`font-bold ${isRed ? "text-red-600 dark:text-red-400" : isBlue ? "text-blue-600 dark:text-blue-400" : "text-primary"}`}
                    >
                      {et.team.teamNumber}
                    </span>
                    <span className="ml-1.5">{et.team.teamName}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BigCounterInput({
  value,
  onChange,
  label,
  testId,
  heatClass = "",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  testId: string;
  heatClass?: string;
}) {
  return (
    <div className={cn("space-y-3 rounded-2xl border p-3", heatClass || FIELD_SHELL_FALLBACK)}>
      <Label className="text-sm font-semibold tracking-wide text-zinc-100">{label}</Label>
      <div
        className={cn(
          "flex w-full min-w-0 items-stretch gap-2 sm:gap-3 rounded-2xl border border-white/10 bg-black/20 p-2 shadow-inner backdrop-blur-sm",
          heatClass && "border-white/20",
        )}
      >
        <button
          type="button"
          className="flex h-[4.25rem] min-h-[4.25rem] w-[4.25rem] shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/60 text-zinc-100 shadow-inner backdrop-blur-md transition-all duration-200 active:scale-[0.97] hover:border-white/25 hover:bg-zinc-800/80 disabled:opacity-40"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          data-testid={`button-${testId}-minus`}
        >
          <Minus className="h-8 w-8 stroke-[2.5]" />
        </button>
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center justify-center rounded-2xl border border-white/5 bg-zinc-950/70 px-2 shadow-inner",
            heatClass && "border-white/15",
          )}
          data-testid={`text-${testId}-value`}
        >
          <span
            className={cn(
              "text-4xl font-bold tabular-nums tracking-tight sm:text-5xl",
              heatClass ? "text-inherit" : "text-zinc-50",
            )}
          >
            {value}
          </span>
        </div>
        <button
          type="button"
          className="flex h-[4.25rem] min-h-[4.25rem] w-[4.25rem] shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/60 text-zinc-100 shadow-inner backdrop-blur-md transition-all duration-200 active:scale-[0.97] hover:border-white/25 hover:bg-zinc-800/80"
          onClick={() => onChange(value + 1)}
          data-testid={`button-${testId}-plus`}
        >
          <Plus className="h-8 w-8 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}

function ShootingHeatmap({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const prevValueRef = useRef(value);
  const fieldImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            setPoints(parsed);
            return;
          }
        } catch {}
      }
      setPoints([]);
    }
  }, [value]);

  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = "#e8ebe6";
    ctx.fillRect(0, 0, W, H);
    const fieldImg = fieldImgRef.current;
    if (fieldImg?.complete && fieldImg.naturalWidth > 0) {
      const img = fieldImg;
      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    }

    if (points.length > 0) {
      const radius = 42;
      const grid = 2;
      const intensity: Record<string, number> = {};
      let maxI = 0;
      for (const p of points) {
        const px = p.x * W;
        const py = p.y * H;
        const gx0 = Math.floor(px / grid);
        const gy0 = Math.floor(py / grid);
        const range = Math.ceil(radius / grid);
        for (let dx = -range; dx <= range; dx++) {
          for (let dy = -range; dy <= range; dy++) {
            const cx = (gx0 + dx) * grid + grid / 2;
            const cy = (gy0 + dy) * grid + grid / 2;
            const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
            if (dist < radius) {
              const key = `${gx0 + dx},${gy0 + dy}`;
              const weight = 1 - dist / radius;
              intensity[key] = (intensity[key] || 0) + weight;
              if (intensity[key] > maxI) maxI = intensity[key];
            }
          }
        }
      }

      if (maxI > 0) {
        for (const [key, val] of Object.entries(intensity)) {
          const [gx, gy] = key.split(",").map(Number);
          const norm = val / maxI;
          const alpha = norm * 0.55;
          const t = Math.max(0, Math.min(1, norm));
          let r: number, g: number, b: number;
          if (t < 0.33) {
            const u = t / 0.33;
            r = Math.round(0 + u * 0);
            g = Math.round(0 + u * 255);
            b = Math.round(255 * (1 - u) + 0);
          } else if (t < 0.66) {
            const u = (t - 0.33) / 0.33;
            r = Math.round(0 + u * 255);
            g = 255;
            b = Math.round(0 + u * 0);
          } else {
            const u = (t - 0.66) / 0.34;
            r = 255;
            g = Math.round(255 * (1 - u));
            b = 0;
          }
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fillRect(gx * grid, gy * grid, grid + 1, grid + 1);
        }
      }

      for (const p of points) {
        const px = p.x * W;
        const py = p.y * H;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fill();
        ctx.strokeStyle = "rgba(161, 161, 170, 0.95)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(212, 212, 216, 0.95)";
        ctx.fill();
      }
    }
  }, [points]);

  const drawHeatmapRef = useRef(drawHeatmap);
  drawHeatmapRef.current = drawHeatmap;

  useEffect(() => {
    const img = new Image();
    const redraw = () => drawHeatmapRef.current();
    const onDone = () => {
      fieldImgRef.current = img;
      redraw();
    };
    img.onload = onDone;
    img.onerror = () => {
      console.warn("[heatmap] Field image failed to load:", heatmapFieldPath);
      fieldImgRef.current = null;
      redraw();
    };
    img.src = heatmapFieldPath;
    if (img.complete && img.naturalWidth > 0) onDone();
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, []);

  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const MAX_POINTS = 4;
    const newPoints = points.length >= MAX_POINTS ? points : [...points, { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }];
    setPoints(newPoints);
    prevValueRef.current = JSON.stringify(newPoints);
    onChange(JSON.stringify(newPoints));
  };

  const undo = () => {
    const newPoints = points.slice(0, -1);
    setPoints(newPoints);
    prevValueRef.current = newPoints.length ? JSON.stringify(newPoints) : "";
    onChange(newPoints.length ? JSON.stringify(newPoints) : "");
  };

  const clear = () => {
    setPoints([]);
    prevValueRef.current = "";
    onChange("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Tap field — max 4 points</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-xl border border-white/10 bg-zinc-800/80 text-zinc-200 transition-colors duration-200 hover:border-white/20 hover:bg-zinc-700/80 active:scale-95"
            onClick={undo}
            data-testid="button-heatmap-undo"
          >
            <Undo2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-xl border border-white/10 bg-zinc-800/80 text-zinc-200 transition-colors duration-200 hover:border-white/20 hover:bg-zinc-700/80 active:scale-95"
            onClick={clear}
            data-testid="button-heatmap-clear"
          >
            <Eraser className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border border-zinc-700/80 bg-zinc-950 p-2 shadow-[inset_0_2px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
        <canvas
          ref={canvasRef}
          width={400}
          height={250}
          className="block w-full cursor-crosshair touch-none rounded-2xl"
          style={{ aspectRatio: "400/250" }}
          onPointerDown={handlePointerDown}
          data-testid="canvas-shooting-heatmap"
        />
      </div>
    </div>
  );
}

/** Slider 0–100% with individual integer steps. Value is stored/read as 0–100 directly. */
function RatingSelector({
  value,
  onChange,
  label,
  testId,
  heatRange,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  testId: string;
  heatRange: { min: number; max: number; sweep?: number };
}) {
  const r = heatRange.max > heatRange.min ? heatRange : DEFAULT_STAT_RANGES.accuracy;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const css = getHeatCssColor(value, r.min, r.max, r.sweep);
  const badge = getHeatColorLib(value, r.min, r.max, r.sweep);
  const shell = getScoutFieldShellClass(value, r.min, r.max, r.sweep);
  return (
    <div className={cn("space-y-3 rounded-2xl border p-3", shell || FIELD_SHELL_FALLBACK)}>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-semibold text-zinc-100">{label}</Label>
        <span
          className={cn("rounded-lg border px-3 py-1 text-lg font-bold tabular-nums shadow-inner", badge)}
          data-testid={`text-${testId}-value`}
        >
          {pct}%
        </span>
      </div>
      <Slider
        value={[pct]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={1}
        trackColor={css}
        trackClassName="h-4 rounded-full bg-zinc-900/80 border border-zinc-700/50"
        rangeClassName="rounded-full shadow-[0_0_14px_rgba(255,255,255,0.12)]"
        thumbClassName="h-8 w-8 border-[3px] bg-zinc-950 shadow-lg"
        className="touch-none py-2"
        data-testid={`slider-${testId}`}
      />
    </div>
  );
}

type Segment4 = { label: string; value: number };

function ThroughputSegmented({
  teleopFpsEstimate,
  onChange,
  columnIndex,
  throughputRange,
}: {
  teleopFpsEstimate: number;
  onChange: (v: number) => void;
  columnIndex: number;
  throughputRange: { min: number; max: number; sweep?: number };
}) {
  const options: Segment4[] = [
    { label: "1–2", value: 2 },
    { label: "3–8", value: 6 },
    { label: "9–16", value: 13 },
    { label: "17+", value: 20 },
  ];
  const r = throughputRange.max > throughputRange.min ? throughputRange : DEFAULT_STAT_RANGES.throughput;

  return (
    <div className={cn("space-y-3", NEUTRAL_FIELD_WRAP)}>
      <Label className="text-sm font-semibold text-zinc-100">Throughput</Label>
      <div className="relative grid grid-cols-4 gap-1.5 rounded-xl border border-white/5 bg-zinc-900/60 p-1.5 backdrop-blur-md">
        {options.map((opt) => {
          const selected =
            (opt.value === 2 && teleopFpsEstimate >= 1 && teleopFpsEstimate <= 2) ||
            (opt.value === 6 && teleopFpsEstimate >= 3 && teleopFpsEstimate <= 8) ||
            (opt.value === 13 && teleopFpsEstimate >= 9 && teleopFpsEstimate <= 16) ||
            (opt.value === 20 && teleopFpsEstimate >= 17);
          const pillBg =
            selected && teleopFpsEstimate > 0
              ? getHeatBgOnly(opt.value, r.min, r.max, r.sweep) || "bg-zinc-600"
              : null;
          const pillText =
            selected && teleopFpsEstimate > 0
              ? getHeatTextOnly(opt.value, r.min, r.max, r.sweep) || "text-white"
              : selected
                ? "text-white"
                : "text-zinc-500";
          return (
            <button
              key={opt.value}
              type="button"
              className="relative z-10 min-h-[3.25rem] touch-manipulation rounded-xl py-3 text-sm font-semibold transition-colors duration-200"
              onClick={() => onChange(opt.value)}
              data-testid={`button-throughput-${opt.value}-${columnIndex}`}
            >
              {selected && (
                <motion.span
                  layoutId="throughput-pill"
                  className={cn(
                    "absolute inset-0 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.25)] ring-1 ring-white/15",
                    pillBg || "bg-zinc-600 shadow-inner",
                  )}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <span className={cn("relative z-10 font-semibold", pillText)}>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ClimbValue = "success" | "failed" | "none";

function climbPillForValue(v: ClimbValue): { pill: string; text: string } {
  if (v === "none") {
    return {
      pill: "bg-zinc-600 shadow-inner ring-1 ring-white/10",
      text: "text-white",
    };
  }
  if (v === "success") return segmentHeatPill(100);
  return segmentHeatPill(45);
}

function ClimbSegmented({
  value,
  onChange,
  layoutId,
  testIdPrefix,
  columnIndex,
  onPick,
}: {
  value: ClimbValue;
  onChange: (v: ClimbValue) => void;
  layoutId: string;
  testIdPrefix: string;
  columnIndex: number;
  onPick?: (v: ClimbValue) => void;
}) {
  const options: { value: ClimbValue; label: string }[] = [
    { value: "success", label: "Climbed" },
    { value: "failed", label: "Failed" },
    { value: "none", label: "Didn't try" },
  ];
  return (
    <div className="relative grid grid-cols-3 gap-1.5 rounded-xl border border-white/5 bg-zinc-900/60 p-1.5 backdrop-blur-md">
      {options.map((opt) => {
        const selected = value === opt.value;
        const pill = climbPillForValue(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className="relative z-10 min-h-[3.25rem] touch-manipulation rounded-xl py-3 text-sm font-semibold transition-colors duration-200"
            onClick={() => {
              onChange(opt.value);
              onPick?.(opt.value);
            }}
            data-testid={`${testIdPrefix}-${opt.value}-${columnIndex}`}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className={cn("absolute inset-0 rounded-xl", pill.pill)}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className={cn("relative z-10", selected ? pill.text : "text-zinc-500")}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SubSegmented3({
  options,
  value,
  onChange,
  layoutId,
  testIdPrefix,
  columnIndex,
  heatValue,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  layoutId: string;
  testIdPrefix: string;
  columnIndex: number;
  /** When set, selected pill uses heat at 0–100; if null/undefined, stays neutral gray. */
  heatValue?: (optValue: string) => number | null;
}) {
  return (
    <div className="relative grid grid-cols-3 gap-1.5 rounded-xl border border-white/5 bg-zinc-900/60 p-1.5 backdrop-blur-md">
      {options.map((opt) => {
        const selected = value === opt.value;
        const h = selected && heatValue ? heatValue(opt.value) : null;
        const pill =
          h != null ? segmentHeatPill(h) : { pill: "bg-zinc-600 shadow-inner ring-1 ring-white/10", text: "text-white" };
        return (
          <button
            key={opt.value}
            type="button"
            className="relative z-10 min-h-[3rem] touch-manipulation rounded-xl py-2.5 text-sm font-semibold transition-colors duration-200"
            onClick={() => onChange(opt.value)}
            data-testid={`${testIdPrefix}-${opt.value}-${columnIndex}`}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className={cn("absolute inset-0 rounded-xl", pill.pill)}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className={cn("relative z-10", selected ? pill.text : "text-zinc-500")}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const scoutNotesTextareaClass =
  "mt-2 min-h-[5.5rem] resize-none rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 shadow-inner backdrop-blur-sm transition-all duration-200 focus-visible:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent md:min-h-[6.5rem]";

type FormData = {
  autoBallsShot: number;
  autoAccuracy: number;
  autoNotes: string;
  autoDrawing: string;
  autoClimbSuccess: string;
  autoClimbPosition: string;
  autoClimbLevel: string;
  teleopBallsShot: number;
  teleopShootPosition: string;
  teleopMoveWhileShoot: boolean;
  teleopFpsEstimate: number;
  teleopAccuracy: number;
  evadedDefenseTracked: boolean;
  evadedDefense: number;
  driverSkill: number;
  climbSuccess: string;
  climbPosition: string;
  climbLevel: string;
  playedDefense: boolean;
  defenseRating: number;
  defenseNotes: string;
  driverSkillNotes: string;
  notes: string;
};

function getEmptyForm(): FormData {
  return {
    autoBallsShot: 0,
    autoAccuracy: 0,
    autoNotes: "",
    autoDrawing: "",
    autoClimbSuccess: "none",
    autoClimbPosition: "",
    autoClimbLevel: "",
    teleopBallsShot: 0,
    teleopShootPosition: "",
    teleopMoveWhileShoot: false,
    teleopFpsEstimate: 0,
    teleopAccuracy: 0,
    evadedDefenseTracked: false,
    evadedDefense: 0,
    driverSkill: 0,
    climbSuccess: "none",
    climbPosition: "",
    climbLevel: "",
    playedDefense: false,
    defenseRating: 0,
    defenseNotes: "",
    driverSkillNotes: "",
    notes: "",
  };
}

function TeamFormColumn({
  index,
  form,
  onUpdateField,
  statRanges,
}: {
  index: number;
  form: FormData;
  onUpdateField: (field: string, value: unknown) => void;
  statRanges: ScoutStatRanges;
}) {
  const autoClimb = form.autoClimbSuccess as ClimbValue;
  const teleopClimb = form.climbSuccess as ClimbValue;

  const r = statRanges;
  const throughputRange = r.throughput.max > r.throughput.min ? r.throughput : DEFAULT_STAT_RANGES.throughput;
  const autoRange = r.auto.max > r.auto.min ? r.auto : DEFAULT_STAT_RANGES.auto;
  const accuracyRange = r.accuracy.max > r.accuracy.min ? r.accuracy : DEFAULT_STAT_RANGES.accuracy;
  const evadedDefenseRange = r.evadedDefense.max > r.evadedDefense.min ? r.evadedDefense : DEFAULT_STAT_RANGES.evadedDefense;
  const defenseRange = r.defense.max > r.defense.min ? r.defense : DEFAULT_STAT_RANGES.defense;
  const autoAccuracyRange = r.autoAccuracy.max > r.autoAccuracy.min ? r.autoAccuracy : DEFAULT_STAT_RANGES.autoAccuracy;
  const driverSkillRange = r.driverSkill.max > r.driverSkill.min ? r.driverSkill : DEFAULT_STAT_RANGES.driverSkill;

  const autoShell = getScoutFieldShellClass(form.autoBallsShot, autoRange.min, autoRange.max, autoRange.sweep);
  const autoNotesShell = getScoutFieldShellClass(Math.min(form.autoNotes.length, 100), 0, 100);
  const defenseNotesShell = getScoutFieldShellClass(Math.min(form.defenseNotes.length, 100), 0, 100);
  const driverNotesShell = getScoutFieldShellClass(Math.min(form.driverSkillNotes.length, 100), 0, 100);
  const miscNotesShell = getScoutFieldShellClass(Math.min(form.notes.length, 100), 0, 100);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 sm:max-w-2xl sm:space-y-5 lg:max-w-3xl" data-testid={`team-column-${index}`}>
      {/* Section 1 — Autonomous */}
      <section className="ss-glass-subtle border border-white/10 bg-zinc-900/35 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-400" aria-hidden />
          <h2 className="text-base font-bold tracking-tight text-zinc-100">Autonomous</h2>
        </div>
        <div className="mt-4 space-y-6">
          <BigCounterInput
            value={form.autoBallsShot}
            onChange={(v) => onUpdateField("autoBallsShot", v)}
            label="Auto balls scored"
            testId={`auto-balls-${index}`}
            heatClass={autoShell}
          />
          {form.autoBallsShot >= 1 && (
            <RatingSelector
              value={form.autoAccuracy}
              onChange={(v) => onUpdateField("autoAccuracy", v)}
              label="Auto accuracy"
              testId={`auto-accuracy-${index}`}
              heatRange={autoAccuracyRange}
            />
          )}
          <div className={cn("space-y-3", NEUTRAL_FIELD_WRAP)}>
            <Label className="text-sm font-semibold text-zinc-100">Auto climb</Label>
            <ClimbSegmented
              value={autoClimb}
              onChange={(v) => onUpdateField("autoClimbSuccess", v)}
              layoutId={`auto-climb-pill-${index}`}
              testIdPrefix="button-auto-climb"
              columnIndex={index}
              onPick={(v) => {
                if (v === "none") {
                  onUpdateField("autoClimbPosition", "");
                  onUpdateField("autoClimbLevel", "");
                } else if (v === "success") {
                  onUpdateField("autoClimbLevel", "1");
                }
              }}
            />
          </div>
          {form.autoClimbSuccess !== "none" && (
            <div className="space-y-3">
              <div className={cn("space-y-3", NEUTRAL_FIELD_WRAP)}>
                <Label className="text-xs font-medium uppercase tracking-wide text-zinc-200">
                  Barge position
                </Label>
                <SubSegmented3
                  options={[
                    { value: "left", label: "Left" },
                    { value: "middle", label: "Mid" },
                    { value: "right", label: "Right" },
                  ]}
                  value={form.autoClimbPosition}
                  onChange={(v) => onUpdateField("autoClimbPosition", v)}
                  layoutId={`auto-climb-pos-${index}`}
                  testIdPrefix="button-auto-climb-pos"
                  columnIndex={index}
                  heatValue={heatForPositionOption}
                />
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-inner backdrop-blur-sm",
                  FIELD_SHELL_FALLBACK,
                )}
              >
                <Label className="text-sm text-zinc-200">Level</Label>
                <span
                  className="rounded-lg border border-white/10 bg-black/25 px-3 py-1 text-sm font-bold tabular-nums text-zinc-100 shadow-inner"
                  data-testid="text-auto-climb-level-1"
                >
                  L1
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2 — Teleop */}
      <section className="ss-glass-subtle border border-white/10 bg-zinc-900/35 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-blue-400" aria-hidden />
          <h2 className="text-base font-bold tracking-tight text-zinc-100">Teleop</h2>
        </div>
        <div className="mt-4 space-y-6">
          <ThroughputSegmented
            teleopFpsEstimate={form.teleopFpsEstimate}
            onChange={(v) => onUpdateField("teleopFpsEstimate", v)}
            columnIndex={index}
            throughputRange={throughputRange}
          />
          <RatingSelector
            value={form.teleopAccuracy}
            onChange={(v) => onUpdateField("teleopAccuracy", v)}
            label="Accuracy"
            testId={`accuracy-${index}`}
            heatRange={accuracyRange}
          />
          <div
            className={cn(
              "flex min-h-[3.75rem] items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 backdrop-blur-sm transition-colors duration-200",
              form.evadedDefenseTracked
                ? getScoutFieldShellClass(100, 0, 100)
                : FIELD_SHELL_FALLBACK,
            )}
          >
            <Label htmlFor={`evaded-defense-${index}`} className="text-base font-medium leading-snug text-zinc-100">
              Evaded defense
            </Label>
            <Switch
              id={`evaded-defense-${index}`}
              checked={form.evadedDefenseTracked}
              onCheckedChange={(c) => {
                onUpdateField("evadedDefenseTracked", c);
                if (!c) onUpdateField("evadedDefense", 0);
              }}
              className="h-9 w-[3.75rem] shrink-0 border-0 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-700 [&>span]:h-7 [&>span]:w-7 [&>span]:data-[state=checked]:translate-x-[1.35rem]"
              data-testid={`switch-evaded-defense-${index}`}
            />
          </div>
          {form.evadedDefenseTracked && (
            <RatingSelector
              value={form.evadedDefense}
              onChange={(v) => onUpdateField("evadedDefense", v)}
              label="Evasion effectiveness"
              testId={`evaded-defense-${index}`}
              heatRange={evadedDefenseRange}
            />
          )}
          <div
            className={cn(
              "flex min-h-[3.75rem] items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 backdrop-blur-sm transition-colors duration-200",
              form.teleopMoveWhileShoot ? getScoutFieldShellClass(100, 0, 100) : FIELD_SHELL_FALLBACK,
            )}
          >
            <Label htmlFor={`move-shoot-${index}`} className="text-base font-medium leading-snug text-zinc-100">
              Moves while shooting
            </Label>
            <Switch
              id={`move-shoot-${index}`}
              checked={form.teleopMoveWhileShoot}
              onCheckedChange={(c) => onUpdateField("teleopMoveWhileShoot", c)}
              className="h-9 w-[3.75rem] shrink-0 border-0 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-700 [&>span]:h-7 [&>span]:w-7 [&>span]:data-[state=checked]:translate-x-[1.35rem]"
              data-testid={`switch-move-while-shoot-${index}`}
            />
          </div>
          <div
            className={cn(
              "flex min-h-[3.75rem] items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 backdrop-blur-sm transition-colors duration-200",
              form.playedDefense ? getScoutFieldShellClass(100, 0, 100) : FIELD_SHELL_FALLBACK,
            )}
          >
            <Label htmlFor={`played-def-${index}`} className="text-base font-medium leading-snug text-zinc-100">
              Played defense
            </Label>
            <Switch
              id={`played-def-${index}`}
              checked={form.playedDefense}
              onCheckedChange={(c) => {
                onUpdateField("playedDefense", c);
                if (!c) {
                  onUpdateField("defenseRating", 0);
                  onUpdateField("defenseNotes", "");
                }
              }}
              className="h-9 w-[3.75rem] shrink-0 border-0 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-700 [&>span]:h-7 [&>span]:w-7 [&>span]:data-[state=checked]:translate-x-[1.35rem]"
              data-testid={`switch-played-defense-${index}`}
            />
          </div>
          {form.playedDefense && (
            <RatingSelector
              value={form.defenseRating}
              onChange={(v) => onUpdateField("defenseRating", v)}
              label="Defense effectiveness"
              testId={`defense-${index}`}
              heatRange={defenseRange}
            />
          )}
        </div>
      </section>

      {/* Section 3 — Shooting heatmap */}
      <section className="ss-glass-subtle border border-white/10 bg-zinc-900/35 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-blue-400" aria-hidden />
          <h2 className="text-base font-bold tracking-tight text-zinc-100">Shooting heatmap</h2>
        </div>
        <div className="mt-4">
          <div className={cn("rounded-2xl border p-3", FIELD_SHELL_FALLBACK)}>
            <ShootingHeatmap value={form.teleopShootPosition} onChange={(v) => onUpdateField("teleopShootPosition", v)} />
          </div>
        </div>
      </section>

      {/* Section 4 — Endgame */}
      <section className="ss-glass-subtle border border-white/10 bg-zinc-900/35 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <ArrowUp className="h-5 w-5 text-blue-400" aria-hidden />
          <h2 className="text-base font-bold tracking-tight text-zinc-100">Endgame</h2>
        </div>
        <div className="mt-4 space-y-6">
          <div className={cn("space-y-3", NEUTRAL_FIELD_WRAP)}>
            <Label className="text-sm font-semibold text-zinc-100">Teleop climb</Label>
            <ClimbSegmented
              value={teleopClimb}
              onChange={(v) => onUpdateField("climbSuccess", v)}
              layoutId={`teleop-climb-pill-${index}`}
              testIdPrefix="button-climb"
              columnIndex={index}
              onPick={(v) => {
                if (v === "none") {
                  onUpdateField("climbPosition", "");
                  onUpdateField("climbLevel", "");
                }
              }}
            />
          </div>
          {form.climbSuccess !== "none" && (
            <div className="space-y-4">
              <div className={cn("space-y-3", NEUTRAL_FIELD_WRAP)}>
                <Label className="text-xs font-medium uppercase tracking-wide text-zinc-200">
                  Barge position
                </Label>
                <SubSegmented3
                  options={[
                    { value: "left", label: "Left" },
                    { value: "middle", label: "Mid" },
                    { value: "right", label: "Right" },
                  ]}
                  value={form.climbPosition}
                  onChange={(v) => onUpdateField("climbPosition", v)}
                  layoutId={`teleop-climb-pos-${index}`}
                  testIdPrefix="button-climb-pos"
                  columnIndex={index}
                  heatValue={heatForPositionOption}
                />
              </div>
              <div className={cn("space-y-3", NEUTRAL_FIELD_WRAP)}>
                <Label className="text-xs font-medium uppercase tracking-wide text-zinc-200">Level</Label>
                <SubSegmented3
                  options={[
                    { value: "1", label: "L1" },
                    { value: "2", label: "L2" },
                    { value: "3", label: "L3" },
                  ]}
                  value={form.climbLevel}
                  onChange={(v) => onUpdateField("climbLevel", v)}
                  layoutId={`teleop-climb-level-${index}`}
                  testIdPrefix="button-climb-level"
                  columnIndex={index}
                  heatValue={heatForLevelOption}
                />
              </div>
            </div>
          )}
          <RatingSelector
            value={form.driverSkill}
            onChange={(v) => onUpdateField("driverSkill", v)}
            label="Driver skill"
            testId={`driver-skill-${index}`}
            heatRange={driverSkillRange}
          />
        </div>
      </section>

      {/* Section 5 — Notes */}
      <section className="ss-glass-subtle border border-white/10 bg-zinc-900/35 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-400" aria-hidden />
          <h2 className="text-base font-bold tracking-tight text-zinc-100">Notes & observations</h2>
        </div>
        <div className="mt-4 space-y-5">
          <div className={cn("rounded-2xl border p-3", autoNotesShell || FIELD_SHELL_FALLBACK)}>
            <Label className="text-sm font-medium text-zinc-100">Auto</Label>
            <Textarea
              value={form.autoNotes}
              onChange={(e) => onUpdateField("autoNotes", e.target.value)}
              placeholder="What did the robot do in auto?"
              rows={4}
              className={scoutNotesTextareaClass}
              data-testid={`textarea-auto-notes-${index}`}
            />
          </div>
          {form.playedDefense && (
            <div className={cn("rounded-2xl border p-3", defenseNotesShell || FIELD_SHELL_FALLBACK)}>
              <Label className="text-sm font-medium text-zinc-100">Defense</Label>
              <Textarea
                value={form.defenseNotes}
                onChange={(e) => onUpdateField("defenseNotes", e.target.value)}
                placeholder="How did they play defense?"
                rows={4}
                className={scoutNotesTextareaClass}
                data-testid={`textarea-defense-notes-${index}`}
              />
            </div>
          )}
          <div className={cn("rounded-2xl border p-3", driverNotesShell || FIELD_SHELL_FALLBACK)}>
            <Label className="text-sm font-medium text-zinc-100">Driver skill</Label>
            <Textarea
              value={form.driverSkillNotes}
              onChange={(e) => onUpdateField("driverSkillNotes", e.target.value)}
              placeholder="Driver awareness, movement, decision-making…"
              rows={4}
              className={scoutNotesTextareaClass}
              data-testid={`textarea-driver-notes-${index}`}
            />
          </div>
          <div className={cn("rounded-2xl border p-3", miscNotesShell || FIELD_SHELL_FALLBACK)}>
            <Label className="text-sm font-medium text-zinc-100">Misc.</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => onUpdateField("notes", e.target.value)}
              placeholder="Anything else coaches should know…"
              rows={4}
              className={scoutNotesTextareaClass}
              data-testid={`textarea-notes-${index}`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ScoutForm() {
  const { toast } = useToast();
  const help = useHelp();

  const [selectedTeamId, setSelectedTeamId] = useState(0);
  const [matchNumberInput, setMatchNumberInput] = useState<string>("1");
  const lastSyncedServerMatchRef = useRef<number | null>(null);
  const matchNumber = (() => {
    const n = parseInt(matchNumberInput, 10);
    return !isNaN(n) && n >= 1 ? n : undefined;
  })();
  const [formData, setFormData] = useState<FormData>(() => getEmptyForm());

  const { id: eventIdParam } = useParams<{ id: string }>();
  const eventId = parseInt(eventIdParam || "0");

  const { data: activeEvent, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
    enabled: !!eventId,
  });

  const { data: schedule } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
    enabled: !!eventId,
  });

  const maxMatchNumber = useMemo(() => {
    if (!schedule?.length) return undefined;
    return Math.max(...schedule.map((s) => s.matchNumber));
  }, [schedule]);

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
    enabled: !!eventId,
  });

  const { user } = useAuth();

  const teams = useMemo(() => (eventTeams || []).map((et) => et.team), [eventTeams]);
  const teamStats = useMemo(() => computeTeamStats(teams, entries || []), [teams, entries]);
  const statRanges = useMemo((): ScoutStatRanges => {
    const ranges = computeStatRanges(teamStats);
    if (!ranges) return DEFAULT_STAT_RANGES;
    return {
      auto: ranges.auto,
      throughput: ranges.throughput,
      accuracy: ranges.accuracy,
      evadedDefense: ranges.evadedDefense,
      defense: ranges.defense,
      autoAccuracy: ranges.autoAccuracy,
      driverSkill: ranges.driverSkill,
    };
  }, [teamStats]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlM = params.get("match");
    if (urlM && /^\d+$/.test(urlM)) {
      const n = parseInt(urlM, 10);
      const clamped = maxMatchNumber != null ? Math.min(Math.max(1, n), maxMatchNumber) : Math.max(1, n);
      setMatchNumberInput(String(clamped));
      lastSyncedServerMatchRef.current = null;
      return;
    }
    if (!activeEvent) return;
    const raw = activeEvent.testingOverrideMatchNumber ?? activeEvent.currentMatchNumber ?? 1;
    let n = Math.max(1, raw);
    if (maxMatchNumber != null) n = Math.min(n, maxMatchNumber);
    if (lastSyncedServerMatchRef.current === n) return;
    lastSyncedServerMatchRef.current = n;
    setMatchNumberInput(String(n));
  }, [activeEvent, activeEvent?.currentMatchNumber, activeEvent?.testingOverrideMatchNumber, maxMatchNumber]);

  useEffect(() => {
    setSelectedTeamId(0);
  }, [matchNumber]);

  const submitMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/entries", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "scouters"] });
      if (user?.id) queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitAll = async () => {
    if (!eventId) return;

    if (matchNumber == null || matchNumber < 1) {
      toast({ title: "Please set a valid match number", variant: "destructive" });
      return;
    }
    if (maxMatchNumber != null && matchNumber > maxMatchNumber) {
      toast({ title: `Match number cannot exceed ${maxMatchNumber}`, variant: "destructive" });
      return;
    }

    if (selectedTeamId <= 0) {
      toast({ title: "Please select a team", variant: "destructive" });
      return;
    }

    try {
      const { evadedDefenseTracked, ...restForm } = formData;
      await submitMutation.mutateAsync({
        teamId: selectedTeamId,
        eventId: eventId,
        matchNumber: matchNumber,
        ...restForm,
        evadedDefense: evadedDefenseTracked ? formData.evadedDefense : null,
      });
      toast({ title: "Match data submitted!" });
      setSelectedTeamId(0);
      setFormData(getEmptyForm());
      const next = matchNumber + 1;
      setMatchNumberInput(String(maxMatchNumber != null ? Math.min(next, maxMatchNumber) : next));
    } catch {
      /* toast from mutation */
    }
  };

  if (eventLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-6 flex items-center gap-2" data-testid="text-page-title">
          Scout
          {help?.HelpTrigger?.({
            content: {
              title: "Scouting form",
              body: <p>Record match data: pick team and match, then enter auto, teleop (throughput, accuracy), climb, defense, and notes. Submit when done.</p>,
            },
          })}
        </h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No Active Event</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to Events to create or activate an event.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayMatch = matchNumber ?? "—";

  return (
    <div className="min-h-full bg-zinc-950 pb-28 text-zinc-100" data-testid="scout-form-root">
      <header
        className="relative z-40 border-b border-white/10 bg-zinc-900/50 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        data-testid="master-bar"
      >
        <div className="mx-auto max-w-2xl px-4 pb-5 pt-4 sm:max-w-3xl sm:px-5 sm:pb-6 sm:pt-5">
          <div className="mb-4 flex items-center justify-center gap-2" data-testid="text-page-title">
            <span className="max-w-[min(100%,20rem)] truncate text-center text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              {activeEvent.name}
            </span>
            {help?.HelpTrigger?.({
              content: {
                title: "Scouting form",
                body: (
                  <p>
                    Pick the match and team, then work top to bottom: auto, teleop, heatmap, endgame, notes. Submit when
                    done.
                  </p>
                ),
              },
            })}
          </div>

          <div
            className={cn(
              "flex items-center justify-center gap-3 sm:gap-6 rounded-2xl border p-3 backdrop-blur-sm",
              FIELD_SHELL_FALLBACK,
            )}
          >
            <button
              type="button"
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-zinc-100 shadow-inner backdrop-blur-md transition-all duration-200 active:scale-[0.97] hover:border-white/25 hover:bg-zinc-900/50 disabled:opacity-35"
              onClick={() => {
                const n = matchNumber ?? 1;
                setMatchNumberInput(String(Math.max(1, n - 1)));
              }}
              disabled={(matchNumber ?? 1) <= 1}
              data-testid="button-match-minus"
            >
              <Minus className="h-9 w-9 stroke-[2.5]" />
            </button>

            <div className="min-w-0 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-200 sm:text-xs">Match</p>
              <p
                className="mt-1 text-5xl font-black tabular-nums leading-none tracking-tight text-zinc-50 sm:text-6xl"
                data-testid="input-match-number"
                aria-live="polite"
              >
                {displayMatch}
              </p>
            </div>

            <button
              type="button"
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-zinc-100 shadow-inner backdrop-blur-md transition-all duration-200 active:scale-[0.97] hover:border-white/25 hover:bg-zinc-900/50 disabled:opacity-35"
              onClick={() => {
                const next = (matchNumber ?? 1) + 1;
                setMatchNumberInput(String(maxMatchNumber != null ? Math.min(next, maxMatchNumber) : next));
              }}
              disabled={maxMatchNumber != null && (matchNumber ?? 1) >= maxMatchNumber}
              data-testid="button-match-plus"
            >
              <Plus className="h-9 w-9 stroke-[2.5]" />
            </button>
          </div>

          <div className={cn("mt-6 rounded-2xl border p-3 backdrop-blur-sm", FIELD_SHELL_FALLBACK)}>
            <TeamSearchCombobox
              eventTeams={eventTeams}
              selectedTeamId={selectedTeamId}
              onSelectTeam={setSelectedTeamId}
              compact={false}
              prominent
              testId="select-team-0"
              matchNumber={matchNumber}
              schedule={schedule}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5 sm:max-w-3xl sm:px-5 sm:py-6">
        <TeamFormColumn index={0} form={formData} onUpdateField={updateField} statRanges={statRanges} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl sm:sticky sm:rounded-t-2xl sm:border sm:border-white/10 sm:shadow-xl sm:shadow-black/40 md:mx-auto md:mb-4 md:max-w-3xl md:rounded-2xl">
        <Button
          type="button"
          size="lg"
          className="h-14 w-full touch-manipulation rounded-xl bg-blue-600 text-base font-bold text-white shadow-lg shadow-black/25 transition-all duration-200 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-60"
          disabled={submitMutation.isPending}
          onClick={handleSubmitAll}
          data-testid="button-submit-entry"
        >
          {submitMutation.isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : null}
          Submit Match Data
        </Button>
      </div>
    </div>
  );
}
