import { useState, useRef, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import type { EventTeam, Team } from "@shared/schema";
import { getTeamDominantColor } from "@/lib/team-colors";
import type { StatRanges, TbaRanges, TeamStats } from "@/lib/team-colors";

export function TeamSearchInput({
  eventTeams,
  selectedTeamId,
  onSelectTeam,
  placeholder,
  excludeTeamId = null,
  excludeTeamIds = null,
  teamStats = null,
  statRanges = null,
  tbaRanges = null,
  "data-testid": testId,
}: {
  eventTeams: (EventTeam & { team: Team })[];
  selectedTeamId: number | null;
  onSelectTeam: (teamId: number) => void;
  placeholder: string;
  excludeTeamId?: number | null;
  excludeTeamIds?: number[] | null;
  teamStats?: Map<number, TeamStats> | null;
  statRanges?: StatRanges | null;
  tbaRanges?: TbaRanges | null;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTeam = eventTeams.find((et) => et.teamId === selectedTeamId);

  const filtered = useMemo(() => {
    let list = eventTeams.filter((et) => {
      if (excludeTeamIds?.length && excludeTeamIds.includes(et.teamId)) return false;
      if (excludeTeamId != null && et.teamId === excludeTeamId) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        et.team.teamNumber.toString().includes(q) ||
        et.team.teamName.toLowerCase().includes(q)
      );
    });
    // Sort by seed (rank) ascending — lower rank first; teams without rank at end
    list = [...list].sort((a, b) => {
      const rankA = (a as any).rank ?? 9999;
      const rankB = (b as any).rank ?? 9999;
      return rankA - rankB;
    });
    return list;
  }, [eventTeams, excludeTeamId, excludeTeamIds, search]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const displayValue = selectedTeam
    ? `${selectedTeam.team.teamNumber} — ${selectedTeam.team.teamName}`
    : "";

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 h-10 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        data-testid={testId}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder={placeholder}
          value={open ? search : (selectedTeam ? displayValue : "")}
          readOnly={!open}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setSearch("");
              inputRef.current?.blur();
            }
            if (e.key === "Enter" && filtered.length === 1) {
              onSelectTeam(filtered[0].teamId);
              setSearch("");
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto min-w-[200px]">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No teams found
            </div>
          ) : (
            filtered.map((et) => {
              const { bg: ratingColor } = getTeamDominantColor(
                et.teamId,
                eventTeams,
                teamStats ?? new Map(),
                statRanges,
                tbaRanges
              );
              return (
                <div
                  key={et.teamId}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:opacity-90 ${ratingColor || ""} ${et.teamId === selectedTeamId ? "ring-1 ring-ring" : ""}`}
                  data-selected={et.teamId === selectedTeamId}
                  onClick={() => {
                    onSelectTeam(et.teamId);
                    setSearch("");
                    setOpen(false);
                  }}
                  data-testid={testId ? `${testId}-option-${et.team.teamNumber}` : undefined}
                >
                  <span className="font-bold">{et.team.teamNumber}</span>
                  <span className="truncate">{et.team.teamName}</span>
                  {(et as any).rank != null && (
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">#{((et as any).rank as number)}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
