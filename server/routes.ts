import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { insertEventSchema, insertTeamSchema, insertScoutingEntrySchema } from "@shared/schema";
import { z } from "zod";

async function seedDatabase() {
  const existingAdmin = await storage.getUserByUsername("admin123");
  if (existingAdmin) return;

  await storage.createUser({
    username: "admin123",
    password: await hashPassword("admin123"),
    displayName: "Team Admin",
    role: "scouter",
  });

  await storage.createUser({
    username: "scout1",
    password: await hashPassword("scout123"),
    displayName: "Alex Johnson",
    role: "scouter",
  });

  await storage.createUser({
    username: "scout2",
    password: await hashPassword("scout123"),
    displayName: "Jordan Smith",
    role: "scouter",
  });

  const event = await storage.createEvent({
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
  setupAuth(app);

  app.get("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const allEvents = await storage.getEvents();
    res.json(allEvents);
  });

  app.post("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = insertEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const event = await storage.createEvent(parsed.data);
    res.status(201).json(event);
  });

  app.get("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const event = await storage.getEvent(parseInt(req.params.id));
    if (!event) return res.sendStatus(404);
    res.json(event);
  });

  app.patch("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const event = await storage.updateEvent(parseInt(req.params.id), req.body);
    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.deleteEvent(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.post("/api/events/:id/set-active", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.setActiveEvent(parseInt(req.params.id));
    const event = await storage.getEvent(parseInt(req.params.id));
    res.json(event);
  });

  app.get("/api/active-event", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const event = await storage.getActiveEvent();
    res.json(event || null);
  });

  app.get("/api/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const allTeams = await storage.getTeams();
    res.json(allTeams);
  });

  app.post("/api/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getTeamByNumber(parsed.data.teamNumber);
    if (existing) return res.status(400).send("Team number already exists");
    const team = await storage.createTeam(parsed.data);
    res.status(201).json(team);
  });

  app.post("/api/teams/import", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.deleteTeam(parseInt(req.params.id));
    res.sendStatus(204);
  });

  app.get("/api/events/:eventId/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const result = await storage.getEventTeams(parseInt(req.params.eventId));
    res.json(result);
  });

  app.post("/api/events/:eventId/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const eventTeam = await storage.addTeamToEvent({
      eventId: parseInt(req.params.eventId),
      teamId: req.body.teamId,
    });
    res.status(201).json(eventTeam);
  });

  app.delete("/api/events/:eventId/teams/:teamId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    await storage.removeTeamFromEvent(
      parseInt(req.params.eventId),
      parseInt(req.params.teamId)
    );
    res.sendStatus(204);
  });

  app.get("/api/scouters/:id/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const entries = await storage.getEntriesByScouter(parseInt(req.params.id));
    res.json(entries);
  });

  app.post("/api/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const parsed = insertScoutingEntrySchema.safeParse({
      ...req.body,
      scouterId: req.user!.id,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const entry = await storage.createScoutingEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.get("/api/events/:eventId/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const entries = await storage.getEntriesByEvent(parseInt(req.params.eventId));
    res.json(entries);
  });

  app.get("/api/events/:eventId/teams/:teamId/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const entries = await storage.getEntriesByEventAndTeam(
      parseInt(req.params.eventId),
      parseInt(req.params.teamId)
    );
    res.json(entries);
  });

  app.get("/api/events/:eventId/match/:matchNumber/entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const entries = await storage.getEntriesByMatch(
      parseInt(req.params.eventId),
      parseInt(req.params.matchNumber)
    );
    res.json(entries);
  });

  app.get("/api/events/:eventId/schedule", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const schedule = await storage.getScheduleByEvent(parseInt(req.params.eventId));
    res.json(schedule);
  });

  app.post("/api/events/:eventId/schedule", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const eventId = parseInt(req.params.eventId);
    const { matches } = req.body;
    if (!Array.isArray(matches)) return res.status(400).send("matches must be an array");

    await storage.deleteScheduleByEvent(eventId);

    const results = [];
    for (const m of matches) {
      const match = await storage.createScheduleMatch({
        eventId,
        matchNumber: m.matchNumber,
        red1: m.red1 || null,
        red2: m.red2 || null,
        red3: m.red3 || null,
        blue1: m.blue1 || null,
        blue2: m.blue2 || null,
        blue3: m.blue3 || null,
        time: m.time || null,
      });
      results.push(match);
    }
    res.status(201).json(results);
  });

  await seedDatabase();

  return httpServer;
}
