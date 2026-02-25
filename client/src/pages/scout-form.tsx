import { useState, useRef, useEffect, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import type { Event, Team, EventTeam } from "@shared/schema";
import fieldImagePath from "@assets/6846b9eeb548474b11b6b16d828c2e6092a99131_1771896624665.png";
import heatmapFieldPath from "@assets/hehehehe_1771897335677.png";

function BigCounterInput({
  value,
  onChange,
  label,
  testId,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-16 w-16 text-2xl shrink-0"
          onClick={() => onChange(Math.max(0, value - 1))}
          data-testid={`button-${testId}-minus`}
        >
          <Minus className="h-6 w-6" />
        </Button>
        <span
          className="text-4xl font-bold flex-1 text-center tabular-nums"
          data-testid={`text-${testId}-value`}
        >
          {value}
        </span>
        <Button
          type="button"
          variant="default"
          className="h-16 w-16 text-2xl shrink-0"
          onClick={() => onChange(value + 1)}
          data-testid={`button-${testId}-plus`}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

function FieldDrawingCanvas({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const prevValueRef = useRef(value);
  const fieldImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = fieldImagePath;
    img.onload = () => { fieldImgRef.current = img; redraw(); };
    fieldImgRef.current = img;
  }, []);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            setStrokes(parsed);
            setCurrentStroke([]);
            return;
          }
        } catch {}
      }
      setStrokes([]);
      setCurrentStroke([]);
    }
  }, [value]);

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

    const allStrokes = [...strokes, currentStroke];
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, currentStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentStroke([pos]);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentStroke((prev) => [...prev, pos]);
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      const newStrokes = [...strokes, currentStroke];
      setStrokes(newStrokes);
      onChange(JSON.stringify(newStrokes));
    }
    setCurrentStroke([]);
  };

  const undo = () => {
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    onChange(JSON.stringify(newStrokes));
  };

  const clear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Draw Auto Path on Field</Label>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" onClick={undo} data-testid="button-drawing-undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clear} data-testid="button-drawing-clear">
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={250}
        className="w-full rounded-md border border-border touch-none cursor-crosshair"
        style={{ aspectRatio: "400/250" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        data-testid="canvas-field-drawing"
      />
      <p className="text-xs text-muted-foreground">Draw the robot's autonomous path</p>
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

    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, W, H);
    if (fieldImgRef.current?.complete) {
      const img = fieldImgRef.current;
      const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    if (points.length > 0) {
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
    const newPoints = [...points, { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }];
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
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Shooting Heatmap</Label>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" onClick={undo} data-testid="button-heatmap-undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clear} data-testid="button-heatmap-clear">
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={250}
        className="w-full rounded-md border border-border touch-none cursor-crosshair"
        style={{ aspectRatio: "400/250" }}
        onMouseDown={handleTap}
        onTouchStart={handleTap}
        data-testid="canvas-shooting-heatmap"
      />
      <p className="text-xs text-muted-foreground">Tap where the robot shoots from — more taps = hotter zone</p>
    </div>
  );
}

function RatingSelector({
  value,
  onChange,
  max = 10,
  label,
  testId,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  label: string;
  testId: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Badge variant="secondary" className="text-lg px-3" data-testid={`text-${testId}-value`}>
          {value}/{max}
        </Badge>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={max}
        step={1}
        className="py-2"
        data-testid={`slider-${testId}`}
      />
    </div>
  );
}

type FormData = {
  autoBallsShot: number;
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
  climbSuccess: string;
  climbPosition: string;
  climbLevel: string;
  defenseRating: number;
  defenseNotes: string;
  driverSkillNotes: string;
  notes: string;
};

function getEmptyForm(): FormData {
  return {
    autoBallsShot: 0,
    autoNotes: "",
    autoDrawing: "",
    autoClimbSuccess: "none",
    autoClimbPosition: "",
    autoClimbLevel: "",
    teleopBallsShot: 0,
    teleopShootPosition: "",
    teleopMoveWhileShoot: false,
    teleopFpsEstimate: 0,
    teleopAccuracy: 5,
    climbSuccess: "none",
    climbPosition: "",
    climbLevel: "",
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
  onUpdateField,
  onSelectTeam,
  onRemove,
  canRemove,
  teamCount,
}: {
  index: number;
  form: FormData;
  selectedTeamId: number;
  eventTeams?: (EventTeam & { team: Team })[];
  onUpdateField: (field: string, value: any) => void;
  onSelectTeam: (teamId: number) => void;
  onRemove: () => void;
  canRemove: boolean;
  teamCount: number;
}) {
  const compact = teamCount > 1;

  return (
    <div className={`space-y-3 ${compact ? "min-w-[340px] flex-1" : "max-w-2xl mx-auto w-full"}`} data-testid={`team-column-${index}`}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Robot {index + 1}
            </span>
            {canRemove && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={onRemove} data-testid={`button-remove-robot-${index}`}>
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Select
            value={selectedTeamId ? selectedTeamId.toString() : ""}
            onValueChange={(v) => onSelectTeam(parseInt(v))}
          >
            <SelectTrigger className={`${compact ? "h-11 text-sm" : "h-14 text-lg"}`} data-testid={`select-team-${index}`}>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {eventTeams?.map((et) => (
                <SelectItem key={et.teamId} value={et.teamId.toString()}>
                  #{et.team.teamNumber} - {et.team.teamName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Autonomous
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <BigCounterInput
            value={form.autoBallsShot}
            onChange={(v) => onUpdateField("autoBallsShot", v)}
            label="Balls Shot in Auto"
            testId={`auto-balls-${index}`}
          />

          <FieldDrawingCanvas
            value={form.autoDrawing}
            onChange={(v) => onUpdateField("autoDrawing", v)}
          />

          <div>
            <Label className="text-sm font-medium">Auto Climb Result</Label>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {[
                { value: "success", label: "Climbed" },
                { value: "failed", label: "Failed" },
                { value: "none", label: "Didn't Try" },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={form.autoClimbSuccess === opt.value ? "default" : "outline"}
                  className={`${compact ? "h-10 text-sm" : "h-14 text-base"}`}
                  onClick={() => {
                    onUpdateField("autoClimbSuccess", opt.value);
                    if (opt.value === "none") { onUpdateField("autoClimbPosition", ""); onUpdateField("autoClimbLevel", ""); }
                  }}
                  data-testid={`button-auto-climb-${opt.value}-${index}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {form.autoClimbSuccess !== "none" && (
            <>
              <div>
                <Label className="text-sm font-medium">Auto Climb Position</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {[
                    { value: "left", label: "Left" },
                    { value: "middle", label: "Middle" },
                    { value: "right", label: "Right" },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={form.autoClimbPosition === opt.value ? "default" : "outline"}
                      className={`${compact ? "h-10 text-sm" : "h-14 text-base"}`}
                      onClick={() => onUpdateField("autoClimbPosition", opt.value)}
                      data-testid={`button-auto-climb-pos-${opt.value}-${index}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Auto Climb Level</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {[
                    { value: "1", label: "Level 1" },
                    { value: "2", label: "Level 2" },
                    { value: "3", label: "Level 3" },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={form.autoClimbLevel === opt.value ? "default" : "outline"}
                      className={`${compact ? "h-10 text-sm" : "h-14 text-base"}`}
                      onClick={() => onUpdateField("autoClimbLevel", opt.value)}
                      data-testid={`button-auto-climb-level-${opt.value}-${index}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <Label className="text-sm font-medium">Auto Notes</Label>
            <Textarea
              value={form.autoNotes}
              onChange={(e) => onUpdateField("autoNotes", e.target.value)}
              placeholder="What did the robot do in auto?"
              className="resize-none mt-1.5"
              rows={2}
              data-testid={`textarea-auto-notes-${index}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crosshair className="h-4 w-4" />
            Teleop
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <ShootingHeatmap
            value={form.teleopShootPosition}
            onChange={(v) => onUpdateField("teleopShootPosition", v)}
          />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Estimated FPS (Fuel Per Second)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className={`${compact ? "h-12 w-12" : "h-16 w-16"} text-2xl shrink-0`}
                onClick={() => onUpdateField("teleopFpsEstimate", Math.max(0, form.teleopFpsEstimate - 1))}
                data-testid={`button-fps-estimate-minus-${index}`}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <input
                type="number"
                min={0}
                value={form.teleopFpsEstimate === 0 ? "" : form.teleopFpsEstimate}
                placeholder="0"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onUpdateField("teleopFpsEstimate", 0);
                  } else {
                    const v = parseInt(raw, 10);
                    if (!isNaN(v)) onUpdateField("teleopFpsEstimate", Math.max(0, v));
                  }
                }}
                className={`${compact ? "h-12 text-2xl" : "h-16 text-4xl"} font-bold text-center tabular-nums flex-1 min-w-0 bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                data-testid={`input-fps-estimate-${index}`}
              />
              <Button
                type="button"
                variant="default"
                className={`${compact ? "h-12 w-12" : "h-16 w-16"} text-2xl shrink-0`}
                onClick={() => onUpdateField("teleopFpsEstimate", form.teleopFpsEstimate + 1)}
                data-testid={`button-fps-estimate-plus-${index}`}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <RatingSelector
            value={form.teleopAccuracy}
            onChange={(v) => onUpdateField("teleopAccuracy", v)}
            max={10}
            label="Accuracy Estimation"
            testId={`accuracy-${index}`}
          />

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <Label className="text-sm font-medium">Moves While Shooting?</Label>
            <Switch
              checked={form.teleopMoveWhileShoot}
              onCheckedChange={(v) => onUpdateField("teleopMoveWhileShoot", v)}
              data-testid={`switch-move-while-shoot-${index}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowUp className="h-4 w-4" />
            Endgame / Climb
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label className="text-sm font-medium">Climb Result</Label>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {[
                { value: "success", label: "Climbed" },
                { value: "failed", label: "Failed" },
                { value: "none", label: "Didn't Try" },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={form.climbSuccess === opt.value ? "default" : "outline"}
                  className={`${compact ? "h-10 text-sm" : "h-14 text-base"}`}
                  onClick={() => {
                    onUpdateField("climbSuccess", opt.value);
                    if (opt.value === "none") { onUpdateField("climbPosition", ""); onUpdateField("climbLevel", ""); }
                  }}
                  data-testid={`button-climb-${opt.value}-${index}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {form.climbSuccess !== "none" && (
            <>
              <div>
                <Label className="text-sm font-medium">Climb Position</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {[
                    { value: "left", label: "Left" },
                    { value: "middle", label: "Middle" },
                    { value: "right", label: "Right" },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={form.climbPosition === opt.value ? "default" : "outline"}
                      className={`${compact ? "h-10 text-sm" : "h-14 text-base"}`}
                      onClick={() => onUpdateField("climbPosition", opt.value)}
                      data-testid={`button-climb-pos-${opt.value}-${index}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Climb Level</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {[
                    { value: "1", label: "Level 1" },
                    { value: "2", label: "Level 2" },
                    { value: "3", label: "Level 3" },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={form.climbLevel === opt.value ? "default" : "outline"}
                      className={`${compact ? "h-10 text-sm" : "h-14 text-base"}`}
                      onClick={() => onUpdateField("climbLevel", opt.value)}
                      data-testid={`button-climb-level-${opt.value}-${index}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Defense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <RatingSelector
            value={form.defenseRating}
            onChange={(v) => onUpdateField("defenseRating", v)}
            max={10}
            label="Defense Rating"
            testId={`defense-${index}`}
          />
          <div>
            <Label className="text-sm font-medium">Defense Notes</Label>
            <Textarea
              value={form.defenseNotes}
              onChange={(e) => onUpdateField("defenseNotes", e.target.value)}
              placeholder="How did they play defense?"
              className="resize-none mt-1.5"
              rows={2}
              data-testid={`textarea-defense-notes-${index}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Driver Skill & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <Label className="text-sm font-medium">Driver Skill Notes</Label>
            <Textarea
              value={form.driverSkillNotes}
              onChange={(e) => onUpdateField("driverSkillNotes", e.target.value)}
              placeholder="Driver awareness, gear shifts, movement patterns..."
              className="resize-none mt-1.5"
              rows={2}
              data-testid={`textarea-driver-notes-${index}`}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">General Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => onUpdateField("notes", e.target.value)}
              placeholder="Any other observations..."
              className="resize-none mt-1.5"
              rows={2}
              data-testid={`textarea-notes-${index}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ScoutForm() {
  const { toast } = useToast();

  const [teamCount, setTeamCount] = useState(1);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([0]);
  const [matchNumber, setMatchNumber] = useState<number>(1);
  const [formDataMap, setFormDataMap] = useState<Record<number, FormData>>({
    0: getEmptyForm(),
  });

  const { id: eventIdParam } = useParams<{ id: string }>();
  const eventId = parseInt(eventIdParam || "0");

  const { data: activeEvent, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      return res.json();
    },
    enabled: !!eventId,
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
    enabled: !!eventId,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/entries", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scouters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
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
      .slice(0, teamCount)
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
        <h1 className="text-2xl font-bold tracking-tight mb-6" data-testid="text-page-title">Scout</h1>
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
    <div className="pb-24">
      <div className="sticky top-0 z-30 bg-background border-b shadow-sm px-4 py-3" data-testid="master-bar">
        <div className="flex items-center justify-between gap-4 flex-wrap max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-page-title">Scout</h1>
            <Badge variant="secondary" className="text-xs">
              <Radio className="h-3 w-3 mr-1 text-chart-2" />
              {activeEvent.name}
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Match</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
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
                  className="h-8 w-14 text-center text-base font-bold tabular-nums bg-primary text-primary-foreground rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  data-testid="input-match-number"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMatchNumber((prev) => (prev || 1) + 1)}
                  data-testid="button-match-plus"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="h-6 w-px bg-border" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Teams</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => changeTeamCount(teamCount - 1)}
                  disabled={teamCount <= 1}
                  data-testid="button-team-count-minus"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Badge variant="secondary" className="text-base px-3 py-1 tabular-nums min-w-[2rem] text-center" data-testid="text-team-count">
                  {teamCount}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => changeTeamCount(teamCount + 1)}
                  disabled={teamCount >= 6}
                  data-testid="button-team-count-plus"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`p-4 ${teamCount > 1 ? "overflow-x-auto" : ""}`}>
        <div className={`flex gap-4 ${teamCount > 1 ? "items-start" : "justify-center"}`}>
          {Array.from({ length: teamCount }).map((_, idx) => (
            <TeamFormColumn
              key={idx}
              index={idx}
              form={formDataMap[idx] || getEmptyForm()}
              selectedTeamId={selectedTeams[idx] || 0}
              eventTeams={eventTeams}
              onUpdateField={(field, value) => updateFieldForIndex(idx, field, value)}
              onSelectTeam={(teamId) => selectTeamForIndex(idx, teamId)}
              onRemove={() => removeRobotSlot(idx)}
              canRemove={teamCount > 1}
              teamCount={teamCount}
            />
          ))}
        </div>
      </div>

      <div className={`px-4 mt-4 ${teamCount === 1 ? "max-w-2xl mx-auto" : ""}`}>
        <Button
          type="button"
          size="lg"
          className="w-full h-16 text-xl font-bold"
          disabled={submitMutation.isPending}
          onClick={handleSubmitAll}
          data-testid="button-submit-entry"
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
          ) : (
            <Send className="h-6 w-6 mr-2" />
          )}
          Submit {selectedTeams.slice(0, teamCount).filter((t) => t > 0).length > 1
            ? `${selectedTeams.slice(0, teamCount).filter((t) => t > 0).length} Entries`
            : "Entry"}
        </Button>
      </div>
    </div>
  );
}
