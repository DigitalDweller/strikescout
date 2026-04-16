import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Event, EventTeam, Team, PitScoutingEntry } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Calendar, Camera, Check, ChevronDown, Images, Loader2, Search, Trash2, Wrench, Bot } from "lucide-react";

// Flat field surface (avoid “box-within-box” borders)
const FIELD_SHELL = "rounded-2xl bg-white/5 p-3 sm:p-4";

type Drivetrain = "swerve" | "tank" | "mecanum" | "other";

type PitEntryResponse =
  | (PitScoutingEntry & {
      scouter: { id: number; username: string; displayName: string; role: string; demoEventId: number | null } | null;
    })
  | null;

async function compressImageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please use an image file (JPG, PNG, or WEBP).");
  }
  const bmp = await createImageBitmap(file);
  try {
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height, 1));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image.");
    ctx.drawImage(bmp, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    bmp.close();
  }
}

/** Searchable team picker — roster only (same pattern as match scout form). */
function PitTeamCombobox({
  eventTeams,
  selectedTeamId,
  onSelectTeam,
  testId,
}: {
  eventTeams?: (EventTeam & { team: Team })[];
  selectedTeamId: number;
  onSelectTeam: (teamId: number) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | undefined>(undefined);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const sortedTeams = useMemo(() => {
    const list = eventTeams ?? [];
    return [...list].sort((a, b) => a.team.teamNumber - b.team.teamNumber);
  }, [eventTeams]);

  const selectedTeam = sortedTeams.find((et) => et.teamId === selectedTeamId);

  const filtered = sortedTeams.filter((et) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return et.team.teamNumber.toString().includes(q) || et.team.teamName.toLowerCase().includes(q);
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
            "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl bg-black/25 px-4 py-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-md transition-all duration-200",
            open
              ? "ring-2 ring-blue-500/55 ring-offset-2 ring-offset-zinc-950"
              : "hover:shadow-[inset_0_0_0_1px_rgba(59,130,246,0.45)]",
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-testid={testId}
        >
          <span
            className="min-w-0 flex-1 truncate text-base text-zinc-100 sm:text-lg"
            data-testid={`${testId}-label`}
          >
            {selectedTeam
              ? `${selectedTeam.team.teamNumber} — ${selectedTeam.team.teamName}`
              : "Select a team…"}
          </span>
          <Search className="h-5 w-5 shrink-0 text-blue-400" />
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
        className="z-[100] flex max-h-[min(60vh,280px)] flex-col overflow-hidden border-white/10 bg-zinc-900/95 p-0 shadow-lg backdrop-blur-xl"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-zinc-900/95 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={filterInputRef}
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Filter by number or name…"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid={`${testId}-filter`}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-zinc-500">No teams on this event</div>
          ) : (
            filtered.map((et) => (
              <div
                key={et.teamId}
                role="option"
                aria-selected={et.teamId === selectedTeamId}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-3 text-base",
                  et.teamId === selectedTeamId ? "bg-blue-600/20" : "hover:bg-white/5",
                )}
                onClick={() => {
                  onSelectTeam(et.teamId);
                  setSearch("");
                  setOpen(false);
                }}
                data-testid={`${testId}-option-${et.team.teamNumber}`}
              >
                {et.teamId === selectedTeamId && <Check className="h-4 w-4 shrink-0 text-blue-400" />}
                <span className={et.teamId === selectedTeamId ? "" : "ml-6"}>
                  <span className="font-bold text-blue-300 tabular-nums">{et.team.teamNumber}</span>
                  <span className="ml-1.5 text-zinc-200">{et.team.teamName}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Mobile-first: `capture="environment"` opens the camera on iOS Safari and Android Chrome.
 * Gallery uses a plain file input (no capture) for picking an existing photo.
 */
function PitPhotoCapture({
  onPick,
  compact,
  testId,
  showHint,
}: {
  onPick: (file: File) => void | Promise<void>;
  compact?: boolean;
  testId?: string;
  /** Longer helper under buttons (hero only). */
  showHint?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void onPick(f);
  };

  return (
    <div className={cn("w-full", compact ? "space-y-2" : "space-y-2.5")}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleFiles}
        data-testid={testId ? `${testId}-camera-input` : undefined}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleFiles}
        data-testid={testId ? `${testId}-gallery-input` : undefined}
      />
      <div
        className={cn(
          "flex flex-wrap items-center gap-2.5 rounded-xl border border-white/10 bg-black/25 p-2.5 sm:gap-3 sm:p-3",
          compact && "p-2 sm:p-2.5",
        )}
      >
        <Button
          type="button"
          className={cn(
            "touch-manipulation gap-2 rounded-xl border-0 bg-blue-600 px-4 font-semibold text-white shadow-md hover:bg-blue-500",
            compact ? "min-h-10 flex-1 text-xs sm:flex-none sm:min-h-11 sm:px-3 sm:text-sm" : "min-h-12 flex-1 text-sm sm:flex-none sm:px-5 sm:text-base",
          )}
          onClick={() => cameraRef.current?.click()}
          data-testid={testId ? `${testId}-take-photo` : "pit-take-photo"}
        >
          <Camera className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "touch-manipulation gap-2 rounded-xl border-white/20 bg-zinc-900/60 px-3 font-medium text-zinc-100 hover:bg-zinc-800/80",
            compact ? "min-h-10 flex-1 text-xs sm:flex-none sm:min-h-11 sm:px-3 sm:text-sm" : "min-h-12 text-sm sm:px-4 sm:text-base",
          )}
          onClick={() => galleryRef.current?.click()}
          data-testid={testId ? `${testId}-gallery` : "pit-gallery"}
        >
          <Images className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Gallery
        </Button>
      </div>
    </div>
  );
}

function YesNoPick({
  value,
  onChange,
  label,
  testId,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  label: string;
  testId: string;
}) {
  return (
    <div className={FIELD_SHELL}>
      <Label className="text-sm font-medium text-zinc-100">{label}</Label>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-testid={`${testId}-yes`}
          onClick={() => onChange(true)}
          className={cn(
            "flex-1 rounded-xl py-3 text-sm font-semibold transition-colors shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
            value === true
              ? "bg-blue-600/25 text-blue-100 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.5)]"
              : "bg-black/20 text-zinc-400 hover:bg-white/5",
          )}
        >
          Yes
        </button>
        <button
          type="button"
          data-testid={`${testId}-no`}
          onClick={() => onChange(false)}
          className={cn(
            "flex-1 rounded-xl py-3 text-sm font-semibold transition-colors shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
            value === false
              ? "bg-blue-600/25 text-blue-100 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.5)]"
              : "bg-black/20 text-zinc-400 hover:bg-white/5",
          )}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default function PitScoutForm() {
  const { toast } = useToast();
  const { id: eventIdParam } = useParams<{ id: string }>();
  const eventId = parseInt(eventIdParam || "0", 10);
  const preselectedTeamId = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const raw = new URLSearchParams(window.location.search).get("teamId");
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, []);

  const { data: pitAccessMe } = useQuery<{ allowed: boolean }>({
    queryKey: ["/api/events", eventId, "pit-access", "me"],
    enabled: !!eventId,
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/pit-access/me`, { credentials: "include" });
      if (!res.ok) return { allowed: false };
      return res.json();
    },
  });

  const [selectedTeamId, setSelectedTeamId] = useState(0);
  const [drivetrainType, setDrivetrainType] = useState<Drivetrain | null>(null);

  // Mechanical
  const [hasAuto, setHasAuto] = useState<boolean | null>(null);
  const [fitsUnderTrench, setFitsUnderTrench] = useState<boolean | null>(null);
  const [hopperCapacity, setHopperCapacity] = useState(0);
  const [hopperOver100, setHopperOver100] = useState(false);
  const [pitClimbNotes, setPitClimbNotes] = useState("");
  const [robotWeightLbs, setRobotWeightLbs] = useState<string>("");
  const [revMotorControllerCount, setRevMotorControllerCount] = useState<string>("");

  // Programming
  const [usesPathplanner, setUsesPathplanner] = useState<boolean | null>(null);
  const [hasMidfieldFuelAuto, setHasMidfieldFuelAuto] = useState<boolean | null>(null);
  const [newAutonTimeMinutes, setNewAutonTimeMinutes] = useState<string>("");

  // (Legacy/extra note field kept if present in DB)
  const [autoDescription, setAutoDescription] = useState("");

  const [heroDataUrl, setHeroDataUrl] = useState<string | null>(null);
  const [extraUrls, setExtraUrls] = useState<(string | null)[]>([null, null, null, null]);

  const { data: activeEvent, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: eventTeams } = useQuery<(EventTeam & { team: Team })[]>({
    queryKey: ["/api/events", eventId, "teams"],
    enabled: !!eventId,
  });

  useEffect(() => {
    if (!preselectedTeamId || !eventTeams?.length) return;
    if (selectedTeamId > 0) return;
    const existsOnRoster = eventTeams.some((et) => et.teamId === preselectedTeamId);
    if (existsOnRoster) {
      setSelectedTeamId(preselectedTeamId);
    }
  }, [eventTeams, preselectedTeamId, selectedTeamId]);

  const resolvedEventTeam = useMemo(() => {
    if (!selectedTeamId || !eventTeams?.length) return null;
    return eventTeams.find((et) => et.teamId === selectedTeamId) ?? null;
  }, [eventTeams, selectedTeamId]);

  const resolvedTeamId = resolvedEventTeam?.teamId ?? 0;

  const { data: existingPit, isFetching: pitLoading } = useQuery<PitEntryResponse>({
    queryKey: ["/api/events", eventId, "teams", resolvedTeamId, "pit-entry"],
    enabled: !!eventId && resolvedTeamId > 0,
  });

  useEffect(() => {
    setAutoDescription("");
    setPitClimbNotes("");
    setDrivetrainType(null);
    setHasAuto(null);
    setFitsUnderTrench(null);
    setHopperCapacity(0);
    setHopperOver100(false);
    setRobotWeightLbs("");
    setRevMotorControllerCount("");
    setUsesPathplanner(null);
    setHasMidfieldFuelAuto(null);
    setNewAutonTimeMinutes("");
    setHeroDataUrl(null);
    setExtraUrls([null, null, null, null]);
  }, [resolvedEventTeam?.teamId]);

  useEffect(() => {
    if (hasAuto !== false) return;
    // "No auto" should void all follow-up auto/programming questions.
    setAutoDescription("");
    setUsesPathplanner(false);
    setHasMidfieldFuelAuto(false);
    setNewAutonTimeMinutes("");
  }, [hasAuto]);

  useEffect(() => {
    if (!resolvedEventTeam) return;
    if (existingPit === undefined) return;
    if (!existingPit) return;
    setDrivetrainType((existingPit.drivetrainType as Drivetrain) ?? null);
    setHasAuto(existingPit.hasAuto);
    setFitsUnderTrench(existingPit.fitsUnderTrench);
    setAutoDescription(existingPit.autoDescription ?? "");
    setPitClimbNotes(existingPit.pitClimbNotes ?? "");
    setHopperCapacity(existingPit.hopperCapacity);
    setHopperOver100(existingPit.hopperCapacityOver100);
    setRobotWeightLbs(
      typeof (existingPit as any).robotWeightLbs === "number" ? String((existingPit as any).robotWeightLbs) : "",
    );
    setRevMotorControllerCount(
      typeof (existingPit as any).revMotorControllerCount === "number"
        ? String((existingPit as any).revMotorControllerCount)
        : "",
    );
    setUsesPathplanner(typeof (existingPit as any).usesPathplanner === "boolean" ? (existingPit as any).usesPathplanner : null);
    setHasMidfieldFuelAuto(
      typeof (existingPit as any).hasMidfieldFuelAuto === "boolean" ? (existingPit as any).hasMidfieldFuelAuto : null,
    );
    setNewAutonTimeMinutes(
      typeof (existingPit as any).newAutonTimeMinutes === "number" ? String((existingPit as any).newAutonTimeMinutes) : "",
    );
    setHeroDataUrl(existingPit.robotHeroImage ?? null);
    setExtraUrls([
      existingPit.robotExtraImage1 ?? null,
      existingPit.robotExtraImage2 ?? null,
      existingPit.robotExtraImage3 ?? null,
      existingPit.robotExtraImage4 ?? null,
    ]);
  }, [resolvedEventTeam?.teamId, existingPit]);

  const submitMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/pit-entries", body, { eventId });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "pit-entries"] });
      const tid = typeof variables.teamId === "number" ? variables.teamId : 0;
      if (tid > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "teams", tid, "pit-entry"] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not save pit sheet", description: error.message, variant: "destructive" });
    },
  });

  const handleHeroFile = async (file: File | null) => {
    if (!file) return;
    try {
      const url = await compressImageFileToDataUrl(file);
      setHeroDataUrl(url);
    } catch (e) {
      toast({
        title: "Image error",
        description: e instanceof Error ? e.message : "Could not read file",
        variant: "destructive",
      });
    }
  };

  const handleExtraFile = async (index: number, file: File | null) => {
    if (!file) return;
    try {
      const url = await compressImageFileToDataUrl(file);
      setExtraUrls((prev) => {
        const next = [...prev];
        next[index] = url;
        return next;
      });
    } catch (e) {
      toast({
        title: "Image error",
        description: e instanceof Error ? e.message : "Could not read file",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!eventId || !resolvedEventTeam) {
      toast({ title: "Select a team from the list", variant: "destructive" });
      return;
    }
    if (!drivetrainType) {
      toast({ title: "Select a drivetrain type", variant: "destructive" });
      return;
    }
    if (fitsUnderTrench === null) {
      toast({ title: "Answer: Can you go under the trench?", variant: "destructive" });
      return;
    }
    if (hasAuto === null) {
      toast({ title: "Answer: Do you have auto?", variant: "destructive" });
      return;
    }
    const parsedWeight =
      robotWeightLbs.trim() === "" ? NaN : parseInt(robotWeightLbs.trim(), 10);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast({ title: "Enter robot weight (lbs)", variant: "destructive" });
      return;
    }
    const parsedRevControllers =
      revMotorControllerCount.trim() === "" ? NaN : parseInt(revMotorControllerCount.trim(), 10);
    if (!Number.isFinite(parsedRevControllers) || parsedRevControllers < 0) {
      toast({ title: "Enter number of REV motor controllers", variant: "destructive" });
      return;
    }
    let parsedAutonMins: number | null = null;
    if (hasAuto === true) {
      if (usesPathplanner === null) {
        toast({ title: "Answer: Do you use pathplanner for auto?", variant: "destructive" });
        return;
      }
      if (hasMidfieldFuelAuto === null) {
        toast({ title: "Answer: Do you have an auto that collects fuel from midfield?", variant: "destructive" });
        return;
      }
      parsedAutonMins =
        newAutonTimeMinutes.trim() === "" ? NaN : parseInt(newAutonTimeMinutes.trim(), 10);
      if (!Number.isFinite(parsedAutonMins) || parsedAutonMins < 0) {
        toast({ title: "Enter auton build time (minutes)", variant: "destructive" });
        return;
      }
    }
    if (!hopperOver100 && (hopperCapacity < 0 || hopperCapacity > 100)) {
      toast({ title: "Hopper capacity must be 0–100 unless 100+ is checked", variant: "destructive" });
      return;
    }

    try {
      await submitMutation.mutateAsync({
        eventId,
        teamId: resolvedEventTeam.teamId,
        robotHeroImage: heroDataUrl,
        robotExtraImage1: extraUrls[0],
        robotExtraImage2: extraUrls[1],
        robotExtraImage3: extraUrls[2],
        robotExtraImage4: extraUrls[3],
        drivetrainType,
        hasAuto,
        fitsUnderTrench,
        autoDescription: hasAuto ? autoDescription.trim() || null : null,
        pitClimbNotes: pitClimbNotes.trim() || null,
        hopperCapacity,
        hopperCapacityOver100: hopperOver100,
        robotWeightLbs: parsedWeight,
        revMotorControllerCount: parsedRevControllers,
        usesPathplanner: hasAuto ? usesPathplanner : false,
        hasMidfieldFuelAuto: hasAuto ? hasMidfieldFuelAuto : false,
        newAutonTimeMinutes: hasAuto ? parsedAutonMins : null,
      });
      toast({ title: "Pit scouting saved", description: `Team ${resolvedEventTeam.team.teamNumber}` });
      setSelectedTeamId(0);
    } catch {
      /* mutation toast */
    }
  };

  if (eventLoading) {
    return (
      <div className="p-4 sm:p-6 mx-auto max-w-2xl">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className="p-4 sm:p-6 mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Pit scouting</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No active event</p>
            <p className="text-sm text-muted-foreground mt-1">Open an event from the dashboard first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pitAccessMe && !pitAccessMe.allowed) {
    return (
      <div className="min-h-full bg-zinc-950 p-4 sm:p-6 text-zinc-100" data-testid="pit-scout-root">
        <div className="mx-auto max-w-2xl sm:max-w-3xl">
          <h1 className="text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">Pit scouting</h1>
          <p className="mt-2 text-sm text-zinc-400">You don&apos;t have access to Pit scouting for this event.</p>
          <Card className="mt-6 border-white/10 bg-zinc-900/40">
            <CardContent className="p-6">
              <p className="text-sm text-zinc-300">
                Ask an admin to enable Pit scouting access in <span className="font-semibold text-zinc-100">Settings → Pit Scouting</span>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-950 pb-28 text-zinc-100" data-testid="pit-scout-root">
      <header className="relative z-40 border-b border-white/10 bg-zinc-950/60 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 pb-5 pt-4 sm:max-w-3xl sm:px-5 sm:pb-6 sm:pt-5">
          <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{activeEvent.name}</p>
          <h1 className="mt-2 text-center text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">Pit scouting</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5 sm:max-w-3xl sm:px-5 sm:py-6">
        <div className="ss-glass border-white/10 bg-zinc-900/35 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Pit sheet</p>
            </div>
            {pitLoading && resolvedEventTeam ? (
              <span className="mt-0.5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </span>
            ) : null}
          </div>

          <div className="mt-6 space-y-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-400" aria-hidden />
                <h2 className="text-base font-semibold text-zinc-100">Basics</h2>
              </div>

              <div className="space-y-4">
                <div className={cn("space-y-3", FIELD_SHELL)}>
                  <div>
                    <Label className="text-sm font-medium text-zinc-100">Team number</Label>
                  </div>

                  <PitTeamCombobox
                    eventTeams={eventTeams}
                    selectedTeamId={selectedTeamId}
                    onSelectTeam={setSelectedTeamId}
                    testId="pit-select-team"
                  />
                </div>

                <div className={FIELD_SHELL}>
                  <Label className="text-sm font-medium text-zinc-100">Drive type</Label>
                  <RadioGroup
                    value={drivetrainType ?? ""}
                    onValueChange={(v) => setDrivetrainType(v as Drivetrain)}
                    className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
                    data-testid="radio-pit-drivetrain"
                  >
                    {(["swerve", "tank", "mecanum", "other"] as const).map((d) => (
                      <label
                        key={d}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
                          drivetrainType === d
                            ? "bg-blue-600/20 text-blue-100 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.5)]"
                            : "bg-black/20 text-zinc-300 hover:bg-white/5",
                        )}
                      >
                        <RadioGroupItem value={d} id={`dt-${d}`} />
                        <span className="capitalize">{d === "mecanum" ? "Mecanum" : d}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </section>

            <div className="h-px w-full bg-white/10" />

            {resolvedEventTeam && drivetrainType ? (
              <>
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-400" aria-hidden />
                    <h2 className="text-base font-semibold text-zinc-100">Mechanical</h2>
                  </div>

                  <div className="space-y-4">
                    <YesNoPick
                      value={fitsUnderTrench}
                      onChange={setFitsUnderTrench}
                      label="Can you go under the trench?"
                      testId="pit-trench"
                    />

                    <div className={FIELD_SHELL}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Label className="text-sm font-medium text-zinc-100">How much fuel can your robot hold?</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="hopper-100"
                            checked={hopperOver100}
                            onCheckedChange={(c) => setHopperOver100(c === true)}
                            data-testid="checkbox-pit-hopper-100"
                          />
                          <label htmlFor="hopper-100" className="text-sm text-zinc-300">
                            100+
                          </label>
                        </div>
                      </div>
                      {!hopperOver100 ? (
                        <div className="mt-4 space-y-2">
                          <Slider
                            value={[hopperCapacity]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(v) => setHopperCapacity(v[0] ?? 0)}
                            className="py-1"
                            data-testid="slider-pit-hopper"
                          />
                          <p className="text-center text-sm tabular-nums text-zinc-400">{hopperCapacity}</p>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-zinc-400">
                          Recorded as <span className="font-semibold text-zinc-200">100+</span>.
                        </p>
                      )}
                    </div>

                    <div className={FIELD_SHELL}>
                      <Label htmlFor="pit-climb" className="text-sm font-medium text-zinc-100">
                        Can you climb and to what level?
                      </Label>
                      <Textarea
                        id="pit-climb"
                        value={pitClimbNotes}
                        onChange={(e) => setPitClimbNotes(e.target.value)}
                        placeholder="Level + any notes (short)"
                        rows={4}
                        className="mt-2 border-0 bg-black/20 text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-white/10"
                      />
                    </div>

                    <div className={FIELD_SHELL}>
                      <Label htmlFor="pit-weight" className="text-sm font-medium text-zinc-100">
                        How heavy is your robot? (lbs)
                      </Label>
                      <Input
                        id="pit-weight"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={robotWeightLbs}
                        onChange={(e) => setRobotWeightLbs(e.target.value)}
                        placeholder="e.g. 120"
                        className="mt-2 border-0 bg-black/20 text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-white/10"
                        data-testid="input-pit-weight"
                      />
                    </div>

                    <div className={FIELD_SHELL}>
                      <Label htmlFor="pit-rev-motor-controllers" className="text-sm font-medium text-zinc-100">
                        How many REV motor controller do you use?
                      </Label>
                      <Input
                        id="pit-rev-motor-controllers"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={revMotorControllerCount}
                        onChange={(e) => setRevMotorControllerCount(e.target.value)}
                        placeholder="e.g. 8"
                        className="mt-2 border-0 bg-black/20 text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-white/10"
                        data-testid="input-pit-rev-motor-controllers"
                      />
                    </div>
                  </div>
                </section>

                <div className="h-px w-full bg-white/10" />

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-400" aria-hidden />
                    <h2 className="text-base font-semibold text-zinc-100">Programming</h2>
                  </div>

                  <div className="space-y-4">
                    <YesNoPick value={hasAuto} onChange={setHasAuto} label="Has auto?" testId="pit-auto" />

                    {hasAuto === true ? (
                      <>
                    <YesNoPick
                      value={usesPathplanner}
                      onChange={setUsesPathplanner}
                      label="Do you use pathplanner for auto?"
                      testId="pit-pathplanner"
                    />

                    <YesNoPick
                      value={hasMidfieldFuelAuto}
                      onChange={setHasMidfieldFuelAuto}
                      label="Do you have an auto that goes and collects fuel from the middle of the field?"
                      testId="pit-midfield-fuel-auto"
                    />

                    <div className={FIELD_SHELL}>
                      <Label htmlFor="pit-new-auton-time" className="text-sm font-medium text-zinc-100">
                        How long does making a new auton using take? (minutes)
                      </Label>
                      <Input
                        id="pit-new-auton-time"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={newAutonTimeMinutes}
                        onChange={(e) => setNewAutonTimeMinutes(e.target.value)}
                        placeholder="e.g. 10"
                        className="mt-2 border-0 bg-black/20 text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-white/10"
                        data-testid="input-pit-new-auton-time"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className={FIELD_SHELL}>
                        <Label htmlFor="pit-auto-desc" className="text-sm font-medium text-zinc-100">
                          Auto routine (optional)
                        </Label>
                        <Textarea
                          id="pit-auto-desc"
                          value={autoDescription}
                          onChange={(e) => setAutoDescription(e.target.value)}
                          placeholder="Start + tasks (short)"
                          rows={4}
                          className="mt-2 border-0 bg-black/20 text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-white/10"
                        />
                      </div>
                    </div>
                      </>
                    ) : hasAuto === false ? (
                      <div className={FIELD_SHELL}>
                        <Label className="text-sm font-medium text-zinc-100">Auto questions</Label>
                        <p className="mt-2 text-sm text-zinc-400">
                          Skipped because this robot does not have auto.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>

                <div className="h-px w-full bg-white/10" />
              </>
            ) : (
              <Card className="border-white/10 bg-zinc-900/30">
                <CardContent className="p-5 text-sm text-zinc-300">
                  Fill in <span className="font-semibold text-zinc-100">Team number</span> and{" "}
                  <span className="font-semibold text-zinc-100">Drive type</span> to start the questions.
                </CardContent>
              </Card>
            )}

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-400" aria-hidden />
                <h2 className="text-base font-semibold text-zinc-100">Photos</h2>
                <span className="text-xs text-zinc-500">(optional)</span>
              </div>

              <div className={FIELD_SHELL}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium text-zinc-100">Hero photo</Label>
                  </div>
                  {heroDataUrl ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-zinc-400">
                      <Images className="h-3.5 w-3.5" />
                      Added
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <PitPhotoCapture showHint testId="pit-hero" onPick={(file) => void handleHeroFile(file)} />
                  </div>
                  {heroDataUrl && (
                    <div className="relative shrink-0">
                      <img
                        src={heroDataUrl}
                        alt="Hero preview"
                        className="h-28 w-40 rounded-lg border border-white/10 object-cover"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute -right-2 -top-2 h-8 w-8 rounded-full"
                        onClick={() => setHeroDataUrl(null)}
                        aria-label="Remove hero image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <details className="group rounded-2xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 hover:bg-white/5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100">Extra photos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-zinc-400">
                      {(extraUrls.filter(Boolean).length || 0)}/4
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" aria-hidden />
                  </div>
                </summary>
                <div className="px-4 pb-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="rounded-xl bg-black/20 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                        <p className="mb-2 text-xs font-medium text-zinc-400">Photo {i + 1}</p>
                        <PitPhotoCapture compact testId={`pit-extra-${i}`} onPick={(file) => void handleExtraFile(i, file)} />
                        {extraUrls[i] && (
                          <div className="relative mt-2 inline-block">
                            <img
                              src={extraUrls[i]!}
                              alt={`Extra ${i + 1}`}
                              className="h-24 w-full max-w-[200px] rounded-md object-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="absolute -right-2 -top-2 h-7 w-7 rounded-full"
                              onClick={() =>
                                setExtraUrls((prev) => {
                                  const next = [...prev];
                                  next[i] = null;
                                  return next;
                                })
                              }
                              aria-label={`Remove photo ${i + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </section>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl sm:sticky sm:rounded-t-2xl sm:border sm:border-white/10 sm:shadow-xl sm:shadow-black/40 md:mx-auto md:mb-4 md:max-w-3xl md:rounded-2xl">
        <Button
          type="button"
          size="lg"
          className="h-14 w-full touch-manipulation rounded-xl bg-blue-600 text-base font-bold text-white shadow-lg shadow-black/25 transition-all duration-200 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-60"
          disabled={submitMutation.isPending || !resolvedEventTeam || pitLoading}
          onClick={() => void handleSubmit()}
          data-testid="button-submit-pit"
        >
          {submitMutation.isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : null}
          Submit pit sheet
        </Button>
      </div>
    </div>
  );
}
