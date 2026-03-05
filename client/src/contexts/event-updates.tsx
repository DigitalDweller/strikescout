import { createContext, useContext } from "react";
import { useEventUpdatesIndicator as useAppEventUpdatesIndicator } from "./app-updates";

const EventUpdatesContext = createContext<ReturnType<typeof useAppEventUpdatesIndicator> | null>(null);

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
 * Provides sync indicator for the current event. Consumes from AppUpdatesProvider.
 * Must be mounted inside AppUpdatesProvider.
 */
export function EventUpdatesProvider({ eventId, children }: EventUpdatesProviderProps) {
  const value = useAppEventUpdatesIndicator(eventId);

  return (
    <EventUpdatesContext.Provider value={value}>
      {children}
    </EventUpdatesContext.Provider>
  );
}
