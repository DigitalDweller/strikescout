import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import {
  ArrowLeft,
  ClipboardList,
  Users,
  CalendarDays,
  LayoutDashboard,
  Moon,
  Sun,
  History,
  Database,
  Settings,
  RefreshCw,
  ListOrdered,
  TrendingUp,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import type { Event } from "@shared/schema";

interface SyncStatusData {
  tbaConfigured?: boolean;
  connected: boolean;
  autoSync: boolean;
  syncing: boolean;
  lastSyncTime: number | null;
  expiresAt: number | null;
  manualSyncsRemaining: number;
  manualSyncResetsAt: number | null;
}

function TbaSyncStatus({ eventId }: { eventId: number }) {
  const [manualSyncing, setManualSyncing] = useState(false);
  const { toast } = useToast();

  const { data } = useQuery<SyncStatusData>({
    queryKey: ["/api/events", eventId, "tba", "sync-status"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/tba/sync-status`, { credentials: "include" });
      if (!res.ok) return { connected: false, autoSync: false, syncing: false, lastSyncTime: null, expiresAt: null, manualSyncsRemaining: 3, manualSyncResetsAt: null };
      return res.json();
    },
    refetchInterval: 15000,
  });

  if (!data?.connected) return null;
  if (data.connected && data.tbaConfigured === false) {
    return (
      <div className="flex items-center gap-1.5 min-w-0 text-amber-600 dark:text-amber-400" data-testid="widget-tba-sync" title="Add TBA_API_KEY to your .env file">
        <span className="text-[11px] font-medium truncate">TBA key not set</span>
      </div>
    );
  }

  const isSyncing = data.syncing || manualSyncing;

  let dotClass = "bg-muted-foreground/50";
  let statusText = "Connected";

  if (isSyncing) {
    dotClass = "bg-yellow-400 animate-pulse";
    statusText = "Syncing...";
  } else if (!data.autoSync) {
    dotClass = "bg-muted-foreground/40";
    statusText = "Auto-sync off";
  } else {
    const now = Date.now();
    const ageMs = data.lastSyncTime ? now - data.lastSyncTime : null;
    if (ageMs !== null) {
      if (ageMs < 60_000) {
        dotClass = "bg-green-500";
        statusText = "Up to date";
      } else {
        dotClass = "bg-muted-foreground/50";
        statusText = `${Math.floor(ageMs / 60_000)}m ago`;
      }
    } else {
      statusText = "Waiting";
    }
  }

  const canManualSync = data.manualSyncsRemaining > 0 && !isSyncing;

  const handleManualSync = async () => {
    if (!canManualSync) return;
    setManualSyncing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/tba/manual-sync`, { method: "POST", credentials: "include" });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          const json = JSON.parse(text);
          if (typeof json?.message === "string") msg = json.message;
        } catch {}
        throw new Error(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "tba", "sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
    } catch (e) {
      toast({ title: "TBA sync failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setManualSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0" data-testid="widget-tba-sync">
      <div className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
      <span className="text-[11px] font-medium text-muted-foreground truncate">{statusText}</span>
      <button
        onClick={handleManualSync}
        disabled={!canManualSync}
        className="shrink-0 p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title={canManualSync ? `Sync now (${data.manualSyncsRemaining} left)` : "Sync limit reached"}
        data-testid="button-manual-sync"
      >
        <RefreshCw className={`h-3 w-3 text-muted-foreground ${isSyncing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

export function AppSidebar({ eventId }: { eventId: number }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showFlashbang, setShowFlashbang] = useState(false);
  const clickTimestamps = useRef<number[]>([]);

  const handleThemeClick = useCallback(() => {
    toggleTheme();
    const now = Date.now();
    clickTimestamps.current.push(now);
    clickTimestamps.current = clickTimestamps.current.filter(t => now - t < 10000);
    if (clickTimestamps.current.length > 10) {
      clickTimestamps.current = [];
      setShowFlashbang(true);
      setTimeout(() => setShowFlashbang(false), 2000);
    }
  }, [toggleTheme]);

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

  const sections = isAdmin
    ? [
        {
          label: "Overview",
          items: [
            { title: "Overview", url: `/events/${eventId}`, icon: LayoutDashboard, iconClass: "text-violet-500" },
            { title: "Teams", url: `/events/${eventId}/teams`, icon: Users, iconClass: "text-blue-500" },
            { title: "Schedule", url: `/events/${eventId}/schedule`, icon: CalendarDays, iconClass: "text-sky-500" },
            { title: "Playoff predictor", url: `/events/${eventId}/playoff-predictor`, icon: TrendingUp, iconClass: "text-amber-500" },
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
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild data-active={isActive || isChildActive || undefined}>
                        <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <item.icon className={`h-4 w-4 ${(item as any).iconClass || ""}`} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {hasChildren && (
                        <SidebarMenuSub>
                          {(item as any).children!.map((child: any) => (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton asChild data-active={location === child.url || undefined}>
                                <Link href={child.url} data-testid={`nav-${child.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                  <child.icon className={`h-3.5 w-3.5 ${child.iconClass || ""}`} />
                                  <span>{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
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
        <div className="px-3 pb-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{user?.username}</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-3 pb-3">
          <TbaSyncStatus eventId={eventId} />
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleThemeClick}
              className="h-8 w-8"
              data-testid="button-toggle-theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={logout}
              className="h-8 w-8"
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
