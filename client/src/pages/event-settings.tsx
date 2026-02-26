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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, RefreshCw, CheckCircle2, XCircle, Loader2, Zap, Image, BarChart3, Trophy, Video } from "lucide-react";
import type { Event } from "@shared/schema";

export default function EventSettings() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const [tbaEventKey, setTbaEventKey] = useState("");
  const [tbaAutoSync, setTbaAutoSync] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [validatedName, setValidatedName] = useState("");

  useEffect(() => {
    if (event) {
      setTbaEventKey(event.tbaEventKey || "");
      setTbaAutoSync(event.tbaAutoSync);
    }
  }, [event]);

  const validateMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/tba/validate`, { eventKey: key });
      return res.json();
    },
    onSuccess: (data: { valid: boolean; name?: string }) => {
      if (data.valid) {
        setValidationStatus("valid");
        setValidatedName(data.name || "");
      } else {
        setValidationStatus("invalid");
        setValidatedName("");
      }
    },
    onError: () => {
      setValidationStatus("invalid");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/settings`, {
        tbaEventKey: tbaEventKey || null,
        tbaAutoSync,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "tba", "sync-status"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const syncActions = [
    {
      key: "videos",
      label: "Videos",
      icon: Video,
      endpoint: "sync-videos",
      invalidate: "schedule",
      formatResult: (d: any) => `Synced ${d.synced} videos from ${d.total} matches`,
    },
    {
      key: "avatars",
      label: "Avatars",
      icon: Image,
      endpoint: "sync-avatars",
      invalidate: "teams",
      formatResult: (d: any) => `Synced ${d.synced} avatars from ${d.total} teams`,
    },
    {
      key: "oprs",
      label: "OPRs",
      icon: BarChart3,
      endpoint: "sync-oprs",
      invalidate: "teams",
      formatResult: (d: any) => `Synced OPR data for ${d.synced} of ${d.total} teams`,
    },
    {
      key: "results",
      label: "Results",
      icon: Trophy,
      endpoint: "sync-results",
      invalidate: "schedule",
      formatResult: (d: any) => `Synced results for ${d.synced} matches`,
    },
  ];

  const [syncingKeys, setSyncingKeys] = useState<Set<string>>(new Set());

  const handleSync = async (action: typeof syncActions[0]) => {
    setSyncingKeys(prev => new Set(prev).add(action.key));
    try {
      const res = await apiRequest("POST", `/api/events/${eventId}/tba/${action.endpoint}`);
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, action.invalidate] });
      toast({ title: action.formatResult(data) });
    } catch (err: any) {
      toast({ title: `${action.label} sync failed`, description: err.message, variant: "destructive" });
    } finally {
      setSyncingKeys(prev => { const n = new Set(prev); n.delete(action.key); return n; });
    }
  };

  const handleValidate = () => {
    if (!tbaEventKey.trim()) return;
    setValidationStatus("validating");
    validateMutation.mutate(tbaEventKey.trim());
  };

  const hasChanges = event && (
    (tbaEventKey || "") !== (event.tbaEventKey || "") ||
    tbaAutoSync !== event.tbaAutoSync
  );

  if (isLoading) return <Skeleton className="h-96 w-full m-6" />;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-settings-title">
          <Settings className="h-6 w-6" />
          Event Settings
        </h1>
        {event && (
          <p className="text-sm text-muted-foreground mt-1">{event.name}</p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            The Blue Alliance
          </CardTitle>
          <CardDescription className="text-sm">
            Connect to TBA to auto-sync match results, scores, videos, and OPR stats.
            Find your event key at thebluealliance.com (format: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">2025miket</span>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <Label htmlFor="tba-key" className="text-sm font-semibold">Event Key</Label>
            <div className="flex gap-2">
              <Input
                id="tba-key"
                value={tbaEventKey}
                onChange={(e) => {
                  setTbaEventKey(e.target.value);
                  setValidationStatus("idle");
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
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Validate"
                )}
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
                <span>Invalid key — check and try again</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-card">
            <div className="space-y-0.5">
              <Label htmlFor="auto-sync" className="text-sm font-semibold cursor-pointer">Auto-Sync</Label>
              <p className="text-xs text-muted-foreground">
                Pull results, videos, and OPRs every 5 minutes
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={tbaAutoSync}
              onCheckedChange={setTbaAutoSync}
              disabled={!tbaEventKey.trim()}
              data-testid="switch-auto-sync"
            />
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            className="w-full"
            size="lg"
            data-testid="button-save-settings"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {event?.tbaEventKey && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                Manual Sync
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">{event.tbaEventKey}</Badge>
            </div>
            <CardDescription className="text-sm">
              Pull specific data from TBA right now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {syncActions.map(action => {
                const isSyncing = syncingKeys.has(action.key);
                return (
                  <Button
                    key={action.key}
                    variant="outline"
                    className="h-auto py-3 px-4 flex flex-col items-center gap-1.5 text-center"
                    onClick={() => handleSync(action)}
                    disabled={isSyncing}
                    data-testid={`button-sync-${action.key}`}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <action.icon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-semibold">{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
