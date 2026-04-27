import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { suppressEventDataUpdate, suppressEventsListUpdate } from "./suppress-updates";

/** Optional API origin when frontend is served from a different host (e.g. Vite on :5173, API on :5000). */
function computeApiBase(): string {
  const raw =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_ORIGIN) || "";
  if (!raw) return "";

  // If someone set VITE_API_ORIGIN to localhost for local dev, that breaks when opening
  // the app from another device (iPhone/iPad) on the LAN. In that case, reuse the
  // current page hostname with the configured port/protocol.
  try {
    const u = new URL(raw, typeof window !== "undefined" ? window.location.origin : undefined);
    if (
      typeof window !== "undefined" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
      window.location.hostname &&
      window.location.hostname !== u.hostname
    ) {
      u.hostname = window.location.hostname;
    }
    return u.origin;
  } catch {
    return raw;
  }
}

export const API_BASE = computeApiBase();

async function throwIfResNotOk(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    await res.text();
    throw new Error(
      "Server returned a page instead of JSON. Run the app with `npm run dev` from the project root so the API and client use the same server."
    );
  }
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const json = JSON.parse(text);
      if (typeof json?.message === "string") message = json.message;
    } catch {
      message = text || res.statusText;
    }
    throw new Error(message);
  }
}

/** Call before mutations so our own changes don't light the "out of sync" indicator. */
function maybeSuppressUpdates(method: string, url: string, data?: unknown, options?: { eventId?: number }): void {
  if (method === "GET") return;
  const path = url.replace(/^\//, "").replace(/\?.*$/, "");
  const matchEventId = path.match(/^api\/events\/(\d+)/);

  if (path === "api/events" && method === "POST") {
    suppressEventsListUpdate();
  } else if (path === "api/selected-season" && method === "PATCH") {
    suppressEventsListUpdate();
  } else if (path === "api/global-settings" && method === "PATCH") {
    suppressEventsListUpdate();
  } else if (matchEventId) {
    const eventId = parseInt(matchEventId[1], 10);
    if (path.includes("alliance-sim")) {
      /* Draft simulator only — do not mark scouting/event data as stale. */
    } else {
      if (path.includes("set-active") || (method === "DELETE" && path === `api/events/${eventId}`)) {
        suppressEventsListUpdate();
      }
      suppressEventDataUpdate(eventId);
    }
  } else if (path.startsWith("api/entries")) {
    const eventId = (data as { eventId?: number })?.eventId ?? options?.eventId;
    if (typeof eventId === "number" && Number.isFinite(eventId)) suppressEventDataUpdate(eventId);
  } else if (path.startsWith("api/pit-entries")) {
    const eventId = (data as { eventId?: number })?.eventId ?? options?.eventId;
    if (typeof eventId === "number" && Number.isFinite(eventId)) suppressEventDataUpdate(eventId);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { eventId?: number },
): Promise<Response> {
  maybeSuppressUpdates(method, url, data, options);

  const res = await fetch(API_BASE + url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  const url = queryKey.join("/") as string;
  const res = await fetch(API_BASE + url, { credentials: "include" });
  await throwIfResNotOk(res);
  return await res.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
