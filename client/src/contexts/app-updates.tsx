import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { queryClient, API_BASE } from "@/lib/queryClient";
import { shouldSuppressEventData } from "@/lib/suppress-updates";

interface AppUpdatesContextValue {
  unseenEventIds: Set<number>;
  markSyncedForEvent: (eventId: number) => void;
}

const AppUpdatesContext = createContext<AppUpdatesContextValue | null>(null);

export function useEventUpdatesIndicator(eventId: number) {
  const ctx = useContext(AppUpdatesContext);
  if (!ctx) {
    return { hasUnseenUpdates: false, markSynced: () => {} };
  }
  return {
    hasUnseenUpdates: ctx.unseenEventIds.has(eventId),
    markSynced: useCallback(() => ctx.markSyncedForEvent(eventId), [ctx, eventId]),
  };
}

interface AppUpdatesProviderProps {
  children: React.ReactNode;
}

/**
 * App-level SSE subscription. Connects to /api/updates and invalidates queries when
 * event data or events list changes. Provides useEventUpdatesIndicator for sync indicator.
 */
export function AppUpdatesProvider({ children }: AppUpdatesProviderProps) {
  const [unseenEventIds, setUnseenEventIds] = useState<Set<number>>(new Set());

  const markSyncedForEvent = useCallback((eventId: number) => {
    setUnseenEventIds((prev) => {
      if (!prev.has(eventId)) return prev;
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
  }, []);

  useEffect(() => {
    const url = `${API_BASE}/api/updates`;
    const es = new EventSource(url);

    const onMessage = (e: MessageEvent) => {
      const data = e.data as string;
      if (data.startsWith("event:")) {
        const eventId = parseInt(data.slice(6), 10);
        if (Number.isFinite(eventId)) {
          if (!shouldSuppressEventData(eventId)) {
            setUnseenEventIds((prev) => new Set(prev).add(eventId));
          }

          queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
          queryClient.invalidateQueries({
            predicate: (query) =>
              query.queryKey.some(
                (k) => typeof k === "string" && k.includes(`/events/${eventId}`)
              ),
          });
        }
      } else if (data === "events") {
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/active-event"] });
      }
    };

    es.addEventListener("message", onMessage);
    return () => {
      es.removeEventListener("message", onMessage);
      es.close();
    };
  }, []);

  const value: AppUpdatesContextValue = { unseenEventIds, markSyncedForEvent };

  return (
    <AppUpdatesContext.Provider value={value}>
      {children}
    </AppUpdatesContext.Provider>
  );
}
