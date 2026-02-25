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
import { Settings, Video, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { Event } from "@shared/schema";

export default function EventSettings() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { toast } = useToast();

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      return res.json();
    },
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
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/tba/sync-videos`);
      return res.json();
    },
    onSuccess: (data: { synced: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "schedule"] });
      toast({ title: `Synced ${data.synced} videos out of ${data.total} qualification matches` });
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

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
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
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
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            The Blue Alliance Integration
          </CardTitle>
          <CardDescription>
            Connect this event to The Blue Alliance to automatically pull match videos.
            Find your event key at thebluealliance.com (e.g. "2025miket" for 2025 Kettering District).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tba-key">TBA Event Key</Label>
            <div className="flex gap-2">
              <Input
                id="tba-key"
                value={tbaEventKey}
                onChange={(e) => {
                  setTbaEventKey(e.target.value);
                  setValidationStatus("idle");
                }}
                placeholder="e.g. 2025miket"
                className="flex-1"
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
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Valid — {validatedName}</span>
              </div>
            )}
            {validationStatus === "invalid" && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <XCircle className="h-4 w-4" />
                <span>Invalid event key — check the key and try again</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <Label htmlFor="auto-sync" className="font-medium">Auto-Sync Videos</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Automatically check for new match videos every 5 minutes
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

          {event?.tbaEventKey && (
            <div className="flex items-center justify-between rounded-md border p-4 bg-muted/30">
              <div>
                <p className="font-medium text-sm">Current TBA Key</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="font-mono">{event.tbaEventKey}</Badge>
                  {event.tbaAutoSync && (
                    <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/30">
                      Auto-Sync ON
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-sync-now"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>
          )}

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            className="w-full"
            data-testid="button-save-settings"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
