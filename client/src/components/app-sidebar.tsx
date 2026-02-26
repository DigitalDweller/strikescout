import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
  Trophy,
  Moon,
  Sun,
  History,
  Database,
  Settings,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { Event } from "@shared/schema";

interface SyncStatusData {
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

  const { data } = useQuery<SyncStatusData>({
    queryKey: ["/api/events", eventId, "tba", "sync-status"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/tba/sync-status`);
      if (!res.ok) return { connected: false, autoSync: false, syncing: false, lastSyncTime: null, expiresAt: null, manualSyncsRemaining: 3, manualSyncResetsAt: null };
      return res.json();
    },
    refetchInterval: 15000,
  });

  if (!data?.connected) return null;

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
      await fetch(`/api/events/${eventId}/tba/manual-sync`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "tba", "sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "teams"] });
    } catch {}
    setManualSyncing(false);
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

  const navItems = [
    { title: "Leaderboard", url: `/events/${eventId}`, icon: Trophy },
    { title: "Teams", url: `/events/${eventId}/teams`, icon: Users },
    { title: "Schedule", url: `/events/${eventId}/schedule`, icon: CalendarDays },
    {
      title: "Scouting Form",
      url: `/events/${eventId}/scout`,
      icon: ClipboardList,
      children: [
        { title: "Form History", url: `/events/${eventId}/scout/history`, icon: History },
      ],
    },
    { title: "Data Management", url: `/events/${eventId}/data`, icon: Database },
    { title: "Settings", url: `/events/${eventId}/settings`, icon: Settings },
  ];

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
        <SidebarGroup>
          <SidebarGroupLabel>Event</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                const hasChildren = "children" in item && item.children;
                const isChildActive = hasChildren && item.children!.some(c => location === c.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive || isChildActive || undefined}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {hasChildren && (
                      <SidebarMenuSub>
                        {item.children!.map(child => (
                          <SidebarMenuSubItem key={child.title}>
                            <SidebarMenuSubButton asChild data-active={location === child.url || undefined}>
                              <Link href={child.url} data-testid={`nav-${child.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                <child.icon className="h-3.5 w-3.5" />
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
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between px-3 pb-3">
          <TbaSyncStatus eventId={eventId} />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleThemeClick}
            className="shrink-0"
            data-testid="button-toggle-theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
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
