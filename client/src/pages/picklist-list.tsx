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
import { Search, ArrowUpDown, ListOrdered, User, Plus, Shield, Swords, Zap } from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { Button } from "@/components/ui/button";
import type { Event } from "@shared/schema";

type PicklistWithStats = {
  id: number;
  eventId: number;
  name: string;
  adminOnly: boolean;
  icon: string | null;
  color: string | null;
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

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      type="button"
      className="flex items-center gap-1 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-300"
      onClick={() => toggleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span>{label}</span>
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-blue-400" : "text-zinc-600"}`} />
    </button>
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const picklistColorClass: Record<"red" | "orange" | "yellow" | "green" | "blue" | "violet", string> = {
    red: "text-red-400",
    orange: "text-orange-400",
    yellow: "text-yellow-400",
    green: "text-emerald-400",
    blue: "text-blue-400",
    violet: "text-violet-400",
  };

  const iconForValue = (v: "sword" | "shield" | "bolt") => {
    if (v === "sword") return Swords;
    if (v === "shield") return Shield;
    return Zap;
  };

  return (
    <div className="min-h-full bg-zinc-950 p-4 sm:p-6 space-y-4 max-w-6xl mx-auto overflow-x-hidden">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search by name or creator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-0 bg-white/5 text-zinc-100 placeholder:text-zinc-600 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0"
            data-testid="input-picklist-search"
          />
        </div>
        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger
            className="w-[180px] border-0 bg-white/5 text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus:ring-2 focus:ring-blue-500/35"
            data-testid="select-sort-field"
          >
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="createdBy">Created By</SelectItem>
            <SelectItem value="createdAt">Created</SelectItem>
          </SelectContent>
        </Select>
        {/* Alliance sim hidden for now */}
        <Link href={`/events/${eventId}/picklist?new=1`}>
          <Button className="bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-black/25" data-testid="button-new-picklist">
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
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[minmax(14rem,2fr)_minmax(10rem,1fr)_minmax(9rem,auto)] gap-6 px-1">
            <SortableHeader field="name" label="Name" />
            <SortableHeader field="createdBy" label="Created By" />
            <SortableHeader field="createdAt" label="Created" />
          </div>

          <div className="mt-1">
            {filteredPicklists.map((p) => (
              <div key={p.id} className="border-t border-white/10">
                <button
                  type="button"
                  data-testid={`row-picklist-${p.id}`}
                  className="grid w-full grid-cols-[minmax(14rem,2fr)_minmax(10rem,1fr)_minmax(9rem,auto)] items-center gap-6 px-1 py-4 text-left transition-colors hover:bg-white/5"
                  onClick={() => setLocation(`/events/${eventId}/picklist?list=${p.id}`)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {p.icon && p.color && (["red", "orange", "yellow", "green", "blue", "violet"] as const).includes(p.color as any) ? (
                      (() => {
                        const Icon = iconForValue(p.icon as "sword" | "shield" | "bolt");
                        const c = picklistColorClass[p.color as "red" | "orange" | "yellow" | "green" | "blue" | "violet"];
                        return <Icon className={`h-4 w-4 shrink-0 ${c}`} aria-hidden />;
                      })()
                    ) : null}
                    <span className="min-w-0 truncate font-semibold text-zinc-100">{p.name}</span>
                    {p.adminOnly && (
                      <Shield className="h-4 w-4 shrink-0 text-blue-400/90" title="Admin only" />
                    )}
                  </div>

                  <div className="min-w-0">
                    {p.createdBy ? (
                      <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-400">
                        <User className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                        <span className="truncate">{p.createdBy.displayName}</span>
                        {p.createdBy.role === "admin" && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-400/90">Admin</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-500">—</span>
                    )}
                  </div>

                  <div className="text-sm text-zinc-500">{formatDate(p.createdAt)}</div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
