import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { Event } from "@shared/schema";

export function AppSidebar({ eventId }: { eventId: number }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("Failed to load event");
      return res.json();
    },
  });

  const navItems = [
    { title: "Overview", url: `/events/${eventId}`, icon: LayoutDashboard },
    { title: "Scout", url: `/events/${eventId}/scout`, icon: ClipboardList },
    { title: "Teams", url: `/events/${eventId}/teams`, icon: Users },
    { title: "Schedule", url: `/events/${eventId}/schedule`, icon: CalendarDays },
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
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive || undefined}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-end p-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-toggle-theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
