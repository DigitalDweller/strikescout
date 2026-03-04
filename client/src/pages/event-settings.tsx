import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  MapPin,
  Calendar,
  ChevronDown,
  Users,
  Image,
  BarChart3,
  Trophy,
  Video,
  Clock,
  Timer,
  ListOrdered,
} from "lucide-react";
import type { Event } from "@shared/schema";

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
      <div className="flex items-center gap-2 text-sm text-orange-500 bg-orange-500/10 rounded-md px-3 py-2">
        <Timer className="h-4 w-4 shrink-0" />
        <span className="font-medium">Auto-sync expired — turn it back on to continue</span>
      </div>
    );

  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
      <Clock className="h-4 w-4 shrink-0 text-primary" />
      <span>
        <span className="font-semibold text-foreground">{timeStr}</span> left in this session
      </span>
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

export default function EventSettings() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();

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

  useEffect(() => {
    if (event) {
      setName(event.name);
      setLocation(event.location || "");
      setStartDate(event.startDate || "");
      setTbaEventKey(event.tbaEventKey || "");
      setTbaAutoSync(event.tbaAutoSync);
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

  const manualRemaining = syncStatusData?.manualSyncsRemaining ?? 0;

  if (isLoading) return <Skeleton className="h-96 w-full m-6" />;

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-2xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-settings-title">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        {event && (
          <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
        )}
      </header>

      {/* Event details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Event details
          </CardTitle>
          <CardDescription>Name, location, and date for this event.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-name">Event name</Label>
            <Input
              id="event-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Houston Regional"
              data-testid="input-event-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Houston, TX"
              data-testid="input-event-location"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-date">Start date</Label>
            <Input
              id="event-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-event-date"
            />
          </div>
          <Button
            onClick={() => saveEventMutation.mutate({ name, location, startDate })}
            disabled={saveEventMutation.isPending || !eventDetailsChanged}
            data-testid="button-save-event-details"
          >
            {saveEventMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save event details
          </Button>
        </CardContent>
      </Card>

      {/* TBA connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            The Blue Alliance
          </CardTitle>
          <CardDescription>
            Connect TBA to sync schedule, teams, results, videos, and stats. Event keys are on thebluealliance.com (e.g.{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">2025miket</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {syncStatusData?.tbaConfigured === false && (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md px-3 py-2 border border-amber-500/20">
              Add <code className="text-xs">TBA_API_KEY</code> to your <code className="text-xs">.env</code> (get a key at
              thebluealliance.com/account).
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tba-key">TBA event key</Label>
            <div className="flex gap-2">
              <Input
                id="tba-key"
                value={tbaEventKey}
                onChange={(e) => {
                  setTbaEventKey(e.target.value);
                  setValidationStatus("idle");
                  setValidationError("");
                }}
                placeholder="e.g. 2025miket"
                className="flex-1 font-mono"
                data-testid="input-tba-event-key"
              />
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={!tbaEventKey.trim() || validateMutation.isPending}
                data-testid="button-validate-key"
              >
                {validateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validate"}
              </Button>
            </div>
            {validationStatus === "valid" && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded-md px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-medium">{validatedName}</span>
              </div>
            )}
            {validationStatus === "invalid" && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-md px-3 py-2">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{validationError || "Invalid key — check and try again"}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="auto-sync" className="cursor-pointer font-medium">
                Auto-sync
              </Label>
              <p className="text-xs text-muted-foreground">
                {isKeyValidated
                  ? "Sync every 5 min for 3 hours after you turn it on"
                  : "Validate the event key first"}
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={tbaAutoSync}
              onCheckedChange={setTbaAutoSync}
              disabled={!tbaEventKey.trim() || !isKeyValidated}
              data-testid="switch-auto-sync"
            />
          </div>
          {syncStatusData?.autoSync && syncStatusData.expiresAt && (
            <AutoSyncTimer expiresAt={syncStatusData.expiresAt} />
          )}

          <Button
            onClick={() => saveTbaMutation.mutate()}
            disabled={saveTbaMutation.isPending || !tbaChanged}
            className="w-full"
            data-testid="button-save-settings"
          >
            {saveTbaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save TBA settings
          </Button>
        </CardContent>
      </Card>

      {/* Manual sync (dropdown) */}
      {event?.tbaEventKey && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Manual sync
            </CardTitle>
            <CardDescription>
              Pull specific data from TBA now. Limit: 3 syncs per 15 minutes.
              {manualRemaining < 3 && (
                <span className="block mt-1 text-muted-foreground">
                  {manualRemaining} sync{manualRemaining !== 1 ? "s" : ""} left this window.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto justify-between gap-2"
                  disabled={manualRemaining === 0}
                  data-testid="button-manual-sync-trigger"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sync from TBA
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Choose what to sync</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SYNC_ACTIONS.map((action) => {
                  const isSyncing = syncingKeys.has(action.key);
                  return (
                    <DropdownMenuItem
                      key={action.key}
                      onClick={() => handleSync(action)}
                      disabled={isSyncing}
                      data-testid={`button-sync-${action.key}`}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <action.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      )}
                      <div className="flex flex-col items-start">
                        <span>{action.label}</span>
                        <span className="text-xs text-muted-foreground">{action.description}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
