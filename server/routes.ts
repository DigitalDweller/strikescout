import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertTeamSchema, insertScoutingEntrySchema } from "@shared/schema";
import { z } from "zod";
import { fetchMatchVideos, fetchMatchResults, getVideoUrl, validateEventKey, fetchTeamAvatars, fetchEventOPRs, fetchMatchSchedule, fetchEventRankings, fetchEventTeams, isTbaConfigured } from "./tba";

async function seedDatabase() {
  const events = await storage.getEvents();
  if (events.length > 0) return;

  await storage.createEvent({
    name: "2026 Houston Regional",
    location: "Houston, TX",
    startDate: "2026-03-15",
    isActive: true,
    currentMatchNumber: 1,
  });

  console.log("Database seeded with initial data");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/events", async (_req, res) => {
    const allEvents = await storage.getEvents();
    res.json(allEvents);
  });

  app.post("/api/events", async (req, res) => {
    const parsed = insertEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const event = await storage.createEvent(parsed.data);
    res.status(201).json(event);
  });

  app.get("/api/events/:id", async (req, res) => {
    const event = await storage.getEvent(parseInt(req.params.id));
    if (!event) return res.sendStatus(404);
    res.json(event);
  });

  app.patch("/api/events/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.updateEvent(id, req.body);
    if (!event) return res.sendStatus(404);
    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    await storage.deleteEvent(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.post("/api/events/:id/set-active", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid event id" });
    const event = await storage.getEvent(id);
    if (!event) return res.sendStatus(404);
    await storage.setActiveEvent(id);
    const updated = await storage.getEvent(id);
    res.json(updated!);
  });

  app.get("/api/active-event", async (_req, res) => {
    const event = await storage.getActiveEvent();
    res.json(event || null);
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
    res.status(201).json(eventTeam);
  });

  app.delete("/api/events/:eventId/teams/:teamId", async (req, res) => {
    await storage.removeTeamFromEvent(
      parseInt(req.params.eventId),
      parseInt(req.params.teamId)
    );
    res.sendStatus(204);
  });

  app.post("/api/entries", async (req, res) => {
    const parsed = insertScoutingEntrySchema.safeParse({
      ...req.body,
      scouterId: 0,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entry = await storage.createScoutingEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.patch("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid entry id" });
    const updated = await storage.updateScoutingEntry(id, req.body);
    if (!updated) return res.sendStatus(404);
    res.json(updated);
  });

  app.delete("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteScoutingEntry(id);
    res.sendStatus(204);
  });

  app.get("/api/events/:eventId/entries", async (req, res) => {
    const entries = await storage.getEntriesByEvent(parseInt(req.params.eventId));
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

  app.get("/api/events/:eventId/schedule", async (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    if (!Number.isFinite(eventId) || eventId < 1) {
      return res.json([]);
    }
    const schedule = await storage.getScheduleByEvent(eventId);
    res.json(schedule ?? []);
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
        }
      }
      res.json(result);
    } catch (err: any) {
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

      res.json({ synced, total: qualMatches.length });
    } catch (err: any) {
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
      res.json({ added, total: tbaTeams.length });
    } catch (err: any) {
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

      res.json({ synced, total: teamNumbers.length });
    } catch (err: any) {
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
          await storage.updateEventTeamOPR(eventId, et.teamId, opr.opr, opr.dpr, opr.ccwm);
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

      res.json({
        oprsSynced,
        rankingsSynced,
        total: eventTeamsList.length,
      });
    } catch (err: any) {
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

      res.json({ synced, total: tbaMatches.length });
    } catch (err: any) {
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

      res.json({ synced, total: results.length });
    } catch (err: any) {
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
            await storage.updateEventTeamOPR(eventId, et.teamId, opr.opr, opr.dpr, opr.ccwm);
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

  app.patch("/api/events/:id/settings", async (req, res) => {
    const id = parseInt(req.params.id);
    const event = await storage.getEvent(id);
    if (!event) return res.sendStatus(404);
    const { tbaEventKey, tbaAutoSync, tbaEventKeyValidated } = req.body;
    const updates: { tbaEventKey?: string | null; tbaEventKeyValidated?: boolean; tbaAutoSync?: boolean } = {};
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
    const updated = await storage.updateEvent(id, updates);
    if (!updated) return res.sendStatus(404);
    if (updated.tbaAutoSync && updated.tbaEventKey) {
      startAutoSync(updated.id);
    } else {
      stopAutoSync(updated.id);
    }
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
      const updated = getManualSyncRemaining(id);
      res.json({ success: true, remaining: updated.remaining, resetsAt: updated.resetsAt });
    } catch (err: any) {
      const s = syncStatus.get(id)!;
      syncStatus.set(id, { ...s, syncing: false });
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
    res.json(list);
  });

  app.post("/api/events/:eventId/picklists", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      if (!Number.isFinite(eventId)) return res.status(400).json({ message: "Invalid event id" });
      if (!name) return res.status(400).json({ message: "Name is required" });
      const event = await storage.getEvent(eventId);
      if (!event) return res.sendStatus(404);
      const picklist = await storage.createPicklist(eventId, name);
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
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!Number.isFinite(eventId) || !Number.isFinite(picklistId)) return res.status(400).json({ message: "Invalid id" });
    if (!name) return res.status(400).json({ message: "Name is required" });
    const list = await storage.getPicklists(eventId);
    if (!list.some((p) => p.id === picklistId)) return res.sendStatus(404);
    const updated = await storage.updatePicklist(picklistId, { name });
    res.json(updated);
  });

  app.delete("/api/events/:eventId/picklists/:picklistId", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const picklistId = parseInt(req.params.picklistId);
    if (!Number.isFinite(eventId) || !Number.isFinite(picklistId)) return res.status(400).json({ message: "Invalid id" });
    const list = await storage.getPicklists(eventId);
    if (!list.some((p) => p.id === picklistId)) return res.sendStatus(404);
    await storage.deletePicklist(picklistId);
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
    if (!list.some((p) => p.id === picklistId)) return res.sendStatus(404);
    await storage.setPicklistEntries(picklistId, teamIds);
    const entries = await storage.getPicklistEntries(picklistId);
    res.json(entries);
  });

  app.delete("/api/events/:eventId/picklists/:picklistId/entries/:teamId", async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    const picklistId = parseInt(req.params.picklistId);
    const teamId = parseInt(req.params.teamId);
    if (!Number.isFinite(eventId) || !Number.isFinite(picklistId) || !Number.isFinite(teamId)) return res.status(400).json({ message: "Invalid id" });
    const list = await storage.getPicklists(eventId);
    if (!list.some((p) => p.id === picklistId)) return res.sendStatus(404);
    await storage.removeFromPicklistEntries(picklistId, teamId);
    const entries = await storage.getPicklistEntries(picklistId);
    res.json(entries);
  });

  await seedDatabase();
  await initAutoSync();

  return httpServer;
}
