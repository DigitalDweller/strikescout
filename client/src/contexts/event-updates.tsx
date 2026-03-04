import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { queryClient, API_BASE } from "@/lib/queryClient";

const CHANNEL_ENTRIES = "entries";

interface EventUpdatesContextValue {
  hasUnseenUpdates: boolean;
  markSynced: () => void;
}

const EventUpdatesContext = createContext<EventUpdatesContextValue | null>(null);

export function useEventUpdatesIndicator() {
  const ctx = useContext(EventUpdatesContext);
  if (!ctx) {
    return { hasUnseenUpdates: false, markSynced: () => {} };
  }
  return ctx;
}

interface EventUpdatesProviderProps {
  eventId: number;
  children: React.ReactNode;
}

/**
 * Subscribe to server-sent events for an event. When scouting entries or DB data changes,
 * we invalidate queries and set hasUnseenUpdates so the UI can show a "sync needed" indicator.
 */
export function EventUpdatesProvider({ eventId, children }: EventUpdatesProviderProps) {
  const [hasUnseenUpdates, setHasUnseenUpdates] = useState(false);
  const markSynced = useCallback(() => setHasUnseenUpdates(false), []);

  useEffect(() => {
    if (!eventId || !Number.isFinite(eventId)) return;

    const url = `${API_BASE}/api/events/${eventId}/updates`;
    const es = new EventSource(url);

    const onMessage = (e: MessageEvent) => {
      if (e.data === CHANNEL_ENTRIES) {
        setHasUnseenUpdates(true);
        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey.some((k) =>
              typeof k === "string" && k.includes(`/events/${eventId}`)
            ),
        });
      }
    };

    es.addEventListener("message", onMessage);
    return () => {
      es.removeEventListener("message", onMessage);
      es.close();
    };
  }, [eventId]);

  const value: EventUpdatesContextValue = { hasUnseenUpdates, markSynced };

  return (
    <EventUpdatesContext.Provider value={value}>
      {children}
    </EventUpdatesContext.Provider>
  );
}
