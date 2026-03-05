import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import flashbangImg from "@assets/black-guy-showing-hand-1657857_1772066434323.webp";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ArrowLeft,
  BarChart2,
  ClipboardList,
  Users,
  CalendarDays,
  LayoutDashboard,
  Moon,
  Sun,
  History,
  Database,
  Settings,
  ListOrdered,
  LogOut,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { useEventUpdatesIndicator } from "@/contexts/event-updates";
import type { Event } from "@shared/schema";

const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_ORIGIN) || "";

function DataRefreshButton({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasUnseenUpdates, markSynced } = useEventUpdatesIndicator();
  const [syncing, setSyncing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      const predicate = (query: { queryKey: unknown[] }) => {
        const keys = query.queryKey;
        if (keys[0] !== "/api/events") return false;
        const id = keys[1];
        return id === eventId || id === String(eventId);
      };

      // Refetch all cached event queries, and explicitly fetch main data for feedback
      const [event, teams, entries, schedule] = await Promise.all([
        queryClient.fetchQuery({ queryKey: ["/api/events", eventId] }),
        queryClient.fetchQuery({ queryKey: ["/api/events", eventId, "teams"] }).catch(() => null),
        queryClient.fetchQuery({ queryKey: ["/api/events", eventId, "entries"] }).catch(() => null),
        queryClient.fetchQuery({ queryKey: ["/api/events", eventId, "schedule"] }).catch(() => null),
      ]);

      // Invalidate other event queries (picklists, etc.) so they refetch when used
      await queryClient.invalidateQueries({ predicate });

      const parts: string[] = [];
      if (Array.isArray(teams)) parts.push(`${teams.length} team${teams.length === 1 ? "" : "s"}`);
      if (Array.isArray(entries)) parts.push(`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`);
      if (Array.isArray(schedule)) parts.push(`${schedule.length} match${schedule.length === 1 ? "" : "es"}`);

      const eventName = event && typeof event === "object" && "name" in event ? (event as { name: string }).name : "";
      const title = "Strikescout synced";
      const description = parts.length > 0
        ? eventName ? `Synced ${parts.join(", ")} for ${eventName}.` : `Synced ${parts.join(", ")}.`
        : eventName ? `Synced event details for ${eventName}.` : "Refreshed successfully.";

      markSynced();
      toast({ title, description });
    } catch (e) {
      toast({
        title: "Strikescout sync failed",
        description: e instanceof Error ? e.message : "Could not refresh data from database",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [eventId, queryClient, toast, markSynced]);

  const lightClass = hasUnseenUpdates
    ? "bg-red-500 animate-pulse"
    : "bg-green-500 animate-pulse";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${lightClass}`}
        title={hasUnseenUpdates ? "New scouting data—click Sync to refresh" : "Data up to date"}
        data-testid="indicator-db-sync"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        disabled={syncing}
        className="gap-1.5 px-2 h-8 font-medium"
        title="Sync displayed data with Strikescout database"
        data-testid="button-data-refresh"
      >
        <Database className={`h-4 w-4 shrink-0 ${syncing ? "animate-spin" : ""}`} />
        <span className="text-xs">Sync</span>
      </Button>
    </div>
  );
}

export function AppSidebar({ eventId }: { eventId: number }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showFlashbang, setShowFlashbang] = useState(false);
  const clickTimestamps = useRef<number[]>([]);

  const [showDevMenu, setShowDevMenu] = useState(false);

  const handleThemeClick = useCallback(() => {
    toggleTheme();
    const now = Date.now();
    clickTimestamps.current.push(now);
    clickTimestamps.current = clickTimestamps.current.filter(t => now - t < 10000);
    if (clickTimestamps.current.length >= 10) {
      clickTimestamps.current = [];
      setShowFlashbang(true);
      setShowDevMenu(true);
      setTimeout(() => setShowFlashbang(false), 2000);
    }
  }, [toggleTheme]);

  const { data: rateLimitData } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/dev/tba-rate-limit"],
    enabled: showDevMenu && isAdmin,
  });

  const { data: callHistoryData } = useQuery<{ minute: string; calls: number }[]>({
    queryKey: ["/api/dev/tba-call-history"],
    enabled: showDevMenu && isAdmin,
    refetchInterval: 10000,
  });

  const rateLimitMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(`${API_BASE}/api/dev/tba-rate-limit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/dev/tba-rate-limit"] }),
  });

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
  });

  const isAdmin = user?.role === "admin";

  const scoutingItems = [
    {
      title: "Scouting Form",
      url: `/events/${eventId}/scout`,
      icon: ClipboardList,
      iconClass: "text-emerald-500",
      children: [
        { title: "Form History", url: `/events/${eventId}/scout/history`, icon: History, iconClass: "text-green-400" },
      ],
    },
    ...(isAdmin ? [{ title: "Picklist", url: `/events/${eventId}/picklist`, icon: ListOrdered, iconClass: "text-teal-500" }] : []),
  ];

  const navHints: Record<string, string> = {
    "Overview": "Event dashboard and quick actions",
    "Teams": "View and sort all teams",
    "Matches": "Schedule and results",
    "Match Simulator": "Predict match outcomes",
    "Scouting Form": "Enter match data",
    "Form History": "Past scouting entries",
    "Picklist": "Rank teams for alliance selection",
    "Data Management": "Export data to CSV",
    "Settings": "TBA sync and event setup",
  };

  const sections = isAdmin
    ? [
        {
          label: "Overview",
          items: [
            { title: "Overview", url: `/events/${eventId}`, icon: LayoutDashboard, iconClass: "text-violet-500" },
            { title: "Teams", url: `/events/${eventId}/teams`, icon: Users, iconClass: "text-blue-500" },
            {
            title: "Matches",
            url: `/events/${eventId}/schedule`,
            icon: CalendarDays,
            iconClass: "text-sky-500",
            children: [{ title: "Match Simulator", url: `/events/${eventId}/simulator`, icon: BarChart2, iconClass: "text-amber-500" }],
          },
          ],
        },
        { label: "Scouting", items: scoutingItems },
        {
          label: "Manage",
          items: [
            { title: "Data Management", url: `/events/${eventId}/data`, icon: Database, iconClass: "text-slate-400" },
            { title: "Settings", url: `/events/${eventId}/settings`, icon: Settings, iconClass: "text-slate-400" },
          ],
        },
      ]
    : [{ label: "Scouting", items: scoutingItems }];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-3 py-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3" data-testid="button-back-events">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Events</span>
            </button>
          </Link>
          <div>
            <h2 className="font-bold text-base leading-tight" data-testid="text-event-name">
              {event?.name || "Loading..."}
            </h2>
            {event?.location && (
              <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-event-location">
                {event.location}
              </p>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map(section => (
          <SidebarGroup key={section.label} className="py-0 px-2 gap-0">
            <SidebarGroupLabel className="h-4 text-[10px]">{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = location === item.url;
                  const hasChildren = "children" in item && (item as any).children;
                  const isChildActive = hasChildren && (item as any).children!.some((c: any) => location === c.url);
                  const hint = navHints[item.title];
                  const navLink = (
                    <SidebarMenuButton asChild data-active={isActive || isChildActive || undefined}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`} className="min-h-[2.5rem] py-2">
                        <item.icon className={`h-4 w-4 ${(item as any).iconClass || ""}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  );
                  return (
                    <SidebarMenuItem key={item.title}>
                      {hint ? (
                        <Tooltip delayDuration={400}>
                          <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[200px] text-sm">
                            {hint}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        navLink
                      )}
                      {hasChildren && (
                        <SidebarMenuSub>
                          {(item as any).children!.map((child: any) => {
                            const childHint = navHints[child.title];
                            const childLink = (
                              <SidebarMenuSubButton asChild data-active={location === child.url || undefined}>
                                <Link href={child.url} data-testid={`nav-${child.title.toLowerCase().replace(/\s+/g, "-")}`} className="min-h-[2.25rem] py-1.5">
                                  <child.icon className={`h-3.5 w-3.5 ${child.iconClass || ""}`} />
                                  <span>{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            );
                            return (
                              <SidebarMenuSubItem key={child.title}>
                                {childHint ? (
                                  <Tooltip delayDuration={400}>
                                    <TooltipTrigger asChild>{childLink}</TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-[200px] text-sm">
                                      {childHint}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  childLink
                                )}
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 px-3 pb-3 min-h-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">{user?.username}</span>
          </div>
          <div className="flex items-center gap-2">
            <DataRefreshButton eventId={eventId} />
            {showDevMenu && isAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  title="Dev menu"
                  data-testid="button-dev-menu"
                >
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Dev</h4>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="tba-rate-limit" className="text-xs font-normal cursor-pointer">
                      TBA rate limit (3/5 min)
                    </Label>
                    <Switch
                      id="tba-rate-limit"
                      checked={rateLimitData?.enabled ?? false}
                      onCheckedChange={(checked) => rateLimitMutation.mutate(checked)}
                      disabled={rateLimitMutation.isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">TBA API calls (last 60 min)</p>
                    <ChartContainer config={{ calls: { label: "Calls" } }} className="h-24 w-full">
                      <AreaChart data={(callHistoryData ?? []).map(d => ({ ...d, label: d.minute.slice(11, 16) }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="calls" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} strokeWidth={1.5} />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleThemeClick}
              className="h-8 w-8 shrink-0"
              data-testid="button-toggle-theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={logout}
              className="h-8 w-8 shrink-0"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
      {showFlashbang && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white animate-flashbang-overlay"
          style={{ pointerEvents: "none" }}
        >
          <img
            src={flashbangImg}
            alt=""
            className="max-w-full max-h-full object-contain animate-flashbang-img"
          />
        </div>
      )}
    </Sidebar>
  );
}
