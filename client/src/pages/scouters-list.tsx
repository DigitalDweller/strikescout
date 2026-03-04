import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, User as UserIcon, Award } from "lucide-react";
import { getHeatColor } from "@/lib/team-colors";
import type { Event } from "@shared/schema";

interface ScouterRow {
  id: number;
  displayName: string;
  entryCount: number;
}

export default function ScoutersList() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: scouters, isLoading } = useQuery<ScouterRow[]>({
    queryKey: ["/api/events", eventId, "scouters"],
    enabled: !!eventId,
  });

  const filtered = useMemo(() => {
    const list = (scouters || []).filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.displayName.toLowerCase().includes(q);
    });
    return list;
  }, [scouters, search]);

  const rpRange = useMemo(() => {
    if (filtered.length === 0) return { min: 0, max: 0 };
    const rps = filtered.map(s => s.entryCount);
    return { min: Math.min(...rps), max: Math.max(...rps) };
  }, [filtered]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-scouters-title">
          Scouter Profiles
        </h1>
        <p className="text-muted-foreground text-base mt-1">
          {event ? `${event.name} — ${filtered.length} scouters` : "Loading..."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-scouters"
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <UserIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No scouters found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {scouters?.length === 0
                ? "No scouters have been added yet. Admins can create scouter accounts in User Management."
                : "No scouters match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-bold">Scouter</TableHead>
                    <TableHead className="text-center text-sm font-bold">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">
                            RP
                            <Award className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Ranking Points — earned from scouting (1 per entry)
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(scouter => {
                    const rp = scouter.entryCount;
                    const rpColor = rpRange.max > 0
                      ? getHeatColor(rp, rpRange.min, rpRange.max)
                      : "";
                    return (
                      <TableRow
                        key={scouter.id}
                        data-testid={`row-scouter-${scouter.id}`}
                        className="h-12 cursor-pointer hover:bg-accent/50"
                        onClick={() => navigate(`/events/${eventId}/scouters/${scouter.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
                              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="font-bold text-base">{scouter.displayName}</span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-center font-bold text-base ${rpColor}`}
                          data-testid={`stat-rp-${scouter.id}`}
                        >
                          {rp}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {user && (
        <div className="pt-2">
          <Link href={`/events/${eventId}/scouters/${user.id}`}>
            <button className="text-sm font-medium text-primary hover:underline">
              View my profile
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
