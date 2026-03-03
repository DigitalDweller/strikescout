import { EventEmitter } from "events";

/** Emit eventId when scouting entries (or other event data) change so SSE clients can refetch. */
export const eventBroadcast = new EventEmitter();
eventBroadcast.setMaxListeners(100);

export const CHANNEL_ENTRIES = "entries";

export function notifyEntriesUpdated(eventId: number): void {
  eventBroadcast.emit(CHANNEL_ENTRIES, eventId);
}
