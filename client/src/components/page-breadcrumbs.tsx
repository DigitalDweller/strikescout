import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRight } from "lucide-react";
import type { Event } from "@shared/schema";

/**
 * Breadcrumbs for event pages. Helps users understand where they are and navigate back.
 * Especially helpful for less tech-savvy users who can get lost in nested routes.
 */
export function PageBreadcrumbs() {
  const [location] = useLocation();
  const params = useParams<{ id: string; teamId?: string; otherTeamId?: string; matchNumber?: string; scouterId?: string }>();

  const eventId = params.id ? parseInt(params.id, 10) : 0;
  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!params.id && !isNaN(eventId),
  });

  // Only show breadcrumbs when inside an event
  if (!params.id || location === "/" || location.startsWith("/admin")) {
    return null;
  }

  const eventName = event?.name ?? "Event";
  const basePath = `/events/${params.id}`;

  const crumbs: { label: string; href?: string }[] = [
    { label: eventName, href: basePath },
  ];

  if (location === basePath) {
    crumbs.push({ label: "Overview" });
  } else if (location.includes("/teams/")) {
    if (location.includes("/compare")) {
      crumbs.push({ label: "Teams", href: `${basePath}/teams` });
      crumbs.push({ label: "Compare teams" });
    } else if (location.includes("/notes")) {
      crumbs.push({ label: "Teams", href: `${basePath}/teams` });
      crumbs.push({ label: "Team notes" });
    } else {
      crumbs.push({ label: "Teams", href: `${basePath}/teams` });
      crumbs.push({ label: "Team profile" });
    }
  } else if (location.includes("/schedule/") && params.matchNumber) {
    crumbs.push({ label: "Matches", href: `${basePath}/schedule` });
    crumbs.push({ label: `Match ${params.matchNumber}` });
  } else if (location.includes("/scout/history")) {
    crumbs.push({ label: "Scouting", href: `${basePath}/scout` });
    crumbs.push({ label: "Form history" });
  } else if (location.includes("/scout")) {
    crumbs.push({ label: "Scouting form" });
  } else if (location.includes("/schedule")) {
    crumbs.push({ label: "Matches" });
  } else if (location.includes("/simulator")) {
    crumbs.push({ label: "Matches", href: `${basePath}/schedule` });
    crumbs.push({ label: "Match simulator" });
  } else if (location.includes("/data")) {
    crumbs.push({ label: "Data management" });
  } else if (location.includes("/settings")) {
    crumbs.push({ label: "Settings" });
  } else if (location.includes("/picklists")) {
    crumbs.push({ label: "Picklists" });
  } else if (location.includes("/picklist")) {
    crumbs.push({ label: "Picklists", href: `${basePath}/picklists` });
    crumbs.push({ label: "Picklist" });
  } else if (location.includes("/scouters/") && params.scouterId) {
    crumbs.push({ label: "Scouter Leaderboard", href: `${basePath}/scouters` });
    crumbs.push({ label: "Scouter profile" });
  } else if (location.includes("/scouters")) {
    crumbs.push({ label: "Scouter Leaderboard" });
  }

  if (crumbs.length <= 1) return null;

  return (
    <Breadcrumb className="mb-3 px-1 -mx-1">
      <BreadcrumbList className="text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="contents">
            {i > 0 && (
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </BreadcrumbSeparator>
            )}
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href} className="text-muted-foreground hover:text-foreground">
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
