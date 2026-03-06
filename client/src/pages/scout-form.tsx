import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Minus,
  Plus,
  Send,
  Calendar,
  Radio,
  Loader2,
  Eraser,
  Undo2,
  Target,
  Bot,
  ArrowUp,
  Crosshair,
  Check,
  Search,
  MessageSquare,
  User,
  Users,
} from "lucide-react";
import type { Event, Team, EventTeam, ScoutingEntry, ScheduleMatch } from "@shared/schema";
import heatmapFieldPath from "@assets/hehehehe_1771897335677.png";
import { getHeatColor as getHeatColorLib, getHeatCssColor, getRowBorderColor, computeTeamStats, computeStatRanges } from "@/lib/team-colors";
import { useHelp } from "@/contexts/help-context";

/** Heat class for form inputs: combines bg/text and left border from team-colors so colors match Team List. */
function getHeatClass(value: number, min: number, max: number): string {
  const bg = getHeatColorLib(value, min, max);
  const border = getRowBorderColor(value, min, max);
  return [bg, border].filter(Boolean).join(" ") || "border-border";
}

const DEFAULT_STAT_RANGES = {
  auto: { min: 0, max: 10 },
  throughput: { min: 0, max: 14 },
  accuracy: { min: 0, max: 100 },
  defense: { min: 0, max: 100 },
};

function TeamSearchCombobox({
  eventTeams,
  selectedTeamId,
  onSelectTeam,
  compact,
  testId,
  matchNumber,
  schedule,
}: {
  eventTeams?: (EventTeam & { team: Team })[];
  selectedTeamId: number;
  onSelectTeam: (teamId: number) => void;
  compact: boolean;
  testId: string;
  matchNumber?: number;
  schedule?: Pick<ScheduleMatch, "matchNumber" | "red1" | "red2" | "red3" | "blue1" | "blue2" | "blue3">[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`flex items-center border rounded-md bg-background px-3 gap-2 cursor-text min-h-11 sm:min-h-0 ${compact ? "h-11 sm:h-11" : "h-12 sm:h-14"} ${open ? "ring-2 ring-ring" : ""}`}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        data-testid={testId}
      >
        <input
          ref={inputRef}
          type="text"
          className={`flex-1 bg-transparent outline-none placeholder:text-muted-foreground ${compact ? "text-sm" : "text-lg"}`}
          placeholder={selectedTeam ? `${selectedTeam.team.teamNumber} - ${selectedTeam.team.teamName}` : "Search team..."}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setSearch("");
              inputRef.current?.blur();
            }
            if (e.key === "Enter" && filtered.length === 1) {
              onSelectTeam(filtered[0].teamId);
              setSearch("");
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          data-testid={`${testId}-input`}
        />
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No teams found
            </div>
          ) : (
            filtered.map((et) => {
              const isRed = redTeamNumbers.has(et.team.teamNumber);
              const isBlue = blueTeamNumbers.has(et.team.teamNumber);
              const redPos = redOrder.indexOf(et.team.teamNumber) + 1;
              const bluePos = blueOrder.indexOf(et.team.teamNumber) + 1;
              const slotLabel = isRed ? `R${redPos}` : isBlue ? `B${bluePos}` : null;
              const allianceClass = isRed ? "bg-red-500/15 hover:bg-red-500/25 border-l-2 border-l-red-500" : isBlue ? "bg-blue-500/15 hover:bg-blue-500/25 border-l-2 border-l-blue-500" : "";
              return (
                <div
                  key={et.teamId}
                  className={`flex items-center gap-2 px-3 cursor-pointer ${compact ? "py-2 text-sm" : "py-3 text-base"} ${et.teamId === selectedTeamId ? "bg-accent/50" : allianceClass || "hover:bg-accent"}`}
                  onClick={() => {
                    onSelectTeam(et.teamId);
                    setSearch("");
                    setOpen(false);
                  }}
                  data-testid={`${testId}-option-${et.team.teamNumber}`}
                >
                  {et.teamId === selectedTeamId && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                  {slotLabel && (
                    <span className={`shrink-0 w-7 text-xs font-bold tabular-nums ${isRed ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>{slotLabel}</span>
                  )}
                  <span className={et.teamId === selectedTeamId ? "" : slotLabel ? "" : "ml-6"}>
                    <span className={`font-bold ${isRed ? "text-red-600 dark:text-red-400" : isBlue ? "text-blue-600 dark:text-blue-400" : "text-primary"}`}>{et.team.teamNumber}</span>
                    <span className="ml-1.5">{et.team.teamName}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function BigCounterInput({
  value,
  onChange,
  label,
  testId,
  heatClass = "",
  heatBorderColor = "",
  allowOverwriteZero = false,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  testId: string;
  heatClass?: string;
  /** CSS color for input border (matches cell outline / slider track) */
  heatBorderColor?: string;
  /** When true, display empty string for 0 so user can type fresh (e.g. "2" not "02") */
  allowOverwriteZero?: boolean;
}) {
  const displayValue = allowOverwriteZero && value === 0 ? "" : value;
  return (
    <div className={`space-y-1.5 sm:space-y-2 rounded-lg border-l-4 p-2 sm:p-2 ${heatClass || "border-border"}`}>
      <Label className="text-sm font-medium text-inherit">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0 touch-manipulation"
          onClick={() => onChange(Math.max(0, value - 1))}
          data-testid={`button-${testId}-minus`}
        >
          <Minus className="h-4 w-4 sm:h-4 sm:w-4" />
        </Button>
        <input
          type="number"
          min={0}
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") onChange(0);
            else {
              const v = parseInt(raw, 10);
              if (!isNaN(v)) onChange(Math.max(0, v));
            }
          }}
          style={heatBorderColor ? { borderColor: heatBorderColor } : undefined}
          className={`h-11 sm:h-9 flex-1 min-w-0 text-center text-xl sm:text-2xl font-bold tabular-nums rounded border bg-background/50 dark:bg-background/70 text-inherit placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none touch-manipulation ${!heatBorderColor ? "border-border" : ""}`}
          data-testid={`text-${testId}-value`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 w-11 sm:h-9 sm:w-9 shrink-0 touch-manipulation"
          onClick={() => onChange(value + 1)}
          data-testid={`button-${testId}-plus`}
        >
          <Plus className="h-4 w-4 sm:h-4 sm:w-4" />
        </Button>
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
    const img = new Image();
    img.src = heatmapFieldPath;
    img.onload = () => { fieldImgRef.current = img; drawHeatmap(); };
    fieldImgRef.current = img;
  }, []);

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
    if (fieldImgRef.current?.complete) {
      const img = fieldImgRef.current;
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
        ctx.strokeStyle = "hsl(217, 91%, 45%)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = "hsl(217, 91%, 45%)";
        ctx.fill();
      }
    }
  }, [points]);

  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);

  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Shooting Heatmap</Label>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation" onClick={undo} data-testid="button-heatmap-undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation" onClick={clear} data-testid="button-heatmap-clear">
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-inner max-h-[200px] sm:max-h-none">
        <canvas
          ref={canvasRef}
          width={400}
          height={250}
          className="w-full touch-none cursor-crosshair block"
          style={{ aspectRatio: "400/250" }}
          onMouseDown={handleTap}
          onTouchStart={handleTap}
          data-testid="canvas-shooting-heatmap"
        />
      </div>
      <p className="text-xs text-muted-foreground">Tap where the robot shoots from — max 4 points</p>
    </div>
  );
}

/** Slider 0–100% with individual integer steps. Value is stored/read as 0–100 directly. */
function RatingSelector({
  value,
  onChange,
  label,
  testId,
  heatClass = "",
  sliderColor = "",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  testId: string;
  heatClass?: string;
  sliderColor?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`space-y-2 rounded-lg border-l-4 p-2 ${heatClass || "border-border"}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-inherit">{label}</Label>
        <Badge variant="secondary" className="text-base px-2 tabular-nums text-inherit bg-secondary/50" data-testid={`text-${testId}-value`}>
          {pct}%
        </Badge>
      </div>
      <Slider
        value={[pct]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={1}
        trackColor={sliderColor || undefined}
        className="py-2 sm:py-1 touch-manipulation"
        data-testid={`slider-${testId}`}
      />
    </div>
  );
}

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
    teleopAccuracy: 50,
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
  selectedTeamId,
  eventTeams,
  statRanges,
  onUpdateField,
  onSelectTeam,
  onRemove,
  canRemove,
  teamCount,
  singleScreen = false,
  matchNumber,
  schedule,
}: {
  index: number;
  form: FormData;
  selectedTeamId: number;
  eventTeams?: (EventTeam & { team: Team })[];
  statRanges: { auto: { min: number; max: number }; throughput: { min: number; max: number }; accuracy: { min: number; max: number }; defense: { min: number; max: number } };
  onUpdateField: (field: string, value: any) => void;
  onSelectTeam: (teamId: number) => void;
  onRemove: () => void;
  canRemove: boolean;
  teamCount: number;
  singleScreen?: boolean;
  matchNumber?: number;
  schedule?: Pick<ScheduleMatch, "matchNumber" | "red1" | "red2" | "red3" | "blue1" | "blue2" | "blue3">[];
}) {
  const compact = teamCount > 1 || singleScreen;
  const selectedTeam = eventTeams?.find((et) => et.teamId === selectedTeamId);
  const r = statRanges;
  /* Use non-degenerate ranges so heat colors always work (min === max breaks getHeatColor) */
  const throughputRange = r.throughput.max > r.throughput.min ? r.throughput : DEFAULT_STAT_RANGES.throughput;
  const autoRange = r.auto.max > r.auto.min ? r.auto : DEFAULT_STAT_RANGES.auto;
  const accuracyRange = r.accuracy.max > r.accuracy.min ? r.accuracy : DEFAULT_STAT_RANGES.accuracy;
  const defenseRange = r.defense.max > r.defense.min ? r.defense : DEFAULT_STAT_RANGES.defense;
  /* Neutral until a value is chosen: 0 = default for auto/BPS/defense, 50 = default for accuracy */
  const autoHeat = form.autoBallsShot === 0 ? "" : getHeatClass(form.autoBallsShot, autoRange.min, autoRange.max);
  const autoHeatBorderColor = form.autoBallsShot === 0 ? "" : getHeatCssColor(form.autoBallsShot, autoRange.min, autoRange.max);
  const throughputHeat = form.teleopFpsEstimate === 0 ? "" : getHeatClass(form.teleopFpsEstimate, throughputRange.min, throughputRange.max);
  const accuracyHeat = form.teleopAccuracy === 50 ? "" : getHeatClass(form.teleopAccuracy, accuracyRange.min, accuracyRange.max);
  const accuracySliderColor = form.teleopAccuracy === 50 ? "" : getHeatCssColor(form.teleopAccuracy, accuracyRange.min, accuracyRange.max);
  const defenseHeat = form.defenseRating === 0 ? "" : getHeatClass(form.defenseRating, defenseRange.min, defenseRange.max);
  const defenseSliderColor = form.defenseRating === 0 ? "" : getHeatCssColor(form.defenseRating, defenseRange.min, defenseRange.max);

  const noteRows = singleScreen ? 2 : 3;
  const noteMinH = singleScreen ? "min-h-[60px]" : "min-h-[80px]";

  return (
    <div className={`${singleScreen ? "space-y-3 sm:space-y-4 lg:space-y-5 max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto w-full px-0" : `space-y-3 sm:space-y-4 lg:space-y-5 ${compact ? "min-w-[280px] sm:min-w-[320px] lg:min-w-[340px] flex-1" : "max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto w-full"}`}`} data-testid={`team-column-${index}`}>
      <Card className={singleScreen ? "py-0 sm:py-1" : ""}>
        <CardHeader className="pb-2 px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 lg:pt-6">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2 sm:gap-3">
              <Bot className="h-4 w-4 shrink-0" />
              <span className="font-semibold">Robot {index + 1}</span>
              {selectedTeam && (
                <Badge variant="secondary" className="text-base sm:text-lg font-bold tabular-nums px-2.5 py-1">
                  #{selectedTeam.team.teamNumber}
                </Badge>
              )}
            </span>
            {canRemove && (
              <Button type="button" variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 sm:min-w-0 shrink-0 touch-manipulation px-2 text-destructive hover:text-destructive" onClick={onRemove} data-testid={`button-remove-robot-${index}`}>
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-6">
          <TeamSearchCombobox
            eventTeams={eventTeams}
            selectedTeamId={selectedTeamId}
            onSelectTeam={onSelectTeam}
            compact={compact}
            testId={`select-team-${index}`}
            matchNumber={matchNumber}
            schedule={schedule}
          />
        </CardContent>
      </Card>

      {/* Stats — themed like team profile Teleop section */}
      <Card className="border-t-4 border-chart-2/30">
        <CardHeader className="pb-2 px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 lg:pt-6">
          <CardTitle className="text-sm flex items-center gap-2 text-chart-2">
            <Target className="h-4 w-4" />
            Stats
          </CardTitle>
          <p className="text-xs text-muted-foreground hidden sm:block">Colors match Team List — yellow = top, green = strong, red = weak</p>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3 pt-0 px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-6">
          <BigCounterInput
            value={form.autoBallsShot}
            onChange={(v) => onUpdateField("autoBallsShot", v)}
            label="Auto balls"
            testId={`auto-balls-${index}`}
            heatClass={autoHeat}
            heatBorderColor={autoHeatBorderColor}
            allowOverwriteZero
          />
          {form.autoBallsShot >= 1 && (
            <RatingSelector value={form.autoAccuracy} onChange={(v) => onUpdateField("autoAccuracy", v)} label="Auto accuracy (%)" testId={`auto-accuracy-${index}`} heatClass="" sliderColor="" />
          )}
          <div className={`rounded-lg border-l-4 p-2 ${throughputHeat || "border-border"}`}>
            <Label className="text-sm font-medium text-inherit">Throughput</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
              {([
                { label: "1–2", value: 2 },
                { label: "3–8", value: 6 },
                { label: "9–16", value: 13 },
                { label: "17+", value: 20 },
              ] as const).map(({ label, value }) => {
                const selected =
                  (value === 2 && form.teleopFpsEstimate >= 1 && form.teleopFpsEstimate <= 2) ||
                  (value === 6 && form.teleopFpsEstimate >= 3 && form.teleopFpsEstimate <= 8) ||
                  (value === 13 && form.teleopFpsEstimate >= 9 && form.teleopFpsEstimate <= 16) ||
                  (value === 20 && form.teleopFpsEstimate >= 17);
                const isDefaultBps = form.teleopFpsEstimate === 0;
                const heatClass = isDefaultBps ? "" : getHeatColorLib(value, throughputRange.min, throughputRange.max);
                const heatBorderStyle = isDefaultBps ? "" : getHeatCssColor(value, throughputRange.min, throughputRange.max);
                const selectedClass = selected
                  ? heatClass
                    ? `border-2 ${heatClass} font-semibold`
                    : isDefaultBps
                      ? "bg-muted text-muted-foreground border-2 border-muted-foreground/30 font-semibold"
                      : "bg-primary text-primary-foreground border-2 border-primary"
                  : "";
                return (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-10 sm:h-9 text-sm touch-manipulation ${selectedClass}`}
                    style={selected && heatBorderStyle ? { borderColor: heatBorderStyle } : undefined}
                    onClick={() => onUpdateField("teleopFpsEstimate", value)}
                    data-testid={`button-throughput-${value}-${index}`}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
          <RatingSelector value={form.teleopAccuracy} onChange={(v) => onUpdateField("teleopAccuracy", v)} label="Accuracy (%)" testId={`accuracy-${index}`} heatClass={accuracyHeat} sliderColor={accuracySliderColor} />
          <RatingSelector value={form.driverSkill} onChange={(v) => onUpdateField("driverSkill", v)} label="Driver skill (%)" testId={`driver-skill-${index}`} heatClass="" sliderColor="" />
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 sm:py-2 min-h-11 sm:min-h-0">
            <Label className="text-sm font-medium text-muted-foreground">Moves while shooting?</Label>
            <div className="flex gap-1.5 shrink-0">
              {([{ value: true, label: "Yes" }, { value: false, label: "No" }] as const).map(({ value, label }) => (
                <Button key={String(value)} type="button" variant="outline" size="sm" className={`h-9 px-3 text-sm touch-manipulation ${form.teleopMoveWhileShoot === value ? (value ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white dark:bg-emerald-500 dark:border-emerald-500 dark:hover:bg-emerald-600" : "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 hover:text-muted-foreground") : ""}`} onClick={() => onUpdateField("teleopMoveWhileShoot", value)} data-testid={`button-move-while-shoot-${value}-${index}`}>{label}</Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 sm:py-2 min-h-11 sm:min-h-0">
            <Label className="text-sm font-medium text-muted-foreground">Played Defense?</Label>
            <div className="flex gap-1.5 shrink-0">
              {([{ value: true, label: "Yes" }, { value: false, label: "No" }] as const).map(({ value, label }) => (
                <Button key={String(value)} type="button" variant="outline" size="sm" className={`h-9 px-3 text-sm touch-manipulation ${form.playedDefense === value ? (value ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white dark:bg-emerald-500 dark:border-emerald-500 dark:hover:bg-emerald-600" : "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 hover:text-muted-foreground") : ""}`} onClick={() => { onUpdateField("playedDefense", value); if (!value) { onUpdateField("defenseRating", 0); onUpdateField("defenseNotes", ""); } }} data-testid={`button-played-defense-${value}-${index}`}>{label}</Button>
              ))}
            </div>
          </div>
          {form.playedDefense && (
            <>
              <RatingSelector value={form.defenseRating} onChange={(v) => onUpdateField("defenseRating", v)} label="Defense (%)" testId={`defense-${index}`} heatClass={defenseHeat} sliderColor={defenseSliderColor} />
            </>
          )}
        </CardContent>
      </Card>

      <div className={singleScreen ? "grid grid-cols-1 lg:grid-cols-3 gap-3" : "space-y-3 sm:space-y-4"}>
      {/* Auto climb — primary theme like team profile Auto */}
      <Card className="border-t-4 border-primary/30">
        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm flex items-center gap-2 text-primary">
            <ArrowUp className="h-4 w-4" />
            Auto climb
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 px-3 sm:px-6 pb-4 sm:pb-6">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Climb</Label>
            <div className="grid grid-cols-3 gap-2 sm:gap-1.5 mt-1.5">
              {([
                { value: "success", label: "Climbed", selectedClass: "bg-green-600 text-white border-green-600 hover:bg-green-700 hover:text-white dark:bg-green-500 dark:border-green-500 dark:hover:bg-green-600" },
                { value: "failed", label: "Failed", selectedClass: "bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white dark:bg-red-500 dark:border-red-500 dark:hover:bg-red-600" },
                { value: "none", label: "Didn't try", selectedClass: "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 hover:text-muted-foreground" },
              ] as const).map((opt) => {
                const selected = form.autoClimbSuccess === opt.value;
                return (
                  <Button key={opt.value} type="button" variant="outline" size="sm" className={`h-10 sm:h-9 text-sm touch-manipulation w-full min-w-0 ${selected ? opt.selectedClass : ""}`} onClick={() => { onUpdateField("autoClimbSuccess", opt.value); if (opt.value === "none") { onUpdateField("autoClimbPosition", ""); onUpdateField("autoClimbLevel", ""); } else if (opt.value === "success") { onUpdateField("autoClimbLevel", "1"); } }} data-testid={`button-auto-climb-${opt.value}-${index}`}>{opt.label}</Button>
                );
              })}
            </div>
          </div>
          {form.autoClimbSuccess !== "none" && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-1.5">
                {[{ value: "left", label: "Left" }, { value: "middle", label: "Mid" }, { value: "right", label: "Right" }].map((opt) => (
                  <Button key={opt.value} type="button" variant={form.autoClimbPosition === opt.value ? "default" : "outline"} size="sm" className="h-10 sm:h-8 text-xs touch-manipulation" onClick={() => onUpdateField("autoClimbPosition", opt.value)} data-testid={`button-auto-climb-pos-${opt.value}-${index}`}>{opt.label}</Button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground shrink-0">Level</Label>
                <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium" data-testid="text-auto-climb-level-1">L1</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Teleop — chart-2 theme like team profile */}
      <Card className="border-t-4 border-chart-2/30">
        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm flex items-center gap-2 text-chart-2">
            <Crosshair className="h-4 w-4" />
            Teleop
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-6 pb-4 sm:pb-6">
          <ShootingHeatmap value={form.teleopShootPosition} onChange={(v) => onUpdateField("teleopShootPosition", v)} />
        </CardContent>
      </Card>

      {/* Endgame — chart-5 theme like team profile */}
      <Card className="border-t-4 border-chart-5/30">
        <CardHeader className="pb-2 px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 lg:pt-6">
          <CardTitle className="text-sm flex items-center gap-2 text-chart-5">
            <ArrowUp className="h-4 w-4" />
            Endgame
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-6">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Climb</Label>
            <div className="grid grid-cols-3 gap-2 sm:gap-1.5 mt-1.5">
              {([
                { value: "success", label: "Climbed", selectedClass: "bg-green-600 text-white border-green-600 hover:bg-green-700 hover:text-white dark:bg-green-500 dark:border-green-500 dark:hover:bg-green-600" },
                { value: "failed", label: "Failed", selectedClass: "bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white dark:bg-red-500 dark:border-red-500 dark:hover:bg-red-600" },
                { value: "none", label: "Didn't try", selectedClass: "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 hover:text-muted-foreground" },
              ] as const).map((opt) => {
                const selected = form.climbSuccess === opt.value;
                return (
                  <Button key={opt.value} type="button" variant="outline" size="sm" className={`h-10 sm:h-9 text-sm touch-manipulation w-full min-w-0 ${selected ? opt.selectedClass : ""}`} onClick={() => { onUpdateField("climbSuccess", opt.value); if (opt.value === "none") { onUpdateField("climbPosition", ""); onUpdateField("climbLevel", ""); } }} data-testid={`button-climb-${opt.value}-${index}`}>{opt.label}</Button>
                );
              })}
            </div>
          </div>
          {form.climbSuccess !== "none" && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-1.5">
                {[{ value: "left", label: "Left" }, { value: "middle", label: "Mid" }, { value: "right", label: "Right" }].map((opt) => (
                  <Button key={opt.value} type="button" variant={form.climbPosition === opt.value ? "default" : "outline"} size="sm" className="h-10 sm:h-8 text-xs touch-manipulation" onClick={() => onUpdateField("climbPosition", opt.value)} data-testid={`button-climb-pos-${opt.value}-${index}`}>{opt.label}</Button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-1.5">
                {[{ value: "1", label: "L1" }, { value: "2", label: "L2" }, { value: "3", label: "L3" }].map((opt) => (
                  <Button key={opt.value} type="button" variant={form.climbLevel === opt.value ? "default" : "outline"} size="sm" className="h-10 sm:h-8 text-xs touch-manipulation" onClick={() => onUpdateField("climbLevel", opt.value)} data-testid={`button-climb-level-${opt.value}-${index}`}>{opt.label}</Button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Notes & observations — at bottom, themed like team profile Scout Notes */}
      <Card className="border-t-4 border-primary/30 bg-primary/[0.02]">
        <CardHeader className="pb-2 px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 lg:pt-6">
          <CardTitle className="text-base flex items-center gap-2 text-primary">
            <MessageSquare className="h-4 w-4" />
            Notes & observations
          </CardTitle>
          <p className="text-xs text-muted-foreground hidden sm:block">What you saw — this is what matters most for picks</p>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 pt-0 px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-6">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Auto</Label>
            <Textarea
              value={form.autoNotes}
              onChange={(e) => onUpdateField("autoNotes", e.target.value)}
              placeholder="What did the robot do in auto?"
              className={`resize-none mt-1.5 min-h-[4rem] sm:min-h-[5rem] ${noteMinH}`}
              rows={noteRows}
              data-testid={`textarea-auto-notes-${index}`}
            />
          </div>
          {form.playedDefense && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Defense</Label>
              <Textarea
                value={form.defenseNotes}
                onChange={(e) => onUpdateField("defenseNotes", e.target.value)}
                placeholder="How did they play defense?"
                className={`resize-none mt-1.5 min-h-[4rem] sm:min-h-[5rem] ${noteMinH}`}
                rows={noteRows}
                data-testid={`textarea-defense-notes-${index}`}
              />
            </div>
          )}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Driver skill</Label>
            <Textarea
              value={form.driverSkillNotes}
              onChange={(e) => onUpdateField("driverSkillNotes", e.target.value)}
              placeholder="Driver awareness, gear shifts, movement patterns..."
              className={`resize-none mt-1.5 min-h-[4rem] sm:min-h-[5rem] ${noteMinH}`}
              rows={noteRows}
              data-testid={`textarea-driver-notes-${index}`}
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Misc.</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => onUpdateField("notes", e.target.value)}
              placeholder="Any other observations..."
              className={`resize-none mt-1.5 min-h-[4rem] sm:min-h-[5rem] ${noteMinH}`}
              rows={noteRows}
              data-testid={`textarea-notes-${index}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type ScoutMode = "single" | "multi";

export default function ScoutForm() {
  const { toast } = useToast();
  const help = useHelp();

  const [scoutMode, setScoutMode] = useState<ScoutMode>("single");
  const [teamCount, setTeamCount] = useState(1);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([0]);
  const [matchNumber, setMatchNumber] = useState<number>(1);
  const [formDataMap, setFormDataMap] = useState<Record<number, FormData>>({
    0: getEmptyForm(),
  });

  const isSingleScout = scoutMode === "single";
  const effectiveTeamCount = isSingleScout ? 1 : teamCount;

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

  const { data: entries } = useQuery<ScoutingEntry[]>({
    queryKey: ["/api/events", eventId, "entries"],
    enabled: !!eventId,
  });

  const { data: schedule } = useQuery<ScheduleMatch[]>({
    queryKey: ["/api/events", eventId, "schedule"],
    enabled: !!eventId,
  });

  const teams = useMemo(() => (eventTeams || []).map((et) => et.team), [eventTeams]);
  const teamStats = useMemo(() => computeTeamStats(teams, entries || []), [teams, entries]);
  const statRanges = useMemo(() => {
    const ranges = computeStatRanges(teamStats);
    if (ranges) return ranges;
    return DEFAULT_STAT_RANGES;
  }, [teamStats]);

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/entries", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "entries"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changeTeamCount = (count: number) => {
    const clamped = Math.max(1, Math.min(6, count));
    setTeamCount(clamped);
    setSelectedTeams((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push(0);
      return next.slice(0, clamped);
    });
    setFormDataMap((prev) => {
      const next = { ...prev };
      for (let i = 0; i < clamped; i++) {
        if (!next[i]) next[i] = getEmptyForm();
      }
      return next;
    });
  };

  const updateFieldForIndex = (index: number, field: string, value: any) => {
    setFormDataMap((prev) => ({
      ...prev,
      [index]: {
        ...(prev[index] || getEmptyForm()),
        [field]: value,
      },
    }));
  };

  const selectTeamForIndex = (index: number, teamId: number) => {
    setSelectedTeams((prev) => {
      const next = [...prev];
      next[index] = teamId;
      return next;
    });
  };

  const removeRobotSlot = (index: number) => {
    if (teamCount <= 1) return;
    const newCount = teamCount - 1;
    const newTeams = selectedTeams.filter((_, i) => i !== index);
    const newMap: Record<number, FormData> = {};
    newTeams.forEach((_, i) => {
      const oldIdx = i >= index ? i + 1 : i;
      newMap[i] = formDataMap[oldIdx] || getEmptyForm();
    });
    setTeamCount(newCount);
    setSelectedTeams(newTeams);
    setFormDataMap(newMap);
  };

  const handleSubmitAll = async () => {
    if (!eventId) return;

    const validEntries = selectedTeams
      .slice(0, effectiveTeamCount)
      .map((teamId, idx) => ({ teamId, form: formDataMap[idx] }))
      .filter((e) => e.teamId > 0 && e.form);

    if (validEntries.length === 0) {
      toast({ title: "Please select at least one team", variant: "destructive" });
      return;
    }

    let successCount = 0;
    for (const entry of validEntries) {
      try {
        await submitMutation.mutateAsync({
          teamId: entry.teamId,
          eventId: eventId,
          matchNumber: matchNumber,
          ...entry.form,
        });
        successCount++;
      } catch {}
    }

    if (successCount > 0) {
      toast({ title: `${successCount} ${successCount === 1 ? "entry" : "entries"} submitted!` });
      setTeamCount(1);
      setSelectedTeams([0]);
      setFormDataMap({ 0: getEmptyForm() });
      setMatchNumber(matchNumber + 1);
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

  return (
    <div className="pb-20 sm:pb-24">
      <div className="sticky top-0 z-30 bg-background border-b shadow-sm px-3 py-3 sm:px-4" data-testid="master-bar">
        <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate" data-testid="text-page-title">Scout</h1>
            <Badge variant="secondary" className="text-xs shrink-0">
              <Radio className="h-3 w-3 mr-1 text-chart-2" />
              <span className="truncate max-w-[120px] sm:max-w-none">{activeEvent.name}</span>
            </Badge>
            <div className="flex items-center gap-1.5 sm:gap-2 border-l pl-3 sm:pl-4">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Match</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 w-11 sm:h-9 sm:w-9 p-0 touch-manipulation"
                  onClick={() => setMatchNumber((prev) => Math.max(1, (prev || 1) - 1))}
                  disabled={matchNumber <= 1}
                  data-testid="button-match-minus"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="number"
                  min={1}
                  value={matchNumber}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) setMatchNumber(v);
                    else if (e.target.value === "") setMatchNumber(1);
                  }}
                  className="h-11 w-16 sm:h-9 sm:w-16 text-center text-lg sm:text-xl font-bold tabular-nums bg-primary text-primary-foreground rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-ring touch-manipulation [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  data-testid="input-match-number"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 w-11 sm:h-9 sm:w-9 p-0 touch-manipulation"
                  onClick={() => setMatchNumber((prev) => (prev || 1) + 1)}
                  data-testid="button-match-plus"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">

            <div className="h-6 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground sr-only sm:not-sr-only">Mode</span>
              <div className="flex rounded-md border border-input overflow-hidden" role="group" aria-label="Scout mode">
                <Button
                  type="button"
                  variant={isSingleScout ? "default" : "ghost"}
                  size="sm"
                  className="h-10 sm:h-8 rounded-none border-0 px-3 gap-1.5 touch-manipulation"
                  onClick={() => setScoutMode("single")}
                  data-testid="button-scout-mode-single"
                >
                  <User className="h-3.5 w-3.5" />
                  Single
                </Button>
                <Button
                  type="button"
                  variant={!isSingleScout ? "default" : "ghost"}
                  size="sm"
                  className="h-10 sm:h-8 rounded-none border-0 px-3 gap-1.5 touch-manipulation"
                  onClick={() => {
                    setScoutMode("multi");
                    if (teamCount < 1) changeTeamCount(1);
                  }}
                  data-testid="button-scout-mode-multi"
                >
                  <Users className="h-3.5 w-3.5" />
                  Multi
                </Button>
              </div>
            </div>

            {!isSingleScout && (
              <>
                <div className="h-6 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground sr-only sm:not-sr-only">Teams</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation"
                      onClick={() => changeTeamCount(teamCount - 1)}
                      disabled={teamCount <= 1}
                      data-testid="button-team-count-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Badge variant="secondary" className="text-base px-3 py-1.5 sm:py-1 tabular-nums min-w-[2.5rem] sm:min-w-[2rem] text-center" data-testid="text-team-count">
                      {teamCount}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation"
                      onClick={() => changeTeamCount(teamCount + 1)}
                      disabled={teamCount >= 6}
                      data-testid="button-team-count-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`px-3 py-4 sm:p-4 md:p-6 lg:p-8 ${effectiveTeamCount > 1 ? "overflow-x-auto" : ""}`}>
        <div className={`flex gap-3 sm:gap-4 lg:gap-6 ${effectiveTeamCount > 1 ? "items-start" : "justify-center"}`}>
          {Array.from({ length: effectiveTeamCount }).map((_, idx) => (
            <TeamFormColumn
              key={idx}
              index={idx}
              form={formDataMap[idx] || getEmptyForm()}
              selectedTeamId={selectedTeams[idx] || 0}
              eventTeams={eventTeams}
              statRanges={statRanges}
              onUpdateField={(field, value) => updateFieldForIndex(idx, field, value)}
              onSelectTeam={(teamId) => selectTeamForIndex(idx, teamId)}
              onRemove={() => removeRobotSlot(idx)}
              canRemove={effectiveTeamCount > 1}
              teamCount={effectiveTeamCount}
              singleScreen={isSingleScout}
              matchNumber={matchNumber}
              schedule={schedule}
            />
          ))}
        </div>
      </div>

      <div className={`sticky bottom-0 left-0 right-0 z-20 px-3 py-3 sm:py-0 sm:pt-4 sm:static sm:mt-4 md:mt-6 lg:mt-8 bg-background/95 sm:bg-transparent backdrop-blur-sm border-t sm:border-t-0 ${effectiveTeamCount === 1 ? "sm:max-w-2xl lg:max-w-3xl sm:mx-auto sm:px-0" : ""}`}>
        <Button
          type="button"
          size="lg"
          className="w-full min-h-12 h-12 sm:h-14 text-lg sm:text-xl font-bold touch-manipulation"
          disabled={submitMutation.isPending}
          onClick={handleSubmitAll}
          data-testid="button-submit-entry"
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
          ) : (
            <Send className="h-6 w-6 mr-2" />
          )}
          Submit {selectedTeams.slice(0, effectiveTeamCount).filter((t) => t > 0).length > 1
            ? `${selectedTeams.slice(0, effectiveTeamCount).filter((t) => t > 0).length} Entries`
            : "Entry"}
        </Button>
      </div>
    </div>
  );
}
