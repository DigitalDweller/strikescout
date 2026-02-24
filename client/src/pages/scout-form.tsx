import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
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

    ctx.fillStyle = "#1a5c1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#ffffff33";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff44";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

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

    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#ffffff22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff33";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, W - 10, H - 10);

    ctx.strokeStyle = "#ffffff22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(W * 0.12, H / 2, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W * 0.88, H / 2, 30, 0, Math.PI * 2);
    ctx.stroke();

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
        const r = norm > 0.5 ? 255 : Math.floor(norm * 2 * 255);
        const g = norm < 0.5 ? Math.floor(norm * 2 * 200) : Math.floor((1 - norm) * 2 * 200);
        ctx.fillStyle = `rgba(${r}, ${g}, 0, ${Math.min(norm * 0.7 + 0.1, 0.85)})`;
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

export default function ScoutForm() {
  const { toast } = useToast();

  const [selectedTeams, setSelectedTeams] = useState<number[]>([0]);
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);

  const [formDataMap, setFormDataMap] = useState<Record<number, {
    autoBallsShot: number;
    autoNotes: string;
    autoDrawing: string;
    teleopBallsShot: number;
    teleopShootPosition: string;
    teleopMoveWhileShoot: boolean;
    teleopFpsEstimate: number;
    teleopAccuracy: number;
    climbSuccess: string;
    climbPosition: string;
    defenseRating: number;
    defenseNotes: string;
    driverSkillNotes: string;
    notes: string;
  }>>({
    0: getEmptyForm(),
  });

  function getEmptyForm() {
    return {
      autoBallsShot: 0,
      autoNotes: "",
      autoDrawing: "",
      teleopBallsShot: 0,
      teleopShootPosition: "",
      teleopMoveWhileShoot: false,
      teleopFpsEstimate: 0,
      teleopAccuracy: 5,
      climbSuccess: "none",
      climbPosition: "",
      defenseRating: 0,
      defenseNotes: "",
      driverSkillNotes: "",
      notes: "",
    };
  }

  const { data: activeEvent, isLoading: eventLoading } = useQuery<Event | null>({
    queryKey: ["/api/active-event"],
    refetchInterval: 10000,
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", activeEvent?.id, "teams"],
    enabled: !!activeEvent,
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

  const handleSubmitAll = async () => {
    if (!activeEvent) return;

    const validEntries = selectedTeams
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
          eventId: activeEvent.id,
          matchNumber: activeEvent.currentMatchNumber,
          ...entry.form,
        });
        successCount++;
      } catch {}
    }

    if (successCount > 0) {
      toast({ title: `${successCount} ${successCount === 1 ? "entry" : "entries"} submitted!` });
      setSelectedTeams([0]);
      setActiveTeamIndex(0);
      setFormDataMap({ 0: getEmptyForm() });
    }
  };

  const currentForm = formDataMap[activeTeamIndex] || getEmptyForm();

  const updateField = (field: string, value: any) => {
    setFormDataMap((prev) => ({
      ...prev,
      [activeTeamIndex]: {
        ...(prev[activeTeamIndex] || getEmptyForm()),
        [field]: value,
      },
    }));
  };

  const addRobotSlot = () => {
    const newIndex = selectedTeams.length;
    setSelectedTeams([...selectedTeams, 0]);
    setFormDataMap((prev) => ({ ...prev, [newIndex]: getEmptyForm() }));
    setActiveTeamIndex(newIndex);
  };

  const removeRobotSlot = (index: number) => {
    if (selectedTeams.length <= 1) return;
    const newTeams = selectedTeams.filter((_, i) => i !== index);
    setSelectedTeams(newTeams);
    const newMap: typeof formDataMap = {};
    newTeams.forEach((_, i) => {
      const oldIdx = i >= index ? i + 1 : i;
      newMap[i] = formDataMap[oldIdx] || getEmptyForm();
    });
    setFormDataMap(newMap);
    setActiveTeamIndex(Math.min(activeTeamIndex, newTeams.length - 1));
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
              Wait for your admin to set an active event.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Scout</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Radio className="h-3 w-3 text-chart-2" />
            <span>{activeEvent.name}</span>
          </div>
        </div>
        <Badge variant="default" className="text-sm px-3 py-1">
          Match {activeEvent.currentMatchNumber}
        </Badge>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {selectedTeams.map((_, idx) => (
          <Button
            key={idx}
            type="button"
            variant={activeTeamIndex === idx ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTeamIndex(idx)}
            data-testid={`button-robot-tab-${idx}`}
          >
            <Bot className="h-4 w-4 mr-1" />
            Robot {idx + 1}
            {selectedTeams.length > 1 && (
              <span
                className="ml-1 cursor-pointer hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); removeRobotSlot(idx); }}
              >
                x
              </span>
            )}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRobotSlot}
          data-testid="button-add-robot"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Robot
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Team Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Select
            value={selectedTeams[activeTeamIndex] ? selectedTeams[activeTeamIndex].toString() : ""}
            onValueChange={(v) => {
              const newTeams = [...selectedTeams];
              newTeams[activeTeamIndex] = parseInt(v);
              setSelectedTeams(newTeams);
            }}
          >
            <SelectTrigger className="h-14 text-lg" data-testid="select-team">
              <SelectValue placeholder="Select the team you're scouting" />
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Autonomous
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <BigCounterInput
            value={currentForm.autoBallsShot}
            onChange={(v) => updateField("autoBallsShot", v)}
            label="Balls Shot in Auto"
            testId="auto-balls"
          />

          <FieldDrawingCanvas
            value={currentForm.autoDrawing}
            onChange={(v) => updateField("autoDrawing", v)}
          />

          <div>
            <Label className="text-sm font-medium">Auto Notes</Label>
            <Textarea
              value={currentForm.autoNotes}
              onChange={(e) => updateField("autoNotes", e.target.value)}
              placeholder="What did the robot do in auto?"
              className="resize-none mt-1.5"
              rows={2}
              data-testid="textarea-auto-notes"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crosshair className="h-4 w-4" />
            Teleop
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <BigCounterInput
            value={currentForm.teleopBallsShot}
            onChange={(v) => updateField("teleopBallsShot", v)}
            label="Balls Shot in Teleop"
            testId="teleop-balls"
          />

          <ShootingHeatmap
            value={currentForm.teleopShootPosition}
            onChange={(v) => updateField("teleopShootPosition", v)}
          />

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <Label className="text-sm font-medium">Moves While Shooting?</Label>
            <Switch
              checked={currentForm.teleopMoveWhileShoot}
              onCheckedChange={(v) => updateField("teleopMoveWhileShoot", v)}
              data-testid="switch-move-while-shoot"
            />
          </div>

          <BigCounterInput
            value={currentForm.teleopFpsEstimate}
            onChange={(v) => updateField("teleopFpsEstimate", v)}
            label="Estimated FPS (Feet Per Second)"
            testId="fps-estimate"
          />

          <RatingSelector
            value={currentForm.teleopAccuracy}
            onChange={(v) => updateField("teleopAccuracy", v)}
            max={10}
            label="Accuracy Estimation"
            testId="accuracy"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUp className="h-4 w-4" />
            Endgame / Climb
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div>
            <Label className="text-sm font-medium">Climb Result</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {[
                { value: "success", label: "Climbed" },
                { value: "failed", label: "Failed" },
                { value: "none", label: "Didn't Try" },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={currentForm.climbSuccess === opt.value ? "default" : "outline"}
                  className="h-14 text-base"
                  onClick={() => updateField("climbSuccess", opt.value)}
                  data-testid={`button-climb-${opt.value}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {currentForm.climbSuccess !== "none" && (
            <div>
              <Label className="text-sm font-medium">Climb Position</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {[
                  { value: "left", label: "Left" },
                  { value: "middle", label: "Middle" },
                  { value: "right", label: "Right" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={currentForm.climbPosition === opt.value ? "default" : "outline"}
                    className="h-14 text-base"
                    onClick={() => updateField("climbPosition", opt.value)}
                    data-testid={`button-climb-pos-${opt.value}`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Defense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <RatingSelector
            value={currentForm.defenseRating}
            onChange={(v) => updateField("defenseRating", v)}
            max={10}
            label="Defense Rating"
            testId="defense"
          />

          <div>
            <Label className="text-sm font-medium">Defense Notes</Label>
            <Textarea
              value={currentForm.defenseNotes}
              onChange={(e) => updateField("defenseNotes", e.target.value)}
              placeholder="How did they play defense?"
              className="resize-none mt-1.5"
              rows={2}
              data-testid="textarea-defense-notes"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Driver Skill & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div>
            <Label className="text-sm font-medium">Driver Skill Notes</Label>
            <Textarea
              value={currentForm.driverSkillNotes}
              onChange={(e) => updateField("driverSkillNotes", e.target.value)}
              placeholder="Driver awareness, gear shifts, movement patterns..."
              className="resize-none mt-1.5"
              rows={3}
              data-testid="textarea-driver-notes"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">General Notes</Label>
            <Textarea
              value={currentForm.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Any other observations..."
              className="resize-none mt-1.5"
              rows={2}
              data-testid="textarea-notes"
            />
          </div>
        </CardContent>
      </Card>

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
        Submit {selectedTeams.filter((t) => t > 0).length > 1
          ? `${selectedTeams.filter((t) => t > 0).length} Entries`
          : "Entry"}
      </Button>
    </div>
  );
}
