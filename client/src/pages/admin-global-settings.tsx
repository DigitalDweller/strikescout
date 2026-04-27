import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LandingBackground } from "@/components/landing/LandingBackground";
import { AppLogoMark } from "@/components/app-logo-mark";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Event } from "@shared/schema";

export default function AdminGlobalSettings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [draftIds, setDraftIds] = useState<number[] | null | undefined>(undefined);

  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  const { data: settings, isLoading: settingsLoading } = useQuery<{ globallyVisibleEventIds: number[] | null }>({
    queryKey: ["/api/global-settings"],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  useEffect(() => {
    if (!settings) return;
    setDraftIds(settings.globallyVisibleEventIds);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (globallyVisibleEventIds: number[] | null) => {
      const res = await apiRequest("PATCH", "/api/global-settings", { globallyVisibleEventIds });
      return (await res.json()) as { globallyVisibleEventIds: number[] | null };
    },
    onSuccess: (data) => {
      setDraftIds(data.globallyVisibleEventIds);
      queryClient.invalidateQueries({ queryKey: ["/api/global-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/active-event"] });
      toast({ title: "Saved" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  const sortedEvents = useMemo(
    () => [...(events ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [events],
  );

  const restrictComps = draftIds !== null && draftIds !== undefined;
  const selectedSet = useMemo(() => new Set(draftIds ?? []), [draftIds]);

  const toggleEvent = (id: number, checked: boolean) => {
    if (draftIds === null || draftIds === undefined) return;
    if (checked) setDraftIds([...new Set([...draftIds, id])]);
    else setDraftIds(draftIds.filter((x) => x !== id));
  };

  const handleRestrictChange = (on: boolean) => {
    if (!events?.length) {
      toast({ title: "No competitions yet", description: "Create an event on the season dashboard first." });
      return;
    }
    if (on) {
      setDraftIds(events.map((e) => e.id));
    } else {
      setDraftIds(null);
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  const loading = settingsLoading || eventsLoading || draftIds === undefined;

  return (
    <div className="dark relative min-h-screen overflow-x-hidden bg-[#0a0a0a] font-[Inter,system-ui,sans-serif] antialiased text-zinc-100">
      <LandingBackground tone="dashboard" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-20 sm:px-6 lg:pt-24">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="sm" className="gap-2 text-zinc-400 hover:text-zinc-100" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Season dashboard
            </Link>
          </Button>
        </div>

        <header className="mb-10 flex flex-col gap-4 border-b border-zinc-800/80 pb-8 sm:flex-row sm:items-center">
          <AppLogoMark boxClassName="h-12 w-12 shrink-0" imgClassName="h-10 w-10" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">Global settings</h1>
            <p className="mt-1 text-sm text-zinc-500">Workspace-wide options for your team.</p>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/50 p-6 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">Visible competitions</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
            Choose which comps appear on the season dashboard and in the app for scouters and other non-admin accounts.
            Admins always see every competition in the selected season.
          </p>

          {loading ? (
            <div className="mt-8 space-y-4">
              <Skeleton className="h-12 w-full rounded-xl bg-zinc-900/80" />
              <Skeleton className="h-32 w-full rounded-xl bg-zinc-900/80" />
            </div>
          ) : (
            <>
              <div className="mt-8 flex flex-col gap-4 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label htmlFor="restrict-comps" className="text-base font-medium text-zinc-100">
                    Limit visible competitions
                  </Label>
                  <p className="mt-1 text-sm text-zinc-500">
                    Off: everyone sees all comps in this season. On: only the comps you select below.
                  </p>
                </div>
                <Switch
                  id="restrict-comps"
                  checked={restrictComps}
                  onCheckedChange={handleRestrictChange}
                  className="shrink-0 data-[state=checked]:bg-blue-600"
                  data-testid="switch-limit-visible-comps"
                />
              </div>

              {restrictComps && (
                <div className="mt-6 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/10 bg-zinc-900/50 text-zinc-200"
                      onClick={() => setDraftIds(sortedEvents.map((e) => e.id))}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/10 bg-zinc-900/50 text-zinc-200"
                      onClick={() => setDraftIds([])}
                    >
                      Clear
                    </Button>
                  </div>

                  {sortedEvents.length === 0 ? (
                    <p className="text-sm text-zinc-500">No events in this season yet.</p>
                  ) : (
                    <ul className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                      {sortedEvents.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.04]"
                        >
                          <Checkbox
                            id={`vis-ev-${ev.id}`}
                            checked={selectedSet.has(ev.id)}
                            onCheckedChange={(c) => toggleEvent(ev.id, c === true)}
                            data-testid={`checkbox-visible-event-${ev.id}`}
                          />
                          <Label htmlFor={`vis-ev-${ev.id}`} className="flex-1 cursor-pointer text-sm font-medium text-zinc-200">
                            {ev.name}
                          </Label>
                        </li>
                      ))}
                    </ul>
                  )}

                  {restrictComps && draftIds?.length === 0 && sortedEvents.length > 0 ? (
                    <p className="text-sm text-amber-400/90">
                      No competitions are selected — non-admin accounts will not see any comps until you choose at least one.
                    </p>
                  ) : null}
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-transparent text-zinc-200"
                  onClick={() => setDraftIds(settings?.globallyVisibleEventIds ?? null)}
                  disabled={saveMutation.isPending}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  className="font-semibold"
                  disabled={saveMutation.isPending || draftIds === undefined}
                  onClick={() => {
                    if (draftIds === undefined) return;
                    saveMutation.mutate(draftIds);
                  }}
                  data-testid="button-save-global-settings"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
