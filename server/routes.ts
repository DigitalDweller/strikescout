import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { hashPassword, bumpAdminSessionEpoch, getAdminSessionEpoch } from "./auth";
import { eventBroadcast, CHANNEL_EVENT_DATA, CHANNEL_EVENTS_LIST, CHANNEL_SEASON, notifyEventDataUpdated, notifyEventsListUpdated, notifySeasonChanged } from "./eventBroadcast";
import {
  insertEventSchema,
  insertTeamSchema,
  insertScoutingEntrySchema,
  insertPitScoutingEntrySchema,
  type Event,
  type AllianceSimSession,
} from "@shared/schema";
import {
  allianceSimMaxPicks,
  normalizePicks,
  normalizeCaptainRobots,
  partnerSlotCountFromEvent,
  sortPicksCanonical,
  validateAllianceSimPicks,
  partnersByCaptain as computePartnersByCaptain,
  type AllianceSimPick,
} from "@shared/alliance-sim";
import { z } from "zod";
import { fetchMatchVideos, fetchMatchResults, getVideoUrl, validateEventKey, fetchTeamAvatars, fetchEventOPRs, fetchMatchSchedule, fetchEventRankings, fetchEventTeams, isTbaConfigured, isTbaRateLimitEnabled, setTbaRateLimitEnabled, getTbaCallHistory, TbaRateLimitError } from "./tba";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Not authenticated" });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user?.role === "admin") return next();
  res.status(403).json({ message: "Admin access required" });
}

async function requirePitScoutingAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  if (req.user?.role === "admin") return next();
  const eventIdRaw =
    typeof req.body?.eventId === "number"
      ? req.body.eventId
      : req.params?.eventId
        ? parseInt(String(req.params.eventId), 10)
        : NaN;
  const eventId = Number.isFinite(eventIdRaw) ? (eventIdRaw as number) : NaN;
  if (!Number.isFinite(eventId) || eventId < 1) {
    return res.status(400).json({ message: "Invalid event id" });
  }
  const allowed = await storage.isScouterAllowedForPitScouting(eventId, req.user!.id);
  if (allowed) return next();
  return res.status(403).json({ message: "Pit scouting access required" });
}

/** Demo accounts are read-only and may only GET a narrow set of APIs for their assigned event. */
function demoApiGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user?.role !== "demo") return next();
  // Only gate JSON API routes — not SPA paths like /events/…, Vite assets, or static files.
  if (!req.path.startsWith("/api")) return next();
  if (req.method === "GET" || req.method === "HEAD") {
    return demoGetGuard(req, res, next);
  }
  if (req.method === "POST" && req.path === "/api/logout") return next();
  const allianceMatch = req.path.match(/^\/api\/events\/(\d+)\/alliance-sim\//);
  if (
    allianceMatch &&
    (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") &&
    req.user!.demoEventId != null &&
    parseInt(allianceMatch[1], 10) === req.user!.demoEventId
  ) {
    return next();
  }
  res.status(403).json({ message: "Demo accounts are read-only" });
}

function demoGetGuard(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  if (path === "/api/user") return next();
  if (path === "/api/events") return next();
  if (path === "/api/teams") return next();
  if (path === "/api/updates") return next();
  const m = path.match(/^\/api\/events\/(\d+)/);
  if (m) {
    const eid = parseInt(m[1], 10);
    const allowed = req.user!.demoEventId;
    if (allowed != null && eid === allowed) return next();
    return res.status(403).json({ message: "Demo access is limited to your assigned event" });
  }
  return res.status(403).json({ message: "Not available for demo accounts" });
}

function publicUserFields(u: { id: number; username: string; displayName: string; role: string; demoEventId?: number | null }) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    demoEventId: u.demoEventId ?? null,
  };
}

/** Seeded primary admin; protected from rename/delete in admin UI. Legacy `admin` is migrated on startup. */
const DEFAULT_ADMIN_USERNAME = "admin5460";

async function seedDatabase() {
  await storage.ensureSeasonsAndAppSettings();
  const eventsList = await storage.getEvents();
  if (eventsList.length === 0) {
    const seasonYear = await storage.getSelectedSeasonYear();
    await storage.createEvent({
      name: "2026 Houston Regional",
      location: "Houston, TX",
      startDate: "2026-03-15",
      seasonYear,
      isActive: true,
      currentMatchNumber: 1,
    });
    console.log("Database seeded with initial data");
  }
}

async function seedAdminUser() {
  const hashed = await hashPassword("strike54zone60!");
  const primary = await storage.getUserByUsername(DEFAULT_ADMIN_USERNAME);
  const legacy = await storage.getUserByUsername("admin");

  if (primary && legacy) {
    await storage.updateUser(legacy.id, {
      username: `legacy_admin_${legacy.id}`,
      password: await hashPassword(randomUUID()),
      displayName: "Legacy admin (disabled)",
      role: "scouter",
    });
    console.log(`Legacy default admin disabled; use ${DEFAULT_ADMIN_USERNAME}`);
    return;
  }

  if (primary) return;

  if (legacy) {
    await storage.updateUser(legacy.id, {
      username: DEFAULT_ADMIN_USERNAME,
      password: hashed,
      displayName: DEFAULT_ADMIN_USERNAME,
      role: "admin",
    });
    console.log(`Default admin migrated to ${DEFAULT_ADMIN_USERNAME}`);
    return;
  }

  await storage.createUser({
    username: DEFAULT_ADMIN_USERNAME,
    password: hashed,
    displayName: DEFAULT_ADMIN_USERNAME,
    role: "admin",
  });
  console.log("Admin user seeded");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use(demoApiGuard);

  /** Non-admins may be restricted to a subset of season events (see app_settings.globally_visible_event_ids). */
  async function assertEventGloballyVisibleToRequest(req: Request, eventId: number): Promise<boolean> {
    if (!req.isAuthenticated()) return true;
    if (req.user?.role === "admin") return true;
    const allowed = await storage.getGloballyVisibleEventIds();
    if (allowed === null) return true;
    const set = new Set(allowed);
    if (!set.has(eventId)) return false;
    if (req.user?.role === "demo") {
      return req.user.demoEventId === eventId;
    }
    return true;
  }

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.path.startsWith("/api/events/")) return next();
      const rest = req.path.slice("/api/events/".length);
      if (!rest) return next();
      const firstSegment = rest.split("/")[0];
      if (!/^\d+$/.test(firstSegment)) return next();
      const eventId = parseInt(firstSegment, 10);
      const ok = await assertEventGloballyVisibleToRequest(req, eventId);
      if (!ok) return res.status(404).json({ message: "Event not found" });
      next();
    } catch (err) {
      next(err);
    }
  });

  // --- Public routes (registered BEFORE auth gate so they bypass it) ---
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.logIn(user, (err) => {
        if (err) return next(err);
        const u = user as Express.User;
        if (u.role === "admin") {
          (req.session as { adminEpoch?: number }).adminEpoch = getAdminSessionEpoch();
        }
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          res.json(publicUserFields(u));
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(publicUserFields(req.user!));
  });

  /** Bump epoch so every admin session (including the caller) is invalid on the next request. */
  app.post("/api/admin/revoke-admin-sessions", requireAdmin, (_req, res) => {
    bumpAdminSessionEpoch();
    res.json({
      ok: true,
      message: "All admin sessions invalidated. Each admin will be signed out on their next request.",
    });
  });

  // --- Dev menu (admin only): TBA rate limit master switch ---
  app.get("/api/dev/tba-rate-limit", requireAdmin, (_req, res) => {
    res.json({ enabled: isTbaRateLimitEnabled() });
  });
  app.post("/api/dev/tba-rate-limit", requireAdmin, (req, res) => {
    const enabled = !!req.body?.enabled;
    setTbaRateLimitEnabled(enabled);
    res.json({ enabled });
  });

  app.get("/api/dev/tba-call-history", requireAdmin, (_req, res) => {
    res.json(getTbaCallHistory());
  });

  // --- Admin user management routes (requireAuth handled by gate above) ---
  app.get("/api/users", requireAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getUsers();
      res.json(allUsers.map(u => ({ ...publicUserFields(u) })));
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, role: roleRaw, demoEventId: demoEventRaw } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password are required" });
      if (typeof username !== "string" || typeof password !== "string") return res.status(400).json({ message: "Username and password must be strings" });
      const trimmedUsername = username.trim();
      if (!trimmedUsername) return res.status(400).json({ message: "Username cannot be empty" });
      const existing = await storage.getUserByUsername(trimmedUsername);
      if (existing) return res.status(400).json({ message: "Username already exists" });
      let role: "admin" | "scouter" | "demo" = "scouter";
      if (roleRaw === "admin") role = "admin";
      else if (roleRaw === "demo") role = "demo";
      else if (roleRaw !== undefined && roleRaw !== "scouter") {
        return res.status(400).json({ message: "Invalid role" });
      }
      let demoEventId: number | null = null;
      if (role === "demo") {
        const eid = typeof demoEventRaw === "number" ? demoEventRaw : parseInt(String(demoEventRaw ?? ""), 10);
        if (!Number.isFinite(eid)) return res.status(400).json({ message: "Demo accounts require a comp (event) to be selected" });
        const ev = await storage.getEvent(eid);
        if (!ev) return res.status(400).json({ message: "Event not found" });
        demoEventId = eid;
      }
      const hashed = await hashPassword(password);
      const user = await storage.createUser({
        username: trimmedUsername,
        password: hashed,
        displayName: trimmedUsername,
        role,
        demoEventId: role === "demo" ? demoEventId : null,
      });
      res.status(201).json(publicUserFields(user));
    } catch (err: any) {
      console.error("Failed to create user:", err);
      res.status(500).json({ message: err?.message || "Failed to create user" });
    }
  });

  function generatePassword(): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  app.post("/api/users/bulk", requireAdmin, async (req, res) => {
    try {
      const { scouts } = req.body;
      if (!Array.isArray(scouts)) return res.status(400).json({ message: "scouts array required" });
      const results: { username: string; password: string; created: boolean; error?: string }[] = [];
      const seen = new Set<string>();
      for (const item of scouts) {
        const username = typeof item?.username === "string" ? item.username.trim() : "";
        if (!username) continue;
        if (seen.has(username.toLowerCase())) {
          results.push({ username, password: "", created: false, error: "Duplicate in list" });
          continue;
        }
        seen.add(username.toLowerCase());
        const password = typeof item?.password === "string" && item.password.trim()
          ? item.password.trim()
          : generatePassword();
        try {
          const existing = await storage.getUserByUsername(username);
          if (existing) {
            results.push({ username, password: "", created: false, error: "Username already exists" });
            continue;
          }
          const hashed = await hashPassword(password);
          await storage.createUser({
            username,
            password: hashed,
            displayName: username,
            role: "scouter",
          });
          results.push({ username, password, created: true });
        } catch (err: any) {
          results.push({ username, password: "", created: false, error: err?.message || "Failed" });
        }
      }
      res.status(201).json({ created: results.filter((r) => r.created).length, results });
    } catch (err: any) {
      console.error("Failed to bulk create users:", err);
      res.status(500).json({ message: err?.message || "Failed to bulk create users" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid user id" });
      const user = await storage.getUser(id);
      if (!user) return res.sendStatus(404);
      if (user.username === DEFAULT_ADMIN_USERNAME) return res.status(400).json({ message: "Cannot modify the default admin account" });
      const updates: Record<string, unknown> = {};
      if (req.body.username) {
        updates.username = req.body.username.trim();
        updates.displayName = req.body.username.trim();
      }
      if (req.body.role !== undefined) {
        if (!["admin", "scouter", "demo"].includes(req.body.role)) {
          return res.status(400).json({ message: "Invalid role" });
        }
        updates.role = req.body.role;
      }
      if (req.body.password) updates.password = await hashPassword(req.body.password);
      if (req.body.demoEventId !== undefined) {
        const raw = req.body.demoEventId;
        if (raw === null) updates.demoEventId = null;
        else {
          const eid = typeof raw === "number" ? raw : parseInt(String(raw), 10);
          if (!Number.isFinite(eid)) return res.status(400).json({ message: "Invalid demoEventId" });
          updates.demoEventId = eid;
        }
      }
      const finalRole = (updates.role as string | undefined) ?? user.role;
      if (finalRole !== "demo") {
        updates.demoEventId = null;
      } else {
        const demoId = updates.demoEventId !== undefined ? (updates.demoEventId as number | null) : user.demoEventId;
        if (demoId == null || !Number.isFinite(demoId)) {
          return res.status(400).json({ message: "Demo accounts must be assigned to a comp (event)" });
        }
        const ev = await storage.getEvent(demoId);
        if (!ev) return res.status(400).json({ message: "Event not found" });
      }
      const updated = await storage.updateUser(id, updates as Parameters<typeof storage.updateUser>[1]);
      if (!updated) return res.sendStatus(404);
      res.json(publicUserFields(updated));
    } catch (err: any) {
      console.error("Failed to update user:", err);
      res.status(500).json({ message: err?.message || "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid user id" });
      const user = await storage.getUser(id);
      if (!user) return res.sendStatus(404);
      if (user.username === DEFAULT_ADMIN_USERNAME) return res.status(400).json({ message: "Cannot delete the default admin account" });
      await storage.deleteUser(id);
      res.sendStatus(204);
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      res.status(500).json({ message: err?.message || "Failed to delete user" });
    }
  });

  /** Scouter profiles: any authenticated user can view a user's public profile (no password). */
  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid user id" });
      const user = await storage.getUser(id);
      if (!user) return res.sendStatus(404);
      const stats = await storage.getScouterStats(id);
      const totalEntries = stats.reduce((s, r) => s + r.entryCount, 0);
      const awardsSum = (await storage.getRepAwardsSumForScouters([id])).get(id) ?? 0;
      const rep = stats.length * 10 + totalEntries + awardsSum;
      const repHistory = await storage.getRepHistoryForScouter(id);
      res.json({
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        totalEntries,
        rep,
        repHistory,
        events: stats.map(s => ({ eventId: s.eventId, eventName: s.eventName, entryCount: s.entryCount })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch profile" });
    }
  });

  /** Admin: award rep to a scouter. */
  app.post("/api/users/:id/rep-awards", requireAdmin, async (req, res) => {
    try {
      const scouterId = parseInt(req.params.id);
      if (!Number.isFinite(scouterId)) return res.status(400).json({ message: "Invalid user id" });
      const { amount, reason, eventId } = req.body;
      const parsedAmount = typeof amount === "number" ? amount : parseInt(String(amount), 10);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ message: "Amount must be a positive number" });
      const awardedById = req.user?.id;
      if (!awardedById) return res.status(401).json({ message: "Not authenticated" });
      await storage.createRepAward({
        scouterId,
        awardedById,
        amount: parsedAmount,
        reason: typeof reason === "string" ? reason : null,
        eventId: typeof eventId === "number" ? eventId : undefined,
      });
      res.status(201).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to award rep" });
    }
  });

  // --- Protected routes (requireAuth handled by gate above) ---
  app.get("/api/seasons", requireAuth, async (_req, res) => {
    const rows = await storage.getSeasons();
    res.json(rows);
  });

  app.get("/api/selected-season", requireAuth, async (_req, res) => {
    const selectedYear = await storage.getSelectedSeasonYear();
    res.json({ selectedYear });
  });

  app.get("/api/global-settings", requireAdmin, async (_req, res) => {
    const globallyVisibleEventIds = await storage.getGloballyVisibleEventIds();
    res.json({ globallyVisibleEventIds });
  });

  app.patch("/api/global-settings", requireAdmin, async (req, res) => {
    const parsed = z
      .object({
        globallyVisibleEventIds: z.array(z.number().int()).nullable(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { globallyVisibleEventIds } = parsed.data;
    if (globallyVisibleEventIds === null) {
      await storage.setGloballyVisibleEventIds(null);
    } else {
      const seasonEvents = await storage.getEvents();
      const valid = new Set(seasonEvents.map((e) => e.id));
      for (const id of globallyVisibleEventIds) {
        if (!valid.has(id)) {
          return res.status(400).json({ message: `Event ${id} is not part of the current season workspace.` });
        }
      }
      await storage.setGloballyVisibleEventIds([...new Set(globallyVisibleEventIds)]);
    }
    notifyEventsListUpdated();
    res.json({ globallyVisibleEventIds: await storage.getGloballyVisibleEventIds() });
  });

  app.patch("/api/selected-season", requireAdmin, async (req, res) => {
    const parsed = z.object({ year: z.number().int() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      await storage.setSelectedSeasonYear(parsed.data.year);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid season";
      return res.status(400).json({ message: msg });
    }
    notifySeasonChanged();
    notifyEventsListUpdated();
    res.json({ selectedYear: parsed.data.year });
  });

  app.get("/api/events", async (req, res) => {
    const allEvents = await storage.getEvents();
    if (req.isAuthenticated() && req.user?.role === "admin") {
      return res.json(allEvents);
    }
    const allowed = await storage.getGloballyVisibleEventIds();
    const gated =
      allowed === null ? allEvents : allEvents.filter((e) => allowed.includes(e.id));
    if (req.isAuthenticated() && req.user?.role === "demo") {
      const demoId = req.user.demoEventId;
      if (demoId == null) return res.json([]);
      const one = gated.find((e) => e.id === demoId);
      return res.json(one ? [one] : []);
    }
    res.json(gated);
  });

  const createEventBodySchema = insertEventSchema.omit({ seasonYear: true });

  app.post("/api/events", requireAdmin, async (req, res) => {
    const parsed = createEventBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const seasonYear = await storage.getSelectedSeasonYear();
    const event = await storage.createEvent({ ...parsed.data, seasonYear });
    notifyEventsListUpdated();
    res.status(201).json(event);
  });

  app.get("/api/events/:id", async (req, res) => {
    const event = await storage.getEvent(parseInt(req.params.id));
    if (!event) return res.sendStatus(404);
    res.json(event);
  });

  app.patch("/api/events/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.updateEvent(id, req.body);
    if (!event) return res.sendStatus(404);
    notifyEventDataUpdated(id);
    res.json(event);
  });

  app.patch("/api/events/:id/current-match", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid event id" });
    const n = typeof req.body?.currentMatchNumber === "number" ? req.body.currentMatchNumber : parseInt(String(req.body?.currentMatchNumber ?? ""), 10);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ message: "currentMatchNumber must be a positive integer" });
    const event = await storage.updateEvent(id, { currentMatchNumber: n });
    if (!event) return res.sendStatus(404);
    notifyEventDataUpdated(id);
    res.json(event);
  });

  app.delete("/api/events/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteEvent(id);
    notifyEventsListUpdated();
    res.sendStatus(204);
  });

  app.post("/api/events/:id/set-active", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(id);
    if (!event) return res.sendStatus(404);
    const selectedYear = await storage.getSelectedSeasonYear();
    if (event.seasonYear !== selectedYear) {
      return res.status(400).json({ message: "That event is not part of the selected season." });
    }
    await storage.setActiveEvent(id);
    const updated = await storage.getEvent(id);
    notifyEventsListUpdated();
    res.json(updated!);
  });

  app.get("/api/active-event", async (req, res) => {
    const event = await storage.getActiveEvent();
    if (!event) return res.json(null);
    const ok = await assertEventGloballyVisibleToRequest(req, event.id);
    if (!ok) return res.json(null);
    res.json(event);
  });

  app.get("/api/teams", async (_req, res) => {
    const allTeams = await storage.getTeams();
    res.json(allTeams);
  });

  app.post("/api/teams", async (req, res) => {
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getTeamByNumber(parsed.data.teamNumber);
    if (existing) return res.status(400).send("Team number already exists");
    const team = await storage.createTeam(parsed.data);
    res.status(201).json(team);
  });

  app.post("/api/teams/import", async (req, res) => {
    const { teams: teamList, eventId } = req.body;
    if (!Array.isArray(teamList)) return res.status(400).send("teams must be an array");

    const results = [];
    for (const t of teamList) {
      const team = await storage.upsertTeam({
        teamNumber: t.teamNumber,
        teamName: t.teamName,
        city: t.city || null,
        stateProv: t.stateProv || null,
        country: t.country || null,
      });
      if (eventId) {
        const existing = await storage.getEventTeams(eventId);
        if (!existing.find(et => et.teamId === team.id)) {
          await storage.addTeamToEvent({ eventId, teamId: team.id });
        }
      }
      results.push(team);
    }
    if (eventId) notifyEventDataUpdated(eventId);
    res.status(201).json(results);
  });

  app.delete("/api/teams/:id", async (req, res) => {
    await storage.deleteTeam(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.get("/api/events/:eventId/teams", async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) {
      return res.json([]);
    }
    const result = await storage.getEventTeams(eventId);
    res.json(result ?? []);
  });

  app.post("/api/events/:eventId/teams", async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const teamId = typeof req.body?.teamId === "number" ? req.body.teamId : parseInt(req.body?.teamId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    if (!Number.isFinite(teamId) || teamId < 1) return res.status(400).json({ message: "teamId required and must be a positive number" });
    const eventTeam = await storage.addTeamToEvent({ eventId, teamId });
    notifyEventDataUpdated(eventId);
    res.status(201).json(eventTeam);
  });

  app.delete("/api/events/:eventId/teams/:teamId", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    await storage.removeTeamFromEvent(eventId, parseInt(req.params.teamId));
    notifyEventDataUpdated(eventId);
    res.sendStatus(204);
  });

  app.post("/api/entries", async (req, res) => {
    const parsed = insertScoutingEntrySchema.safeParse({
      ...req.body,
      scouterId: req.user?.id ?? 0,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entry = await storage.createScoutingEntry(parsed.data);
    notifyEventDataUpdated(entry.eventId);
    res.status(201).json(entry);
  });

  app.patch("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid entry id" });
    const updated = await storage.updateScoutingEntry(id, req.body);
    if (!updated) return res.sendStatus(404);
    notifyEventDataUpdated(updated.eventId);
    res.json(updated);
  });

  app.delete("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid entry id" });
    const entry = await storage.getScoutingEntry(id);
    await storage.deleteScoutingEntry(id);
    if (entry) notifyEventDataUpdated(entry.eventId);
    res.sendStatus(204);
  });

  const MAX_PIT_IMAGE_CHARS = 1_800_000;

  app.post("/api/pit-entries", requirePitScoutingAccess, async (req, res) => {
    const parsed = insertPitScoutingEntrySchema.safeParse({
      ...req.body,
      scouterId: req.user?.id ?? 0,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { eventId, teamId } = parsed.data;
    const roster = await storage.getEventTeams(eventId);
    if (!roster.some((et) => et.teamId === teamId)) {
      return res.status(400).json({ message: "Team is not on this event roster" });
    }
    const imageFields = [
      "robotHeroImage",
      "robotExtraImage1",
      "robotExtraImage2",
      "robotExtraImage3",
      "robotExtraImage4",
    ] as const;
    for (const k of imageFields) {
      const v = parsed.data[k];
      if (typeof v === "string" && v.length > MAX_PIT_IMAGE_CHARS) {
        return res.status(413).json({ message: `Image field ${k} is too large (max ~1.3MB compressed)` });
      }
    }
    const entry = await storage.upsertPitScoutingEntry(parsed.data);
    notifyEventDataUpdated(eventId);
    res.status(201).json(entry);
  });

  app.get("/api/events/:eventId/pit-entries", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.json([]);
    const rows = await storage.getPitScoutingEntriesWithScouters(eventId);
    res.json(rows);
  });

  app.get("/api/events/:eventId/teams/:teamId/pit-entry", requirePitScoutingAccess, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const teamId = parseInt(req.params.teamId, 10);
    if (!Number.isFinite(eventId) || !Number.isFinite(teamId)) {
      return res.status(400).json({ message: "Invalid event or team id" });
    }
    const row = await storage.getPitScoutingByEventAndTeam(eventId, teamId);
    if (!row) return res.json(null);
    const scouter = await storage.getUser(row.scouterId);
    res.json({
      ...row,
      scouter: scouter ? publicUserFields(scouter) : null,
    });
  });

  // --- Pit scouting allowlist (admin) ---
  app.get("/api/events/:eventId/pit-access", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const scouterIds = await storage.getPitScoutingAllowedScouterIds(eventId);
    res.json({ scouterIds });
  });

  app.put("/api/events/:eventId/pit-access", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const scouterIds = Array.isArray(req.body?.scouterIds) ? req.body.scouterIds : null;
    if (!scouterIds) return res.status(400).json({ message: "scouterIds must be an array of user ids" });
    const parsed = scouterIds
      .map((v: unknown) => (typeof v === "number" ? v : parseInt(String(v ?? ""), 10)))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    await storage.setPitScoutingAllowedScouterIds(eventId, parsed);
    notifyEventDataUpdated(eventId);
    res.json({ ok: true, scouterIds: await storage.getPitScoutingAllowedScouterIds(eventId) });
  });

  app.get("/api/events/:eventId/pit-access/me", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    if (req.user?.role === "admin") return res.json({ allowed: true });
    if (req.user?.role === "demo") return res.json({ allowed: false });
    const allowed = await storage.isScouterAllowedForPitScouting(eventId, req.user!.id);
    res.json({ allowed });
  });

  /** SSE: app-level stream for all data updates. Sends "event:{eventId}" or "events". */
  app.get("/api/updates", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const onEventData = (eventId: number) => res.write(`data: event:${eventId}\n\n`);
    const onEventsList = () => res.write(`data: events\n\n`);
    const onSeason = () => res.write(`data: season\n\n`);

    eventBroadcast.on(CHANNEL_EVENT_DATA, onEventData);
    eventBroadcast.on(CHANNEL_EVENTS_LIST, onEventsList);
    eventBroadcast.on(CHANNEL_SEASON, onSeason);

    req.on("close", () => {
      eventBroadcast.off(CHANNEL_EVENT_DATA, onEventData);
      eventBroadcast.off(CHANNEL_EVENTS_LIST, onEventsList);
      eventBroadcast.off(CHANNEL_SEASON, onSeason);
    });
  });

  app.get("/api/events/:eventId/entries", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    if (req.user?.role !== "admin" && req.query.mine === "true") {
      const entries = await storage.getEntriesWithScouters(eventId, req.user!.id);
      return res.json(entries);
    }
    const entries = await storage.getEntriesWithScouters(eventId);
    res.json(entries);
  });

  app.get("/api/events/:eventId/teams/:teamId/entries", async (req, res) => {
    const entries = await storage.getEntriesByEventAndTeam(
      parseInt(req.params.eventId),
      parseInt(req.params.teamId)
    );
    res.json(entries);
  });

  app.get("/api/events/:eventId/match/:matchNumber/entries", async (req, res) => {
    const entries = await storage.getEntriesByMatch(
      parseInt(req.params.eventId),
      parseInt(req.params.matchNumber)
    );
    res.json(entries);
  });

  app.get("/api/events/:eventId/scouters", async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const scouters = await storage.getScoutersForEvent(eventId);
    res.json(scouters);
  });

  app.put("/api/events/:eventId/scouter-presence", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const { presence } = req.body as { presence?: { scouterId: number; isPresent: boolean }[] };
    if (!Array.isArray(presence)) {
      return res.status(400).json({ message: "presence must be an array of { scouterId, isPresent }" });
    }
    if (presence.length === 0) {
      notifyEventDataUpdated(eventId);
      return res.json({ ok: true });
    }
    for (const p of presence) {
      if (typeof p !== "object" || p == null || !Number.isFinite(p.scouterId) || typeof p.isPresent !== "boolean") {
        return res.status(400).json({ message: "Each entry must have scouterId (number) and isPresent (boolean)" });
      }
    }
    await storage.setEventScouterPresence(
      eventId,
      presence.map((p) => ({ scouterId: p.scouterId, isPresent: p.isPresent })),
    );
    notifyEventDataUpdated(eventId);
    res.json({ ok: true });
  });

  app.post("/api/events/:eventId/scout-assignment-requests/:id/recall-break", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(eventId) || eventId < 1 || !Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid ids" });
    }
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    try {
      await storage.recallScoutBreakRequest(eventId, id, req.user!.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      return res.status(400).json({ message: msg });
    }
    notifyEventDataUpdated(eventId);
    res.json({ ok: true });
  });

  app.get("/api/events/:eventId/schedule", async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) {
      return res.json([]);
    }
    const schedule = await storage.getScheduleByEvent(eventId);
    res.json(schedule ?? []);
  });

  app.get("/api/events/:eventId/scout-assignments", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const scouterIdParam = req.query.scouterId;
    const allParam = req.query.all === "true";
    let filterScouterId: number | undefined;
    if (typeof scouterIdParam === "string" && scouterIdParam) {
      const parsed = parseInt(scouterIdParam, 10);
      if (Number.isFinite(parsed)) filterScouterId = parsed;
    }
    if (!allParam && req.user?.role === "scouter" && !filterScouterId) filterScouterId = req.user?.id;
    const assignments = await storage.getScoutAssignments(eventId, filterScouterId);
    res.json(assignments.map(a => ({ id: a.id, eventId: a.eventId, matchNumber: a.matchNumber, slot: a.slot, scouterId: a.scouterId, scouter: a.scouter ? { id: a.scouter.id, displayName: a.scouter.displayName, username: a.scouter.username } : null })));
  });

  app.put("/api/events/:eventId/scout-assignments", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const eventOver = !event.isActive && !(event.testingOverrideEventEnded ?? false);
    if (eventOver) return res.status(403).json({ message: "Competition is over; reassignment not allowed" });
    const { assignments } = req.body;
    if (!Array.isArray(assignments)) return res.status(400).json({ message: "assignments array required" });
    const valid = assignments.every((a: any) =>
      typeof a === "object" && a != null &&
      Number.isFinite(a.matchNumber) &&
      typeof a.slot === "string" &&
      (a.scouterId == null || Number.isFinite(a.scouterId))
    );
    if (!valid) return res.status(400).json({ message: "Each assignment must have matchNumber, slot, and scouterId (or null)" });
    await storage.setScoutAssignmentsBulk(eventId, assignments.map((a: any) => ({ matchNumber: a.matchNumber, slot: a.slot, scouterId: a.scouterId ?? null })));
    notifyEventDataUpdated(eventId);
    const updated = await storage.getScoutAssignments(eventId);
    res.json(updated.map(a => ({ id: a.id, eventId: a.eventId, matchNumber: a.matchNumber, slot: a.slot, scouterId: a.scouterId, scouter: a.scouter ? { id: a.scouter.id, displayName: a.scouter.displayName, username: a.scouter.username } : null })));
  });

  app.get("/api/events/:eventId/scout-assignment-requests", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const scouterId = req.user?.role === "admin" ? undefined : req.user?.id;
    const requests = await storage.getScoutAssignmentRequests(eventId, scouterId);
    res.json(requests.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      type: r.type,
      requesterId: r.requesterId,
      targetScouterId: r.targetScouterId,
      status: r.status,
      reviewedById: r.reviewedById,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
      requester: r.requester ? { id: r.requester.id, displayName: r.requester.displayName } : undefined,
      targetScouter: r.targetScouter ? { id: r.targetScouter.id, displayName: r.targetScouter.displayName } : undefined,
    })));
  });

  app.post("/api/events/:eventId/scout-assignment-requests", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const userId = req.user!.id;
    const { type, targetScouterId } = req.body;
    if (type !== "break" && type !== "trade") return res.status(400).json({ message: "type must be break or trade" });
    if (type === "trade" && (!Number.isFinite(targetScouterId) || targetScouterId === userId)) return res.status(400).json({ message: "targetScouterId required for trade and must differ from requester" });
    if (type === "break") {
      const breaksUsed = await storage.getScouterBreakCredits(eventId, userId);
      if (breaksUsed >= 5) return res.status(400).json({ message: "You have used all 5 breaks for this event. Ask an admin to grant more." });
    }
    const req_ = await storage.createScoutAssignmentRequest({
      eventId,
      type,
      requesterId: userId,
      targetScouterId: type === "trade" ? targetScouterId : null,
    });
    res.status(201).json({ id: req_.id, eventId: req_.eventId, type: req_.type, requesterId: req_.requesterId, targetScouterId: req_.targetScouterId, status: req_.status, createdAt: req_.createdAt });
  });

  app.patch("/api/events/:eventId/scout-assignment-requests/:id/cancel", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(eventId) || eventId < 1 || !Number.isFinite(id)) return res.status(400).json({ message: "Invalid ids" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const userId = req.user!.id;
    const requests = await storage.getScoutAssignmentRequests(eventId, userId);
    const req_ = requests.find((r) => r.id === id);
    if (!req_) return res.sendStatus(404);
    if (req_.requesterId !== userId) return res.status(403).json({ message: "You can only cancel your own requests" });
    if (req_.status !== "pending") return res.status(400).json({ message: "Can only cancel pending requests" });
    await storage.updateScoutAssignmentRequest(id, { status: "cancelled" });
    const updated = await storage.getScoutAssignmentRequests(eventId, userId);
    const u = updated.find((r) => r.id === id);
    res.json(u ? { id: u.id, status: u.status } : {});
  });

  app.get("/api/events/:eventId/scout-break-credits", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    let scouterId: number;
    if (req.user?.role === "admin") {
      const q = parseInt(String(req.query.scouterId ?? 0), 10);
      if (!q || q < 1) return res.status(400).json({ message: "scouterId query param required for admin" });
      scouterId = q;
    } else {
      scouterId = req.user!.id;
    }
    const breaksUsed = await storage.getScouterBreakCredits(eventId, scouterId);
    res.json({ breaksUsed, breaksRemaining: Math.max(0, 5 - breaksUsed) });
  });

  app.get("/api/events/:eventId/scout-break-credits/all", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const credits = await storage.getEventScouterBreakCredits(eventId);
    res.json(credits);
  });

  app.post("/api/events/:eventId/scout-break-credits", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const { scouterId, amount } = req.body;
    if (!Number.isFinite(scouterId) || scouterId < 1 || !Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ message: "scouterId and amount (positive integer) required" });
    }
    await storage.addScouterBreakCredits(eventId, scouterId, amount);
    const breaksUsed = await storage.getScouterBreakCredits(eventId, scouterId);
    notifyEventDataUpdated(eventId);
    res.json({ breaksUsed, breaksRemaining: Math.max(0, 5 - breaksUsed) });
  });

  app.patch("/api/events/:eventId/scout-assignment-requests/:id", requireAdmin, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(eventId) || eventId < 1 || !Number.isFinite(id)) return res.status(400).json({ message: "Invalid ids" });
    const { status } = req.body;
    if (status !== "approved" && status !== "denied") return res.status(400).json({ message: "status must be approved or denied" });
    const requests = await storage.getScoutAssignmentRequests(eventId);
    const req_ = requests.find((r) => r.id === id);
    if (!req_ || req_.status !== "pending") return res.status(404).json({ message: "Request not found or already reviewed" });
    await storage.updateScoutAssignmentRequest(id, { status, reviewedById: req.user!.id });
    if (status === "approved") {
      if (req_.type === "break") {
        const assignments = await storage.getScoutAssignments(eventId, req_.requesterId);
        const sorted = [...assignments].sort((a, b) => a.matchNumber - b.matchNumber);
        if (sorted.length > 0) {
          const first = sorted[0];
          await storage.setScoutAssignment(eventId, first.matchNumber, first.slot, null);
        }
        await storage.incrementScouterBreakUsed(eventId, req_.requesterId);
      } else if (req_.type === "trade" && req_.targetScouterId) {
        const all = await storage.getScoutAssignments(eventId);
        const updates = all.map((a) => {
          if (a.scouterId === req_.requesterId) return { matchNumber: a.matchNumber, slot: a.slot, scouterId: req_.targetScouterId! };
          if (a.scouterId === req_.targetScouterId) return { matchNumber: a.matchNumber, slot: a.slot, scouterId: req_.requesterId };
          return { matchNumber: a.matchNumber, slot: a.slot, scouterId: a.scouterId };
        });
        await storage.setScoutAssignmentsBulk(eventId, updates);
      }
      notifyEventDataUpdated(eventId);
    }
    const updated = await storage.getScoutAssignmentRequests(eventId);
    const u = updated.find((r) => r.id === id);
    res.json(u ? { id: u.id, status: u.status, reviewedById: u.reviewedById, reviewedAt: u.reviewedAt } : {});
  });

  app.post("/api/events/:eventId/tba/validate", async (req, res) => {
    if (!isTbaConfigured()) return res.status(503).json({ message: "TBA API key not configured. Add TBA_API_KEY to your .env file." });
    const eventId = parseInt(req.params.eventId);
    const { eventKey } = req.body;
    if (!eventKey) return res.status(400).json({ message: "eventKey required" });
    try {
      const result = await validateEventKey(eventKey);
      if (result.valid) {
        const event = await storage.getEvent(eventId);
        if (event && (event.tbaEventKey ?? "") === (eventKey ?? "")) {
          await storage.updateEvent(eventId, { tbaEventKeyValidated: true });
          notifyEventDataUpdated(eventId);
        }
      }
      res.json(result);
    } catch (err: any) {
      if (err instanceof TbaRateLimitError) return res.status(429).json({ message: err.message, resetsAt: err.resetsAt });
      res.status(500).json({ message: err?.message ?? "TBA request failed" });
    }
  });

  app.post("/api/events/:eventId/tba/sync-videos", async (req, res) => {
    if (!isTbaConfigured()) return res.status(503).json({ message: "TBA API key not configured. Add TBA_API_KEY to your .env file." });
    const eventId = parseInt(req.params.eventId);
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    if (!event.tbaEventKey) return res.status(400).json({ message: "No TBA event key configured" });

    try {
      const tbaMatches = await fetchMatchVideos(event.tbaEventKey);
      const qualMatches = tbaMatches.filter(m => m.compLevel === "qm");
      let synced = 0;

      for (const m of qualMatches) {
        const url = getVideoUrl(m.videos);
        if (url) {
          await storage.updateScheduleMatchVideo(eventId, m.matchNumber, url);
          synced++;
        }
      }

      notifyEventDataUpdated(eventId);
      res.json({ synced, total: qualMatches.length });
    } catch (err: any) {
      if (err instanceof TbaRateLimitError) return res.status(429).json({ message: err.message, resetsAt: err.resetsAt });
      res.status(500).json({ message: err?.message ?? "TBA sync failed" });
    }
  });

  app.post("/api/events/:eventId/tba/sync-teams", async (req, res) => {
    if (!isTbaConfigured()) return res.status(503).json({ message: "TBA API key not configured. Add TBA_API_KEY to your .env file." });
    const eventId = parseInt(req.params.eventId);
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    if (!event.tbaEventKey) return res.status(400).json({ message: "No TBA event key configured" });

    try {
      const tbaTeams = await fetchEventTeams(event.tbaEventKey);
      const existing = await storage.getEventTeams(eventId);
      const existingNumbers = new Set(existing.map(et => et.team.teamNumber));
      let added = 0;
      for (const t of tbaTeams) {
        const team = await storage.upsertTeam({
          teamNumber: t.teamNumber,
          teamName: t.teamName,
          city: t.city ?? undefined,
          stateProv: t.stateProv ?? undefined,
          country: t.country ?? undefined,
        });
        if (!existingNumbers.has(team.teamNumber)) {
          await storage.addTeamToEvent({ eventId, teamId: team.id });
          existingNumbers.add(team.teamNumber);
          added++;
        }
      }
      notifyEventDataUpdated(eventId);
      res.json({ added, total: tbaTeams.length });
    } catch (err: any) {
      if (err instanceof TbaRateLimitError) return res.status(429).json({ message: err.message, resetsAt: err.resetsAt });
      res.status(500).json({ message: err?.message ?? "TBA sync failed" });
    }
  });

  app.post("/api/events/:eventId/tba/sync-avatars", async (req, res) => {
    if (!isTbaConfigured()) return res.status(503).json({ message: "TBA API key not configured. Add TBA_API_KEY to your .env file." });
    const eventId = parseInt(req.params.eventId);
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    if (!event.tbaEventKey) return res.status(400).json({ message: "No TBA event key configured" });

    try {
      const eventTeamsList = await storage.getEventTeams(eventId);
      const teamNumbers = eventTeamsList.map(et => et.team.teamNumber);
      const teamsWithoutAvatars = eventTeamsList
        .filter(et => !et.team.avatar)
        .map(et => et.team.teamNumber);

      if (teamsWithoutAvatars.length === 0) {
        return res.json({ synced: 0, total: teamNumbers.length, message: "All teams already have avatars" });
      }

      const avatars = await fetchTeamAvatars(teamsWithoutAvatars);
      let synced = 0;
      for (const [teamNum, avatar] of avatars) {
        await storage.updateTeamAvatar(teamNum, avatar);
        synced++;
      }

      notifyEventDataUpdated(eventId);
      res.json({ synced, total: teamNumbers.length });
    } catch (err: any) {
      if (err instanceof TbaRateLimitError) return res.status(429).json({ message: err.message, resetsAt: err.resetsAt });
      res.status(500).json({ message: err?.message ?? "TBA sync failed" });
    }
  });

  app.post("/api/events/:eventId/tba/sync-oprs", async (req, res) => {
    if (!isTbaConfigured()) return res.status(503).json({ message: "TBA API key not configured. Add TBA_API_KEY to your .env file." });
    const eventId = parseInt(req.params.eventId);
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    if (!event.tbaEventKey) return res.status(400).json({ message: "No TBA event key configured" });

    try {
      const [oprData, rankingsData] = await Promise.all([
        fetchEventOPRs(event.tbaEventKey),
        fetchEventRankings(event.tbaEventKey),
      ]);
      const eventTeamsList = await storage.getEventTeams(eventId);
      let oprsSynced = 0;
      let rankingsSynced = 0;

      for (const opr of oprData) {
        const et = eventTeamsList.find(e => e.team.teamNumber === opr.teamNumber);
        if (et) {
          await storage.updateEventTeamOPR(eventId, et.teamId, opr.opr);
          oprsSynced++;
        }
      }

      for (const r of rankingsData) {
        const et = eventTeamsList.find(e => e.team.teamNumber === r.teamNumber);
        if (et) {
          await storage.updateEventTeamRanking(eventId, et.teamId, r.rankingPoints, r.rank, r.wins, r.losses, r.ties);
          rankingsSynced++;
        }
      }

      notifyEventDataUpdated(eventId);
      res.json({
        oprsSynced,
        rankingsSynced,
        total: eventTeamsList.length,
      });
    } catch (err: any) {
      if (err instanceof TbaRateLimitError) return res.status(429).json({ message: err.message, resetsAt: err.resetsAt });
      res.status(500).json({ message: err?.message ?? "TBA sync failed" });
    }
  });

  app.post("/api/events/:eventId/tba/sync-schedule", async (req, res) => {
    if (!isTbaConfigured()) return res.status(503).json({ message: "TBA API key not configured. Add TBA_API_KEY to your .env file." });
    const eventId = parseInt(req.params.eventId);
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    if (!event.tbaEventKey) return res.status(400).json({ message: "No TBA event key configured" });

    try {
      const tbaMatches = await fetchMatchSchedule(event.tbaEventKey);
      await storage.deleteScheduleByEvent(eventId);

      let synced = 0;
      for (const m of tbaMatches) {
        await storage.createScheduleMatch({
          eventId,
          matchNumber: m.matchNumber,
          red1: m.red1,
          red2: m.red2,
          red3: m.red3,
          blue1: m.blue1,
          blue2: m.blue2,
          blue3: m.blue3,
          time: m.time,
        });
        synced++;
      }

      notifyEventDataUpdated(eventId);
      res.json({ synced, total: tbaMatches.length });
    } catch (err: any) {
      if (err instanceof TbaRateLimitError) return res.status(429).json({ message: err.message, resetsAt: err.resetsAt });
      res.status(500).json({ message: err?.message ?? "TBA sync failed" });
    }
  });

  app.post("/api/events/:eventId/tba/sync-results", async (req, res) => {
    if (!isTbaConfigured()) return res.status(503).json({ message: "TBA API key not configured. Add TBA_API_KEY to your .env file." });
    const eventId = parseInt(req.params.eventId);
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    if (!event.tbaEventKey) return res.status(400).json({ message: "No TBA event key configured" });

    try {
      const results = await fetchMatchResults(event.tbaEventKey);
      let synced = 0;

      for (const r of results) {
        await storage.updateMatchResults(eventId, r.matchNumber, r.redScore, r.blueScore, r.winningAlliance);
        const videoUrl = getVideoUrl(r.videos);
        if (videoUrl) {
          await storage.updateScheduleMatchVideo(eventId, r.matchNumber, videoUrl);
        }
        synced++;
      }

      notifyEventDataUpdated(eventId);
      res.json({ synced, total: results.length });
    } catch (err: any) {
      if (err instanceof TbaRateLimitError) return res.status(429).json({ message: err.message, resetsAt: err.resetsAt });
      res.status(500).json({ message: err?.message ?? "TBA sync failed" });
    }
  });

  const AUTO_SYNC_DURATION = 3 * 60 * 60 * 1000;
  const MANUAL_SYNC_WINDOW = 15 * 60 * 1000;
  const MANUAL_SYNC_LIMIT = 3;

  const autoSyncIntervals = new Map<number, NodeJS.Timeout>();
  const autoSyncExpiry = new Map<number, NodeJS.Timeout>();
  const syncStatus = new Map<number, { lastSyncTime: number | null; syncing: boolean; startedAt: number | null; expiresAt: number | null }>();
  const manualSyncLog = new Map<number, number[]>();

  async function runSync(eventId: number): Promise<boolean> {
    if (!isTbaConfigured()) return false;
    const status = syncStatus.get(eventId) || { lastSyncTime: null, syncing: false, startedAt: null, expiresAt: null };
    syncStatus.set(eventId, { ...status, syncing: true });
    try {
      const event = await storage.getEvent(eventId);
      if (!event || !event.tbaEventKey) {
        return false;
      }

      let scheduleSynced = 0;
      try {
        const tbaSchedule = await fetchMatchSchedule(event.tbaEventKey);
        if (tbaSchedule.length > 0) {
          const existingSchedule = await storage.getScheduleByEvent(eventId);
          if (existingSchedule.length === 0 || tbaSchedule.length !== existingSchedule.length) {
            await storage.deleteScheduleByEvent(eventId);
            for (const m of tbaSchedule) {
              await storage.createScheduleMatch({
                eventId,
                matchNumber: m.matchNumber,
                red1: m.red1, red2: m.red2, red3: m.red3,
                blue1: m.blue1, blue2: m.blue2, blue3: m.blue3,
                time: m.time,
              });
              scheduleSynced++;
            }
          }
        }
      } catch (schedErr) {
        console.error(`[TBA Auto-Sync] Schedule sync error for event ${eventId}:`, schedErr);
      }

      let videosSynced = 0;
      let resultsSynced = 0;
      try {
        const results = await fetchMatchResults(event.tbaEventKey);
        for (const r of results) {
          if (r.redScore != null && r.blueScore != null) {
            await storage.updateMatchResults(eventId, r.matchNumber, r.redScore, r.blueScore, r.winningAlliance);
            resultsSynced++;
          }
          const videoUrl = getVideoUrl(r.videos);
          if (videoUrl) {
            await storage.updateScheduleMatchVideo(eventId, r.matchNumber, videoUrl);
            videosSynced++;
          }
        }
      } catch (resultsErr) {
        console.error(`[TBA Auto-Sync] Results/videos sync error for event ${eventId}:`, resultsErr);
      }

      const eventTeamsList = await storage.getEventTeams(eventId);
      let oprsSynced = 0;
      try {
        const oprData = await fetchEventOPRs(event.tbaEventKey);
        for (const opr of oprData) {
          const et = eventTeamsList.find(e => e.team.teamNumber === opr.teamNumber);
          if (et) {
            await storage.updateEventTeamOPR(eventId, et.teamId, opr.opr);
            oprsSynced++;
          }
        }
      } catch (oprErr) {
        console.error(`[TBA Auto-Sync] OPR sync error for event ${eventId}:`, oprErr);
      }

      let rankingsSynced = 0;
      try {
        const rankingsData = await fetchEventRankings(event.tbaEventKey);
        for (const r of rankingsData) {
          const et = eventTeamsList.find(e => e.team.teamNumber === r.teamNumber);
          if (et) {
            await storage.updateEventTeamRanking(eventId, et.teamId, r.rankingPoints, r.rank, r.wins, r.losses, r.ties);
            rankingsSynced++;
          }
        }
      } catch (rankErr) {
        console.error(`[TBA Auto-Sync] Rankings sync error for event ${eventId}:`, rankErr);
      }

      const prev = syncStatus.get(eventId)!;
      syncStatus.set(eventId, { ...prev, lastSyncTime: Date.now(), syncing: false });
      notifyEventDataUpdated(eventId);
      console.log(`[TBA Auto-Sync] Event ${eventId}: ${scheduleSynced} schedule, ${resultsSynced} results, ${videosSynced} videos, ${oprsSynced} OPRs, ${rankingsSynced} rankings synced`);
      return true;
    } catch (err) {
      console.error(`[TBA Auto-Sync] Sync error for event ${eventId}:`, err);
      return false;
    } finally {
      const prev = syncStatus.get(eventId);
      if (prev) syncStatus.set(eventId, { ...prev, syncing: false });
    }
  }

  async function expireAutoSync(eventId: number) {
    stopAutoSync(eventId);
    await storage.updateEvent(eventId, { tbaAutoSync: false });
    console.log(`[TBA Auto-Sync] Expired after 3 hours for event ${eventId}`);
  }

  function startAutoSync(eventId: number) {
    if (autoSyncIntervals.has(eventId)) return;

    const now = Date.now();
    const expiresAt = now + AUTO_SYNC_DURATION;
    syncStatus.set(eventId, { lastSyncTime: syncStatus.get(eventId)?.lastSyncTime || null, syncing: false, startedAt: now, expiresAt });

    runSync(eventId).catch(err => {
      const s = syncStatus.get(eventId)!;
      syncStatus.set(eventId, { ...s, syncing: false });
      console.error(`[TBA Auto-Sync] Initial sync error for event ${eventId}:`, err);
    });

    const interval = setInterval(async () => {
      try {
        const event = await storage.getEvent(eventId);
        if (!event?.tbaAutoSync) { stopAutoSync(eventId); return; }
        const ok = await runSync(eventId);
        if (!ok) stopAutoSync(eventId);
      } catch (err) {
        const s = syncStatus.get(eventId)!;
        syncStatus.set(eventId, { ...s, syncing: false });
        console.error(`[TBA Auto-Sync] Error for event ${eventId}:`, err);
      }
    }, 5 * 60 * 1000);
    autoSyncIntervals.set(eventId, interval);

    const expiryTimeout = setTimeout(() => expireAutoSync(eventId), AUTO_SYNC_DURATION);
    autoSyncExpiry.set(eventId, expiryTimeout);

    console.log(`[TBA Auto-Sync] Started for event ${eventId} (expires in 3h)`);
  }

  function stopAutoSync(eventId: number) {
    const interval = autoSyncIntervals.get(eventId);
    if (interval) {
      clearInterval(interval);
      autoSyncIntervals.delete(eventId);
    }
    const expiry = autoSyncExpiry.get(eventId);
    if (expiry) {
      clearTimeout(expiry);
      autoSyncExpiry.delete(eventId);
    }
    const s = syncStatus.get(eventId);
    if (s) {
      syncStatus.set(eventId, { ...s, startedAt: null, expiresAt: null });
    }
    console.log(`[TBA Auto-Sync] Stopped for event ${eventId}`);
  }

  async function initAutoSync() {
    const allEvents = await storage.getEvents();
    for (const event of allEvents) {
      if (event.tbaAutoSync && event.tbaEventKey && event.tbaEventKeyValidated) {
        startAutoSync(event.id);
      }
    }
  }

  function getManualSyncRemaining(eventId: number): { allowed: boolean; remaining: number; resetsAt: number | null } {
    const now = Date.now();
    const log = manualSyncLog.get(eventId) || [];
    const recent = log.filter(t => now - t < MANUAL_SYNC_WINDOW);
    manualSyncLog.set(eventId, recent);
    const remaining = MANUAL_SYNC_LIMIT - recent.length;
    const resetsAt = recent.length > 0 ? recent[0] + MANUAL_SYNC_WINDOW : null;
    return { allowed: remaining > 0, remaining: Math.max(remaining, 0), resetsAt };
  }

  const szrWeightsSchema = z.object({
    auto: z.number().min(0),
    throughput: z.number().min(0),
    accuracy: z.number().min(0),
    defense: z.number().min(0),
    driverSkill: z.number().min(0).optional().default(18),
    climb: z.number().min(0),
  });

  const predictorWeightsSchema = z.object({
    oprWeight: z.number().min(0).max(100),
    szrWeight: z.number().min(0).max(100),
    fallbackCompositeWeight: z.number().min(0).max(100),
    fallbackSzrWeight: z.number().min(0).max(100),
    composite: z.object({
      auto: z.number().min(0),
      throughput: z.number().min(0),
      accuracy: z.number().min(0),
      defense: z.number().min(0),
      climb: z.number().min(0),
      autoClimb: z.number().min(0),
    }),
  });

  app.patch("/api/events/:id/settings", async (req, res) => {
    const id = parseInt(req.params.id);
    const event = await storage.getEvent(id);
    if (!event) return res.sendStatus(404);
    const {
      tbaEventKey,
      tbaAutoSync,
      tbaEventKeyValidated,
      szrWeights,
      predictorWeights,
      testingOverrideEventEnded,
      testingOverrideMatchNumber,
      allianceSimFourPartnerSlots,
    } = req.body;
    const updates: Record<string, unknown> = {};
    if (tbaEventKey !== undefined) {
      updates.tbaEventKey = tbaEventKey || null;
      if ((tbaEventKey || null) !== (event.tbaEventKey || null)) {
        updates.tbaEventKeyValidated = false;
      }
    }
    if (tbaEventKeyValidated !== undefined) updates.tbaEventKeyValidated = !!tbaEventKeyValidated;
    if (tbaAutoSync !== undefined) {
      const willBeValidated = updates.tbaEventKeyValidated !== undefined ? updates.tbaEventKeyValidated : event.tbaEventKeyValidated;
      if (tbaAutoSync && !willBeValidated) {
        return res.status(400).json({ message: "Validate event key before enabling auto-sync." });
      }
      updates.tbaAutoSync = !!tbaAutoSync;
    }
    if (szrWeights !== undefined) {
      const parsed = szrWeightsSchema.safeParse(szrWeights);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid SZR weights: all values must be non-negative numbers." });
      }
      updates.szrWeights = JSON.stringify(parsed.data);
    }
    if (predictorWeights !== undefined) {
      const parsed = predictorWeightsSchema.safeParse(predictorWeights);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid match predictor weights. OPR/SZR blend 0–100; composite weights must be non-negative." });
      }
      updates.predictorWeights = JSON.stringify(parsed.data);
    }
    if (testingOverrideEventEnded !== undefined) updates.testingOverrideEventEnded = !!testingOverrideEventEnded;
    if (testingOverrideMatchNumber !== undefined) {
      const n = testingOverrideMatchNumber == null || testingOverrideMatchNumber === "" ? null : parseInt(String(testingOverrideMatchNumber), 10);
      updates.testingOverrideMatchNumber = n != null && Number.isFinite(n) && n >= 1 ? n : null;
    }
    const hadFourSlots = !!event.allianceSimFourPartnerSlots;
    if (allianceSimFourPartnerSlots !== undefined) updates.allianceSimFourPartnerSlots = !!allianceSimFourPartnerSlots;
    const updated = await storage.updateEvent(id, updates as Partial<Event>);
    if (!updated) return res.sendStatus(404);
    if (hadFourSlots && !updated.allianceSimFourPartnerSlots) {
      await storage.normalizeAllianceSimPicksForEvent(id, 2);
    }
    if (updated.tbaAutoSync && updated.tbaEventKey) {
      startAutoSync(updated.id);
    } else {
      stopAutoSync(updated.id);
    }
    notifyEventDataUpdated(id);
    res.json(updated);
  });

  app.post("/api/events/:id/tba/manual-sync", async (req, res) => {
    if (!isTbaConfigured()) return res.status(503).json({ message: "TBA API key not configured. Add TBA_API_KEY to your .env file." });
    const id = parseInt(req.params.id);
    const event = await storage.getEvent(id);
    if (!event || !event.tbaEventKey) return res.status(400).json({ message: "No TBA event key configured" });

    const rateInfo = getManualSyncRemaining(id);
    if (!rateInfo.allowed) {
      return res.status(429).json({ message: "Manual sync limit reached (3 per 15 min)", resetsAt: rateInfo.resetsAt });
    }

    const log = manualSyncLog.get(id) || [];
    log.push(Date.now());
    manualSyncLog.set(id, log);

    try {
      const s = syncStatus.get(id) || { lastSyncTime: null, syncing: false, startedAt: null, expiresAt: null };
      syncStatus.set(id, { ...s, syncing: true });
      await runSync(id);
      notifyEventDataUpdated(id);
      const updated = getManualSyncRemaining(id);
      res.json({ success: true, remaining: updated.remaining, resetsAt: updated.resetsAt });
    } catch (err: any) {
      const s = syncStatus.get(id)!;
      syncStatus.set(id, { ...s, syncing: false });
      if (err instanceof TbaRateLimitError) return res.status(429).json({ message: err.message, resetsAt: err.resetsAt });
      res.status(500).json({ message: err?.message ?? "TBA sync failed" });
    }
  });

  app.get("/api/events/:id/tba/sync-status", async (req, res) => {
    const id = parseInt(req.params.id);
    const event = await storage.getEvent(id);
    if (!event) return res.sendStatus(404);
    const status = syncStatus.get(id);
    const rateInfo = getManualSyncRemaining(id);
    res.json({
      tbaConfigured: isTbaConfigured(),
      connected: !!event.tbaEventKey,
      autoSync: event.tbaAutoSync,
      syncing: status?.syncing || false,
      lastSyncTime: status?.lastSyncTime || null,
      expiresAt: status?.expiresAt || null,
      manualSyncsRemaining: rateInfo.remaining,
      manualSyncResetsAt: rateInfo.resetsAt,
    });
  });

  app.get("/api/events/:eventId/picklists", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    if (!Number.isFinite(eventId)) return res.status(400).json({ message: "Invalid event id" });
    const list = await storage.getPicklists(eventId);
    const counts = await storage.getPicklistEntryCounts(eventId);
    const withStats = list.map((p) => ({ ...p, entryCount: counts.get(p.id) ?? 0 }));
    res.json(withStats);
  });

  app.post("/api/events/:eventId/picklists", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const adminOnly = !!req.body?.adminOnly;
      const icon = typeof req.body?.icon === "string" ? req.body.icon : null;
      const color = typeof req.body?.color === "string" ? req.body.color : null;
      if (!Number.isFinite(eventId)) return res.status(400).json({ message: "Invalid event id" });
      if (!name) return res.status(400).json({ message: "Name is required" });
      if (adminOnly && req.user?.role !== "admin") return res.status(403).json({ message: "Admin required to create admin-only picklist" });
      if (icon != null && !["sword", "shield", "bolt"].includes(icon)) return res.status(400).json({ message: "Invalid icon" });
      if (color != null && !["red", "orange", "yellow", "green", "blue", "violet"].includes(color)) return res.status(400).json({ message: "Invalid color" });
      const event = await storage.getEvent(eventId);
      if (!event) return res.sendStatus(404);
      const createdById = req.user?.id;
      const picklist = await storage.createPicklist(eventId, { name, adminOnly, icon, color }, createdById);
      notifyEventDataUpdated(eventId);
      res.status(201).json(picklist);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to create picklist";
      const hint = msg.includes("relation") || msg.includes("does not exist") ? " Run: npm run db:push" : "";
      res.status(500).json({ message: msg + hint });
    }
  });

  app.patch("/api/events/:eventId/picklists/:picklistId", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const picklistId = parseInt(req.params.picklistId);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() || undefined : undefined;
    const adminOnly = req.body?.adminOnly;
    const icon = req.body?.icon;
    const color = req.body?.color;
    if (!Number.isFinite(eventId) || !Number.isFinite(picklistId)) return res.status(400).json({ message: "Invalid id" });
    const list = await storage.getPicklists(eventId);
    const picklist = list.find((p) => p.id === picklistId);
    if (!picklist) return res.sendStatus(404);
    if ((picklist as { adminOnly?: boolean }).adminOnly && req.user?.role !== "admin") return res.status(403).json({ message: "Admin-only picklist" });
    if (adminOnly !== undefined && req.user?.role !== "admin") return res.status(403).json({ message: "Admin required to change admin-only setting" });
    const updates: { name?: string; adminOnly?: boolean; icon?: string | null; color?: string | null } = {};
    if (name !== undefined) updates.name = name;
    if (adminOnly !== undefined) updates.adminOnly = !!adminOnly;
    if (icon !== undefined) {
      if (icon === null || icon === "") updates.icon = null;
      else if (typeof icon === "string" && ["sword", "shield", "bolt"].includes(icon)) updates.icon = icon;
      else return res.status(400).json({ message: "Invalid icon" });
    }
    if (color !== undefined) {
      if (color === null || color === "") updates.color = null;
      else if (typeof color === "string" && ["red", "orange", "yellow", "green", "blue", "violet"].includes(color)) updates.color = color;
      else return res.status(400).json({ message: "Invalid color" });
    }
    if (Object.keys(updates).length === 0) return res.json(picklist);
    const updated = await storage.updatePicklist(picklistId, updates);
    notifyEventDataUpdated(eventId);
    res.json(updated);
  });

  app.delete("/api/events/:eventId/picklists/:picklistId", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const picklistId = parseInt(req.params.picklistId);
    if (!Number.isFinite(eventId) || !Number.isFinite(picklistId)) return res.status(400).json({ message: "Invalid id" });
    const list = await storage.getPicklists(eventId);
    const picklist = list.find((p) => p.id === picklistId);
    if (!picklist) return res.sendStatus(404);
    if ((picklist as { adminOnly?: boolean }).adminOnly && req.user?.role !== "admin") return res.status(403).json({ message: "Admin-only picklist" });
    await storage.deletePicklist(picklistId);
    notifyEventDataUpdated(eventId);
    res.sendStatus(204);
  });

  app.get("/api/events/:eventId/picklists/:picklistId/entries", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const picklistId = parseInt(req.params.picklistId);
    if (!Number.isFinite(eventId) || !Number.isFinite(picklistId)) return res.status(400).json({ message: "Invalid id" });
    const list = await storage.getPicklists(eventId);
    if (!list.some((p) => p.id === picklistId)) return res.sendStatus(404);
    const entries = await storage.getPicklistEntries(picklistId);
    res.json(entries);
  });

  app.put("/api/events/:eventId/picklists/:picklistId/entries", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const picklistId = parseInt(req.params.picklistId);
    const { teamIds } = req.body;
    if (!Number.isFinite(eventId) || !Number.isFinite(picklistId)) return res.status(400).json({ message: "Invalid id" });
    if (!Array.isArray(teamIds)) return res.status(400).json({ message: "teamIds must be an array" });
    const list = await storage.getPicklists(eventId);
    const picklist = list.find((p) => p.id === picklistId);
    if (!picklist) return res.sendStatus(404);
    if ((picklist as { adminOnly?: boolean }).adminOnly && req.user?.role !== "admin") return res.status(403).json({ message: "Admin-only picklist" });
    await storage.setPicklistEntries(picklistId, teamIds);
    const entries = await storage.getPicklistEntries(picklistId);
    notifyEventDataUpdated(eventId);
    res.json(entries);
  });

  app.delete("/api/events/:eventId/picklists/:picklistId/entries/:teamId", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const picklistId = parseInt(req.params.picklistId);
    const teamId = parseInt(req.params.teamId);
    if (!Number.isFinite(eventId) || !Number.isFinite(picklistId) || !Number.isFinite(teamId)) return res.status(400).json({ message: "Invalid id" });
    const list = await storage.getPicklists(eventId);
    const picklist = list.find((p) => p.id === picklistId);
    if (!picklist) return res.sendStatus(404);
    if ((picklist as { adminOnly?: boolean }).adminOnly && req.user?.role !== "admin") return res.status(403).json({ message: "Admin-only picklist" });
    await storage.removeFromPicklistEntries(picklistId, teamId);
    const entries = await storage.getPicklistEntries(picklistId);
    notifyEventDataUpdated(eventId);
    res.json(entries);
  });

  const allianceSimApiDebug =
    process.env.ALLIANCE_SIM_DEBUG === "1" || process.env.NODE_ENV !== "production";
  function asimApi(...args: unknown[]) {
    if (allianceSimApiDebug) console.log("[AllianceSim:api]", ...args);
  }

  function allianceSimEnriched(row: AllianceSimSession, partnerSlots: 2 | 3) {
    const picks = sortPicksCanonical(normalizePicks(row.picks, partnerSlots));
    const maxP = allianceSimMaxPicks(partnerSlots);
    return {
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      picks,
      captainRobots: normalizeCaptainRobots(row.captainRobots),
      partnerSlots,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      pickCount: picks.length,
      isComplete: picks.length >= maxP,
      partnersByCaptain: computePartnersByCaptain(picks, partnerSlots),
    };
  }

  const allianceSimPickSchema2 = z.object({
    captainSlot: z.number().int().min(1).max(8),
    partnerIndex: z.union([z.literal(0), z.literal(1)]),
    teamId: z.number().int(),
  });
  const allianceSimPickSchema3 = z.object({
    captainSlot: z.number().int().min(1).max(8),
    partnerIndex: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    teamId: z.number().int(),
  });

  app.get("/api/events/:eventId/alliance-sim/sessions", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const partnerSlots = partnerSlotCountFromEvent(event);
    const maxP = allianceSimMaxPicks(partnerSlots);
    const rows = await storage.getAllianceSimSessions(eventId);
    res.json(
      rows.map((r) => {
        const picks = normalizePicks(r.picks, partnerSlots);
        return {
          id: r.id,
          eventId: r.eventId,
          name: r.name,
          partnerSlots,
          pickCount: picks.length,
          isComplete: picks.length >= maxP,
          updatedAt: r.updatedAt,
        };
      }),
    );
  });

  app.post("/api/events/:eventId/alliance-sim/sessions", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ message: "Title is required" });
    try {
      const session = await storage.createAllianceSimSession(eventId, {
        name,
        createdById: req.user?.id,
      });
      const ev = await storage.getEvent(eventId);
      res.status(201).json(allianceSimEnriched(session, partnerSlotCountFromEvent(ev ?? {})));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      const hint = msg.includes("relation") || msg.includes("does not exist") ? " Run: npm run db:push" : "";
      res.status(500).json({ message: msg + hint });
    }
  });

  app.get("/api/events/:eventId/alliance-sim/sessions/:sessionId", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!Number.isFinite(eventId) || !Number.isFinite(sessionId)) return res.status(400).json({ message: "Invalid id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const session = await storage.getAllianceSimSession(sessionId);
    if (!session || session.eventId !== eventId) return res.sendStatus(404);
    res.json(allianceSimEnriched(session, partnerSlotCountFromEvent(event)));
  });

  app.patch("/api/events/:eventId/alliance-sim/sessions/:sessionId", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!Number.isFinite(eventId) || !Number.isFinite(sessionId)) return res.status(400).json({ message: "Invalid id" });
    const event = await storage.getEvent(eventId);
    if (!event) return res.sendStatus(404);
    const session = await storage.getAllianceSimSession(sessionId);
    if (!session || session.eventId !== eventId) return res.sendStatus(404);
    const partnerSlots = partnerSlotCountFromEvent(event);
    asimApi("PATCH alliance-sim session", {
      eventId,
      sessionId,
      userId: req.user?.id,
      role: req.user?.role,
      bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body as object) : [],
    });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
    let captainRobots: string[] | undefined;
    if (req.body?.captainRobots !== undefined) {
      const cr = z.array(z.string()).safeParse(req.body.captainRobots);
      if (!cr.success) return res.status(400).json({ message: "Invalid captainRobots" });
      captainRobots = normalizeCaptainRobots(cr.data);
    }
    let picks: AllianceSimPick[] | undefined;
    if (req.body?.picks !== undefined) {
      const rawPicks = req.body.picks;
      asimApi("PATCH picks incoming", {
        isArray: Array.isArray(rawPicks),
        length: Array.isArray(rawPicks) ? rawPicks.length : null,
        sample: Array.isArray(rawPicks) ? rawPicks.slice(0, 4) : rawPicks,
      });
      const pickSchema = partnerSlots === 3 ? allianceSimPickSchema3 : allianceSimPickSchema2;
      const parsed = z.array(pickSchema).safeParse(rawPicks);
      if (!parsed.success) {
        asimApi("PATCH picks zod error", parsed.error.flatten(), parsed.error.issues);
        return res.status(400).json({ message: "Invalid picks payload" });
      }
      const normalized = sortPicksCanonical(normalizePicks(parsed.data, partnerSlots));
      const allowedIds = await storage.getAllianceSimAllowedTeamIds(eventId);
      asimApi("PATCH picks normalized + allowed set", {
        normalized,
        allowedIdCount: allowedIds.size,
        allowedSample: [...allowedIds].slice(0, 20),
      });
      const err = validateAllianceSimPicks(normalized, allowedIds, partnerSlots);
      if (err) {
        asimApi("PATCH picks validateAllianceSimPicks failed", err);
        return res.status(400).json({ message: err });
      }
      picks = normalized;
    }
    const updated = await storage.updateAllianceSimSession(sessionId, { name, captainRobots, picks });
    if (!updated) {
      asimApi("PATCH updateAllianceSimSession returned undefined", { hadPicks: picks !== undefined });
      if (picks !== undefined) return res.status(400).json({ message: "Could not save picks (validation failed)." });
      return res.sendStatus(404);
    }
    asimApi("PATCH success", { sessionId, pickCount: normalizePicks(updated.picks, partnerSlots).length });
    res.json(allianceSimEnriched(updated, partnerSlots));
  });

  app.delete("/api/events/:eventId/alliance-sim/sessions/:sessionId", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!Number.isFinite(eventId) || !Number.isFinite(sessionId)) return res.status(400).json({ message: "Invalid id" });
    const session = await storage.getAllianceSimSession(sessionId);
    if (!session || session.eventId !== eventId) return res.sendStatus(404);
    await storage.deleteAllianceSimSession(sessionId);
    res.sendStatus(204);
  });

  app.post("/api/events/:eventId/alliance-sim/sessions/:sessionId/reset", requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!Number.isFinite(eventId) || !Number.isFinite(sessionId)) return res.status(400).json({ message: "Invalid id" });
    const session = await storage.getAllianceSimSession(sessionId);
    if (!session || session.eventId !== eventId) return res.sendStatus(404);
    const ev = await storage.getEvent(eventId);
    if (!ev) return res.sendStatus(404);
    const updated = await storage.resetAllianceSimPicks(sessionId);
    if (!updated) return res.sendStatus(404);
    res.json(allianceSimEnriched(updated, partnerSlotCountFromEvent(ev)));
  });

  await seedAdminUser();
  await seedDatabase();
  await initAutoSync();

  return httpServer;
}
