import { useEffect } from "react";
import { queryClient, API_BASE } from "@/lib/queryClient";

const CHANNEL_ENTRIES = "entries";

/**
 * Subscribe to server-sent events for an event. When a scouter (or anyone) submits
 * or edits entries, the server broadcasts; we invalidate event data so admin tabs refetch.
 */
export function useEventUpdates(eventId: number) {
  useEffect(() => {
    if (!eventId || !Number.isFinite(eventId)) return;

    const url = `${API_BASE}/api/events/${eventId}/updates`;
    const es = new EventSource(url);

    const onMessage = (e: MessageEvent) => {
      if (e.data === CHANNEL_ENTRIES) {
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
}
