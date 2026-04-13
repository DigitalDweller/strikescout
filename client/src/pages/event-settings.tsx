import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  CalendarDays,
  ChevronDown,
  Users,
  Image,
  BarChart3,
  Trophy,
  Video,
  Clock,
  Timer,
  ListOrdered,
  CircleHelp,
  Gauge,
  RotateCcw,
  Swords,
  TestTube2,
  Settings2,
} from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import { useHelp } from "@/contexts/help-context";
import {
  DEFAULT_SZR_WEIGHTS_PERCENT,
  normalizeWeightsToPercent,
  parseSzrWeights,
  type SzrWeights,
  DEFAULT_PREDICTOR_WEIGHTS,
  parsePredictorWeights,
  type PredictorWeights,
} from "@/lib/team-colors";
import type { Event } from "@shared/schema";
import { cn } from "@/lib/utils";

const SZR_KEYS = ["auto", "throughput", "accuracy", "defense", "driverSkill", "climb"] as const;

const SZR_LABELS: Record<(typeof SZR_KEYS)[number], string> = {
  auto: "Auto",
  throughput: "Throughput",
  accuracy: "Accuracy",
  defense: "Defense",
  driverSkill: "Driver",
  climb: "Climb",
};

/** Bar + legend + slider fill colors (aligned). */
const SZR_SEGMENT_CLASS: Record<(typeof SZR_KEYS)[number], string> = {
  auto: "bg-blue-500",
  throughput: "bg-sky-400",
  accuracy: "bg-violet-400",
  defense: "bg-purple-600",
  driverSkill: "bg-cyan-500",
  climb: "bg-emerald-500",
};

const SZR_SLIDER_RANGE: Record<(typeof SZR_KEYS)[number], string> = {
  auto: "bg-blue-500 shadow-sm shadow-black/25",
  throughput: "bg-sky-400 shadow-sm shadow-black/25",
  accuracy: "bg-violet-400 shadow-sm shadow-black/25",
  defense: "bg-purple-600 shadow-sm shadow-black/25",
  driverSkill: "bg-cyan-500 shadow-sm shadow-black/25",
  climb: "bg-emerald-500 shadow-sm shadow-black/25",
};

const SZR_SLIDER_THUMB: Record<(typeof SZR_KEYS)[number], string> = {
  auto: "border-blue-500 shadow-sm shadow-black/30 focus-visible:ring-blue-500/50",
  throughput: "border-sky-400 shadow-sm shadow-black/30 focus-visible:ring-sky-400/50",
  accuracy: "border-violet-400 shadow-sm shadow-black/30 focus-visible:ring-violet-400/50",
  defense: "border-purple-600 shadow-sm shadow-black/30 focus-visible:ring-purple-500/50",
  driverSkill: "border-cyan-500 shadow-sm shadow-black/30 focus-visible:ring-cyan-500/50",
  climb: "border-emerald-500 shadow-sm shadow-black/30 focus-visible:ring-emerald-500/50",
};

const SLIDER_TRACK = "h-2.5 bg-zinc-800 shadow-inner shadow-black/20";
const SLIDER_RANGE =
  "bg-gradient-to-r from-blue-600 to-blue-400 shadow-sm shadow-black/25";

const SETTINGS_TABS = [
  { id: "general" as const, label: "General", icon: Settings2, description: "Help & tips" },
  { id: "szr" as const, label: "SZR Weights", icon: Gauge, description: "Strike zone rating" },
  { id: "predictor" as const, label: "Match Predictor", icon: Swords, description: "Blend & composite" },
  { id: "event" as const, label: "Event Details", icon: CalendarDays, description: "Info & TBA" },
];

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

function AutoSyncTimer({ expiresAt }: { expiresAt: number | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const remaining = Math.max(0, expiresAt - now);
  if (remaining === 0)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-sm text-orange-400">
        <Timer className="h-4 w-4 shrink-0" />
        <span className="font-medium">Auto-sync expired — turn it back on to continue</span>
      </div>
    );

  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
      <Clock className="h-4 w-4 shrink-0 text-blue-400" />
      <span>
        <span className="font-semibold text-zinc-100">{timeStr}</span> left in this session
      </span>
    </div>
  );
}

function SzrStackedBar({ weights }: { weights: SzrWeights }) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/10">
        {SZR_KEYS.map((key) => (
          <div
            key={key}
            className={cn("h-full min-w-0 transition-[width] duration-300 ease-out", SZR_SEGMENT_CLASS[key])}
            style={{ width: `${weights[key]}%` }}
            title={`${SZR_LABELS[key]}: ${Math.round(weights[key])}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-500">
        {SZR_KEYS.map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", SZR_SEGMENT_CLASS[key])} />
            <span className="text-zinc-400">{SZR_LABELS[key]}</span>
            <span className="tabular-nums text-zinc-300">{Math.round(weights[key])}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SettingsShell({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[min(70vh,720px)] flex-col rounded-2xl border border-white/10 bg-zinc-900/50 shadow-2xl shadow-black/40 backdrop-blur-xl",
        className,
      )}
    >
      <div className="border-b border-white/10 px-6 py-5">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-6 py-6">{children}</div>
      {footer ? <div className="mt-auto border-t border-white/10 px-6 py-4">{footer}</div> : null}
    </div>
  );
}

const SYNC_ACTIONS = [
  {
    key: "schedule",
    label: "Schedule",
    description: "Match list, times, alliances",
    icon: ListOrdered,
    endpoint: "sync-schedule",
    invalidate: "schedule",
    formatResult: (d: { synced: number; total: number }) => `${d.synced} matches loaded`,
  },
  {
    key: "teams",
    label: "Teams",
    description: "Team list at this event",
    icon: Users,
    endpoint: "sync-teams",
    invalidate: "teams",
    formatResult: (d: { added: number; total: number }) => `${d.added} teams added (${d.total} total)`,
  },
  {
    key: "results",
    label: "Results",
    description: "Scores and winners",
    icon: Trophy,
    endpoint: "sync-results",
    invalidate: "schedule",
    formatResult: (d: { synced: number; total: number }) => `${d.synced} match results synced`,
  },
  {
    key: "videos",
    label: "Videos",
    description: "Match video links",
    icon: Video,
    endpoint: "sync-videos",
    invalidate: "schedule",
    formatResult: (d: { synced: number; total: number }) => `${d.synced} videos linked`,
  },
  {
    key: "avatars",
    label: "Avatars",
    description: "Team photos",
    icon: Image,
    endpoint: "sync-avatars",
    invalidate: "teams",
    formatResult: (d: { synced: number; total: number }) => `${d.synced} avatars synced`,
  },
  {
    key: "oprs",
    label: "OPR & rankings",
    description: "Stats and seed order",
    icon: BarChart3,
    endpoint: "sync-oprs",
    invalidate: "teams",
    formatResult: (d: { oprsSynced: number; rankingsSynced: number }) =>
      `OPR for ${d.oprsSynced} teams, rankings for ${d.rankingsSynced}`,
  },
] as const;

const SETTINGS_HELP = {
  title: "Settings overview",
  body: (
    <>
      <p><strong>Event details</strong> — Your event name, location, and date. This is for display only.</p>
      <p><strong>SZR (Strike Zone Rating)</strong> — A team strength score (0–100) from your scouting data. Adjust weights to emphasize auto, throughput, accuracy, defense, or climb.</p>
      <p><strong>Match predictor</strong> — Control how win probability blends OPR (TBA stats) vs SZR (scouting), and how composite stats (auto, throughput, etc.) contribute when OPR is missing.</p>
      <p><strong>The Blue Alliance (TBA)</strong> — TBA provides official match schedules and team lists. Enter your event key (e.g. <code>2026txhou</code>) from thebluealliance.com, then sync to load teams and matches.</p>
      <p><strong>Sync options</strong> — Click each button to pull data from TBA: Schedule (matches), Teams (team list), Results (scores), Videos (match video links), Avatars (team photos), OPR & rankings (stats). Start with Schedule and Teams.</p>
      <p><strong>Auto-sync</strong> — Keeps results and schedule updated during the event. Requires a TBA API key.</p>
    </>
  ),
};

const inputDark =
  "border-zinc-700/80 bg-zinc-900/90 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-blue-500/40 focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0 dark:border-zinc-700/80";

export default function EventSettings() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();
  const help = useHelp();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const { data: syncStatusData } = useQuery<{
    tbaConfigured?: boolean;
    expiresAt: number | null;
    autoSync: boolean;
    manualSyncsRemaining?: number;
    manualSyncResetsAt?: number | null;
  }>({
    queryKey: ["/api/events", eventId, "tba", "sync-status"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/tba/sync-status`);
      if (!res.ok) return { expiresAt: null, autoSync: false };
      return res.json();
    },
    refetchInterval: 10000,
  });

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [tbaEventKey, setTbaEventKey] = useState("");
  const [tbaAutoSync, setTbaAutoSync] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [validatedName, setValidatedName] = useState("");
  const [validationError, setValidationError] = useState("");
  const [syncingKeys, setSyncingKeys] = useState<Set<string>>(new Set());
  const [szrWeights, setSzrWeights] = useState<SzrWeights>(DEFAULT_SZR_WEIGHTS_PERCENT);
  const [predictorWeights, setPredictorWeights] = useState<PredictorWeights>(DEFAULT_PREDICTOR_WEIGHTS);
  const [testingOverrideEventEnded, setTestingOverrideEventEnded] = useState(false);
  const [testingOverrideMatchNumber, setTestingOverrideMatchNumber] = useState<string>("");
  const [allianceSimFourPartnerSlots, setAllianceSimFourPartnerSlots] = useState(false);

  useEffect(() => {
    if (event) {
      setName(event.name);
      setLocation(event.location || "");
      setStartDate(event.startDate || "");
      setTbaEventKey(event.tbaEventKey || "");
      setTbaAutoSync(event.tbaAutoSync);
      setSzrWeights(normalizeWeightsToPercent(parseSzrWeights(event.szrWeights)));
      setPredictorWeights(parsePredictorWeights(event.predictorWeights));
      setTestingOverrideEventEnded(event.testingOverrideEventEnded ?? false);
      setTestingOverrideMatchNumber(event.testingOverrideMatchNumber != null ? String(event.testingOverrideMatchNumber) : "");
      setAllianceSimFourPartnerSlots(event.allianceSimFourPartnerSlots ?? false);
    }
  }, [event]);

  const saveEventMutation = useMutation({
    mutationFn: async (data: { name: string; location: string; startDate: string }) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}`, {
        name: data.name.trim(),
        location: data.location.trim() || null,
        startDate: data.startDate.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({ title: "Event details saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/tba/validate`, { eventKey: key });
      return res.json();
    },
    onSuccess: (data: { valid: boolean; name?: string; error?: string }) => {
      if (data.valid) {
        setValidationStatus("valid");
        setValidatedName(data.name || "");
        setValidationError("");
      } else {
        setValidationStatus("invalid");
        setValidatedName("");
        setValidationError(data.error || "Invalid key — check and try again");
      }
    },
    onError: (err: Error) => {
      setValidationStatus("invalid");
      setValidationError(err.message || "Invalid event key");
      toast({ title: "Validation failed", description: err.message, variant: "destructive" });
    },
  });

  const saveSzrMutation = useMutation({
    mutationFn: async (weights: SzrWeights) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/settings`, { szrWeights: weights });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({ title: "SZR weights saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save SZR weights", description: err.message, variant: "destructive" });
    },
  });

  const saveTestingOverridesMutation = useMutation({
    mutationFn: async (data: { testingOverrideEventEnded: boolean; testingOverrideMatchNumber: number | null }) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/settings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({ title: "Testing overrides saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save testing overrides", description: err.message, variant: "destructive" });
    },
  });

  const saveAllianceSimLayoutMutation = useMutation({
    mutationFn: async (slots: boolean) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/settings`, { allianceSimFourPartnerSlots: slots });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "alliance-sim"] });
      toast({ title: "Alliance sim layout saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save alliance sim layout", description: err.message, variant: "destructive" });
    },
  });

  const savePredictorMutation = useMutation({
    mutationFn: async (weights: PredictorWeights) => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/settings`, { predictorWeights: weights });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({ title: "Match predictor weights saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save match predictor weights", description: err.message, variant: "destructive" });
    },
  });

  const saveTbaMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        tbaEventKey: tbaEventKey.trim() || null,
        tbaAutoSync,
      };
      if (validationStatus === "valid") body.tbaEventKeyValidated = true;
      const res = await apiRequest("PATCH", `/api/events/${eventId}/settings`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "tba", "sync-status"] });
      toast({ title: "TBA settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const handleSync = async (action: (typeof SYNC_ACTIONS)[number]) => {
    setSyncingKeys((prev) => new Set(prev).add(action.key));
    try {
      const res = await apiRequest("POST", `/api/events/${eventId}/tba/${action.endpoint}`);
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, action.invalidate] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "tba", "sync-status"] });
      toast({ title: action.formatResult(data) });
    } catch (err: unknown) {
      toast({
        title: `${action.label} sync failed`,
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncingKeys((prev) => {
        const next = new Set(prev);
        next.delete(action.key);
        return next;
      });
    }
  };

  const handleValidate = () => {
    if (!tbaEventKey.trim()) return;
    setValidationStatus("validating");
    validateMutation.mutate(tbaEventKey.trim());
  };

  const isKeyValidated = !!(event?.tbaEventKeyValidated || validationStatus === "valid");
  const eventDetailsChanged =
    event &&
    (name !== event.name || (location || "") !== (event.location || "") || (startDate || "") !== (event.startDate || ""));
  const tbaChanged =
    event &&
    ((tbaEventKey || "") !== (event.tbaEventKey || "") ||
      tbaAutoSync !== event.tbaAutoSync ||
      (validationStatus === "valid" && !event.tbaEventKeyValidated));

  const szrWeightsChanged = (() => {
    const current = normalizeWeightsToPercent(parseSzrWeights(event?.szrWeights));
    return (
      szrWeights.auto !== current.auto ||
      szrWeights.throughput !== current.throughput ||
      szrWeights.accuracy !== current.accuracy ||
      szrWeights.defense !== current.defense ||
      szrWeights.driverSkill !== current.driverSkill ||
      szrWeights.climb !== current.climb
    );
  })();

  const predictorWeightsChanged = (() => {
    const current = parsePredictorWeights(event?.predictorWeights);
    return (
      predictorWeights.oprWeight !== current.oprWeight ||
      predictorWeights.szrWeight !== current.szrWeight ||
      predictorWeights.fallbackCompositeWeight !== current.fallbackCompositeWeight ||
      predictorWeights.fallbackSzrWeight !== current.fallbackSzrWeight ||
      predictorWeights.composite.auto !== current.composite.auto ||
      predictorWeights.composite.throughput !== current.composite.throughput ||
      predictorWeights.composite.accuracy !== current.composite.accuracy ||
      predictorWeights.composite.defense !== current.composite.defense ||
      predictorWeights.composite.climb !== current.composite.climb ||
      predictorWeights.composite.autoClimb !== current.composite.autoClimb
    );
  })();

  const testingOverridesChanged =
    event &&
    (testingOverrideEventEnded !== (event.testingOverrideEventEnded ?? false) ||
      (testingOverrideMatchNumber === ""
        ? event.testingOverrideMatchNumber != null
        : (parseInt(testingOverrideMatchNumber, 10) || 0) !== (event.testingOverrideMatchNumber ?? 0)));

  const allianceSimLayoutChanged =
    event && allianceSimFourPartnerSlots !== (event.allianceSimFourPartnerSlots ?? false);

  const handleSzrWeightChange = (key: keyof SzrWeights, value: number) => {
    setSzrWeights((prev) => {
      const clamped = Math.max(0, Math.min(100, value));
      const others = (["auto", "throughput", "accuracy", "defense", "driverSkill", "climb"] as const).filter((k) => k !== key);
      const otherSum = others.reduce((s, k) => s + prev[k], 0);
      const remaining = 100 - clamped;

      const next: SzrWeights = { ...prev, [key]: clamped };

      if (otherSum > 0 && remaining > 0) {
        for (const k of others) {
          next[k] = Math.round((remaining / otherSum) * prev[k] * 100) / 100;
        }
      } else if (otherSum === 0 && remaining > 0) {
        const perOther = remaining / others.length;
        for (const k of others) {
          next[k] = Math.round(perOther * 100) / 100;
        }
      } else {
        for (const k of others) {
          next[k] = 0;
        }
      }

      const sum = (["auto", "throughput", "accuracy", "defense", "driverSkill", "climb"] as const).reduce((s, k) => s + next[k], 0);
      const diff = 100 - sum;
      if (Math.abs(diff) > 0.01) {
        const largestOther = others.reduce((best, k) => (prev[k] > (prev[best] ?? 0) ? k : best), others[0]);
        next[largestOther] = Math.round((next[largestOther] + diff) * 100) / 100;
      }
      return next;
    });
  };

  const manualRemaining = syncStatusData?.manualSyncsRemaining ?? 0;

  if (isLoading) {
    return (
      <div className="min-h-full bg-zinc-950 p-4 sm:p-6">
        <div className="mx-auto flex max-w-6xl gap-8">
          <Skeleton className="hidden h-[420px] w-56 shrink-0 rounded-2xl border border-white/5 lg:block" />
          <Skeleton className="h-[560px] min-h-[400px] flex-1 rounded-2xl border border-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1
            className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl"
            data-testid="text-settings-title"
          >
            <Settings className="h-7 w-7 text-blue-400" />
            Settings
            {help?.HelpTrigger?.({ content: SETTINGS_HELP, className: "ml-1 p-1.5" })}
          </h1>
          {event && <p className="mt-1 text-sm text-zinc-500">{event.name}</p>}
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/* Settings nav — sticky on desktop */}
          <nav
            className="flex shrink-0 gap-1 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:w-56 lg:flex-col lg:overflow-visible lg:pb-0"
            aria-label="Settings sections"
          >
            <div className="flex min-w-0 gap-1 rounded-xl border border-white/10 bg-zinc-900/50 p-1.5 shadow-lg shadow-black/30 backdrop-blur-xl lg:flex-col">
              {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex min-w-[9.5rem] shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 lg:min-w-0",
                      isActive
                        ? "bg-blue-500/15 text-zinc-50 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.35)]"
                        : "text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-200",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-400" : "text-zinc-600")} />
                    <span className="flex flex-col gap-0.5">
                      <span>{tab.label}</span>
                      <span className="hidden text-[10px] font-normal text-zinc-600 lg:inline">{tab.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Main content */}
          <main className="min-w-0 flex-1">
            {activeTab === "general" && (
              <SettingsShell
                title="General"
                subtitle="App-wide preferences for this workspace."
                footer={null}
              >
                <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 text-blue-400">
                        <CircleHelp className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-100">Show help tips (?)</p>
                        <p className="mt-0.5 text-sm text-zinc-500">
                          Inline <strong className="text-zinc-400">?</strong> icons next to features. Turn off for a cleaner UI.
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="help-tips-toggle"
                      checked={help?.helpTipsEnabled ?? true}
                      onCheckedChange={(checked) => help?.setHelpTipsEnabled(checked)}
                      data-testid="switch-help-tips"
                      className="data-[state=checked]:bg-blue-500"
                    />
                  </div>
                </div>
              </SettingsShell>
            )}

            {activeTab === "szr" && (
              <SettingsShell
                title="SZR Weights"
                subtitle="Adjust weights to emphasize what matters most. Must equal 100%."
                footer={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
                      onClick={() => setSzrWeights(DEFAULT_SZR_WEIGHTS_PERCENT)}
                      data-testid="button-szr-reset"
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Reset to defaults
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500"
                      onClick={() => saveSzrMutation.mutate(szrWeights)}
                      disabled={saveSzrMutation.isPending || !szrWeightsChanged}
                      data-testid="button-save-szr"
                    >
                      {saveSzrMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      Save SZR weights
                    </Button>
                  </div>
                }
              >
                <div className="space-y-6">
                  <div className="rounded-xl border border-blue-500/15 bg-blue-950/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-blue-400/90">Distribution</p>
                      {help?.HelpTrigger?.({
                        content: {
                          title: "SZR weights",
                          body: (
                            <p>
                              SZR is a single number from your scouting data (auto, throughput, accuracy, defense, driver rating, climb).
                              Adjust weights to emphasize what matters most. Uses percentile-based ranges and a balance factor so one
                              dominant stat can&apos;t overpower the score. Weights sum to 100%.
                            </p>
                          ),
                        },
                        className: "p-1",
                      })}
                    </div>
                    <SzrStackedBar weights={szrWeights} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {SZR_KEYS.map((key) => (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between gap-2">
                          <Label className="text-sm capitalize text-zinc-300">{SZR_LABELS[key]}</Label>
                          <span className="text-sm tabular-nums text-zinc-500">{Math.round(szrWeights[key])}%</span>
                        </div>
                        <Slider
                          value={[szrWeights[key]]}
                          onValueChange={([v]) => handleSzrWeightChange(key, v)}
                          min={0}
                          max={100}
                          step={1}
                          trackClassName={SLIDER_TRACK}
                          rangeClassName={SZR_SLIDER_RANGE[key]}
                          thumbClassName={SZR_SLIDER_THUMB[key]}
                          data-testid={`slider-szr-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-xs tabular-nums text-zinc-600">
                    Total{" "}
                    {Math.round(SZR_KEYS.reduce((s, k) => s + szrWeights[k], 0))}
                    %
                  </p>
                </div>
              </SettingsShell>
            )}

            {activeTab === "predictor" && (
              <SettingsShell
                title="Match Predictor"
                subtitle="Blend OPR with scouting and tune composite stats when OPR is missing."
                footer={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
                      onClick={() => setPredictorWeights(DEFAULT_PREDICTOR_WEIGHTS)}
                      data-testid="button-predictor-reset"
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500"
                      onClick={() => savePredictorMutation.mutate(predictorWeights)}
                      disabled={savePredictorMutation.isPending || !predictorWeightsChanged}
                      data-testid="button-save-predictor"
                    >
                      {savePredictorMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                }
              >
                <div className="space-y-8">
                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Blending strategy</h3>
                      {help?.HelpTrigger?.({
                        content: {
                          title: "Match predictor weights",
                          body: (
                            <p>
                              Win probability blends OPR (TBA) and SZR (scouting). When both are available, use the OPR vs SZR sliders.
                              When OPR is missing, use the fallback blend (composite scouting stats vs SZR). Composite weights set how
                              auto, throughput, accuracy, defense, climb, and auto climb contribute to the prediction.
                            </p>
                          ),
                        },
                        className: "p-1",
                      })}
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4">
                        <p className="text-sm font-medium text-zinc-200">OPR vs SZR blend</p>
                        <p className="text-xs text-zinc-500">When both OPR and SZR are available</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">OPR</span>
                              <span className="tabular-nums text-zinc-300">{Math.round(predictorWeights.oprWeight)}%</span>
                            </div>
                            <Slider
                              value={[predictorWeights.oprWeight]}
                              onValueChange={([v]) => setPredictorWeights((p) => ({ ...p, oprWeight: v, szrWeight: 100 - v }))}
                              min={0}
                              max={100}
                              step={5}
                              trackClassName={SLIDER_TRACK}
                              rangeClassName={SLIDER_RANGE}
                              data-testid="slider-predictor-opr"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">SZR</span>
                              <span className="tabular-nums text-zinc-300">{Math.round(predictorWeights.szrWeight)}%</span>
                            </div>
                            <Slider
                              value={[predictorWeights.szrWeight]}
                              onValueChange={([v]) => setPredictorWeights((p) => ({ ...p, szrWeight: v, oprWeight: 100 - v }))}
                              min={0}
                              max={100}
                              step={5}
                              trackClassName={SLIDER_TRACK}
                              rangeClassName={SLIDER_RANGE}
                              data-testid="slider-predictor-szr"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4">
                        <p className="text-sm font-medium text-zinc-200">Fallback blend</p>
                        <p className="text-xs text-zinc-500">When OPR is missing</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Composite</span>
                              <span className="tabular-nums text-zinc-300">{Math.round(predictorWeights.fallbackCompositeWeight)}%</span>
                            </div>
                            <Slider
                              value={[predictorWeights.fallbackCompositeWeight]}
                              onValueChange={([v]) =>
                                setPredictorWeights((p) => ({ ...p, fallbackCompositeWeight: v, fallbackSzrWeight: 100 - v }))
                              }
                              min={0}
                              max={100}
                              step={5}
                              trackClassName={SLIDER_TRACK}
                              rangeClassName={SLIDER_RANGE}
                              data-testid="slider-predictor-fallback-composite"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">SZR</span>
                              <span className="tabular-nums text-zinc-300">{Math.round(predictorWeights.fallbackSzrWeight)}%</span>
                            </div>
                            <Slider
                              value={[predictorWeights.fallbackSzrWeight]}
                              onValueChange={([v]) =>
                                setPredictorWeights((p) => ({ ...p, fallbackSzrWeight: v, fallbackCompositeWeight: 100 - v }))
                              }
                              min={0}
                              max={100}
                              step={5}
                              trackClassName={SLIDER_TRACK}
                              rangeClassName={SLIDER_RANGE}
                              data-testid="slider-predictor-fallback-szr"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Composite stat weights</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(["auto", "throughput", "accuracy", "defense", "climb", "autoClimb"] as const).map((key) => (
                        <div key={key} className="space-y-2 rounded-lg border border-white/5 bg-zinc-950/30 p-3">
                          <div className="flex justify-between gap-2">
                            <Label className="text-sm font-normal capitalize text-zinc-300">
                              {key === "autoClimb" ? "Auto climb" : key === "throughput" ? "Throughput" : key}
                            </Label>
                            <span className="text-sm tabular-nums text-zinc-500">{predictorWeights.composite[key].toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[predictorWeights.composite[key]]}
                            onValueChange={([v]) =>
                              setPredictorWeights((p) => ({
                                ...p,
                                composite: { ...p.composite, [key]: v },
                              }))
                            }
                            min={0}
                            max={5}
                            step={0.1}
                            trackClassName={SLIDER_TRACK}
                            rangeClassName={SLIDER_RANGE}
                            data-testid={`slider-predictor-composite-${key}`}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </SettingsShell>
            )}

            {activeTab === "event" && (
              <SettingsShell title="Event Details" subtitle="Display info, TBA connection, and sync tools." footer={null}>
                <div className="space-y-8">
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Display</h3>
                      {help?.HelpTrigger?.({
                        content: { title: "Event details", body: <p>Display name, location, and date shown in the app. Edit these anytime.</p> },
                      })}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-1">
                      <div className="space-y-2">
                        <Label htmlFor="event-name" className="text-zinc-400">
                          Event name
                        </Label>
                        <Input
                          id="event-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Chelsea"
                          className={inputDark}
                          data-testid="input-event-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="event-location" className="text-zinc-400">
                          Location
                        </Label>
                        <Input
                          id="event-location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. Houston, TX"
                          className={inputDark}
                          data-testid="input-event-location"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="event-date" className="text-zinc-400">
                          Start date
                        </Label>
                        <DatePicker
                          id="event-date"
                          value={startDate}
                          onChange={setStartDate}
                          placeholder="Pick start date"
                          triggerClassName={inputDark}
                          data-testid="input-event-date"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="bg-blue-600 text-white shadow-lg shadow-black/25 hover:bg-blue-500"
                        onClick={() => saveEventMutation.mutate({ name, location, startDate })}
                        disabled={saveEventMutation.isPending || !eventDetailsChanged}
                        data-testid="button-save-event-details"
                      >
                        {saveEventMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save event details
                      </Button>
                    </div>
                  </section>

                  <section className="space-y-4 border-t border-white/10 pt-8">
                    <div className="flex items-center gap-2">
                      <Swords className="h-4 w-4 text-amber-400" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Alliance sim</h3>
                      {help?.HelpTrigger?.({
                        content: {
                          title: "Alliance sim layout",
                          body: (
                            <p>
                              When enabled, each alliance column has three partner slots (P1–P3), like Championship with a
                              fourth robot. Turning it off saves with two slots per alliance; any P3 placements are removed.
                            </p>
                          ),
                        },
                      })}
                    </div>
                    <p className="text-sm text-zinc-500">
                      Controls the draft board on the Alliance sim page for this event only.
                    </p>
                    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-zinc-900/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="alliance-sim-p3" className="text-zinc-200">
                          Third partner slot (P3)
                        </Label>
                        <p className="text-xs text-zinc-500">
                          Worlds-style: 8 × 3 = 24 partner placements instead of 16.
                        </p>
                      </div>
                      <Switch
                        id="alliance-sim-p3"
                        checked={allianceSimFourPartnerSlots}
                        onCheckedChange={setAllianceSimFourPartnerSlots}
                        data-testid="switch-alliance-sim-four-slots"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        className="border-zinc-600 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800"
                        onClick={() => saveAllianceSimLayoutMutation.mutate(allianceSimFourPartnerSlots)}
                        disabled={saveAllianceSimLayoutMutation.isPending || !allianceSimLayoutChanged}
                        data-testid="button-save-alliance-sim-layout"
                      >
                        {saveAllianceSimLayoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save alliance sim layout
                      </Button>
                    </div>
                  </section>

                  <section className="space-y-4 border-t border-white/10 pt-8">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-400" />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">The Blue Alliance</h3>
                      {help?.HelpTrigger?.({
                        content: {
                          title: "The Blue Alliance (TBA)",
                          body: <p>Free service with official FRC data. Enter your event key and sync to load teams, matches, and results automatically.</p>,
                        },
                      })}
                    </div>
                    <p className="text-sm text-zinc-500">
                      Connect TBA to sync schedule, teams, results, videos, and stats. Event keys are on thebluealliance.com (e.g.{" "}
                      <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">2025miket</code>).
                    </p>
                    {syncStatusData?.tbaConfigured === false && (
                      <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
                        Add <code className="text-xs">TBA_API_KEY</code> to your <code className="text-xs">.env</code> (get a key at
                        thebluealliance.com/account).
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="tba-key" className="text-zinc-400">
                        TBA event key
                      </Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                        <Input
                          id="tba-key"
                          value={tbaEventKey}
                          onChange={(e) => {
                            setTbaEventKey(e.target.value);
                            setValidationStatus("idle");
                            setValidationError("");
                          }}
                          placeholder="e.g. 2025miket"
                          className={cn("flex-1 font-mono", inputDark)}
                          data-testid="input-tba-event-key"
                        />
                        <Button
                          variant="outline"
                          className="border-zinc-600 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800"
                          onClick={handleValidate}
                          disabled={!tbaEventKey.trim() || validateMutation.isPending}
                          data-testid="button-validate-key"
                        >
                          {validateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validate"}
                        </Button>
                      </div>
                      {validationStatus === "valid" && (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{validatedName}</span>
                        </div>
                      )}
                      {validationStatus === "invalid" && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                          <XCircle className="h-4 w-4 shrink-0" />
                          <span>{validationError || "Invalid key — check and try again"}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Label htmlFor="auto-sync" className="cursor-pointer font-medium text-zinc-200">
                          Auto-sync
                        </Label>
                        {help?.HelpTrigger?.({
                          content: {
                            title: "Auto-sync",
                            body: <p>Keeps match results and schedule updated every 5 minutes during the event. Runs for 3 hours after you turn it on. Requires a TBA API key.</p>,
                          },
                          className: "ml-1 align-middle",
                        })}
                        <p className="mt-1 text-xs text-zinc-500">
                          {isKeyValidated ? "Sync every 5 min for 3 hours after you turn it on" : "Validate the event key first"}
                        </p>
                      </div>
                      <Switch
                        id="auto-sync"
                        checked={tbaAutoSync}
                        onCheckedChange={setTbaAutoSync}
                        disabled={!tbaEventKey.trim() || !isKeyValidated}
                        data-testid="switch-auto-sync"
                        className="data-[state=checked]:bg-blue-500"
                      />
                    </div>
                    {syncStatusData?.autoSync && syncStatusData.expiresAt && (
                      <AutoSyncTimer expiresAt={syncStatusData.expiresAt} />
                    )}
                    <Button
                      className="w-full bg-blue-600 text-white hover:bg-blue-500 sm:w-auto"
                      onClick={() => saveTbaMutation.mutate()}
                      disabled={saveTbaMutation.isPending || !tbaChanged}
                      data-testid="button-save-settings"
                    >
                      {saveTbaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save TBA settings
                    </Button>
                  </section>

                  {event?.tbaEventKey && (
                    <section className="space-y-4 border-t border-white/10 pt-8">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-blue-400" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Manual sync</h3>
                        {help?.HelpTrigger?.({
                          content: {
                            title: "Manual sync",
                            body: (
                              <p>
                                Pull data from TBA on demand. Schedule and Teams load matches and team list. Results, Videos, Avatars, and OPR update scores and stats. Limit: 3 syncs per 15 minutes.
                              </p>
                            ),
                          },
                        })}
                      </div>
                      <p className="text-sm text-zinc-500">
                        Pull specific data from TBA now. Limit: 3 syncs per 15 minutes.
                        {manualRemaining < 3 && (
                          <span className="mt-1 block text-zinc-600">
                            {manualRemaining} sync{manualRemaining !== 1 ? "s" : ""} left this window.
                          </span>
                        )}
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between gap-2 border-zinc-600 bg-zinc-900/50 text-zinc-200 hover:bg-zinc-800 sm:w-auto"
                            disabled={manualRemaining === 0}
                            data-testid="button-manual-sync-trigger"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Sync from TBA
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 border-zinc-700 bg-zinc-900 text-zinc-100">
                          <DropdownMenuLabel>Choose what to sync</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-zinc-700" />
                          {SYNC_ACTIONS.map((action) => {
                            const isSyncing = syncingKeys.has(action.key);
                            return (
                              <DropdownMenuItem
                                key={action.key}
                                onClick={() => handleSync(action)}
                                disabled={isSyncing}
                                data-testid={`button-sync-${action.key}`}
                                className="focus:bg-zinc-800"
                              >
                                {isSyncing ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <action.icon className="mr-2 h-4 w-4 text-zinc-500" />
                                )}
                                <div className="flex flex-col items-start">
                                  <span>{action.label}</span>
                                  <span className="text-xs text-zinc-500">{action.description}</span>
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </section>
                  )}

                  <Card className="border-amber-500/35 bg-amber-950/20 shadow-none backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base text-amber-200">
                        <TestTube2 className="h-4 w-4" />
                        Testing overrides
                        {help?.HelpTrigger?.({
                          content: {
                            title: "Testing overrides",
                            body: (
                              <p>
                                For testing only. Override event ended lets you continue assigning scouts and using the schedule even when the event is marked over.
                                Override match number lets you set which match appears as &quot;current&quot; on the scouting schedule (e.g. to test Q12 while real current is Q8).
                              </p>
                            ),
                          },
                        })}
                      </CardTitle>
                      <CardDescription className="text-amber-200/70">
                        Override event-ended state and current match for testing. Do not use in production.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-zinc-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Label htmlFor="override-event-ended" className="cursor-pointer font-medium text-zinc-100">
                            Override event ended
                          </Label>
                          <p className="mt-1 text-xs text-zinc-500">Treat event as not over — enable scouting and reassignment</p>
                        </div>
                        <Switch
                          id="override-event-ended"
                          checked={testingOverrideEventEnded}
                          onCheckedChange={setTestingOverrideEventEnded}
                          data-testid="switch-testing-override-event-ended"
                          className="data-[state=checked]:bg-amber-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="override-match-number" className="text-zinc-400">
                          Override current match number
                        </Label>
                        <Input
                          id="override-match-number"
                          type="number"
                          min={1}
                          placeholder="Leave empty to use real current match"
                          value={testingOverrideMatchNumber}
                          onChange={(e) => setTestingOverrideMatchNumber(e.target.value)}
                          className={inputDark}
                          data-testid="input-testing-override-match"
                        />
                        <p className="text-xs text-zinc-600">
                          Set a match number (e.g. 12) to display as current on the scouting schedule. Empty = no override.
                        </p>
                      </div>
                      <Button
                        onClick={() =>
                          saveTestingOverridesMutation.mutate({
                            testingOverrideEventEnded,
                            testingOverrideMatchNumber:
                              testingOverrideMatchNumber.trim() === "" ? null : parseInt(testingOverrideMatchNumber, 10) || null,
                          })
                        }
                        disabled={saveTestingOverridesMutation.isPending || !testingOverridesChanged}
                        variant="outline"
                        className="border-amber-500/40 text-amber-100 hover:bg-amber-500/15"
                        data-testid="button-save-testing-overrides"
                      >
                        {saveTestingOverridesMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save testing overrides
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </SettingsShell>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
