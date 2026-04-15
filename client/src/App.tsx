import { useEffect, useRef } from "react";
import { Switch, Route, useParams, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppUpdatesProvider } from "@/contexts/app-updates";
import { EventUpdatesProvider } from "@/contexts/event-updates";
import { HelpProvider } from "@/contexts/help-context";
import { PageBreadcrumbs } from "@/components/page-breadcrumbs";
import { HeaderHelpButton } from "@/components/header-help-button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { SiteFlipProvider, useSiteFlip } from "@/contexts/site-flip";
import { RufflesProvider } from "@/contexts/ruffles";
import { DraggableRuffles } from "@/components/draggable-ruffles";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import AdminEvents from "@/pages/admin-events";
import AdminEventDetail from "@/pages/admin-event-detail";
import UserManagement from "@/pages/user-management";
import TeamProfile from "@/pages/team-profile";
import TeamCompare from "@/pages/team-compare";
import TeamList from "@/pages/team-list";
import Schedule from "@/pages/schedule";
import ScoutForm from "@/pages/scout-form";
import PitScoutForm from "@/pages/pit-scout-form";
import TeamNotes from "@/pages/team-notes";
import FormHistory from "@/pages/form-history";
import DataManagement from "@/pages/data-management";
import MatchDetail from "@/pages/match-detail";
import MatchSimulator from "@/pages/match-simulator";
import EventSettings from "@/pages/event-settings";
import Picklist from "@/pages/picklist";
import PicklistList from "@/pages/picklist-list";
import AllianceSimPage from "@/pages/alliance-sim";
import ScouterLeaderboard from "@/pages/scouter-leaderboard";
import ScouterProfile from "@/pages/scouter-profile";
import ScoutingSchedule from "@/pages/scouting-schedule";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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


function ScouterRedirect() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(`/events/${params.id}/scouting-schedule`, { replace: true });
  }, [params.id, setLocation]);
  return null;
}

function DemoRedirectToTeams() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (params.id) setLocation(`/events/${params.id}/teams`, { replace: true });
  }, [params.id, setLocation]);
  return null;
}

function EventLayout() {
  const params = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const eventId = parseInt(params.id || "0");
  const mainRef = useRef<HTMLElement>(null);
  const isAdmin = user?.role === "admin";
  const isDemo = user?.role === "demo";

  useEffect(() => {
    if (!isDemo || user?.demoEventId == null || !Number.isFinite(eventId)) return;
    if (eventId !== user.demoEventId) {
      setLocation(`/events/${user.demoEventId}/teams`, { replace: true });
    }
  }, [isDemo, user?.demoEventId, eventId, setLocation]);

  return (
    <EventUpdatesProvider eventId={eventId}>
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar eventId={eventId} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0 overflow-hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <p className="text-xs text-muted-foreground">Strikescout v1.0.15</p>
            <div className="flex-1 min-w-0" />
            <HeaderHelpButton />
          </header>
          <main ref={mainRef} className="flex-1 overflow-x-hidden overflow-y-auto">
            <ScrollToTop containerRef={mainRef} />
            <div className="px-4 sm:px-6 pt-4 sm:pt-6">
              <PageBreadcrumbs />
            </div>
            <PageTransition key={location} className="h-full">
            {isAdmin ? (
              <Switch>
                <Route path="/events/:id" component={AdminEventDetail} />
                <Route path="/events/:id/scout" component={ScoutForm} />
                <Route path="/events/:id/pit-scout" component={PitScoutForm} />
                <Route path="/events/:id/scout/history" component={FormHistory} />
                <Route path="/events/:id/data" component={DataManagement} />
                <Route path="/events/:id/teams" component={TeamList} />
                <Route path="/events/:id/schedule" component={Schedule} />
                <Route path="/events/:id/schedule/:matchNumber" component={MatchDetail} />
                <Route path="/events/:id/scouting-schedule" component={ScoutingSchedule} />
                <Route path="/events/:id/simulator" component={MatchSimulator} />
                <Route path="/events/:id/settings" component={EventSettings} />
                <Route path="/events/:id/picklists" component={PicklistList} />
                <Route path="/events/:id/picklist" component={Picklist} />
                <Route path="/events/:id/alliance-sim" component={AllianceSimPage} />
                <Route path="/events/:id/teams/:teamId" component={TeamProfile} />
                <Route path="/events/:id/teams/:teamId/compare/:otherTeamId?" component={TeamCompare} />
                <Route path="/events/:id/teams/:teamId/notes" component={TeamNotes} />
                <Route path="/events/:id/scouters/:scouterId" component={ScouterProfile} />
                <Route path="/events/:id/scouters" component={ScouterLeaderboard} />
                <Route component={NotFound} />
              </Switch>
            ) : isDemo ? (
              <Switch>
                <Route path="/events/:id/teams/:teamId/compare/:otherTeamId?" component={DemoRedirectToTeams} />
                <Route path="/events/:id/teams/:teamId/notes" component={DemoRedirectToTeams} />
                <Route path="/events/:id/teams/:teamId" component={TeamProfile} />
                <Route path="/events/:id/schedule/:matchNumber" component={MatchDetail} />
                <Route path="/events/:id/schedule" component={Schedule} />
                <Route path="/events/:id/simulator" component={MatchSimulator} />
                <Route path="/events/:id/teams" component={TeamList} />
                <Route path="/events/:id" component={DemoRedirectToTeams} />
                <Route component={DemoRedirectToTeams} />
              </Switch>
            ) : (
              <Switch>
                <Route path="/events/:id/scouting-schedule" component={ScoutingSchedule} />
                <Route path="/events/:id/scout" component={ScoutForm} />
                <Route path="/events/:id/pit-scout" component={PitScoutForm} />
                <Route path="/events/:id/scout/history" component={FormHistory} />
                <Route path="/events/:id/picklists" component={PicklistList} />
                <Route path="/events/:id/picklist" component={Picklist} />
                <Route path="/events/:id/alliance-sim" component={AllianceSimPage} />
                <Route path="/events/:id/scouters/:scouterId" component={ScouterProfile} />
                <Route path="/events/:id/scouters" component={ScouterLeaderboard} />
                <Route path="/events/:id" component={ScouterRedirect} />
                <Route component={ScouterRedirect} />
              </Switch>
            )}
            </PageTransition>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </EventUpdatesProvider>
  );
}

function AuthenticatedRedirect() {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (location === "/login") {
      setLocation("/", { replace: true });
    }
  }, [location, setLocation]);
  return null;
}

function RedirectTo({ path }: { path: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(path, { replace: true });
  }, [path, setLocation]);
  return null;
}

/** When an admin changes the org season, SSE triggers this so every tab returns to the dashboard. */
function SeasonChangeRedirect() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    const handler = () => {
      if (user?.role === "demo" && user.demoEventId != null) {
        setLocation(`/events/${user.demoEventId}/teams`, { replace: true });
      } else {
        setLocation("/");
      }
    };
    window.addEventListener("strikescout:season-changed", handler);
    return () => window.removeEventListener("strikescout:season-changed", handler);
  }, [setLocation, user?.role, user?.demoEventId]);
  return null;
}

function DemoNoEventAssigned() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
      <p className="text-muted-foreground text-center max-w-md">
        This demo account is not linked to a competition yet. Ask an admin to assign a comp in User Management.
      </p>
      <Button variant="outline" onClick={() => logout()}>
        Sign out
      </Button>
    </div>
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
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <AppUpdatesProvider>
      <div
        style={{
          minHeight: "100vh",
          transform: flipped ? "rotate(180deg)" : undefined,
          transition: "transform 0.6s ease",
        }}
      >
        <SeasonChangeRedirect />
        <AuthenticatedRedirect />
        <Switch>
          <Route path="/login">
            <RedirectTo path="/" />
          </Route>
          <Route path="/">
            {user?.role === "demo" ? (
              user.demoEventId != null ? (
                <RedirectTo path={`/events/${user.demoEventId}/teams`} />
              ) : (
                <DemoNoEventAssigned />
              )
            ) : (
              <AdminEvents />
            )}
          </Route>
          <Route path="/admin/users" component={UserManagement} />
          <Route path="/events/:id/*?" component={EventLayout} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </AppUpdatesProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <HelpProvider>
            <SiteFlipProvider>
              <RufflesProvider>
                <Toaster />
                <AppContent />
                <DraggableRuffles />
              </RufflesProvider>
            </SiteFlipProvider>
            </HelpProvider>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
