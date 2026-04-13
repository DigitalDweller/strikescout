/** Suppress "unseen updates" when our own mutations trigger SSE. */
const WINDOW_MS = 2000;
const suppressUntil: { event: Record<number, number>; eventsList: number } = {
  event: {},
  eventsList: 0,
};

export function suppressEventDataUpdate(eventId: number): void {
  suppressUntil.event[eventId] = Date.now() + WINDOW_MS;
}

export function suppressEventsListUpdate(): void {
  suppressUntil.eventsList = Date.now() + WINDOW_MS;
}

export function shouldSuppressEventData(eventId: number): boolean {
  return (suppressUntil.event[eventId] || 0) > Date.now();
}

export function shouldSuppressEventsList(): boolean {
  return suppressUntil.eventsList > Date.now();
}
