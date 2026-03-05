import { EventEmitter } from "events";

/** Emit when event data or events list changes so SSE clients can refetch. */
export const eventBroadcast = new EventEmitter();
eventBroadcast.setMaxListeners(100);

/** Emitted with eventId when any event-scoped data changes (entries, teams, schedule, picklists, etc.). */
export const CHANNEL_EVENT_DATA = "event";
/** Emitted when the events list or active event changes. */
export const CHANNEL_EVENTS_LIST = "events";

/** Notify that event-scoped data changed (entries, teams, schedule, picklists, OPRs, etc.). */
export function notifyEventDataUpdated(eventId: number): void {
  eventBroadcast.emit(CHANNEL_EVENT_DATA, eventId);
}

/** Notify that the events list or active event changed. */
export function notifyEventsListUpdated(): void {
  eventBroadcast.emit(CHANNEL_EVENTS_LIST);
}

/** @deprecated Use notifyEventDataUpdated. Kept for compatibility during migration. */
export function notifyEntriesUpdated(eventId: number): void {
  notifyEventDataUpdated(eventId);
}
