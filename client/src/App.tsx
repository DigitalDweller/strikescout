import { useEffect, useRef } from "react";
import { Switch, Route, useParams, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import AdminEvents from "@/pages/admin-events";
import AdminEventDetail from "@/pages/admin-event-detail";
import TeamProfile from "@/pages/team-profile";
import TeamList from "@/pages/team-list";
import Schedule from "@/pages/schedule";
import ScoutForm from "@/pages/scout-form";
import TeamNotes from "@/pages/team-notes";
import FormHistory from "@/pages/form-history";
import DataManagement from "@/pages/data-management";
import MatchDetail from "@/pages/match-detail";
import EventSettings from "@/pages/event-settings";

function ScrollToTop({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const [location] = useLocation();
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);
  return null;
}

function EventLayout() {
  const params = useParams<{ id: string }>();
  const eventId = parseInt(params.id || "0");
  const mainRef = useRef<HTMLElement>(null);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar eventId={eventId} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-2 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main ref={mainRef} className="flex-1 overflow-auto">
            <ScrollToTop containerRef={mainRef} />
            <Switch>
              <Route path="/events/:id" component={AdminEventDetail} />
              <Route path="/events/:id/scout" component={ScoutForm} />
              <Route path="/events/:id/scout/history" component={FormHistory} />
              <Route path="/events/:id/data" component={DataManagement} />
              <Route path="/events/:id/teams" component={TeamList} />
              <Route path="/events/:id/schedule" component={Schedule} />
              <Route path="/events/:id/schedule/:matchNumber" component={MatchDetail} />
              <Route path="/events/:id/settings" component={EventSettings} />
              <Route path="/events/:id/teams/:teamId" component={TeamProfile} />
              <Route path="/events/:id/teams/:teamId/notes" component={TeamNotes} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/" component={AdminEvents} />
            <Route path="/events/:id/*?" component={EventLayout} />
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
