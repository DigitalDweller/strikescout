import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, ListOrdered, User, Plus, Shield } from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { Button } from "@/components/ui/button";
import type { Event } from "@shared/schema";

type PicklistWithStats = {
  id: number;
  eventId: number;
  name: string;
  adminOnly: boolean;
  createdById: number | null;
  createdAt: string;
  createdBy?: { id: number; displayName: string; role: string };
  entryCount: number;
};

type SortField = "name" | "createdBy" | "createdAt";
type SortDir = "asc" | "desc";

export default function PicklistList() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const help = useHelp();
  const [search, _setSearch] = useState(() => sessionStorage.getItem(`picklists-search-${eventId}`) || "");
  const [sortField, _setSortField] = useState<SortField>(() => (sessionStorage.getItem(`picklists-sort-${eventId}`) as SortField) || "name");
  const [sortDir, _setSortDir] = useState<SortDir>(() => (sessionStorage.getItem(`picklists-dir-${eventId}`) as SortDir) || "asc");

  const setSearch = useCallback((v: string) => { sessionStorage.setItem(`picklists-search-${eventId}`, v); _setSearch(v); }, [eventId]);
  const setSortField = useCallback((v: SortField) => { sessionStorage.setItem(`picklists-sort-${eventId}`, v); _setSortField(v); }, [eventId]);
  const setSortDir = useCallback((v: SortDir) => { sessionStorage.setItem(`picklists-dir-${eventId}`, v); _setSortDir(v); }, [eventId]);

  const { data: event } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const { data: picklists = [], isLoading: picklistsLoading } = useQuery<PicklistWithStats[]>({
    queryKey: ["/api/events", eventId, "picklists"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/picklists`);
      if (!res.ok) throw new Error("Failed to fetch picklists");
      return res.json();
    },
    enabled: !!eventId,
  });

  const filteredPicklists = useMemo(() => {
    let list = picklists.filter((p) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.createdBy?.displayName.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      let valA: number | string | boolean;
      let valB: number | string | boolean;

      switch (sortField) {
        case "name": valA = a.name; valB = b.name; break;
        case "createdBy": valA = a.createdBy?.displayName ?? ""; valB = b.createdBy?.displayName ?? ""; break;
        case "createdAt": valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
        default: valA = a.name; valB = b.name;
      }

      let cmp = 0;
      if (valA < valB) cmp = -1;
      else if (valA > valB) cmp = 1;

      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [picklists, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => toggleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`} />
      </span>
    </TableHead>
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          Picklists
          {help?.HelpTrigger?.({
            content: {
              title: "Picklists",
              body: <p>All picklists at this event. Sort by any column. Click a row to open and edit. Use search to find by name or creator.</p>,
            },
          })}
        </h1>
        <p className="text-muted-foreground text-base mt-1">
          {event ? `Picklists at ${event.name}` : "Loading..."} — {filteredPicklists.length} lists
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or creator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-picklist-search"
          />
        </div>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="w-[180px]" data-testid="select-sort-field">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="createdBy">Created By</SelectItem>
            <SelectItem value="createdAt">Created</SelectItem>
          </SelectContent>
        </Select>
        <Link href={`/events/${eventId}/picklist`}>
          <Button data-testid="button-new-picklist">
            <Plus className="h-4 w-4 mr-2" />
            New picklist
          </Button>
        </Link>
      </div>

      {picklistsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : filteredPicklists.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ListOrdered className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No picklists found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search term" : "Create your first picklist to rank teams for alliance selection."}
            </p>
            {!search && (
              <Link href={`/events/${eventId}/picklist`}>
                <Button className="mt-4" data-testid="button-create-first-picklist">
                  <Plus className="h-4 w-4 mr-2" />
                  Create picklist
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="name">Name</SortableHeader>
                    <SortableHeader field="createdBy">Created By</SortableHeader>
                    <SortableHeader field="createdAt">Created</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPicklists.map((p) => (
                    <TableRow
                      key={p.id}
                      data-testid={`row-picklist-${p.id}`}
                      className="h-12 cursor-pointer hover:bg-accent/50"
                      onClick={() => setLocation(`/events/${eventId}/picklist?list=${p.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ListOrdered className="h-4 w-4" />
                          </div>
                          <span className="font-semibold">{p.name}</span>
                          {p.adminOnly && (
                            <Shield className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" title="Admin only" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.createdBy ? (
                          <span className="flex items-center gap-1.5 text-sm">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            {p.createdBy.displayName}
                            {p.createdBy.role === "admin" && (
                              <span className="inline-flex items-center gap-0.5 rounded px-1 py-0 text-[10px] font-medium text-blue-600 dark:text-blue-400">Admin</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(p.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
