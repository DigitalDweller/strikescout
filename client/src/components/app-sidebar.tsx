import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { Event } from "@shared/schema";

function TbaSyncStatus({ eventId }: { eventId: number }) {
  const { data } = useQuery<{ enabled: boolean; syncing: boolean; lastSyncTime: number | null }>({
    queryKey: ["/api/events", eventId, "tba", "sync-status"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/tba/sync-status`);
      if (!res.ok) return { enabled: false, syncing: false, lastSyncTime: null };
      return res.json();
    },
    refetchInterval: 15000,
  });

  if (!data?.enabled) return null;

  const now = Date.now();
  const lastSync = data.lastSyncTime;
  const ageMs = lastSync ? now - lastSync : null;

  let dotClass = "bg-muted-foreground/50";
  let statusText = "Not synced yet";

  if (data.syncing) {
    dotClass = "bg-yellow-400 animate-pulse";
    statusText = "Syncing...";
  } else if (ageMs !== null) {
    if (ageMs < 60_000) {
      dotClass = "bg-green-500";
      statusText = "Up to date";
    } else if (ageMs < 5 * 60_000) {
      dotClass = "bg-muted-foreground/50";
      const mins = Math.floor(ageMs / 60_000);
      statusText = `${mins}m ago`;
    } else {
      dotClass = "bg-muted-foreground/30";
      const mins = Math.floor(ageMs / 60_000);
      statusText = `${mins}m ago`;
    }
  }

  const timeLabel = lastSync
    ? new Date(lastSync).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="mx-3 mb-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5" data-testid="widget-tba-sync">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">TBA Sync</span>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
          <span className="text-[11px] font-medium text-muted-foreground">{statusText}</span>
        </div>
      </div>
      {timeLabel && !data.syncing && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 text-right">Last: {timeLabel}</p>
      )}
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
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("Failed to load event");
      return res.json();
    },
  });

  const navItems = [
    { title: "Leaderboard", url: `/events/${eventId}`, icon: LayoutDashboard },
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
        <TbaSyncStatus eventId={eventId} />
        <div className="flex items-center justify-end px-3 pb-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleThemeClick}
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
