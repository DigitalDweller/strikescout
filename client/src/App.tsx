import { useEffect, useRef } from "react";
import { Switch, Route, useParams, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useEventUpdates } from "@/hooks/use-event-updates";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { SiteFlipProvider, useSiteFlip } from "@/contexts/site-flip";
import { RufflesProvider } from "@/contexts/ruffles";
import { DraggableRuffles } from "@/components/draggable-ruffles";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminEvents from "@/pages/admin-events";
import AdminEventDetail from "@/pages/admin-event-detail";
import UserManagement from "@/pages/user-management";
import TeamProfile from "@/pages/team-profile";
import TeamList from "@/pages/team-list";
import Schedule from "@/pages/schedule";
import ScoutForm from "@/pages/scout-form";
import TeamNotes from "@/pages/team-notes";
import FormHistory from "@/pages/form-history";
import DataManagement from "@/pages/data-management";
import MatchDetail from "@/pages/match-detail";
import EventSettings from "@/pages/event-settings";
import Picklist from "@/pages/picklist";
import PlayoffPredictor from "@/pages/playoff-predictor";
import { Loader2 } from "lucide-react";

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

function RotatingBanner() {
  return (
    <p className="text-xs text-muted-foreground truncate" style={{ lineHeight: "1.25rem" }}>
      Strikescout — FRC scouting made simple
    </p>
  );
}

function ScouterRedirect() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(`/events/${params.id}/scout`, { replace: true });
  }, [params.id, setLocation]);
  return null;
}

function EventLayout() {
  const params = useParams<{ id: string }>();
  const [location] = useLocation();
  const { user } = useAuth();
  const eventId = parseInt(params.id || "0");
  const mainRef = useRef<HTMLElement>(null);
  const isAdmin = user?.role === "admin";

  useEventUpdates(eventId);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar eventId={eventId} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0 overflow-hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <RotatingBanner />
          </header>
          <main ref={mainRef} className="flex-1 overflow-x-hidden overflow-y-auto">
            <ScrollToTop containerRef={mainRef} />
            <PageTransition key={location} className="h-full">
            {isAdmin ? (
              <Switch>
                <Route path="/events/:id" component={AdminEventDetail} />
                <Route path="/events/:id/scout" component={ScoutForm} />
                <Route path="/events/:id/scout/history" component={FormHistory} />
                <Route path="/events/:id/data" component={DataManagement} />
                <Route path="/events/:id/teams" component={TeamList} />
                <Route path="/events/:id/schedule" component={Schedule} />
                <Route path="/events/:id/schedule/:matchNumber" component={MatchDetail} />
                <Route path="/events/:id/settings" component={EventSettings} />
                <Route path="/events/:id/picklist" component={Picklist} />
                <Route path="/events/:id/playoff-predictor" component={PlayoffPredictor} />
                <Route path="/events/:id/teams/:teamId" component={TeamProfile} />
                <Route path="/events/:id/teams/:teamId/notes" component={TeamNotes} />
                <Route component={NotFound} />
              </Switch>
            ) : (
              <Switch>
                <Route path="/events/:id/scout" component={ScoutForm} />
                <Route path="/events/:id/scout/history" component={FormHistory} />
                <Route path="/events/:id" component={ScouterRedirect} />
                <Route component={ScouterRedirect} />
              </Switch>
            )}
            </PageTransition>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { flipped } = useSiteFlip();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-200 dark:bg-zinc-900">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        transform: flipped ? "rotate(180deg)" : undefined,
        transition: "transform 0.6s ease",
      }}
    >
      <Switch>
        <Route path="/" component={AdminEvents} />
        <Route path="/admin/users" component={UserManagement} />
        <Route path="/events/:id/*?" component={EventLayout} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <SiteFlipProvider>
              <RufflesProvider>
                <Toaster />
                <AppContent />
                <DraggableRuffles />
              </RufflesProvider>
            </SiteFlipProvider>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
