import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { suppressEventDataUpdate, suppressEventsListUpdate } from "./suppress-updates";

/** Optional API origin when frontend is served from a different host (e.g. Vite on :5173, API on :5000). */
export const API_BASE = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_ORIGIN) || "";

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
  } else if (matchEventId) {
    const eventId = parseInt(matchEventId[1], 10);
    if (path.includes("set-active") || (method === "DELETE" && path === `api/events/${eventId}`)) {
      suppressEventsListUpdate();
    }
    suppressEventDataUpdate(eventId);
  } else if (path.startsWith("api/entries")) {
    const eventId = (data as { eventId?: number })?.eventId ?? options?.eventId;
    if (Number.isFinite(eventId)) suppressEventDataUpdate(eventId);
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
